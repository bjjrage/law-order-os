import { z } from 'zod';

const id = z.string().min(1).max(128);
export const DocumentChangeSchema = z.object({
  id, command_id: id, law_firm_id: id, matter_id: id, document_id: id,
  version_id: id, previous_change_id: id.nullable(), actor_id: id,
  action: z.enum(['REMOVE', 'RESTORE']), created_at: z.iso.datetime(),
}).strict();
export type DocumentChange = z.infer<typeof DocumentChangeSchema>;
export function lastDocumentChange(changes: readonly DocumentChange[], documentId: string) {
  return changes.findLast(change => change.document_id === documentId);
}
export function documentRemoved(changes: readonly DocumentChange[], documentId: string) {
  return lastDocumentChange(changes, documentId)?.action === 'REMOVE';
}
