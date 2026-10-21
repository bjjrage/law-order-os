import { connect } from "node:net";
import { spawn } from "node:child_process";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

const available = () =>
  new Promise((resolveReady) => {
    const socket = connect({ host: "127.0.0.1", port: 55432 });
    const finish = (value) => {
      socket.destroy();
      resolveReady(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
let starting;
export async function databaseReady(root) {
  const secrets = await readFile(
    resolve(root, ".local-dev/postgres-secrets.json"),
    "utf8",
  )
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
  if (!secrets) return false;
  const client = new Client({
    host: "127.0.0.1",
    port: 55432,
    user: "postgres",
    database: "postgres",
    password: secrets.admin,
    connectionTimeoutMillis: 1000,
    query_timeout: 1000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}
export async function waitForDatabaseReady(
  probe,
  { timeoutMs = 60000, intervalMs = 250 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (await probe()) return;
    if (Date.now() >= deadline)
      throw Object.assign(Error("WORKSPACE_DATABASE_UNAVAILABLE"), {
        status: 503,
      });
    await new Promise((done) => setTimeout(done, intervalMs));
  }
}
/** Reuses the existing portable PostgreSQL. Does not install services or stop other processes. */
export function ensureWorkspaceDatabase(root) {
  starting ??= (async () => {
    if (await databaseReady(root)) return;
    // PostgreSQL accepts TCP connections while it is still recovering. Reuse
    // that process and wait for SQL readiness instead of starting another one.
    if (await available()) {
      await waitForDatabaseReady(() => databaseReady(root));
      return;
    }
    const savedCluster = await stat(resolve(root, ".local-dev/postgres/PG_VERSION")).then(() => true).catch(error => {
      if (error.code === "ENOENT") return false;
      throw error;
    });
    if (process.platform === "win32" && savedCluster) {
      const { startSavedWindowsPostgres } = await import("./local-postgres-start.mjs");
      try { await startSavedWindowsPostgres(root); }
      catch (error) {
        // Another launcher may have started this saved cluster concurrently.
        // Authenticate readiness instead of killing or starting over.
        if (!(await available())) throw error;
      }
      await waitForDatabaseReady(() => databaseReady(root));
      return;
    }
    await mkdir(resolve(root, ".local-dev"), { recursive: true });
    const log = await open(
      resolve(root, ".local-dev/workspace-postgres.log"),
      "a",
    );
    const child = spawn(
      process.execPath,
      ["dist/os-app/infra/local/postgres.js"],
      {
        cwd: root,
        detached: true,
        windowsHide: true,
        stdio: ["ignore", log.fd, log.fd],
      },
    );
    child.unref();
    let spawnFailed = false;
    child.once("error", () => {
      spawnFailed = true;
    });
    child.once("exit", () => { spawnFailed = true; });
    await log.close();
    await waitForDatabaseReady(() => {
      if (spawnFailed)
        throw Object.assign(Error("WORKSPACE_DATABASE_START_FAILED"), {
          status: 503,
        });
      return databaseReady(root);
    });
  })().finally(() => {
    starting = undefined;
  });
  return starting;
}
