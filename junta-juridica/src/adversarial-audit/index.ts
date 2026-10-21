import { AuditSchema, type AdversarialAudit } from '../domain/contracts.js';
import { BoardError, frozenCopy } from '../domain/guards.js';
import type { AuditInput, GeminiProvider } from '../providers/contracts.js';
import type { StageCaller } from '../evidence-router/index.js';

export async function audit(input:AuditInput,provider:GeminiProvider,call:StageCaller):Promise<AdversarialAudit>{
  const result=AuditSchema.parse((await call('ADVERSARIAL_AUDIT',provider,input)).output);
  if(result.analysis_id!==input.analysis.analysis_id)throw new BoardError('AUDIT_ANALYSIS_MISMATCH');
  return frozenCopy(result);
}
