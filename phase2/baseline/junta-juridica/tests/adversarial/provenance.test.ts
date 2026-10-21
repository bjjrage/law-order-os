import { describe,it,expect } from 'vitest';
import { ingestText, importAttestedText } from '../../src/ingestion/index.js';
import { OfficialEvidenceRegistry } from '../../src/ingestion/provenance.js';
import { validateEvidenceBundle } from '../../src/ingestion/bundle.js';
import { DeterministicCitationChecker, citationLabel } from '../../src/citation-checker/index.js';
import { hash } from '../../src/domain/guards.js';
import { citationFor,syntheticDocument,DEMO_ACTOR,demoFixture } from '../fixtures/index.js';
import { trustFixture } from '../fixtures/trust.js';
import { LegalBoard } from '../../src/orchestration/index.js';
import { MemoryBoardStore } from '../../src/persistence/index.js';
import { LocalEvidenceIndex } from '../../src/retrieval/index.js';
import { createOfflineProviders } from '../../src/providers/offline.js';
import { DEFAULT_CONFIG } from '../../src/providers/config.js';
import { simulationPrices } from '../fixtures/index.js';

describe('J-002 external provenance trust boundary',()=>{
  it('rejects the audit self-declaration attack at ingestion',()=>{
    const d=syntheticDocument();const {original_hash_sha256:_hash,text_spans:_spans,page_locations:_locations,ingestion_status:_status,...input}=d;
    expect(()=>ingestText(DEMO_ACTOR,{...input,is_test_fixture:false,verification_status:'AUTHORIZED_ORIGINAL',authority_record:'COMPLETE_BUT_UNVERIFIED_SELF_DECLARATION',pages:[{text:d.text_spans[0]!.text,nature:'DOCUMENT_CONTENT'}]},Buffer.from(d.text_spans[0]!.text))).toThrow('SELF_DECLARED_AUTHORITY_FORBIDDEN');
  });
  it('bypassing ingestion with serialized legacy claims still cannot authenticate',()=>{
    const doc=structuredClone(syntheticDocument());doc.is_test_fixture=false;doc.verification_status='AUTHORIZED_ORIGINAL';doc.authority_record='COMPLETE_BUT_UNVERIFIED_SELF_DECLARATION';
    const c=citationFor(doc),check=new DeterministicCitationChecker().check(c,[doc],'s');
    expect(check.identity_status).toBe('SOURCE_UNAVAILABLE');expect(check.provenance_status).toBe('UNTRUSTED');expect(citationLabel(c,check,'s')).toBe('REVIEW_REQUIRED');
  });
  it('fixture flags only grant simulation when the host explicitly chooses simulation',()=>{
    const doc=syntheticDocument(),c=citationFor(doc);
    expect(citationLabel(c,new DeterministicCitationChecker().check(c,[doc],'s'),'s')).toBe('REVIEW_REQUIRED');
    expect(citationLabel(c,new DeterministicCitationChecker({simulation:true}).check(c,[doc],'s'),'s','PASS_IN_SCOPE')).toBe('SIMULATED_VERIFIED');
    const disguised=structuredClone(doc);disguised.is_test_fixture=false;
    expect(new DeterministicCitationChecker({simulation:true}).check(citationFor(disguised),[disguised],'s').identity_status).toBe('SOURCE_UNAVAILABLE');
  });
  it('verifies a signed attestation from a separately trusted disposable test verifier',()=>{
    const t=trustFixture();t.registry.register(t.document,t.attestation);
    const c=citationFor(t.document),check=new DeterministicCitationChecker({registry:t.registry}).check(c,[t.document],'s');
    expect(citationLabel(c,check,'s')).toBe('REVIEW_REQUIRED');
    expect(citationLabel(c,check,'s','PASS_IN_SCOPE')).toBe('VERIFIED');
    expect(check.provenance_record).toMatchObject({verified_by:t.verifier.verified_by,source_url:t.document.origin_uri,original_hash_sha256:t.document.original_hash_sha256,rights_record:t.claims.rights_record});
  });
  it('a valid signature from an unconfigured key is rejected',()=>{const t=trustFixture();expect(()=>new OfficialEvidenceRegistry([],()=>t.now).register(t.document,t.attestation)).toThrow('OFFICIAL_ATTESTATION_INVALID');});
  it('changing claims without resigning is rejected',()=>{const t=trustFixture();const a=structuredClone(t.attestation);a.claims.rights_record='forged';expect(()=>t.registry.register(t.document,a)).toThrow('OFFICIAL_ATTESTATION_INVALID');});
  it.each(['text','metadata','source_url','fixture_flag','scope'] as const)('binds the full document including %s',(field)=>{
    const t=trustFixture();t.registry.register(t.document,t.attestation);const altered=structuredClone(t.document);
    if(field==='text')altered.text_spans[0]!.text='forged';
    if(field==='metadata')altered.metadata.number='999999';
    if(field==='source_url')altered.origin_uri='https://official.example.test/other';
    if(field==='fixture_flag')altered.is_test_fixture=true;
    if(field==='scope')altered.study_id='foreign';
    expect(t.registry.attestationFor(altered)).toBeNull();expect(()=>t.registry.register(altered,t.attestation)).toThrow('OFFICIAL_ATTESTATION_INVALID');
  });
  it.each([
    {expires_at:'2026-10-13T00:00:00Z'},
    {verified_at:'2026-10-14T00:00:00Z'},
    {verified_by:'UNTRUSTED_CALLER'},
    {original_hash_sha256:'0'.repeat(64)},
  ])('rejects expired, future or inconsistent claims %j',(changes)=>{const t=trustFixture();expect(()=>t.registry.register(t.document,t.signed(changes))).toThrow('OFFICIAL_ATTESTATION_INVALID');});
  it('rechecks expiration when using previously registered evidence',()=>{
    const t=trustFixture();let time=t.now;const registry=new OfficialEvidenceRegistry([t.verifier],()=>time);registry.register(t.document,t.attestation);
    time=Date.parse(t.claims.expires_at);expect(registry.attestationFor(t.document)).toBeNull();
  });
  it('an idempotent read invalidates expired provenance without replaying model stages',async()=>{
    const t=trustFixture();let time=t.now;const registry=new OfficialEvidenceRegistry([t.verifier],()=>time);
    registry.register(t.document,t.attestation);
    const request={...demoFixture().request,selected_document_ids:[t.document.document_id],matter_snapshot_id:t.snapshot.snapshot_id,corpus_snapshot_id:t.snapshot.snapshot_id};
    const board=new LegalBoard(new LocalEvidenceIndex([t.document]),new MemoryBoardStore(),createOfflineProviders(),DEFAULT_CONFIG,simulationPrices(),registry);
    const first=await board.execute(DEMO_ACTOR,request,t.snapshot);expect(first.status).toBe('HUMAN_REVIEW_PENDING');
    time=Date.parse(t.claims.expires_at);const next=await board.execute(DEMO_ACTOR,request,t.snapshot);
    expect(next.status).toBe('PARTIAL');expect(next.error_code).toBe('CACHED_REFERENCE_VERIFICATION_REQUIRED');
    expect(next.stages.length).toBe(first.stages.length);expect(next.citation_checks[0]!.provenance_status).toBe('UNTRUSTED');
  });
  it('a lookalike host or plaintext URL is rejected even with a trusted test signature',()=>{
    for(const url of ['https://official.example.test.evil.test/record','http://official.example.test/record']){
      const t=trustFixture(),doc={...t.document,origin_uri:url};const a=t.signed({source_url:url,document_fingerprint:hash(doc)});
      expect(()=>t.registry.register(doc,a)).toThrow('OFFICIAL_ATTESTATION_INVALID');
    }
  });
  it('a trusted signer still cannot promote explicitly synthetic documents',()=>{
    const t=trustFixture(),doc={...t.document,is_test_fixture:true};
    expect(()=>t.registry.register(doc,t.signed({document_fingerprint:hash(doc)}))).toThrow('OFFICIAL_ATTESTATION_INVALID');
  });
  it('imports attested UTF8 originals without granting trust to input claims',()=>{
    const t=trustFixture();const {text_spans:spans,original_hash_sha256:_hash,page_locations:_loc,ingestion_status:_status,...input}=t.document;
    const imported=importAttestedText(DEMO_ACTOR,{...input,pages:[{text:spans[0]!.text,nature:'DOCUMENT_CONTENT'}]},Buffer.from(spans[0]!.text),t.attestation,t.registry);
    expect(t.registry.attestationFor(imported.document)).not.toBeNull();
  });
  function bundle(t:ReturnType<typeof trustFixture>){
    return {actor:DEMO_ACTOR,request:{...demoFixture().request,selected_document_ids:[t.document.document_id],matter_snapshot_id:t.snapshot.snapshot_id,corpus_snapshot_id:t.snapshot.snapshot_id},
      documents:[t.document],originals:[{document_version_id:t.document.document_version_id,base64:Buffer.from(t.document.text_spans[0]!.text).toString('base64')}],attestations:[t.attestation]};
  }
  it('preflights a signed corpus and exact originals without network',()=>{const t=trustFixture();expect(validateEvidenceBundle(bundle(t),t.registry).snapshot).toEqual(t.snapshot);});
  it('bundle-supplied trust keys are rejected by the strict contract',()=>{const t=trustFixture();expect(()=>validateEvidenceBundle({...bundle(t),trusted_verifiers:[t.verifier]},t.registry)).toThrow();});
  it('bundle identity matches cannot replace absent attestations or original bytes',()=>{
    const t=trustFixture(),b=bundle(t);
    expect(()=>validateEvidenceBundle({...b,attestations:[]},t.registry)).toThrow('OFFICIAL_ATTESTATION_REQUIRED');
    expect(()=>validateEvidenceBundle({...b,originals:[]},t.registry)).toThrow('ORIGINAL_HASH_MISMATCH');
  });
  it('valid original hash does not excuse forged extraction offsets or text',()=>{
    const t=trustFixture(),b=structuredClone(bundle(t));b.documents[0]!.text_spans[0]!.start=1;
    expect(()=>validateEvidenceBundle(b,t.registry)).toThrow('ORIGINAL_TEXT_MISMATCH');
  });
});
