import { expect, it } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import * as Y from "yjs";
import { database } from "./fixtures.js";
import { WorkspaceRepository } from "../../apps/api/src/workspace.js";
import { workspaceOriginals } from "./workspace-fixtures.js";
import { installNativePeer } from "../../local-browser/tests/native-peer.js";
import { encodeVoice } from "../../apps/web/src/gabriel-audio.js";
import { z } from "zod";
import {
  WorkspaceAgentToolSchemas,
  workspaceAgents,
} from "../../packages/workspace/src/tasks.js";
// @ts-expect-error Native conversation host.
import { runGabrielConversation } from "../../scripts/workspace-agent.mjs";
import {
  receiptCovers,
  deletionRanges,
  toBase64,
  type WorkspaceAccess,
  type WorkspaceSeed,
} from "../../packages/workspace/src/model.js";
// @ts-expect-error Existing local host uses native ESM scripts.
import { createWorkspaceBridge } from "../../scripts/workspace-bridge.mjs";
// @ts-expect-error Native ESM host module.
import { runWorkspaceAI } from "../../scripts/workspace-ai.mjs";
// @ts-expect-error Native terminal manifest verifier.
import { assertQualityManifest } from "../../scripts/workspace-quality.mjs";
// @ts-expect-error Native ESM capability validation.
import { directorExecution } from "../../scripts/workspace-director.mjs";

function syntheticMicrophone() {
  const streams: MediaStream[] = [],
    peers: RTCPeerConnection[] = [];
  (window as any).__testCallStreams = streams;
  (window as any).__testCallPeers = peers;
  const NativePeer = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends NativePeer {
    constructor(config?: RTCConfiguration) {
      super(config);
      peers.push(this);
    }
  };
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async () => {
      const context = new AudioContext();
      await context.resume();
      const source = context.createOscillator(),
        sink = context.createMediaStreamDestination();
      source.connect(sink);
      source.start();
      const stream = sink.stream;
      streams.push(stream);
      const track = stream.getAudioTracks()[0]!,
        stop = track.stop.bind(track);
      Object.defineProperty(track, "stop", {
        value: () => {
          source.stop();
          void context.close();
          stop();
        },
      });
      return stream;
    },
  });
}

it("does not acknowledge a deletion using only an unchanged Yjs state vector", () => {
  const doc = new Y.Doc();
  const text = doc.getText("test");
  text.insert(0, "contrato");
  const receipt = {
    kind: "durable" as const,
    room_id: randomUUID(),
    revision: 1,
    vector: toBase64(Y.encodeStateVector(doc)),
    deletions: deletionRanges(Y.encodeStateAsUpdate(doc)),
    state_hash: "x",
    saved_at: new Date().toISOString(),
  };
  expect(receiptCovers(receipt, doc)).toBe(true);
  text.delete(0, 1);
  expect(toBase64(Y.encodeStateVector(doc))).toBe(receipt.vector);
  expect(receiptCovers(receipt, doc)).toBe(false);
  doc.destroy();
});

