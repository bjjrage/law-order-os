import { mkdir, open, readFile, rename, readdir, link, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AccessContext, BoardRun, Scope } from '../domain/contracts.js';
import { assertAccess, BoardError, hash } from '../domain/guards.js';

export interface BoardStore {
  putImmutable(actor: AccessContext, scope: Scope, kind: string, key: string, value: unknown): Promise<void>;
  getImmutable<T>(actor: AccessContext, scope: Scope, kind: string, key: string): Promise<T | null>;
  saveRun(actor: AccessContext, run: BoardRun): Promise<void>;
  loadRun(actor: AccessContext, scope: Scope, runId: string): Promise<BoardRun | null>;
  listRuns(actor: AccessContext, scope: Scope): Promise<BoardRun[]>;
  lock(actor: AccessContext, scope: Scope, runId: string): Promise<()=>Promise<void>>;
}
export class MemoryBoardStore implements BoardStore {
  private readonly objects=new Map<string,unknown>(); private readonly runs=new Map<string,BoardRun>(); private readonly locks=new Set<string>();
  private key(scope: Scope,kind:string,key:string): string {return hash([scope.study_id,scope.matter_id,kind,key]);}
  async putImmutable(actor: AccessContext,scope:Scope,kind:string,key:string,value:unknown):Promise<void> {
    assertAccess(actor,scope);const k=this.key(scope,kind,key),prior=this.objects.get(k);
    if (prior && hash(prior)!==hash(value)) throw new BoardError('IMMUTABLE_SNAPSHOT');
    this.objects.set(k,structuredClone(value));
  }
  async getImmutable<T>(actor:AccessContext,scope:Scope,kind:string,key:string):Promise<T|null> {assertAccess(actor,scope);return structuredClone(this.objects.get(this.key(scope,kind,key))??null) as T|null;}
  async saveRun(actor:AccessContext,run:BoardRun):Promise<void> {assertAccess(actor,run);this.runs.set(this.key(run,'run',run.run_id),structuredClone(run));}
  async loadRun(actor:AccessContext,scope:Scope,runId:string):Promise<BoardRun|null> {assertAccess(actor,scope);return structuredClone(this.runs.get(this.key(scope,'run',runId))??null);}
  async listRuns(actor:AccessContext,scope:Scope):Promise<BoardRun[]> {assertAccess(actor,scope);return [...this.runs.values()].filter(r=>r.study_id===scope.study_id && r.matter_id===scope.matter_id).map(r=>structuredClone(r));}
  async lock(actor:AccessContext,scope:Scope,runId:string):Promise<()=>Promise<void>> {assertAccess(actor,scope);const key=this.key(scope,'lock',runId);if(this.locks.has(key))throw new BoardError('RUN_BUSY');this.locks.add(key);return async()=>{this.locks.delete(key);};}
}
const isMissing=(e:unknown)=>Boolean(e && typeof e==='object' && 'code' in e && e.code==='ENOENT');
export class FileBoardStore implements BoardStore {
  readonly root:string;
  constructor(root:string) {this.root=resolve(root);}
  private bucket(scope:Scope,kind:string):string {return join(this.root,hash([scope.study_id,scope.matter_id]),hash(kind));}
  private path(scope:Scope,kind:string,key:string):string {return join(this.bucket(scope,kind),hash(key)+'.json');}
  async putImmutable(actor:AccessContext,scope:Scope,kind:string,key:string,value:unknown):Promise<void> {
    assertAccess(actor,scope);await mkdir(this.bucket(scope,kind),{recursive:true});const path=this.path(scope,kind,key);
    const envelope={hash:hash(value),value};const temp=path+'.'+randomUUID()+'.tmp';
    const handle=await open(temp,'wx');try{await handle.writeFile(JSON.stringify(envelope));await handle.sync();}finally{await handle.close();}
    try{await link(temp,path);}
    catch(e){if(e && typeof e==='object' && 'code' in e && e.code==='EEXIST'){const existing=await this.getImmutable(actor,scope,kind,key);if(hash(existing)!==hash(value))throw new BoardError('IMMUTABLE_SNAPSHOT');}else throw e;}
    finally{await unlink(temp);}
  }
  async getImmutable<T>(actor:AccessContext,scope:Scope,kind:string,key:string):Promise<T|null> {
    assertAccess(actor,scope);
    try {const envelope=JSON.parse(await readFile(this.path(scope,kind,key),'utf8')) as {hash:string;value:T};if(envelope.hash!==hash(envelope.value))throw new BoardError('PERSISTENCE_HASH_MISMATCH');return envelope.value;}
    catch(e) {if(isMissing(e))return null;throw e;}
  }
  async saveRun(actor:AccessContext,run:BoardRun):Promise<void> {
    assertAccess(actor,run);const digest=hash(run);await this.putImmutable(actor,run,'run-history',`${run.run_id}:${digest}`,run);
    const bucket=this.bucket(run,'run-heads');await mkdir(bucket,{recursive:true});const path=this.path(run,'run-heads',run.run_id),temp=path+'.'+randomUUID()+'.tmp';
    const handle=await open(temp,'wx');try{await handle.writeFile(JSON.stringify({run_id:run.run_id,hash:digest}));await handle.sync();}finally{await handle.close();}
    await rename(temp,path);
  }
  async loadRun(actor:AccessContext,scope:Scope,runId:string):Promise<BoardRun|null> {
    assertAccess(actor,scope);
    try {const head=JSON.parse(await readFile(this.path(scope,'run-heads',runId),'utf8')) as {run_id:string;hash:string};
      const run=await this.getImmutable<BoardRun>(actor,scope,'run-history',`${runId}:${head.hash}`);
      if(!run || run.run_id!==runId || hash(run)!==head.hash || run.study_id!==scope.study_id || run.matter_id!==scope.matter_id)throw new BoardError('PERSISTENCE_HASH_MISMATCH');return run;
    }catch(e){if(isMissing(e))return null;throw e;}
  }
  async listRuns(actor:AccessContext,scope:Scope):Promise<BoardRun[]> {
    assertAccess(actor,scope);let names:string[];try{names=await readdir(this.bucket(scope,'run-heads'));}catch(e){if(isMissing(e))return [];throw e;}
    const runs:BoardRun[]=[];for(const name of names.filter(n=>n.endsWith('.json'))){const head=JSON.parse(await readFile(join(this.bucket(scope,'run-heads'),name),'utf8')) as {run_id:string};const run=await this.loadRun(actor,scope,head.run_id);if(run)runs.push(run);}return runs;
  }
  async lock(actor:AccessContext,scope:Scope,runId:string):Promise<()=>Promise<void>> {
    assertAccess(actor,scope);const dir=this.bucket(scope,'locks');await mkdir(dir,{recursive:true});const path=join(dir,hash(runId)+'.lock');
    try {const handle=await open(path,'wx');await handle.writeFile(JSON.stringify({run_id:runId,pid:process.pid}));return async()=>{await handle.close();await unlink(path);};}
    catch(e){if(e && typeof e==='object' && 'code' in e && e.code==='EEXIST')throw new BoardError('RUN_BUSY_OR_INTERRUPTED_LOCK');throw e;}
  }
  async recoverInterrupted(actor:AccessContext,scope:Scope,runId:string):Promise<BoardRun|null>{
    assertAccess(actor,scope);const path=join(this.bucket(scope,'locks'),hash(runId)+'.lock');
    let lock:{run_id:string;pid:number}|null=null;
    try{lock=JSON.parse(await readFile(path,'utf8')) as {run_id:string;pid:number};}catch(e){if(!isMissing(e))throw e;}
    if(lock){
      if(lock.run_id!==runId || !Number.isInteger(lock.pid) || lock.pid<=0)throw new BoardError('LOCK_RECORD_INVALID');
      let ownerAlive=true;
      try{process.kill(lock.pid,0);}catch(e){if(e && typeof e==='object' && 'code' in e && e.code==='ESRCH')ownerAlive=false;else throw new BoardError('LOCK_OWNER_STATUS_UNCERTAIN');}
      if(ownerAlive)throw new BoardError('LOCK_OWNER_ALIVE');
    }
    const release=lock?null:await this.lock(actor,scope,runId);
    try{const run=await this.loadRun(actor,scope,runId);
      if(run && !['HUMAN_REVIEW_PENDING','PARTIAL','FAILED','CANCELLED'].includes(run.status)){run.status='PARTIAL';run.history.push('PARTIAL');run.error_code='RUN_INTERRUPTED_NO_AUTOMATIC_REPLAY';await this.saveRun(actor,run);}
      if(lock)await unlink(path);return run;
    }finally{if(release)await release();}
  }
}
