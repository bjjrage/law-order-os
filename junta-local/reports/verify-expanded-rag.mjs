import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {prepareCase} from '../../scripts/junta-case.mjs';
import {researchContext} from '../../scripts/library-research.mjs';
import {LibraryResearchSchema} from '../../dist/providers/contracts.js';
const origin='http://127.0.0.1:4313';
const checks=[];
for(const question of ['Decreto 4770 función pública servicio civil','Ley 213 despido justificado preaviso','Jurisprudencia rescisión contrato servicios incumplimiento']){
  const response=await fetch(origin+'/local/junta/library/search?q='+encodeURIComponent(question));assert.equal(response.status,200);
  const research=await response.json();assert.equal(research.retrieval.engine,'SQLITE_FTS5_BM25');LibraryResearchSchema.parse(researchContext(research));
  if(question.startsWith('Decreto'))assert(research.sources.some(s=>s.document_type==='Decreto'&&s.title.includes('4770')));
  if(question.startsWith('Ley'))assert(research.sources.some(s=>s.source_id==='bacn-2608'));
  if(question.startsWith('Jurisprudencia'))assert(research.sources.some(s=>s.source_id.startsWith('digesto-')));
  checks.push({question,retrieval:research.retrieval,sources:research.sources});
}
const saved=JSON.parse(await readFile('.board-data/case-junta/950f72e3-0b40-408b-8d80-9122ae804c24.json','utf8'));
const b=saved.bundle;
const prepared=await prepareCase({study_id:b.actor.study_id,matter_id:b.request.matter_id,actor_id:b.actor.user_id,question:b.request.legal_question,scope:'Revisión documental del contrato de servicios.',subject_area:'Contratos',as_of_date:'2026-10-14',synthetic_data:true,include_library:true,documents:b.documents.map(d=>({id:d.document_id,version_id:d.document_version_id,sha256:d.original_hash_sha256,title:'Contrato ficticio',nature:'UNKNOWN',base64:b.originals.find(o=>o.document_version_id===d.document_version_id).base64}))});
assert.equal(prepared.library_research.retrieval.engine,'SQLITE_FTS5_BM25');LibraryResearchSchema.parse(researchContext(prepared.library_research));
await writeFile('junta-local/reports/rag-real-retrieval-checks.json',JSON.stringify({paid_calls:0,paid_deliberation_run:false,checks,prepared_synthetic_case:prepared.prepared_id,prepared_sources:prepared.library_research.sources},null,2));
console.log(JSON.stringify({status:'PASS',queries:checks.length,prepared_case:prepared.prepared_id,indexed_sources:prepared.library_research.indexed_sources,paid_calls:0}));
