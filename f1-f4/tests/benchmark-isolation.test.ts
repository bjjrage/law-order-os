import { it, expect } from "vitest";
import {mkdtemp,rm} from "node:fs/promises";
import {resolve,dirname} from "node:path";
// @ts-expect-error Host-only history.
import {BenchmarkHistory} from "../../scripts/benchmark-history.mjs";
// @ts-expect-error Native isolation staging, no external process launched here.
import { benchmarkSnapshot } from "../../scripts/benchmark-isolation.mjs";
it("releases only the current case and previous documents; withholds the real N06 decision until turn two", async () => {
  for(const caseId of ["N01","N02","N03","N04","N05","N06"]) {
    const first=await benchmarkSnapshot({caseId,turn:1});
    expect(first.job.context.document.text).toContain(caseId+"-D1");
    expect(first.job.context.document.text).not.toContain(caseId+"-D2");
    expect(first.job.request.include_library).toBe(false);
    expect(first.job.context.director_state.recent_jobs).toEqual([]);
    expect(JSON.stringify(first.job)).not.toContain("dossiers/");
    expect(first.sourceIds).not.toContain("N06-AS318-2010");
    const second=await benchmarkSnapshot({caseId,turn:2});
    expect(second.job.context.document.text).toContain(caseId+"-D2");
    if(caseId==="N06")expect(second.sourceIds).toContain("N06-AS318-2010");
  }
});
it("rejects unknown cases, levels and temporal scope before staging", async () => {
  await expect(benchmarkSnapshot({caseId:"ALL"})).rejects.toThrow("BENCHMARK_CASE_INVALID");
  await expect(benchmarkSnapshot({turn:5})).rejects.toThrow("BENCHMARK_INPUT_INVALID");
  await expect(benchmarkSnapshot({level:"CUSTOM"})).rejects.toThrow("BENCHMARK_INPUT_INVALID");
});
it("persists only owned history, enforces turn order and retains claims after restart",async()=>{
  const dir=await mkdtemp(resolve(".local-dev/history-offline-"));expect(dirname(dir)).toBe(resolve(".local-dev"));
  const path=resolve(dir,"history.sqlite"),h=new BenchmarkHistory(path);
  try {
    h.start("a","N01","MEDIO");h.start("b","N02","MEDIO");
    const id=h.claim("a",1);const job={id,request:{instruction:"synthetic",action:"PLAN"}};
    h.record("a",1,job,{summary:"synthetic result",findings:[],sources:[]});
    expect(h.context("a","N01","MEDIO",2).recent_jobs).toHaveLength(1);
    expect(()=>h.context("a","N02","MEDIO",2)).toThrow("WORKSPACE_BENCHMARK_HISTORY_SCOPE_DENIED");
    expect(()=>h.read("b","read_saved_work",{job_id:id,part:"CONVERSATION"})).toThrow("WORKSPACE_HISTORY_NOT_FOUND");
    expect(h.read("a","read_saved_work",{job_id:id,part:"CONVERSATION"}).summary).toBe("synthetic result");
    h.claim("a",2);const reopened=new BenchmarkHistory(path);
    try{expect(()=>reopened.claim("a",2)).toThrow("WORKSPACE_BUDGET_ALREADY_STARTED");}finally{reopened.close();}
  }finally{h.close();await rm(dir,{recursive:true,force:true});}
});
