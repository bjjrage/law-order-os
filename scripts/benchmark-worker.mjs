// Runs only inside the read-only AppContainer capsule. No server, DB or shell tools.
import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { connect } from "node:net";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { runWorkspaceAI } from "./workspace-ai.mjs";
const lines = createInterface({ input: process.stdin });
const send = data => process.stdout.write(JSON.stringify(data) + "\n");
let serial = 0, started = false;
const pending = new Map();
const rpc = (method, ...args) => new Promise((ok, fail) => {
  const id = ++serial; pending.set(id, { ok, fail }); send({ type: "ledger", id, method, args });
});
const spend = { reserve: (...a) => rpc("reserve", ...a), settle: (...a) => rpc("settle", ...a), unknown: (...a) => rpc("unknown", ...a) };
const denied = async fn => { try { await fn(); return "ACCESSIBLE"; } catch (e) { return e.code ?? e.message; } };
async function run(input) {
  const probes = [];
  for (const path of input.forbidden) {
    probes.push({ kind: "absolute", result: await denied(() => readFile(path)) });
    probes.push({ kind: "relative", result: await denied(() => readFile(relative(process.cwd(), path))) });
  }
  // Valid SQLite canary readable by the host: NOTADB is not a passing result.
  // This exercises the Windows token even where Node's FS gate is bypassed.
  let kernel;
  try { const db = new DatabaseSync(input.kernelCanary, { readOnly: true }); db.prepare("SELECT * FROM canary").all(); db.close(); kernel = "ACCESSIBLE"; }
  catch (e) { kernel = e.code === "ERR_SQLITE_ERROR" ? "SQLITE_" + e.errcode : e.code; }
  probes.push({ kind: "sqlite_kernel", result: kernel });
  probes.push({ kind: "write_code", result: await denied(() => writeFile(resolve("capsule.json"), "tampered")) });
  probes.push({ kind: "spawn", result: await denied(() => new Promise((ok, fail) => { const c = spawn(process.execPath, ["-e", "0"]); c.on("error", fail); c.on("exit", ok); })) });
  const network = await new Promise(ok => {
    const s = connect({ host: "127.0.0.1", port: input.probePort });
    s.once("connect", () => { s.destroy(); ok("CONNECTED"); });
    s.once("error", e => { s.destroy(); ok(e.code); });
    s.setTimeout(1500, () => { s.destroy(); ok("TIMEOUT_NOT_PROOF"); });
  });
  const environment_clean = !Object.keys(process.env).some(k => /KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|NODE_OPTIONS/i.test(k));
  if (probes.some(p => !["ERR_ACCESS_DENIED", "EACCES", "EPERM", "SQLITE_14"].includes(p.result)) || !["EACCES", "ETIMEDOUT", "TIMEOUT_NOT_PROOF"].includes(network) || !environment_clean)
    throw Error("WORKSPACE_BENCHMARK_ISOLATION_FAILED:" + JSON.stringify({ probes, network, environment_clean }));
  let turns = 0, generations = 0;
  const transport = async (url, init) => {
    // This is a protocol fixture, never fetch(). AppContainer has no network capability.
    if (init.method === "GET") return new Response(JSON.stringify(String(url).includes("googleapis")
      ? { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1048576, outputTokenLimit: 65536 }
      : String(url).includes("deepseek") ? { data: [{ id: "deepseek-flash" }] } : { id: String(url).split('/').at(-1) }));
    if (String(url).endsWith("/input_tokens")) return new Response(JSON.stringify({ object: "response.input_tokens", input_tokens: 1000 }));
    if (String(url).endsWith(':countTokens')) return new Response(JSON.stringify({ totalTokens:1000 }));
    if (++generations > 20) throw Error("OFFLINE_FIXTURE_CALL_LIMIT");
    const raw = JSON.parse(init.body), google = String(url).includes("googleapis");
    const schema = google ? raw.generationConfig.responseJsonSchema : raw.text?.format?.schema;
    let output;
    if (raw.tools) output = turns++ === 0 ? [{ type: "function_call", name: "analyze_with_specialists", call_id: "offline-call-1", arguments: JSON.stringify({ lead_id: "elena", instruction: "Revisar obligaciones sin inventar datos.", participants:[{agent_id:'elena',pack_id:null,question:'Obligaciones',reason:'Civil'},{agent_id:'valeria',pack_id:null,question:'Cobro',reason:'Comercial'}] }) }]
      : [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Respuesta sintética offline con revisión independiente." }] }];
    else {
      const answer = schema?.properties?.outcome ? { outcome: "NO_MATERIAL_ISSUES_FOUND", summary: "Auditoría sintética.", issues: [], references: [], limitations: [] }
        : { summary: "Análisis sintético offline.", findings: [], replacement_text: null, references: [], limitations: ["Sin evaluación jurídica real."] };
      output = [{ content: [{ type: "output_text", text: JSON.stringify(answer) }] }];
    }
    return new Response(JSON.stringify(google ? { modelVersion: "gemini-3.8-flash", candidates: [{ finishReason: "STOP", content: { parts: [{ text: output[0].content[0].text }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 80, thoughtsTokenCount: 20 } }
      : { model: raw.model, status: "completed", output, usage: { input_tokens: 100, output_tokens: 100 } }));
  };
  const history=await rpc("history","list_saved_work",{before:null});
  // An unknown job ID must remain inaccessible even when owned history exists.
  let foreignHistoryDenied=false;
  try{await rpc("history","read_saved_work",{job_id:"00000000-0000-4000-8000-000000000000",part:"CONVERSATION"});}catch(e){foreignHistoryDenied=e.message==="WORKSPACE_HISTORY_NOT_FOUND";}
  if(!foreignHistoryDenied)throw Error("WORKSPACE_BENCHMARK_HISTORY_SCOPE_DENIED");
  const result = await runWorkspaceAI(process.cwd(), input.job, transport, async () => {}, 0.6, undefined,
    { benchmark: true, spend, interactionId: input.job.id,
      readSavedWork: (tool,args) => rpc("history",tool,args) });
  send({ type: "complete", probes, network, environment_clean, generations,
    actual_workflow: result.execution_profile, quality_control: result.quality_control?.status,
    specialist_count: result.specialist_bindings?.length, history_jobs:history.jobs.length,foreign_history_denied:foreignHistoryDenied,result });
}
lines.on("line", line => {
  const message = JSON.parse(line);
  if (message.type === "reply") {
    const p = pending.get(message.id); if (!p) return; pending.delete(message.id);
    message.error ? p.fail(Error(message.error)) : p.ok(message.value);
  } else if (!started && message.type === "start") {
    started = true; run(message).then(() => process.exit(0), e => { send({ type: "failure", error: e.message }); process.exit(1); });
  }
});
