import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const results=[];
const common=['--import','./phase2/tooling/block-network.mjs','dist/cli/index.js'];
function run(name,args,expectedExit,assertion=()=>true){
  const r=spawnSync(process.execPath,[...common,...args],{encoding:'utf8',shell:false,windowsHide:true});
  let value;try{value=JSON.parse(r.stdout);}catch{throw Error(name+':INVALID_CLI_OUTPUT');}
  const pass=r.status===expectedExit&&assertion(value);
  results.push({name,exit_code:r.status,expected_exit_code:expectedExit,status:value.status,error_code:value.error_code??null,pass});
  if(!pass)throw Error(name+':CLI_ASSERTION_FAILED');
  return value;
}
const smokeArgs=['smoke','--request-id','phase2-offline-2026-10-13','--data-dir','.board-data/phase2','--report-dir','phase2/reports'];
const first=run('offline-smoke',smokeArgs,0,v=>v.status==='HUMAN_REVIEW_PENDING'&&v.reference_verification==='PASS_IN_SCOPE'&&v.references.every(r=>r.label==='SIMULATED_VERIFIED'));
run('offline-idempotence',smokeArgs,0,v=>v.run_id===first.run_id&&JSON.stringify(v.cost)===JSON.stringify(first.cost));
run('offline-show',['show','--data-dir','.board-data/phase2','--run-id',first.run_id,'--study','estudio-demo','--matter','asunto-demo','--user','abogado-demo'],0,v=>v.run_id===first.run_id&&JSON.stringify(v.cost)===JSON.stringify(first.cost));
run('known-offline-regressions',['benchmark','--report-dir','phase2/reports'],0,v=>v.status==='PASS'&&v.bibliography_v2.passed===24);
const preflight=run('live-preflight-pure',['live-preflight','--plan','phase2/reports/model-connectivity-smoke-plan.json','--price-file','phase2/reports/model-connectivity-standard-prices.json','--metadata-file','phase2/reports/model-connectivity-account-proofs.json'],2,v=>v.status==='BLOCKED'&&v.network_used===false&&v.execution_authorized===false);
writeFileSync('phase2/reports/live-preflight-cli.json',JSON.stringify(preflight,null,2));
run('live-smoke-without-authorization',['live-smoke'],2,v=>v.error_code==='EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED');
run('general-live-without-authorization',['live'],2,v=>v.error_code==='EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED');
const report={status:'PASS',network_guard:true,paid_inference_usd:0,deployments:0,smoke_run_id:first.run_id,results};
writeFileSync('phase2/reports/cli-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
