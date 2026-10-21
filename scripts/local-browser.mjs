import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { readWebResponse } from "./web-release.mjs";
import { handleJunta } from "./junta-bridge.mjs";
import { createGabrielHandler } from "./gabriel-bridge.mjs";
import { createGabrielRealtime } from "./gabriel-realtime.mjs";
import { ensureLibraryJob } from "./library-job.mjs";
import { preflightLocalOS } from "./local-os-preflight.mjs";
import { createWorkspaceBridge } from "./workspace-bridge.mjs";
import { createPlatformBridge } from "./platform-bridge.mjs";
import {
  operationsConfig,
  saveOperations,
  prepareLocalTls,
  networkAddresses,
} from "./platform-operations.mjs";
const root = resolve("dist/web");
await stat(resolve(root, "index.html"));
const port = Number(process.env.LOCAL_BROWSER_PORT ?? 4313);
let lanStack = null;
async function configureNetwork(input) {
  if (typeof input.enabled !== "boolean")
    throw Error("INVALID_NETWORK_CONFIGURATION");
  if (!input.enabled) {
    const previous = lanStack;
    lanStack = null;
    if (previous) void previous.close();
    return saveOperations(resolve("."), { enabled: false });
  }
  if (
    !networkAddresses().includes(input.bind) ||
    !Number.isInteger(input.port) ||
    input.port < 1024 ||
    input.port > 65535 ||
    input.port === port
  )
    throw Error("LOCAL_PRIVATE_INTERFACE_REQUIRED");
  const origin = `https://${input.bind}:${input.port}`;
  if (lanStack?.origin === origin) return { enabled: true, origin };
  const tls = await prepareLocalTls(resolve("."), input.bind),
    next = createStack(origin, tls);
  try {
    await new Promise((ok, fail) => {
      next.server.once("error", fail);
      next.server.listen(input.port, input.bind, ok);
    });
  } catch (e) {
    await next.close();
    throw e;
  }
  const previous = lanStack;
  lanStack = next;
  if (previous) void previous.close();
  await saveOperations(resolve("."), {
    enabled: true,
    bind: input.bind,
    port: input.port,
  });
  return { enabled: true, origin };
}
function createStack(origin, tls) {
  const platform = createPlatformBridge(resolve("."), origin, {
    configureNetwork,
  });
  const realtime = createGabrielRealtime({
    authorizeFirm: (...args) => platform.authorizeFirm(...args),
  });
  const handleGabriel = createGabrielHandler({
    management: (...args) => platform.managementTool(...args),
    authorizeFirm: (...args) => platform.authorizeFirm(...args),
  });
  const workspace = createWorkspaceBridge(resolve("."), origin, { platform });
  const server = (tls ? createHttpsServer.bind(null, tls) : createServer)(
    async (req, res) => {
      try {
        if (await platform.handle(req, res)) return;
        if (await platform.gate(req, res)) return;
        if (await workspace.handle(req, res)) return;
        if (await realtime.handle(req, res, origin)) return;
        if (await handleGabriel(req, res, origin)) return;
        if (await handleJunta(req, res, origin)) return;
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.writeHead(405);
          res.end();
          return;
        }
        const url = new URL(req.url, origin);
        if (url.pathname.startsWith("/api/")) {
          res.writeHead(404);
          res.end();
          return;
        }
        const file = await readWebResponse(root, url.pathname, (html) =>
          html.replace(
            "<head>",
            '<head><meta name="law-order-platform" content="local-accounts-v1">',
          ),
        );
        res.writeHead(file.status, {
          "Content-Type": file.type,
          "Cache-Control": file.cache,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        });
        res.end(req.method === "HEAD" ? undefined : file.bytes);
      } catch {
        res.writeHead(500);
        res.end("No se pudo abrir el archivo local.");
      }
    },
  );
  workspace.attach(server);
  return {
    origin,
    server,
    platform,
    async close() {
      await Promise.allSettled([workspace.close(), realtime.close()]);
      await platform.close();
      if (server.listening) await new Promise((ok) => server.close(ok));
    },
  };
}
const localStack = createStack(`http://127.0.0.1:${port}`),
  { server, platform } = localStack;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void Promise.allSettled([localStack.close(), lanStack?.close()]).finally(
      () => process.exit(0),
    );
  });
server.once("error", (error) => {
  if (error.code === "EADDRINUSE" && port === 4313) {
    // Two launchers can race between the preflight and bind. Reuse only our OS.
    void preflightLocalOS().then((code) => process.exit(code === 0 ? 0 : 2))
      .catch(() => process.exit(2));
  } else {
    console.error("No se pudo iniciar el servidor local. Revisa el puerto y los permisos.");
    process.exit(1);
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`LAW & ORDER OS local: http://127.0.0.1:${port}`),
);
const resumeLibrary = () => {
  void ensureLibraryJob(resolve(".")).catch(() =>
    console.log(
      "La carga de Biblioteca requiere revisión; el OS sigue disponible.",
    ),
  );
};
server.once("listening", () => {
  platform.startBackups();
  resumeLibrary();
  setInterval(resumeLibrary, 60000).unref();
});
const network = await operationsConfig(resolve("."));
if (network.enabled)
  await configureNetwork(network).catch(() =>
    console.log(
      "HTTPS local requiere revisión de la interfaz o del certificado. El acceso loopback sigue disponible.",
    ),
  );