it("edits through two real browser sessions, commits to PostgreSQL, survives restart and preserves Core originals and permissions", async () => {
  const db = await database(),
    repository = new WorkspaceRepository(db.pool, db.runtime, db.blobs);
  let bridge: ReturnType<typeof createWorkspaceBridge>;
  let failIntegrationOnce = false;
  let pauseNextTask = false;
  let nextDirectorDraft: "DOCUMENT" | "SELECTION" | null = null;
  let nextDirectorReply: string | null = null;
  let nextAgentTools: any[] | null = null;
  let failBeforeProgress = false;
  let nextControlled: "clean" | "issues" | null = null;
  let releaseTask: (() => void) | undefined;
  const runAI = async (
    root: string,
    job: any,
    transport: unknown,
    progress: (result: unknown) => Promise<void>,
    _budget?: number,
    _ledger?: unknown,
    runtime?: {
      readSavedWork: (tool: string, args: unknown) => Promise<unknown>;
    },
  ) => {
    if (nextControlled) {
      const scenario = nextControlled;
      nextControlled = null;
      let directorTurn = 0;
      return runWorkspaceAI(
        root,
        job,
        async (_url: string, init: RequestInit) => {
          if (init.method === "GET") return Response.json({ id: "gpt-6-luna" });
          const body = JSON.parse(String(init.body));
          expect(body.model).toBe("gpt-6-luna");
          let output;
          if (body.tools) {
            output =
              directorTurn++ === 0
                ? [
                    {
                      type: "function_call",
                      name:
                        scenario === "clean"
                          ? "consult_specialist"
                          : "prepare_document",
                      call_id: "controlled_call",
                      arguments: JSON.stringify({
                        agent_id: "elena",
                        pack_id: "civil_responsabilidad",
                        instruction: "Revisar el respaldo del caso de prueba.",
                        scope: "DOCUMENT",
                        analysis_job_id: null,
                        ...(scenario === "issues"
                          ? { action: "REWRITE", proposal_job_id: null }
                          : {}),
                      }),
                    },
                  ]
                : [
                    {
                      type: "message",
                      role: "assistant",
                      content: [
                        {
                          type: "output_text",
                          text: "Elena preparó el trabajo; revisá el control y sus pendientes.",
                        },
                      ],
                    },
                  ];
          } else {
            const props = body.text.format.schema.properties;
            const value = props.outcome
              ? {
                  outcome:
                    scenario === "issues"
                      ? "CHANGES_REQUIRED"
                      : "NO_MATERIAL_ISSUES_FOUND",
                  summary: "Control sintético del flujo real.",
                  issues:
                    scenario === "issues"
                      ? [
                          {
                            target_id: "FINAL",
                            severity: "HIGH",
                            quote: "",
                            problem: "Problema material simulado.",
                            requested_change: "Corregir antes de aplicar.",
                          },
                        ]
                      : [],
                  references: [],
                  limitations: [],
                }
              : {
                  summary: "Aporte sintético con paquete efectivo.",
                  ...(props.edits
                    ? { edits: [] }
                    : { findings: [], replacement_text: null }),
                  references: [],
                  limitations: [],
                };
            output = [
              {
                content: [{ type: "output_text", text: JSON.stringify(value) }],
              },
            ];
          }
          return Response.json({
            model: "gpt-6-luna",
            status: "completed",
            output,
            usage: { input_tokens: 100, output_tokens: 100 },
          });
        },
        progress,
        _budget,
        _ledger,
        runtime,
      );
    }
    if (failBeforeProgress) {
      failBeforeProgress = false;
      throw Object.assign(new Error("PRIVATE_DATA_MUST_NOT_LEAK"), {
        code: "EACCES",
      });
    }
    if (pauseNextTask) {
      pauseNextTask = false;
      await new Promise<void>((resolve) => {
        releaseTask = resolve;
      });
    }
    // Explicit model-result fixture for the browser test, not intent detection.
    // The production director/provider boundary is tested with injected transport.
    if (job.request.workflow_version === 4 && nextAgentTools) {
      const queue = nextAgentTools;
      nextAgentTools = null;
      return runGabrielConversation(job, {
        schemas: WorkspaceAgentToolSchemas,
        toJSONSchema: (s: any) => z.toJSONSchema(s),
        agents: workspaceAgents,
        rules: "Prueba sintética sin IA.",
        envelope: {
          simulated: true,
          sources: [],
          citation_check: [],
          semantic_check: "NOT_PERFORMED",
          jev_output: false,
        },
        progress,
        readSavedWork: runtime?.readSavedWork,
        ask: async () => {
          const step = queue.shift();
          if (typeof step === "string")
            return { items: [], calls: [], text: step };
          if (step.args.analysis_job_id === "CURRENT_JOB")
            step.args.analysis_job_id = job.id;
          const call = {
            type: "function_call",
            name: step.name,
            call_id: randomUUID(),
            arguments: JSON.stringify(step.args),
          };
          return { items: [call], calls: [call], text: "" };
        },
        execute: (next: any, update: any) =>
          runWorkspaceAI(
            root,
            {
              ...next,
              request: { ...next.request, execution_mode: "OFFLINE_TEST" },
            },
            undefined,
            update,
          ),
      });
    }
    if (job.request.action === "PLAN" && nextDirectorReply) {
      const reply = nextDirectorReply;
      nextDirectorReply = null;
      const result = await runWorkspaceAI(root, job, transport, progress);
      return {
        ...result,
        summary: reply,
        team_plan: {
          kind: "DIRECT",
          reply,
          lead_id: null,
          participants: [],
          missing_inputs: [],
          continuation: null,
        },
      };
    }
    if (job.request.action === "PLAN" && nextDirectorDraft) {
      const scope = nextDirectorDraft;
      nextDirectorDraft = null;
      const basis = job.context.director_state.analysis;
      const decision = {
        kind: "CONTINUE",
        reply: "La responsable prepara una propuesta revisable.",
        lead_id: null,
        participants: [],
        missing_inputs: [],
        continuation: {
          action: "REWRITE",
          agent_id: "elena",
          analysis_job_id: basis?.job_id ?? null,
          scope,
          instruction: job.request.instruction,
        },
      };
      const next = directorExecution(job, decision);
      const result = await runWorkspaceAI(root, next.job, transport, progress);
      return { ...result, team_plan: decision, execution: next.execution };
    }
    if (job.request.execution_mode === "LIVE" && !transport)
      throw Error("UNEXPECTED_LIVE_TEST_WITHOUT_TRANSPORT");
    const result = await runWorkspaceAI(root, job, transport, progress);
    if (
      job.request.action === "ANALYZE" &&
      job.context.text.includes("Contrato sintético Word.")
    ) {
      const sample = result.findings[0];
      result.findings = [
        {
          ...sample,
          quote: "Contrato sintético Word.",
          title: "Primera cláusula",
          proposal: "PROPUESTA SINTÉTICA DE PRUEBA.",
        },
        {
          ...sample,
          quote: "Cláusula  final conservada.",
          title: "Segunda cláusula",
          proposal: "SEGUNDA PROPUESTA SINTÉTICA.",
        },
        {
          ...sample,
          quote: "Pasaje ausente de la copia",
          title: "Cita que necesita ubicación",
          proposal: "A confirmar por las partes.",
        },
      ];
    }
    if (failIntegrationOnce && job.request.action === "ANALYZE") {
      failIntegrationOnce = false;
      await progress({
        ...result,
        findings: [],
        team_progress: {
          active: "integration",
          completed: result.team_outputs.map((o: any) => o.agent_id),
        },
      });
      throw Error("WORKSPACE_MODEL_CONTEXT_LIMIT");
    }
    return result;
  };
  const server = createServer(async (req, res) => {
    if (await bridge.handle(req, res)) return;
    try {
      const path = new URL(req.url!, "http://127.0.0.1").pathname;
      const file = resolve(
        "dist/web",
        "." + (extname(path) ? path : "/index.html"),
      );
      res.setHeader(
        "Content-Type",
        (
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".html": "text/html",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream",
      );
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const report = "local-browser/reports/workspace-local";
  const failures: string[] = [],
    external: string[] = [];
  const originals = workspaceOriginals();
  let seed: WorkspaceSeed | undefined, access: WorkspaceAccess | undefined;
  try {
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address() as { port: number },
      origin = `http://127.0.0.1:${address.port}`;
    bridge = createWorkspaceBridge(process.cwd(), origin, {
      repository,
      runAI,
    });
    bridge.attach(server);
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    let transcriptions = 0,
      readings = 0;
    const sampleVoice = Buffer.from(
      encodeVoice(new Float32Array(16000 * 8).fill(0.01), 16000),
    ).toString("base64");
    await context.route("**/local/gabriel/**", async (route) => {
      const operation = new URL(route.request().url()).pathname
        .split("/")
        .at(-1);
      if (operation === "status")
        return route.fulfill({ json: { ready: true } });
      if (operation === "transcribe") {
        transcriptions++;
        expect(
          route.request().postDataBuffer()!.subarray(0, 4).toString(),
        ).toBe("RIFF");
        return route.fulfill({
          json: { text: "Analizá el contrato abierto y proponé el equipo." },
        });
      }
      if (operation === "speech") {
        readings++;
        expect(route.request().postDataJSON().text.length).toBeLessThanOrEqual(
          1600,
        );
        return route.fulfill({
          json: { audio: sampleVoice, mime: "audio/wav" },
        });
      }
      throw Error("Unexpected voice operation");
    });
    await context.addInitScript(syntheticMicrophone);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("request", (request) => {
      if (request.url() === origin + "/local/workspace/adopt")
        seed = request.postDataJSON();
    });
    page.on("response", async (response) => {
      if (response.url() === origin + "/local/workspace/adopt" && response.ok())
        access = await response.json();
    });
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Administración", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Crear estudio", exact: true })
      .click();
    await page
      .getByLabel("Nombre del estudio sintético")
      .fill("Estudio workspace sintético");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: "Clientes", exact: true }).click();
    await page
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Nombre", { exact: true })
      .fill("Cliente workspace sintético");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByText("Cliente workspace sintético", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nuevo asunto", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Título", { exact: true })
      .fill("Contrato colaborativo sintético");
    await page.locator('select[name="subject_area"]').selectOption("Contratos");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: /Volver al asunto/ }).click();
    await page.getByRole("tab", { name: "Documentos", exact: true }).click();
    for (const original of originals) {
      await page
        .getByRole("button", { name: "Incorporar original", exact: true })
        .click();
      await page.getByLabel("Título", { exact: true }).fill(original.name);
      await page.locator('input[name="file"]').setInputFiles(original);
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await page.getByText(original.name, { exact: true }).waitFor();
    }
    await page.getByRole("tab", { name: "Workspace", exact: true }).click();
    const newEditor = page.getByRole("textbox", {
      name: "Documento nuevo",
      exact: true,
    });
    await newEditor.waitFor();
    await mkdir(report, { recursive: true });
    await page.screenshot({
      path: report + "/workspace-empty-editor-1366.png",
      fullPage: true,
    });
    await newEditor.fill("Primera redacción antes de guardar.");
    await newEditor.press("Control+A");
    await page.getByRole("button", { name: "Negrita", exact: true }).click();
    await page
      .getByLabel("Nuevo documento", { exact: true })
      .fill("Contrato de trabajo compartido");
    await page.getByRole("button", { name: "Archivos", exact: true }).click();
    await page
      .locator(".word-original-choice")
      .filter({ hasText: originals[0]!.name })
      .getByRole("checkbox")
      .check();
    await page.locator(".word-mode summary").click();
    await page
      .getByLabel("Modo de ejecuci\u00f3n del editor")
      .selectOption("OFFLINE_TEST");
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill("Analizar el contrato adjunto desde el editor nuevo.");
    await page.getByRole("button", { name: /Ejecutar prueba offline/ }).click();
    await page.getByLabel("Equipo propuesto por Gabriel").waitFor();
    const initialNotes = await repository.notes(access!.token, access!.room.id);
    expect(initialNotes.jobs[0].context.attached_documents[0].text).toContain(
      "Clausula final conservada",
    );
    expect(await page.getByRole("alert").count()).toBe(0);
    await page.getByLabel("Adjuntar documentos a la consulta").setInputFiles({
      name: "Original ilegible.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\ninvalid synthetic pdf"),
    });
    await page
      .getByRole("alert")
      .filter({ hasText: /No se pudo extraer texto legible/ })
      .first()
      .waitFor();
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill("Analizar el original ilegible.");
    await page.getByRole("button", { name: /Ejecutar prueba offline/ }).click();
    expect(
      (await repository.notes(access!.token, access!.room.id)).jobs,
    ).toHaveLength(1);
    await page
      .locator(".word-original-choice")
      .filter({ hasText: "Original ilegible" })
      .getByRole("checkbox")
      .uncheck();
    await page
      .locator(".word-original-choice")
      .filter({ hasText: originals[0]!.name })
      .getByRole("checkbox")
      .check();

    await page.locator(".word-mode summary").click();
    await page.getByRole("button", { name: "Archivos", exact: true }).click();
    console.info("Workspace: asunto y documento creados desde la interfaz.");
    const editor = page.getByRole("textbox", {
      name: "Documento colaborativo",
      exact: true,
    });
    await editor.waitFor();
    expect(await editor.locator("strong").count()).toBeGreaterThan(0);
    expect(await editor.innerText()).toContain(
      "Primera redacción antes de guardar.",
    );
    await editor.press("Control+A");
    await page.getByRole("button", { name: "Negrita", exact: true }).click();
    await editor.fill("Acuerdo sintético. Precio sujeto a confirmación.");
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    expect(access).toBeTruthy();
    expect(seed).toBeTruthy();
    const beforeZoom = await editor.innerText();
    await browserExpect(page.getByLabel("Zoom del documento")).toBeHidden();
    const foldedStatus = (await page.locator(".word-status").boundingBox())!
      .height;
    await page
      .getByRole("button", { name: "Mostrar barra de zoom", exact: true })
      .click();
    await page.getByLabel("Zoom del documento").press("ArrowRight");
    expect(await page.getByLabel("Zoom del documento").inputValue()).toBe(
      "110",
    );
    await page
      .getByRole("button", { name: "Plegar barra de zoom", exact: true })
      .click();
    expect(
      (await page.locator(".word-status").boundingBox())!.height,
    ).toBeLessThanOrEqual(foldedStatus);
    await page
      .getByRole("button", { name: "Mostrar barra de zoom", exact: true })
      .click();
    expect(await page.getByLabel("Zoom del documento").inputValue()).toBe(
      "110",
    );
    await page.getByLabel("Zoom del documento").press("ArrowLeft");
    await page
      .getByRole("button", { name: "Plegar barra de zoom", exact: true })
      .click();
    expect(await editor.innerText()).toBe(beforeZoom);
    await page.getByRole("button", { name: "Compartir", exact: true }).click();
    await page
      .getByRole("button", { name: "Crear enlace local", exact: true })
      .click();
    const shareInput = page.locator(".workspace-share-link input");
    await shareInput.waitFor();
    const link = await shareInput.inputValue();
    const second = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    await second.addInitScript(syntheticMicrophone);
    await second.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    const collaborator = await second.newPage();
    collaborator.setDefaultTimeout(15000);
    collaborator.on("pageerror", (error) => failures.push(error.message));
    await collaborator.goto(link);
    const otherEditor = collaborator.getByRole("textbox", {
      name: "Documento colaborativo",
      exact: true,
    });
    await expect.poll(() => otherEditor.innerText()).toContain("Precio sujeto");
    const sharedGeometry = await collaborator
      .locator(".word-workspace")
      .boundingBox();
    expect(sharedGeometry?.width).toBe(1366);
    expect(sharedGeometry?.height).toBe(768);
    // Two humans join the same document room; real WebRTC transports synthetic audio.
    for (const participant of [page, collaborator]) {
      await participant
        .locator(".workspace-call-toggle")
        .click();
      await participant
        .getByRole("button", { name: "Unirse a la llamada", exact: true })
        .click();
      await participant
        .locator(".workspace-call-panel")
        .getByRole("button", { name: "Activar micrófono", exact: true })
        .waitFor();
      await participant
        .locator(".workspace-call-panel")
        .getByRole("button", { name: "Activar micrófono", exact: true })
        .click();
    }
    const audioReceived = async (participant: typeof page) =>
      participant.evaluate(async () => {
        const connections: RTCPeerConnection[] = (window as any)
          .__testCallPeers;
        let bytes = 0;
        for (const pc of connections) {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            if (report.type === "inbound-rtp" && report.kind === "audio")
              bytes += report.bytesReceived ?? 0;
          });
        }
        return bytes;
      });
    await expect
      .poll(() => audioReceived(page), { timeout: 20000 })
      .toBeGreaterThan(0);
    await expect
      .poll(() => audioReceived(collaborator), { timeout: 20000 })
      .toBeGreaterThan(0);
    for (const participant of [page, collaborator])
      expect(
        await participant.locator(".workspace-call-panel li").count(),
      ).toBe(2);
    await page
      .locator(".workspace-call-panel")
      .getByRole("button", { name: "Silenciar micrófono", exact: true })
      .click();
    expect(
      await page.evaluate(
        () =>
          (window as any).__testCallStreams.at(-1).getAudioTracks()[0].enabled,
      ),
    ).toBe(false);
    await page
      .locator(".workspace-call-panel")
      .getByRole("button", { name: "Activar micrófono", exact: true })
      .click();
    await collaborator.screenshot({
      path: report + "/workspace-human-call.png",
      fullPage: true,
    });
    for (const participant of [page, collaborator])
      await participant
        .getByRole("button", { name: "Plegar llamada", exact: true })
        .click();
    const insert = (element: HTMLElement, text: string) => {
      element.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, text);
    };
    const read = (element: HTMLElement) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(
          ".collaboration-carets__caret,.collaboration-carets__label",
        )
        .forEach((node) => node.remove());
      return clone.textContent ?? "";
    };
    await Promise.all([
      editor.evaluate(insert, " Aporte del administrador."),
      otherEditor.evaluate(insert, " Aporte del abogado."),
    ]);
    await expect
      .poll(() => editor.evaluate(read))
      .toContain("Aporte del abogado.");
    await expect
      .poll(() => otherEditor.evaluate(read))
      .toContain("Aporte del administrador.");
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await expect
      .poll(() => collaborator.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    expect(await editor.evaluate(read)).toBe(await otherEditor.evaluate(read));
    console.info(
      "Workspace: edición simultánea convergente y guardado confirmado.",
    );
    for (const participant of [page, collaborator]) {
      await participant
        .locator(".workspace-call-toggle")
        .click();
      await participant
        .locator(".workspace-call-panel")
        .getByRole("button", { name: "Salir de la llamada", exact: true })
        .click();
      expect(
        await participant.evaluate(() =>
          (window as any).__testCallStreams.every((s: MediaStream) =>
            s.getTracks().every((t) => t.readyState === "ended"),
          ),
        ),
      ).toBe(true);
      await participant
        .getByRole("button", { name: "Plegar llamada", exact: true })
        .click();
    }
    const ribbonBefore = await page.locator(".word-ribbon").boundingBox();
    const textBeforeFiles = await editor.evaluate(read);
    await page.getByRole("button", { name: "Archivos", exact: true }).click();
    const ribbonAfter = await page.locator(".word-ribbon").boundingBox();
    expect(ribbonAfter?.width).toBe(ribbonBefore?.width);
    expect(ribbonAfter?.height).toBe(ribbonBefore?.height);
    expect(ribbonAfter!.height).toBeLessThanOrEqual(40);
    expect(await page.locator(".word-ribbon").count()).toBe(1);
    const groupTops = await page
      .locator(".word-ribbon-controls>.word-ribbon-group")
      .evaluateAll((groups) =>
        groups.map((g) => Math.round(g.getBoundingClientRect().top)),
      );
    expect(new Set(groupTops).size).toBe(1);
    const controlRows = await page
      .locator(
        ".word-ribbon button,.word-ribbon select,.word-ribbon .word-color",
      )
      .evaluateAll((controls) =>
        controls.map((el) => ({
          top: Math.round(el.getBoundingClientRect().top),
          height: Math.round(el.getBoundingClientRect().height),
        })),
      );
    expect(new Set(controlRows.map((c) => c.top)).size).toBe(1);
    expect(new Set(controlRows.map((c) => c.height))).toEqual(new Set([26]));
    const clipped = await page
      .locator(".word-ribbon button")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => {
            const r = button.getBoundingClientRect(),
              p = button.closest(".word-ribbon")!.getBoundingClientRect();
            return (
              r.left < p.left - 1 ||
              r.right > p.right + 1 ||
              r.top < p.top - 1 ||
              r.bottom > p.bottom + 1
            );
          })
          .map((button) => button.textContent),
      );
    expect(clipped).toEqual([]);
    for (const name of ["Insertar", "Revisar", "Vista", "Inicio"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      expect((await page.locator(".word-ribbon").boundingBox())!.height).toBe(
        ribbonAfter!.height,
      );
      const rowTops = await page
        .locator(".word-ribbon button,.word-ribbon select")
        .evaluateAll((els) =>
          els.map((el) => Math.round(el.getBoundingClientRect().top)),
        );
      expect(new Set(rowTops).size).toBe(1);
      for (const action of ["Registrar versión", "Historial", "Compartir"]) {
        expect(
          await page
            .getByRole("button", { name: action, exact: true })
            .isVisible(),
        ).toBe(true);
      }
    }
    expect(await editor.evaluate(read)).toBe(textBeforeFiles);
    await page.screenshot({
      path: report + "/workspace-files-stable-ribbon-1366.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Archivos", exact: true }).click();
    const geometry = await page.locator(".word-workspace").boundingBox();
    expect(geometry?.width).toBe(1366);
    expect(geometry?.height).toBe(768);
    expect(
      await page.getByRole("button", { name: "Clientes", exact: true }).count(),
    ).toBe(0);
    await editor.press("Control+A");
    await editor.press("Alt+Shift+R");
    await page.locator(".word-mode summary").click();
    await page
      .getByLabel("Modo de ejecuci\u00f3n del editor")
      .selectOption("OFFLINE_TEST");
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill("Reformular el texto sin alterar las obligaciones.");
    const unchanged = await editor.evaluate(read);
    await editor.press("Control+Home");
    await editor.press("Control+f");
    await page.getByLabel("Buscar en el documento").fill("sujeto");
    await page
      .getByRole("button", { name: "Ir a la primera coincidencia" })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe("sujeto");
    await editor.press("Alt+Shift+R");
    nextDirectorDraft = "SELECTION";
    await page.getByRole("button", { name: /Ejecutar prueba offline/ }).click();
    await page
      .getByRole("button", { name: "Aplicar versión al documento" })
      .waitFor();
    expect(await editor.evaluate(read)).toBe(unchanged);
    await page
      .getByRole("button", { name: "Aplicar versión al documento" })
      .click();
    await expect
      .poll(() => otherEditor.evaluate(read))
      .toContain("PROPUESTA SINT");
    await editor.press("Control+z");
    await expect.poll(() => otherEditor.evaluate(read)).toBe(unchanged);
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await page
      .getByRole("button", { name: "Aplicar versión al documento" })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "El documento cambi" })
      .waitFor();
    await page.getByRole("button", { name: /Equipo y comentarios/ }).click();
    await page
      .getByRole("button", { name: "Comentarios", exact: true })
      .click();
    await editor.press("Control+A");
    await editor.press("Control+Alt+m");
    await page
      .getByLabel("Nuevo comentario")
      .fill("Revisar la fecha de pago con el cliente.");
    await page
      .getByRole("button", { name: "Guardar comentario", exact: true })
      .click();
    await page
      .locator(".word-comment")
      .filter({ hasText: "Revisar la fecha de pago" })
      .waitFor();
    await collaborator
      .getByRole("button", { name: "Comentarios", exact: true })
      .click();
    await collaborator
      .locator(".word-comment")
      .filter({ hasText: "Revisar la fecha de pago" })
      .waitFor();
    await otherEditor.press("Control+f");
    await collaborator.getByLabel("Buscar en el documento").fill("Precio");
    await collaborator
      .getByRole("button", { name: "Ir a la primera coincidencia" })
      .click();
    await expect
      .poll(() =>
        collaborator.evaluate(() => window.getSelection()?.toString()),
      )
      .toBe("Precio");
    await collaborator
      .getByRole("button", { name: "Conversación", exact: true })
      .click();
    const storedNotes = await repository.notes(access!.token, access!.room.id);
    expect(storedNotes.comments).toHaveLength(1);
    expect(storedNotes.jobs).toHaveLength(2);
    expect(storedNotes.jobs[0].result.simulated).toBe(true);
    expect(storedNotes.jobs[0].result.jev_output).toBe(false);
    const replay = await repository.beginTask(
      access!.token,
      access!.room.id,
      storedNotes.jobs[0].request,
    );
    expect(replay.fresh).toBe(false);
    await expect(
      repository.beginTask(access!.token, access!.room.id, {
        ...storedNotes.jobs[0].request,
        command_id: randomUUID(),
      }),
    ).rejects.toThrow("WORKSPACE_VERSION_CONFLICT");
    await page.getByRole("button", { name: "Resolver", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await repository.notes(access!.token, access!.room.id)).comments[0]
            .resolved,
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Conversación", exact: true })
      .click();
    await page.getByRole("button", { name: "Compartir", exact: true }).click();
    await page.screenshot({
      path: report + "/workspace-word-1366.png",
      fullPage: true,
    });
    console.info(
      "Word workspace: viewport, offline proposal, human apply, peer convergence, undo, stale guard, durable comments and task idempotency passed.",
    );
    const saveNormally = repository.save.bind(repository);
    repository.save = async (
      ...args: Parameters<WorkspaceRepository["save"]>
    ) => {
      repository.save = saveNormally;
      throw Error("WORKSPACE_DATABASE_UNAVAILABLE");
    };
    await editor.evaluate(
      insert,
      " Edición recuperada tras falla de guardado.",
    );
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText(), {
        timeout: 20000,
      })
      .toBe("Guardado en servidor local");
    await expect
      .poll(() => editor.evaluate(read))
      .toContain("Edición recuperada tras falla de guardado.");
    await expect
      .poll(() =>
        page
          .locator(".collaborative-workspace .workspace-message.error")
          .count(),
      )
      .toBe(0);
    const beforeDelete = await editor.evaluate(read);
    await editor.press("Control+End");
    await editor.press("Backspace");
    await expect
      .poll(() => editor.evaluate(read))
      .toBe(beforeDelete.slice(0, -1));
    await expect
      .poll(() => otherEditor.evaluate(read))
      .toBe(beforeDelete.slice(0, -1));
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await editor.press("Control+A");
    await page.getByRole("button", { name: "Negrita", exact: true }).click();
    expect(await editor.locator("strong").count()).toBeGreaterThan(0);
    await editor.press("Control+End");
    await page.getByRole("tab", { name: "Insertar", exact: true }).click();
    await page.getByRole("button", { name: "Tabla", exact: true }).click();
    await expect.poll(() => otherEditor.locator("table").count()).toBe(1);
    await page.getByRole("tab", { name: "Vista", exact: true }).click();
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar Word", exact: true })
      .click();
    const download = await downloading;
    const { unzipSync, strFromU8 } = await import("fflate");
    const docx = unzipSync(await readFile((await download.path())!));
    expect(strFromU8(docx["word/document.xml"]!)).toContain("<w:tbl>");
    expect(strFromU8(docx["word/document.xml"]!)).toContain("<w:b/>");
    await page.getByRole("tab", { name: "Inicio", exact: true }).click();
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await collaborator
      .getByRole("button", { name: "Registrar versión", exact: true })
      .click();
    await collaborator
      .getByText("Versión registrada. La revisión humana queda pendiente.", {
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Registrar versión", exact: true })
      .click();
    await page
      .getByText("Versión registrada. La revisión humana queda pendiente.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Historial", exact: true }).click();
    await expect
      .poll(() => page.locator(".workspace-history>div").count())
      .toBe(2);
    await page
      .getByRole("button", { name: "Ver versión", exact: true })
      .first()
      .click();
    await page
      .getByRole("document", { name: "Contenido de la versión registrada" })
      .waitFor();
    expect(await page.locator(".workspace-version-preview table").count()).toBe(
      1,
    );
    await page
      .getByRole("button", { name: "Cerrar vista", exact: true })
      .click();
    const initialVersion = await repository.core.getDocumentVersion(
      "local-administrator",
      seed!.firm.id,
      seed!.matter.id,
      seed!.document.id,
      seed!.version.id,
    );
    expect(initialVersion.sha256).toBe(seed!.version.sha256);
    expect(initialVersion.original_base64).toBe(seed!.version.original_base64);
    const beforeRestart = await editor.evaluate(read);
    // Browser recovery is a real IndexedDB copy. The reload uses that copy plus the server document.
    await collaborator.reload();
    await expect.poll(() => otherEditor.evaluate(read)).toBe(beforeRestart);
    // A readonly grant cannot register a version or write a room, even with a valid token.
    const readonly = await repository.share(
      access!.token,
      access!.room.id,
      "local-lawyer",
      true,
    );
    const reader = await second.newPage();
    await reader.goto(
      `${origin}/?workspace=${readonly.room.id}#access=${readonly.token}`,
    );
    await reader
      .getByRole("textbox", { name: "Documento colaborativo" })
      .waitFor();
    expect(
      await reader
        .getByRole("textbox", { name: "Documento colaborativo" })
        .getAttribute("contenteditable"),
    ).toBe("false");
    expect(
      await reader
        .getByRole("button", { name: "Registrar versión", exact: true })
        .isDisabled(),
    ).toBe(true);
    await expect(
      repository.access(readonly.token, readonly.room.id, true),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    await expect(
      repository.access(access!.token, randomUUID()),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    await expect(
      repository.access("0".repeat(64), access!.room.id),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    await expect(
      repository.beginTask(readonly.token, readonly.room.id, {
        ...storedNotes.jobs[0].request,
        command_id: randomUUID(),
      }),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    await expect(
      repository.addComment(readonly.token, readonly.room.id, {
        command_id: randomUUID(),
        base_hash: "0".repeat(64),
        from: 0,
        to: 0,
        body: "Denied",
      }),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    const fork = structuredClone(seed!);
    fork.version.id = randomUUID();
    const forkText = Buffer.from(
      "Edición alternativa del formulario antiguo conservada.",
    );
    fork.version.original_base64 = forkText.toString("base64");
    fork.version.sha256 = createHash("sha256").update(forkText).digest("hex");
    fork.document.current_version_id = fork.version.id;
    fork.draft.document_version_id = fork.version.id;
    await expect(repository.adopt(fork)).rejects.toThrow(
      "WORKSPACE_SOURCE_INVALID",
    );
    delete fork.initial_rich; // A legacy text-only fork does not claim the original rich content.
    const roomBeforeFork = await repository.load(
      access!.token,
      access!.room.id,
    );
    const forkAccess = await repository.adopt(fork);
    expect(forkAccess.source_changed).toBe(true);
    expect(
      (await repository.load(forkAccess.token, access!.room.id)).state_hash,
    ).toBe(roomBeforeFork.state_hash);
    const invalidScope = structuredClone(seed!);
    invalidScope.matter.id = randomUUID();
    await expect(repository.adopt(invalidScope)).rejects.toThrow(
      "WORKSPACE_SCOPE_MISMATCH",
    );
    await repository.owner.query(
      "UPDATE os_private.workspace_grants SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [createHash("sha256").update(readonly.token).digest("hex")],
    );
    await expect(
      repository.access(readonly.token, readonly.room.id),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    const state = await repository.receipt(access!.token, access!.room.id);
    const command = randomUUID();
    const checkpoint = await repository.checkpoint(
      access!.token,
      access!.room.id,
      command,
      state.state_hash,
    );
    expect(checkpoint.draft.coauthor_identity_ids).toEqual(
      expect.arrayContaining(["local-administrator", "local-lawyer"]),
    );
    await expect(
      repository.core.requestDraftReview(
        "local-administrator",
        seed!.firm.id,
        seed!.matter.id,
        seed!.draft.id,
        "local-lawyer",
        null,
      ),
    ).rejects.toThrow("SELF_REVIEW_FORBIDDEN");
    expect(
      await repository.checkpoint(
        access!.token,
        access!.room.id,
        command,
        state.state_hash,
      ),
    ).toEqual(checkpoint);
    await expect(
      repository.checkpoint(
        access!.token,
        access!.room.id,
        randomUUID(),
        "0".repeat(64),
      ),
    ).rejects.toThrow("WORKSPACE_VERSION_CONFLICT");
    // Coauthor permissions do not silently relax the legacy draft editing route.
    const collaboratorToken = new URL(link).hash.slice("#access=".length);
    await expect(
      repository.core.reviseDraft(
        "local-lawyer",
        seed!.firm.id,
        seed!.matter.id,
        seed!.draft.id,
        checkpoint.version.id,
        "No autorizado por la ruta anterior",
      ),
    ).rejects.toThrow();
    // Real restart: destroy Hocuspocus rooms/connections, use a new repository against the SAME test database.
    await second.close();
    const pools = { owner: repository.owner, runtime: repository.runtime };
    const ownerConfig = pools.owner.options,
      runtimeConfig = pools.runtime.options;
    await bridge.close();
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Sin conexión · copia local");
    await editor.evaluate(insert, " Cambio pendiente durante el reinicio.");
    expect(await editor.evaluate(read)).toContain(
      "Cambio pendiente durante el reinicio.",
    );
    expect(
      await page
        .getByRole("button", { name: "Registrar versión", exact: true })
        .isDisabled(),
    ).toBe(true);
    const { Pool } = await import("pg");
    const restarted = new WorkspaceRepository(
      new Pool(ownerConfig),
      new Pool(runtimeConfig),
      db.blobs,
    );
    bridge = createWorkspaceBridge(process.cwd(), origin, {
      repository: restarted,
      runAI,
    });
    // Existing upgrade listener refers to the closed bridge. Restart HTTP as well on the same ephemeral port.
    server.removeAllListeners("upgrade");
    bridge.attach(server);
    // Wait for local recovery to replay and receive a NEW durable acknowledgment before reloading.
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText(), {
        timeout: 20000,
      })
      .toBe("Guardado en servidor local");
    const afterRecovery = await editor.evaluate(read);
    expect(afterRecovery).toContain("Cambio pendiente durante el reinicio.");
    await page.reload();
    await page.getByRole("button", { name: "Asuntos", exact: true }).click();
    await page
      .getByText("Contrato colaborativo sintético", { exact: true })
      .click();
    // Reopening the matter resumes its last document without a second chooser.
    await expect.poll(() => editor.evaluate(read)).toBe(afterRecovery);
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    const reloadedState = await restarted.load(access!.token, access!.room.id);
    expect(reloadedState.revision).toBeGreaterThan(1);
    const browserState = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("law-order-os.local.v1")!),
    );
    for (const original of originals) {
      const version = browserState.tables.documentVersions.find(
        (value: { original_filename: string }) =>
          value.original_filename === original.name,
      );
      expect(version.original_base64).toBe(original.buffer.toString("base64"));
    }
    const revokedContext = await browser.newContext();
    await revokedContext.addInitScript(syntheticMicrophone);
    await revokedContext.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    const revokedPage = await revokedContext.newPage();
    await revokedPage.goto(link);
    await revokedPage
      .getByRole("textbox", { name: "Documento colaborativo" })
      .waitFor();
    await revokedPage
      .locator(".workspace-call-toggle")
      .click();
    await revokedPage
      .getByRole("button", { name: "Unirse a la llamada", exact: true })
      .click();
    await revokedPage
      .locator(".workspace-call-panel")
      .getByRole("button", { name: "Activar micrófono", exact: true })
      .waitFor();
    const liveGrant = await restarted.access(
      collaboratorToken,
      access!.room.id,
    );
    await page.getByRole("button", { name: "Compartir", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Retirar acceso del colaborador",
        exact: true,
      })
      .click();
    await revokedPage
      .getByText(
        "El acceso venció o fue retirado. Volvé a abrir el documento desde el asunto.",
        { exact: true },
      )
      .waitFor();
    await expect
      .poll(() =>
        revokedPage
          .getByRole("textbox", { name: "Documento colaborativo" })
          .getAttribute("contenteditable"),
      )
      .toBe("false");
    await expect
      .poll(() =>
        revokedPage.evaluate(() =>
          (window as any).__testCallStreams.every((s: MediaStream) =>
            s.getTracks().every((t) => t.readyState === "ended"),
          ),
        ),
      )
      .toBe(true);
    await revokedContext.close();
    await expect(
      restarted.access(collaboratorToken, access!.room.id),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    const latest = await restarted.load(access!.token, access!.room.id);
    await expect(
      restarted.save(
        liveGrant.grant,
        liveGrant.room,
        latest.y_state,
        latest.y_vector,
        { type: "doc", content: [{ type: "paragraph" }] },
      ),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    // Import opens a working copy, then Gabriel proposes and runs the confirmed team.
    await page.getByRole("button", { name: "Compartir", exact: true }).click();
    await page.getByRole("button", { name: "Archivos", exact: true }).click();
    await page
      .locator(".word-original-choice")
      .filter({ hasText: originals[1]!.name })
      .getByRole("button")
      .click();
    await expect
      .poll(() => editor.innerText(), { timeout: 15000 })
      .toContain("Contrato sintético Word");
    expect(await editor.locator("strong").innerText()).toContain(
      "Contrato sintético Word",
    );
    expect(await editor.locator("table").innerText()).toContain("A confirmar");
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    const importedAccess = access!;
    const importedEntry = page.locator(".workspace-file-entry").filter({
      has: page.getByRole("button", {
        name: "Abrir " + originals[1]!.name,
        exact: true,
      }),
    });
    expect(await importedEntry.count()).toBe(1);
    expect(
      await page
        .getByRole("button", {
          name: "Abrir " + originals[1]!.name,
          exact: true,
        })
        .count(),
    ).toBe(1);
    expect(await importedEntry.locator("summary").innerText()).toBe(
      "Original conservado",
    );
    expect(
      await page
        .getByRole("button", { name: "Adjuntar documentos", exact: true })
        .count(),
    ).toBe(1);
    expect(
      await page
        .getByRole("button", { name: "↥ Adjuntar", exact: true })
        .count(),
    ).toBe(0);
    expect(
      await page
        .getByRole("button", {
          name: "↥ Abrir un contrato o escrito",
          exact: true,
        })
        .count(),
    ).toBe(0);
    await page.getByLabel("Tu mensaje a Gabriel", { exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator(".workspace-chat-entry")
          .evaluate((el) => getComputedStyle(el).borderTopColor),
      )
      .toBe("rgb(33, 76, 89)");
    // Nonempty attachments survive PostgreSQL JSONB key ordering between steps.
    await page
      .locator(".word-original-choice")
      .filter({ hasText: originals[2]!.name })
      .getByRole("checkbox")
      .check();
    expect(await page.getByLabel("Participante IA").count()).toBe(0);
    await page.locator(".word-mode summary").click();
    await page.getByLabel("Modo de ejecución del editor").selectOption("LIVE");
    const beforeDictation =
      "Desde nuestra posición: " +
      "Contexto completo del cliente. ".repeat(100);
    await page.getByLabel("Tu mensaje a Gabriel").fill(beforeDictation);
    const beforeVoice = await editor.innerText();
    await browserExpect(
      page.getByRole("button", { name: "Dictar", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Dictar", exact: true }).click();
    await page.getByRole("meter", { name: "Nivel del micrófono" }).waitFor();
    // Produce enough synthetic samples for the real bounded WAV recorder.
    await page.waitForTimeout(700);
    await page
      .getByRole("button", { name: "■ Terminar dictado", exact: true })
      .click();
    await expect
      .poll(() => page.getByLabel("Tu mensaje a Gabriel").inputValue())
      .toContain("Analizá el contrato abierto");
    expect(
      await page.getByLabel("Tu mensaje a Gabriel").inputValue(),
    ).toContain(beforeDictation.trim());
    expect(await editor.innerText()).toBe(beforeVoice);
    expect(
      (await restarted.notes(importedAccess.token, importedAccess.room.id))
        .jobs,
    ).toHaveLength(0);
    expect(transcriptions).toBe(1);
    await page.getByRole("button", { name: "Dictar", exact: true }).click();
    await page.getByRole("meter", { name: "Nivel del micrófono" }).waitFor();
    await page.getByRole("button", { name: "Plegar asistente" }).click();
    await page.getByRole("button", { name: /Equipo y comentarios/ }).click();
    await browserExpect(
      page.getByRole("button", { name: "Dictar", exact: true }),
    ).toBeEnabled();
    expect(transcriptions).toBe(1);
    expect(
      await page.getByRole("meter", { name: "Nivel del micrófono" }).count(),
    ).toBe(0);
    await page.locator(".word-mode summary").click();
    await page
      .getByLabel("Modo de ejecución del editor")
      .selectOption("OFFLINE_TEST");
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill(
        "Analizá los riesgos jurídicos y comerciales del documento abierto.",
      );
    await page.setViewportSize({ width: 1242, height: 600 });
    pauseNextTask = true;
    await page.getByRole("button", { name: /Ejecutar prueba offline/ }).click();
    await page.locator(".workspace-task-progress").waitFor();
    await expect
      .poll(() =>
        page.locator(".workspace-message-editor").getAttribute("open"),
      )
      .toBe(null);
    expect(
      (await page.locator(".workspace-message-editor").boundingBox())!.height,
    ).toBeLessThanOrEqual(34);
    expect(
      (await page.locator(".workspace-conversation").boundingBox())!.height,
    ).toBeGreaterThan(150);
    await page.locator(".workspace-message-editor>summary").click();
    await browserExpect(page.getByLabel("Tu mensaje a Gabriel")).toBeVisible();
    const composerHeight = (await page
      .locator(".workspace-message-editor")
      .boundingBox())!.height;
    const bodyHeight = (await page
      .locator(".word-assistant-body")
      .boundingBox())!.height;
    expect(composerHeight).toBeLessThanOrEqual(bodyHeight * 0.45);
    await page.locator(".workspace-message-editor>summary").click();
    await page.screenshot({
      path: report + "/workspace-processing-compact.png",
      fullPage: true,
    });
    releaseTask?.();
    await page.getByLabel("Equipo propuesto por Gabriel").waitFor();
    await page.setViewportSize({ width: 1366, height: 768 });
    let caseNotes = await restarted.notes(
      importedAccess.token,
      importedAccess.room.id,
    );
    expect(caseNotes.jobs).toHaveLength(1);
    expect(caseNotes.jobs[0].request.action).toBe("PLAN");
    const planJob = caseNotes.jobs[0];
    expect(planJob.request.attachments).toHaveLength(1);
    await expect(
      restarted.beginTask(importedAccess.token, importedAccess.room.id, {
        ...planJob.request,
        command_id: randomUUID(),
        action: "ANALYZE",
        plan_id: planJob.id,
        agent_id: planJob.result.team_plan.lead_id,
        attachments: planJob.request.attachments.map((a: any) => ({
          ...a,
          title: "Changed attachment title",
        })),
      }),
    ).rejects.toThrow("WORKSPACE_PLAN_STALE");
    await page.getByLabel("Modo de ejecución del editor").selectOption("LIVE");
    await browserExpect(
      page.getByRole("button", { name: "▷ Escuchar respuesta", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "▷ Escuchar respuesta", exact: true })
      .click();
    await page
      .getByText("Reproduciendo respuesta · voz IA", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Detener voz", exact: true })
      .click();
    expect(readings).toBe(1);
    expect(transcriptions).toBe(1);
    expect(await editor.innerText()).toBe(beforeVoice);
    await page
      .getByLabel("Modo de ejecución del editor")
      .selectOption("OFFLINE_TEST");
    await browserExpect(
      page.getByRole("button", { name: "Dictar", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: report + "/workspace-team-conversation-1366.png",
      fullPage: true,
    });
    const widthOpen = await editor.evaluate(
      (e) => e.getBoundingClientRect().width,
    );
    await page.getByRole("button", { name: "Plegar asistente" }).click();
    const widthClosed = await editor.evaluate(
      (e) => e.getBoundingClientRect().width,
    );
    expect(widthClosed).toBeGreaterThan(widthOpen);
    await page.getByRole("button", { name: /Equipo y comentarios/ }).click();
    await page
      .getByRole("button", { name: /Confirmar equipo y probar análisis/ })
      .click();
    const centralReview = page.getByRole("region", {
      name: "Revisión junto al documento",
    });
    await centralReview.waitFor();
    expect(
      await page
        .getByRole("button", { name: /Equipo y comentarios/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    await browserExpect(
      page.getByLabel("Trabajo junto al documento"),
    ).toBeHidden();
    await page.locator(".workspace-review-mark").first().waitFor();
    await page.locator(".workspace-review-mark").first().click();
    await page.getByText("Alternativa propuesta", { exact: true }).waitFor();
    const centralBox = await centralReview.boundingBox(),
      documentBox = await editor.boundingBox();
    expect(centralBox!.x).toBeGreaterThan(
      documentBox!.x + documentBox!.width - 2,
    );
    expect(centralBox!.width).toBeGreaterThan(400);
    await page
      .getByRole("button", { name: "Plegar archivos", exact: true })
      .click();
    await browserExpect(
      page.getByLabel("Documentos de trabajo", { exact: true }),
    ).toBeHidden();
    expect((await editor.boundingBox())!.width).toBeGreaterThan(
      documentBox!.width,
    );
    await page.getByRole("button", { name: "Archivos", exact: true }).click();
    caseNotes = await restarted.notes(
      importedAccess.token,
      importedAccess.room.id,
    );
    expect(caseNotes.jobs).toHaveLength(2);
    expect(caseNotes.jobs[0].request.plan_id).toBe(planJob.id);
    expect(caseNotes.jobs[0].result.team_outputs).toHaveLength(2);
    const receiptNow = await restarted.receipt(
      importedAccess.token,
      importedAccess.room.id,
    );
    await expect(
      restarted.beginTask(importedAccess.token, importedAccess.room.id, {
        ...caseNotes.jobs[0].request,
        command_id: randomUUID(),
        base_hash: receiptNow.state_hash,
      }),
    ).rejects.toThrow("WORKSPACE_PLAN_ALREADY_EXECUTED");
    await page.screenshot({
      path: report + "/workspace-interactive-review-1366.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Aplicar alternativa", exact: true })
      .click();
    await expect
      .poll(() => editor.innerText())
      .toContain("PROPUESTA SINTÉTICA DE PRUEBA");
    expect(await editor.locator("table").innerText()).toContain("A confirmar");
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await expect
      .poll(
        async () =>
          (await restarted.notes(importedAccess.token, importedAccess.room.id))
            .decisions[0]?.status,
      )
      .toBe("APPLIED");
    await page
      .getByRole("button", { name: "Observación siguiente", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Aplicar alternativa", exact: true })
      .click();
    await expect
      .poll(() => editor.innerText())
      .toContain("SEGUNDA PROPUESTA SINTÉTICA");
    await expect
      .poll(
        async () =>
          (
            await restarted.notes(importedAccess.token, importedAccess.room.id)
          ).decisions.filter((d: any) => d.status === "APPLIED").length,
      )
      .toBe(2);
    expect(await editor.locator("table").innerText()).toContain("A confirmar");
    await page
      .getByRole("button", { name: "Observación siguiente", exact: true })
      .click();
    await browserExpect(
      page.getByRole("button", { name: "Aplicar alternativa", exact: true }),
    ).toBeDisabled();
    // A human can explicitly bind an uncertain quote to the selected clause.
    await editor.locator("td").last().click({ clickCount: 3 });
    await page
      .getByRole("button", {
        name: "Vincular selección del documento",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (
            await restarted.notes(importedAccess.token, importedAccess.room.id)
          ).decisions.find((d: any) => d.finding_index === 2)?.status,
      )
      .toBe("LINKED");
    await browserExpect(
      page.getByRole("button", { name: "Aplicar alternativa", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Descartar observación", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await restarted.notes(importedAccess.token, importedAccess.room.id)
          ).decisions.find((d: any) => d.finding_index === 2)?.status,
      )
      .toBe("DISMISSED");
    const reviewReader = await restarted.share(
      importedAccess.token,
      importedAccess.room.id,
      "local-lawyer",
      true,
    );
    const readNotes = await restarted.notes(
      reviewReader.token,
      importedAccess.room.id,
    );
    expect(readNotes.decisions).toHaveLength(3);
    await expect(
      restarted.reviewDecision(reviewReader.token, importedAccess.room.id, {
        job_id: caseNotes.jobs[0].id,
        finding_index: 2,
        status: "OPEN",
        base_hash: (
          await restarted.receipt(importedAccess.token, importedAccess.room.id)
        ).state_hash,
        from: 0,
        to: 0,
        quote: "",
      }),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    const decisionHash = (
      await restarted.receipt(importedAccess.token, importedAccess.room.id)
    ).state_hash;
    await expect(
      restarted.reviewDecision(importedAccess.token, importedAccess.room.id, {
        job_id: caseNotes.jobs[0].id,
        finding_index: 2,
        status: "OPEN",
        base_hash: "0".repeat(64),
        from: 0,
        to: 0,
        quote: "",
      }),
    ).rejects.toThrow("WORKSPACE_VERSION_CONFLICT");
    await expect(
      restarted.reviewDecision(importedAccess.token, importedAccess.room.id, {
        job_id: caseNotes.jobs[0].id,
        finding_index: 2,
        status: "APPLIED",
        base_hash: decisionHash,
        from: 1,
        to: 4,
        quote: "Una cita inventada",
      }),
    ).rejects.toThrow("WORKSPACE_REVIEW_PASSAGE_CHANGED");
    // Undo restores the clause without losing the independent first decision.
    await editor.press("Control+z");
    await expect
      .poll(() => editor.innerText())
      .toContain("Cláusula final conservada.");
    await expect
      .poll(() => editor.innerText())
      .toContain("PROPUESTA SINTÉTICA DE PRUEBA");
    await page
      .getByRole("button", {
        name: "Revisar observación 2: Segunda cláusula",
        exact: true,
      })
      .click();
    expect(await centralReview.innerText()).not.toContain(
      "Observación descartada; decisión compartida guardada.",
    );
    await browserExpect(
      page.getByRole("button", { name: "Aplicar alternativa", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: report + "/workspace-central-review-1366.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Plegar archivos", exact: true })
      .click();
    await page.setViewportSize({ width: 1024, height: 768 });
    expect((await editor.boundingBox())!.width).toBeGreaterThan(450);
    expect((await centralReview.boundingBox())!.width).toBeGreaterThan(300);
    await page.screenshot({
      path: report + "/workspace-central-review-1024.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole("button", { name: "Archivos", exact: true }).click();
    await page
      .getByRole("button", { name: "Abrir " + originals[1]!.name, exact: true })
      .click();
    await expect
      .poll(() => editor.innerText())
      .toContain("PROPUESTA SINTÉTICA DE PRUEBA");
    expect(access!.room.id).toBe(importedAccess.room.id);
    await centralReview.waitFor();
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await page.locator(".review-discussion summary").click();
    await page
      .getByLabel("Consulta sobre la observación")
      .fill("¿Por qué esta cláusula requiere otra redacción?");
    await page
      .getByRole("button", {
        name: "Preparar consulta sobre este pasaje →",
        exact: true,
      })
      .click();
    expect(
      await page.getByLabel("Tu mensaje a Gabriel").inputValue(),
    ).toContain("¿Por qué esta cláusula");
    expect(
      (await restarted.notes(importedAccess.token, importedAccess.room.id))
        .jobs,
    ).toHaveLength(2);
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill("Borrador de consulta que debe conservarse al plegar.");
    await page.getByRole("button", { name: "Plegar asistente" }).click();
    await page.getByRole("button", { name: /Equipo y comentarios/ }).click();
    expect(
      await page.getByLabel("Tu mensaje a Gabriel").inputValue(),
    ).toContain("debe conservarse");
    // Files is the single upload entry point and immediately opens a preserved copy.
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Adjuntar documentos", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({
      name: "Nuevo escrito.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Nuevo escrito sintético abierto desde el chat."),
    });
    await expect
      .poll(() => editor.innerText())
      .toBe("Nuevo escrito sintético abierto desde el chat.");
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    failIntegrationOnce = true;
    await page
      .locator(".word-original-choice")
      .filter({ hasText: originals[2]!.name })
      .getByRole("checkbox")
      .check();
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill("Revisá el documento y sus riesgos para el cliente.");
    await page.getByRole("button", { name: /Ejecutar prueba offline/ }).click();
    await page
      .getByRole("button", { name: /Confirmar equipo y probar análisis/ })
      .click();
    await page.getByRole("button", { name: /Completar integración/ }).waitFor();
    const recoveryAccess = access!;
    const beforeRecovery = await restarted.notes(
      recoveryAccess.token,
      recoveryAccess.room.id,
    );
    const failedJob = beforeRecovery.jobs.find(
      (j: any) => j.status === "FAILED",
    )!;
    expect(failedJob.result.team_outputs).toHaveLength(2);
    expect(failedJob.request.attachments).toHaveLength(1);
    // A plan already presented by an old tab can be confirmed after another
    // collaborator completes the analysis; it must not launch another team.
    const pendingDraft = await restarted.beginTask(
      recoveryAccess.token,
      recoveryAccess.room.id,
      {
        ...failedJob.request,
        command_id: randomUUID(),
        plan_id: undefined,
        action: "PLAN",
        agent_id: "gabriel",
        instruction:
          "Aplica las modificaciones sugeridas segun los hallazgos. y redacta de nuevo el contrato",
      },
    );
    expect(pendingDraft.job.request.action).toBe("PLAN");
    await restarted.finishTask(pendingDraft.job, {
      ...failedJob.result,
      team_plan: failedJob.context.team_plan,
    });
    await page.getByRole("button", { name: /Completar integración/ }).click();
    await page
      .getByRole("region", { name: "Revisión junto al documento" })
      .waitFor();
    const afterIntegration = await restarted.notes(
      recoveryAccess.token,
      recoveryAccess.room.id,
    );
    const completed = afterIntegration.jobs.find(
      (j: any) => j.request.resume_job_id === failedJob.id,
    )!;
    expect(completed.status).toBe("COMPLETED");
    expect(completed.request.action).toBe("INTEGRATE");
    const pendingConfirmation = {
      ...pendingDraft.job.request,
      command_id: randomUUID(),
      action: "ANALYZE",
      agent_id: failedJob.context.team_plan!.lead_id,
      plan_id: pendingDraft.job.id,
    };
    const converted = await restarted.beginTask(
      recoveryAccess.token,
      recoveryAccess.room.id,
      pendingConfirmation,
    );
    // A confirmed legacy team remains its explicit operation; no regex rewrites it.
    expect(converted.job.request.action).toBe("ANALYZE");
    expect(converted.job.request.plan_id).toBe(pendingDraft.job.id);
    expect(converted.job.context.team_plan).toBeDefined();
    await restarted.finishTask(
      converted.job,
      null,
      "WORKSPACE_TEST_INTERRUPTED",
    );
    expect(
      (
        await restarted.beginTask(
          recoveryAccess.token,
          recoveryAccess.room.id,
          pendingConfirmation,
        )
      ).fresh,
    ).toBe(false);
    await expect(
      restarted.beginTask(recoveryAccess.token, recoveryAccess.room.id, {
        ...pendingConfirmation,
        command_id: randomUUID(),
      }),
    ).rejects.toThrow("WORKSPACE_PLAN_ALREADY_EXECUTED");
    expect(completed.result.team_outputs.map((o: any) => o.agent_id)).toEqual(
      failedJob.result.team_outputs.map((o: any) => o.agent_id),
    );
    await expect(
      restarted.beginTask(recoveryAccess.token, recoveryAccess.room.id, {
        ...completed.request,
        command_id: randomUUID(),
      }),
    ).rejects.toThrow("WORKSPACE_INTEGRATION_ALREADY_RESUMED");
    expect(
      (
        await restarted.beginTask(
          recoveryAccess.token,
          recoveryAccess.room.id,
          completed.request,
        )
      ).fresh,
    ).toBe(false);
    await page.screenshot({
      path: report + "/workspace-recovered-integration-1366.png",
      fullPage: true,
    });
    // The director receives saved findings for every follow-up and chooses the task.
    await page
      .getByRole("button", { name: "Descartar observación", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
          ).decisions.find(
            (d: any) => d.job_id === completed.id && d.finding_index === 0,
          )?.status,
      )
      .toBe("DISMISSED");
    const longContract =
      "Nuevo escrito sintético abierto desde el chat.\n" +
      "Cláusula contractual conservada sin alteraciones. ".repeat(460) +
      "\nCLÁUSULA FINAL CONSERVADA.";
    await editor.fill(longContract);
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    const beforeDrafting = await editor.innerText();
    // Prior clients also receive server-derived memory, without regex conversion.
    const legacyRequest = {
      ...completed.request,
      command_id: randomUUID(),
      base_hash: (
        await restarted.receipt(recoveryAccess.token, recoveryAccess.room.id)
      ).state_hash,
      action: "PLAN",
      agent_id: "gabriel",
      resume_job_id: undefined,
      instruction:
        "Aplica las modificaciones sugeridas segun los hallazgos. y redacta de nuevo el contrato",
    };
    const legacy = await restarted.beginTask(
      recoveryAccess.token,
      recoveryAccess.room.id,
      legacyRequest,
    );
    expect(legacy.job.request.action).toBe("PLAN");
    expect(legacy.job.request.analysis_job_id).toBeUndefined();
    expect(legacy.job.context.team_plan).toBeUndefined();
    expect(legacy.job.context.director_state!.analysis!.job_id).toBe(
      completed.id,
    );
    expect(
      legacy.job.context.director_state!.analysis!.findings[0]!.decision,
    ).toBe("DISMISSED");
    expect(
      (
        await restarted.beginTask(
          recoveryAccess.token,
          recoveryAccess.room.id,
          legacyRequest,
        )
      ).fresh,
    ).toBe(false);
    await restarted.finishTask(
      legacy.job,
      null,
      "INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS",
      {
        response_status: "incomplete",
        incomplete_reason: "max_output_tokens",
        max_output_tokens: 12000,
        output_tokens: 12000,
        reasoning_tokens: 9000,
      },
    );
    const diagnosticNotes = await restarted.notes(
      recoveryAccess.token,
      recoveryAccess.room.id,
    );
    expect(
      diagnosticNotes.jobs.find((j: any) => j.id === legacy.job.id)?.result
        ?.failure_details?.reasoning_tokens,
    ).toBe(9000);
    await page.getByRole("button", { name: /Equipo y comentarios/ }).click();
    nextDirectorDraft = "DOCUMENT";
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill(
        "redacatame el contrato tomando en cuenta todos los hallazgos encontrados",
      );
    await page.getByRole("button", { name: /Ejecutar prueba offline/ }).click();
    const preparedView = page.getByRole("region", {
      name: "Versión propuesta junto al documento",
      exact: true,
    });
    await preparedView.waitFor();
    const revisionNotes = await restarted.notes(
      recoveryAccess.token,
      recoveryAccess.room.id,
    );
    const revisionJob = revisionNotes.jobs.find(
      (j: any) => j.result?.execution,
    )!;
    expect(revisionJob.request.action).toBe("PLAN");
    expect(revisionJob.request.agent_id).toBe("gabriel");
    expect(revisionJob.request.conversation).toBeUndefined();
    expect(revisionJob.result.execution.analysis_job_id).toBe(completed.id);
    expect(
      revisionJob.context.director_state.analysis.findings[0].decision,
    ).toBe("DISMISSED");
    expect(revisionJob.result.replacement_text.length).toBeGreaterThan(20000);
    expect(await editor.innerText()).toBe(beforeDrafting);
    expect(
      await preparedView.locator(".workspace-prepared-text").innerText(),
    ).toContain("CLÁUSULA FINAL CONSERVADA.");
    await expect(
      restarted.beginTask(recoveryAccess.token, recoveryAccess.room.id, {
        ...revisionJob.request,
        action: "REWRITE",
        agent_id: "elena",
        command_id: randomUUID(),
        analysis_job_id: planJob.id,
      }),
    ).rejects.toThrow("WORKSPACE_REVISION_BASIS_INVALID");
    await page.screenshot({
      path: report + "/workspace-prepared-contract.png",
      fullPage: true,
    });
    await preparedView
      .getByRole("button", {
        name: "Aplicar versión al documento",
        exact: true,
      })
      .click();
    await expect
      .poll(() => editor.innerText())
      .toContain("PROPUESTA SINTÉTICA DE PRUEBA.");
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await editor.press("Control+z");
    await expect.poll(() => editor.innerText()).toBe(beforeDrafting);
    // Follow-up conversation accepts the whole human message and document,
    // including Unicode evidence whose UTF-8 representation exceeds 60 KB.
    const largeOpenDocument =
      "Cláusula íntegra: obligación y excepción. ".repeat(1800);
    await editor.fill(largeOpenDocument);
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    const composer = page.getByLabel("Tu mensaje a Gabriel", { exact: true });
    await page.getByRole("button", { name: /Equipo y comentarios/ }).click();
    await page.locator(".workspace-chat-composer").waitFor();
    if (!(await composer.isVisible()))
      await page.locator(".workspace-chat-composer summary").click();
    const longFollowup =
      "Vi el documento. Explicame qué queda pendiente, sin modificarlo. ".repeat(
        40,
      );
    await composer.fill(longFollowup);
    expect(await composer.inputValue()).toBe(longFollowup);
    expect(await composer.getAttribute("maxlength")).toBeNull();
    nextDirectorReply =
      "Respuesta sintética directa: quedan decisiones humanas pendientes.";
    await page.getByRole("button", { name: /Ejecutar prueba offline/ }).click();
    await expect
      .poll(
        async () =>
          (
            await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
          ).jobs.find((j: any) => j.request.instruction === longFollowup.trim())
            ?.status,
        { timeout: 20000 },
      )
      .toBe("COMPLETED");
    const followup = (
      await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
    ).jobs.find((j: any) => j.request.instruction === longFollowup.trim())!;
    expect(followup.request.instruction).toBe(longFollowup.trim());
    expect(followup.result!.team_plan!.kind).toBe("DIRECT");
    expect(followup.context.document!.text).toBe(largeOpenDocument);
    expect(Buffer.byteLength(followup.context.document!.text)).toBeGreaterThan(
      60000,
    );
    expect(await editor.innerText()).toBe(largeOpenDocument);
    // The live UI uses the conversational tool runtime: one message -> selected
    // specialists -> analysis -> proposal, without a team-confirmation button.
    await editor.fill(
      "Contrato sintético para el flujo conversacional.\nCláusula final conservada.",
    );
    await expect
      .poll(() => page.locator(".workspace-save-state").innerText())
      .toBe("Guardado en servidor local");
    await page.locator(".word-mode summary").click();
    await page.getByLabel("Modo de ejecución del editor").selectOption("LIVE");
    nextAgentTools = [
      {
        name: "analyze_with_specialists",
        args: {
          instruction: "Analizar riesgos y alternativas del documento.",
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
        },
      },
      {
        name: "prepare_document",
        args: {
          agent_id: "valeria",
          instruction:
            "Preparar una versión atendiendo los hallazgos conservados.",
          action: "REWRITE",
          scope: "DOCUMENT",
          analysis_job_id: "CURRENT_JOB",
          proposal_job_id: null,
        },
      },
      "Analicé el caso con los especialistas y preparé una propuesta revisable.",
    ];
    const nativeInstruction =
      "Analicen este caso y después preparen una versión con los resultados.";
    await page.getByLabel("Tu mensaje a Gabriel").fill(nativeInstruction);
    await page.getByRole("button", { name: "Enviar →", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
          ).jobs.find((j: any) => j.request.instruction === nativeInstruction)
            ?.status,
        { timeout: 20000 },
      )
      .toBe("COMPLETED");
    const nativeJob = (
      await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
    ).jobs.find((j: any) => j.request.instruction === nativeInstruction)!;
    expect(nativeJob.request.workflow_version).toBe(4);
    expect(nativeJob.result!.agent_trace!.map((t: any) => t.status)).toEqual([
      "COMPLETED",
      "COMPLETED",
    ]);
    expect(nativeJob.result!.replacement_text).toContain("PROPUESTA SINTÉTICA");
    await browserExpect(
      page.getByRole("list", { name: "Etapas del trabajo" }),
    ).toHaveCount(0);
    const storedProposal = await restarted.savedWork(
      recoveryAccess.token,
      recoveryAccess.room.id,
      "read_saved_work",
      { job_id: nativeJob.id, part: "PROPOSAL" },
    );
    expect(storedProposal.replacement_text).toBe(
      nativeJob.result!.replacement_text,
    );
    const storedAnalysis = await restarted.savedWork(
      recoveryAccess.token,
      recoveryAccess.room.id,
      "read_saved_work",
      { job_id: nativeJob.id, part: "ANALYSIS" },
    );
    expect(storedAnalysis.analysis!.findings).toHaveLength(1);
    // Floating voice -> actual document grants -> PostgreSQL generated proposal.
    // No OpenAI requests; the same real WebRTC channel survives opening the editor.
    const durableBeforeVoice = await restarted.receipt(
      recoveryAccess.token,
      recoveryAccess.room.id,
    );
    await page.evaluate(installNativePeer);
    await page.route("**/local/gabriel/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/status"))
        return route.fulfill({ json: { ready: true } });
      if (path.endsWith("/realtime/state"))
        return route.fulfill({
          json: { ended: false, estimated_usd: 0, responses: 0 },
        });
      if (path.endsWith("/realtime/stop"))
        return route.fulfill({ json: { stopped: true } });
      if (path.endsWith("/realtime")) {
        const sdp = await page.evaluate(
          (sdp) => (window as any).__documentVoice.answer(sdp),
          route.request().postDataJSON().sdp,
        );
        return route.fulfill({
          json: { sdp, session_id: "synthetic-document-session" },
        });
      }
      return route.abort();
    });
    await page
      .getByRole("button", { name: "Gabriel · voz", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Conversar por voz", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__documentVoice.channel?.readyState,
        ),
      )
      .toBe("open");
    const voiceTool = async (name: string, args: unknown) => {
      const id = randomUUID();
      await page.evaluate(
        ({ name, args, id }) =>
          (window as any).__documentVoice.emit({
            type: "response.function_call_arguments.done",
            call_id: id,
            name,
            arguments: JSON.stringify(args),
          }),
        { name, args, id },
      );
      await expect
        .poll(() =>
          page.evaluate(
            (id) =>
              (window as any).__documentVoice.sent.some(
                (e: any) => e.item?.call_id === id,
              ),
            id,
          ),
        )
        .toBe(true);
      return page.evaluate(
        (id) =>
          JSON.parse(
            (window as any).__documentVoice.sent.find(
              (e: any) => e.item?.call_id === id,
            ).item.output,
          ),
        id,
      );
    };
    await voiceTool("navigate_os", { destination: "dashboard" });
    const inventory = await voiceTool("workspace_documents", {});
    expect(
      inventory.documents.some((d: any) => d.draft_id === seed!.draft.id),
    ).toBe(true);
    const voiceTarget = {
      matter_id: seed!.matter.id,
      draft_id: seed!.draft.id,
    };
    const voiceProposal = await voiceTool("read_workspace", {
      ...voiceTarget,
      source: "PROPOSAL",
      job_id: nativeJob.id,
      open: true,
    });
    expect(JSON.parse(voiceProposal.text).replacement_text).toBe(
      storedProposal.replacement_text,
    );
    expect(voiceProposal.application_status).toBe(
      "NOT_INFERRED_FROM_GENERATION",
    );
    expect(JSON.stringify(voiceProposal)).not.toContain(recoveryAccess.token);
    await browserExpect(
      page.getByRole("textbox", {
        name: "Documento colaborativo",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => (window as any).__documentVoice.streams.length),
    ).toBe(1);
    expect(
      await page.evaluate(
        () =>
          (window as any).__documentVoice.streams[0].getAudioTracks()[0]
            .readyState,
      ),
    ).toBe("live");
    const voiceRead = await voiceTool("read_workspace", {
      ...voiceTarget,
      source: "DOCUMENT",
    });
    expect(voiceRead.state_hash).toBe(durableBeforeVoice.state_hash);
    expect(voiceRead.document_size).toBeGreaterThan(0);
    const wrongJob = await voiceTool("read_workspace", {
      matter_id: seed!.matter.id,
      draft_id: seed!.draft.id,
      source: "PROPOSAL",
      job_id: randomUUID(),
    });
    expect(wrongJob.error).toBeTruthy();
    // The async endpoint acknowledges the saved job while the specialist is paused.
    releaseTask = undefined;
    pauseNextTask = true;
    nextAgentTools = [
      "El trabajo guardado conserva decisiones humanas pendientes. No se modificó el contrato.",
    ];
    const voiceInstruction =
      "Explicá los pendientes del trabajo guardado sin cambiar el contrato.";
    const voiceDelegation = await voiceTool("delegate_workspace", {
      ...voiceTarget,
      instruction: voiceInstruction,
    });
    expect(voiceDelegation.status).toBe("RUNNING");
    const delegated = (
      await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
    ).jobs.find((j) => j.id === voiceDelegation.job_id)!;
    expect(delegated.request.action).toBe("PLAN");
    expect(delegated.request.workflow_version).toBe(4);
    await expect.poll(() => !!releaseTask, { timeout: 10000 }).toBe(true);
    (releaseTask as (() => void) | undefined)?.();
    releaseTask = undefined;
    await expect
      .poll(
        async () =>
          (
            await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
          ).jobs.find((j) => j.id === voiceDelegation.job_id)?.status,
        { timeout: 20000 },
      )
      .toBe("COMPLETED");
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            (window as any).__documentVoice.sent.some((e: any) =>
              e.item?.content?.[0]?.text?.startsWith(
                "Evento de la aplicación:",
              ),
            ),
          ),
        { timeout: 10000 },
      )
      .toBe(true);
    expect(
      (await restarted.receipt(recoveryAccess.token, recoveryAccess.room.id))
        .state_hash,
    ).toBe(durableBeforeVoice.state_hash);
    await page
      .getByRole("button", { name: "Cerrar conversación", exact: true })
      .click();
    expect(
      await page.evaluate(
        () =>
          (window as any).__documentVoice.streams[0].getAudioTracks()[0]
            .readyState,
      ),
    ).toBe("ended");
    await page.evaluate(() => {
      (window as any).__documentVoice.peer.close();
      void (window as any).__documentVoice.audio.close();
    });
    const nativeFollowup = await restarted.beginTask(
      recoveryAccess.token,
      recoveryAccess.room.id,
      {
        ...nativeJob.request,
        command_id: randomUUID(),
        instruction: "Explicame los pendientes sin modificar el contrato.",
      },
    );
    expect(nativeFollowup.job.context.director_state!.analysis!.job_id).toBe(
      nativeJob.id,
    );
    await restarted.finishTask(nativeFollowup.job, {
      summary: "Quedan decisiones humanas pendientes.",
      findings: [],
      replacement_text: null,
      references: [],
      limitations: [],
      simulated: true,
      sources: [],
      citation_check: [],
      semantic_check: "NOT_PERFORMED",
      jev_output: false,
      agent_trace: [],
    });
    expect(forkAccess.room.id).not.toBe(recoveryAccess.room.id);
    await expect(
      restarted.savedWork(
        forkAccess.token,
        forkAccess.room.id,
        "read_saved_work",
        { job_id: nativeJob.id, part: "CONVERSATION" },
      ),
    ).rejects.toThrow("WORKSPACE_HISTORY_NOT_FOUND");
    failBeforeProgress = true;
    const diagnosticResponse = await fetch(
      `${origin}/local/workspace/rooms/${recoveryAccess.room.id}/task`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace": "1",
          Origin: origin,
          Authorization: `Bearer ${recoveryAccess.token}`,
        },
        body: JSON.stringify({
          ...nativeJob.request,
          command_id: randomUUID(),
          instruction: "Prueba técnica de error anterior al primer avance.",
        }),
      },
    );
    expect(diagnosticResponse.status).toBe(200);
    const diagnosticJob = await diagnosticResponse.json();
    expect(diagnosticJob.status).toBe("FAILED");
    expect(diagnosticJob.error_code).toBe("WORKSPACE_FILE_ACCESS_FAILED");
    expect(diagnosticJob.result.failure_context).toMatchObject({
      category: "FILESYSTEM",
      native_code: "EACCES",
      stage: "EXECUTION",
    });
    expect(JSON.stringify(diagnosticJob)).not.toContain(
      "PRIVATE_DATA_MUST_NOT_LEAK",
    );
    expect(diagnosticJob.result.summary).toBeTruthy();
    const unchangedBeforeControl = (
      await restarted.receipt(recoveryAccess.token, recoveryAccess.room.id)
    ).state_hash;
    if (!(await page.getByLabel("Tu mensaje a Gabriel").count()))
      await page.getByRole("button", { name: /Equipo y comentarios/ }).click();
    if (!(await page.getByLabel("Tu mensaje a Gabriel").isVisible()))
      await page.locator(".workspace-chat-composer summary").click();
    // Audit/provider fixtures use their supplied evidence, independent of the
    // developer machine's growing legal corpus and ingestion processes.
    if (!(await page.getByLabel("Consultar Biblioteca local").isVisible()))
      await page.locator(".word-mode summary").click();
    await page.getByLabel("Consultar Biblioteca local").uncheck();
    nextControlled = "clean";
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill("Revisá el caso con el paquete de responsabilidad de Elena.");
    await page.getByRole("button", { name: "Enviar →", exact: true }).click();
    await expect
      .poll(
        async () => {
          const job = (
            await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
          ).jobs.find(
            (j) =>
              j.request.instruction ===
              "Revisá el caso con el paquete de responsabilidad de Elena.",
          );
          if (job?.status === "FAILED")
            throw Error(
              JSON.stringify({
                code: job.error_code,
                technical: job.result?.failure_context,
              }),
            );
          return {
            status: job?.status,
            code: job?.error_code,
            source: job?.result?.failure_context?.source,
          };
        },
        { timeout: 20000 },
      )
      .toMatchObject({ status: "COMPLETED", code: null });
    await browserExpect(
      page.locator(".workspace-conversation .workspace-quality").last(),
    ).toBeVisible();
    const controlledJob = (
      await restarted.notes(recoveryAccess.token, recoveryAccess.room.id)
    ).jobs.find(
      (j) =>
        j.request.instruction ===
        "Revisá el caso con el paquete de responsabilidad de Elena.",
    )!;
    expect(controlledJob.status).toBe("COMPLETED");
    expect(controlledJob.result!.specialist_bindings![0]!.pack_id).toBe(
      "civil_responsabilidad",
    );
    expect(
      controlledJob.result!.quality_control!.checked_outputs.some(
        (o: { id: string }) => o.id === "AUDITOR",
      ),
    ).toBe(true);
    expect(controlledJob.result!.semantic_check).toBe("AI_REVIEWED");
    expect(() => assertQualityManifest(controlledJob.result)).not.toThrow();
    await page
      .locator(".workspace-conversation .workspace-quality")
      .last()
      .locator("summary")
      .click();
    await browserExpect(
      page.getByText("Responsabilidad y daños", { exact: false }).first(),
    ).toBeVisible();
    nextControlled = "issues";
    await page
      .getByLabel("Tu mensaje a Gabriel")
      .fill(
        "Prepará una propuesta para comprobar el bloqueo de errores materiales.",
      );
    await page.getByRole("button", { name: "Enviar →", exact: true }).click();
    await browserExpect(
      page
        .getByRole("region", {
          name: "Versión propuesta junto al documento",
          exact: true,
        })
        .getByRole("button", {
          name: "Aplicar versión al documento",
          exact: true,
        }),
    ).toBeDisabled();
    await browserExpect(
      page
        .getByRole("alert")
        .filter({ hasText: "errores materiales pendientes" }),
    ).toBeVisible();
    expect(
      (await restarted.receipt(recoveryAccess.token, recoveryAccess.room.id))
        .state_hash,
    ).toBe(unchangedBeforeControl);
    await mkdir(report, { recursive: true });
    await page.screenshot({
      path: report + "/workspace-1366.png",
      fullPage: true,
    });
    expect(failures).toEqual([]);
    expect(external).toEqual([]);
    await writeFile(
      report + "/verification.json",
      JSON.stringify(
        {
          result: "PASS",
          storage: "REAL_POSTGRESQL_ISOLATED_DATABASE",
          sessions: 2,
          simultaneous_edits: true,
          full_screen_word_workspace: true,
          inline_offline_agent_proposal: true,
          apply_undo_peer_convergence: true,
          stale_proposal_guard: true,
          shared_durable_comments: true,
          docx_download_verified: true,
          find_in_document: true,
          task_idempotence: true,
          ribbon_size_stable_with_files_open: true,
          single_toolbar_row_all_tabs: true,
          toolbar_height_40px: true,
          ribbon_controls_not_clipped: true,
          first_save_then_consult_without_destroyed_editor: true,
          imported_original_opens_in_editor: true,
          original_working_copy_reused: true,
          gabriel_plan_before_confirmed_team_analysis: true,
          anchored_findings_and_explicit_apply: true,
          central_document_and_review_split: true,
          plan_and_resume_with_nonempty_attachments: true,
          changed_attachment_still_rejected: true,
          independent_undo_for_each_alternative: true,
          two_consecutive_clause_changes: true,
          manual_quote_linking: true,
          review_decisions_durable_and_shared: true,
          review_decisions_reject_readonly_and_stale: true,
          local_file_collapse_control: true,
          review_layout_1024_and_1366: true,
          collapsed_assistant_preserves_composer: true,
          attached_original_in_model_context: true,
          unreadable_original_blocks_model_call: true,
          deletions: true,
          rich_format: true,
          tables: true,
          immutable_history_preview: true,
          durable_receipts: true,
          reload: true,
          restart: true,
          offline_edits_recovered: true,
          checkpoint_idempotence: true,
          original_preserved: true,
          one_upload_entry_point: true,
          original_nested_under_working_copy: true,
          chat_label_and_visible_focus: true,
          collapsed_zoom_preserves_value_and_document: true,
          visible_processing_and_collapsible_message_entry: true,
          gabriel_director_interprets_every_followup: true,
          conversational_tools_chain_analysis_and_draft_without_confirmation: true,
          conversational_history_and_proposals_are_room_scoped: true,
          long_chat_and_document_accepted_without_character_caps: true,
          continuation_reuses_saved_findings_without_new_team: true,
          prepared_contract_beyond_20000_chars_review_apply_undo: true,
          draft_basis_rejects_other_document: true,
          voice_dictation_review_before_send: true,
          voice_playback_and_stop: true,
          microphone_cancel_on_panel_close: true,
          voice_provider_mocked_no_paid_calls: true,
          human_call_real_webrtc_bidirectional_audio: true,
          editing_during_human_call: true,
          human_call_mute_leave_and_revoke_stop_tracks: true,
          readonly: true,
          live_revocation: true,
          independent_review: true,
          paid_calls: 0,
          jev_output: false,
          browser_errors: failures,
        },
        null,
        2,
      ),
    );
    await restarted.close();
  } catch (error) {
    await mkdir(report, { recursive: true });
    const page = browser?.contexts()[0]?.pages()[0];
    if (page)
      await writeFile(
        report + "/failure.txt",
        (
          (await page.locator("body").innerText()) +
          "\n" +
          failures.join("\n")
        ).replace(/[a-f0-9]{64}/g, "[REDACTED]"),
      );
    throw error;
  } finally {
    releaseTask?.();
    await browser?.close();
    // The fixture owns its original pools; end() is idempotent only through this wrapper.
    const endOwner = db.pool.end.bind(db.pool),
      endRuntime = db.runtime.end.bind(db.runtime);
    db.pool.end = async () => {
      if (!db.pool.ended) await endOwner();
    };
    db.runtime.end = async () => {
      if (!db.runtime.ended) await endRuntime();
    };
    await bridge!?.close().catch(() => {});
    await new Promise<void>((done) => server.close(() => done()));
    await db.close();
  }
}, 240000);
