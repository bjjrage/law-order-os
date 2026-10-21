import { expect, it, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
// @ts-expect-error Native local host module.
import { runWorkspaceAI } from "../../scripts/workspace-ai.mjs";
import { EXPECTED_MODELS } from "../../dist/providers/config.js";
import { hasWorkspaceAnalysis } from "../../packages/workspace/src/tasks.js";
import { analysisLevels } from "../../packages/workspace/src/analysis-levels.js";
// @ts-expect-error Native durable benchmark ledger.
import { WorkspaceSpend } from "../../scripts/workspace-spend-store.mjs";
const selectedProvider = vi.hoisted(() => ({} as Record<string, string>));
vi.mock("../../scripts/junta-setup.mjs", () => ({
  loadConfiguration: async () => ({
    env: {
      OPENAI_API_KEY: "synthetic-not-a-real-key",
      OPENAI_LUNA_MODEL: "gpt-6-luna",
      DEEPSEEK_API_KEY: "synthetic-deepseek-key",
      GEMINI_API_KEY: "synthetic-google-key",
      GEMINI_AUDITOR_MODEL: "gemini-3.8-flash",
      ...selectedProvider,
    },
  }),
}));
const doc = "Cláusula uno.\n\nCláusula dos.";
it("blocks benchmark transport at the durable global ceiling before any provider request", async () => {
  await fixture(async (root, job) => {
    const spend = new WorkspaceSpend(resolve(root,".local-dev/spend.sqlite"));
    spend.initialize(0.001); spend.admit(job.id,"fixture");
    let requests=0;
    try {
      await expect(runWorkspaceAI(root,job,async()=>{requests++;throw Error("UNEXPECTED_TRANSPORT");},undefined,0.6,undefined,
        {benchmark:true,spend,interactionId:job.id})).rejects.toThrow("BUDGET_EXHAUSTED");
      expect(requests).toBe(0);expect(spend.snapshot().retained_usd).toBe(0);
      await expect(runWorkspaceAI(root,{...job,request:{...job.request,include_library:true}},async()=>{},undefined,0.6,undefined,
        {benchmark:true,spend,interactionId:job.id})).rejects.toThrow("WORKSPACE_BENCHMARK_SCOPE_DENIED");
    } finally {spend.close();}
  });
});
it("shares management tools with workspace Gabriel and preserves server denials as conversation results", async () => {
  await fixture(async (root, job) => {
    const calls: any[] = [],
      executed: any[] = [];
    const result = await runWorkspaceAI(
      root,
      job,
      transportFor(
        [
          tool("study_work", { team: false, matter_id: null }),
          tool("assign_task", {
            mode: "CREATE",
            matter_id: "case",
            task_id: null,
            title: "Trabajo",
            responsible_identity_id: "other-lawyer",
            due_at: null,
            expected_revision: null,
          }),
          "Necesitás solicitar la intervención a Dirección; no se asignó la tarea.",
        ],
        calls,
      ),
      async () => {},
      0.6,
      undefined,
      {
        manageTool: async (name: string, args: any, callId: string) => {
          executed.push({ name, args, callId });
          return name === "study_work"
            ? { ok: true, data: { role: "LAWYER", tasks: [] } }
            : { ok: false, error: "DIRECTOR_REQUIRED" };
        },
      },
    );
    expect(executed.map((c) => c.name)).toEqual(["study_work", "assign_task"]);
    expect(result.agent_trace.at(-1).status).toBe("REJECTED");
    expect(result.replacement_text).toBeNull();
    expect(calls[0].tools.some((t: any) => t.name === "assign_review")).toBe(
      true,
    );
    expect(calls[0].instructions).toContain("sesión actual");
    expect(JSON.stringify(calls.at(-1).input)).toContain("DIRECTOR_REQUIRED");
  });
});
it("retains a completed analysis even with zero findings or a later task failure", () => {
  const job: any = {
    request: { action: "PLAN", workflow_version: 4 },
    status: "FAILED",
    result: {
      findings: [],
      team_outputs: [],
      agent_trace: [{ tool: "analyze_with_specialists", status: "COMPLETED" }],
    },
  };
  expect(hasWorkspaceAnalysis(job)).toBe(true);
  expect(hasWorkspaceAnalysis({ ...job, status: "COMPLETED" })).toBe(true);
  expect(
    hasWorkspaceAnalysis({
      ...job,
      result: {
        ...job.result,
        agent_trace: [{ tool: "analyze_with_specialists", status: "RUNNING" }],
      },
    }),
  ).toBe(false);
});
const answer = {
  summary: "Hay que acordar el plazo.",
  findings: [
    {
      title: "Plazo",
      detail: "Debe acordarse.",
      quote: "Cláusula uno.",
      source_id: "EDITOR",
      severity: "MEDIUM",
      proposal: "Cláusula uno revisada.",
    },
  ],
  replacement_text: null,
  references: [],
  limitations: ["Sin verificación jurídica."],
};
it("keeps Gabriel on Luna, authors on DeepSeek and independent reviews on Gemini", async () => {
  Object.assign(selectedProvider, { WORKSPACE_ANALYSIS_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "synthetic-deepseek-key" });
  try {
    await fixture(async (root, job) => {
      const calls: any[] = [], endpoints: string[] = [];
      const transport = transportFor([
        tool("consult_specialist", { agent_id: "elena", instruction: "Analizar obligaciones", scope: "DOCUMENT", analysis_job_id: null }),
        "El análisis quedó disponible con sus controles.",
      ], calls);
      const result = await runWorkspaceAI(root, job, async (url: string, init: RequestInit) => {
        const headers = init.headers as Record<string, string>;
        if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
          expect(headers['x-goog-api-key']).toBe('synthetic-google-key');
          expect(headers.Authorization).toBeUndefined();
        } else expect(headers.Authorization).toBe(String(url).startsWith("https://api.deepseek.com/") ? "Bearer synthetic-deepseek-key" : "Bearer synthetic-not-a-real-key");
        endpoints.push(String(url));
        return transport(url, init);
      });
      expect(calls.filter(c => c.tools).every(c => c.model === "gpt-6-luna" && c.reasoning.effort === "xhigh")).toBe(true);
      expect(calls.filter(c => !c.tools)).toHaveLength(3);
      expect(calls.filter(c => c.model === "deepseek-flash")).toHaveLength(1);
      expect(calls.filter(c => c.model === "gemini-3.8-flash")).toHaveLength(2);
      expect(calls.filter(c => c.model === "gemini-3.8-flash").every(c => !JSON.stringify(c).includes('opaque-synthetic-state'))).toBe(true);
      expect(result.quality_control.model_id).toBe("gemini-3.8-flash");
      expect(result.specialist_bindings[0].model_id).toBe("deepseek-flash");
      expect(endpoints.some(p => p === "https://api.openai.com/v1/responses/input_tokens")).toBe(false);
    });
  } finally {
    for (const key of Object.keys(selectedProvider)) delete selectedProvider[key];
  }
});
const tool = (name: string, args: unknown) => ({ name, args });
it("falls back to Luna xhigh when Gemini credentials are missing, recording the actual auditor", async () => {
  Object.assign(selectedProvider, { WORKSPACE_ANALYSIS_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'synthetic-deepseek-key', GEMINI_API_KEY: '' });
  try {
    await fixture(async (root, job) => {
      const calls: any[] = [];
      const transport = transportFor([tool('consult_specialist', { agent_id: 'elena', instruction: 'Revisar el documento', scope: 'DOCUMENT', analysis_job_id: null }), 'El resultado conserva sus controles.'], calls);
      const result = await runWorkspaceAI(root, job, transport);
      expect(calls.filter(c => c.model === 'deepseek-flash')).toHaveLength(1);
      expect(calls.filter(c => c.model === 'gemini-3.8-flash')).toHaveLength(0);
      const audits = calls.filter(c => !c.tools && c.model === 'gpt-6-luna');
      expect(audits).toHaveLength(2);
      expect(audits.every(c => c.reasoning.effort === 'xhigh')).toBe(true);
      expect(result.quality_control.model_id).toBe('gpt-6-luna');
      expect(result.quality_control.audit_attempts[0]).toMatchObject({ fallback_from: 'gemini-3.8-flash', fallback_reason: 'MISSING_GEMINI_AUDITOR_CREDENTIAL' });
    });
  } finally {
    for (const key of Object.keys(selectedProvider)) delete selectedProvider[key];
  }
});
it('keeps failed Gemini reservations in the shared budget before attempting Luna fallback', async () => {
  Object.assign(selectedProvider, { WORKSPACE_ANALYSIS_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'synthetic-deepseek-key' });
  try {
    await fixture(async (root, job) => {
      // A direct worker avoids a director's separate reservation. It can afford
      // the author and primary audit, but not a second audit after an outage.
      job.request = { ...job.request, action: 'ANALYZE', agent_id: 'elena' };
      job.context.generated_from_director = true;
      await writeFile(resolve(root, 'phase2/reports/model-connectivity-standard-prices.json'), JSON.stringify(
        ['deepseek-flash', 'gemini-3.8-flash', 'gpt-6-luna'].map(model_id => ({ model_id, mode: 'STANDARD', as_of_date: new Date().toISOString(), input_per_million_usd: 0, output_per_million_usd: 1, ...(model_id==='gpt-6-luna'?{long_context:{above_input_tokens:272000,input_per_million_usd:0,output_per_million_usd:1.5}}:{}) }))
      ));
      const calls: any[] = [];
      const ledger = { remaining: 0.01605 };
      let primaryAttempts = 0;
      const base = transportFor([], calls);
      await expect(runWorkspaceAI(root, job, async (url: string, init: RequestInit) => {
        if (init.method === 'POST' && String(url).endsWith(':generateContent')) {
          primaryAttempts++;
          return new Response('{}', { status: 503 });
        }
        return base(url, init);
      }, async () => {}, 0.01605, ledger)).rejects.toThrow('BUDGET_EXHAUSTED');
      expect(primaryAttempts).toBe(1);
      expect(calls.filter(c => c.model === 'gpt-6-luna')).toHaveLength(0);
      expect(ledger.remaining).toBeCloseTo(0.00795);
    });
  } finally {
    for (const key of Object.keys(selectedProvider)) delete selectedProvider[key];
  }
});
it('finishes through Luna after a Gemini outage, with corrections authored by DeepSeek and re-audited', async () => {
  Object.assign(selectedProvider, { WORKSPACE_ANALYSIS_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'synthetic-deepseek-key' });
  try {
    await fixture(async (root, job) => {
      const calls: any[] = [];
      let primaryAttempts = 0, fallbackAudits = 0;
      const base = transportFor([tool('consult_specialist', { agent_id: 'elena', instruction: 'Revisar el documento', scope: 'DOCUMENT', analysis_job_id: null }), 'La propuesta conserva los controles.'], calls);
      const result = await runWorkspaceAI(root, job, async (url: string, init: RequestInit) => {
        if (init.method === 'POST' && String(url).endsWith(':generateContent')) {
          primaryAttempts++;
          return new Response('{}', { status: 503 });
        }
        const response = await base(url, init);
        const body = init.method === 'POST' ? JSON.parse(String(init.body)) : null;
        if (body?.model === 'gpt-6-luna' && body.text?.format?.schema?.properties?.outcome && ++fallbackAudits === 1) {
          const value = await response.json();
          const audit = JSON.parse(value.output[0].content[0].text);
          audit.outcome = 'CHANGES_REQUIRED';
          value.output[0].content[0].text = JSON.stringify(audit);
          return new Response(JSON.stringify(value));
        }
        return response;
      });
      expect(primaryAttempts).toBe(3);
      expect(fallbackAudits).toBe(3);
      expect(calls.filter(c => c.model === 'deepseek-flash')).toHaveLength(2);
      expect(result.quality_control).toMatchObject({ model_id: 'gpt-6-luna', status: 'CONTROLLED_DRAFT' });
      expect(result.quality_control.audit_attempts[0]).toMatchObject({ reasoning_effort: 'xhigh', fallback_from: 'gemini-3.8-flash', fallback_reason: 'PROVIDER_HTTP_503' });
    });
  } finally {
    for (const key of Object.keys(selectedProvider)) delete selectedProvider[key];
  }
});
it.each(["AGIL", "MEDIO", "PROFUNDO"] as const)("%s sends corrections back to its analyst and re-audits with independent Gemini", async (level) => {
  Object.assign(selectedProvider, { WORKSPACE_ANALYSIS_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'synthetic-deepseek-key' });
  try {
    await fixture(async (root, job) => {
      job.request.analysis_level = level;
      const calls: any[] = [];
      const transport = transportFor([tool('consult_specialist', { agent_id: 'elena', instruction: 'Revisar el documento', scope: 'DOCUMENT', analysis_job_id: null }), 'La propuesta corregida conserva sus controles.'], calls);
      let audits = 0;
      const result = await runWorkspaceAI(root, job, async (url: string, options: RequestInit) => {
        const response = await transport(url, options);
        if (options.method === 'POST' && String(url).endsWith(':generateContent') && ++audits === 1) {
          const value = await response.json();
          const audit = JSON.parse(value.candidates[0].content.parts[0].text);
          audit.outcome = 'CHANGES_REQUIRED';
          value.candidates[0].content.parts[0].text = JSON.stringify(audit);
          return new Response(JSON.stringify(value));
        }
        return response;
      });
      expect(calls.filter(c => c.model === analysisLevels[level].model)).toHaveLength(2);
      expect(calls.filter(c => c.model === 'gemini-3.8-flash')).toHaveLength(3);
      expect(result.quality_control.model_id).toBe('gemini-3.8-flash');
      expect(result.quality_control.status).toBe('CONTROLLED_DRAFT');
    });
  } finally {
    for (const key of Object.keys(selectedProvider)) delete selectedProvider[key];
  }
});
async function fixture(work: (root: string, job: any) => Promise<void>) {
  const root = resolve(".local-dev", "agent-test-" + randomUUID());
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
        mode: "STANDARD", as_of_date: new Date().toISOString(),
        input_per_million_usd: 0.1,
        output_per_million_usd: 0.5,
        long_context: { above_input_tokens:272000, input_per_million_usd:0.2, output_per_million_usd:0.75 },
      },
      { model_id: "gpt-6.1-sol", mode: "STANDARD", as_of_date: new Date().toISOString(), input_per_million_usd: 2, output_per_million_usd: 10, long_context:{above_input_tokens:272000,input_per_million_usd:4,output_per_million_usd:15} },
      { model_id: "deepseek-flash", mode: "STANDARD", as_of_date: new Date().toISOString(), input_per_million_usd: 0.3, output_per_million_usd: 1.2 },
      { model_id: "gemini-3.8-flash", mode: "STANDARD", as_of_date: new Date().toISOString(), input_per_million_usd: 0.75, output_per_million_usd: 3.75 },
    ]),
  );
  const job = {
    id: randomUUID(),
    request: {
      action: "PLAN",
      agent_id: "gabriel",
      instruction:
        "Analizá el contrato y después prepará una versión con los hallazgos.",
      workflow_version: 4,
      execution_mode: "LIVE",
      authorize_paid_calls: true,
      include_library: false,
      max_cost_usd: 0.6,
    },
    context: {
      text: doc,
      quote: doc,
      from: 0,
      to: doc.length + 2,
      title: "Ficticio",
      matter_title: "Ficticio",
      document: { text: doc, from: 0, to: doc.length + 2 },
      director_state: { analysis: null, recent_jobs: [] },
    },
  };
  try {
    await work(root, job);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function transportFor(
  decisions: any[],
  calls: any[],
  inspect?: (body: any) => void,
) {
  let turn = 0;
  return async (url: string, init: RequestInit) => {
    const google = String(url).startsWith("https://generativelanguage.googleapis.com/");
    if (init.method === "GET")
      return new Response(JSON.stringify(google ? { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576, outputTokenLimit: 65536 } : String(url).startsWith("https://api.deepseek.com/") ? { data: [{ id: "deepseek-flash" }] } : { id: String(url).split('/').at(-1) }));
    const raw = JSON.parse(String(init.body));
    const body = google ? { ...raw, model: 'gemini-3.8-flash', text: { format: { schema: raw.generationConfig.responseJsonSchema } }, input: [{ role: 'user', content: raw.contents[0].parts[0].text }] } : raw;
    expect(String(url)).toBe(google ? "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent" : body.model === "deepseek-flash" ? "https://api.deepseek.com/responses" : "https://api.openai.com/v1/responses");
    calls.push(body);
    inspect?.(body);
    let output;
    if (body.tools) {
      const decision = decisions[turn++];
      if (typeof decision === "string")
        output = [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: decision }],
          },
        ];
      else {
        expect(decision).toBeDefined();
        output = [
          {
            type: "reasoning",
            id: "rs_synthetic_" + turn,
            summary: [],
            encrypted_content: "opaque-synthetic-state",
          },
          {
            type: "function_call",
            name: decision.name,
            call_id: "call_" + turn,
            arguments: JSON.stringify(decision.args),
          },
        ];
      }
    } else {
      const value = body.text.format.schema.properties.outcome
        ? {
            outcome: "NO_MATERIAL_ISSUES_FOUND",
            summary: "Revisión sintética sin problemas materiales.",
            issues: [],
            references: [],
            limitations: [],
          }
        : body.text.format.schema.properties.edits
          ? {
              summary: "Versión preparada",
              edits: [
                { block_id: "B1", replacement_text: "Cláusula uno revisada." },
              ],
              references: [],
              limitations: answer.limitations,
            }
          : answer;
      output = [
        { content: [{ type: "output_text", text: JSON.stringify(value) }] },
      ];
    }
    return new Response(
      JSON.stringify(google ? {
        modelVersion: 'gemini-3.8-flash',
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: output[0]!.content![0]!.text }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 80, thoughtsTokenCount: 20 },
      } : {
        model: body.model,
        status: "completed",
        output,
        usage: { input_tokens: 100, output_tokens: 100 },
      }),
    );
  };
}
it.each(["AGIL", "MEDIO", "PROFUNDO"] as const)("%s uses the same specialist, integration, independent audit, checker and drafting flow", async (level) => {
  await fixture(async (root, job) => {
    job.request.analysis_level = level;
    const calls: any[] = [],
      progress: any[] = [];
    const plan = {
      instruction: "Examinar riesgos y alternativas.",
      lead_id: "elena",
      participants: [
        {
          agent_id: "elena",
          question: "Revisar obligaciones.",
          reason: "Contrato.",
        },
        {
          agent_id: "valeria",
          question: "Revisar riesgo comercial.",
          reason: "Negocio.",
        },
      ],
    };
    const result = await runWorkspaceAI(
      root,
      job,
      transportFor(
        [
          tool("analyze_with_specialists", plan),
          tool("prepare_document", {
            agent_id: "valeria",
            instruction: "Incorporar los hallazgos sin inventar acuerdos.",
            action: "REWRITE",
            scope: "DOCUMENT",
            analysis_job_id: job.id,
            proposal_job_id: null,
          }),
          "Analicé el caso y preparé la versión revisable. El plazo sigue pendiente de acuerdo.",
        ],
        calls,
      ),
      async (p: any) => progress.push(structuredClone(p)),
    );
    expect(calls.filter((c) => c.tools)).toHaveLength(3);
    expect(calls[0].instructions).not.toContain(
      "Devuelve únicamente el contrato JSON solicitado",
    );
    expect(calls.filter((c) => !c.tools)).toHaveLength(9); // Work, independent reviews and exact final-response review.
    expect(result.agent_trace.map((t: any) => [t.tool, t.status])).toEqual([
      ["analyze_with_specialists", "COMPLETED"],
      ["prepare_document", "COMPLETED"],
    ]);
    expect(result.team_outputs.map((o: any) => o.agent_id)).toEqual([
      "elena",
      "valeria",
    ]);
    expect(result.findings).toEqual(answer.findings);
    expect(result.replacement_text).toBe(
      "Cláusula uno revisada.\n\nCláusula dos.",
    );
    expect(result.execution.quote).toBe(doc);
    const nextTurn = calls.filter((c) => c.tools)[1];
    expect(
      nextTurn.input.some(
        (i: any) =>
          i.type === "reasoning" &&
          i.encrypted_content === "opaque-synthetic-state",
      ),
    ).toBe(true);
    expect(
      nextTurn.input.some(
        (i: any) =>
          i.type === "function_call_output" &&
          JSON.parse(i.output).untrusted_tool_result.findings[0].title ===
            "Plazo",
      ),
    ).toBe(true);
    const writer = calls.find((c) => c.text?.format.schema.properties.edits);
    expect(
      JSON.parse(writer.input[0].content).untrusted_evidence.review_basis
        .job_id,
    ).toBe(job.id);
    expect(
      progress.some(
        (p) =>
          p.agent_trace?.[0]?.status === "COMPLETED" && p.findings.length === 1,
      ),
    ).toBe(true);
    expect(result.jev_output).toBe(false);
    expect(calls.every((c) => c.text?.format.schema.properties.outcome
      ? c.model === "gemini-3.8-flash"
      : c.model === (c.tools ? "gpt-6-luna" : analysisLevels[level].model))).toBe(true);
    expect(calls.filter(c => c.model === analysisLevels[level].model).every(c => c.reasoning.effort === analysisLevels[level].effort)).toBe(true);
    expect(result.execution_profile).toEqual({ workflow: "legal-unified-v1", level, analyst_model: analysisLevels[level].model, reasoning_effort: analysisLevels[level].effort, auditor_model: "gemini-3.8-flash" });
    expect(result.specialist_bindings.map((b: any) => b.pack_id)).toContain(
      "civil_contractual",
    );
    expect(
      result.quality_control.checked_outputs.map((o: any) => o.id),
    ).toContain("AUDITOR");
  });
});
it("returns a rejected selection as tool feedback so Gabriel can correct its scope without asking the human to navigate buttons", async () => {
  await fixture(async (root, job) => {
    const calls: any[] = [];
    const args = {
      agent_id: "elena",
      instruction: "Ajustar solo la primera cláusula conservando el resto.",
      action: "REWRITE",
      scope: "SELECTION",
      analysis_job_id: null,
      proposal_job_id: null,
    };
    const result = await runWorkspaceAI(
      root,
      job,
      transportFor(
        [
          tool("prepare_document", args),
          tool("prepare_document", { ...args, scope: "DOCUMENT" }),
          "Preparé el cambio de la cláusula.",
        ],
        calls,
      ),
    );
    expect(result.agent_trace.map((t: any) => t.status)).toEqual([
      "REJECTED",
      "COMPLETED",
    ]);
    const feedback = JSON.parse(
      calls
        .filter((c) => c.tools)[1]
        .input.find((i: any) => i.type === "function_call_output").output,
    ).untrusted_tool_result;
    expect(feedback.error).toBe("WORKSPACE_DIRECTOR_SCOPE_INVALID");
    expect(feedback.has_selection).toBe(false);
    expect(calls.filter((c) => !c.tools)).toHaveLength(3);
  });
});
it("preserves separate specialist contributions and the prior review while preparing a subsequent proposal", async () => {
  await fixture(async (root, job) => {
    const oldId = randomUUID(),
      calls: any[] = [];
    job.context.director_state.analysis = {
      job_id: oldId,
      summary: "Análisis anterior",
      findings: [{ ...answer.findings[0], decision: "DISMISSED" }],
      sources: [],
    };
    const consult = {
      instruction: "Aportar la perspectiva pedida.",
      scope: "DOCUMENT",
      analysis_job_id: oldId,
    };
    await runWorkspaceAI(
      root,
      job,
      transportFor(
        [
          tool("consult_specialist", { ...consult, agent_id: "elena" }),
          tool("consult_specialist", {
            ...consult,
            agent_id: "valeria",
            analysis_job_id: job.id,
          }),
          tool("prepare_document", {
            agent_id: "elena",
            instruction: "Usar ambos aportes respetando el descarte anterior.",
            action: "REWRITE",
            scope: "DOCUMENT",
            analysis_job_id: job.id,
            proposal_job_id: null,
          }),
          "Propuesta preparada con ambos aportes.",
        ],
        calls,
      ),
    );
    const writer = calls.find((c) => c.text?.format.schema.properties.edits);
    const packet = JSON.parse(writer.input[0].content).untrusted_evidence;
    expect(packet.review_basis.findings).toHaveLength(2);
    expect(packet.supporting_reviews[0].findings[0].decision).toBe("DISMISSED");
  });
});
it("charges director and delegated calls against one shared allowance", async () => {
  await fixture(async (root, job) => {
    const calls: any[] = [];
    const transport = transportFor(
      [
        tool("consult_specialist", {
          agent_id: "elena",
          instruction: "Revisar obligaciones.",
          scope: "DOCUMENT",
          analysis_job_id: null,
        }),
      ],
      calls,
    );
    await expect(
      runWorkspaceAI(
        root,
        job,
        async (url: string, init: RequestInit) =>
          String(url).endsWith("/input_tokens")
            ? new Response(
                JSON.stringify({
                  object: "response.input_tokens",
                  input_tokens: 1000,
                }),
              )
            : transport(url, init),
        undefined,
        0.005, // Covers the director's xhigh output allowance, but not a worker.
      ),
    ).rejects.toThrow("BUDGET_EXHAUSTED");
    expect(calls).toHaveLength(1);
    expect(calls[0].tools).toBeDefined();
  });
});
it("continues a saved, unapplied proposal as its editing base and can answer the following message without delegating", async () => {
  await fixture(async (root, job) => {
    const prior = randomUUID(),
      calls: any[] = [],
      reads: any[] = [];
    const proposal =
      "Cláusula uno: versión todavía no aplicada.\n\nCláusula dos.";
    job.request.instruction =
      "De esa versión, ajustá solo el primer punto. Después contame qué falta.";
    const result = await runWorkspaceAI(
      root,
      job,
      transportFor(
        [
          tool("read_saved_work", { job_id: prior, part: "PROPOSAL" }),
          tool("prepare_document", {
            agent_id: "elena",
            instruction:
              "Ajustar solo el primer punto de la propuesta, conservando el resto.",
            action: "REWRITE",
            scope: "DOCUMENT",
            analysis_job_id: null,
            proposal_job_id: prior,
          }),
          "Preparé el ajuste de la propuesta anterior; queda revisarlo.",
        ],
        calls,
      ),
      undefined,
      0.6,
      undefined,
      {
        readSavedWork: async (name: string, args: any) => {
          reads.push([name, args]);
          return {
            job_id: prior,
            summary: "Versión anterior",
            replacement_text: proposal,
            scope: "DOCUMENT",
            limitations: [],
          };
        },
      },
    );
    expect(reads).toEqual([
      ["read_saved_work", { job_id: prior, part: "PROPOSAL" }],
    ]);
    const writer = calls.find((c) => c.text?.format.schema.properties.edits);
    expect(
      JSON.parse(writer.input[0].content).untrusted_evidence.context
        .document_blocks[0].text,
    ).toContain("todavía no aplicada");
    expect(result.execution.quote).toBe(doc); // Applying still checks the actual open document.
    const followupCalls: any[] = [];
    const followup = await runWorkspaceAI(
      root,
      {
        ...job,
        request: {
          ...job.request,
          instruction: "¿Por qué hace falta revisar ese punto?",
        },
      },
      transportFor(
        ["Porque falta confirmar el acuerdo entre las partes."],
        followupCalls,
      ),
    );
    expect(followupCalls).toHaveLength(1);
    expect(followup.agent_trace).toEqual([]);
    expect(followup.replacement_text).toBeNull();
  });
});
it("can consult one specialist without a full team and never retries an unknown worker outcome", async () => {
  await fixture(async (root, job) => {
    const calls: any[] = [];
    const decision = tool("consult_specialist", {
      agent_id: "martin",
      instruction: "Aclarar el aspecto tributario sin redactar otra versión.",
      scope: "DOCUMENT",
      analysis_job_id: null,
    });
    const result = await runWorkspaceAI(
      root,
      job,
      transportFor([decision, "El especialista aportó estas reservas."], calls),
    );
    expect(calls.filter((c) => !c.tools)).toHaveLength(3);
    expect(result.team_outputs.map((o: any) => o.agent_id)).toEqual(["martin"]);
    expect(result.replacement_text).toBeNull();
    let attempts = 0;
    const disconnected = transportFor([decision], []);
    await expect(
      runWorkspaceAI(root, job, async (url: string, init: RequestInit) => {
        if (init.method === "POST" && !JSON.parse(String(init.body)).tools) {
          attempts++;
          throw Error("connection lost");
        }
        return disconnected(url, init);
      }),
    ).rejects.toThrow("TRANSPORT_OUTCOME_UNKNOWN");
    expect(attempts).toBe(1);
  });
});
