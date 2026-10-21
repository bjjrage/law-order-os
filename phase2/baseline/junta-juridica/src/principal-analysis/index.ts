import { AnalysisSchema, type PrincipalAnalysis } from '../domain/contracts.js';
import { BoardError, frozenCopy, validateProvenance } from '../domain/guards.js';
import type { PrincipalInput, SolProvider } from '../providers/contracts.js';
import type { StageCaller } from '../evidence-router/index.js';

export async function analyze(input:PrincipalInput,provider:SolProvider,call:StageCaller):Promise<PrincipalAnalysis>{
  const analysis=AnalysisSchema.parse((await call('PRINCIPAL_ANALYSIS',provider,input)).output);
  if(analysis.request_id!==input.request.request_id || analysis.question_analyzed!==input.request.legal_question)throw new BoardError('ANALYSIS_QUESTION_MISMATCH');
  validateProvenance(analysis.factual_basis,[...input.passages,...input.additional_evidence]);
  return frozenCopy(analysis);
}
