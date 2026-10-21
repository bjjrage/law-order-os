import { mkdir, readFile, writeFile, cp, lstat, readdir } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createHash, randomUUID } from "node:crypto";
import { WorkspaceSpend } from "./workspace-spend-store.mjs";
const ROOT = resolve(import.meta.dirname, "..");
const PACKAGE = resolve(ROOT, "docs/evaluacion-niveles-2026-10-21");
const sha = value => createHash("sha256").update(value).digest("hex");
function within(base, path) {
  const r = relative(base, path);
  if (r.startsWith("..") || isAbsolute(r)) throw Error("BENCHMARK_PATH_OUTSIDE_WORKSPACE");
}
async function noLinks(path) {
  const s = await lstat(path); if (s.isSymbolicLink()) throw Error("BENCHMARK_LINK_DENIED");
  if (s.isDirectory()) for (const n of await readdir(path)) await noLinks(resolve(path, n));
}
export async function benchmarkSnapshot({caseId="N01",turn=1,level="MEDIO"}={}) {
  if (![1,2,3,4].includes(turn) || !["AGIL","MEDIO","PROFUNDO"].includes(level)) throw Error("BENCHMARK_INPUT_INVALID");
  const packageManifest=JSON.parse(await readFile(resolve(PACKAGE,"MANIFIESTO.json"),"utf8"));
  for(const path of ["publico/CASOS.json","publico/fuentes/INVENTARIO.json"]) {
    if(packageManifest.files.find(f=>f.path===path)?.sha256!==sha(await readFile(resolve(PACKAGE,path))))throw Error("BENCHMARK_PACKAGE_CHANGED");
  }
  const cases = JSON.parse(await readFile(resolve(PACKAGE, "publico/CASOS.json"), "utf8")), c = cases.find(c => c.id === caseId);
  if (!c) throw Error("BENCHMARK_CASE_INVALID");
  const inventory = JSON.parse(await readFile(resolve(PACKAGE, "publico/fuentes/INVENTARIO.json"), "utf8"));
  const ids = new Set([...c.fuentes_controladas_desde_turno_1, ...c.turnos.slice(0, turn).flatMap(t => t.fuentes_adicionales ?? [])]);
  const sources = [];
  for (const id of ids) {
    const record = inventory.find(r => r.id === id); if (!record) throw Error("BENCHMARK_SOURCE_MISSING");
    if(id==="GACETA-2011-2" && ids.has("N06-AS318-2010")) {
      if(sha(await readFile(resolve(PACKAGE,"publico/fuentes",record.path)))!==record.sha256)throw Error("BENCHMARK_SOURCE_HASH_MISMATCH");
      continue; // Original volume is provenance; deliver the complete selected decision below.
    }
    const name = record.text_path ?? (record.path.endsWith(".txt") ? record.path : id + ".txt");
    within(resolve(PACKAGE,"publico/fuentes"),resolve(PACKAGE,"publico/fuentes",name));
    const bytes = await readFile(resolve(PACKAGE, "publico/fuentes", name));
    const expected = record.text_sha256 ?? (record.path === name ? record.sha256 : null);
    if (!expected || sha(bytes) !== expected) throw Error("BENCHMARK_SOURCE_HASH_MISMATCH");
    sources.push({ source_id: id, title: id, url: record.url ?? "https://www.pj.gov.py/ebook/libros_files/Gaceta_Judicial_2_2011.pdf", excerpts: [{ passage_id: id + ":full", text: bytes.toString("utf8") }] });
  }
  const documents = c.turnos.slice(0, turn).flatMap(t => t.documentos);
  const text = documents.map(d => d.id + "\n" + d.texto).join("\n\n");
  const id = randomUUID();
  const job = { id, request: { command_id: id, agent_id: "gabriel", action: "PLAN", instruction: c.instruccion_comun + "\n" + c.turnos[turn - 1].pedido,
    analysis_level: level, execution_mode: "LIVE", authorize_paid_calls: true, include_library: false, max_cost_usd: 0.6 },
    context: { text, quote: text, from: 0, to: text.length, title: caseId, matter_title: "Ensayo sintético aislado", sources,
      document: { text, from: 0, to: text.length }, director_state: { analysis: null, recent_jobs: [] } } };
  // Sources are supplied as authorized review evidence, using the runtime's existing path.
  job.context.supporting_reviews = [{ sources }];
  return {job,sourceIds:[...ids]};
}
export async function prepareBenchmarkCapsule(base, { caseId = "N01", turn = 1, level = "MEDIO", history, executionId } = {}) {
  within(resolve(ROOT, ".local-dev"), base);
  if (![1, 2, 3, 4].includes(turn) || !["AGIL", "MEDIO", "PROFUNDO"].includes(level)) throw Error("BENCHMARK_INPUT_INVALID");
  // New root required: never reuse writable output, prior cases or future turns.
  await mkdir(base);
  const capsule = resolve(base, "capsule"); await mkdir(capsule);
  const scripts = ["benchmark-worker", "workspace-ai", "workspace-spend", "workspace-pricing", "workspace-context", "workspace-source-packet", "workspace-agent", "workspace-director", "workspace-specialists", "workspace-models", "workspace-auditor", "workspace-quality", "workspace-integration", "workspace-document-edits", "junta-setup"];
  const files = ["package.json", "packages/workspace/src/analysis-levels.ts", "docs/specialist-studio/contracts/SPECIALIST_CAPABILITY_PACKS.v1.json", "junta-local/config.env.example",
    ...scripts.map(s => "scripts/" + s + ".mjs")];
  for (const path of files) { await noLinks(resolve(ROOT,path)); await mkdir(dirname(resolve(capsule, path)), { recursive: true }); await cp(resolve(ROOT, path), resolve(capsule, path)); }
  for (const path of ["dist/providers", "dist/domain", "dist/citation-checker", "dist/os-app/packages/workspace/src", "node_modules/zod", "node_modules/@huggingface/tokenizers", "packages/workspace/assets/deepseek-v4-tokenizer"]) {
    await noLinks(resolve(ROOT, path)); await cp(resolve(ROOT, path), resolve(capsule, path), { recursive: true });
  }
  await cp(process.execPath, resolve(capsule, "node.exe"));
  await mkdir(resolve(capsule, ".local-dev")); await mkdir(resolve(capsule, "phase2/reports"), { recursive: true });
  await writeFile(resolve(capsule, ".env"), "OPENAI_API_KEY=offline-not-a-credential\nOPENAI_LUNA_MODEL=gpt-6-luna\nDEEPSEEK_API_KEY=offline-not-a-credential\nGEMINI_API_KEY=offline-not-a-credential\n");
  await writeFile(resolve(capsule, ".local-dev/junta-browser-approval.json"), JSON.stringify({ enabled: true, max_cost_usd: 0.6, offline_fixture_only: true }));
  await writeFile(resolve(capsule, "phase2/reports/model-connectivity-standard-prices.json"), JSON.stringify(["gpt-6-luna", "gpt-6.1-sol", "deepseek-flash", "gemini-3.8-flash"].map(model_id => ({ model_id, mode: "STANDARD", as_of_date: new Date().toISOString(), input_per_million_usd: 0.01, output_per_million_usd: 0.01, ...(['gpt-6-luna','gpt-6.1-sol'].includes(model_id) ? { long_context: { above_input_tokens:272000, input_per_million_usd:0.02, output_per_million_usd:0.015 } } : {}), synthetic_not_commercial_price: true }))));
  const {job,sourceIds}=await benchmarkSnapshot({caseId,turn,level});
  if(history) {
    job.context.director_state=history.context(executionId,caseId,level,turn);
    job.id=job.request.command_id=history.claim(executionId,turn);
  }
  const manifest = { version: 1, caseId, turn, level, offline_only: true, source_ids: sourceIds, snapshot_sha256: sha(JSON.stringify(job)), code: [] };
  async function inventoryCode(dir = "") {
    for(const name of await readdir(resolve(capsule,dir))) {
      const path=dir ? dir+"/"+name : name, info=await lstat(resolve(capsule,path));
      if(info.isSymbolicLink())throw Error("BENCHMARK_LINK_DENIED");
      if(info.isDirectory())await inventoryCode(path);
      else manifest.code.push({path,sha256:sha(await readFile(resolve(capsule,path)))});
    }
  }
  await inventoryCode();
  await writeFile(resolve(capsule, "capsule.json"), JSON.stringify(manifest, null, 2));
  return { capsule, job, manifest };
}
export async function runIsolatedBenchmark({ capsule, job, manifest }, { spend, forbidden, kernelCanary, probePort, readSavedWork }) {
  if (process.platform !== "win32") throw Error("BENCHMARK_APPCONTAINER_REQUIRED");
  if (!manifest.offline_only || sha(JSON.stringify(job)) !== manifest.snapshot_sha256) throw Error("BENCHMARK_SNAPSHOT_CHANGED");
  await noLinks(capsule);
  for(const item of manifest.code) {
    within(capsule,resolve(capsule,item.path));
    if(sha(await readFile(resolve(capsule,item.path)))!==item.sha256)throw Error("BENCHMARK_CODE_CHANGED");
  }
  spend.admit(job.id, manifest.snapshot_sha256);
  const executable = resolve(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
  return new Promise((ok, fail) => {
    const quote = s => "'" + s.replaceAll("'", "''") + "'";
    const command = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Add-Type -Path " + quote(resolve(ROOT, "scripts/benchmark-appcontainer.cs")) + "; exit [LawBenchmarkContainer]::Run(" + quote(capsule) + ")";
    const child = spawn(executable, ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")],
      { windowsHide: true, env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
        USERPROFILE: process.env.USERPROFILE, LOCALAPPDATA: process.env.LOCALAPPDATA, APPDATA: process.env.APPDATA } });
    let result, failure, attestation, diagnostics = "";
    const tickets = new Set();
    const timer = setTimeout(() => { child.kill(); fail(Error("BENCHMARK_CONTAINER_TIMEOUT")); }, 70000);
    child.stderr.on("data", b => { diagnostics = (diagnostics + b).slice(-6000); });
    createInterface({ input: child.stdout }).on("line", line => {
      let m; try { m = JSON.parse(line); } catch { diagnostics = (diagnostics + line).slice(-6000); return; }
      if (m.type === "complete") result = m;
      if (m.type === "isolation") attestation = m;
      if (m.type === "failure") failure = m.error;
      if (m.type === "ledger") {
        let value, error;
        try {
          if (m.method === "reserve") { if (m.args[0] !== job.id) throw Error("ACCESS_DENIED"); value = spend.reserve(job.id, m.args[1]); tickets.add(value); }
          else if (["settle", "unknown"].includes(m.method) && tickets.has(m.args[0])) value = spend[m.method](...m.args);
          else if(m.method==="history"&&readSavedWork)value=readSavedWork(...m.args);
          else throw Error("ACCESS_DENIED");
        } catch (e) { error = e.message; }
        child.stdin.write(JSON.stringify({ type: "reply", id: m.id, value, error }) + "\n");
      }
    });
    child.once("error", e => { clearTimeout(timer); fail(e); });
    child.once("exit", code => {
      clearTimeout(timer); child.stdin.destroy(); spend.finish(job.id);
      if (code === 0 && result && attestation?.appContainer && attestation?.capabilityCount === 0) ok({ ...result, attestation, spend: spend.snapshot(), manifest });
      else fail(Error(failure ?? "BENCHMARK_CONTAINER_FAILED:" + diagnostics));
    });
    child.stdin.on("error", () => {});
    child.stdin.write(JSON.stringify({ type: "start", job, forbidden, kernelCanary, probePort }) + "\n");
  });
}
