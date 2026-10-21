import type { EvidencePack, LegalResearchRequest, Passage, Route } from '../domain/contracts.js';
import { RouterOutputSchema } from '../domain/contracts.js';
import { BoardError, frozenCopy, hash } from '../domain/guards.js';
import type { JevProvider, ModelProvider } from '../providers/contracts.js';
import type { ProviderResult } from '../domain/contracts.js';
import type { BoardConfig } from '../providers/config.js';

export type StageCaller = <I,O>(stage:string,provider:ModelProvider<I,O>,input:I)=>Promise<ProviderResult<O>>;
export async function routeEvidence(request:LegalResearchRequest,candidates:Passage[],provider:JevProvider,call:StageCaller,config:BoardConfig):Promise<EvidencePack> {
  const routes:Route[]=[];
  let batch:Passage[]=[];
  const flush=async()=>{
    if(!batch.length)return;
    const expected=batch;
    const output=RouterOutputSchema.parse((await call('ROUTING_EVIDENCE',provider,{request,candidates:expected})).output);
    const seen=new Set<string>();
    for(const route of output.candidates){
      const key=route.document_id+'|'+route.passage_id;
      if(seen.has(key) || !expected.some(p=>p.document_id===route.document_id && p.passage_id===route.passage_id))throw new BoardError('ROUTER_CANDIDATE_MISMATCH');
      seen.add(key);
    }
    if(seen.size!==expected.length)throw new BoardError('ROUTER_COVERAGE_LOSS');
    routes.push(...output.candidates);batch=[];
  };
  for(const candidate of candidates){
    const proposed=[...batch,candidate];
    let upper=Infinity;
    if(proposed.length<=config.router_batch_size){
      try{upper=provider.prepare({request,candidates:proposed}).input_token_upper_bound;}
      catch(error){if(!(error instanceof BoardError) || error.code!=='JEV_STATE_LIMIT_EXCEEDED')throw error;}
    }
    if(proposed.length>config.router_batch_size || upper>config.router_batch_token_limit){await flush();}
    const singleUpper=provider.prepare({request,candidates:[candidate]}).input_token_upper_bound;
    if(singleUpper>config.router_batch_token_limit)throw new BoardError('CANDIDATE_TOO_LARGE_FOR_ROUTER');
    batch.push(candidate);
  }
  await flush();
  const selected=routes.filter(r=>r.classification!=='NOT_RELATED_TO_THIS_QUESTION');
  const passages=candidates.filter(p=>selected.some(r=>r.document_id===p.document_id && r.passage_id===p.passage_id));
  const data={pack_id:`pack:${hash([request.request_id,routes]).slice(0,24)}`,version:1,request_id:request.request_id,matter_snapshot_id:request.matter_snapshot_id,corpus_snapshot_id:request.corpus_snapshot_id,passages,routes,
    coverage:{candidate_count:candidates.length,selected_count:selected.length,rejected_count:routes.length-selected.length,uncertain_passage_ids:routes.filter(r=>r.classification==='UNCERTAIN').map(r=>r.passage_id),contradictory_passage_ids:routes.filter(r=>r.classification==='POTENTIALLY_CONTRADICTORY').map(r=>r.passage_id),not_selected_passage_ids:routes.filter(r=>r.classification==='NOT_RELATED_TO_THIS_QUESTION').map(r=>r.passage_id),limitations:['Índice local acotado; recuperación textual no garantiza exhaustividad.','Los candidatos inciertos y contradictorios se conservan.','Corpus de prueba cuando is_test_fixture=true; no autentica fuentes externas.']}};
  if(request.consultation_mode==='GENERAL' && !candidates.length)data.coverage.limitations.push('Consulta general sin documentos del asunto. La pregunta y sus supuestos no son hechos probados; no se ejecutó clasificación documental.');
  return frozenCopy({...data,hash:hash(data)});
}
