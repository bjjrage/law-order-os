import { z } from 'zod';

export const id = z.string().min(1).max(200);
export const date = z.iso.date();
export const ScopeSchema = z.strictObject({ study_id: id, matter_id: id });
export type Scope = z.infer<typeof ScopeSchema>;
// Supplied by the host application, never derived from document or model output.
export interface AccessContext { user_id: string; study_id: string; allowed_matter_ids: readonly string[] }
export const RequestSchema = z.strictObject({
  request_id: id, study_id: id, matter_id: id, requested_by: id, jurisdiction: id,
  legal_question: z.string().min(15).max(8000), scope: z.string().min(5), as_of_date: date,
  matter_snapshot_id: id, corpus_snapshot_id: id, selected_document_ids: z.array(id),
  consultation_mode: z.enum(['DOCUMENT_REVIEW', 'GENERAL']).optional(),
  max_cost_usd: z.number().finite().positive(),
}).refine(request => request.consultation_mode === 'GENERAL' || request.selected_document_ids.length > 0, {
  message: 'La revisión documental requiere al menos un documento.', path: ['selected_document_ids'],
});
export type LegalResearchRequest = z.infer<typeof RequestSchema>;
export const SourceTypeSchema = z.enum(['PRIVATE_MATTER', 'OFFICIAL_CASELAW', 'LEGISLATION', 'AUTHORIZED_EDITORIAL']);
export const MetadataSchema = z.strictObject({
  jurisdiction: id, court: z.string().nullable(), chamber: z.string().nullable(),
  resolution_type: z.string().nullable(), number: z.string().nullable(), date: date.nullable(),
  official_id: z.string().nullable(), valid_from: date.nullable(), valid_to: date.nullable(),
});
export type BibliographicMetadata = z.infer<typeof MetadataSchema>;
export const SpanSchema = z.strictObject({
  passage_id: id, text: z.string(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), page: z.number().int().positive(),
  nature: z.enum(['DOCUMENT_CONTENT', 'PARTY_ALLEGATION', 'UNKNOWN']),
});
export const DocumentSchema = z.strictObject({
  document_id: id, document_version_id: id, study_id: id.nullable(), matter_id: id.nullable(),
  source_type: SourceTypeSchema, origin_uri: z.string().min(1), original_hash_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  ingestion_status: z.enum(['READY', 'FAILED']), verification_status: z.enum(['AUTHORIZED_ORIGINAL', 'UNVERIFIED', 'UNAVAILABLE']),
  authority_record: z.string().nullable(), extraction_quality: z.enum(['GOOD', 'UNCERTAIN', 'UNREADABLE']),
  text_spans: z.array(SpanSchema), page_locations: z.array(z.strictObject({ page: z.number().int().positive(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() })),
  metadata: MetadataSchema, is_test_fixture: z.boolean(),
});
export type LegalDocument = z.infer<typeof DocumentSchema>;
export const PassageSchema = SpanSchema.extend({
  document_id: id, document_version_id: id, source_id: id, source_type: SourceTypeSchema,
  original_hash_sha256: z.string(), extraction_quality: z.enum(['GOOD', 'UNCERTAIN', 'UNREADABLE']),
  source_metadata: MetadataSchema, is_test_fixture: z.boolean(),
});
export type Passage = z.infer<typeof PassageSchema>;
export const SourceRefSchema = z.strictObject({ source_id: id, document_id: id, document_version_id: id, passage_id: id });
export type SourceRef = z.infer<typeof SourceRefSchema>;
export const ClassSchema = z.enum(['ESSENTIAL', 'RELEVANT', 'CONTEXTUAL', 'POTENTIALLY_CONTRADICTORY', 'UNCERTAIN', 'NOT_RELATED_TO_THIS_QUESTION']);
export const RouteSchema = z.strictObject({ document_id: id, passage_id: id, classification: ClassSchema, relevance_score: z.number().min(0).max(1), selection_reason: z.string().min(1) });
export type Route = z.infer<typeof RouteSchema>;
export const RouterOutputSchema = z.strictObject({ candidates: z.array(RouteSchema) });
export const FactualItemSchema = z.strictObject({
  statement: z.string().min(1), kind: z.enum(['DOCUMENT_CONTENT', 'PARTY_ALLEGATION', 'MODEL_INFERENCE', 'MISSING']),
  references: z.array(SourceRefSchema), date: date.nullable(),
});
export type FactualItem = z.infer<typeof FactualItemSchema>;
export const PacketSchema = z.strictObject({
  packet_id: id, packet_version: z.number().int().positive(), request_id: id,
  study_id:id, matter_id:id, matter_snapshot_id:id,
  documentary_facts: z.array(FactualItemSchema), party_allegations: z.array(FactualItemSchema),
  chronology: z.array(FactualItemSchema), contested_facts: z.array(FactualItemSchema), contradictions: z.array(FactualItemSchema),
  relevant_documents: z.array(id), missing_information: z.array(z.string()), unresolved_questions: z.array(z.string()), coverage_limitations: z.array(z.string()),
});
export type LegalCasePacket = z.infer<typeof PacketSchema>;
export const CitationSchema = z.strictObject({
  reference_id: id, source_id: id.nullable(), document_version_id: id.nullable(), passage_id: id.nullable(),
  source_type: z.enum(['OFFICIAL_CASELAW', 'LEGISLATION']), jurisdiction: id,
  court: z.string().nullable(), chamber: z.string().nullable(), resolution_type: z.string().nullable(),
  number: z.string().nullable(), date: date.nullable(), official_id: z.string().nullable(),
  quote: z.string().nullable(), raw_text: z.string().nullable(),
});
export type Citation = z.infer<typeof CitationSchema>;
export const RetrievalRequestSchema = z.strictObject({ query: z.string().min(1).max(2000), document_id: id.nullable(), passage_id: id.nullable() });
export type AdditionalEvidenceRequest = z.infer<typeof RetrievalRequestSchema>;
export const AnalysisSchema = z.strictObject({
  analysis_id: id, request_id: id, question_analyzed: z.string(), factual_basis: z.array(FactualItemSchema), legal_analysis: z.string(),
  alternative_interpretations: z.array(z.string()), supporting_references: z.array(CitationSchema), unresolved_issues: z.array(z.string()),
  additional_evidence_requests: z.array(RetrievalRequestSchema), limitations: z.array(z.string()), completion_status: z.enum(['COMPLETE_DRAFT', 'NEEDS_MORE_EVIDENCE']),
});
export type PrincipalAnalysis = z.infer<typeof AnalysisSchema>;
export const FindingSchema = z.strictObject({
  finding_id: id, type: z.enum(['SUSPICIOUS_CITATION', 'UNSUPPORTED_FACT', 'CONTRADICTION', 'MISSING_EVIDENCE', 'QUOTE_OBJECTION']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']), statement: z.string(), related_source_ids: z.array(id), recommended_action: z.string(),
});
export const AuditSchema = z.strictObject({
  audit_id: id, analysis_id: id, findings: z.array(FindingSchema), citation_objections: z.array(z.string()),
  unsupported_fact_flags: z.array(z.string()), missing_evidence_flags: z.array(z.string()), requested_passages: z.array(RetrievalRequestSchema),
  audit_status: z.enum(['REVIEW_REQUIRED', 'NO_OBJECTIONS_IN_SCOPE', 'NEEDS_MORE_EVIDENCE']),
});
export type AdversarialAudit = z.infer<typeof AuditSchema>;
export const IdentitySchema = z.enum(['VERIFIED_IDENTITY', 'METADATA_MISMATCH', 'AMBIGUOUS', 'NOT_FOUND_IN_SCOPE', 'SOURCE_UNAVAILABLE', 'INSUFFICIENT_IDENTITY']);
export const QuoteStatusSchema = z.enum(['QUOTE_MATCH', 'QUOTE_MISMATCH', 'TEXT_UNAVAILABLE', 'EXTRACTION_UNCERTAIN', 'NOT_APPLICABLE']);
export interface CitationCheck {
  reference_id: string; reference_hash: string; corpus_snapshot_id: string; identity_status: z.infer<typeof IdentitySchema>;
  quote_status: z.infer<typeof QuoteStatusSchema>; matched_source_ids: string[]; reason: string;
  document_hash: string | null; document_version_id: string | null; is_test_fixture: boolean;
  provenance_status: 'TRUSTED_OFFICIAL' | 'SIMULATION' | 'UNTRUSTED';
  provenance_record: { key_id: string; verified_by: string; source_url: string; original_hash_sha256: string; verified_at: string; expires_at: string; rights_record: string; attestation_hash: string } | null;
  quote_match: { passage_id: string; start: number; end: number; original_text: string } | null;
}
export interface CoverageManifest {
  candidate_count: number; selected_count: number; rejected_count: number; uncertain_passage_ids: string[];
  contradictory_passage_ids: string[]; not_selected_passage_ids: string[]; limitations: string[];
}
export interface EvidencePack {
  pack_id: string; version: number; request_id: string; matter_snapshot_id: string; corpus_snapshot_id: string;
  passages: Passage[]; routes: Route[]; coverage: CoverageManifest; hash: string;
}
export interface EvidenceSnapshot {
  snapshot_id: string; study_id: string; matter_id: string; documents: LegalDocument[]; hash: string;
}
export interface Usage {
  input_tokens: number | null; output_tokens: number | null; reasoning_tokens_if_available: number | null;
  actual_cost_usd_if_available: number | null; token_count_kind: 'PROVIDER' | 'SIMULATED' | 'UNKNOWN' | 'DETERMINISTIC';
}
export interface ProviderResult<T> { output: T; usage: Usage }
export const RunStatusSchema = z.enum(['CREATED', 'PREPARING_EVIDENCE', 'ROUTING_EVIDENCE', 'BUILDING_CONTEXT', 'PRINCIPAL_ANALYSIS', 'ADVERSARIAL_AUDIT', 'CHECKING_REFERENCES', 'HUMAN_REVIEW_PENDING', 'PARTIAL', 'FAILED', 'CANCELLED']);
export type RunStatus = z.infer<typeof RunStatusSchema>;
export interface StageRecord extends Usage {
  run_id: string; request_id: string; stage_name: string; stage_version: string; model_provider: string; model_id: string;
  input_snapshot_hash: string; output_snapshot_hash: string | null; latency_ms: number;
  estimated_cost_usd: number | null; reserved_cost_usd: number; price_source: string | null;
  status: 'STARTED' | 'PASS' | 'FAIL' | 'BLOCKED'; error_code: string | null; attempt: number;
}
export interface BoardRun extends Scope {
  run_id: string; request_id: string; input_hash: string; mode: 'OFFLINE_SIMULATION' | 'LIVE'; status: RunStatus;
  validity: 'CURRENT' | 'OUTDATED'; history: RunStatus[]; request: LegalResearchRequest; stages: StageRecord[];
  evidence_pack: EvidencePack | null; packet: LegalCasePacket | null; analysis: PrincipalAnalysis | null;
  audit: AdversarialAudit | null; citation_checks: CitationCheck[]; reference_verification: 'NOT_CHECKED' | 'PASS_IN_SCOPE' | 'REVIEW_REQUIRED'; error_code: string | null;
  additional_retrievals: number; draft: true; human_approval: 'PENDING';
}
