import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import { DocumentSchema, type LegalDocument } from '../domain/contracts.js';
import { BoardError, frozenCopy, hash } from '../domain/guards.js';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const AttestationClaimsSchema = z.strictObject({
  schema_version: z.literal('official-evidence-v1'),
  key_id: z.string().min(1), verified_by: z.string().min(1),
  document_fingerprint: digest, original_hash_sha256: digest,
  source_url: z.url(), verified_at: z.iso.datetime(), expires_at: z.iso.datetime(),
  rights_record: z.string().min(1),
});
export const OfficialAttestationSchema = z.strictObject({
  claims: AttestationClaimsSchema,
  signature_base64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type OfficialAttestation = z.infer<typeof OfficialAttestationSchema>;
export const TrustedVerifierSchema = z.strictObject({
  key_id: z.string().min(1), verified_by: z.string().min(1), public_key_pem: z.string().min(1),
  allowed_hosts: z.array(z.string().min(1)).min(1),
});
export type TrustedVerifier = z.infer<typeof TrustedVerifierSchema>;
// The signer signs this domain-separated fingerprint of the complete claims.
export const attestationMessage = (claims: OfficialAttestation['claims']): Buffer =>
  Buffer.from('LAW_ORDER_OFFICIAL_EVIDENCE_V1\n' + hash(AttestationClaimsSchema.parse(claims)), 'utf8');

/**
 * Operator-owned trust configuration, never accepted from an evidence bundle.
 * No bundled signing key and no automatic signature issuance. Signatures attest
 * what an external verifier checked; they cannot establish legal truth themselves.
 */
export class OfficialEvidenceRegistry {
  private readonly verifiers = new Map<string, { config: TrustedVerifier; key: KeyObject }>();
  private readonly records = new Map<string, OfficialAttestation>();
  constructor(verifiers: readonly TrustedVerifier[] = [], private readonly now: () => number = Date.now) {
    for (const raw of verifiers) {
      const config = TrustedVerifierSchema.parse(raw);
      if (this.verifiers.has(config.key_id)) throw new BoardError('DUPLICATE_TRUSTED_VERIFIER');
      const key = createPublicKey(config.public_key_pem);
      if (key.asymmetricKeyType !== 'ed25519') throw new BoardError('ED25519_VERIFIER_REQUIRED');
      this.verifiers.set(config.key_id, { config: frozenCopy(config), key });
    }
  }
  private valid(document: LegalDocument, record: OfficialAttestation): boolean {
    const { claims } = record;
    const trusted = this.verifiers.get(claims.key_id);
    if (!trusted || trusted.config.verified_by !== claims.verified_by) return false;
    if (!['OFFICIAL_CASELAW', 'LEGISLATION'].includes(document.source_type) || document.is_test_fixture) return false;
    if (claims.document_fingerprint !== hash(document) || claims.original_hash_sha256 !== document.original_hash_sha256 || claims.source_url !== document.origin_uri) return false;
    const url = new URL(claims.source_url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !trusted.config.allowed_hosts.includes(url.hostname)) return false;
    const checked = Date.parse(claims.verified_at), expires = Date.parse(claims.expires_at), now = this.now();
    if (checked > now || expires <= now || expires <= checked) return false;
    return verify(null, attestationMessage(claims), trusted.key, Buffer.from(record.signature_base64, 'base64'));
  }
  register(rawDocument: LegalDocument, rawRecord: unknown): void {
    const document = DocumentSchema.parse(rawDocument);
    const record = OfficialAttestationSchema.parse(rawRecord);
    if (!this.valid(document, record)) throw new BoardError('OFFICIAL_ATTESTATION_INVALID');
    const fingerprint = hash(document);
    const prior = this.records.get(fingerprint);
    if (prior && hash(prior) !== hash(record)) throw new BoardError('ATTESTATION_CONFLICT');
    this.records.set(fingerprint, frozenCopy(record));
  }
  attestationFor(document: LegalDocument): OfficialAttestation | null {
    const record = this.records.get(hash(document));
    return record && this.valid(document, record) ? frozenCopy(record) : null;
  }
  fingerprint(): string {
    return hash({ verifiers: [...this.verifiers.values()].map(v => v.config).sort((a,b) => a.key_id.localeCompare(b.key_id)),
      records: [...this.records.entries()].sort(([a],[b]) => a.localeCompare(b)) });
  }
}
