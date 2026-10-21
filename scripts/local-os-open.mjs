import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function waitForLocalOS(
  origin,
  { timeoutMs = 90000, intervalMs = 250, request = fetch } = {},
) {
  const url = new URL(origin);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password
  )
    throw Error("LOCAL_OS_ORIGIN_REQUIRED");
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      const response = await request(new URL("/local/platform/status", url), {
        signal: AbortSignal.timeout(5000),
      });
      if (
        response.ok &&
        response.headers.get("Content-Type")?.startsWith("application/json")
      ) {
        const status = await response.json();
        if (
          status.storage === "POSTGRESQL_LOCAL" &&
          typeof status.enabled === "boolean"
        )
          return;
      }
    } catch {
      /* The HTTP listener or PostgreSQL may still be starting. */
    }
    if (Date.now() >= deadline) throw Error("LOCAL_OS_NOT_READY");
    await new Promise((done) => setTimeout(done, intervalMs));
  } while (true);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const origin = "http://127.0.0.1:4313/";
  try {
    await waitForLocalOS(origin);
    const command =
      process.platform === "win32"
        ? "explorer.exe"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    const child = spawn(command, [origin], {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", () => console.error("El OS está listo. Abrí " + origin));
    child.unref();
  } catch {
    console.error(
      "El OS todavía no está listo. Revisá el mensaje del servidor antes de volver a iniciarlo.",
    );
    process.exitCode = 1;
  }
}
