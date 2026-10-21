import { describe,it,expect,vi } from 'vitest';
import { configFromEnv,DEFAULT_CONFIG,EXPECTED_MODELS } from '../../src/providers/config.js';
import { createLiveProviders,GeminiLiveProvider } from '../../src/providers/live.js';
import { harness } from '../fixtures/index.js';
import { hash } from '../../src/domain/guards.js';

const response=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
const env={JEV_MODEL:EXPECTED_MODELS.jev,OPENAI_LUNA_MODEL:EXPECTED_MODELS.luna,OPENAI_SOL_MODEL:EXPECTED_MODELS.sol,
  OPENAI_SOL_REASONING_EFFORT:'medium',GEMINI_AUDITOR_MODEL:EXPECTED_MODELS.gemini,GEMINI_API_KEY:'fake-test-key'};
describe('J-004 explicit audit budgets and complete coverage',()=>{
  it.each([150000,300000])('uses configured %i input budget without substituting models',(limit)=>{
    const config=configFromEnv({BOARD_AUDITOR_MAX_INPUT_TOKENS:String(limit),BOARD_AUDITOR_MAX_OUTPUT_TOKENS:'18000'});
    const p=createLiveProviders(env,config,vi.fn()).gemini;expect(p.max_input_tokens).toBe(limit);expect(p.max_output_tokens).toBe(18000);expect(p.model_id).toBe(EXPECTED_MODELS.gemini);
  });
  it('keeps a conservative default and rejects invalid local limits',()=>{
    expect(DEFAULT_CONFIG.auditor_max_input_tokens).toBe(100000);
    for(const value of ['0','NaN','1000001'])expect(()=>configFromEnv({BOARD_AUDITOR_MAX_INPUT_TOKENS:value})).toThrow();
  });
  it.each([
    [{inputTokenLimit:100000,outputTokenLimit:64000},'MODEL_CONTEXT_LIMIT_TOO_SMALL'],
    [{inputTokenLimit:1000000,outputTokenLimit:100},'MODEL_OUTPUT_LIMIT_TOO_SMALL'],
    [{},'MODEL_TOKEN_LIMITS_UNAVAILABLE'],
  ])('requires affirmative account model limits %j',async(limits,code)=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(response({name:'models/'+EXPECTED_MODELS.gemini,supportedGenerationMethods:['generateContent'],...limits}));
    const p=new GeminiLiveProvider(EXPECTED_MODELS.gemini,'fake-test-key',300000,16000,transport);
    await expect(p.verifyAvailability(AbortSignal.timeout(1000))).rejects.toThrow(code);
    expect(transport).toHaveBeenCalledTimes(1);expect(transport.mock.calls[0]![1]!.method).toBe('GET');
  });
  it('accepts a verified larger model window using mock metadata only',async()=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(response({name:'models/'+EXPECTED_MODELS.gemini,supportedGenerationMethods:['generateContent'],inputTokenLimit:1000000,outputTokenLimit:64000}));
    const p=createLiveProviders(env,{...DEFAULT_CONFIG,auditor_max_input_tokens:300000},transport).gemini;
    await expect(p.verifyAvailability(AbortSignal.timeout(1000))).resolves.toBeUndefined();expect(transport).toHaveBeenCalledTimes(1);
  });
  it('a failed metadata recheck revokes prior permission to generate',async()=>{
    const base={name:'models/'+EXPECTED_MODELS.gemini,supportedGenerationMethods:['generateContent']};
    const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(response({...base,inputTokenLimit:1000000,outputTokenLimit:64000})).mockResolvedValueOnce(response(base));
    const p=new GeminiLiveProvider(EXPECTED_MODELS.gemini,'fake-test-key',300000,16000,transport);
    await p.verifyAvailability(AbortSignal.timeout(1000));
    await expect(p.verifyAvailability(AbortSignal.timeout(1000))).rejects.toThrow('MODEL_TOKEN_LIMITS_UNAVAILABLE');
    await expect(p.invoke({payload:{},input_token_upper_bound:1,max_output_tokens:1},AbortSignal.timeout(1000))).rejects.toThrow('MODEL_AVAILABILITY_NOT_VERIFIED');
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('oversized audit inputs block invocation and persist a complete manifest',async()=>{
    const h=harness();Object.defineProperty(h.providers.gemini,'max_input_tokens',{value:100});
    const invoke=vi.spyOn(h.providers.gemini,'invoke'),put=vi.spyOn(h.store,'putImmutable');
    const run=await h.board.execute(h.actor,h.request,h.snapshot);
    expect(run.error_code).toBe('MODEL_INPUT_LIMIT_EXCEEDED');expect(run.status).toBe('PARTIAL');expect(invoke).not.toHaveBeenCalled();
    const artifact=put.mock.calls.map(c=>c[4] as {value?:{status?:string;omitted_by_auditor?:string[];passage_ids?:string[];complete_analysis_included?:boolean}}).find(v=>v?.value?.status==='BLOCKED_TOO_LARGE');
    expect(artifact?.value).toMatchObject({status:'BLOCKED_TOO_LARGE',complete_analysis_included:true,omitted_by_auditor:[]});
    expect(artifact?.value?.passage_ids).toEqual(run.evidence_pack!.passages.map(p=>p.passage_id));
  });
  it('a large audit retains the entire analysis instead of silently truncating it',async()=>{
    const h=harness();Object.defineProperty(h.providers.gemini,'max_input_tokens',{value:300000});
    const original=h.providers.sol.invoke.bind(h.providers.sol),text='x'.repeat(150000);
    vi.spyOn(h.providers.sol,'invoke').mockImplementation(async(c,s)=>{const r=await original(c,s);r.output.legal_analysis=text;return r;});
    const invoke=vi.spyOn(h.providers.gemini,'invoke');const run=await h.board.execute(h.actor,h.request,h.snapshot);
    expect(run.status).toBe('HUMAN_REVIEW_PENDING');
    const payload=invoke.mock.calls[0]![0].payload as {input:{analysis:{legal_analysis:string}}};
    expect(hash(payload.input.analysis.legal_analysis)).toBe(hash(text));expect(payload.input.analysis.legal_analysis.length).toBe(150000);
  });
});
