import { describe,it,expect,vi } from 'vitest';
import { z } from 'zod';
import { assessLiveSmokeReadiness, type LiveSmokePlan, type MetadataProof } from '../../src/providers/preflight.js';
import { DEFAULT_CONFIG, EXPECTED_MODELS } from '../../src/providers/config.js';
import { JevLiveProvider,OpenAIProvider } from '../../src/providers/live.js';
import { trustFixture } from '../fixtures/trust.js';
import { DEMO_ACTOR,demoFixture } from '../fixtures/index.js';
import { validateEvidenceBundle } from '../../src/ingestion/bundle.js';
import { hash } from '../../src/domain/guards.js';
import type { EvidencePack } from '../../src/domain/contracts.js';
import type { Price } from '../../src/telemetry/index.js';

const env:NodeJS.ProcessEnv={JEV_API_KEY:'FAKE_CREDENTIAL_NEVER_EXPORTED',JEV_MODEL:EXPECTED_MODELS.jev,OPENAI_API_KEY:'FAKE_CREDENTIAL_NEVER_EXPORTED',OPENAI_LUNA_MODEL:EXPECTED_MODELS.luna,OPENAI_SOL_MODEL:EXPECTED_MODELS.sol,OPENAI_SOL_REASONING_EFFORT:'medium',GEMINI_API_KEY:'FAKE_CREDENTIAL_NEVER_EXPORTED',GEMINI_AUDITOR_MODEL:EXPECTED_MODELS.gemini};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
describe('phase2 metadata revocation; mocked HTTP only',()=>{
  it.each(['openai','jev'] as const)('%s failed revalidation revokes earlier access before generation',async(kind)=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(response(kind==='openai'?{id:EXPECTED_MODELS.sol}:{models:[{name:EXPECTED_MODELS.jev}]})).mockResolvedValueOnce(response({error:'DO_NOT_LOG'},401));
    const p=kind==='openai'?new OpenAIProvider(EXPECTED_MODELS.sol,'TEST_ONLY',z.object({ok:z.boolean()}),'test','medium',60000,25000,transport):new JevLiveProvider(EXPECTED_MODELS.jev,'TEST_ONLY',60000,4000,transport);
    await p.verifyAvailability(AbortSignal.timeout(1000));
    await expect(p.verifyAvailability(AbortSignal.timeout(1000))).rejects.toThrow('PROVIDER_HTTP_401');
    await expect(p.invoke({payload:{},input_token_upper_bound:1,max_output_tokens:1},AbortSignal.timeout(1000))).rejects.toThrow('MODEL_AVAILABILITY_NOT_VERIFIED');
    expect(transport).toHaveBeenCalledTimes(2);expect(transport.mock.calls.every(c=>c[1]?.method==='GET')).toBe(true);
  });
  it('transport errors cannot expose provider error text or credential values',async()=>{
    const transport=vi.fn<typeof fetch>().mockRejectedValue(new Error('SECRET_TEST_VALUE response body'));
    const p=new OpenAIProvider(EXPECTED_MODELS.sol,'SECRET_TEST_VALUE',z.object({ok:z.boolean()}),'test','medium',60000,25000,transport);
    await expect(p.verifyAvailability(AbortSignal.timeout(1000))).rejects.toThrow('TRANSPORT_OUTCOME_UNKNOWN');
    expect(String(await p.verifyAvailability(AbortSignal.timeout(1000)).catch(e=>e))).not.toContain('SECRET_TEST_VALUE');
  });
});

