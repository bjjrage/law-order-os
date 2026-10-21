import { z } from 'zod';
import { PassageSchema, type EvidencePack } from '../domain/contracts.js';
import { BoardError, hash } from '../domain/guards.js';
import { validateEvidenceBundle } from '../ingestion/bundle.js';
import { OfficialEvidenceRegistry } from '../ingestion/provenance.js';
import { PriceSchema, tokenCost, type Price } from '../telemetry/index.js';
import { BoardConfigSchema, EXPECTED_MODELS, requiredEnvironment } from './config.js';

const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const LiveSmokePlanSchema=z.strictObject({
  schema_version:z.literal('live-smoke-plan-v1'), scenario_id:z.literal('phase2-one-question-one-source'),
  question:z.string().min(15), confidential_data:z.literal(false), inference_status:z.literal('NOT_RUN'),
  request_id:z.string().min(1), frozen_bundle_hash:digest.nullable(), frozen_evidence_pack_hash:digest.nullable(),
  config:BoardConfigSchema, total_budget_usd:z.number().positive().finite().max(1),
  price_valid_until:z.iso.date(),
}).superRefine((p,ctx)=>{
  if(p.config.max_retries!==0 || p.config.max_retrievals!==0 || p.config.candidate_limit!==1 || p.config.router_batch_size!==1)
    ctx.addIssue({code:'custom',message:'Smoke requires exactly one candidate and no retries or additional retrievals.'});
  if(p.config.max_cost_usd!==p.total_budget_usd)ctx.addIssue({code:'custom',message:'Global engine and plan budget must match.'});
});
export type LiveSmokePlan=z.infer<typeof LiveSmokePlanSchema>;
export interface MetadataProof {
  stage:keyof typeof EXPECTED_MODELS; model_id:string;
  status:'VERIFIED_REAL'|'BLOCKED'|'NOT_RUN'; checked_at:string;
  // Account model access is separate from documented public model capabilities.
  context_window:number; max_output_tokens:number; supports_structured_output:boolean;
  supports_medium_reasoning?:boolean;
}
const MetadataProofSchema=z.strictObject({stage:z.enum(['jev','luna','sol','gemini']),model_id:z.string(),status:z.enum(['VERIFIED_REAL','BLOCKED','NOT_RUN']),checked_at:z.iso.datetime(),context_window:z.number().int().positive(),max_output_tokens:z.number().int().positive(),supports_structured_output:z.boolean(),supports_medium_reasoning:z.boolean().optional()});
export interface SmokePreflightInput {
  plan:unknown; env:NodeJS.ProcessEnv; prices:unknown; metadata:MetadataProof[];
  bundle?:unknown; evidence_pack?:EvidencePack; registry?:OfficialEvidenceRegistry; now?:Date;
}
/** Pure readiness assessment. No network, persistence, key output or authorization to spend. */
export async function assessLiveSmokeReadiness(input:SmokePreflightInput){
  const plan=LiveSmokePlanSchema.parse(input.plan),now=input.now??new Date();
  const blockers:string[]=[];
  const configured=requiredEnvironment(input.env);
  for(const row of configured)if(row.status==='BLOCKED')blockers.push(`CONFIGURATION_MISSING_${row.stage.toUpperCase()}`);
  const variables={jev:input.env.JEV_MODEL,luna:input.env.OPENAI_LUNA_MODEL,sol:input.env.OPENAI_SOL_MODEL,gemini:input.env.GEMINI_AUDITOR_MODEL};
  for(const stage of Object.keys(EXPECTED_MODELS) as (keyof typeof EXPECTED_MODELS)[])
    if(variables[stage]!==EXPECTED_MODELS[stage])blockers.push(`EXACT_MODEL_CONFIGURATION_REQUIRED_${stage.toUpperCase()}`);
  if(input.env.OPENAI_SOL_REASONING_EFFORT!=='medium')blockers.push('SOL_REQUIRES_EXPLICIT_MEDIUM');
  if(now.toISOString().slice(0,10)>plan.price_valid_until)blockers.push('PRICE_REVALIDATION_REQUIRED');

  const parsedPrices=z.array(PriceSchema).safeParse(input.prices);
  const prices:Price[]=parsedPrices.success?parsedPrices.data:[];
  if(!parsedPrices.success)blockers.push('PRICE_CONTRACT_INVALID');
  const limits={jev:[plan.config.router_batch_token_limit,4000],luna:[60000,16000],sol:[plan.config.sol_max_input_tokens,plan.config.sol_max_output_tokens],gemini:[plan.config.auditor_max_input_tokens,plan.config.auditor_max_output_tokens]} as const;
  const stages=(Object.keys(EXPECTED_MODELS) as (keyof typeof EXPECTED_MODELS)[]).map(stage=>{
    const [inputLimit,outputLimit]=limits[stage];
    const matches=prices.filter(p=>p.model_id===EXPECTED_MODELS[stage]);
    const price=matches.length===1 && matches[0]?.mode==='STANDARD'?matches[0]:undefined;
    if(!price || price.as_of_date>now.toISOString().slice(0,10))blockers.push(`CURRENT_STANDARD_PRICE_REQUIRED_${stage.toUpperCase()}`);
    const proof=input.metadata.filter(m=>m.stage===stage);
    const validProof=proof.length===1?MetadataProofSchema.safeParse(proof[0]):null;
    if(!validProof?.success || validProof.data.model_id!==EXPECTED_MODELS[stage] || validProof.data.status!=='VERIFIED_REAL')
      blockers.push(`ACCOUNT_MODEL_METADATA_REQUIRED_${stage.toUpperCase()}`);
    else {
      const m=validProof.data,age=now.getTime()-Date.parse(m.checked_at);
      if(age<0 || age>24*3600000)blockers.push(`ACCOUNT_METADATA_STALE_${stage.toUpperCase()}`);
      if(m.context_window<inputLimit+(stage==='jev'?0:outputLimit) || m.max_output_tokens<outputLimit)blockers.push(`MODEL_WINDOW_TOO_SMALL_${stage.toUpperCase()}`);
      if(!m.supports_structured_output)blockers.push(`STRUCTURED_OUTPUT_UNCONFIRMED_${stage.toUpperCase()}`);
      if(stage==='sol' && !m.supports_medium_reasoning)blockers.push('MEDIUM_REASONING_UNCONFIRMED_SOL');
    }
    return {stage,model_id:EXPECTED_MODELS[stage],max_calls:1,input_token_upper_bound:inputLimit,max_output_tokens:outputLimit,
      reserved_cost_ceiling_usd:price?tokenCost(price,inputLimit,outputLimit):null,price_source:price?.source??null};
  });
  const worstCase=stages.every(s=>s.reserved_cost_ceiling_usd!==null)?stages.reduce((sum,s)=>sum+s.reserved_cost_ceiling_usd!,0):null;
  if(worstCase===null || worstCase>plan.total_budget_usd+1e-10)blockers.push('VERIFIABLE_BUDGET_REQUIRED');

  if(!input.bundle || !input.evidence_pack || !input.registry || !plan.frozen_bundle_hash || !plan.frozen_evidence_pack_hash)
    blockers.push('FROZEN_AUTHORIZED_EVIDENCE_REQUIRED');
  else try {
    if(hash(input.bundle)!==plan.frozen_bundle_hash)throw new BoardError('SMOKE_BUNDLE_HASH_MISMATCH');
    const {bundle,index,snapshot}=validateEvidenceBundle(input.bundle,input.registry);
    if(bundle.request.request_id!==plan.request_id || bundle.request.legal_question!==plan.question || bundle.request.max_cost_usd!==plan.total_budget_usd)
      throw new BoardError('SMOKE_REQUEST_PLAN_MISMATCH');
    const official=bundle.documents.filter(d=>d.source_type==='OFFICIAL_CASELAW');
    if(official.length!==1 || official.some(d=>!input.registry!.attestationFor(d) || d.extraction_quality!=='GOOD'))
      throw new BoardError('ONE_TRUSTED_EXTRACTED_CASE_REQUIRED');
    const pack=input.evidence_pack,{hash:packHash,...unsignedPack}=pack;
    if(packHash!==hash(unsignedPack) || hash(pack)!==plan.frozen_evidence_pack_hash || pack.request_id!==plan.request_id || pack.matter_snapshot_id!==snapshot.snapshot_id || pack.corpus_snapshot_id!==snapshot.snapshot_id)
      throw new BoardError('SMOKE_PACK_HASH_OR_SCOPE_MISMATCH');
    const candidates=await index.search(bundle.actor,bundle.request,snapshot,1);
    z.array(PassageSchema).parse(pack.passages);
    if(candidates.length!==1 || hash(pack.passages)!==hash(candidates) || pack.coverage.candidate_count!==1 || pack.coverage.selected_count!==1 || pack.coverage.rejected_count!==0)
      throw new BoardError('SMOKE_PACK_COVERAGE_MISMATCH');
    if(pack.routes.length!==1 || pack.routes[0]?.document_id!==candidates[0]!.document_id || pack.routes[0]?.passage_id!==candidates[0]!.passage_id || pack.routes[0]?.classification!=='UNCERTAIN')
      throw new BoardError('FROZEN_CANDIDATE_PACK_MUST_RETAIN_UNCERTAIN_SOURCE');
  }catch(e){blockers.push(e instanceof BoardError?e.code:'EVIDENCE_CONTRACT_INVALID');}
  return {schema_version:'live-smoke-preflight-v1',scenario_id:plan.scenario_id,status:blockers.length?'BLOCKED' as const:'READY_FOR_AUTHORIZATION' as const,
    blockers:[...new Set(blockers)],inference_status:'NOT_RUN' as const,paid_inference_usd:0,network_used:false,
    stages,total_budget_usd:plan.total_budget_usd,worst_case_reserved_usd:worstCase,timeout_ms:plan.config.timeout_ms,max_retries:0,
    frozen_bundle_hash:plan.frozen_bundle_hash,frozen_evidence_pack_hash:plan.frozen_evidence_pack_hash,
    execution_authorized:false,limitations:['Metadata availability does not verify inference behavior or legal quality.','Frozen pack is the complete single-candidate input; Jev generates a separately traced routed pack.','Prices are public standard text estimates; account billing, taxes and current applicability need operator confirmation.']};
}
