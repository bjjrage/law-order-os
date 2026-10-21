import {readFile,mkdir,open,statfs} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {libraryProcessRunning} from './library-process.mjs';
const jobs=[{name:'full-load',script:'library-full-load.mjs'},{name:'ocr-load',script:'library-ocr-load.mjs'}];
const recovery=new Map();
async function readState(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){return error.code==='ENOENT'?null:{status:'INTERRUPTED',error:'LIBRARY_PROGRESS_UNREADABLE'};}}
async function jobState(root,name,isRunning){
  const state=await readState(resolve(root,'local-browser/library/research',name+'-progress.json'));
  if(!state)return {status:'NOT_STARTED'};
  return state.status==='RUNNING'&&!await isRunning(state.pid,jobs.find(j=>j.name===name).script)?{...state,status:'INTERRUPTED'}:state;
}
export async function libraryJobStatus(root,{isRunning=libraryProcessRunning}={}){
  const [digital,ocr]=await Promise.all(jobs.map(j=>jobState(root,j.name,isRunning)));
  const active=digital.status==='RUNNING'||ocr.status==='RUNNING';
  const status=active?'RUNNING':digital.status==='COMPLETED_AVAILABLE_QUEUE'&&ocr.status==='COMPLETED_AVAILABLE_QUEUE'?'COMPLETED_AVAILABLE_QUEUE':digital.status==='NOT_STARTED'&&ocr.status==='NOT_STARTED'?'NOT_STARTED':digital.status==='STOPPED'||ocr.status==='STOPPED'?'STOPPED':'INTERRUPTED';
  const latest=ocr.updated_at>digital.updated_at?ocr:digital;
  const counts=Object.fromEntries(['indexed_documents','indexed_passages','ocr_documents','discovered_documents'].filter(k=>latest[k]!==undefined).map(k=>[k,latest[k]]));
  if(counts.indexed_documents===undefined){try{const {libraryCoverage}=await import('./library-access.mjs');const c=libraryCoverage(root);Object.assign(counts,{indexed_documents:c.indexed_sources,indexed_passages:c.passages,discovered_documents:c.discovered_records});}catch{/* Preserve an explicit interrupted state if the database is unavailable. */}}
  return {...digital,...counts,status,error:digital.error??ocr.error,current_document:ocr.status==='RUNNING'&&ocr.current_document?ocr.current_document:digital.current_document,digital_status:digital.status,ocr:{status:ocr.status,documents_processed:ocr.documents_processed??0,current_document:ocr.current_document??null,error:ocr.error}};
}
export async function ensureLibraryJob(root,{isRunning=libraryProcessRunning}={}){
  const policy=JSON.parse(await readFile(resolve(root,'.local-dev/library-full-load.json'),'utf8').catch(()=>'{}'));
  if(policy.enabled!==true||policy.ocr!==true||policy.paid_calls!==false)return {status:'DISABLED'};
  const dir=resolve(root,'local-browser/library/research');await mkdir(dir,{recursive:true});
  // Fixed local script, no shell, no arbitrary arguments and no provider credentials.
  const env=Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','USERPROFILE','LOCALAPPDATA'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const started=[];
  for(const job of jobs){
    const state=await jobState(root,job.name,isRunning),lock=await readState(resolve(dir,job.name+'.lock'));
    const key=resolve(dir,job.name),retry=recovery.get(key)??{attempts:0,next:0};
    if((lock?.pid&&await isRunning(lock.pid,job.script))||state.status==='RUNNING'){recovery.delete(key);continue;}
    if(state.status==='COMPLETED_AVAILABLE_QUEUE'||Date.now()<retry.next)continue;
    const disk=await statfs(dir);if(disk.bavail*disk.bsize<10_000_000_000)continue;
    const log=await open(resolve(dir,job.name+'.log'),'a');
    try{
      const child=spawn(process.execPath,[resolve(root,'scripts',job.script)],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',log.fd,log.fd],env});
      await new Promise((done,reject)=>{child.once('spawn',done);child.once('error',reject);});child.unref();started.push({job:job.name,pid:child.pid});
      recovery.set(key,{attempts:retry.attempts+1,next:Date.now()+Math.min(1800000,60000*2**Math.min(retry.attempts,5))});
    }finally{await log.close();}
  }
  return started.length?{status:'STARTING',jobs:started}:libraryJobStatus(root,{isRunning});
}
