import { generateKeyPairSync, sign } from 'node:crypto';
import { hash } from '../../src/domain/guards.js';
import { OfficialEvidenceRegistry, attestationMessage, type OfficialAttestation } from '../../src/ingestion/provenance.js';
import { syntheticDocument, DEMO_ACTOR } from './index.js';
import { LocalEvidenceIndex } from '../../src/retrieval/index.js';

// Disposable test signer; no application signing capability or real public source.
export function trustFixture(){
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const verifier={key_id:'test-only-verifier',verified_by:'TEST_ONLY_NOT_A_GOVERNMENT_SOURCE',
    public_key_pem:publicKey.export({type:'spki',format:'pem'}).toString(),allowed_hosts:['official.example.test']};
  const now=Date.parse('2026-10-13T00:00:00Z');
  const registry=new OfficialEvidenceRegistry([verifier],()=>now);
  const document=syntheticDocument({is_test_fixture:false,origin_uri:'https://official.example.test/record/9001'});
  const claims:OfficialAttestation['claims']={
    schema_version:'official-evidence-v1',key_id:verifier.key_id,verified_by:verifier.verified_by,
    document_fingerprint:hash(document),original_hash_sha256:document.original_hash_sha256,source_url:document.origin_uri,
    verified_at:'2026-10-12T00:00:00Z',expires_at:'2026-10-20T00:00:00Z',rights_record:'TEST_ONLY_DISPOSABLE_RECORD',
  };
  const signed=(overrides:Partial<OfficialAttestation['claims']>={}):OfficialAttestation=>{
    const value={...claims,...overrides};
    return {claims:value,signature_base64:sign(null,attestationMessage(value),privateKey).toString('base64')};
  };
  const attestation=signed();
  const index=new LocalEvidenceIndex([document]);
  const snapshot=index.snapshot(DEMO_ACTOR,{study_id:DEMO_ACTOR.study_id,matter_id:'asunto-demo'});
  return {verifier,registry,document,claims,attestation,signed,now,snapshot};
}
