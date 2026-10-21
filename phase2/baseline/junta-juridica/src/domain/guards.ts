import { createHash } from 'node:crypto';
import type { AccessContext, Scope, FactualItem, Passage, LegalResearchRequest } from './contracts.js';

export class BoardError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'BoardError'; }
}
export function assertAccess(actor: AccessContext, scope: Scope, requestedBy?: string): void {
  if (actor.study_id !== scope.study_id || !actor.allowed_matter_ids.includes(scope.matter_id) || (requestedBy && requestedBy !== actor.user_id)) throw new BoardError('ACCESS_DENIED');
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b, 'en')).map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}
export const hash = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
export const bytesHash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export function frozenCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (x: unknown): void => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } };
  freeze(copy); return copy;
}
export function requireDelimitedQuestion(request: LegalResearchRequest): void {
  if (/analiz[aá]\s+(?:todo|el expediente completo)|todas las cuestiones|an[aá]lisis integral de(?:l)? expediente/i.test(request.legal_question)) throw new BoardError('ISSUE_PLAN_APPROVAL_REQUIRED');
}
export function validateProvenance(items: FactualItem[], passages: Passage[]): void {
  for (const item of items) {
    if (item.kind !== 'MISSING' && !item.references.length) throw new BoardError('MISSING_PROVENANCE');
    for (const ref of item.references) {
      const p = passages.find(p => p.document_id === ref.document_id && p.source_id === ref.source_id && p.document_version_id === ref.document_version_id && p.passage_id === ref.passage_id);
      if (!p) throw new BoardError('INVALID_PROVENANCE');
      if (item.kind === 'DOCUMENT_CONTENT' && p.nature !== 'DOCUMENT_CONTENT') throw new BoardError('ALLEGATION_PROMOTED_TO_FACT');
    }
  }
}
