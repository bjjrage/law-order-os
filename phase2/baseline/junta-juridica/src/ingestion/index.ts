import { DocumentSchema, type LegalDocument, type AccessContext } from '../domain/contracts.js';
import { assertAccess, BoardError, bytesHash, frozenCopy } from '../domain/guards.js';
import type { OfficialEvidenceRegistry } from './provenance.js';
export * from './provenance.js';

export interface IngestedOriginal { document: LegalDocument; original_base64: string }
export type IngestionInput = Omit<LegalDocument, 'original_hash_sha256' | 'text_spans' | 'page_locations' | 'ingestion_status'> & {
  pages: { text: string; nature: 'DOCUMENT_CONTENT' | 'PARTY_ALLEGATION' | 'UNKNOWN' }[];
};
export interface TextExtractor { extract(original: Uint8Array): Promise<IngestionInput['pages']> }
// Untrusted text ingestion never grants official provenance.
export function ingestText(actor: AccessContext, input: IngestionInput, original: Uint8Array): IngestedOriginal {
  if (input.source_type === 'PRIVATE_MATTER') {
    if (!input.study_id || !input.matter_id) throw new BoardError('PRIVATE_SCOPE_REQUIRED');
    assertAccess(actor, { study_id: input.study_id, matter_id: input.matter_id });
  } else if (input.study_id !== null || input.matter_id !== null) throw new BoardError('CORPUS_SCOPE_INVALID');
  if (input.verification_status === 'AUTHORIZED_ORIGINAL' || input.authority_record !== null) throw new BoardError('SELF_DECLARED_AUTHORITY_FORBIDDEN');
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(original);
  if (decoded !== input.pages.map(p => p.text).join('\f')) throw new BoardError('ORIGINAL_TEXT_MISMATCH');
  let offset = 0;
  const text_spans:LegalDocument['text_spans']=[],page_locations:LegalDocument['page_locations']=[];
  input.pages.forEach((page,index)=>{
    const pageStart=offset;page_locations.push({page:index+1,start:pageStart,end:pageStart+page.text.length});
    let position=0,part=0;
    do{
      let end=Math.min(position+4000,page.text.length);
      if(end<page.text.length && /[\uD800-\uDBFF]/u.test(page.text[end-1]!) && /[\uDC00-\uDFFF]/u.test(page.text[end]!))end--;
      text_spans.push({passage_id:`${input.document_version_id}:p${index+1}${part?`:s${part+1}`:''}`,text:page.text.slice(position,end),start:pageStart+position,end:pageStart+end,page:index+1,nature:page.nature});
      position=end;part++;
    }while(position<page.text.length);
    offset+=page.text.length+1;
  });
  const { pages: _pages, ...metadata } = input;
  const document = DocumentSchema.parse({ ...metadata, original_hash_sha256: bytesHash(original), ingestion_status: 'READY', text_spans, page_locations });
  return frozenCopy({ document, original_base64: Buffer.from(original).toString('base64') });
}

// Offline import of an original already checked by an external trusted verifier.
// The signature binds bytes, extracted text, metadata, scope, URL and fixture flag.
export function importAttestedText(actor: AccessContext, input: IngestionInput, original: Uint8Array, attestation: unknown, registry: OfficialEvidenceRegistry): IngestedOriginal {
  const result = ingestText(actor, input, original);
  registry.register(result.document, attestation);
  return result;
}
