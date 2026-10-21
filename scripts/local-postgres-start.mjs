import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";

/** Start an existing Windows cluster with its bundled native manager.
 * pg_ctl owns lock-file validation; this never removes locks or initializes data. */
export async function startSavedWindowsPostgres(root, options = {}) {
  const port = options.port ?? 55432;
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("WORKSPACE_DATABASE_PORT_INVALID");
  const cluster = resolve(root, ".local-dev/postgres");
  await stat(resolve(cluster, "PG_VERSION"));
  const binaries =
    options.binaries ?? (await import("@embedded-postgres/windows-x64"));
  const launch = options.spawn ?? spawn;
  await new Promise((ok, fail) => {
    const child = launch(
      binaries.pg_ctl,
      [
        "start",
        "-D",
        cluster,
        "-l",
        resolve(root, ".local-dev/postgres-server.log"),
        "-o",
        `-h 127.0.0.1 -p ${port}`,
        "-w",
        "-t",
        "60",
      ],
      { cwd: root, windowsHide: true, stdio: "ignore" },
    );
    child.once("error", () =>
      fail(
        Object.assign(Error("WORKSPACE_DATABASE_START_FAILED"), {
          status: 503,
        }),
      ),
    );
    child.once("exit", (code) =>
      code === 0
        ? ok()
        : fail(
            Object.assign(Error("WORKSPACE_DATABASE_START_FAILED"), {
              status: 503,
            }),
          ),
    );
  });
}
