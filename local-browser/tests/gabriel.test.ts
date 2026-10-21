import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { classifyGabriel } from "../../apps/web/src/gabriel-intents.js";
import { encodeVoice } from "../../apps/web/src/gabriel-audio.js";
// @ts-expect-error Local server module is exercised directly.
import * as bridge from "../../scripts/gabriel-bridge.mjs";
const { createGabrielHandler, validateWave, validateReply } = bridge;

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const clean of cleanup.splice(0).reverse()) await clean();
});
async function setup(
  transport: typeof fetch,
  options: Record<string, unknown> = {},
) {
  const root = await mkdtemp(resolve(tmpdir(), "law-order-gabriel-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, "junta-local"));
  await mkdir(resolve(root, ".local-dev"));
  await writeFile(
    resolve(root, "junta-local/config.env.example"),
    "OPENAI_API_KEY=\nOPENAI_LUNA_MODEL=\n",
  );
  await writeFile(
    resolve(root, ".env"),
    "OPENAI_API_KEY=test-key\nOPENAI_LUNA_MODEL=gpt-6-luna\n",
  );
  await writeFile(
    resolve(root, ".local-dev/junta-browser-approval.json"),
    '{"enabled":true}',
  );
  const handler = createGabrielHandler({
    root,
    transport,
    now: () => new Date("2026-10-16T12:00:00Z"),
    ...options,
  });
  let origin = "";
  const server = createServer((req, res) => {
    void handler(req, res, origin);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  cleanup.push(
    () =>
      new Promise((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  );
  return {
    root,
    origin,
    call: (
      operation = "chat",
      payload: unknown = {
        message: "¿Qué es una fusión?",
        history: [],
        view: "dashboard",
      },
      id = crypto.randomUUID(),
      customOrigin = origin,
    ) =>
      fetch(origin + "/local/gabriel/" + operation, {
        method: "POST",
        headers: { Origin: customOrigin, "X-Gabriel": "1", "X-Request-Id": id },
        body:
          payload instanceof ArrayBuffer ? payload : JSON.stringify(payload),
      }),
  };
}
const modelReply = {
  reply:
    "Una fusión integra sociedades. La venta de participaciones cambia socios, sin necesariamente fusionar sociedades.",
  action: "NONE",
  destination: "dashboard",
  analysis_premise: "",
};
const output = () =>
  Response.json({
    model: "gpt-6-luna",
    status: "completed",
    output: [
      { content: [{ type: "output_text", text: JSON.stringify(modelReply) }] },
    ],
  });

it("routes navigation and OS help locally while leaving conceptual legal questions to AI", () => {
  expect(classifyGabriel("Gabriel, abrí Clientes")).toEqual({
    kind: "navigate",
    destination: "clients",
  });
  expect(classifyGabriel("Abrí Equipo jurídico")).toEqual({
    kind: "navigate",
    destination: "team",
  });
  expect(classifyGabriel("¿Cómo funciona la Junta jurídica?")).toEqual({
    kind: "help",
    destination: "team",
  });
  expect(
    classifyGabriel("Armá un equipo jurídico para analizar un contrato"),
  ).toEqual({ kind: "team" });
  expect(classifyGabriel("¿Para qué sirve Agenda?")).toEqual({
    kind: "help",
    destination: "agenda",
  });
  expect(classifyGabriel("Quiero analizar una fusión empresarial")).toEqual({
    kind: "team",
  });
  expect(classifyGabriel("¿Qué es una fusión empresarial?")).toEqual({
    kind: "answer",
  });
  expect(
    classifyGabriel("No abras clientes, quiero saber qué es un contrato"),
  ).toEqual({ kind: "answer" });
  expect(classifyGabriel("Eliminá todos los clientes")).toEqual({
    kind: "answer",
  });
  expect(
    classifyGabriel("Vender una empresa a clientes actuales genera riesgos"),
  ).toEqual({ kind: "answer" });
  expect(classifyGabriel("No quiero analizar un contrato ahora")).toEqual({
    kind: "answer",
  });
  expect(classifyGabriel("Gabriela abre clientes.")).toEqual({
    kind: "navigate",
    destination: "clients",
  });
});
it("resamples to bounded WAV, rejects malformed and oversized recordings", () => {
  const wave = Buffer.from(
    encodeVoice(new Float32Array(48000).fill(0.5), 48000),
  );
  expect(validateWave(wave)).toBe(1);
  expect(wave.readInt16LE(44)).toBeGreaterThan(16000);
  expect(
    validateWave(Buffer.from(encodeVoice(new Float32Array(16000 * 35), 16000))),
  ).toBe(30);
  const broken = Buffer.from(wave);
  broken.writeUInt16LE(2, 22);
  expect(() => validateWave(broken)).toThrow();
  expect(() => validateWave(Buffer.alloc(1))).toThrow();
});
it("blocks foreign origins and invalid actions, deduplicates paid calls even after process reload", async () => {
  let calls = 0;
  const test = await setup(async () => {
    calls++;
    return output();
  });
  expect(
    (
      await test.call(
        "chat",
        undefined,
        crypto.randomUUID(),
        "https://foreign.example",
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await test.call("chat", {
        message: "x".repeat(2001),
        history: [],
        view: "dashboard",
      })
    ).status,
  ).toBe(422);
  expect(calls).toBe(0);
  const id = crypto.randomUUID();
  expect((await (await test.call("chat", undefined, id)).json()).reply).toBe(
    modelReply.reply,
  );
  expect((await test.call("chat", undefined, id)).status).toBe(200);
  expect(calls).toBe(1);
  expect(() =>
    validateReply({ ...modelReply, action: "DELETE_CLIENT" }),
  ).toThrow();
  expect(() =>
    validateReply({ ...modelReply, action: "TEAM", analysis_premise: "" }),
  ).toThrow();
  const ledger = JSON.parse(
    await readFile(
      resolve(test.root, ".local-dev/gabriel/2026-10-16.json"),
      "utf8",
    ),
  );
  expect(ledger.reserved).toBe(0.01);
  expect(JSON.stringify(ledger)).not.toContain("test-key");
});
it("keeps failed-call reservation, stops at daily budget and does not repeat ambiguous calls", async () => {
  let calls = 0;
  const test = await setup(async () => {
    calls++;
    throw Error("transport failure");
  });
  const id = crypto.randomUUID();
  expect((await test.call("chat", undefined, id)).status).toBe(422);
  expect((await test.call("chat", undefined, id)).status).toBe(409);
  expect(calls).toBe(1);
  await writeFile(
    resolve(test.root, ".local-dev/gabriel/2026-10-16.json"),
    '{"reserved":0.6,"requests":{}}',
  );
  expect((await test.call()).status).toBe(429);
  expect(calls).toBe(1);
});
it("status requests and rejected simultaneous calls cannot release another request lock", async () => {
  let release!: () => void,
    started!: () => void,
    calls = 0;
  const start = new Promise<void>((done) => {
      started = done;
    }),
    wait = new Promise<void>((done) => {
      release = done;
    });
  const test = await setup(async () => {
    calls++;
    started();
    await wait;
    return output();
  });
  const first = test.call();
  await start;
  expect((await fetch(test.origin + "/local/gabriel/status")).status).toBe(200);
  expect((await test.call()).status).toBe(409);
  expect((await test.call()).status).toBe(409);
  release();
  expect((await first).status).toBe(200);
  expect(calls).toBe(1);
});
it("voice endpoints send bounded audio/text and preserve generated speech for idempotent playback", async () => {
  const urls: string[] = [];
  const test = await setup(async (url, options) => {
    urls.push(String(url));
    if (String(url).endsWith("transcriptions")) {
      expect(options?.body).toBeInstanceOf(FormData);
      return Response.json({ text: "Abrí Clientes" });
    }
    const speech = JSON.parse(String(options?.body));
    expect(speech.model).toBe("gpt-4o-mini-tts");
    expect(speech.voice).toBe("cedar");
    expect(speech.instructions).toContain("conversacional");
    return new Response(new Uint8Array([73, 68, 51]), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  });
  expect(
    (
      await (
        await test.call(
          "transcribe",
          encodeVoice(new Float32Array(16000), 16000),
        )
      ).json()
    ).text,
  ).toBe("Abrí Clientes");
  const id = crypto.randomUUID();
  expect(
    (await (await test.call("speech", { text: "Abrí Clientes." }, id)).json())
      .audio,
  ).toBe("SUQz");
  await test.call("speech", { text: "Abrí Clientes." }, id);
  expect(urls).toHaveLength(2);
  expect((await test.call("transcribe", new ArrayBuffer(2))).status).toBe(422);
  expect(urls).toHaveLength(2);
});
it("preserves a multi-turn conversation and its matter context at the model boundary", async () => {
  const history = Array.from({ length: 16 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: `Turno ${i}: seguimos con la operación que hablamos.`,
  }));
  const test = await setup(async (_url, options) => {
    const request = JSON.parse(String(options?.body));
    expect(request.input.slice(0, -1)).toEqual(history);
    expect(JSON.parse(request.input.at(-1).content).current_context).toEqual({
      matter_title: "Operación de prueba",
    });
    expect(request.instructions).toContain("No decidas por palabras clave");
    return output();
  });
  const response = await test.call("chat", {
    message: "¿Y en ese caso?",
    history,
    view: "matters",
    context: { matter_title: "Operación de prueba" },
  });
  expect(response.status).toBe(200);
});
it("accepts the team presentation as context and permits navigation to it without arbitrary destinations", async () => {
  let calls = 0;
  const test = await setup(async () => {
    calls++;
    return Response.json({
      model: "gpt-6-luna",
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                ...modelReply,
                action: "NAVIGATE",
                destination: "team",
              }),
            },
          ],
        },
      ],
    });
  });
  const response = await test.call("chat", {
    message: "Mostrame las funciones del equipo",
    history: [],
    view: "team",
  });
  expect((await response.json()).destination).toBe("team");
  expect(
    (
      await test.call("chat", {
        message: "Abrí una pantalla",
        history: [],
        view: "unknown",
      })
    ).status,
  ).toBe(422);
  expect(calls).toBe(1);
});
it("recovers a lock left by a dead process without repeating an earlier paid request", async () => {
  let calls = 0;
  const test = await setup(async () => {
    calls++;
    return output();
  });
  const id = crypto.randomUUID();
  await test.call("chat", undefined, id);
  await writeFile(
    resolve(test.root, ".local-dev/gabriel/budget.lock"),
    JSON.stringify({ pid: 2147483647, request_id: "interrupted" }),
  );
  expect((await test.call("chat", undefined, id)).status).toBe(200);
  expect(calls).toBe(1);
});
it("executes text management tools through the session host and accounts for each continuation", async () => {
  let calls = 0;
  const executed: any[] = [];
  const test = await setup(
    async () => {
      calls++;
      return calls === 1
        ? Response.json({
            model: "gpt-6-luna",
            status: "completed",
            output: [
              {
                type: "function_call",
                call_id: "task-call",
                name: "assign_task",
                arguments: JSON.stringify({
                  mode: "CREATE",
                  matter_id: "matter",
                  task_id: null,
                  title: "Revisar anexos",
                  responsible_identity_id: "lawyer",
                  due_at: null,
                  expected_revision: null,
                }),
              },
            ],
          })
        : output();
    },
    {
      management: async (
        headers: any,
        firm: string,
        name: string,
        args: any,
        commandId: string,
      ) => {
        executed.push({ firm, name, args, commandId });
        return { id: "persisted-task", assigned_by: "authenticated-director" };
      },
    },
  );
  const id = crypto.randomUUID();
  const response = await test.call(
    "chat",
    {
      message: "Que Ana revise los anexos",
      history: [],
      view: "agenda",
      firm_id: "firm",
    },
    id,
  );
  expect(response.status).toBe(200);
  expect((await response.json()).management_actions).toHaveLength(1);
  expect(executed[0]).toMatchObject({ firm: "firm", name: "assign_task" });
  expect(calls).toBe(2);
  const ledger = JSON.parse(
    await readFile(
      resolve(test.root, ".local-dev/gabriel/2026-10-16.json"),
      "utf8",
    ),
  );
  expect(ledger.requests[id].reserve_usd).toBe(0.02);
  expect(
    (
      await test.call(
        "chat",
        {
          message: "Que Ana revise los anexos",
          history: [],
          view: "agenda",
          firm_id: "firm",
        },
        id,
      )
    ).status,
  ).toBe(200);
  expect(executed).toHaveLength(1);
  expect(calls).toBe(2);
});
