import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
// Offline operator recovery: requires access to this installation's local secret.
// Creates a single-use link; never changes a password or promotes an account.
if (process.argv[2] !== "--issue-owner-link")
  throw Error(
    "Usage: node scripts/platform-recover-owner.mjs --issue-owner-link",
  );
const root = resolve("."),
  config = JSON.parse(
    await readFile(resolve(root, ".local-dev/app-config.json"), "utf8"),
  ),
  url = new URL(config.auth_database_url);
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("LOCAL_DATABASE_REQUIRED");
const pool = new Pool({ connectionString: url.href, max: 1 });
try {
  const owner = (
    await pool.query(
      "SELECT owner_id FROM os_private.platform_state WHERE id=true",
    )
  ).rows[0]?.owner_id;
  if (!owner) throw Error("INSTALLATION_NOT_ACTIVE");
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO os_private.platform_recovery(token_hash,user_id,created_by,firm_id,expires_at) VALUES($1,$2,'LOCAL_OPERATOR',NULL,now()+interval '30 minutes')",
    [createHash("sha256").update(token).digest("hex"), owner],
  );
  console.log(`http://127.0.0.1:4313/#recovery=${token}`);
} finally {
  await pool.end();
}
