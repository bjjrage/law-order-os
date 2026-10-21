import { createConnection } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { waitForLocalOS } from "./local-os-open.mjs";
import { ensureWorkspaceDatabase } from "./workspace-runtime.mjs";

const origin = "http://127.0.0.1:4313/";
function portOccupied() {
  return new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port: 4313 });
    const finish = (occupied) => {
      socket.destroy();
      done(occupied);
    };
    socket.setTimeout(2000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(true));
    socket.once("error", (error) => finish(error.code !== "ECONNREFUSED"));
  });
}

/** 0: ready/reuse, 1: start the web server, 2: blocked. Never reclaim a port. */
export async function preflightLocalOS({
  root = process.cwd(),
  occupied = portOccupied,
  request = fetch,
  recoverDatabase = ensureWorkspaceDatabase,
  wait = waitForLocalOS,
  report = console.log,
} = {}) {
  if (!(await occupied())) return 1;
  let ours = false;
  try {
    const response = await request(origin, {
      signal: AbortSignal.timeout(10000),
    });
    const html = await response.text();
    ours =
      response.ok &&
      (response.headers.get("X-Law-Order-OS") === "local-accounts-v1" ||
        /<meta\s+name=["']law-order-platform["']\s+content=["']local-accounts-v1["']/i.test(
          html,
        ));
  } catch {
    /* Unknown listeners are never stopped or replaced. */
  }
  if (!ours) {
    report(
      "No se pudo identificar el OS en el puerto 4313. No se cerro ningun proceso ni se inicio otro servidor.",
    );
    return 2;
  }
  report("El servidor del OS responde. Comprobando el guardado local...");
  try {
    await recoverDatabase(root);
    await wait(origin, { timeoutMs: 20000, request });
    report("El OS esta listo. Se reutiliza sin iniciar otro servidor.");
    return 0;
  } catch {
    report(
      "El OS responde, pero no se pudo recuperar PostgreSQL local. Los datos se conservan. Revisa .local-dev/postgres-server.log y .local-dev/workspace-postgres.log.",
    );
    return 2;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = await preflightLocalOS();
  } catch {
    console.error(
      "No se pudo comprobar el arranque. No se inicio un servidor duplicado.",
    );
    process.exitCode = 2;
  }
}