async function setup(){
  const t=trustFixture(),request={...demoFixture().request,request_id:'phase2-preflight-test',legal_question:'¿Qué requisito documental consta expresamente en la única fuente seleccionada?',max_cost_usd:0.6,selected_document_ids:[t.document.document_id],matter_snapshot_id:t.snapshot.snapshot_id,corpus_snapshot_id:t.snapshot.snapshot_id};
  const bundle={actor:DEMO_ACTOR,request,documents:[t.document],originals:[{document_version_id:t.document.document_version_id,base64:Buffer.from(t.document.text_spans[0]!.text).toString('base64')}],attestations:[t.attestation]};
  const validated=validateEvidenceBundle(bundle,t.registry),passages=await validated.index.search(DEMO_ACTOR,request,validated.snapshot,1);
  const unsigned={pack_id:'frozen-candidate-pack',version:1,request_id:request.request_id,matter_snapshot_id:request.matter_snapshot_id,corpus_snapshot_id:request.corpus_snapshot_id,passages,
    routes:[{document_id:t.document.document_id,passage_id:passages[0]!.passage_id,classification:'UNCERTAIN' as const,relevance_score:0,selection_reason:'Unclassified frozen source; routing NOT_RUN.'}],
    coverage:{candidate_count:1,selected_count:1,rejected_count:0,uncertain_passage_ids:[passages[0]!.passage_id],contradictory_passage_ids:[],not_selected_passage_ids:[],limitations:['Disposable TEST ONLY verifier; no authentic government document.']}};
  const evidence_pack:EvidencePack={...unsigned,hash:hash(unsigned)};
  const plan:LiveSmokePlan={schema_version:'live-smoke-plan-v1',scenario_id:'phase2-one-question-one-source',question:request.legal_question,confidential_data:false,inference_status:'NOT_RUN',request_id:request.request_id,frozen_bundle_hash:hash(bundle),frozen_evidence_pack_hash:hash(evidence_pack),
    config:{...DEFAULT_CONFIG,max_cost_usd:0.6,max_retries:0,max_retrievals:0,candidate_limit:1,router_batch_size:1},total_budget_usd:0.6,price_valid_until:'2026-10-20'};
  const prices:Price[]=Object.values(EXPECTED_MODELS).map(model_id=>({model_id,input_per_million_usd:1,output_per_million_usd:1,source:'TEST_ONLY_RATE_NOT_A_PROVIDER_PRICE',as_of_date:'2026-10-13',mode:'STANDARD'}));
  const metadata:MetadataProof[]=(Object.keys(EXPECTED_MODELS) as (keyof typeof EXPECTED_MODELS)[]).map(stage=>({stage,model_id:EXPECTED_MODELS[stage],status:'VERIFIED_REAL',checked_at:'2026-10-13T00:00:00Z',context_window:1050000,max_output_tokens:128000,supports_structured_output:true,supports_medium_reasoning:true}));
  return {plan,prices,metadata,bundle,evidence_pack,registry:t.registry,env,now:new Date('2026-10-13T00:00:00Z')};
}
describe('phase2 pure preflight; disposable trust and metadata fixtures do not prove real access',()=>{
  it('assesses one frozen signed candidate, all four stages and exact budget without network or spend',async()=>{
    const r=await assessLiveSmokeReadiness(await setup());expect(r.status).toBe('READY_FOR_AUTHORIZATION');expect(r.blockers).toEqual([]);expect(r.stages).toHaveLength(4);expect(r.execution_authorized).toBe(false);expect(r.network_used).toBe(false);expect(r.inference_status).toBe('NOT_RUN');expect(r.worst_case_reserved_usd).toBeCloseTo(.305);expect(r.paid_inference_usd).toBe(0);
  });
  it('returns all independent configuration blockers without copying secrets',async()=>{
    const input=await setup();input.env={...env,JEV_API_KEY:'',OPENAI_API_KEY:'',GEMINI_AUDITOR_MODEL:''};
    const r=await assessLiveSmokeReadiness(input);expect(r.status).toBe('BLOCKED');expect(r.blockers).toContain('CONFIGURATION_MISSING_JEV');expect(r.blockers).toContain('EXACT_MODEL_CONFIGURATION_REQUIRED_GEMINI');expect(JSON.stringify(r)).not.toContain('FAKE_CREDENTIAL_NEVER_EXPORTED');
  });
  it.each(['missing_metadata','stale_metadata','model_swap','medium_missing','small_window','missing_price','simulation_price','insufficient_budget','expired_prices','missing_corpus','changed_bundle','changed_pack','pack_wrong_scope'] as const)('blocks %s before any inference',async(reason)=>{
    const s=await setup();
    if(reason==='missing_metadata')s.metadata=[];
    if(reason==='stale_metadata')s.metadata[0]!.checked_at='2026-10-10T00:00:00Z';
    if(reason==='model_swap')s.metadata[2]!.model_id='gpt-other';
    if(reason==='medium_missing')s.metadata[2]!.supports_medium_reasoning=false;
    if(reason==='small_window')s.metadata[3]!.context_window=110000;
    if(reason==='missing_price')s.prices=[];
    if(reason==='simulation_price')s.prices[0]!.mode='SIMULATION';
    if(reason==='insufficient_budget'){s.plan.total_budget_usd=.1;s.plan.config.max_cost_usd=.1;}
    if(reason==='expired_prices')s.plan.price_valid_until='2026-10-12';
    if(reason==='missing_corpus')s.plan.frozen_bundle_hash=null;
    if(reason==='changed_bundle'){s.bundle=structuredClone(s.bundle);s.bundle.documents[0]!.metadata.number='tampered';}
    if(reason==='changed_pack')s.evidence_pack.passages[0]!.text='tampered';
    if(reason==='pack_wrong_scope')s.evidence_pack.matter_snapshot_id='foreign';
    const r=await assessLiveSmokeReadiness(s);expect(r.status).toBe('BLOCKED');expect(r.blockers.length).toBeGreaterThan(0);expect(r.execution_authorized).toBe(false);
  });
  it('rejects retry or retrieval expansion that would invalidate the four-call ceiling',async()=>{
    const s=await setup();s.plan.config.max_retries=1;await expect(assessLiveSmokeReadiness(s)).rejects.toThrow();
  });
});
