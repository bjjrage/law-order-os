import { expect, it, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
// @ts-expect-error Native local host module.
import { runWorkspaceAI } from "../../scripts/workspace-ai.mjs";
import { EXPECTED_MODELS } from "../../dist/providers/config.js";
vi.mock("../../scripts/junta-setup.mjs", async () => {
  const { EXPECTED_MODELS } = await import("../../dist/providers/config.js");
  return {
    loadConfiguration: async () => ({
      env: {
        OPENAI_API_KEY: "synthetic-key-never-sent-to-network",
        OPENAI_LUNA_MODEL: EXPECTED_MODELS.luna,
      },
    }),
  };
});
it("uses the existing provider through an injected offline transport, checks citations and never retries an unknown paid outcome", async () => {
  const parent = resolve(".local-dev"),
    root = resolve(parent, "workspace-ai-test-" + randomUUID());
  expect(dirname(root)).toBe(parent);
  await mkdir(resolve(root, ".local-dev"), { recursive: true });
  await mkdir(resolve(root, "phase2/reports"), { recursive: true });
  await writeFile(
    resolve(root, ".local-dev/junta-browser-approval.json"),
    JSON.stringify({ enabled: true, max_cost_usd: 0.6 }),
  );
  await writeFile(
    resolve(root, "phase2/reports/model-connectivity-standard-prices.json"),
    JSON.stringify([
      {
        model_id: EXPECTED_MODELS.luna,
        mode: "STANDARD",
        input_per_million_usd: 0.01,
        output_per_million_usd: 0.01,
      },
    ]),
  );
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const output = {
    summary: "Respuesta sintética del transporte de prueba.",
    findings: [],
    replacement_text: "Redacción sintética.",
    references: [
      {
        source_id: "inventada",
        passage_id: "no-existe",
        quote: "Cita inexistente.",
      },
    ],
    limitations: ["Sin fuentes verificadas."],
  };
  const job = {
    request: {
      agent_id: "elena",
      action: "REWRITE",
      instruction: "Conservar condiciones y revisar redacción.",
      execution_mode: "LIVE",
      authorize_paid_calls: true,
      include_library: false,
      max_cost_usd: 0.6,
    },
    context: {
      text: "Texto sintético.",
      quote: "Texto sintético.",
      from: 1,
      to: 16,
      title: "Prueba",
      matter_title: "Prueba offline",
    },
  };
  const transport = async (url: string, init: RequestInit) => {
    if (String(url).endsWith("/input_tokens"))
      return new Response(
        JSON.stringify({
          object: "response.input_tokens",
          input_tokens: Buffer.byteLength(String(init.body)) + 2048,
        }),
      );
    calls.push({
      url,
      method: init.method!,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify(
        init.method === "GET"
          ? { id: EXPECTED_MODELS.luna }
          : {
              model: EXPECTED_MODELS.luna,
              status: "completed",
              output: [
                {
                  content: [
                    { type: "output_text", text: JSON.stringify(output) },
                  ],
                },
              ],
              usage: { input_tokens: 100, output_tokens: 100 },
            },
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const result = await runWorkspaceAI(root, job, transport);
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
    expect(calls[1]!.body.store).toBe(false);
    expect(calls[1]!.body.text.format.strict).toBe(true);
    expect(calls[1]!.body.instructions).toContain("No inventes hechos");
    expect(calls[1]!.body.instructions).toContain("civil_contractual");
    expect(result.citation_check).toEqual([
      { source_id: "inventada", quote_match: false },
    ]);
    expect(result.semantic_check).toBe("NOT_PERFORMED");
    expect(result.jev_output).toBe(false);
    let posts = 0;
    await expect(
      runWorkspaceAI(root, job, async (url: string, init: RequestInit) => {
        if (init.method === "POST") {
          posts++;
          throw Error("synthetic disconnection");
        }
        return transport(url, init);
      }),
    ).rejects.toThrow("TRANSPORT_OUTCOME_UNKNOWN");
    expect(posts).toBe(1);
    await expect(
      runWorkspaceAI(
        root,
        { ...job, request: { ...job.request, authorize_paid_calls: false } },
        transport,
      ),
    ).rejects.toThrow("EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED");
    const plan = {
      kind: "TEAM",
      continuation: null,
      reply: "Propongo revisar contrato y riesgo comercial.",
      lead_id: "elena",
      participants: [
        {
          agent_id: "elena",
          question: "Revisar obligaciones.",
          reason: "Contrato.",
          pack_id: null,
        },
        {
          agent_id: "valeria",
          question: "Revisar riesgo comercial.",
          reason: "Negocio.",
          pack_id: null,
        },
      ],
      missing_inputs: [],
    };
    const structured = {
      summary: "Integración sintética.",
      findings: [
        {
          title: "Condición a revisar",
          detail: "Revisar con el cliente.",
          quote: "Texto sintético.",
          source_id: "EDITOR",
          severity: "MEDIUM",
          proposal: "Alternativa sintética.",
        },
      ],
      replacement_text: null,
      references: [],
      limitations: ["No constituye análisis jurídico."],
    };
    const teamCalls: any[] = [];
    const fake =
      (answer: unknown) => async (url: string, init: RequestInit) => {
        if (init.method === "GET" || String(url).endsWith("/input_tokens"))
          return transport(url, init);
        teamCalls.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({
            model: EXPECTED_MODELS.luna,
            status: "completed",
            output: [
              {
                content: [
                  { type: "output_text", text: JSON.stringify(answer) },
                ],
              },
            ],
            usage: { input_tokens: 100, output_tokens: 100 },
          }),
          { status: 200 },
        );
      };
    const planned = await runWorkspaceAI(
      root,
      { ...job, request: { ...job.request, action: "PLAN" } },
      fake(plan),
    );
    expect(planned.team_plan).toEqual(plan);
    expect(planned.replacement_text).toBe(null);
    expect(teamCalls).toHaveLength(1); // Planning never runs the specialists.
    const progress: any[] = [];
    const teamJob = {
      ...job,
      request: { ...job.request, action: "ANALYZE", plan_id: randomUUID() },
      context: { ...job.context, team_plan: plan },
    };
    const integrated = await runWorkspaceAI(
      root,
      teamJob,
      fake(structured),
      async (partial: unknown) => {
        progress.push(partial);
      },
    );
    expect(teamCalls).toHaveLength(4); // Plan, two actual specialist invocations, integration.
    expect(teamCalls[1].instructions).toContain("Elena");
    expect(teamCalls[2].instructions).toContain("Valeria");
    expect(teamCalls[3].instructions).toContain("aportes reales");
    expect(integrated.team_outputs.map((p: any) => p.agent_id)).toEqual([
      "elena",
      "valeria",
    ]);
    expect(integrated.findings[0].source_id).toBe("EDITOR");
    expect(progress.at(-1).team_outputs).toHaveLength(2);
    expect(integrated.semantic_check).toBe("NOT_PERFORMED");
    expect(integrated.jev_output).toBe(false);
    let attempted = 0;
    const partials: any[] = [];
    await expect(
      runWorkspaceAI(
        root,
        teamJob,
        async (url: string, init: RequestInit) => {
          if (init.method === "POST" && ++attempted === 2)
            throw Error("synthetic connection lost");
          return fake(structured)(url, init);
        },
        async (partial: unknown) => {
          partials.push(partial);
        },
      ),
    ).rejects.toThrow("TRANSPORT_OUTCOME_UNKNOWN");
    expect(attempted).toBe(2); // No hidden retry, and integration is never started.
    expect(partials.at(-1).team_outputs).toHaveLength(1);
    expect(partials.at(-1).team_progress.active).toBe("valeria");
    await expect(
      runWorkspaceAI(
        root,
        { ...job, request: { ...job.request, action: "PLAN" } },
        fake({ ...plan, lead_id: "diego" }),
      ),
    ).rejects.toThrow("WORKSPACE_INVALID_TEAM_PLAN");
    const direct = {
      kind: "DIRECT",
      continuation: null,
      reply: "Respuesta rápida sintética de Gabriel.",
      lead_id: null,
      participants: [],
      missing_inputs: [],
    };
    const countBeforeDirect = teamCalls.length;
    const quick = await runWorkspaceAI(
      root,
      {
        ...job,
        request: {
          ...job.request,
          action: "PLAN",
          instruction: "Una pregunta rápida.",
        },
      },
      fake(direct),
    );
    expect(quick.team_plan.kind).toBe("DIRECT");
    expect(quick.summary).toBe(direct.reply);
    expect(teamCalls.length - countBeforeDirect).toBe(1);
    expect(quick.team_outputs).toBeUndefined();
    // The reported failure: a short follow-up after a larger draft, with saved
    // findings and recent conversation. Nothing is clipped to make the turn fit.
    const expandedDocument =
      "Cláusula sintética con obligaciones, cifras y reservas. ".repeat(1000);
    const rememberedFindings = Array.from({ length: 8 }, (_, i) => ({
      ...structured.findings[0],
      title: `Hallazgo ${i}`,
      decision: i ? "OPEN" : "DISMISSED",
      detail: "Detalle íntegro del riesgo y sus condiciones. ".repeat(15),
    }));
    const followupJob = {
      ...job,
      request: {
        ...job.request,
        action: "PLAN",
        workflow_version: 3,
        instruction: "vi el documento.. hay algo mas que hacer?",
      },
      context: {
        ...job.context,
        quote: expandedDocument,
        document: {
          text: expandedDocument,
          from: 0,
          to: expandedDocument.length,
        },
        director_state: {
          analysis: {
            job_id: randomUUID(),
            summary: "Revisión conservada",
            findings: rememberedFindings,
            sources: [],
          },
          analysis_matches_current_document: false,
          recent_jobs: Array.from({ length: 8 }, (_, i) => ({
            id: randomUUID(),
            action: "PLAN",
            status: "COMPLETED",
            instruction: `Turno previo ${i}`,
            summary: "Versión revisable preparada",
            error_code: null,
          })),
        },
      },
    };
    const followupStart = teamCalls.length;
    const followup = await runWorkspaceAI(root, followupJob, fake(direct));
    expect(followup.team_plan.kind).toBe("DIRECT");
    expect(teamCalls.length - followupStart).toBe(1); // Gabriel only; no team/draft.
    const followupCall = teamCalls.at(-1);
    expect(Buffer.byteLength(JSON.stringify(followupCall))).toBeGreaterThan(
      60000,
    );
    const remembered = JSON.parse(
      followupCall.input[0].content,
    ).untrusted_evidence;
    expect(remembered.context.text).toBe(expandedDocument);
    expect(remembered.work_state.analysis.findings).toEqual(rememberedFindings);
    expect(remembered.work_state.recent_jobs).toHaveLength(8);
    expect(remembered.work_state.analysis_matches_current_document).toBe(false);
    expect(remembered.question).toBe(followupJob.request.instruction);
    const fullContract =
      "Contrato completo de prueba.\n" +
      "Cláusula conservada. ".repeat(1100) +
      "\nÚLTIMA CLÁUSULA CONSERVADA.";
    const revisionJob = {
      ...job,
      request: { ...job.request, analysis_job_id: randomUUID() },
      context: {
        ...job.context,
        quote: fullContract,
        text: fullContract,
        review_basis: {
          job_id: randomUUID(),
          summary: "Hallazgos de prueba",
          findings: structured.findings.map((f) => ({
            ...f,
            decision: "DISMISSED",
          })),
          sources: [],
        },
      },
    };
    const beforeDraft = teamCalls.length;
    const draft = await runWorkspaceAI(
      root,
      revisionJob,
      fake({ ...output, replacement_text: fullContract }),
    );
    expect(draft.replacement_text).toBe(fullContract);
    expect(teamCalls).toHaveLength(beforeDraft + 1);
    const drafting = teamCalls.at(-1);
    expect(drafting.max_output_tokens).toBe(25000);
    expect(drafting.instructions).toContain("COMPLETA");
    expect(
      JSON.parse(drafting.input[0].content).untrusted_evidence.review_basis
        .findings[0].decision,
    ).toBe("DISMISSED");
    await expect(
      runWorkspaceAI(
        root,
        revisionJob,
        fake({ ...output, replacement_text: null }),
      ),
    ).rejects.toThrow("WORKSPACE_REVISION_RESULT_MISSING");
    // Interpret follow-ups through model output, never text heuristics.
    const basisId = randomUUID();
    const directorJob = {
      ...revisionJob,
      request: {
        ...job.request,
        action: "PLAN",
        workflow_version: 3,
        instruction:
          "Dejalo listo para negociar, manteniendo lo que descartamos.",
      },
      context: {
        ...job.context,
        quote: fullContract,
        document: { text: fullContract, from: 0, to: fullContract.length + 2 },
        selection: { quote: "Cláusula conservada.", from: 30, to: 49 },
        director_state: {
          analysis: { ...revisionJob.context.review_basis, job_id: basisId },
          recent_jobs: [],
        },
      },
    };
    const continuation = {
      kind: "CONTINUE",
      reply: "Valeria prepara la versión negociable sin repetir el análisis.",
      lead_id: null,
      participants: [],
      missing_inputs: [],
      continuation: {
        action: "REWRITE",
        agent_id: "valeria",
        analysis_job_id: basisId,
        scope: "DOCUMENT",
        instruction:
          "Redactar la versión negociable respetando decisiones y cifras.",
      },
    };
    const semanticCalls: any[] = [];
    const semanticTransport =
      (decision: unknown) => async (url: string, init: RequestInit) => {
        if (init.method === "GET") return transport(url, init);
        const body = JSON.parse(String(init.body));
        semanticCalls.push(body);
        return fake(
          body.text.format.schema.properties.kind
            ? decision
            : body.text.format.schema.properties.edits
              ? {
                  summary: output.summary,
                  edits: [],
                  references: output.references,
                  limitations: output.limitations,
                }
              : { ...output, replacement_text: fullContract },
        )(url, init);
      };
    const semanticProgress: any[] = [];
    const continued = await runWorkspaceAI(
      root,
      directorJob,
      semanticTransport(continuation),
      async (p: any) => {
        semanticProgress.push(p);
      },
    );
    expect(semanticCalls).toHaveLength(2);
    expect(continued.execution.agent_id).toBe("valeria");
    expect(continued.execution.analysis_job_id).toBe(basisId);
    expect(continued.replacement_text).toBe(fullContract);
    expect(continued.team_outputs).toBeUndefined();
    expect(semanticProgress[0].execution.agent_id).toBe("valeria");
    const statePacket = JSON.parse(
      semanticCalls[0].input[0].content,
    ).untrusted_evidence;
    expect(statePacket.work_state.analysis.findings[0].decision).toBe(
      "DISMISSED",
    );
    expect(semanticCalls[0].instructions).not.toContain(
      "Para analizar, redactar o revisar documentos devolvé TEAM",
    );
    expect(semanticCalls[1].instructions).toContain("Valeria");
    semanticCalls.length = 0;
    await runWorkspaceAI(
      root,
      directorJob,
      semanticTransport({
        ...continuation,
        continuation: { ...continuation.continuation, analysis_job_id: null },
      }),
    );
    const writerPacket = JSON.parse(
      semanticCalls[1].input[0].content,
    ).untrusted_evidence;
    expect(writerPacket.available_review.findings[0].decision).toBe(
      "DISMISSED",
    );
    expect(writerPacket.context.text).toBeUndefined();
    expect(writerPacket.context.document_blocks.length).toBeGreaterThan(0);
    semanticCalls.length = 0;
    // The identical message can receive DIRECT: host follows the LLM decision.
    const interpretedDirect = await runWorkspaceAI(
      root,
      directorJob,
      semanticTransport(direct),
    );
    expect(interpretedDirect.execution).toBeUndefined();
    expect(semanticCalls).toHaveLength(1);
    semanticCalls.length = 0;
    await expect(
      runWorkspaceAI(
        root,
        directorJob,
        semanticTransport({
          ...continuation,
          continuation: {
            ...continuation.continuation,
            analysis_job_id: randomUUID(),
          },
        }),
      ),
    ).rejects.toThrow("WORKSPACE_DIRECTOR_BASIS_INVALID");
    expect(semanticCalls).toHaveLength(1); // No writer call for invented references.
    semanticCalls.length = 0;
    const selected = await runWorkspaceAI(
      root,
      directorJob,
      semanticTransport({
        ...continuation,
        continuation: {
          ...continuation.continuation,
          scope: "SELECTION",
          agent_id: "martin",
        },
      }),
    );
    expect(selected.execution.agent_id).toBe("martin");
    expect(selected.execution.quote).toBe(directorJob.context.selection.quote);
    expect(selected.execution.from).toBe(directorJob.context.selection.from);
    expect(semanticCalls[1].instructions).toContain("Martín");
    semanticCalls.length = 0;
    await expect(
      runWorkspaceAI(
        root,
        {
          ...directorJob,
          context: { ...directorJob.context, selection: undefined },
        },
        semanticTransport({
          ...continuation,
          continuation: { ...continuation.continuation, scope: "SELECTION" },
        }),
      ),
    ).rejects.toThrow("WORKSPACE_DIRECTOR_SCOPE_INVALID");
    expect(semanticCalls).toHaveLength(1);
    semanticCalls.length = 0;
    await expect(
      runWorkspaceAI(
        root,
        directorJob,
        semanticTransport(continuation),
        undefined,
        0.08000001,
      ),
    ).rejects.toThrow("BUDGET_EXHAUSTED");
    expect(semanticCalls).toHaveLength(1); // Director + writer share the same ceiling.
    const beforeResume = teamCalls.length;
    const resumed = await runWorkspaceAI(
      root,
      {
        ...teamJob,
        request: {
          ...teamJob.request,
          action: "INTEGRATE",
          resume_job_id: randomUUID(),
        },
        context: {
          ...teamJob.context,
          integration_resume: {
            outputs: integrated.team_outputs,
            sources: integrated.sources,
            limitations: integrated.limitations,
          },
        },
      },
      fake(structured),
    );
    expect(teamCalls.length - beforeResume).toBe(1); // Integrator only, no specialist reruns.
    expect(resumed.team_outputs).toEqual(integrated.team_outputs);
    // A multi-block continuation must share the original integration allowance.
    await writeFile(
      resolve(root, "phase2/reports/model-connectivity-standard-prices.json"),
      JSON.stringify([
        {
          model_id: EXPECTED_MODELS.luna,
          mode: "STANDARD",
          input_per_million_usd: 1.2,
          output_per_million_usd: 0.5,
        },
      ]),
    );
    const largerPlan = {
      ...plan,
      participants: [
        ...plan.participants,
        {
          agent_id: "santiago",
          question: "Revisar objeciones.",
          reason: "Contraparte.",
        },
      ],
    };
    const largeOutputs = largerPlan.participants.map((p) => ({
      ...structured,
      agent_id: p.agent_id,
      findings: Array.from({ length: 12 }, (_, i) => ({
        title: `${p.agent_id}-${i}`,
        detail: "d".repeat(700),
        quote: "Cita pendiente " + "q".repeat(100),
        source_id: "EDITOR",
        severity: "MEDIUM",
        proposal: null,
      })),
    }));
    const budgetStart = teamCalls.length;
    await expect(
      runWorkspaceAI(
        root,
        {
          ...teamJob,
          request: {
            ...teamJob.request,
            action: "INTEGRATE",
            resume_job_id: randomUUID(),
          },
          context: {
            ...teamJob.context,
            quote: "a".repeat(21342),
            text: "a".repeat(21342),
            team_plan: largerPlan,
            integration_resume: {
              outputs: largeOutputs,
              sources: [
                {
                  source_id: "s1",
                  title: "Fuente sintética",
                  url: "",
                  excerpts: [{ passage_id: "p1", text: "b".repeat(10672) }],
                },
              ],
              limitations: [],
            },
          },
        },
        fake(structured),
      ),
    ).rejects.toThrow("BUDGET_EXHAUSTED");
    const paidAttempts = teamCalls.slice(budgetStart);
    expect(paidAttempts.length).toBeGreaterThan(0);
    expect(paidAttempts.length).toBeLessThan(3);
    const reservedUpperBound = paidAttempts.reduce(
      (sum, call) =>
        sum +
        ((Buffer.byteLength(JSON.stringify(call)) + 2048) * 1.2 + 4000 * 0.5) /
          1e6,
      0,
    );
    expect(reservedUpperBound).toBeLessThanOrEqual(0.13);
    // A conservative byte-based cost estimate must not impose another hidden cap.
    // Ask the provider for tokens before rejecting, preserving the complete input.
    const longInstruction =
      "Explicá las reservas sin modificar el documento. ".repeat(9000);
    const tokenChecks: any[] = [];
    const countedJob = {
      ...followupJob,
      request: { ...followupJob.request, instruction: longInstruction },
    };
    const countedTransport = async (url: string, init: RequestInit) => {
      if (String(url).endsWith("/input_tokens")) {
        tokenChecks.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({
            object: "response.input_tokens",
            input_tokens: 61000,
          }),
        );
      }
      return fake(direct)(url, init);
    };
    const beforeCounted = teamCalls.length;
    const counted = await runWorkspaceAI(root, countedJob, countedTransport);
    expect(counted.team_plan.kind).toBe("DIRECT");
    expect(tokenChecks).toHaveLength(1);
    expect(teamCalls.length - beforeCounted).toBe(1);
    const generated = teamCalls.at(-1);
    expect(tokenChecks[0].input).toEqual(generated.input);
    expect(tokenChecks[0].text).toEqual(generated.text);
    expect(
      JSON.parse(generated.input[0].content).untrusted_evidence.question,
    ).toBe(longInstruction);
    let overBudgetGenerations = 0;
    await expect(
      runWorkspaceAI(
        root,
        countedJob,
        async (url: string, init: RequestInit) => {
          if (String(url).endsWith("/input_tokens"))
            return new Response(
              JSON.stringify({
                object: "response.input_tokens",
                input_tokens: 200000,
              }),
            );
          if (init.method === "POST") overBudgetGenerations++;
          return fake(direct)(url, init);
        },
      ),
    ).rejects.toThrow("BUDGET_EXHAUSTED");
    expect(overBudgetGenerations).toBe(0);
    await expect(
      runWorkspaceAI(
        root,
        countedJob,
        async (url: string, init: RequestInit) => {
          if (String(url).endsWith("/input_tokens"))
            return new Response(
              JSON.stringify({
                object: "response.input_tokens",
                input_tokens: -1,
              }),
            );
          if (init.method === "POST") overBudgetGenerations++;
          return fake(direct)(url, init);
        },
      ),
    ).rejects.toThrow("INVALID_INPUT_TOKEN_COUNT");
    expect(overBudgetGenerations).toBe(0);
  } finally {
    expect(dirname(root)).toBe(parent);
    await rm(root, { recursive: true, force: true });
  }
});
