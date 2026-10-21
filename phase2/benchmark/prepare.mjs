import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFile(resolve(root,path));
const manifestBytes=await read('OFFICIAL_CORPUS_MANIFEST.json'),manifest=JSON.parse(manifestBytes);
const ids=['csj-civil-1184-2013','csj-constitucional-1010-2015','csj-penal-162-2023'];
const documents=ids.map(id=>{
  const d=manifest.documents.find(v=>v.source_document_id===id);if(!d)throw new Error('MISSING_REAL_SOURCE:'+id);
  return Object.fromEntries(['source_document_id','source_institution','source_url','retrieved_at','original_sha256','document_type','court','chamber','resolution_number','resolution_date','document_version','original_path','extraction_path','extraction_sha256','extraction_status','identity_review_status','page_count','verification_status','production_indexing_permitted','blockers'].map(k=>[k,d[k]]));
});
for(const d of documents){
  if(sha(await read(d.original_path))!==d.original_sha256 || sha(await read(d.extraction_path))!==d.extraction_sha256)throw new Error('CORPUS_INTEGRITY_MISMATCH:'+d.source_document_id);
}
const civil=documents[0],constitutional=documents[1],penal=documents[2];
const civilExtraction=JSON.parse(await read(civil.extraction_path));
const page=civilExtraction.pages[0],heading=page.text.match(/ACUERDO Y SENTENCIA NÚMERO[^\n]+/u)?.[0];
if(!heading)throw new Error('SOURCE_HEADING_NOT_FOUND');
const ref=(d,{number=d.resolution_number,court=d.court,chamber=d.chamber,date=d.resolution_date,abbreviated=false,quote=null}={})=>
  `${abbreviated?'A. y S.':'Acuerdo y Sentencia'} N° ${number} | tribunal: ${court} | sala: ${chamber} | ${date}${quote===null?'':` | «${quote}»`}`;
