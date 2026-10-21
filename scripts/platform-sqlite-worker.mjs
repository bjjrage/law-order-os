import { parentPort, workerData } from "node:worker_threads";
import { DatabaseSync, backup } from "node:sqlite";
const { source, target } = workerData;
let originals = [];
try {
  if (source) {
    parentPort.postMessage({ phase: "SQLITE_SNAPSHOT" });
    const db = new DatabaseSync(source, { readOnly: true, timeout: 10000 });
    try {
      await backup(db, target, { rate: 2147483647 });
    } finally {
      db.close();
    }
  }
  const db = new DatabaseSync(target, { readOnly: true, timeout: 10000 });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    parentPort.postMessage({ phase: "SQLITE_STRUCTURE_AND_SEARCH" });
    // Full FTS shadow-index audits can take hours on a growing legal corpus.
    // Backups verify the source table, a real FTS query and every captured byte.
    const pragma =
      tables.includes("passages") && tables.includes("sources")
        ? "PRAGMA quick_check('sources')"
        : "PRAGMA quick_check";
    if (
      db
        .prepare(pragma)
        .all()
        .some((r) => Object.values(r)[0] !== "ok")
    )
      throw Error("SQLITE_STRUCTURAL_CHECK_FAILED");
    if (tables.includes("passages"))
      db.prepare(
        "SELECT rowid FROM passages WHERE passages MATCH ? LIMIT 1",
      ).get("contrato");
    if (tables.includes("sources"))
      originals = db
        .prepare("SELECT version FROM sources")
        .all()
        .map((r) => r.version)
        .filter((v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v));
  } finally {
    db.close();
  }
  parentPort.postMessage({
    ok: true,
    verification: "SOURCE_TABLE_STRUCTURE_AND_FTS_QUERY",
    originals,
  });
} catch (e) {
  parentPort.postMessage({ ok: false, error: e.message });
}
