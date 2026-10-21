import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { ConfigSchema } from "../../apps/api/src/config.js";
const config = ConfigSchema.parse(
  JSON.parse(readFileSync(".local-dev/app-config.json", "utf8")),
);
if (config.supabase_key === "LOCAL_SUPABASE_SECRET_KEY_REQUIRED")
  throw Error("LOCAL_SUPABASE_NOT_CONFIGURED");
const client = createClient(config.supabase_url, config.supabase_key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pool = new Pool({ connectionString: config.auth_database_url });
const credentials = [];
try {
  for (const name of ["admin", "lawyer", "reviewer", "other"]) {
    const email = `${name}@law.invalid`,
      password = randomBytes(18).toString("base64url");
    const result = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (result.error) throw Error("LOCAL_IDENTITY_SEED_FAILED");
    const user = result.data.user;
    await pool.query(
      "INSERT INTO os_private.identities(id,subject,display_name) VALUES($1,$1,$2)",
      [user.id, `Sintético ${name}`],
    );
    credentials.push({ id: user.id, email, password });
  }
  const bucket = await client.storage.createBucket("law-order-private", {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["text/plain", "text/plain; charset=utf-8"],
  });
  if (
    bucket.error &&
    !bucket.error.message.toLowerCase().includes("already exists")
  )
    throw Error("PRIVATE_BUCKET_CREATION_FAILED");
  writeFileSync(
    ".local-dev/synthetic-credentials.json",
    JSON.stringify(credentials, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Cuatro identidades sintéticas reales del IdP local creadas. Credenciales solo en .local-dev/synthetic-credentials.json.",
  );
} finally {
  await pool.end();
}
