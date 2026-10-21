import { it, expect } from "vitest";
import { createServer, request } from "node:https";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { database } from "./fixtures.js";
// prettier-ignore
// @ts-expect-error Native local operations.
import {prepareLocalTls,saveOperations,copyExternalBackup,privateIPv4,validateExternalDestination} from "../../scripts/platform-operations.mjs";
// @ts-expect-error Native backup tools.
import { createPlatformBackup } from "../../scripts/platform-backup.mjs";
// @ts-expect-error Native bridge.
import { createPlatformBridge } from "../../scripts/platform-bridge.mjs";
it("keeps private network bindings and backup destinations constrained", async () => {
  expect(privateIPv4("192.168.1.2")).toBe(true);
  expect(privateIPv4("172.31.9.8")).toBe(true);
  expect(privateIPv4("172.32.1.1")).toBe(false);
  expect(privateIPv4("8.8.8.8")).toBe(false);
  expect(privateIPv4("192.168.999.1")).toBe(false);
  await expect(
    validateExternalDestination(process.cwd(), process.cwd()),
  ).rejects.toThrow("EXTERNAL_BACKUP_MUST_BE_OUTSIDE_PROJECT");
  await expect(
    validateExternalDestination(process.cwd(), "relative"),
  ).rejects.toThrow("EXTERNAL_BACKUP_LOCAL_ABSOLUTE_PATH_REQUIRED");
});
it("uses a pinned local CA, real secure sessions, single-use recovery and a verified second backup location", async () => {
  const db = await database(),
    root = resolve(".local-dev/platform-network-tests", randomUUID()),
    external = resolve(".local-dev/platform-external-tests", randomUUID());
  await mkdir(root, { recursive: true });
  await mkdir(external, { recursive: true });
  const base = JSON.parse(await readFile(".local-dev/app-config.json", "utf8")),
    url = new URL(base.auth_database_url);
  url.pathname = "/" + db.name;
  const config = { ...base, auth_database_url: url.href };
  let platform: any;
  const tls = await prepareLocalTls(root, "127.0.0.1"),
    server = createServer(tls, async (req, res) => {
      try {
        if (await platform.handle(req, res)) return;
        res.writeHead(404);
        res.end();
      } catch {
        res.writeHead(500);
        res.end();
      }
    });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const origin = `https://127.0.0.1:${(server.address() as any).port}`;
  platform = createPlatformBridge(root, origin, { pool: db.pool, config });
  async function call(
    path: string,
    body?: unknown,
    cookie?: string,
    trusted = true,
  ): Promise<{ status: number; data: any; cookies: string }> {
    return new Promise((ok, fail) => {
      const req = request(
        origin + path,
        {
          method: body === undefined ? "GET" : "POST",
          ca: trusted ? tls.ca : undefined,
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            "X-Platform": "1",
            ...(cookie ? { Cookie: cookie } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (b) => chunks.push(b));
          res.on("end", () => {
            try {
              ok({
                status: res.statusCode!,
                data: JSON.parse(Buffer.concat(chunks).toString()),
                cookies: (res.headers["set-cookie"] ?? []).join("; "),
              });
            } catch (e) {
              fail(e);
            }
          });
        },
      );
      req.on("error", fail);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
  try {
    await expect(
      call("/local/platform/status", undefined, undefined, false),
    ).rejects.toThrow();
    expect((await call("/local/platform/status")).status).toBe(200);
    const password = "Tls-test-" + randomUUID();
    expect(
      (
        await call("/local/platform/activate", {
          snapshot: null,
          name: "TLS Director",
          email: "tls-director@law.invalid",
          password,
        })
      ).status,
    ).toBe(200);
    const signed = await call("/local/auth/sign-in/email", {
      email: "tls-director@law.invalid",
      password,
    });
    expect(signed.cookies).toContain("Secure");
    const cookie = signed.cookies.split(
      /; (?:Path|Expires|HttpOnly|Secure|SameSite|Max-Age)=[^;]*|; HttpOnly|; Secure/,
    )[0];
    const core = async (path: string, body?: unknown) =>
      call(
        "/local/platform/core",
        { path, body, command_id: randomUUID() },
        cookie,
      );
    const firm = (await core("/firms", { name: "TLS Study" })).data.data;
    expect(firm.id).toBeTruthy();
    const invitation = await call(
      "/local/platform/invite",
      { firm_id: firm.id, email: "tls-lawyer@law.invalid", role: "LAWYER" },
      cookie,
    );
    expect(invitation.data.link).toContain(origin);
    expect(
      (
        await call("/local/platform/accept-invitation", {
          token: new URL(invitation.data.link).hash.slice(12),
          name: "TLS Lawyer",
          password,
        })
      ).status,
    ).toBe(200);
    const second = await call("/local/auth/sign-in/email", {
      email: "tls-lawyer@law.invalid",
      password,
    });
    expect(second.status).toBe(200);
    expect(second.cookies).toContain("Secure");
    const state = await call("/local/platform/state", undefined, cookie),
      lawyer = state.data.profiles.find(
        (p: any) => p.display_name === "TLS Lawyer",
      );
    const recovery = await call(
        "/local/platform/recovery-link",
        { firm_id: firm.id, user_id: lawyer.id },
        cookie,
      ),
      token = new URL(recovery.data.link).hash.slice(10);
    expect(
      (
        await call("/local/platform/recover-account", {
          token,
          password: "Recovered-" + randomUUID(),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call("/local/platform/recover-account", {
          token,
          password: "Recovered-again-" + randomUUID(),
        })
      ).status,
    ).toBe(400);
    await saveOperations(root, { external_backup: external });
    const backup = await createPlatformBackup(
      root,
      db.pool,
      config,
      process.cwd(),
    );
    expect((await copyExternalBackup(root, backup.id)).status).toBe("VERIFIED");
    expect((await copyExternalBackup(root, backup.id)).status).toBe(
      "VERIFIED_EXISTING",
    );
  } finally {
    await platform.close();
    await new Promise<void>((ok) => server.close(() => ok()));
    await db.close();
  }
}, 120000);
