import { z } from 'zod';
import { DocumentSchema, RequestSchema } from '../domain/contracts.js';
import { BoardError, bytesHash, hash } from '../domain/guards.js';
import { LocalEvidenceIndex } from '../retrieval/index.js';
import { OfficialAttestationSchema, OfficialEvidenceRegistry } from './provenance.js';

export const EvidenceBundleSchema = z.strictObject({
  actor:z.strictObject({user_id:z.string(),study_id:z.string(),allowed_matter_ids:z.array(z.string())}),
  request:RequestSchema,documents:z.array(DocumentSchema).min(1),
  originals:z.array(z.strictObject({document_version_id:z.string(),base64:z.string()})),
  attestations:z.array(OfficialAttestationSchema).default([]),
  current_document_versions:z.record(z.string(),z.string()).default({}),
});
// Pure preflight: no store writes, HTTP or inference. Trust is supplied by the host.
export function validateEvidenceBundle(raw:unknown,registry:OfficialEvidenceRegistry) {
  const bundle=EvidenceBundleSchema.parse(raw);
  if(new Set(bundle.documents.map(d=>d.document_version_id)).size!==bundle.documents.length)throw new BoardError('DUPLICATE_DOCUMENT_VERSION');
  if(new Set(bundle.originals.map(o=>o.document_version_id)).size!==bundle.originals.length)throw new BoardError('DUPLICATE_ORIGINAL');
  for(const doc of bundle.documents){
    if(doc.is_test_fixture)throw new BoardError('LIVE_REQUIRES_AUTHORIZED_NON_FIXTURE_CORPUS');
    if(doc.verification_status==='AUTHORIZED_ORIGINAL' || doc.authority_record!==null)throw new BoardError('SELF_DECLARED_AUTHORITY_FORBIDDEN');
    const original=bundle.originals.find(o=>o.document_version_id===doc.document_version_id);
    if(!original || bytesHash(Buffer.from(original.base64,'base64'))!==doc.original_hash_sha256)throw new BoardError('ORIGINAL_HASH_MISMATCH');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(original.base64,'base64'));
    const pages=text.split('\f');let offset=0;
    if(doc.page_locations.length!==pages.length)throw new BoardError('ORIGINAL_TEXT_MISMATCH');
    for(const [i,page] of pages.entries()){
      const location=doc.page_locations[i]!;
      const spans=doc.text_spans.filter(s=>s.page===i+1).sort((a,b)=>a.start-b.start);
      if(location.page!==i+1 || location.start!==offset || location.end!==offset+page.length || !spans.length)throw new BoardError('ORIGINAL_TEXT_MISMATCH');
      let position=offset;
      for(const span of spans){
        if(span.start!==position || span.end!==span.start+span.text.length || span.end>location.end || text.slice(span.start,span.end)!==span.text)throw new BoardError('ORIGINAL_TEXT_MISMATCH');
        position=span.end;
      }
      if(position!==location.end)throw new BoardError('ORIGINAL_TEXT_MISMATCH');
      offset+=page.length+1;
    }
    if(doc.text_spans.some(s=>s.page>pages.length))throw new BoardError('ORIGINAL_TEXT_MISMATCH');
    if(['OFFICIAL_CASELAW','LEGISLATION'].includes(doc.source_type)){
      const attestation=bundle.attestations.find(a=>a.claims.document_fingerprint===hash(doc));
      if(!attestation)throw new BoardError('OFFICIAL_ATTESTATION_REQUIRED');
      registry.register(doc,attestation);
    }
  }
  const index=new LocalEvidenceIndex(bundle.documents,undefined,bundle.current_document_versions);
  const snapshot=index.snapshot(bundle.actor,bundle.request);
  if(snapshot.snapshot_id!==bundle.request.matter_snapshot_id || snapshot.snapshot_id!==bundle.request.corpus_snapshot_id)throw new BoardError('SNAPSHOT_VERSION_MISMATCH');
  return {bundle,index,snapshot,registry};
}
