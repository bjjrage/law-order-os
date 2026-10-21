import { AnalysisSchema, type PrincipalAnalysis } from '../domain/contracts.js';
import { BoardError, frozenCopy, validateProvenance } from '../domain/guards.js';
import type { PrincipalInput, SolProvider } from '../providers/contracts.js';
import type { StageCaller } from '../evidence-router/index.js';

export async function analyze(input:PrincipalInput,provider:SolProvider,call:StageCaller):Promise<PrincipalAnalysis>{
  const analysis=AnalysisSchema.parse((await call('PRINCIPAL_ANALYSIS',provider,input)).output);
  if(analysis.request_id!==input.request.request_id)throw new BoardError('ANALYSIS_QUESTION_MISMATCH');
  if(analysis.question_analyzed!==input.request.legal_question){
    if(input.request.consultation_mode!=='GENERAL')throw new BoardError('ANALYSIS_QUESTION_MISMATCH');
    const reported=analysis.question_analyzed;
    analysis.question_analyzed=input.request.legal_question;
    analysis.limitations.push(`El modelo resumió la pregunta como: «${reported}». El host vincula este informe a la pregunta original completa; el auditor debe comprobar la correspondencia del análisis con ese alcance.`);
    analysis.unresolved_issues.push('Revisar la correspondencia entre el alcance completo de la pregunta original y la respuesta; se conservó la reformulación original del modelo para su auditoría.');
  }
  validateProvenance(analysis.factual_basis,[...input.passages,...input.additional_evidence]);
  return frozenCopy(analysis);
}
