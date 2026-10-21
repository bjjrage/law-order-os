import { it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
// @ts-expect-error Native module.
import { WorkspaceSpend } from "../../scripts/workspace-spend-store.mjs";
// @ts-expect-error Native module.
import { performWorkspaceCall } from "../../scripts/workspace-spend.mjs";
// @ts-expect-error Host pricing.
import { workspacePrice, workspaceCost } from '../../scripts/workspace-pricing.mjs';
const price = { as_of_date: new Date().toISOString(), input_per_million_usd: 1, output_per_million_usd: 1 };
const call = { input_token_upper_bound: 200000, max_output_tokens: 200000 };
const solPrice={...price,input_per_million_usd:2,output_per_million_usd:10,long_context:{above_input_tokens:272000,input_per_million_usd:4,output_per_million_usd:15}};
it('changes the whole request tariff at 272001 input tokens, including output, and rejects missing/malformed tiers',()=>{
  expect(workspaceCost(solPrice,272000,1000)).toBeCloseTo(.554,9);
  expect(workspaceCost(solPrice,272001,1000)).toBeCloseTo(1.103004,9);
  expect(()=>workspacePrice(price,'gpt-6.1-sol')).toThrow('LONG_CONTEXT_PRICE_REQUIRED');
  expect(()=>workspacePrice({...solPrice,long_context:{...solPrice.long_context,above_input_tokens:272001}},'gpt-6.1-sol')).toThrow('LONG_CONTEXT_PRICE_INVALID');
  expect(()=>workspacePrice({...solPrice,long_context:{...solPrice.long_context,output_per_million_usd:NaN}},'gpt-6.1-sol')).toThrow('LONG_CONTEXT_PRICE_INVALID');
});
it.each([272000,272001])('reserves after exact count on the proper tier at %i without overspending',async(input)=>fixture(async s=>{
  s.admit('tier','tier');let sent=0,counts=0;const account={remaining:.6};
  const provider={model_id:'gpt-6.1-sol',countInputTokens:async()=>{counts++;return input;},verifyAvailability:async()=>{},invoke:async()=>{sent++;return{output:{},usage:{input_tokens:input,output_tokens:1000}};}};
  const run=performWorkspaceCall({provider,price:solPrice,call:{input_token_upper_bound:900000,max_output_tokens:1000},budget:.6,accounts:[account],spend:s,interaction:'tier'});
  if(input===272000){await run;expect(sent).toBe(1);expect(s.snapshot().retained_usd).toBeCloseTo(.554,8);}
  else{await expect(run).rejects.toThrow('BUDGET_EXHAUSTED');expect(sent).toBe(0);expect(s.snapshot().retained_usd).toBe(0);}
  expect(counts).toBe(1);
}));
it('settles at the actual input tier and refunds only known excess from the long reservation',async()=>fixture(async s=>{
  s.admit('refund-tier','refund-tier');const account={remaining:.6};
  const priceLuna={...price,input_per_million_usd:.1,output_per_million_usd:.5,long_context:{above_input_tokens:272000,input_per_million_usd:.2,output_per_million_usd:.75}};
  const provider={model_id:'gpt-6-luna',verifyAvailability:async()=>{},invoke:async()=>({output:{},usage:{input_tokens:272000,output_tokens:1000}})};
  await performWorkspaceCall({provider,price:priceLuna,call:{input_token_upper_bound:300000,max_output_tokens:1000},budget:.6,accounts:[account],spend:s,interaction:'refund-tier'});
  expect(s.snapshot().calls[0].reserved/1e9).toBeCloseTo(.06075,8);expect(s.snapshot().retained_usd).toBeCloseTo(.0277,8);expect(account.remaining).toBeCloseTo(.5723,8);
}));
it('shares the long-tier liability atomically across concurrent interactions',async()=>fixture(async s=>{
  for(const id of ['long-a','long-b'])s.admit(id,id);
  const priceLuna={...price,input_per_million_usd:.1,output_per_million_usd:.5,long_context:{above_input_tokens:272000,input_per_million_usd:.2,output_per_million_usd:.75}};
  let sent=0;const provider={model_id:'gpt-6-luna',countInputTokens:async()=>272001,verifyAvailability:async()=>{},invoke:async()=>{sent++;return{output:{},usage:{input_tokens:272001,output_tokens:1000}};}};
  const results=await Promise.allSettled(['long-a','long-b'].map(interaction=>performWorkspaceCall({provider,price:priceLuna,call:{input_token_upper_bound:900000,max_output_tokens:1000},budget:.1,accounts:[{remaining:.1}],spend:s,interaction})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(sent).toBe(1);expect(s.snapshot().retained_usd).toBeCloseTo(.0551502,8);
},.1));
it('checks capacity before invoking and retains unknown long-context liability after restart',async()=>fixture(async(s,path)=>{
  s.admit('large','large');const priceLuna={...price,input_per_million_usd:.1,output_per_million_usd:.5,long_context:{above_input_tokens:272000,input_per_million_usd:.2,output_per_million_usd:.75}};
  let sent=0;const provider={model_id:'gpt-6-luna',countInputTokens:async()=>922001,verifyAvailability:async()=>{},invoke:async()=>{sent++;throw Error('TRANSPORT_OUTCOME_UNKNOWN');}};
  const args={provider,price:priceLuna,call:{input_token_upper_bound:2000000,max_output_tokens:1000},budget:.6,accounts:[{remaining:.6}],spend:s,interaction:'large'};
  await expect(performWorkspaceCall(args)).rejects.toThrow('WORKSPACE_MODEL_CONTEXT_EXCEEDED');expect(sent).toBe(0);
  await expect(performWorkspaceCall({...args,call:{input_token_upper_bound:300000,max_output_tokens:1000}})).rejects.toThrow('TRANSPORT_OUTCOME_UNKNOWN');
  const reopened=new WorkspaceSpend(path);try{expect(reopened.snapshot().retained_usd).toBeCloseTo(.06075,8);}finally{reopened.close();}
}));
function fixtureProvider() {
  let sends = 0;
  return { get sends() { return sends; }, verifyAvailability: async () => {}, countInputTokens: async () => 200000,
    invoke: async () => { sends++; return { output: {}, usage: { input_tokens: 200000, output_tokens: 200000 } }; } };
}
async function fixture(fn: (s: any, path: string) => Promise<void>, cap=0.6) {
  const dir = await mkdtemp(resolve(".local-dev/spend-offline-")), path = resolve(dir, "ledger.sqlite");
  expect(dirname(dir)).toBe(resolve(".local-dev"));
  const s = new WorkspaceSpend(path); s.initialize(cap);
  try { await fn(s, path); } finally { s.close(); await rm(dir, { recursive: true, force: true }); }
}
it("rechecks memory after concurrent exact counts before any second send", async () => {
  const provider = fixtureProvider(), ledger = { remaining: 0.6 };
  const args = { provider, call: { ...call, input_token_upper_bound: 900000 }, price, budget: 0.6, accounts: [ledger] };
  const results = await Promise.allSettled([performWorkspaceCall(args), performWorkspaceCall(args)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(provider.sends).toBe(1); expect(ledger.remaining).toBeCloseTo(0.2);
});
it("enforces the interaction ceiling inside a larger global account and refuses closed turns", async()=>fixture(async s=>{
  s.admit("a","a");s.reserve("a",0.4);
  expect(()=>s.reserve("a",0.3)).toThrow("BUDGET_EXHAUSTED");
  s.admit("b","b");s.reserve("b",0.4);expect(s.snapshot().retained_usd).toBe(0.8);
  s.finish("b");expect(()=>s.reserve("b",0.01)).toThrow("WORKSPACE_BUDGET_INTERACTION_REQUIRED");
},1.2));
it("rejects invalid amounts and missing policy before any send",async()=>{
  let sends=0;const provider={...fixtureProvider(),invoke:async()=>{sends++;return {};}};
  await expect(performWorkspaceCall({provider,call,price,budget:0.6,accounts:[{remaining:NaN}]})).rejects.toThrow("WORKSPACE_BUDGET_INVALID_AMOUNT");
  await expect(performWorkspaceCall({provider,call,price:{...price,input_per_million_usd:-1},budget:0.6,accounts:[{remaining:0.6}]})).rejects.toThrow("CURRENT_PRICE_REQUIRED");
  expect(sends).toBe(0);
});
it("shares a global cap across interactions and does not send over it", async () => fixture(async s => {
  const provider = fixtureProvider();
  for (const id of ["a", "b"]) s.admit(id, id);
  const run = (id: string) => performWorkspaceCall({ provider, call, price, budget: 0.6, accounts: [{ remaining: 0.6 }], spend: s, interaction: id });
  await run("a"); await expect(run("b")).rejects.toThrow("BUDGET_EXHAUSTED");
  expect(provider.sends).toBe(1); expect(s.snapshot().retained_usd).toBe(0.4);
}));
it("retains uncertain reservations across a new connection and refuses replay", async () => fixture(async (s, path) => {
  s.admit("a", "a");
  await expect(performWorkspaceCall({ provider: { ...fixtureProvider(), invoke: async () => { throw Error("TRANSPORT_OUTCOME_UNKNOWN"); } }, call, price, budget: 0.6, accounts: [{ remaining: 0.6 }], spend: s, interaction: "a" })).rejects.toThrow("TRANSPORT_OUTCOME_UNKNOWN");
  const reopened = new WorkspaceSpend(path);
  try {
    expect(reopened.snapshot().retained_usd).toBe(0.4);
    expect(() => reopened.admit("a", "a")).toThrow("WORKSPACE_BUDGET_ALREADY_STARTED");
    expect(() => reopened.admit("a", "different")).toThrow("WORKSPACE_BUDGET_ID_CONFLICT");
    reopened.admit("b", "b"); expect(() => reopened.reserve("b", 0.4)).toThrow("BUDGET_EXHAUSTED");
    expect(() => reopened.initialize(86.4)).toThrow("WORKSPACE_BUDGET_POLICY_IMMUTABLE");
    expect(() => reopened.initialize(0.6, "LIVE")).toThrow("WORKSPACE_PAID_BENCHMARK_DISABLED");
  } finally { reopened.close(); }
}));
it("refunds only known unused reservation; unknown usage stays charged", async () => fixture(async s => {
  s.admit("a", "a");
  const provider = fixtureProvider();
  provider.invoke = async () => ({ output: {}, usage: { input_tokens: 100000, output_tokens: 100000 } });
  await performWorkspaceCall({ provider, call, price, budget: 0.6, accounts: [{ remaining: 0.6 }], spend: s, interaction: "a" });
  expect(s.snapshot().retained_usd).toBe(0.2);
  const ticket = s.reserve("a", 0.4); s.unknown(ticket);
  expect(s.snapshot().retained_usd).toBe(0.6);
  expect(() => s.settle(ticket, 0)).toThrow("WORKSPACE_BUDGET_SETTLEMENT_INVALID");
}));
it("halts future spending if a provider reports usage beyond its reservation", async () => fixture(async s => {
  s.admit("a", "a"); const ticket = s.reserve("a", 0.1);
  expect(() => s.settle(ticket, 0.2)).toThrow("WORKSPACE_USAGE_EXCEEDS_RESERVATION");
  expect(s.snapshot().halted).toBe(true); expect(s.snapshot().retained_usd).toBe(0.2);
  expect(() => s.reserve("a", 0.1)).toThrow("WORKSPACE_BUDGET_HALTED");
}));
it("serializes reservations across independent OS processes and survives their exit", async () => fixture(async (s, path) => {
  for (const id of ["one", "two"]) s.admit(id, id);
  const module = new URL("../../scripts/workspace-spend-store.mjs", import.meta.url).href;
  const code = `import {WorkspaceSpend} from ${JSON.stringify(module)};const s=new WorkspaceSpend(process.argv[1]);try{s.reserve(process.argv[2],0.4);console.log('RESERVED')}catch(e){console.log(e.message)}finally{s.close()}`;
  const run = (id: string) => new Promise<string>((ok, fail) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", code, path, id], { windowsHide: true });
    let output = ""; p.stdout.on("data", b => output += b); p.on("error", fail); p.on("exit", c => c === 0 ? ok(output.trim()) : fail(Error("CHILD_FAILED")));
  });
  expect((await Promise.all([run("one"), run("two")])).sort()).toEqual(["BUDGET_EXHAUSTED", "RESERVED"]);
  expect(s.snapshot().retained_usd).toBe(0.4);
}));
