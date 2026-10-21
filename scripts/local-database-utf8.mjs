import { readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

// Explicit maintenance operation: the local application must be stopped first.
// Never overwrites or drops the source database. Configuration switches only
// after a successful restore and full per-table content/sequence comparison.
const root = process.cwd();
const clientBin = resolve(
  process.argv[2] ?? resolve(root, ".local-dev/postgres-client/pgsql/bin"),
);
const configPath = resolve(root, ".local-dev/app-config.json");
const original = await readFile(configPath, "utf8");
const config = JSON.parse(original);
const source = new URL(config.auth_database_url);
const runtime = new URL(config.database_url);
for (const url of [source, runtime])
  if (url.hostname !== "127.0.0.1" || url.port !== "55432")
    throw Error("LOCAL_DATABASE_REQUIRED");
if (source.pathname !== runtime.pathname || source.username !== "postgres")
  throw Error("LOCAL_DATABASE_CONFIGURATION_MISMATCH");
const sourceName = source.pathname.slice(1);
if (!/^[a-z][a-z0-9_]{0,50}$/.test(sourceName))
  throw Error("LOCAL_DATABASE_NAME_INVALID");
const sourceDb = new Pool({ connectionString: source.href, max: 1 });
let admin, targetDb;
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
async function inventory(db) {
  const tables = (
    await db.query(`SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2`)
  ).rows;
  const result = [];
  for (const table of tables) {
    const rows = (
      await db.query(
        `SELECT to_jsonb(t) AS data FROM ${quote(table.schemaname)}.${quote(table.tablename)} t`,
      )
    ).rows;
    result.push({
      ...table,
      rows: rows.length,
      sha256: hash(rows.map((r) => hash(r.data)).sort()),
    });
  }
  const sequences = (
    await db.query(`SELECT schemaname,sequencename,last_value FROM pg_sequences
    WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2`)
  ).rows;
  return { tables: result, sequences };
}
async function binary(name, args, env) {
  const path = resolve(clientBin, name + ".exe");
  await stat(path);
  await new Promise((done, reject) => {
    const child = spawn(path, args, {
      cwd: root,
      windowsHide: true,
      stdio: "ignore",
      env,
    });
    child.once("error", () =>
      reject(Error("LOCAL_DATABASE_" + name.toUpperCase() + "_FAILED")),
    );
    child.once("exit", (code) =>
      code === 0
        ? done()
        : reject(Error("LOCAL_DATABASE_" + name.toUpperCase() + "_FAILED")),
    );
  });
}
try {
  const encoding = (await sourceDb.query("SHOW server_encoding")).rows[0]
    .server_encoding;
  if (encoding === "UTF8") {
    console.log(JSON.stringify({ status: "ALREADY_UTF8" }));
  } else {
    await Promise.all([
      stat(resolve(clientBin, "pg_dump.exe")),
      stat(resolve(clientBin, "pg_restore.exe")),
    ]);
    const active = await sourceDb.query(
      "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()",
    );
    if (active.rows[0].n !== 0)
      throw Error("STOP_LOCAL_APPLICATION_BEFORE_MIGRATION");
    const running = await sourceDb.query(
      "SELECT count(*)::int n FROM os_private.workspace_jobs WHERE status='RUNNING'",
    );
    if (running.rows[0].n !== 0) throw Error("LOCAL_WORKSPACE_TASKS_RUNNING");
    const before = await inventory(sourceDb);
    const id =
      new Date().toISOString().replace(/[^0-9]/g, "") +
      "_" +
      randomBytes(3).toString("hex");
    const targetName = "law_order_utf8_" + id;
    const backup = resolve(root, ".local-dev/backups/utf8-" + id);
    await mkdir(backup, { recursive: true });
    await writeFile(resolve(backup, "app-config.original.json"), original, {
      flag: "wx",
      mode: 0o600,
    });
    const maintenance = new URL(source.href);
    maintenance.pathname = "/postgres";
    admin = new Pool({ connectionString: maintenance.href, max: 1 });
    await admin.query(
      `CREATE DATABASE ${quote(targetName)} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    const env = {
      ...process.env,
      PGPASSWORD: decodeURIComponent(source.password),
      PGCLIENTENCODING: "UTF8",
    };
    const common = [
      "--host=127.0.0.1",
      "--port=55432",
      "--username=postgres",
      "--no-password",
    ];
    const archive = resolve(backup, "original.dump");
    await binary(
      "pg_dump",
      [
        ...common,
        "--dbname=" + sourceName,
        "--format=custom",
        "--encoding=UTF8",
        "--file=" + archive,
      ],
      env,
    );
    await binary(
      "pg_restore",
      [...common, "--dbname=" + targetName, "--exit-on-error", archive],
      env,
    );
    const target = new URL(source.href);
    target.pathname = "/" + targetName;
    targetDb = new Pool({ connectionString: target.href, max: 1 });
    const after = await inventory(targetDb);
    // Recheck the original too; refuse to switch if it changed during the copy.
    if (
      hash(before) !== hash(after) ||
      hash(before) !== hash(await inventory(sourceDb))
    )
      throw Error("LOCAL_DATABASE_COPY_MISMATCH_CONFIGURATION_UNCHANGED");
    const unicode = "Prueba ñ · 中文 😀 \uFFFD";
    await targetDb.query("BEGIN");
    try {
      await targetDb.query(
        "CREATE TEMP TABLE unicode_roundtrip (value jsonb) ON COMMIT DROP",
      );
      await targetDb.query("INSERT INTO unicode_roundtrip VALUES ($1)", [
        { text: unicode },
      ]);
      if (
        (await targetDb.query("SELECT value FROM unicode_roundtrip")).rows[0]
          .value.text !== unicode
      )
        throw Error("LOCAL_DATABASE_UNICODE_ROUNDTRIP_FAILED");
    } finally {
      await targetDb.query("ROLLBACK");
    }
    await writeFile(
      resolve(backup, "verification.json"),
      JSON.stringify(
        {
          source_encoding: encoding,
          target_encoding: "UTF8",
          source_database: sourceName,
          target_database: targetName,
          inventory: after,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    source.pathname = runtime.pathname = "/" + targetName;
    config.auth_database_url = source.href;
    config.database_url = runtime.href;
    if ((await readFile(configPath, "utf8")) !== original)
      throw Error("LOCAL_DATABASE_CONFIG_CHANGED_DURING_MIGRATION");
    const temporary = resolve(backup, "app-config.utf8.json");
    await writeFile(temporary, JSON.stringify(config, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, configPath);
    console.log(
      JSON.stringify({
        status: "MIGRATED",
        source_encoding: encoding,
        target_encoding: "UTF8",
        tables_verified: after.tables.length,
        rows_verified: after.tables.reduce((n, t) => n + t.rows, 0),
        original_database_retained: true,
        backup,
      }),
    );
  }
} finally {
  await Promise.allSettled([sourceDb.end(), admin?.end(), targetDb?.end()]);
}
