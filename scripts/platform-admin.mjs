import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  createPlatformBackup,
  restorePlatformBackup,
  verifyPlatformBackup,
} from "./platform-backup.mjs";

// Local operator tool. It never replaces the active database or changes accounts.
const [action, id] = process.argv.slice(2),
  root = resolve(".");
if (
  !["backup", "verify", "restore-check"].includes(action) ||
  (action !== "backup" && !/^platform-[a-zA-Z0-9-]+$/.test(id ?? ""))
)
  throw Error(
    "Uso: node scripts/platform-admin.mjs backup | verify ID | restore-check ID",
  );
const directory = resolve(root, ".local-dev/backups", id ?? "");
if (action === "verify") {
  const result = await verifyPlatformBackup(directory);
  console.log(
    JSON.stringify({ id, integrity: "VERIFIED", files: result.files.length }),
  );
} else {
  const config = JSON.parse(
    await readFile(resolve(root, ".local-dev/app-config.json"), "utf8"),
  );
  const url = new URL(config.auth_database_url);
  if (url.hostname !== "127.0.0.1" || url.port !== "55432")
    throw Error("LOCAL_DATABASE_REQUIRED");
  const pool = new Pool({ connectionString: url.href, max: 2 });
  try {
    console.log(
      JSON.stringify(
        action === "backup"
          ? await createPlatformBackup(root, pool, config)
          : await restorePlatformBackup(root, directory, pool, config),
      ),
    );
  } finally {
    await pool.end();
  }
}
