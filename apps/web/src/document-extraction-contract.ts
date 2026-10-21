import { z } from 'zod';
import { MAX_TEXT_CHARS } from './document-policy.js';
const id = z.string().min(1).max(128), digest = z.string().regex(/^[a-f0-9]{64}$/);
export const ExtractionSchema = z.object({
  format: z.enum(['txt', 'pdf', 'docx']), method: z.enum(['UTF8', 'PDF_TEXT', 'DOCX_XML']),
  status: z.enum(['COMPLETE_UNREVIEWED', 'REVIEW_REQUIRED', 'UNREADABLE']), text: z.string().max(MAX_TEXT_CHARS),
  text_sha256: digest, original_sha256: digest, units: z.array(z.object({ label: z.string(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), readable: z.boolean() }).strict()).max(2000),
  warnings: z.array(z.string().max(600)).max(2000), extractor_version: z.literal('local-document-v1'), truncated: z.literal(false),
}).strict();
export const StoredExtractionSchema = ExtractionSchema.extend({ law_firm_id: id, matter_id: id, document_id: id, version_id: id }).strict();
export type Extraction = z.infer<typeof ExtractionSchema>;
export type StoredExtraction = z.infer<typeof StoredExtractionSchema>;
