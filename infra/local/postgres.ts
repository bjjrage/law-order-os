import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  schemaSql,
  constraintsSql,
} from "../../packages/persistence-postgres/src/schema.js";
const directory = resolve(".local-dev");
mkdirSync(directory, { recursive: true });
const secretsFile = resolve(directory, "postgres-secrets.json");
const secrets = existsSync(secretsFile)
  ? JSON.parse(readFileSync(secretsFile, "utf8"))
  : {
      admin: randomBytes(24).toString("hex"),
      runtime: randomBytes(24).toString("hex"),
    };
if (!existsSync(secretsFile))
  writeFileSync(secretsFile, JSON.stringify(secrets), {
    flag: "wx",
    mode: 0o600,
  });
const server = new EmbeddedPostgres({
  databaseDir: resolve(directory, "postgres"),
  user: "postgres",
  password: secrets.admin,
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(resolve(directory, "postgres/PG_VERSION")))
  await server.initialise();
await server.start();
const pool = new Pool({
  host: "127.0.0.1",
  port: 55432,
  user: "postgres",
  password: secrets.admin,
  database: "postgres",
});
if (
  !(
    await pool.query(
      "SELECT 1 FROM pg_database WHERE datname='law_order_local'",
    )
  ).rowCount
)
  await pool.query(
    "CREATE DATABASE law_order_local WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
  );
await pool.end();
const admin = new Pool({
  host: "127.0.0.1",
  port: 55432,
  user: "postgres",
  password: secrets.admin,
  database: "law_order_local",
});
if (
  !(await admin.query("SELECT 1 FROM pg_namespace WHERE nspname='os_private'"))
    .rowCount
) {
  await admin.query("BEGIN");
  try {
    await admin.query(schemaSql + constraintsSql);
    await admin.query("COMMIT");
  } catch (error) {
    await admin.query("ROLLBACK");
    throw error;
  }
}
if (
  !(
    await admin.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='os_private' AND table_name='approvals'",
    )
  ).rowCount
)
  await admin.query(constraintsSql);
if (
  !(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='os_app_login'"))
    .rowCount
) {
  await admin.query(
    `CREATE ROLE os_app_login LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${secrets.runtime}'`,
  );
  await admin.query("GRANT os_runtime TO os_app_login");
}
await admin.end();
console.log(
  "PostgreSQL local listo en 127.0.0.1:55432. Datos: .local-dev/postgres. Sin credenciales en logs.",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void server.stop().then(() => process.exit(0));
  });
await new Promise(() => {});
