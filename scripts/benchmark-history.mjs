// Host-only evaluation storage. Never copied into the AppContainer.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
export class BenchmarkHistory {
  constructor(path) {
    this.db=new DatabaseSync(path,{timeout:10000});
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS executions(id TEXT PRIMARY KEY, case_id TEXT NOT NULL, level TEXT NOT NULL, next_turn INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS claims(execution TEXT NOT NULL,turn INTEGER NOT NULL,job_id TEXT NOT NULL UNIQUE,PRIMARY KEY(execution,turn));
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, execution TEXT NOT NULL, turn INTEGER NOT NULL, created_at TEXT NOT NULL, job TEXT NOT NULL, result TEXT NOT NULL, UNIQUE(execution,turn));`);
  }
  close(){this.db.close();}
  claim(execution,turn) {
    const id=randomUUID();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if(this.db.prepare("SELECT next_turn FROM executions WHERE id=?").get(execution)?.next_turn!==turn)throw Error("WORKSPACE_BENCHMARK_HISTORY_SCOPE_DENIED");
      if(this.db.prepare("SELECT job_id FROM claims WHERE execution=? AND turn=?").get(execution,turn))throw Error("WORKSPACE_BUDGET_ALREADY_STARTED");
      this.db.prepare("INSERT INTO claims VALUES(?,?,?)").run(execution,turn,id);this.db.exec("COMMIT");return id;
    }catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  start(id,caseId,level) {
    this.db.prepare("INSERT INTO executions VALUES(?,?,?,1)").run(id,caseId,level);
  }
  context(id,caseId,level,turn) {
    const row=this.db.prepare("SELECT * FROM executions WHERE id=?").get(id);
    if(!row||row.case_id!==caseId||row.level!==level||row.next_turn!==turn)throw Error("WORKSPACE_BENCHMARK_HISTORY_SCOPE_DENIED");
    const previous=this.db.prepare("SELECT * FROM jobs WHERE execution=? ORDER BY turn").all(id).map(r=>({...r,job:JSON.parse(r.job),result:JSON.parse(r.result)}));
    const last=previous.at(-1);
    return { recent_jobs:previous.map(r=>({id:r.id,action:r.job.request.action,status:"COMPLETED",instruction:r.job.request.instruction,summary:r.result.summary,error_code:null})),
      analysis:last?{job_id:last.id,instruction:last.job.request.instruction,summary:last.result.summary,findings:(last.result.findings??[]).map(f=>({...f,decision:"OPEN"})),sources:last.result.sources??[],quality_control:last.result.quality_control}:null };
  }
  record(execution,turn,job,result) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const e=this.db.prepare("SELECT * FROM executions WHERE id=?").get(execution);
      if(!e||e.next_turn!==turn)throw Error("WORKSPACE_BENCHMARK_HISTORY_SCOPE_DENIED");
      if(this.db.prepare("SELECT job_id FROM claims WHERE execution=? AND turn=?").get(execution,turn)?.job_id!==job.id)throw Error("WORKSPACE_BENCHMARK_HISTORY_SCOPE_DENIED");
      this.db.prepare("INSERT INTO jobs VALUES(?,?,?,?,?,?)").run(job.id,execution,turn,new Date().toISOString(),JSON.stringify(job),JSON.stringify(result));
      this.db.prepare("UPDATE executions SET next_turn=next_turn+1 WHERE id=?").run(execution);this.db.exec("COMMIT");
    } catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  read(execution,tool,args) {
    if(tool==="list_saved_work") {
      const rows=this.db.prepare("SELECT * FROM jobs WHERE execution=? AND (? IS NULL OR created_at<?) ORDER BY turn DESC LIMIT 25").all(execution,args.before,args.before);
      return {jobs:rows.map(r=>({id:r.id,created_at:r.created_at,status:"COMPLETED",action:JSON.parse(r.job).request.action,instruction:JSON.parse(r.job).request.instruction,summary:JSON.parse(r.result).summary,has_proposal:!!JSON.parse(r.result).replacement_text})),next_before:null};
    }
    if(tool!=="read_saved_work")throw Error("WORKSPACE_UNKNOWN_TOOL");
    const row=this.db.prepare("SELECT * FROM jobs WHERE execution=? AND id=?").get(execution,args.job_id);
    if(!row)throw Error("WORKSPACE_HISTORY_NOT_FOUND");
    const r=JSON.parse(row.result),job=JSON.parse(row.job);
    if(args.part==="CONVERSATION")return{job_id:row.id,instruction:job.request.instruction,summary:r.summary,status:"COMPLETED",error_code:null,agent_trace:r.agent_trace??[],quality_control:r.quality_control,specialist_bindings:r.specialist_bindings??[]};
    if(args.part==="PROPOSAL") {
      if(!r.replacement_text)throw Error("WORKSPACE_REVISION_RESULT_MISSING");
      return {job_id:row.id,summary:r.summary,replacement_text:r.replacement_text,scope:r.execution?.scope??"DOCUMENT",limitations:r.limitations,quality_control:r.quality_control,application_status:"NOT_INFERRED_FROM_GENERATION"};
    }
    if(args.part!=="ANALYSIS")throw Error("WORKSPACE_UNKNOWN_TOOL");
    return{analysis:{job_id:row.id,instruction:job.request.instruction,summary:r.summary,findings:(r.findings??[]).map(f=>({...f,decision:"OPEN"})),sources:r.sources??[],quality_control:r.quality_control}};
  }
}
