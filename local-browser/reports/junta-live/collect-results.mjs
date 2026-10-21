import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { statusCase } from '../../../scripts/junta-case.mjs';
const root=resolve('.'),runs=[];
for(const file of await readdir(resolve(root,'.board-data/case-junta'))){
  if(!file.endsWith('.json'))continue;
  const prepared=JSON.parse(await readFile(resolve(root,'.board-data/case-junta',file),'utf8'));
  const request=prepared.bundle?.request;
  if(request?.study_id!=='compact-ux-demo'||request.matter_id!=='matter-demo-3'||prepared.execution_mode!=='LIVE'||!['En un supuesto totalmente ficticio','En un caso ficticio de Paraguay'].some(prefix=>request.legal_question.startsWith(prefix)))continue;
  const status=await statusCase(prepared.prepared_id,root),run=status.run;
  runs.push({prepared_id:prepared.prepared_id,created_at:prepared.created_at,question:request.legal_question,run_id:run?.run_id,mode:run?.mode,status:run?.status,error_code:run?.error_code,has_analysis:!!run?.analysis,has_audit:!!run?.audit,stages:run?.stages,cost:run?.cost,citation_review:run?.citation_review});
  if(run)await writeFile(resolve(root,'local-browser/reports/junta-live',prepared.prepared_id+'.result.json'),JSON.stringify(run,null,2));
}
runs.sort((a,b)=>a.created_at.localeCompare(b.created_at));
const report={date:'2026-10-16',scope:'LOCAL_SYNTHETIC_REAL_INFERENCE',budget_per_query_usd:0.6,metadata:JSON.parse(await readFile(resolve(root,'.local-dev/junta-metadata.json'),'utf8')),runs};
await writeFile(resolve(root,'local-browser/reports/junta-live/activation-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
