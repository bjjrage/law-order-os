// No credentials, network, model providers, SQL against the work database, or live authorization.
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { WorkspaceSpend } from "./workspace-spend-store.mjs";
import { performWorkspaceCall } from "./workspace-spend.mjs";
import { workspacePrice, workspaceCost } from './workspace-pricing.mjs';
const root=resolve(import.meta.dirname,".."), out=resolve(root,"docs/evaluacion-niveles-2026-10-21/operacion");
const dir=await mkdtemp(resolve(root,".local-dev/readiness-offline-"));
assert.equal(dirname(dir),resolve(root,".local-dev"));
const spend=new WorkspaceSpend(resolve(dir,"ledger.sqlite"));
let sends=0;
try {
  spend.initialize(0.6);spend.admit("a","a");spend.admit("b","b");
  const provider={verifyAvailability:async()=>{},countInputTokens:async()=>200000,invoke:async()=>{sends++;return{output:{},usage:{input_tokens:200000,output_tokens:200000}}}};
  const price={as_of_date:new Date().toISOString(),input_per_million_usd:1,output_per_million_usd:1};
  const call={input_token_upper_bound:900000,max_output_tokens:200000};
  const results=await Promise.allSettled(["a","b"].map(interaction=>performWorkspaceCall({provider,price,call,budget:0.6,accounts:[{remaining:0.6}],spend,interaction})));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(sends,1);assert.equal(spend.snapshot().retained_usd,0.4);
} finally {spend.close();await rm(dir,{recursive:true,force:true});}
const isolation=JSON.parse(await readFile(resolve(out,"AISLAMIENTO_OFFLINE.json"),"utf8"));
const tests=JSON.parse(await readFile(resolve(out,"OFFLINE_TESTS.json"),"utf8"));
const sha=value=>createHash("sha256").update(value).digest("hex");
const controls=[...(isolation.host_control_hashes??[]),...isolation.manifest.code.filter(f=>f.path.startsWith("scripts/")||f.path.startsWith("packages/")||f.path.startsWith('node_modules/@huggingface/tokenizers/')||f.path==='package.json')];
const code_matches=[];
for(const item of controls)code_matches.push({path:item.path,sha256:sha(await readFile(resolve(root,item.path))),matches:sha(await readFile(resolve(root,item.path)))===item.sha256});
const integrity=code_matches.length>10&&code_matches.every(f=>f.matches);
const isolated=integrity&&isolation.completed_turns===4&&isolation.turns?.length===4&&isolation.turns.every((t,i)=>t.history_jobs===i&&t.foreign_history_denied&&t.attestation.appContainer&&t.attestation.capabilityCount===0)&&isolation.attestation.appContainer&&isolation.attestation.capabilityCount===0&&isolation.forbidden_loopback_connections===0&&isolation.environment_clean&&isolation.probes.every(p=>["ERR_ACCESS_DENIED","EACCES","EPERM","SQLITE_14"].includes(p.result));
const suitePassed=tests.success===true&&tests.numFailedTests===0&&tests.numPassedTests>=26;
const corpus=JSON.parse(await readFile(resolve(out,'PRESUPUESTO_DETALLADO.json'),'utf8'));
const corpusVerified=corpus.corpus.length===24&&corpus.corpus.every(c=>c.round_trip_exact&&c.integration_result==='OFFLINE_ACCEPTED_FULL_CORPUS'&&c.provider_invocations===0);
const priceBytes=await readFile(resolve(root,'phase2/reports/model-connectivity-standard-prices.json'));
const prices=JSON.parse(priceBytes),sol=workspacePrice(prices.find(p=>p.model_id==='gpt-6.1-sol'&&p.mode==='STANDARD'),'gpt-6.1-sol');
assert.equal(workspaceCost(sol,272000,1000),.554);assert.equal(workspaceCost(sol,272001,1000),1.103004);
const currentPackage=JSON.parse(await readFile(resolve(root,'docs/evaluacion-niveles-2026-10-21/publico/fuentes/INVENTARIO.json'),'utf8'));
assert.equal(corpus.source_inventory_sha256,sha(await readFile(resolve(root,'docs/evaluacion-niveles-2026-10-21/publico/fuentes/INVENTARIO.json'))));
assert(currentPackage.some(s=>s.id==='CPC-7663'));
const report={version:"0.5",created_at:new Date().toISOString(),paid_inferences:0,real_provider_requests:0,
  durable_global_budget_verified:true,concurrent_reservation_verified:true,synthetic_calls_sent:sends,
  offline_tests:{passed:tests.numPassedTests,failed:tests.numFailedTests,success:suitePassed},code_matches,
  corpus_verified:corpusVerified,price_inventory_sha256:sha(priceBytes),long_context_price_verified:true,
  isolation:{verified:!!isolated,scope:"Four AppContainer turns with two specialists, integration, scoped history and actual unified runtime, synthetic providers; no live matrix executed",evidence:"AISLAMIENTO_OFFLINE.json"},
  gates:{offline_technical_checks_passed:!!isolated&&suitePassed&&corpusVerified,corpus_and_context_verified:corpusVerified&&suitePassed,long_context_price_verified:suitePassed,paid_execution_enabled:false,human_legal_validation:false,total_spend_authorized:false}};
await writeFile(resolve(out,"VERIFICACION_TECNICA.json"),JSON.stringify(report,null,2)+"\n");
if(!report.gates.offline_technical_checks_passed)throw Error("BENCHMARK_OFFLINE_READINESS_NOT_VERIFIED");
console.log(JSON.stringify({status:"PASS",passed_tests:tests.numPassedTests,code_hashes:code_matches.length,paid_execution_enabled:false}));
