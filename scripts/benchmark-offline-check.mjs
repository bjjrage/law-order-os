import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, connect } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import { WorkspaceSpend } from "./workspace-spend-store.mjs";
import { BenchmarkHistory } from "./benchmark-history.mjs";
import { prepareBenchmarkCapsule, runIsolatedBenchmark } from "./benchmark-isolation.mjs";
const root=resolve(import.meta.dirname,".."), parent=resolve(root,".local-dev");
const pilotState=resolve(parent,"benchmark-pilot-2026-10-21");await mkdir(pilotState,{recursive:true});
const spendPath=resolve(pilotState,"offline-spend.sqlite"), historyPath=resolve(pilotState,"offline-history.sqlite");
const spend=new WorkspaceSpend(spendPath);spend.initialize(86.4);
const history=new BenchmarkHistory(historyPath), executionId=randomUUID();history.start(executionId,"N06","MEDIO");
const results=[];let connections=0;
const server=createServer(s=>{connections++;s.destroy();});
await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
await new Promise((ok,fail)=>{const s=connect(server.address().port,"127.0.0.1");s.once("connect",()=>{s.destroy();ok();});s.once("error",fail);});
connections=0;
try {
  for(let turn=1;turn<=4;turn++) {
    const base=resolve(parent,"benchmark-offline-"+randomUUID());
    const prepared=await prepareBenchmarkCapsule(base,{caseId:"N06",turn,history,executionId});
    const canary=resolve(base,"host-canary.sqlite"), db=new DatabaseSync(canary);
    db.exec("CREATE TABLE canary(value TEXT); INSERT INTO canary VALUES('synthetic canary, not a secret')");db.close();
    await writeFile(resolve(base,"future-turn.txt"),"Synthetic withheld turn");
    const result=await runIsolatedBenchmark(prepared,{spend,kernelCanary:canary,probePort:server.address().port,
      readSavedWork:(tool,args)=>history.read(executionId,tool,args),
      forbidden:[resolve(root,".env"),resolve(root,"docs/evaluacion-niveles-2026-10-21/dossiers/N06.md"),resolve(base,"future-turn.txt"),spendPath,historyPath,canary]});
    if(connections||result.specialist_count<1||!result.result.quality_control?.checked_outputs?.length||result.history_jobs!==turn-1||!result.foreign_history_denied||prepared.manifest.source_ids.includes("N06-AS318-2010")!==(turn>=2))throw Error("BENCHMARK_OFFLINE_ACCEPTANCE_FAILED");
    const {result:output,...metadata}=result;
    history.record(executionId,turn,prepared.job,output);
    await writeFile(resolve(base,"output-offline.json"),JSON.stringify(output,null,2));
    results.push({...metadata,base});
    console.log(JSON.stringify({turn,status:"PASS",history_jobs:result.history_jobs,generations_synthetic:result.generations}));
  }
  const host_control_hashes=[];
  for(const path of ["scripts/benchmark-isolation.mjs","scripts/benchmark-offline-check.mjs","scripts/benchmark-appcontainer.cs","scripts/workspace-spend-store.mjs","scripts/benchmark-history.mjs"])
    host_control_hashes.push({path,sha256:createHash("sha256").update(await readFile(resolve(root,path))).digest("hex")});
  const report={...results.at(-1),turns:results.map(({result,manifest,...r})=>r),completed_turns:4,created_at:new Date().toISOString(),host_control_hashes,
    paid_inferences:0,real_provider_requests:0,forbidden_loopback_connections:connections,executionId,
    quality_note:"Synthetic protocol fixture; preserves REVIEW_REQUIRED if checker finds source text inside carried contributions. No control or finding is suppressed.",
    scope:"Four isolated turns, scoped durable history, actual unified runtime with synthetic providers, Windows AppContainer zero capabilities, parent durable global spend ledger"};
  const path=resolve(root,"docs/evaluacion-niveles-2026-10-21/operacion/AISLAMIENTO_OFFLINE.json");
  await writeFile(path,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({status:"PASS",completed_turns:4,report:path}));
} finally {history.close();spend.close();await new Promise(ok=>server.close(ok));}
