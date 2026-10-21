import { ingestText } from '../ingestion/index.js';
import { LocalEvidenceIndex } from '../retrieval/index.js';
import { hash } from '../domain/guards.js';
import type { AccessContext, BibliographicMetadata, Citation, LegalDocument, LegalResearchRequest } from '../domain/contracts.js';
import type { Price } from '../telemetry/index.js';
import { createOfflineProviders } from '../providers/offline.js';

export const DEMO_ACTOR:AccessContext={user_id:'abogado-demo',study_id:'estudio-demo',allowed_matter_ids:['asunto-demo']};
export const EMPTY_METADATA:BibliographicMetadata={jurisdiction:'PY',court:null,chamber:null,resolution_type:null,number:null,date:null,official_id:null,valid_from:null,valid_to:null};
export function syntheticDocument(overrides:Partial<LegalDocument>={},text='La notificación requiere constancia documental.'):LegalDocument {
  const sourceType=overrides.source_type??'OFFICIAL_CASELAW';
  const documentId=overrides.document_id??'synthetic-judgment';
  const version=overrides.document_version_id??`${documentId}:v1`;
  const input={document_id:documentId,document_version_id:version,study_id:sourceType==='PRIVATE_MATTER'?DEMO_ACTOR.study_id:null,matter_id:sourceType==='PRIVATE_MATTER'?'asunto-demo':null,
    source_type:sourceType,origin_uri:`fixture://${documentId}`,verification_status:'UNVERIFIED' as const,authority_record:null,extraction_quality:'GOOD' as const,
    metadata:{...EMPTY_METADATA,court:'Tribunal Sintético de Prueba',chamber:'Sala Ficticia',resolution_type:'Sentencia',number:'9001',date:'2024-01-15',official_id:'SYNTHETIC:9001'},is_test_fixture:true,
    ...overrides,pages:[{text,nature:sourceType==='PRIVATE_MATTER'?'PARTY_ALLEGATION' as const:'DOCUMENT_CONTENT' as const}]};
  return ingestText(DEMO_ACTOR,input,Buffer.from(text,'utf8')).document;
}
export function citationFor(doc:LegalDocument,overrides:Partial<Citation>={}):Citation {
  const {valid_from:_from,valid_to:_to,...metadata}=doc.metadata;
  return {reference_id:'citation-demo',source_id:doc.document_id,document_version_id:doc.document_version_id,passage_id:doc.text_spans[0]?.passage_id??null,source_type:doc.source_type==='LEGISLATION'?'LEGISLATION':'OFFICIAL_CASELAW',...metadata,quote:null,raw_text:null,...overrides};
}
export function demoFixture(requestId='demo-offline-v2') {
  const official=syntheticDocument();
  const constancia=syntheticDocument({document_id:'constancia',source_type:'PRIVATE_MATTER',metadata:{...EMPTY_METADATA}},'El documento registra una notificación entregada en domicilio el 2024-02-01.');
  const contradiccion=syntheticDocument({document_id:'oposicion',source_type:'PRIVATE_MATTER',metadata:{...EMPTY_METADATA}},'La parte afirma que no fue notificado y contradice la constancia de notificación.');
  const incierto=syntheticDocument({document_id:'ilegible',source_type:'PRIVATE_MATTER',extraction_quality:'UNCERTAIN',metadata:{...EMPTY_METADATA}},'Constancia de notificación parcialmente ilegible; fecha incierta.');
  const unrelated=syntheticDocument({document_id:'inventario',source_type:'PRIVATE_MATTER',metadata:{...EMPTY_METADATA}},'Inventario de mobiliario: escritorio y silla.');
  // Extraction nature is explicit; the constancia is documentary content, not an adjudicated legal truth.
  const doc=structuredClone(constancia);doc.text_spans[0]!.nature='DOCUMENT_CONTENT';
  const documents=[official,doc,contradiccion,incierto,unrelated];const index=new LocalEvidenceIndex(documents);const snapshot=index.snapshot(DEMO_ACTOR,{study_id:DEMO_ACTOR.study_id,matter_id:'asunto-demo'});
  const request:LegalResearchRequest={request_id:requestId,study_id:DEMO_ACTOR.study_id,matter_id:'asunto-demo',requested_by:DEMO_ACTOR.user_id,jurisdiction:'PY',legal_question:'¿Qué evidencia documental permite evaluar la validez de la notificación cuestionada?',scope:'Solo evidencia de notificación; ejemplo sintético.',as_of_date:'2026-10-12',matter_snapshot_id:snapshot.snapshot_id,corpus_snapshot_id:snapshot.snapshot_id,selected_document_ids:documents.map(d=>d.document_id),max_cost_usd:5};
  return {actor:DEMO_ACTOR,documents,index,snapshot,request,critical_document_ids:['constancia','oposicion','ilegible'],relevant_document_ids:['synthetic-judgment','constancia','oposicion','ilegible']};
}
export function simulationPrices():Price[]{return Object.values(createOfflineProviders()).map(p=>({model_id:p.model_id,input_per_million_usd:1,output_per_million_usd:2,source:'ARTIFICIAL_TEST_RATE: no es tarifa de ningún proveedor',as_of_date:'2026-10-12',mode:'SIMULATION'}));}
export const fixtureHash=(documents:LegalDocument[])=>hash(documents);
