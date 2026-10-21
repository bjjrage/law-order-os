import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { BoardError, bytesHash } from '../domain/guards.js';
import { MemoryBoardStore } from '../persistence/index.js';
import { LegalBoard } from '../orchestration/index.js';
import { createOfflineProviders } from '../providers/offline.js';
import { DEFAULT_CONFIG } from '../providers/config.js';
import { costReport } from '../telemetry/index.js';
import { citationLabel, DeterministicCitationChecker, extractCitations } from '../citation-checker/index.js';
import { citationFor, demoFixture, simulationPrices, syntheticDocument } from './demo.js';

const HOLDOUT_SHA256='f68295e548c863f69a6eb280dee1776a9e9735bd4f5cce0b8b26fc22ecc29399';
const BIBLIOGRAPHY_V2_SHA256='1a5d1a1ee10849e79a986163e71a1cafdc32ace6f7d5611b504685b66cf73735';
const BibliographyV2Schema=z.strictObject({
  set_id:z.string(),synthetic:z.literal(true),authorship:z.string(),
  cases:z.array(z.strictObject({text:z.string(),citations:z.number().int().nonnegative(),unresolved:z.number().int().nonnegative()})),
});
const HoldoutSchema=z.object({set_id:z.string(),synthetic:z.literal(true),document:z.object({number:z.string(),date:z.iso.date(),court:z.string(),resolution_type:z.string(),quote:z.string()}),cases:z.array(z.object({id:z.string(),number:z.string(),court:z.string(),date:z.iso.date(),quote:z.string().nullable(),genuine:z.boolean(),expected_identity:z.string(),expected_quote:z.string().optional()})),extraction_texts:z.array(z.object({text:z.string(),expected_citations:z.number()}))});
const percentile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]??0;
export async function runBenchmark(){
  const runs=[],recalls:number[]=[],omissions:number[]=[];const runLatencies:number[]=[];
  for(let i=0;i<10;i++){
    const f=demoFixture(`benchmark-dev-${i}`);const started=performance.now();const board=new LegalBoard(f.index,new MemoryBoardStore(),createOfflineProviders(),DEFAULT_CONFIG,simulationPrices());
    const run=await board.execute(f.actor,f.request,f.snapshot);runLatencies.push(performance.now()-started);runs.push(run);
    const selected=new Set(run.evidence_pack?.passages.map(p=>p.document_id)??[]);
    recalls.push(f.relevant_document_ids.filter(id=>selected.has(id)).length/f.relevant_document_ids.length);omissions.push(f.critical_document_ids.filter(id=>!selected.has(id)).length);
  }
  const bytes=await readFile(resolve('junta-juridica/tests/fixtures/holdout.json'));
  if(bytesHash(bytes)!==HOLDOUT_SHA256)throw new BoardError('HOLDOUT_FREEZE_HASH_MISMATCH');
  const h=HoldoutSchema.parse(JSON.parse(bytes.toString('utf8')));const checker=new DeterministicCitationChecker({simulation:true});
  const doc=syntheticDocument({document_id:'holdout-official-synthetic',metadata:{jurisdiction:'PY',court:h.document.court,chamber:null,resolution_type:h.document.resolution_type,number:h.document.number,date:h.document.date,official_id:null,valid_from:null,valid_to:null}},h.document.quote);
  const evaluations=h.cases.map(c=>{
    const citation=citationFor(doc,{reference_id:c.id,source_id:null,document_version_id:null,passage_id:null,official_id:null,number:c.number,court:c.court,date:c.date,quote:c.quote});
    const result=checker.check(citation,[doc],'holdout-v1');
    return {id:c.id,genuine:c.genuine,identity:result.identity_status,quote:result.quote_status,export_label:citationLabel(citation,result,'holdout-v1','PASS_IN_SCOPE'),pass:result.identity_status===c.expected_identity && (!c.expected_quote || result.quote_status===c.expected_quote)};
  });
  const extraction=h.extraction_texts.map(c=>{const actual=extractCitations(c.text,'PY');return {expected:c.expected_citations,detected:actual.citations.length,unresolved_markers:actual.unresolved_markers.length};});
  const bibliographyBytes=await readFile(resolve('junta-juridica/tests/fixtures/bibliography-holdout-v2.json'));
  if(bytesHash(bibliographyBytes)!==BIBLIOGRAPHY_V2_SHA256)throw new BoardError('BIBLIOGRAPHY_V2_FREEZE_HASH_MISMATCH');
  const bibliography=BibliographyV2Schema.parse(JSON.parse(bibliographyBytes.toString('utf8')));
  const bibliographyCases=bibliography.cases.map((c,i)=>{
    const actual=extractCitations(c.text,'PY');
    return {case_id:i+1,expected_citations:c.citations,actual_citations:actual.citations.length,expected_unresolved:c.unresolved,
      actual_unresolved:actual.unresolved_markers.length,coverage_status:actual.coverage_status,
      pass:actual.citations.length===c.citations && actual.unresolved_markers.length===c.unresolved && actual.detected_reference_count===c.citations+c.unresolved && (c.unresolved===0 || actual.coverage_status==='REVIEW_REQUIRED')};
  });
  const reports=runs.map(costReport);
  return {status:runs.every(r=>r.status==='HUMAN_REVIEW_PENDING') && evaluations.every(e=>e.pass) && extraction.every(e=>e.detected===e.expected) && bibliographyCases.every(e=>e.pass)?'PASS':'FAIL',mode:'OFFLINE_SIMULATION',provider_quality_evaluation:'NOT_RUN',real_integration:'NOT_RUN',holdout:{set_id:h.set_id,sha256:HOLDOUT_SHA256,frozen_before_evaluation:true,independent_validation:false,usage:'Previously inspected; regression only.',cases:evaluations,extraction},
    bibliography_v2:{set_id:bibliography.set_id,sha256:BIBLIOGRAPHY_V2_SHA256,frozen_before_evaluation:true,external_independent_validation:false,
      implementation_corrected_after_first_evaluation:true,usage:'Known regression after first evaluation; see preserved first-evaluation report.',authorship:bibliography.authorship,
      cases:bibliographyCases,passed:bibliographyCases.filter(c=>c.pass).length,total:bibliographyCases.length},
    development:{set_id:'demo-development-v1',runs:runs.length,relevant_document_recall:recalls.reduce((n,v)=>n+v,0)/recalls.length,critical_document_omission:omissions.reduce((n,v)=>n+v,0),audit_findings:runs.reduce((n,r)=>n+(r.audit?.findings.length??0),0),input_tokens:reports.reduce((n,r)=>n+r.input_tokens,0),output_tokens:reports.reduce((n,r)=>n+r.output_tokens,0),token_count_kind:'SIMULATED',cost_per_run:reports.map(r=>({estimated_simulation_usd:r.estimated_total_usd,actual_paid_usd:0})),latency_p50_ms:percentile(runLatencies,0.5),latency_p90_ms:percentile(runLatencies,0.9),provider_errors:runs.reduce((n,r)=>n+r.stages.filter(s=>s.status==='FAIL').length,0)},
    citation_extraction_recall:extraction.reduce((n,e)=>n+Math.min(e.detected,e.expected),0)/extraction.reduce((n,e)=>n+e.expected,0),
    false_verified_citations:evaluations.filter(e=>!e.genuine && e.identity==='VERIFIED_IDENTITY').length,
    genuine_citations_unresolved:evaluations.filter(e=>e.genuine && e.identity!=='VERIFIED_IDENTITY').length,
    limitations:['Fixtures sintéticos; no corpus jurídico paraguayo auténtico.','Recall documental mide reglas de simulación, no Jev.','Un solo caso de recuperación repetido mide variabilidad temporal local, no generalización.','Holdout pequeño: no justifica porcentajes de reducción de alucinaciones.','Gramática finita de extracción; citas fuera de gramática requieren revisión humana.']};
}
