import { setTimeout as delay } from 'node:timers/promises';
import { RequestSchema, type AccessContext, type AdditionalEvidenceRequest, type BoardRun, type EvidenceSnapshot, type LegalCasePacket, type Passage, type ProviderResult, type RunStatus, type StageRecord } from '../domain/contracts.js';
import { assertAccess, BoardError, frozenCopy, hash, requireDelimitedQuestion, validateProvenance } from '../domain/guards.js';
import { routeEvidence, type StageCaller } from '../evidence-router/index.js';
import { buildContext } from '../context-builder/index.js';
import { analyze } from '../principal-analysis/index.js';
import { audit } from '../adversarial-audit/index.js';
import { OfficialEvidenceRegistry } from '../ingestion/provenance.js';
import { DeterministicCitationChecker } from '../citation-checker/index.js';
import { passagesOf, type LegalEvidenceProvider } from '../retrieval/index.js';
import type { BoardStore } from '../persistence/index.js';
import { BoardConfigSchema, type BoardConfig } from '../providers/config.js';
import { LibraryResearchSchema, type LibraryResearch, ProviderError, UNKNOWN_USAGE, type BoardProviders, type ModelProvider } from '../providers/contracts.js';
import { reserveBudget, tokenCost, usageCost, type Price } from '../telemetry/index.js';

