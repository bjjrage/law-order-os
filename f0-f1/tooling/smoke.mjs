import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const args=['--import','./phase2/tooling/block-network.mjs','dist/cli/index.js','smoke','--request-id','f0-f1-offline-2026-10-13','--data-dir','f0-f1/local-board-data','--report-dir','f0-f1/reports'];
const run=spawnSync(process.execPath,args,{encoding:'utf8',shell:false,windowsHide:true});
const value=JSON.parse(run.stdout);
const result={command:['node',...args],exit_code:run.status,status:value.status,reference_verification:value.reference_verification,labels:value.references?.map(r=>r.label),network_guard:true,paid_inference_usd:0};
writeFileSync('f0-f1/reports/smoke-check.json',JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify(result));
if(run.status!==0||value.status!=='HUMAN_REVIEW_PENDING'||!value.references.every(r=>r.label==='SIMULATED_VERIFIED')) process.exitCode=1;
