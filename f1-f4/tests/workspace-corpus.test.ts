import { it, expect } from 'vitest';
// @ts-expect-error Host ESM.
import { compactSourceEvidence, expandSourceEvidence, compactSourceMessages } from '../../scripts/workspace-source-packet.mjs';
// @ts-expect-error Host ESM.
import { workspaceCallFits, deepseekEnvelopeTokens } from '../../scripts/workspace-context.mjs';
// @ts-expect-error Host ESM.
import { benchmarkSnapshot } from '../../scripts/benchmark-isolation.mjs';
// @ts-expect-error Host ESM.
import { integrateContributions, integrationPacket } from '../../scripts/workspace-integration.mjs';
import { DeepSeekProvider } from '../../dist/providers/live.js';
import { WorkspaceAnalysisSchema } from '../../packages/workspace/src/tasks.js';
const noNetwork: typeof fetch = async () => { throw Error('OFFLINE_NETWORK_FORBIDDEN'); };
const answer = { summary:'Synthetic', findings:[], references:[], limitations:[], replacement_text:null };
const provider = () => new DeepSeekProvider('deepseek-flash', 'synthetic', WorkspaceAnalysisSchema, '', 'high', 1048576, 16000, noNetwork);

it('keeps complete legal texts, exceptions and contradictory artifacts while interning only duplicate text', async () => {
  const { job } = await benchmarkSnapshot({ caseId:'N06', turn:2 });
  const sources = job.context.sources;
  const raw = { context:job.context, sources, prior_decisions:{ decision:'DISMISSED', reason:'No aceptar la versión del cliente', sources },
    candidate:{ ...answer, sources }, audit_feedback:{ issues:[{ quote:'No consta aceptación', remedy:'Mantener incertidumbre' }], sources } };
  const frozen = JSON.stringify(raw), packet = compactSourceEvidence(raw);
  expect(expandSourceEvidence(packet)).toEqual(raw);
  expect(JSON.stringify(raw)).toBe(frozen);
  expect(Buffer.byteLength(JSON.stringify(packet))).toBeLessThan(Buffer.byteLength(frozen) / 3);
  expect(packet.source_catalog.find((s:any) => s.source_id === 'N06-AS318-2010').excerpts[0].text).toContain('RESUELVE');
  expect(packet.source_catalog.find((s:any) => s.source_id === 'CPC-7663').excerpts[0].text).toContain('Artículo');
  const corrupt = structuredClone(packet); corrupt.source_catalog[0].excerpts[0].text += ' altered';
  expect(() => expandSourceEvidence(corrupt)).toThrow('WORKSPACE_SOURCE_PACKET_CHANGED');
  expect(() => compactSourceEvidence({ sources:[sources[0],{...sources[0],excerpts:[{...sources[0].excerpts[0],text:'other version'}]}] })).toThrow('WORKSPACE_SOURCE_VERSION_CONFLICT');
});
it('shares one catalog across director messages without dropping tool IDs or opaque reasoning state', async () => {
  const { job } = await benchmarkSnapshot({ caseId:'N04', turn:2 });
  const values = [{ untrusted_workspace:{ document:job.context.document } }, { untrusted_tool_result:{ ...answer, sources:job.context.sources } }];
  const messages = [{ role:'user',content:JSON.stringify(values[0]) }, { type:'reasoning',encrypted_content:'opaque' },
    { type:'function_call_output',call_id:'call-1',output:JSON.stringify(values[1]) },
    { type:'function_call_output',call_id:'call-2',output:JSON.stringify(values[1]) }];
  const packet = compactSourceMessages(messages);
  const first = JSON.parse(packet[0].content);
  expect(expandSourceEvidence(first)).toEqual(values[0]);
  for (const index of [2,3]) {
    const value = JSON.parse(packet[index].output);
    expect(expandSourceEvidence({ ...value, source_catalog:first.source_catalog, source_encoding:first.source_encoding })).toEqual(values[1]);
    expect(packet[index].call_id).toBe(messages[index]!.call_id);
  }
  expect(packet[1]).toEqual(messages[1]);
});
it('admits all 24 full corpus snapshots into integration offline, with temporal release and no transport', async () => {
  const p = provider(); let integrations = 0;
  for (const caseId of ['N01','N02','N03','N04','N05','N06']) for (const turn of [1,2,3,4]) {
    const { job } = await benchmarkSnapshot({ caseId,turn });
    const payload = { question:job.request.instruction,context:job.context,sources:job.context.sources };
    const contributions = [{ agent_id:'elena',...answer,sources:job.context.sources },{ agent_id:'valeria',...answer,sources:job.context.sources }];
    await integrateContributions(payload,contributions,{
      fits:async (raw:any) => workspaceCallFits(p,p.prepare(compactSourceEvidence(raw))),
      invoke:async (raw:any) => {
        const packet=compactSourceEvidence(raw);
        expect(expandSourceEvidence(packet)).toEqual(raw);
        expect(packet.source_catalog.map((s:any)=>s.source_id).includes('N06-AS318-2010')).toBe(caseId==='N06'&&turn>=2);
        integrations++;return answer;
      },progress:async()=>{},
    });
  }
  expect(integrations).toBe(24);
},120000);
it('uses the official local V4 tokenizer for a large envelope, without presenting bytes or local tokens as billed usage', async()=>{
  const {job}=await benchmarkSnapshot({caseId:'N06',turn:2});
  const call=provider().prepare(compactSourceEvidence(integrationPacket({question:job.request.instruction,context:job.context,sources:job.context.sources},[{agent_id:'elena',...answer}])));
  const n=await deepseekEnvelopeTokens(call);
  expect(n).toBeGreaterThan(100000);expect(n).toBeLessThan(500000);expect(n).toBeLessThan(call.input_token_upper_bound);
},30000);
it('awaits context decisions and refuses a genuinely oversized indivisible packet without invoking',async()=>{
  let invoked=0;
  await expect(integrateContributions({context:{text:'complete'},sources:[]},[{agent_id:'elena',...answer}],{
    fits:async()=>false,invoke:async()=>{invoked++;return answer;},progress:async()=>{},
  })).rejects.toThrow('WORKSPACE_INTEGRATION_SIZE_LIMIT');expect(invoked).toBe(0);
  const p={model_id:'gpt-6.1-sol',countInputTokens:async()=>922001};
  expect(await workspaceCallFits(p,{input_token_upper_bound:2000000,max_output_tokens:16000})).toBe(false);
});
