import { it, expect } from "vitest";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { database } from "./fixtures.js";
import { LocalPlatform } from "../../apps/api/src/local-platform.js";
// @ts-expect-error Native local host.
import * as runtime from "../../scripts/workspace-runtime.mjs";
// @ts-expect-error Native local host.
import { createPlatformBridge } from "../../scripts/platform-bridge.mjs";
// @ts-expect-error Native local launcher.
import { waitForLocalOS } from "../../scripts/local-os-open.mjs";
const { waitForDatabaseReady, databaseReady } = runtime;

it("opens the launcher only after the platform is ready, rather than an HTML-only response", async () => {
  let calls = 0;
  await waitForLocalOS("http://127.0.0.1:4313/", {
    timeoutMs: 1000,
    intervalMs: 1,
    request: async () => {
      calls++;
      return calls === 1
        ? new Response("<html>OS</html>")
        : calls === 2
          ? Response.json({ error: "starting up" }, { status: 503 })
          : Response.json({ enabled: true, storage: "POSTGRESQL_LOCAL" });
    },
  });
  expect(calls).toBe(3);
  await expect(
    waitForLocalOS("http://127.0.0.1:4313/", {
      timeoutMs: 10,
      intervalMs: 1,
      request: async () => new Response("<html>OS</html>"),
    }),
  ).rejects.toThrow("LOCAL_OS_NOT_READY");
});

it("waits for successful SQL probes instead of treating an open port as readiness", async () => {
  let sqlReady = false,
    probes = 0,
    completed = false;
  const waiting = waitForDatabaseReady(
    async () => {
      probes++;
      return sqlReady;
    },
    { timeoutMs: 1000, intervalMs: 5 },
  ).then(() => {
    completed = true;
  });
  await new Promise((done) => setTimeout(done, 25));
  expect(completed).toBe(false);
  sqlReady = true;
  await waiting;
  expect(probes).toBeGreaterThan(1);
  await expect(
    waitForDatabaseReady(async () => false, { timeoutMs: 10, intervalMs: 2 }),
  ).rejects.toMatchObject({ status: 503 });
});

it("recovers the same HTTP platform after PostgreSQL rejects its first initialization", async () => {
  expect(await databaseReady(process.cwd())).toBe(true);
  const db = await database(),
    root = resolve(".local-dev/startup-tests", randomUUID());
  await mkdir(root, { recursive: true });
  const config = JSON.parse(
    await readFile(".local-dev/app-config.json", "utf8"),
  );
  const url = new URL(config.auth_database_url);
  url.pathname = "/" + db.name;
  config.auth_database_url = url.href;
  const platform = new LocalPlatform(db.pool),
    initialize = platform.initialize.bind(platform);
  let attempts = 0,
    bridge: any;
  platform.initialize = async () => {
    attempts++;
    if (attempts === 1)
      throw Object.assign(Error("the database system is starting up"), {
        code: "57P03",
      });
    return initialize();
  };
  const server = createServer(async (req, res) => {
    if (!(await bridge.handle(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  bridge = createPlatformBridge(root, origin, {
    pool: db.pool,
    config,
    platform,
  });
  try {
    const first = await fetch(origin + "/local/platform/status");
    expect(first.status).toBe(503);
    expect((await first.json()).error).toContain("starting up");
    const second = await fetch(origin + "/local/platform/status");
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      storage: "POSTGRESQL_LOCAL",
      registration: "INVITATION_ONLY",
    });
    expect(attempts).toBeGreaterThan(1);
  } finally {
    await bridge.close();
    await new Promise<void>((ok) => server.close(() => ok()));
    await db.close();
  }
}, 60000);
