import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { statusCase, loadCase } from '../../../scripts/junta-case.mjs';
import { FileBoardStore } from '../../../dist/persistence/index.js';
import { hash } from '../../../dist/domain/guards.js';
const root=resolve('.');
const own=[];
for(const name of await readdir(resolve(root,'.board-data/case-junta'))){
  if(!name.endsWith('.json'))continue;
  const p=JSON.parse(await readFile(resolve(root,'.board-data/case-junta',name),'utf8'));
  if(p.bundle?.request.study_id==='compact-ux-demo'&&p.bundle?.request.matter_id==='matter-demo-3'&&p.execution_mode==='LIVE'&&p.bundle.request.legal_question.startsWith('En un supuesto totalmente ficticio'))own.push(p);
}
const p=own.sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
if(!p)throw Error('OWN_SYNTHETIC_CASE_NOT_FOUND');
const prepared=await loadCase(p.prepared_id,root),status=await statusCase(p.prepared_id,root);
const runId=`run:${hash([p.bundle.request.study_id,p.bundle.request.matter_id,p.bundle.request.request_id]).slice(0,32)}`;
const store=new FileBoardStore(resolve(root,'.board-data/case-junta/runs'));
const raw=await store.loadRun(p.bundle.actor,p.bundle.request,runId);
const context=raw?.stages.find(stage=>stage.stage_name==='BUILDING_CONTEXT'&&stage.output_snapshot_hash);
const output=context?await store.getImmutable(p.bundle.actor,p.bundle.request,'stage-artifacts',`${runId}:BUILDING_CONTEXT:output:${context.output_snapshot_hash}`):null;
const principal=raw?.stages.find(stage=>stage.stage_name==='PRINCIPAL_ANALYSIS'&&stage.output_snapshot_hash);
const principalOutput=principal?await store.getImmutable(p.bundle.actor,p.bundle.request,'stage-artifacts',`${runId}:PRINCIPAL_ANALYSIS:output:${principal.output_snapshot_hash}`):null;
console.log(JSON.stringify({prepared_id:prepared.prepared_id,run:{status:status.run?.status,error_code:status.run?.error_code,cost:status.run?.cost,stages:status.run?.stages},principal_output:principalOutput?.value??null},null,2));
