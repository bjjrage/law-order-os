// TEST HARNESS ONLY: real PostgreSQL/filesystem, synthetic identity/session transport.
// The running application imports SupabaseSessions, never this module.
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  schemaSql,
  constraintsSql,
} from "../../packages/persistence-postgres/src/schema.js";
import {
  PostgresPersistence,
  type BlobStore,
} from "../../packages/persistence-postgres/src/index.js";
import { TestAuthenticator } from "../../os-core/testing/memory.js";
import { OsCoreService } from "../../os-core/src/service.js";
import type { SessionIdentity } from "../../apps/api/src/auth.js";
export class HarnessSessions
  extends TestAuthenticator
  implements SessionIdentity
{
  async login(email: string, _password: string) {
    const user = users.find((u) => u.email === email);
    if (!user) throw Error("HARNESS_USER_UNKNOWN");
    return { token: user.token, csrf: "harness-csrf" };
  }
  async logout(token: string) {
    this.revoke(token);
  }
  async csrf(_token: string) {
    return "harness-csrf";
  }
}
export const users = ["admin", "lawyer", "reviewer", "outsider", "other"]
  .map((name) => ({
    id: randomUUID(),
    subject: "",
    display_name: `Sintético ${name}`,
    active: true,
    email: `${name}@law.invalid`,
    token: randomUUID(),
  }))
  .map((u) => ({ ...u, subject: u.id }));
export const [admin, lawyer, reviewer, outsider, other] = users as [
  (typeof users)[number],
  (typeof users)[number],
  (typeof users)[number],
  (typeof users)[number],
  (typeof users)[number],
];
export class FileTestBlobs implements BlobStore {
  constructor(readonly directory: string) {}
  private filename(key: string) {
    if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+$/.test(key))
      throw Error("INVALID_BLOB_KEY");
    return resolve(this.directory, key.replaceAll("/", "_"));
  }
  async writeOnce(key: string, bytes: Uint8Array, _mime: string) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.filename(key), bytes, { flag: "wx" });
  }
  async read(key: string) {
    return readFile(this.filename(key));
  }
}
export async function database() {
  const secrets = JSON.parse(
    readFileSync(".local-dev/postgres-secrets.json", "utf8"),
  );
  const name = "law_order_test_" + randomUUID().replaceAll("-", "");
  const owner = new Pool({
    host: "127.0.0.1",
    port: 55432,
    user: "postgres",
    password: secrets.admin,
    database: "postgres",
  });
  await owner.query(
    `CREATE DATABASE "${name}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
  );
  const pool = new Pool({
    host: "127.0.0.1",
    port: 55432,
    user: "postgres",
    password: secrets.admin,
    database: name,
    max: 10,
  });
  await pool.query(schemaSql + constraintsSql);
  const runtime = new Pool({
    host: "127.0.0.1",
    port: 55432,
    user: "os_app_login",
    password: secrets.runtime,
    database: name,
    max: 5,
  });
  for (const u of users)
    await pool.query(
      "INSERT INTO os_private.identities(id,subject,display_name) VALUES($1,$1,$2)",
      [u.id, u.display_name],
    );
  const auth = new HarnessSessions();
  for (const u of users) auth.register(u, u.token);
  const blobs = new FileTestBlobs(resolve(".local-dev/test-blobs", name));
  const persistence = new PostgresPersistence(runtime, blobs),
    core = new OsCoreService(persistence, auth);
  return {
    name,
    pool,
    runtime,
    auth,
    blobs,
    persistence,
    core,
    async close() {
      await runtime.end();
      await pool.end();
      if (!/^law_order_test_[a-f0-9]{32}$/.test(name))
        throw Error("INVALID_TEST_DATABASE");
      await owner.query(`DROP DATABASE "${name}"`);
      await owner.end();
    },
  };
}
export async function fixture(db: Awaited<ReturnType<typeof database>>) {
  const firm = await db.core.createLawFirm(admin.token, "Estudio sintético A");
  for (const u of [lawyer, reviewer, outsider])
    await db.core.addMember(admin.token, firm.id, u.id, "LAWYER");
  const foreign = await db.core.createLawFirm(
    other.token,
    "Estudio sintético B",
  );
  const client = await db.core.createClient(admin.token, firm.id, {
    kind: "ORGANIZATION",
    display_name: "Cliente sintético",
    identification: null,
  });
  const matter = await db.core.createMatter(admin.token, firm.id, {
    client_id: client.id,
    title: "Asesoría contractual sintética",
    kind: "ADVISORY",
    subject_area: "Contratos",
    responsible_identity_id: lawyer.id,
    opened_on: "2026-10-13",
    closed_on: null,
  });
  await db.core.grantParticipant(admin.token, firm.id, matter.id, reviewer.id, [
    "READ",
    "DOCUMENT_WRITE",
    "TASK_WRITE",
    "DRAFT_WRITE",
    "DRAFT_REVIEW",
  ]);
  return { firm, foreign, client, matter };
}
