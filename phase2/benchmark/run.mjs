import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentSchema } from '../../dist/domain/contracts.js';
import { DeterministicCitationChecker, citationLabel } from '../../dist/citation-checker/index.js';

globalThis.fetch=async()=>{throw new Error('NETWORK_FORBIDDEN_IN_OFFLINE_BENCHMARK');};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFile(resolve(root,path));
const freeze=JSON.parse(await read('phase2/benchmark/freeze.json'));
const datasetBytes=await read('phase2/benchmark/cases-v1.json'),manifestBytes=await read('phase2/benchmark/corpus-input-manifest.json');
if(sha(datasetBytes)!==freeze.dataset_sha256 || sha(manifestBytes)!==freeze.corpus_input_manifest_sha256)throw new Error('FROZEN_INPUT_MISMATCH');
for(const [path,digest] of Object.entries(freeze.artifact_sha256))if(sha(await read(path))!==digest)throw new Error('ENGINE_OR_RUNNER_CHANGED:'+path);
const dataset=JSON.parse(datasetBytes),manifest=JSON.parse(manifestBytes),documents=[];
for(const d of manifest.documents){
  if(sha(await read(d.original_path))!==d.original_sha256 || sha(await read(d.extraction_path))!==d.extraction_sha256)throw new Error('REAL_CORPUS_INTEGRITY_MISMATCH:'+d.source_document_id);
  const extracted=JSON.parse(await read(d.extraction_path));
  if(extracted.original_sha256!==d.original_sha256 || extracted.source_document_id!==d.source_document_id)throw new Error('EXTRACTION_SOURCE_MISMATCH');
  let offset=0;const spans=[],locations=[];
  for(const page of extracted.pages){
    locations.push({page:page.page,start:offset,end:offset+page.text.length});
    if(page.text.length)spans.push({passage_id:d.document_version+':p'+page.page,text:page.text,start:offset,end:offset+page.text.length,page:page.page,nature:'DOCUMENT_CONTENT'});
    offset+=page.text.length+1;
  }
  documents.push(DocumentSchema.parse({document_id:d.source_document_id,document_version_id:d.document_version,study_id:null,matter_id:null,
    source_type:'OFFICIAL_CASELAW',origin_uri:d.source_url,original_hash_sha256:d.original_sha256,
    ingestion_status:spans.length?'READY':'FAILED',verification_status:'UNVERIFIED',authority_record:null,extraction_quality:spans.length?'UNCERTAIN':'UNREADABLE',
    text_spans:spans,page_locations:locations,is_test_fixture:false,
    metadata:{jurisdiction:'PY',court:d.court,chamber:d.chamber,resolution_type:'Acuerdo y Sentencia',number:d.resolution_number,date:d.resolution_date,official_id:null,valid_from:null,valid_to:null}}));
}
const checker=new DeterministicCitationChecker(); // Intentionally no trusted registry and no simulation mode.
const results=[];
for(const c of dataset.cases){
  const scoped=structuredClone(documents);
  if(c.availability_fault_injection)scoped.find(d=>d.document_id===c.source_document_id).verification_status='UNAVAILABLE';
  if(c.private_document_fault_injection){
    const d=structuredClone(scoped.find(d=>d.document_id===c.source_document_id));
    Object.assign(d,{document_id:'ADVERSARIAL_PRIVATE_ALLEGATION_NOT_OFFICIAL',document_version_id:'ADVERSARIAL_PRIVATE_ALLEGATION_NOT_OFFICIAL:v1',source_type:'PRIVATE_MATTER',study_id:'BENCHMARK_ONLY',matter_id:'BENCHMARK_ONLY',origin_uri:'fixture://private-allegation',is_test_fixture:true,original_hash_sha256:sha(Buffer.from(c.text)),text_spans:[{passage_id:'private:p1',text:c.text,start:0,end:c.text.length,page:1,nature:'PARTY_ALLEGATION'}],page_locations:[{page:1,start:0,end:c.text.length}]});
    scoped.push(DocumentSchema.parse(d));
  }
  if(c.source_excerpt){
    const extracted=JSON.parse(await read(c.source_excerpt.extraction_path)),page=extracted.pages.find(p=>p.page===c.source_excerpt.page);
    if(page.text.slice(c.source_excerpt.start,c.source_excerpt.end)!==c.text)throw new Error('VERBATIM_EXCERPT_MISMATCH');
  }
  const analysis={analysis_id:c.id,request_id:c.id,question_analyzed:'Frozen bibliographic test only',factual_basis:[],legal_analysis:c.text,
    alternative_interpretations:[],supporting_references:[],unresolved_issues:[],additional_evidence_requests:[],limitations:[],completion_status:'NEEDS_MORE_EVIDENCE'};
  const observed=checker.checkAnalysis(analysis,scoped,'phase2-frozen-untrusted-research-corpus','PY');
  const labels=observed.references.map((citation,i)=>citationLabel(citation,observed.checks[i],'phase2-frozen-untrusted-research-corpus',observed.verification_gate));
  const observedIdentities=observed.checks.map(k=>k.identity_status);
  results.push({id:c.id,category:c.category,source_document_id:c.source_document_id,authentic_identity:c.authentic_identity,
    requested_validation:c.requested_validation??null,validation_status:c.validation_status??(c.blocked_metrics?.length?'BLOCKED':'TESTED_OFFLINE'),blocker:c.blocker??null,
    detection:{expected:c.expected_bibliographic_reference_count,observed:observed.extraction.detected_reference_count,recall:Math.min(observed.extraction.detected_reference_count,c.expected_bibliographic_reference_count)/c.expected_bibliographic_reference_count},
    extraction:observed.extraction,observed_checks:observed.checks,export_labels:labels,verification_gate:observed.verification_gate,
    expected_scope_identity:c.expected_scope_identity,offline_scope_expectation_met:c.expected_scope_identity===null?observed.extraction.coverage_status===c.expected_extraction:observedIdentities.includes(c.expected_scope_identity),
    blocked_metrics:c.blocked_metrics??[],fault_injection:c.availability_fault_injection?'SOURCE_UNAVAILABLE_IN_MEMORY':c.private_document_fault_injection?'SYNTHETIC_PRIVATE_ALLEGATION':null});
}
const checks=results.flatMap(r=>r.observed_checks),labels=results.flatMap(r=>r.export_labels);
const identityCounts={};for(const c of checks)identityCounts[c.identity_status]=(identityCounts[c.identity_status]??0)+1;
const expectedTotal=results.reduce((n,r)=>n+r.detection.expected,0),detectedTotal=results.reduce((n,r)=>n+Math.min(r.detection.observed,r.detection.expected),0);
const falseVerified=results.filter(r=>['invented_number','true_number_wrong_court','wrong_date','wrong_chamber','real_resolution_invented_literal','private_document_fictitious_caselaw'].includes(r.category)).flatMap(r=>r.export_labels).filter(label=>label==='VERIFIED').length;
const report={schema_version:'phase2-bibliographic-evaluation-v1',evaluated_at:new Date().toISOString(),date_local:'2026-10-13',timezone:'America/Asuncion',
  overall_status:'BLOCKED_FOR_REAL_AUTHENTICITY_VALIDATION',dataset_sha256:freeze.dataset_sha256,corpus_input_manifest_sha256:freeze.corpus_input_manifest_sha256,
  extractor_version:results[0].extraction.extractor_version,independence:dataset.independence,network_used:false,paid_inference_usd:0,trust_registry:'EMPTY',
  metrics:{citation_detection_recall:detectedTotal/expectedTotal,citation_detection_numerator:detectedTotal,citation_detection_denominator:expectedTotal,
    citation_resolution_accuracy:null,citation_resolution_accuracy_status:'BLOCKED_HOST_TRUST_AND_EXTRACTION_REVIEW',false_verified_count:falseVerified,
    authentic_citations_unresolved:results.filter(r=>r.authentic_identity && !r.export_labels.includes('VERIFIED')).length,
    ambiguous_citations:null,ambiguous_citations_status:'BLOCKED_SECOND_AUTHENTIC_CANDIDATE_ABSENT',unknown_citation_markers:results.reduce((n,r)=>n+r.extraction.unresolved_markers.length,0),
    source_provenance_failures:checks.filter(c=>c.identity_status==='SOURCE_UNAVAILABLE' && c.reason.includes('atestación')).length,
    quote_mismatch_detection:null,quote_mismatch_detection_status:'BLOCKED_TRUST_AND_REVIEWED_TEXT_REQUIRED'},
  supplemental_observations:{case_count:results.length,extracted_reference_count:results.reduce((n,r)=>n+r.extraction.citations.length,0),identity_status_counts:identityCounts,
    verified_label_count:labels.filter(l=>l==='VERIFIED').length,simulated_verified_label_count:labels.filter(l=>l==='SIMULATED_VERIFIED').length,
    offline_scope_expectations_met:results.filter(r=>r.offline_scope_expectation_met).length,offline_scope_expectations_total:results.length,
    interpretation:'Zero false VERIFIED arises from a closed trust gate; it does not establish authentic-resolution or quote-validation accuracy.'},results};
const selected=process.argv.find(a=>a.startsWith('--output='))?.slice('--output='.length)??'phase2/reports/bibliographic-first-evaluation.json';
const output=resolve(root,selected),reportRoot=resolve(root,'phase2/reports'),suffix=relative(reportRoot,output);
if(!suffix || suffix.startsWith('..') || isAbsolute(suffix))throw new Error('OUTPUT_MUST_BE_INSIDE_PHASE2_REPORTS');
await mkdir(reportRoot,{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({output:selected,status:report.overall_status,metrics:report.metrics,supplemental_observations:report.supplemental_observations})+'\n');
