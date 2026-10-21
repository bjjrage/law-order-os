import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { runWorkspaceAI } from "./workspace-ai.mjs";

// Explicit, bounded live evaluation. No database access or private documents.
if (!process.argv.includes("--live-synthetic"))
  throw Error("EXPLICIT_LIVE_SYNTHETIC_FLAG_REQUIRED_MAX_USD_0_16");
const text =
  "CONTRATO FICTICIO ALFA-BETA. La entrega depende de un plazo pendiente de acuerdo. El pago se realizará a los treinta días. Las partes deben confirmar los anexos.\n".repeat(
    250,
  );
const basisId = randomUUID();
const analysis = {
  job_id: basisId,
  summary:
    "Análisis ficticio completado. Se preparó una propuesta; quedan pendientes el plazo de entrega, los anexos y la revisión humana. No se verificaron fuentes externas.",
  instruction: "Analizar riesgos para Alfa sin inventar acuerdos.",
  sources: [],
  findings: Array.from({ length: 8 }, (_, i) => ({
    title: `Reserva ficticia ${i + 1}`,
    detail:
      "Falta confirmar con las partes este extremo. No debe darse por acordado ni por verificado. ".repeat(
        5,
      ),
    quote: "La entrega depende de un plazo pendiente de acuerdo.",
    source_id: "EDITOR",
    severity: "MEDIUM",
    proposal: "El plazo será [PENDIENTE DE ACUERDO]. ".repeat(4),
    decision: i === 0 ? "DISMISSED" : "OPEN",
  })),
};
const recent = Array.from({ length: 8 }, (_, i) => ({
  id: randomUUID(),
  action: "PLAN",
  status: "COMPLETED",
  instruction: `Seguimiento ficticio ${i + 1}: conservar las reservas y lo descartado.`,
  summary:
    "Se preparó una propuesta revisable del contrato ficticio. Los pendientes se mantienen visibles; no se certificó el contenido. ".repeat(
      5,
    ),
  error_code: null,
}));
const questions = [
  "vi el documento.. hay algo mas que hacer?",
  "No cambies el contrato ni convoques otro análisis. Quiero hablar con vos sobre el trabajo pendiente. " +
    "Mi contexto ficticio: estamos preparando una negociación, faltan confirmar los anexos y la fecha de entrega; no quiero que esos datos se inventen. ".repeat(
      20,
    ) +
    "¿Qué decisiones tengo que tomar antes de usar la propuesta? Respondeme directamente.",
];
let generations = 0,
  counts = 0;
const checks = [];
for (const question of questions) {
  let serializedBytes = 0,
    inputTokens = null,
    exactCount = null;
  const job = {
    request: {
      command_id: randomUUID(),
      agent_id: "gabriel",
      action: "PLAN",
      workflow_version: 3,
      instruction: question,
      execution_mode: "LIVE",
      authorize_paid_calls: true,
      include_library: false,
      max_cost_usd: 0.6,
    },
    context: {
      quote: text,
      text,
      from: 0,
      to: text.length,
      title: "CONTRATO FICTICIO",
      matter_title: "ENSAYO SINTÉTICO",
      document: { text, from: 0, to: text.length },
      director_state: {
        analysis,
        recent_jobs: recent,
        analysis_matches_current_document: false,
      },
    },
  };
  try {
    const result = await runWorkspaceAI(
      process.cwd(),
      job,
      async (url, init) => {
        if (String(url).endsWith("/input_tokens"))
          throw Error("UNEXPECTED_BUDGET_COUNT");
        if (init.method === "POST") {
          if (!String(url).endsWith("/v1/responses") || ++generations > 2)
            throw Error("SYNTHETIC_GENERATION_LIMIT");
          const body = JSON.parse(init.body);
          if (!body.text.format.schema.properties.kind)
            throw Error("UNEXPECTED_WRITER_CALL");
          serializedBytes = Buffer.byteLength(init.body);
          if (serializedBytes <= 60000)
            throw Error("FIXTURE_MUST_EXCEED_FORMER_BYTE_CAP");
          if (++counts > 2) throw Error("SYNTHETIC_COUNT_LIMIT");
          const { model, instructions, input, text: format } = body;
          const count = await fetch(
            "https://api.openai.com/v1/responses/input_tokens",
            {
              ...init,
              body: JSON.stringify({
                model,
                instructions,
                input,
                text: format,
              }),
            },
          );
          if (!count.ok) throw Error(`SYNTHETIC_COUNT_HTTP_${count.status}`);
          const measured = await count.json();
          if (
            measured.object !== "response.input_tokens" ||
            !Number.isInteger(measured.input_tokens)
          )
            throw Error("INVALID_COUNT");
          exactCount = measured.input_tokens;
        }
        const response = await fetch(url, init);
        if (init.method === "POST" && response.ok)
          inputTokens =
            (await response.clone().json()).usage?.input_tokens ?? null;
        return response;
      },
      undefined,
      0.08,
    );
    checks.push({
      pass:
        result.team_plan?.kind === "DIRECT" &&
        !result.replacement_text &&
        !result.execution,
      kind: result.team_plan?.kind,
      instruction_chars: question.length,
      serialized_bytes: serializedBytes,
      counted_input_tokens: exactCount,
      generation_input_tokens: inputTokens,
      reply: result.summary,
    });
  } catch (e) {
    checks.push({
      pass: false,
      error: /^[A-Z_0-9]+$/.test(e.message) ? e.message : "NON_CODE_ERROR",
      serialized_bytes: serializedBytes,
    });
    break;
  }
}
const report = {
  checks,
  generations,
  counts,
  max_total_usd: 0.16,
  private_documents_sent: 0,
  documents_modified: 0,
};
await writeFile(
  ".local-dev/workspace-conversation-synthetic-results.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    ...report,
    checks: checks.map(({ reply, ...evidence }) => evidence),
  }),
);
if (checks.length !== questions.length || checks.some((c) => !c.pass))
  process.exitCode = 1;
