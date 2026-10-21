import { afterEach, expect, it, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  access,
  rm,
} from "node:fs/promises";
import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import {
  prepareCase,
  loadCase,
  runCase,
  statusCase,
  consultCase,
} from "../../scripts/junta-case.mjs";
import { createLiveProviders } from "../../dist/providers/live.js";
import {
  DEFAULT_CONFIG,
  EXPECTED_MODELS,
} from "../../dist/providers/config.js";
import { LegalBoard } from "../../dist/orchestration/index.js";
import { FileBoardStore } from "../../dist/persistence/index.js";
import { validateEvidenceBundle } from "../../dist/ingestion/bundle.js";
import { OfficialEvidenceRegistry } from "../../dist/ingestion/provenance.js";
import { RequestSchema } from "../../dist/domain/contracts.js";

const prefix = resolve(tmpdir(), "law-order-general-");
const input = {
  study_id: "synthetic-study",
  matter_id: "synthetic-general",
  actor_id: "local-administrator",
  question:
    "¿Qué riesgos evaluar en una operación hipotética que vende el 55% de una empresa?",
  scope:
    "Orientación general. La operación del 55% es una hipótesis, no un hecho acreditado.",
  as_of_date: "2026-10-15",
  synthetic_data: true,
  consultation_mode: "GENERAL",
  execution_mode: "OFFLINE_TEST",
  include_library: false,
  documents: [],
};
async function cleanup(root) {
  if (!root.startsWith(prefix) || !root.startsWith(resolve(tmpdir()) + sep))
    throw Error("UNSAFE_TEST_CLEANUP");
  await rm(root, { recursive: true, force: true });
}
afterEach(() => vi.unstubAllGlobals());
it("accepts zero documents only for a general consultation, preserving documentary requirements", async () => {
  const root = await mkdtemp(prefix);
  try {
    await expect(
      prepareCase({ ...input, consultation_mode: "DOCUMENT_REVIEW" }, root),
    ).rejects.toThrow();
    const prepared = await prepareCase(input, root),
      saved = await loadCase(prepared.prepared_id, root);
    expect(saved.bundle.documents).toEqual([]);
    expect(saved.bundle.originals).toEqual([]);
    expect(saved.bundle.request.selected_document_ids).toEqual([]);
    expect(saved.bundle.request.legal_question).toBe(input.question);
    expect(
      RequestSchema.safeParse({
        ...saved.bundle.request,
        consultation_mode: "DOCUMENT_REVIEW",
      }).success,
    ).toBe(false);
    expect(
      RequestSchema.safeParse({
        ...saved.bundle.request,
        consultation_mode: undefined,
      }).success,
    ).toBe(false);
    expect(
      validateEvidenceBundle(saved.bundle, new OfficialEvidenceRegistry())
        .snapshot.documents,
    ).toEqual([]);
  } finally {
    await cleanup(root);
  }
});
it("runs the existing board offline without config, credentials, price files, grants or network and persists the result", async () => {
  const root = await mkdtemp(prefix);
  const network = vi.fn(() => {
    throw Error("NETWORK_FORBIDDEN_IN_OFFLINE_TEST");
  });
  vi.stubGlobal("fetch", network);
  try {
    const prepared = await prepareCase(input, root);
    expect(prepared).toMatchObject({
      consultation_mode: "GENERAL",
      execution_mode: "OFFLINE_TEST",
      budget_usd: 0,
      reserved_ceiling_usd: 0,
      documents: [],
    });
    const run = await runCase(prepared.prepared_id, root, network);
    expect(run).toMatchObject({
      mode: "OFFLINE_SIMULATION",
      status: "HUMAN_REVIEW_PENDING",
      error_code: null,
      network_used: false,
      paid_calls: 0,
      legal_answer_generated: false,
      human_approval: "PENDING",
    });
    expect(run.cost.actual_total_usd).toBe(0);
    expect(run.packet.documentary_facts).toEqual([]);
    expect(run.packet.party_allegations).toEqual([]);
    expect(run.analysis.factual_basis).toEqual([]);
    expect(run.analysis.legal_analysis).toContain("SIMULACIÓN OFFLINE");
    expect(run.analysis.supporting_references).toEqual([]);
    expect(run.stages.map((stage) => stage.stage)).toEqual([
      "BUILDING_CONTEXT",
      "PRINCIPAL_ANALYSIS",
      "ADVERSARIAL_AUDIT",
      "CHECKING_REFERENCES",
    ]);
    expect(run.citation_review).toMatchObject({
      completed: true,
      verified_references: 0,
      detected_mentions: 0,
    });
    expect((await statusCase(prepared.prepared_id, root)).run.run_id).toBe(
      run.run_id,
    );
    expect(
      (await statusCase(prepared.prepared_id, root)).execution_authorized,
    ).toBe(false);
    expect((await runCase(prepared.prepared_id, root, network)).run_id).toBe(
      run.run_id,
    );
    // Even an independently enabled legacy browser policy cannot turn an offline
    // preparation into a live one or create a grant for it.
    await mkdir(resolve(root, ".local-dev"));
    await writeFile(
      resolve(root, ".local-dev/junta-browser-approval.json"),
      JSON.stringify({ enabled: true, max_cost_usd: 0.6 }),
    );
    await expect(
      consultCase(
        {
          prepared_id: prepared.prepared_id,
          owner_approval: true,
          max_cost_usd: 0.6,
          synthetic_data: true,
        },
        root,
        network,
      ),
    ).rejects.toThrow("OFFLINE_CASE_CANNOT_AUTHORIZE_PAID_CALLS");
    await expect(
      access(resolve(root, ".local-dev/junta-approvals")),
    ).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  } finally {
    await cleanup(root);
  }
});
it("carries a no-document question through the production wire adapters with TEST-ONLY transport, preserving provenance and citation checks", async () => {
  const root = await mkdtemp(prefix);
  const globalNetwork = vi.fn(() => {
    throw Error("REAL_NETWORK_FORBIDDEN");
  });
  vi.stubGlobal("fetch", globalNetwork);
  try {
    const prepared = await prepareCase(input, root),
      saved = await loadCase(prepared.prepared_id, root);
    const { bundle, index, snapshot, registry } = validateEvidenceBundle(
      saved.bundle,
      new OfficialEvidenceRegistry(),
    );
    let unreferencedHypothesis = false,
      rephrasedQuestion = false,
      foreignRequest = false;
    let fabricatedFact = false,
      fabricatedCitation = false;
    const response = (data) =>
      new Response(JSON.stringify(data), { status: 200 });
    const transport = vi.fn(async (url, options) => {
      if (!options.body) {
        if (url.includes("typesafe"))
          return response({ models: [{ name: "jev-latest" }] });
        if (url.includes("googleapis"))
          return response({
            name: `models/${EXPECTED_MODELS.gemini}`,
            supportedGenerationMethods: ["generateContent"],
            inputTokenLimit: 1000000,
            outputTokenLimit: 65536,
          });
        return response({ id: decodeURIComponent(url.split("/").at(-1)) });
      }
      const body = JSON.parse(options.body);
      expect(url).not.toContain("typesafe"); // No Jev call when there is nothing to classify.
      const isGoogle = url.includes("googleapis");
      const evidence = JSON.parse(
        isGoogle ? body.contents[0].parts[0].text : body.input[0].content,
      ).untrusted_evidence;
      const instructions = isGoogle
        ? body.systemInstruction.parts[0].text
        : body.instructions;
      expect(instructions).toContain("request.consultation_mode=GENERAL");
      expect(evidence.request.legal_question).toBe(input.question);
      expect(evidence.passages).toEqual([]);
      expect(evidence.request.selected_document_ids).toEqual([]);
      const output = isGoogle
        ? {
            audit_id: "test-audit",
            analysis_id: evidence.analysis.analysis_id,
            findings: [],
            citation_objections: [],
            unsupported_fact_flags: [],
            missing_evidence_flags: ["TEST: supuesto sin documentos"],
            requested_passages: [],
            audit_status: "REVIEW_REQUIRED",
          }
        : body.model === EXPECTED_MODELS.luna
          ? {
              packet_id: "test-context",
              packet_version: 1,
              request_id: evidence.request.request_id,
              study_id: input.study_id,
              matter_id: input.matter_id,
              matter_snapshot_id: snapshot.snapshot_id,
              documentary_facts: fabricatedFact
                ? [
                    {
                      statement: "La operación ocurrió.",
                      kind: "DOCUMENT_CONTENT",
                      references: [],
                      date: null,
                    },
                  ]
                : [],
              party_allegations: [],
              chronology: [],
              contested_facts: unreferencedHypothesis
                ? [
                    {
                      statement:
                        "TEST: una operación hipotética del 55%, sin acreditar.",
                      kind: "MODEL_INFERENCE",
                      references: [],
                      date: null,
                    },
                  ]
                : [],
              contradictions: [],
              relevant_documents: [],
              missing_information: ["TEST: supuestos sin acreditar"],
              unresolved_questions: [],
              coverage_limitations: ["TEST: sin hechos acreditados"],
            }
          : {
              analysis_id: "test-analysis",
              request_id: foreignRequest
                ? "other-request"
                : evidence.request.request_id,
              question_analyzed: rephrasedQuestion
                ? "TEST resumen de la consulta original."
                : input.question,
              factual_basis: [],
              legal_analysis: fabricatedCitation
                ? "TEST CONTROLADO: Ley 999999/2026."
                : "TEST CONTROLADO: el supuesto del 55% se conserva como hipótesis. No hay conclusión jurídica.",
              supporting_references: [],
              alternative_interpretations: [],
              unresolved_issues: [
                "TEST: tipo de operación y contexto sin acreditar",
              ],
              additional_evidence_requests: [],
              limitations: ["TEST: no autentica normativa"],
              completion_status: "NEEDS_MORE_EVIDENCE",
            };
      return isGoogle
        ? response({
            modelVersion: EXPECTED_MODELS.gemini,
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: JSON.stringify(output) }] },
              },
            ],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100 },
          })
        : response({
            model: body.model,
            status: "completed",
            output: [
              {
                content: [
                  { type: "output_text", text: JSON.stringify(output) },
                ],
              },
            ],
            usage: { input_tokens: 50, output_tokens: 100 },
          });
    });
    const config = { ...DEFAULT_CONFIG, max_retries: 0, max_retrievals: 0 };
    const providers = createLiveProviders(
      {
        JEV_API_KEY: "test-only",
        OPENAI_API_KEY: "test-only",
        GEMINI_API_KEY: "test-only",
        JEV_MODEL: EXPECTED_MODELS.jev,
        OPENAI_LUNA_MODEL: EXPECTED_MODELS.luna,
        OPENAI_SOL_MODEL: EXPECTED_MODELS.sol,
        GEMINI_AUDITOR_MODEL: EXPECTED_MODELS.gemini,
        OPENAI_SOL_REASONING_EFFORT: "medium",
      },
      config,
      transport,
    );
    // TEST prices only, never operator prices or an authorization file.
    const prices = Object.values(EXPECTED_MODELS).map((model_id) => ({
      model_id,
      input_per_million_usd: 0,
      output_per_million_usd: 0,
      mode: "STANDARD",
      source: "TEST_ONLY",
      as_of_date: input.as_of_date,
    }));
    const board = new LegalBoard(
      index,
      new FileBoardStore(resolve(root, "test-runs")),
      providers,
      config,
      prices,
      registry,
    );
    await expect(
      board.execute(bundle.actor, bundle.request, snapshot),
    ).rejects.toThrow("EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED");
    expect(transport).not.toHaveBeenCalled();
    for (const provider of [providers.luna, providers.sol, providers.gemini])
      await provider.verifyAvailability(AbortSignal.timeout(1000));
    const run = await board.execute(bundle.actor, bundle.request, snapshot, {
      authorize_paid_calls: true,
    });
    expect(run.status).toBe("HUMAN_REVIEW_PENDING");
    expect(run.analysis.legal_analysis).toContain("TEST CONTROLADO");
    expect(run.analysis.factual_basis).toEqual([]);
    unreferencedHypothesis = true;
    const hypothesisRequest = {
      ...bundle.request,
      request_id: "test-unreferenced-hypothesis",
    };
    const hypothesisRun = await board.execute(
      bundle.actor,
      hypothesisRequest,
      snapshot,
      { authorize_paid_calls: true },
    );
    expect(hypothesisRun.status).toBe("HUMAN_REVIEW_PENDING");
    expect(hypothesisRun.packet.contested_facts).toEqual([]);
    expect(
      hypothesisRun.packet.unresolved_questions.some((text) =>
        text.startsWith("Hipótesis no acreditada"),
      ),
    ).toBe(true);
    const legacy = structuredClone(hypothesisRun);
    legacy.stages = legacy.stages.filter(
      (stage) => stage.stage_name === "BUILDING_CONTEXT",
    );
    legacy.stages[0].status = "FAIL";
    legacy.stages[0].error_code = "MISSING_PROVENANCE";
    legacy.status = "PARTIAL";
    legacy.history.push("PARTIAL");
    legacy.error_code = "MISSING_PROVENANCE";
    legacy.packet = null;
    legacy.analysis = null;
    legacy.audit = null;
    legacy.citation_checks = [];
    legacy.reference_verification = "NOT_CHECKED";
    await new FileBoardStore(resolve(root, "test-runs")).saveRun(
      bundle.actor,
      legacy,
    );
    const lunaCalls = () =>
      transport.mock.calls.filter(
        ([, options]) =>
          options.body &&
          JSON.parse(options.body).model === EXPECTED_MODELS.luna,
      ).length;
    const callsBeforeResume = lunaCalls();
    const resumed = await board.execute(
      bundle.actor,
      hypothesisRequest,
      snapshot,
      { authorize_paid_calls: true, resume_context_classification: true },
    );
    expect(resumed.status).toBe("HUMAN_REVIEW_PENDING");
    expect(
      resumed.stages.some(
        (stage) =>
          stage.stage_name === "CONTEXT_CLASSIFICATION_REPAIR" &&
          stage.status === "PASS",
      ),
    ).toBe(true);
    expect(lunaCalls()).toBe(callsBeforeResume);
    expect(resumed.packet.documentary_facts).toEqual([]);
    expect(resumed.packet.contested_facts).toEqual([]);
    unreferencedHypothesis = false;
    rephrasedQuestion = true;
    const metadataRequest = {
      ...bundle.request,
      request_id: "test-rephrased-question",
    };
    const metadataRun = await board.execute(
      bundle.actor,
      metadataRequest,
      snapshot,
      { authorize_paid_calls: true },
    );
    expect(metadataRun.analysis.question_analyzed).toBe(input.question);
    expect(
      metadataRun.analysis.limitations.some((text) =>
        text.includes("TEST resumen de la consulta original."),
      ),
    ).toBe(true);
    const oldMetadata = structuredClone(metadataRun);
    oldMetadata.stages = oldMetadata.stages.filter((stage) =>
      ["BUILDING_CONTEXT", "PRINCIPAL_ANALYSIS"].includes(stage.stage_name),
    );
    oldMetadata.stages.at(-1).status = "FAIL";
    oldMetadata.stages.at(-1).error_code = "ANALYSIS_QUESTION_MISMATCH";
    oldMetadata.status = "PARTIAL";
    oldMetadata.history.push("PARTIAL");
    oldMetadata.error_code = "ANALYSIS_QUESTION_MISMATCH";
    oldMetadata.analysis = null;
    oldMetadata.audit = null;
    oldMetadata.citation_checks = [];
    oldMetadata.reference_verification = "NOT_CHECKED";
    await new FileBoardStore(resolve(root, "test-runs")).saveRun(
      bundle.actor,
      oldMetadata,
    );
    const beforeMetadataResume = transport.mock.calls.length;
    const metadataResumed = await board.execute(
      bundle.actor,
      metadataRequest,
      snapshot,
      { authorize_paid_calls: true, resume_analysis_metadata: true },
    );
    expect(metadataResumed.status).toBe("HUMAN_REVIEW_PENDING");
    expect(metadataResumed.analysis.question_analyzed).toBe(input.question);
    expect(transport.mock.calls.length).toBe(beforeMetadataResume + 1); // Only the uncalled auditor.
    foreignRequest = true;
    const wrongRequest = await board.execute(
      bundle.actor,
      { ...bundle.request, request_id: "test-foreign-response" },
      snapshot,
      { authorize_paid_calls: true },
    );
    expect(wrongRequest.error_code).toBe("ANALYSIS_QUESTION_MISMATCH");
    expect(wrongRequest.analysis).toBeNull();
    foreignRequest = false;
    rephrasedQuestion = false;
    fabricatedFact = true;
    const badFact = await board.execute(
      bundle.actor,
      { ...bundle.request, request_id: "test-fabricated-fact" },
      snapshot,
      { authorize_paid_calls: true },
    );
    expect(badFact.error_code).toBe("MISSING_PROVENANCE");
    expect(badFact.analysis).toBeNull();
    const callsBeforeBadResume = transport.mock.calls.length;
    const stillRejected = await board.execute(
      bundle.actor,
      { ...bundle.request, request_id: "test-fabricated-fact" },
      snapshot,
      { authorize_paid_calls: true, resume_context_classification: true },
    );
    expect(stillRejected.error_code).toBe("MISSING_PROVENANCE");
    expect(stillRejected.analysis).toBeNull();
    expect(transport.mock.calls.length).toBe(callsBeforeBadResume);
    fabricatedFact = false;
    fabricatedCitation = true;
    const badCitation = await board.execute(
      bundle.actor,
      { ...bundle.request, request_id: "test-fabricated-citation" },
      snapshot,
      { authorize_paid_calls: true },
    );
    expect(badCitation.status).toBe("PARTIAL");
    expect(badCitation.reference_verification).toBe("REVIEW_REQUIRED");
    expect(
      badCitation.citation_checks.every(
        (check) => check.identity_status !== "VERIFIED_IDENTITY",
      ),
    ).toBe(true);
    // Exercise the exact bridge used by the general-consultation button with
    // fake credentials and a fake transport; preparation alone never spends.
    await mkdir(resolve(root, "junta-local"));
    await mkdir(resolve(root, "phase2/reports"), { recursive: true });
    await mkdir(resolve(root, ".local-dev"));
    const template = await readFile("junta-local/config.env.example", "utf8");
    await writeFile(resolve(root, "junta-local/config.env.example"), template);
    await writeFile(
      resolve(root, ".env"),
      template
        .replace("JEV_API_KEY=", "JEV_API_KEY=test-only")
        .replace("OPENAI_API_KEY=", "OPENAI_API_KEY=test-only")
        .replace("GEMINI_API_KEY=", "GEMINI_API_KEY=test-only"),
    );
    await writeFile(
      resolve(root, "phase2/reports/model-connectivity-standard-prices.json"),
      await readFile("phase2/reports/model-connectivity-standard-prices.json"),
    );
    const callsBeforePrepare = transport.mock.calls.length;
    await expect(prepareCase({ ...input, execution_mode: "LIVE" }, root)).rejects.toThrow("LEGAL_WORKFLOW_UNIFIED");
    expect(transport.mock.calls.length).toBe(callsBeforePrepare);
    expect(globalNetwork).not.toHaveBeenCalled();
  } finally {
    await cleanup(root);
  }
});
