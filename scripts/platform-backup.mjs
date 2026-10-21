import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
  lstat,
  statfs,
} from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { Worker } from "node:worker_threads";
import { Pool } from "pg";
const sha = (b) => createHash("sha256").update(b).digest("hex");
async function fileHash(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function mapFiles(files, fn) {
  const result = new Array(files.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      while (cursor < files.length) {
        const at = cursor++;
        result[at] = await fn(files[at]);
      }
    }),
  );
  return result;
}
async function sqliteCopy(source, target, progress = () => {}) {
  return new Promise((ok, fail) => {
    const worker = new Worker(
      new URL("./platform-sqlite-worker.mjs", import.meta.url),
      { workerData: { source, target } },
    );
    let received = false;
    worker.on("message", (message) => {
      if (message.phase) {
        progress(message.phase);
        return;
      }
      received = true;
      message.ok ? ok(message) : fail(Error(message.error));
    });
    worker.once("error", fail);
    worker.once("exit", (code) => {
      if (!received) fail(Error("SQLITE_BACKUP_WORKER_FAILED_" + code));
    });
  });
}
const qi = (s) => '"' + s.replaceAll('"', '""') + '"';
function connection(config) {
  const u = new URL(config.auth_database_url);
  if (u.hostname !== "127.0.0.1" || u.port !== "55432")
    throw Error("BACKUP_LOCAL_DATABASE_REQUIRED");
  return u;
}
async function run(root, tool, database, config, args) {
  const u = connection(config);
  const file = resolve(
    root,
    ".local-dev/postgres-client/pgsql/bin",
    tool + (process.platform === "win32" ? ".exe" : ""),
  );
  await lstat(file);
  await new Promise((ok, fail) => {
    const child = spawn(
      file,
      [
        "--host",
        u.hostname,
        "--port",
        u.port,
        "--username",
        decodeURIComponent(u.username),
        ...args,
        "--dbname",
        database,
      ],
      {
        windowsHide: true,
        shell: false,
        env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let code = "";
    child.stderr.on("data", (b) => {
      if (/error/i.test(String(b))) code = "POSTGRES_BACKUP_ERROR";
    });
    child.once("error", () => fail(Error("POSTGRES_CLIENT_UNAVAILABLE")));
    child.once("exit", (n) =>
      n === 0 ? ok() : fail(Error(code || "POSTGRES_BACKUP_FAILED")),
    );
  });
}
async function tree(root, directory, prefix = "") {
  const info = await lstat(directory).catch((e) =>
    e.code === "ENOENT" ? null : Promise.reject(e),
  );
  if (info?.isSymbolicLink()) throw Error("BACKUP_SYMLINK_REJECTED");
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(
    (e) => (e.code === "ENOENT" ? [] : Promise.reject(e)),
  )) {
    const name = prefix + entry.name,
      file = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error("BACKUP_SYMLINK_REJECTED");
    if (entry.isDirectory())
      files.push(...(await tree(root, file, name + "/")));
    else if (entry.isFile()) files.push({ path: name, source: file });
  }
  return files;
}
async function inventory(client) {
  const tables = (
    await client.query(
      "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('os_private','os_auth') ORDER BY schemaname,tablename",
    )
  ).rows;
  const output = [];
  for (const t of tables) {
    const name = qi(t.schemaname) + "." + qi(t.tablename);
    const row = (
      await client.query(
        `SELECT count(*)::int count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) hash FROM ${name} t`,
      )
    ).rows[0];
    output.push({ schema: t.schemaname, table: t.tablename, ...row });
  }
  return output;
}
export async function createPlatformBackup(
  root,
  pool,
  config,
  toolsRoot = root,
) {
  const directory = resolve(
    root,
    ".local-dev/backups",
    "platform-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      randomUUID(),
  );
  await mkdir(directory, { recursive: true });
  const progress = (stage) => {
    void writeFile(
      resolve(root, ".local-dev/backup-progress.json"),
      JSON.stringify({
        id: relative(resolve(root, ".local-dev/backups"), directory),
        stage,
        updated_at: new Date().toISOString(),
      }),
      { mode: 0o600 },
    ).catch(() => {});
  };
  progress("POSTGRESQL_SNAPSHOT");
  const client = await pool.connect();
  let rows;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (
      await client.query("SELECT pg_export_snapshot() snapshot")
    ).rows[0].snapshot;
    rows = await inventory(client);
    await run(
      toolsRoot,
      "pg_dump",
      decodeURIComponent(connection(config).pathname.slice(1)),
      config,
      [
        "--format=custom",
        "--snapshot=" + snapshot,
        "--file=" + resolve(directory, "database.dump"),
      ],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const objects = await tree(
    root,
    resolve(root, ".local-dev/workspace-objects"),
  );
  for (const file of objects) {
    const target = resolve(directory, "objects", file.path);
    await mkdir(resolve(target, ".."), { recursive: true });
    await copyFile(file.source, target);
  }
  for (const name of [
    "app-config.json",
    "platform-auth-secret",
    "postgres-secrets.json",
    "network.json",
  ]) {
    const from = resolve(root, ".local-dev", name);
    if (await lstat(from).catch(() => null)) {
      await mkdir(resolve(directory, "configuration"), { recursive: true });
      await copyFile(from, resolve(directory, "configuration", name));
    }
  }
  // SQLite's online backup includes committed WAL pages. Raw copies of an open
  // database and its WAL cannot provide that guarantee.
  const durable = [
    "local-browser/library",
    "phase2/corpus",
    ".board-data",
    ".local-dev/gabriel",
    ".local-dev/session-recordings",
    ".local-dev/tls",
  ];
  const sqlite = [],
    originalHashes = new Set();
  for (const path of durable) {
    const entries = await tree(root, resolve(root, path));
    const databases = entries.filter((file) =>
      /\.(sqlite|sqlite3|db)$/.test(file.path),
    );
    for (const file of databases) {
      const target = resolve(directory, "files", path, file.path);
      await mkdir(resolve(target, ".."), { recursive: true });
      const checked = await sqliteCopy(file.source, target, progress);
      for (const sha of checked.originals ?? []) originalHashes.add(sha);
      sqlite.push(relative(directory, target).replaceAll("\\", "/"));
    }
    // Enumerate originals after the catalog snapshot. Every immutable file
    // referenced by that snapshot now exists before this file inventory starts.
    progress("COPYING_DURABLE_FILES");
    const copies = (
      databases.length ? await tree(root, resolve(root, path)) : entries
    ).filter(
      (file) =>
        !(
          path === "local-browser/library" &&
          (file.path.includes("/cache/") ||
            file.path.startsWith("research/cache/"))
        ) &&
        !/(?:-wal|-shm|-journal|\.tmp|\.next|\.lock)$/.test(file.path) &&
        !/\.(sqlite|sqlite3|db)$/.test(file.path),
    );
    await mapFiles(copies, async (file) => {
      const target = resolve(directory, "files", path, file.path);
      await mkdir(resolve(target, ".."), { recursive: true });
      await copyFile(file.source, target);
    });
  }
  for (const name of [
    ".env",
    ".env.local",
    ".local-dev/junta-metadata.json",
    ".local-dev/library-full-load.json",
  ]) {
    const from = resolve(root, name);
    if (await lstat(from).catch(() => null)) {
      const target = resolve(directory, "files", name);
      await mkdir(resolve(target, ".."), { recursive: true });
      await copyFile(from, target);
    }
  }
  const files = await tree(root, directory);
  progress("HASHING_CAPTURED_FILES");
  const manifest = {
    format: "LAW_ORDER_PLATFORM_BACKUP",
    version: 1,
    coverage: {
      version: 2,
      sqlite,
      library_original_hashes: [...originalHashes],
      sqlite_verification: "SOURCE_TABLE_STRUCTURE_AND_FTS_QUERY",
      durable,
      excluded: [
        "research/cache (download cache)",
        "node_modules",
        "PostgreSQL live data directory",
        "generated build and test artifacts",
      ],
    },
    created_at: new Date().toISOString(),
    database: decodeURIComponent(connection(config).pathname.slice(1)),
    tables: rows,
    files: await mapFiles(files, async (f) => ({
      path: f.path,
      sha256: await fileHash(f.source),
    })),
  };
  const capturedHashes = new Set(manifest.files.map((f) => f.sha256));
  if ([...originalHashes].some((sha) => !capturedHashes.has(sha)))
    throw Error("LIBRARY_ORIGINALS_MISSING_FROM_BACKUP");
  await writeFile(
    resolve(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  await verifyPlatformBackup(directory);
  progress("VERIFIED");
  return {
    id: relative(resolve(root, ".local-dev/backups"), directory),
    created_at: manifest.created_at,
    tables: rows.length,
    files: files.length,
    integrity: "VERIFIED",
    restoration: "NOT_TESTED",
  };
}
export async function verifyPlatformBackup(directory) {
  const manifest = JSON.parse(
    await readFile(resolve(directory, "manifest.json"), "utf8"),
  );
  if (
    manifest.format !== "LAW_ORDER_PLATFORM_BACKUP" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    !manifest.files.some((f) => f.path === "database.dump")
  )
    throw Error("INVALID_BACKUP_MANIFEST");
  const seen = new Set();
  let verifiedBytes = 0;
  const checkedDirectories = new Map();
  const checkDirectory = (path) => {
    if (!checkedDirectories.has(path))
      checkedDirectories.set(
        path,
        lstat(path).then((info) => {
          if (info.isSymbolicLink()) throw Error("BACKUP_SYMLINK_REJECTED");
        }),
      );
    return checkedDirectories.get(path);
  };
  const capturedHashes = new Set(manifest.files.map((f) => f.sha256));
  if (
    (manifest.coverage?.library_original_hashes ?? []).some(
      (sha) => !capturedHashes.has(sha),
    )
  )
    throw Error("LIBRARY_ORIGINALS_MISSING_FROM_BACKUP");
  for (const f of manifest.files) {
    if (
      typeof f.path !== "string" ||
      isAbsolute(f.path) ||
      /[\\:]/.test(f.path) ||
      f.path.split("/").some((p) => !p || p === "." || p === "..") ||
      seen.has(f.path)
    )
      throw Error("INVALID_BACKUP_PATH");
    seen.add(f.path);
  }
  await mapFiles(manifest.files, async (f) => {
    const target = resolve(directory, f.path);
    for (
      let parent = directory, parts = f.path.split("/"), i = 0;
      i < parts.length;
      i++
    ) {
      await checkDirectory(parent);
      parent = resolve(parent, parts[i]);
    }
    const info = await lstat(target);
    if (info.isSymbolicLink() || (await fileHash(target)) !== f.sha256)
      throw Error("BACKUP_INTEGRITY_FAILED");
    verifiedBytes += info.size;
  });
  Object.defineProperty(manifest, "verified_bytes", { value: verifiedBytes });
  return manifest;
}
export async function restorePlatformBackup(
  root,
  directory,
  pool,
  config,
  toolsRoot = root,
) {
  const manifest = await verifyPlatformBackup(directory);
  const space = await statfs(root);
  if (
    space.bavail * space.bsize <
    manifest.verified_bytes * 1.1 + 256 * 1024 * 1024
  )
    throw Error("RESTORE_INSUFFICIENT_DISK_SPACE");
  const target = "law_order_restore_" + randomUUID().replaceAll("-", "");
  if (
    !/^law_order_restore_[a-f0-9]{32}$/.test(target) ||
    target === connection(config).pathname.slice(1)
  )
    throw Error("INVALID_RESTORE_TARGET");
  await pool.query(
    `CREATE DATABASE ${qi(target)} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
  );
  const u = connection(config);
  u.pathname = "/" + target;
  const restored = new Pool({ connectionString: u.href, max: 1 });
  try {
    await run(toolsRoot, "pg_restore", target, config, [
      "--exit-on-error",
      "--no-owner",
      resolve(directory, "database.dump"),
    ]);
    const actual = await inventory(restored);
    if (JSON.stringify(actual) !== JSON.stringify(manifest.tables))
      throw Error("RESTORE_CONTENT_MISMATCH");
    // Exercise the access-log sequence in the disposable database, never in the active one.
    const hasLog = (
      await restored.query(
        "SELECT to_regclass('os_private.platform_access_log') present",
      )
    ).rows[0]?.present;
    const serial = hasLog
      ? (
          await restored.query(
            "SELECT pg_get_serial_sequence('os_private.platform_access_log','id') sequence",
          )
        ).rows[0]?.sequence
      : null;
    if (serial) {
      const check = (
        await restored.query(
          "SELECT nextval($1)::numeric > coalesce((SELECT max(id) FROM os_private.platform_access_log),0) valid",
          [serial],
        )
      ).rows[0];
      if (!check.valid) throw Error("RESTORE_SEQUENCE_MISMATCH");
    }
    // Materialize files into a fresh isolated tree, without replacing any active
    // document, original, credential or SQLite database.
    const restoredFiles = resolve(root, ".local-dev/restore-checks", target);
    await mkdir(restoredFiles, { recursive: true });
    await mapFiles(
      manifest.files.filter((f) => f.path !== "database.dump"),
      async (file) => {
        const dest = resolve(restoredFiles, file.path);
        await mkdir(resolve(dest, ".."), { recursive: true });
        await copyFile(resolve(directory, file.path), dest);
        if ((await fileHash(dest)) !== file.sha256)
          throw Error("RESTORE_FILE_MISMATCH");
      },
    );
    for (const path of manifest.coverage?.sqlite ?? [])
      await sqliteCopy(null, resolve(restoredFiles, path));
    const result = {
      status: "VERIFIED",
      tested_at: new Date().toISOString(),
      tables: actual.length,
      active_database_changed: false,
      files_restored: manifest.files.length - 1,
      sqlite_verified: manifest.coverage?.sqlite?.length ?? 0,
      isolated_files: relative(root, restoredFiles).replaceAll("\\", "/"),
    };
    await writeFile(
      resolve(directory, "restoration.json"),
      JSON.stringify(result, null, 2),
      { mode: 0o600 },
    );
    return result;
  } finally {
    await restored.end();
    // Only this invocation's freshly generated verification database is removed.
    if (!/^law_order_restore_[a-f0-9]{32}$/.test(target))
      throw Error("INVALID_RESTORE_TARGET");
    await pool.query(`DROP DATABASE ${qi(target)}`);
  }
}