const cases=[
  {id:'P2-01',category:'authentic_correct_identity',source_document_id:civil.source_document_id,text:ref(civil),authentic_identity:true,expected_scope_identity:'SOURCE_UNAVAILABLE',blocked_metrics:['citation_resolution_accuracy'],note:'Normalized reference from independently corroborated landing/PDF metadata, not a quotation of the PDF.'},
  {id:'P2-02',category:'invented_number',source_document_id:civil.source_document_id,text:ref(civil,{number:'999999999'}),authentic_identity:false,adversarial_perturbation:'Fabricated number; only absence in the frozen scope is asserted, never universal nonexistence.',expected_scope_identity:'NOT_FOUND_IN_SCOPE'},
  {id:'P2-03',category:'true_number_wrong_court',source_document_id:civil.source_document_id,text:ref(civil,{court:'Tribunal de Prueba Adversarial'}),authentic_identity:false,adversarial_perturbation:'Explicitly invented court label assigned to a real number.',expected_scope_identity:'METADATA_MISMATCH'},
  {id:'P2-04',category:'wrong_date',source_document_id:civil.source_document_id,text:ref(civil,{date:'2013-09-20'}),authentic_identity:false,adversarial_perturbation:'Decision date deliberately shifted by one day.',expected_scope_identity:'METADATA_MISMATCH'},
  {id:'P2-05',category:'wrong_chamber',source_document_id:civil.source_document_id,text:ref(civil,{chamber:'Sala Penal'}),authentic_identity:false,adversarial_perturbation:'Real civil resolution assigned to another chamber.',expected_scope_identity:'METADATA_MISMATCH'},
  {id:'P2-06',category:'real_resolution_invented_literal',source_document_id:civil.source_document_id,text:ref(civil,{quote:'El satélite ordena entregar cien monedas de chocolate.'}),authentic_identity:true,adversarial_perturbation:'Entire quoted sentence fabricated for this negative control.',expected_scope_identity:'SOURCE_UNAVAILABLE',blocked_metrics:['quote_mismatch_detection','citation_resolution_accuracy'],note:'No attestation is fabricated to bypass provenance; quote comparison is blocked before evaluation.'},
  {id:'P2-07',category:'abbreviated_reference',source_document_id:penal.source_document_id,text:ref(penal,{abbreviated:true}),authentic_identity:true,expected_scope_identity:'SOURCE_UNAVAILABLE',blocked_metrics:['citation_resolution_accuracy'],note:'Number/date derive from official publication context; PDF omits those fields. Contextual identity and trust remain unapproved.'},
  {id:'P2-08',category:'ambiguous_reference',source_document_id:civil.source_document_id,text:'A. y S. N° 1184',authentic_identity:false,expected_scope_identity:'INSUFFICIENT_IDENTITY',requested_validation:'AMBIGUOUS',validation_status:'BLOCKED',blocker:'A second authentic, approved same-number candidate is absent. No artificial resolution is added to manufacture ambiguity.'},
  {id:'P2-09',category:'defective_extraction',source_document_id:constitutional.source_document_id,text:ref(constitutional),authentic_identity:true,expected_scope_identity:'SOURCE_UNAVAILABLE',blocked_metrics:['citation_resolution_accuracy','quote_mismatch_detection'],note:'Authentic image-only original has zero extracted characters; no OCR or invented transcription is substituted.'},
  {id:'P2-10',category:'temporarily_unavailable_source',source_document_id:civil.source_document_id,text:ref(civil),authentic_identity:true,expected_scope_identity:'SOURCE_UNAVAILABLE',availability_fault_injection:true,note:'Original was actually downloaded successfully. This case injects UNAVAILABLE in memory; it is not evidence of a real portal outage.'},
  {id:'P2-11',category:'reference_only_in_free_text',source_document_id:civil.source_document_id,text:heading,authentic_identity:true,expected_scope_identity:null,expected_extraction:'REVIEW_REQUIRED',source_excerpt:{extraction_path:civil.extraction_path,page:page.page,start:page.text.indexOf(heading),end:page.text.indexOf(heading)+heading.length,verbatim:true},blocked_metrics:['citation_resolution_accuracy'],note:'Exact source heading writes the resolution number in words. No structured citation is supplied or numeric field silently substituted.'},
  {id:'P2-12',category:'private_document_fictitious_caselaw',source_document_id:civil.source_document_id,text:'La parte invoca '+ref(civil,{number:'998877665'}),authentic_identity:false,private_document_fault_injection:true,adversarial_perturbation:'Synthetic private allegation mentioning a fabricated resolution; never an official original.',expected_scope_identity:'NOT_FOUND_IN_SCOPE'},
].map(c=>({...c,expected_bibliographic_reference_count:1}));
const frozenManifest={schema_version:'phase2-benchmark-corpus-input-v1',origin_manifest_sha256:sha(manifestBytes),documents,production_use:false,trust_registry:'EMPTY',provenance_status:'UNVERIFIED_FOR_CHECKER'};
const dataset={schema_version:'phase2-bibliographic-cases-v1',date_local:'2026-10-13',timezone:'America/Asuncion',independence:'New source identities and cases relative to observed V1/V2; generated by implementation agent, not external legal curation.',status:'PARTIALLY_EVALUABLE_BLOCKED_AUTHENTICITY',rules:['No trust keys or official signatures are synthesized.','Expected absence means NOT_FOUND_IN_SCOPE only.','Ambiguity requires two authentic candidates and remains BLOCKED.','No parser or case tuning after first evaluation.'],cases};
const serialize=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
await mkdir(resolve(root,'phase2/benchmark'),{recursive:true});
const inputBytes=serialize(frozenManifest),datasetBytes=serialize(dataset);
await writeFile(resolve(root,'phase2/benchmark/corpus-input-manifest.json'),inputBytes,{flag:'wx'});
await writeFile(resolve(root,'phase2/benchmark/cases-v1.json'),datasetBytes,{flag:'wx'});
const artifacts=['phase2/benchmark/run.mjs','dist/citation-checker/extraction.js','dist/citation-checker/index.js','dist/domain/contracts.js','dist/domain/guards.js','dist/retrieval/index.js','dist/ingestion/provenance.js'];
const artifactHashes={};for(const path of artifacts)artifactHashes[path]=sha(await read(path));
const freeze={schema_version:'phase2-benchmark-freeze-v1',frozen_at:new Date().toISOString(),evaluation_not_yet_executed:true,dataset_sha256:sha(datasetBytes),corpus_input_manifest_sha256:sha(inputBytes),artifact_sha256:artifactHashes};
await writeFile(resolve(root,'phase2/benchmark/freeze.json'),serialize(freeze),{flag:'wx'});
process.stdout.write(JSON.stringify({dataset_sha256:freeze.dataset_sha256,corpus_input_manifest_sha256:freeze.corpus_input_manifest_sha256,cases:cases.length,frozen_before_evaluation:true})+'\n');
