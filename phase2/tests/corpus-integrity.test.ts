import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve,sep } from 'node:path';

const manifest=JSON.parse(readFileSync('OFFICIAL_CORPUS_MANIFEST.json','utf8'));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
describe('Phase2 official original archive, offline integrity and truthful assurance',()=>{
  it('contains the mandatory acquisition/identity/provenance fields for all three chambers',()=>{
    const keys=['source_document_id','source_institution','source_url','retrieved_at','original_sha256','file_mime_type','document_type','court','chamber','resolution_number','resolution_date','document_version','extraction_status','verification_status','provenance_evidence','reuse_rights_status','page_count'];
    expect(new Set(manifest.documents.map((d:any)=>d.chamber))).toEqual(new Set(['Sala Constitucional','Sala Civil y Comercial','Sala Penal']));
    for(const doc of manifest.documents)for(const key of keys)expect(doc[key],doc.source_document_id+':'+key).toBeDefined();
  });
  for(const doc of manifest.documents)it('preserves exact PDF bytes for '+doc.source_document_id,()=>{
    const path=resolve(doc.original_path);expect(path.startsWith(resolve('phase2/corpus/originals')+sep)).toBe(true);
    const bytes=readFileSync(path);expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(sha(bytes)).toBe(doc.original_sha256);
    expect(new URL(doc.source_url).hostname).toBe('www.pj.gov.py');
  });
  it('keeps derived extraction bound to each original and preserves page count',()=>{
    for(const doc of manifest.documents){
      const bytes=readFileSync(doc.extraction_path),extraction=JSON.parse(bytes.toString('utf8'));
      expect(sha(bytes)).toBe(doc.extraction_sha256);expect(extraction.original_sha256).toBe(doc.original_sha256);
      expect(extraction.page_count).toBe(doc.page_count);expect(extraction.pages).toHaveLength(doc.page_count);
      expect(extraction.extraction_is_original).toBe(false);expect(extraction.ocr_used).toBe(false);
    }
  });
  it('does not label public download or a scanned signature as checker authentication',()=>{
    for(const doc of manifest.documents){
      expect(doc.verification_status).toBe('UNVERIFIED_FOR_CHECKER');
      expect(doc.production_indexing_permitted).toBe(false);
      expect(doc.provenance_evidence.host_trusted_attestation).toBe('ABSENT');
      expect(doc.provenance_evidence.signature_validation).toBe('NOT_RUN');
    }
  });
  it('records the scanned constitutional original and penal metadata limitation explicitly',()=>{
    const constitutional=manifest.documents.find((d:any)=>d.chamber==='Sala Constitucional');
    const penal=manifest.documents.find((d:any)=>d.chamber==='Sala Penal');
    expect(constitutional.extraction_status).toBe('IMAGE_ONLY_OCR_NOT_RUN');expect(constitutional.extracted_characters).toBe(0);
    expect(penal.identity_review_status).toContain('NUMBER_DATE_NOT_PRINTED');
    expect(penal.blockers).toContain('CONTEXTUAL_IDENTITY_APPROVAL_REQUIRED');
  });
});
