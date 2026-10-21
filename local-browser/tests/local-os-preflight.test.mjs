import { expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { preflightLocalOS } from "../../scripts/local-os-preflight.mjs";
import { startSavedWindowsPostgres } from "../../scripts/local-postgres-start.mjs";

const appHtml =
  '<head><meta name="law-order-platform" content="local-accounts-v1"><title>Documento abierto</title></head>';
function setup(html = appHtml) {
  return {
    root: process.cwd(),
    occupied: vi.fn(async () => true),
    request: vi.fn(async () => new Response(html)),
    recoverDatabase: vi.fn(async () => {}),
    wait: vi.fn(async () => {}),
    report: vi.fn(),
  };
}
it("starts only when the HTTP port is free and leaves unknown listeners alone", async () => {
  const free = setup();
  free.occupied.mockResolvedValue(false);
  expect(await preflightLocalOS(free)).toBe(1);
  expect(free.request).not.toHaveBeenCalled();
  expect(free.recoverDatabase).not.toHaveBeenCalled();
  const foreign = setup("<title>Otra aplicación</title>");
  expect(await preflightLocalOS(foreign)).toBe(2);
  expect(foreign.recoverDatabase).not.toHaveBeenCalled();
});
it("recovers the existing OS database before opening the browser, independently of the page title", async () => {
  const f = setup(),
    order = [];
  f.recoverDatabase.mockImplementation(async () => {
    order.push("database");
  });
  f.wait.mockImplementation(async () => {
    order.push("ready");
  });
  expect(await preflightLocalOS(f)).toBe(0);
  expect(order).toEqual(["database", "ready"]);
});
it.each(["database", "readiness"])(
  "blocks a duplicate HTTP server when %s recovery fails",
  async (failure) => {
    const f = setup();
    (failure === "database" ? f.recoverDatabase : f.wait).mockRejectedValue(
      Error("PRIVATE_CREDENTIAL_MUST_NOT_LEAK"),
    );
    expect(await preflightLocalOS(f)).toBe(2);
    expect(f.report.mock.calls.flat().join(" ")).toContain("PostgreSQL");
    expect(f.report.mock.calls.flat().join(" ")).not.toContain(
      "PRIVATE_CREDENTIAL",
    );
  },
);
it.each([0, 1])(
  "uses native pg_ctl for an existing cluster; exit %s never reinitializes or deletes data",
  async (exitCode) => {
    const root = await mkdtemp(resolve(tmpdir(), "law-order-launcher-"));
    try {
      const launch = vi.fn(() => {
        const child = new EventEmitter();
        queueMicrotask(() => child.emit("exit", exitCode));
        return child;
      });
      await expect(
        startSavedWindowsPostgres(root, {
          binaries: { pg_ctl: "bundled-pg-ctl" },
          spawn: launch,
        }),
      ).rejects.toMatchObject({ code: "ENOENT" });
      expect(launch).not.toHaveBeenCalled();
      await mkdir(resolve(root, ".local-dev/postgres"), { recursive: true });
      const versionFile = resolve(root, ".local-dev/postgres/PG_VERSION");
      await writeFile(versionFile, "18");
      const start = startSavedWindowsPostgres(root, {
        binaries: { pg_ctl: "bundled-pg-ctl" },
        spawn: launch,
      });
      if (exitCode === 0) await start;
      else
        await expect(start).rejects.toMatchObject({
          message: "WORKSPACE_DATABASE_START_FAILED",
          status: 503,
        });
      expect(launch.mock.calls[0][0]).toBe("bundled-pg-ctl");
      expect(launch.mock.calls[0][1][0]).toBe("start");
      expect(launch.mock.calls[0][1]).toContain(
        resolve(root, ".local-dev/postgres"),
      );
      expect(launch.mock.calls[0][2]).toMatchObject({
        windowsHide: true,
        stdio: "ignore",
      });
      expect(await readFile(versionFile, "utf8")).toBe("18");
    } finally {
      const base = resolve(tmpdir()) + sep;
      if (
        !root.startsWith(base) ||
        !root.slice(base.length).startsWith("law-order-launcher-")
      )
        throw Error("UNSAFE_TEST_CLEANUP");
      await rm(root, { recursive: true, force: true });
    }
  },
);
