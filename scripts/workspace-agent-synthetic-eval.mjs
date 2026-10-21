import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { runWorkspaceAI } from "./workspace-ai.mjs";
import { documentBlocks } from "./workspace-document-edits.mjs";
if (!process.argv.includes("--live-synthetic"))
  throw Error("EXPLICIT_SYNTHETIC_FLAG_REQUIRED_MAX_USD_0_30");
// Fiction only. No database reads, browser state, private documents or mutations.
const text =
  "CONTRATO FICTICIO ENTRE ALFA Y BETA\n\nAlfa suministrará diez cajas a Beta por mil unidades monetarias. El pago vence a los treinta días.\n\nLas partes no han acordado la fecha de entrega ni el contenido de los anexos. Los pedidos de Beta se incorporarán al contrato sin prever aceptación expresa de Alfa.\n\nNo existen otros acuerdos conocidos en este ensayo ficticio.";
const saved = new Map(),
  checks = [];
let posts = 0;
const questions = [
  "Nuestro cliente ficticio es Alfa. Analizá este contrato desde los aspectos contractuales y comerciales: elegí y consultá los especialistas pertinentes. Después prepará una versión con los hallazgos, conservando el precio y el pago. Los datos no acordados deben quedar como [PENDIENTE DE ACUERDO]. Hacé ambas tareas en este pedido.",
  "Vi esa propuesta pero todavía no la apliqué. No hagas modificaciones ni encargues tareas ahora. Explicame brevemente qué queda pendiente antes de usarla.",
  "De la versión que me preparaste antes y que todavía no apliqué, cambiá el plazo de pago a cuarenta y cinco días, como nueva instrucción del cliente para negociar. Conservá las otras mejoras de esa propuesta. Preparame ese ajuste sin repetir el análisis.",
];
for (let stage = 0; stage < questions.length; stage++) {
  const analyzed = [...saved.values()].find((j) => j.result.findings.length);
  const basis = analyzed
    ? {
        job_id: analyzed.id,
        summary: analyzed.result.summary,
        instruction: analyzed.request.instruction,
        findings: analyzed.result.findings.map((f) => ({
          ...f,
          decision: "OPEN",
        })),
        sources: analyzed.result.sources,
      }
    : null;
  const job = {
    id: randomUUID(),
    room_id: randomUUID(),
    request: {
      command_id: randomUUID(),
      action: "PLAN",
      agent_id: "gabriel",
      workflow_version: 4,
      instruction: questions[stage],
      execution_mode: "LIVE",
      authorize_paid_calls: true,
      include_library: false,
      max_cost_usd: 0.6,
    },
    context: {
      text,
      quote: text,
      from: 0,
      to: text.length + 2,
      title: "CONTRATO FICTICIO",
      matter_title: "ENSAYO SINTÉTICO",
      document: { text, from: 0, to: text.length + 2 },
      director_state: {
        analysis: basis,
        analysis_matches_current_document: true,
        recent_jobs: [...saved.values()].reverse().map((j) => ({
          id: j.id,
          action: "PLAN",
          status: "COMPLETED",
          instruction: j.request.instruction,
          summary: j.result.summary,
          error_code: null,
          has_proposal: !!j.result.replacement_text,
        })),
      },
    },
  };
  const decisions = [],
    writerInputs = [];
  try {
    const result = await runWorkspaceAI(
      process.cwd(),
      job,
      async (url, init) => {
        if (init.method === "POST" && String(url).endsWith("/responses")) {
          if (++posts > 25) throw Error("SYNTHETIC_CALL_LIMIT");
          const body = JSON.parse(init.body);
          if (body.text?.format?.schema?.properties?.edits)
            writerInputs.push(
              JSON.parse(body.input[0].content).untrusted_evidence.context
                .document_blocks,
            );
        }
        const response = await fetch(url, init);
        if (
          init.method === "POST" &&
          response.ok &&
          String(url).endsWith("/responses")
        ) {
          const value = await response.clone().json();
          for (const call of value.output ?? [])
            if (call.type === "function_call")
              decisions.push({
                name: call.name,
                args: JSON.parse(call.arguments),
              });
        }
        return response;
      },
      undefined,
      0.1,
      undefined,
      {
        readSavedWork: async (name, args) => {
          if (name === "list_saved_work")
            return {
              jobs: [...saved.values()].map((j) => ({
                id: j.id,
                summary: j.result.summary,
                has_proposal: !!j.result.replacement_text,
              })),
              next_before: null,
            };
          const source = saved.get(args.job_id);
          if (!source) throw Error("WORKSPACE_HISTORY_NOT_FOUND");
          if (args.part === "PROPOSAL")
            return {
              job_id: source.id,
              summary: source.result.summary,
              scope: source.result.execution?.scope ?? "DOCUMENT",
              replacement_text: source.result.replacement_text,
              limitations: source.result.limitations,
            };
          if (args.part === "ANALYSIS")
            return {
              analysis: {
                job_id: source.id,
                summary: source.result.summary,
                findings: source.result.findings.map((f) => ({
                  ...f,
                  decision: "OPEN",
                })),
                sources: source.result.sources,
              },
            };
          return {
            job_id: source.id,
            instruction: source.request.instruction,
            summary: source.result.summary,
            status: "COMPLETED",
          };
        },
      },
    );
    const first = [...saved.values()].find((j) => j.result.replacement_text);
    const basedOnProposal =
      stage !== 2 ||
      (decisions.some(
        (d) =>
          d.name === "prepare_document" && d.args.proposal_job_id === first?.id,
      ) &&
        writerInputs.some(
          (blocks) =>
            JSON.stringify(blocks) ===
            JSON.stringify(
              documentBlocks(first.result.replacement_text).map(
                ({ id, text }) => ({ id, text }),
              ),
            ),
        ));
    const pass =
      stage === 0
        ? !!result.replacement_text &&
          result.findings.length > 0 &&
          decisions.some((d) =>
            ["analyze_with_specialists", "consult_specialist"].includes(d.name),
          )
        : stage === 1
          ? decisions.length === 0 && !result.replacement_text
          : !!result.replacement_text &&
            basedOnProposal &&
            !decisions.some((d) =>
              ["analyze_with_specialists", "consult_specialist"].includes(
                d.name,
              ),
            );
    checks.push({
      stage: stage + 1,
      pass,
      tools: decisions.map((d) => d.name),
      decisions,
      trace: result.agent_trace,
      specialists: result.team_outputs?.map((o) => o.agent_id) ?? [],
      findings: result.findings.length,
      proposal_chars: result.replacement_text?.length ?? 0,
      based_on_unapplied_proposal: stage === 2 ? basedOnProposal : undefined,
      reply: result.summary,
    });
    saved.set(job.id, { ...job, result });
    if (!pass) break;
  } catch (error) {
    checks.push({
      stage: stage + 1,
      pass: false,
      error: /^[A-Z_0-9]+$/.test(error.message)
        ? error.message
        : "NON_CODE_ERROR",
      tools: decisions.map((d) => d.name),
    });
    break;
  }
}
const report = {
  checks,
  generation_posts: posts,
  max_total_usd: 0.3,
  private_documents_sent: 0,
  documents_modified: 0,
};
await writeFile(
  ".local-dev/workspace-agent-synthetic-results.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    ...report,
    checks: checks.map(({ reply, decisions, trace, ...r }) => r),
  }),
);
if (checks.length !== 3 || checks.some((c) => !c.pass)) process.exitCode = 1;