const TERMINAL:RunStatus[]=['HUMAN_REVIEW_PENDING','PARTIAL','FAILED','CANCELLED'];
export interface ExecuteOptions {signal?:AbortSignal;previous_packet?:LegalCasePacket;authorize_paid_calls?:boolean;resume_context_classification?:boolean;resume_analysis_metadata?:boolean;library_research?:LibraryResearch}
export class LegalBoard {
  constructor(private readonly evidence:LegalEvidenceProvider,private readonly store:BoardStore,private readonly providers:BoardProviders,private readonly config:BoardConfig,private readonly prices:Price[],private readonly registry = new OfficialEvidenceRegistry()){BoardConfigSchema.parse(config);}
  async execute(actor:AccessContext,rawRequest:unknown,snapshot:EvidenceSnapshot,options:ExecuteOptions={}):Promise<BoardRun>{
    const request=RequestSchema.parse(rawRequest);assertAccess(actor,request,request.requested_by);requireDelimitedQuestion(request);
    const research=options.library_research?LibraryResearchSchema.parse(options.library_research):undefined;
    const authorizedDocuments=this.evidence.documents(actor,request,snapshot);
    if(options.previous_packet){
      assertAccess(actor,options.previous_packet);
      if(options.previous_packet.study_id!==request.study_id || options.previous_packet.matter_id!==request.matter_id)throw new BoardError('PREVIOUS_PACKET_SCOPE_MISMATCH');
      validateProvenance([...options.previous_packet.documentary_facts,...options.previous_packet.party_allegations,...options.previous_packet.chronology,...options.previous_packet.contested_facts,...options.previous_packet.contradictions],authorizedDocuments.flatMap(passagesOf));
    }
    const simulated=Object.values(this.providers).every(p=>p.simulated);
    if(!simulated && Object.values(this.providers).some(p=>p.simulated))throw new BoardError('MIXED_REAL_AND_SIMULATED_PROVIDERS');
    const mode=simulated?'OFFLINE_SIMULATION':'LIVE';
    if(!simulated && options.authorize_paid_calls!==true)throw new BoardError('EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED');
    const runId=`run:${hash([request.study_id,request.matter_id,request.request_id]).slice(0,32)}`;
    const inputHash=hash({...(research?{library_research:research}:{}),verification_policy_version:3,trust_registry_hash:this.registry.fingerprint(),request,snapshot_hash:snapshot.hash,config:this.config,prices:this.prices,models:Object.values(this.providers).map(p=>({provider:p.provider,model:p.model_id})),previous_packet:options.previous_packet??null});
    const release=await this.store.lock(actor,request,runId);
    try{
      const existing=await this.store.loadRun(actor,request,runId);
      const documentaryResume=existing?.status==='PARTIAL' && existing.error_code==='ALLEGATION_PROMOTED_TO_FACT' && existing.stages.length===2 && existing.stages[0]?.stage_name==='ROUTING_EVIDENCE' && existing.stages[0]?.status==='PASS' && existing.stages[1]?.stage_name==='BUILDING_CONTEXT' && existing.stages[1]?.output_snapshot_hash!==null && existing.stages[1]?.token_count_kind==='PROVIDER' && existing.evidence_pack!==null;
      const generalResume=request.consultation_mode==='GENERAL' && authorizedDocuments.length===0 && existing?.status==='PARTIAL' && existing.error_code==='MISSING_PROVENANCE' && existing.stages.length===1 && existing.stages[0]?.stage_name==='BUILDING_CONTEXT' && existing.stages[0]?.output_snapshot_hash!==null && existing.stages[0]?.token_count_kind==='PROVIDER' && existing.evidence_pack!==null;
      const resumingContext=options.resume_context_classification===true && (documentaryResume || generalResume);
      const analysisStage=existing?.stages.at(-1);
      const resumingAnalysis=options.resume_analysis_metadata===true && request.consultation_mode==='GENERAL' && authorizedDocuments.length===0 && existing?.status==='PARTIAL' && existing.error_code==='ANALYSIS_QUESTION_MISMATCH' && existing.packet!==null && existing.evidence_pack!==null && analysisStage?.stage_name==='PRINCIPAL_ANALYSIS' && analysisStage.output_snapshot_hash!==null && analysisStage.token_count_kind==='PROVIDER';
      const resuming=resumingContext || resumingAnalysis;
      if(options.resume_context_classification && !resumingContext || options.resume_analysis_metadata && !resumingAnalysis)throw new BoardError('CONTEXT_CONTINUATION_NOT_ALLOWED');
      if(resuming && existing!.input_hash!==inputHash)throw new BoardError('IDEMPOTENCY_INPUT_CONFLICT');
      if(existing && !resuming){
        if(existing.input_hash!==inputHash)throw new BoardError('IDEMPOTENCY_INPUT_CONFLICT');
        if(!TERMINAL.includes(existing.status)){existing.status='PARTIAL';existing.history.push('PARTIAL');existing.error_code='RUN_INTERRUPTED_NO_AUTOMATIC_REPLAY';await this.store.saveRun(actor,existing);}
        if(existing.status==='HUMAN_REVIEW_PENDING' && existing.analysis){
          const checked=new DeterministicCitationChecker({registry:this.registry,simulation:simulated}).checkAnalysis(existing.analysis,
            authorizedDocuments.filter(d=>d.metadata.jurisdiction===request.jurisdiction && (!d.metadata.date || d.metadata.date<=request.as_of_date)),snapshot.snapshot_id,request.jurisdiction);
          if(checked.verification_gate==='REVIEW_REQUIRED'){
            existing.citation_checks=checked.checks;existing.reference_verification='REVIEW_REQUIRED';
            existing.status='PARTIAL';existing.history.push('PARTIAL');existing.error_code='CACHED_REFERENCE_VERIFICATION_REQUIRED';
            await this.store.putImmutable(actor,request,'stage-artifacts',runId+':cached-check:'+hash(checked),{run_id:runId,stage_version:'2',value:checked});
            await this.store.saveRun(actor,existing);
          }
        }
        return existing;
      }
      const run:BoardRun=resuming?existing!:{run_id:runId,request_id:request.request_id,study_id:request.study_id,matter_id:request.matter_id,input_hash:inputHash,mode,status:'CREATED',validity:'CURRENT',history:['CREATED'],request,stages:[],evidence_pack:null,packet:null,analysis:null,audit:null,citation_checks:[],reference_verification:'NOT_CHECKED',error_code:null,additional_retrievals:0,draft:true,human_approval:'PENDING'};
      await this.store.putImmutable(actor,request,'requests',request.request_id,request);
      await this.store.putImmutable(actor,request,'evidence-snapshots',snapshot.snapshot_id,snapshot);
      await this.store.saveRun(actor,run);
      const transition=async(status:RunStatus)=>{run.status=status;run.history.push(status);await this.store.saveRun(actor,run);};
      const persist=async(kind:string,value:unknown)=>this.store.putImmutable(actor,request,'stage-artifacts',`${runId}:${kind}:${hash(value)}`,{run_id:runId,stage_version:'1',input_snapshot_hash:inputHash,value});
      const call:StageCaller=async<I,O>(stage:string,provider:ModelProvider<I,O>,input:I):Promise<ProviderResult<O>>=>{
        if(options.signal?.aborted)throw new BoardError('CANCELLED');
        const prepared=provider.prepare(frozenCopy(input));
        if(stage==='ADVERSARIAL_AUDIT'){
          const auditInput=input as unknown as import('../providers/contracts.js').AuditInput;
          await persist('audit-coverage',{
            input_snapshot_hash:hash(input),passage_ids:[...new Set([...auditInput.passages,...auditInput.additional_evidence].map(p=>p.passage_id))],
            evidence_coverage:auditInput.evidence.coverage,complete_analysis_included:true,omitted_by_auditor:[],
            input_token_upper_bound:prepared.input_token_upper_bound,max_input_tokens:provider.max_input_tokens,
            status:prepared.input_token_upper_bound>provider.max_input_tokens?'BLOCKED_TOO_LARGE':'FULL_INPUT',
          });
        }
        if(prepared.input_token_upper_bound>provider.max_input_tokens)throw new BoardError('MODEL_INPUT_LIMIT_EXCEEDED');
        const price=this.prices.find(p=>p.model_id===provider.model_id && p.mode===(simulated?'SIMULATION':'STANDARD'));
        for(let attempt=0;attempt<=this.config.max_retries;attempt++){
          if(options.signal?.aborted)throw new BoardError('CANCELLED');
          const reservation=reserveBudget(run.stages,Math.min(request.max_cost_usd,this.config.max_cost_usd),price,prepared.input_token_upper_bound,prepared.max_output_tokens);
          const record:StageRecord={...UNKNOWN_USAGE,run_id:runId,request_id:request.request_id,stage_name:stage,stage_version:'1',model_provider:provider.provider,model_id:provider.model_id,input_snapshot_hash:hash(input),output_snapshot_hash:null,latency_ms:0,estimated_cost_usd:null,reserved_cost_usd:reservation,price_source:price!.source,status:'STARTED',error_code:null,attempt};
          run.stages.push(record);await persist(`${stage}:input`,input);await this.store.saveRun(actor,run);
          const started=performance.now();const controller=new AbortController();
          const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
          let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},this.config.timeout_ms);
          let rejectAbort:(reason:unknown)=>void=()=>{};
          const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
          const onAbort=()=>rejectAbort(new BoardError(timedOut?'STAGE_TIMEOUT':'CANCELLED'));
          controller.signal.addEventListener('abort',onAbort,{once:true});
          try{
            if(options.signal?.aborted || controller.signal.aborted)throw new BoardError('CANCELLED');
            const result=await Promise.race([provider.invoke(prepared,controller.signal),aborted]);
            Object.assign(record,result.usage);record.estimated_cost_usd=usageCost(price!,result.usage);record.output_snapshot_hash=hash(result.output);
            record.latency_ms=performance.now()-started;
            if(controller.signal.aborted)throw new BoardError(timedOut?'STAGE_TIMEOUT':'CANCELLED');
            if((result.usage.input_tokens??0)>prepared.input_token_upper_bound || (result.usage.output_tokens??0)>prepared.max_output_tokens)throw new BoardError('PROVIDER_USAGE_EXCEEDS_RESERVED_BOUND');
            const output=provider.schema.parse(result.output);record.status='PASS';
            await persist(`${stage}:output`,output);await this.store.saveRun(actor,run);
            return {output,usage:result.usage};
          }catch(error){
            if(error instanceof ProviderError && error.usage){Object.assign(record,error.usage);record.estimated_cost_usd=usageCost(price!,error.usage);}
            record.latency_ms=performance.now()-started;record.status='FAIL';record.error_code=options.signal?.aborted?'CANCELLED':timedOut?'STAGE_TIMEOUT':error instanceof BoardError?error.code:'INVALID_STAGE_OUTPUT';
            const retry=error instanceof ProviderError && error.retryable_rejection && attempt<this.config.max_retries && !controller.signal.aborted;
            if(error instanceof ProviderError && error.retryable_rejection){record.reserved_cost_usd=0;record.estimated_cost_usd=0;record.actual_cost_usd_if_available=0;}
            await this.store.saveRun(actor,run);
            if(!retry)throw new BoardError(record.error_code);
            await delay(Math.min(100*2**attempt,1000),undefined,{signal:options.signal});
          }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);}
        }
        throw new BoardError('RETRY_LIMIT');
      };
      if(research)await persist('library-research',research);
      const additional:Passage[]=[];
      const retrieve=async(requests:AdditionalEvidenceRequest[])=>{
        for(const query of requests){
          if(run.additional_retrievals>=Math.min(this.config.max_retrievals,2))throw new BoardError('ADDITIONAL_RETRIEVAL_LIMIT');
          run.additional_retrievals++;await this.store.saveRun(actor,run);
          let found:Passage[];
          if(query.document_id && query.passage_id)found=[this.evidence.passage(actor,request,snapshot,query.document_id,query.passage_id)];
          else found=await this.evidence.search(actor,{...request,legal_question:query.query},snapshot,5);
          // Explicit IDs may recover initially unselected matter documents, never another matter or a future/jurisdictionally excluded source.
          found=found.filter(p=>p.source_metadata.jurisdiction===request.jurisdiction && (!p.source_metadata.date || p.source_metadata.date<=request.as_of_date));
          for(const p of found)if(!additional.some(e=>e.passage_id===p.passage_id))additional.push(p);
          await persist('additional-evidence',found);
        }
      };
      try{
        if(options.signal?.aborted)throw new BoardError('CANCELLED');
        await transition('PREPARING_EVIDENCE');
        const candidates=await this.evidence.search(actor,request,snapshot,this.config.candidate_limit);
        if(!candidates.length && request.consultation_mode!=='GENERAL')throw new BoardError('NO_EVIDENCE_IN_SCOPE');
        if(!resuming){await transition('ROUTING_EVIDENCE');run.evidence_pack=await routeEvidence(request,candidates,this.providers.jev,call,this.config);await persist('evidence-pack',run.evidence_pack);}
        else {const {hash:packHash,...packData}=run.evidence_pack!;if(hash(packData)!==packHash)throw new BoardError('PERSISTENCE_HASH_MISMATCH');}
        if(!run.evidence_pack)throw new BoardError('PERSISTENCE_HASH_MISMATCH');
        if(candidates.length>=this.config.candidate_limit){const {hash:_old,...data}=run.evidence_pack;data.coverage.limitations=[...data.coverage.limitations,'Se alcanzó el límite de candidatos: cobertura potencialmente incompleta.'];run.evidence_pack=frozenCopy({...data,hash:hash(data)});}
        const base={request,evidence:run.evidence_pack,passages:run.evidence_pack.passages};
        await transition('BUILDING_CONTEXT');
        const contextInput={...base,previous_packet:options.previous_packet??null};
        let contextCall=call;
        if(resuming){
          const prior=run.stages.find(stage=>stage.stage_name==='BUILDING_CONTEXT')!;
          if(prior.input_snapshot_hash!==hash(contextInput))throw new BoardError('CACHED_CONTEXT_INPUT_MISMATCH');
          const saved=await this.store.getImmutable<{value:LegalCasePacket}>(actor,request,'stage-artifacts',`${runId}:BUILDING_CONTEXT:output:${prior.output_snapshot_hash}`);
          if(!saved || hash(saved.value)!==prior.output_snapshot_hash)throw new BoardError('PERSISTENCE_HASH_MISMATCH');
          contextCall=(async()=>({output:structuredClone(saved.value),usage:{input_tokens:prior.input_tokens,output_tokens:prior.output_tokens,reasoning_tokens_if_available:prior.reasoning_tokens_if_available,actual_cost_usd_if_available:prior.actual_cost_usd_if_available,token_count_kind:prior.token_count_kind}})) as StageCaller;
        }
        run.packet=await buildContext(contextInput,this.providers.luna,contextCall);await persist('packet',run.packet);
        if(resumingContext){run.error_code=null;run.stages.push({run_id:runId,request_id:request.request_id,stage_name:'CONTEXT_CLASSIFICATION_REPAIR',stage_version:'1',model_provider:'deterministic',model_id:'NONE',input_snapshot_hash:run.stages.find(stage=>stage.stage_name==='BUILDING_CONTEXT')!.output_snapshot_hash!,output_snapshot_hash:hash(run.packet),latency_ms:0,input_tokens:0,output_tokens:0,reasoning_tokens_if_available:null,actual_cost_usd_if_available:0,token_count_kind:'DETERMINISTIC',estimated_cost_usd:0,reserved_cost_usd:0,price_source:null,status:'PASS',error_code:null,attempt:0});await this.store.saveRun(actor,run);}
        await transition('PRINCIPAL_ANALYSIS');
        let principalInput={...base,...(research?{library_research:research}:{}),packet:run.packet,additional_evidence:additional,previous_analysis:null as BoardRun['analysis']};
        let principalCall=call;
        if(resumingAnalysis){
          const prior=analysisStage!;
          if(prior.input_snapshot_hash!==hash(principalInput))throw new BoardError('CACHED_ANALYSIS_INPUT_MISMATCH');
          const saved=await this.store.getImmutable<{value:import('../domain/contracts.js').PrincipalAnalysis}>(actor,request,'stage-artifacts',`${runId}:PRINCIPAL_ANALYSIS:output:${prior.output_snapshot_hash}`);
          if(!saved || hash(saved.value)!==prior.output_snapshot_hash)throw new BoardError('PERSISTENCE_HASH_MISMATCH');
          principalCall=(async()=>({output:structuredClone(saved.value),usage:{input_tokens:prior.input_tokens,output_tokens:prior.output_tokens,reasoning_tokens_if_available:prior.reasoning_tokens_if_available,actual_cost_usd_if_available:prior.actual_cost_usd_if_available,token_count_kind:prior.token_count_kind}})) as StageCaller;
        }
        run.analysis=await analyze(principalInput,this.providers.sol,principalCall);
        if(resumingAnalysis){run.error_code=null;run.stages.push({run_id:runId,request_id:request.request_id,stage_name:'ANALYSIS_METADATA_REPAIR',stage_version:'1',model_provider:'deterministic',model_id:'NONE',input_snapshot_hash:analysisStage!.output_snapshot_hash!,output_snapshot_hash:hash(run.analysis),latency_ms:0,input_tokens:0,output_tokens:0,reasoning_tokens_if_available:null,actual_cost_usd_if_available:0,token_count_kind:'DETERMINISTIC',estimated_cost_usd:0,reserved_cost_usd:0,price_source:null,status:'PASS',error_code:null,attempt:0});await this.store.saveRun(actor,run);}
        if(run.analysis.additional_evidence_requests.length){await retrieve(run.analysis.additional_evidence_requests);principalInput={...principalInput,additional_evidence:additional,previous_analysis:run.analysis};run.analysis=await analyze(principalInput,this.providers.sol,call);if(run.analysis.additional_evidence_requests.length)throw new BoardError('PRINCIPAL_RETRIEVAL_CYCLE_LIMIT');}
        await persist('analysis',run.analysis);
        await transition('ADVERSARIAL_AUDIT');
        run.audit=await audit({...principalInput,analysis:run.analysis,additional_evidence:additional},this.providers.gemini,call);
        if(run.audit.requested_passages.length){await retrieve(run.audit.requested_passages);run.audit=await audit({...principalInput,analysis:run.analysis,additional_evidence:additional},this.providers.gemini,call);if(run.audit.requested_passages.length)throw new BoardError('AUDIT_RETRIEVAL_CYCLE_LIMIT');}
        await persist('audit',run.audit);
        await transition('CHECKING_REFERENCES');
        const checkerStarted=performance.now();const checker=new DeterministicCitationChecker({registry:this.registry,simulation:simulated});const citationScope=this.evidence.documents(actor,request,snapshot).filter(d=>d.metadata.jurisdiction===request.jurisdiction && (!d.metadata.date || d.metadata.date<=request.as_of_date));const checked=checker.checkAnalysis(run.analysis,citationScope,snapshot.snapshot_id,request.jurisdiction);
        run.reference_verification=checked.verification_gate;run.citation_checks=checked.checks;await persist('citation-checks',checked);
        run.stages.push({run_id:runId,request_id:request.request_id,stage_name:'CHECKING_REFERENCES',stage_version:'1',model_provider:'deterministic',model_id:'NONE',input_snapshot_hash:hash({analysis:run.analysis,snapshot:snapshot.hash}),output_snapshot_hash:hash(checked),input_tokens:0,output_tokens:0,reasoning_tokens_if_available:null,latency_ms:performance.now()-checkerStarted,estimated_cost_usd:0,actual_cost_usd_if_available:0,reserved_cost_usd:0,price_source:null,token_count_kind:'DETERMINISTIC',status:'PASS',error_code:null,attempt:0});
        if(checked.verification_gate==='REVIEW_REQUIRED'){const code=checked.extraction.unresolved_markers.length?'CITATION_EXTRACTION_REVIEW_REQUIRED':'REFERENCE_VERIFICATION_REQUIRED';const record=run.stages.at(-1)!;record.status='BLOCKED';record.error_code=code;throw new BoardError(code);}
        await transition('HUMAN_REVIEW_PENDING');
      }catch(error){
        run.error_code=options.signal?.aborted?'CANCELLED':error instanceof BoardError?error.code:'STAGE_CONTRACT_OR_INTERNAL_ERROR';
        const last=run.stages.at(-1);
        if(last?.stage_name===run.status && last.status==='PASS'){last.status='FAIL';last.error_code=run.error_code;}
        await transition(run.error_code==='CANCELLED'?'CANCELLED':run.stages.some(s=>s.status==='PASS')||run.evidence_pack?'PARTIAL':'FAILED');
      }
      return structuredClone(run);
    }finally{await release();}
  }
  async markOutdated(actor:AccessContext,scope:{study_id:string;matter_id:string},newSnapshot:EvidenceSnapshot):Promise<number>{
    this.evidence.documents(actor,scope,newSnapshot);let count=0;
    for(const prior of await this.store.listRuns(actor,scope)){
      const release=await this.store.lock(actor,scope,prior.run_id);
      try{const run=await this.store.loadRun(actor,scope,prior.run_id);if(run && run.validity==='CURRENT' && run.request.matter_snapshot_id!==newSnapshot.snapshot_id){run.validity='OUTDATED';await this.store.saveRun(actor,run);count++;}}finally{await release();}
    }return count;
  }
}
