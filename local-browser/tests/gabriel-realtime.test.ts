import { afterEach, expect, it } from "vitest";
import { createServer } from "node:http";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
// @ts-expect-error Native ESM host.
import * as realtime from "../../scripts/gabriel-realtime.mjs";
const { createGabrielRealtime, voiceSession, voiceUsage, REALTIME_MODEL } =
  realtime;
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
class Socket extends EventEmitter {
  close() {
    queueMicrotask(() => this.emit("close"));
  }
}
async function setup(transport: typeof fetch) {
  const root = await mkdtemp(resolve(tmpdir(), "law-order-realtime-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, "junta-local"));
  await mkdir(resolve(root, ".local-dev/gabriel"), { recursive: true });
  await writeFile(
    resolve(root, "junta-local/config.env.example"),
    "OPENAI_API_KEY=\nOPENAI_LUNA_MODEL=\n",
  );
  await writeFile(
    resolve(root, ".env"),
    "OPENAI_API_KEY=synthetic-private-key\nOPENAI_LUNA_MODEL=gpt-6-luna\n",
  );
  await writeFile(
    resolve(root, ".local-dev/junta-browser-approval.json"),
    '{"enabled":true}',
  );
  const sockets: Socket[] = [];
  const handler = createGabrielRealtime({
    root,
    transport,
    socket: () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    },
  });
  let origin = "";
  const server = createServer((req, res) => {
    void handler.handle(req, res, origin);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
  cleanup.push(async () => {
    await handler.close();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  });
  return {
    root,
    sockets,
    origin,
    call: (
      path = "",
      body: any = {
        request_id: crypto.randomUUID(),
        sdp: "v=0\r\ns=synthetic",
        view: "dashboard",
      },
      foreign = false,
    ) =>
      fetch(origin + "/local/gabriel/realtime" + path, {
        method: "POST",
        headers: {
          Origin: foreign ? "https://foreign.invalid" : origin,
          "X-Gabriel": "1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
  };
}
const answer = () =>
  new Response("v=0\r\ns=answer", {
    headers: { Location: "/v1/realtime/calls/rtc_synthetic" },
  });
it("configures native audio, interruptions and real document/delegation tools without the legacy no-access policy", () => {
  const s = voiceSession({ view: "clients", matter_title: null });
  expect(s.model).toBe(REALTIME_MODEL);
  expect(s.reasoning.effort).toBe("minimal");
  expect(s.audio.input.turn_detection).toMatchObject({
    type: "semantic_vad",
    create_response: true,
    interrupt_response: true,
  });
  expect(s.tools.map((t: any) => t.name)).toEqual([
    "transcribe_session",
    "session_minutes",
    "practice_records",
    "practice_action",
    "assign_review",
    "study_work",
    "assign_task",
    "update_task",
    "request_direction",
    "resolve_direction",
    "workspace_documents",
    "read_workspace",
    "delegate_workspace",
    "navigate_os",
    "prepare_analysis",
  ]);
  expect(s.instructions).toContain("PROPOSAL");
  expect(s.instructions).not.toContain("No crees, elimines ni ejecutes nada");
  expect(s.max_output_tokens).toBe(1024);
  expect(voiceUsage({ input_tokens: 1000, output_tokens: 100 })).toBeCloseTo(
    0.012,
  );
  expect(voiceUsage({})).toBeNull();
});
it("creates one provider connection, keeps the key server-side, deduplicates usage and hangs up once", async () => {
  let creates = 0,
    hangups = 0;
  const test = await setup(async (url, init) => {
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer synthetic-private-key",
    });
    if (String(url).endsWith("/hangup")) {
      hangups++;
      return new Response(null, { status: 200 });
    }
    creates++;
    const form = init?.body as FormData;
    expect(form.get("sdp")).toBe("v=0\r\ns=synthetic");
    expect(JSON.parse(String(form.get("session"))).model).toBe(REALTIME_MODEL);
    return answer();
  });
  const request_id = crypto.randomUUID(),
    body = { request_id, sdp: "v=0\r\ns=synthetic", view: "dashboard" };
  expect((await test.call("", body, true)).status).toBe(403);
  expect(creates).toBe(0);
  const response = await test.call("", body);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(JSON.stringify(data)).not.toContain("synthetic-private-key");
  expect(await (await test.call("", body)).json()).toEqual(data);
  expect(creates).toBe(1);
  const event = JSON.stringify({
    type: "response.done",
    response: {
      id: "resp_1",
      usage: { input_tokens: 1000, output_tokens: 100 },
    },
  });
  test.sockets[0]!.emit("message", event);
  test.sockets[0]!.emit("message", event);
  await expect
    .poll(
      async () =>
        JSON.parse(
          await readFile(
            resolve(
              test.root,
              ".local-dev/gabriel/realtime",
              request_id + ".json",
            ),
            "utf8",
          ),
        ).responses,
    )
    .toBe(1);
  const state = await (
    await test.call("/state", { session_id: data.session_id })
  ).json();
  expect(state.estimated_usd).toBeCloseTo(0.012);
  await test.call("/stop", { session_id: data.session_id });
  await test.call("/stop", { session_id: data.session_id });
  expect(hangups).toBe(1);
  const record = await readFile(
    resolve(test.root, ".local-dev/gabriel/realtime", request_id + ".json"),
    "utf8",
  );
  expect(record).not.toContain("synthetic-private-key");
  expect(record).not.toContain("v=0");
});
it("does not reuse the old daily dictation quota or silently retry a failed new connection", async () => {
  let creates = 0;
  const test = await setup(async () => {
    creates++;
    return new Response(null, { status: 403 });
  });
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
  }).format(new Date());
  await writeFile(
    resolve(test.root, ".local-dev/gabriel", date + ".json"),
    '{"reserved":0.6,"requests":{}}',
  );
  const body = {
    request_id: crypto.randomUUID(),
    sdp: "v=0\r\ns=synthetic",
    view: "dashboard",
  };
  expect((await (await test.call("", body)).json()).code).toBe(
    "REALTIME_PROVIDER_403",
  );
  expect((await test.call("", body)).status).toBe(422);
  expect(creates).toBe(1);
});
it("cancels a pending start without leaving an orphan paid call", async () => {
  let release!: () => void,
    started!: () => void,
    hangups = 0;
  const wait = new Promise<void>((done) => {
      release = done;
    }),
    start = new Promise<void>((done) => {
      started = done;
    });
  const test = await setup(async (url) => {
    if (String(url).endsWith("/hangup")) {
      hangups++;
      return new Response(null, { status: 200 });
    }
    started();
    await wait;
    return answer();
  });
  const request_id = crypto.randomUUID();
  const pending = test.call("", {
    request_id,
    sdp: "v=0\r\ns=synthetic",
    view: "dashboard",
  });
  await start;
  await test.call("/stop", { request_id });
  release();
  expect((await pending).status).toBe(422);
  expect(hangups).toBe(1);
  expect(test.sockets).toHaveLength(0);
});
