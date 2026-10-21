if (!process.argv.includes("--live-synthetic"))
  throw Error("EXPLICIT_LIVE_SYNTHETIC_FLAG_REQUIRED_MAX_USD_0_50");
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { runWorkspaceAI } from "./workspace-ai.mjs";
// Entirely synthetic data, no database reads, browser state or private documents.
const basisId = randomUUID();
const text =
  "CONTRATO FICTICIO DE PRUEBA. Alfa entrega diez cajas a Beta por cien unidades monetarias. El pago vence a los treinta dias. Las partes no han acordado una fecha de entrega.";
const basis = {
  job_id: basisId,
  summary:
    "Analisis ficticio ya completado. Falta plazo de entrega. El cliente descarto exigir anticipo.",
  instruction: "Revisar riesgos para Alfa sin inventar condiciones.",
  sources: [],
  findings: [
    {
      title: "Plazo de entrega ausente",
      detail: "Debe acordarse antes de firmar.",
      quote: "Las partes no han acordado una fecha de entrega.",
      source_id: "EDITOR",
      severity: "MEDIUM",
      proposal: "La fecha de entrega sera [PENDIENTE DE ACUERDO].",
      decision: "OPEN",
    },
    {
      title: "Anticipo",
      detail: "Alternativa descartada por el humano.",
      quote: "El pago vence a los treinta dias.",
      source_id: "EDITOR",
      severity: "LOW",
      proposal: "Anticipo del cincuenta por ciento.",
      decision: "DISMISSED",
    },
  ],
};
const cases = [
  {
    id: "indirect_draft",
    instruction:
      "Dejalo listo para enviarselo a Beta con lo que acordamos, sin volver a discutir lo que descarte.",
    expected: "CONTINUE",
  },
  {
    id: "explain_only",
    instruction:
      "Antes de tocar nada, explicame por que importa la fecha de entrega.",
    expected: "DIRECT",
  },
  {
    id: "new_specialty",
    instruction:
      "Nueva informacion: los operarios denuncian trabajo no registrado y la autoridad laboral abrio una inspeccion. Necesito analizar ese frente y como proteger al cliente.",
    expected: "TEAM",
  },
  {
    id: "no_changes",
    instruction:
      "No redactes ni modifiques nada todavia. Solo enumera lo que sigue pendiente de acordar.",
    expected: "DIRECT",
  },
  {
    id: "selected_fragment",
    instruction:
      "Solo reformula el fragmento seleccionado para que resulte mas claro. No cambies el plazo ni el resto del documento.",
    expected: "CONTINUE",
  },
];
let paidPosts = 0;
const checks = [];
for (const c of cases) {
  const selection =
    c.id === "selected_fragment"
      ? {
          from: text.indexOf("El pago"),
          to:
            text.indexOf("El pago") +
            "El pago vence a los treinta dias.".length,
          quote: "El pago vence a los treinta dias.",
        }
      : undefined;
  const job = {
    request: {
      command_id: randomUUID(),
      agent_id: "gabriel",
      action: "PLAN",
      workflow_version: 3,
      instruction: c.instruction,
      execution_mode: "LIVE",
      authorize_paid_calls: true,
      include_library: false,
      max_cost_usd: 0.6,
    },
    context: {
      text,
      quote: text,
      from: 0,
      to: text.length,
      title: "Contrato ficticio para evaluar el director",
      matter_title: "ENSAYO SINTETICO",
      document: { text, from: 0, to: text.length },
      ...(selection ? { selection } : {}),
      director_state: {
        analysis: basis,
        analysis_matches_current_document: true,
        recent_jobs: [
          {
            id: basisId,
            action: "ANALYZE",
            status: "COMPLETED",
            instruction: basis.instruction,
            summary: basis.summary,
            error_code: null,
          },
        ],
      },
    },
  };
  try {
    const result = await runWorkspaceAI(
      process.cwd(),
      job,
      async (url, init) => {
        if (init.method === "POST" && ++paidPosts > 10)
          throw Error("TEST_CALL_LIMIT");
        return fetch(url, init);
      },
      undefined,
      0.1,
    );
    checks.push({
      id: c.id,
      expected: c.expected,
      kind: result.team_plan?.kind,
      pass: result.team_plan?.kind === c.expected,
      agent: result.execution?.agent_id ?? result.team_plan?.lead_id,
      participants: result.team_plan?.participants?.map((p) => p.agent_id),
      scope: result.execution?.scope,
      replacement_chars: result.replacement_text?.length ?? 0,
      reply: result.summary,
    });
  } catch (e) {
    checks.push({
      id: c.id,
      pass: false,
      error: /^[A-Z_0-9]+$/.test(e.message) ? e.message : "NON_CODE_ERROR",
    });
    break;
  }
}
await writeFile(
  ".local-dev/workspace-director-synthetic-live-results.json",
  JSON.stringify(
    {
      checks,
      paidPosts,
      private_documents_sent: 0,
      documents_modified: 0,
      max_total_usd: 0.5,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    checks: checks.map(({ reply, ...r }) => r),
    paidPosts,
    private_documents_sent: 0,
    documents_modified: 0,
    max_total_usd: 0.5,
  }),
);
if (checks.length !== cases.length || checks.some((c) => !c.pass))
  process.exitCode = 1;
