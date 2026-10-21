import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

// Integer nano-dollars; reservations round up and never use floating SQL sums.
const SCALE = 1e9;
function units(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1e5)
    throw Error("WORKSPACE_BUDGET_INVALID_AMOUNT");
  return Math.ceil(value * SCALE);
}
export class WorkspaceSpend {
  constructor(path) {
    this.db = new DatabaseSync(path, { timeout: 10000 });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS policy(id INTEGER PRIMARY KEY CHECK(id=1), ceiling INTEGER NOT NULL, mode TEXT NOT NULL, halted INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS interactions(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, ceiling INTEGER NOT NULL, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY, interaction TEXT NOT NULL REFERENCES interactions(id), reserved INTEGER NOT NULL, retained INTEGER NOT NULL, state TEXT NOT NULL);
      PRAGMA foreign_keys=ON;`);
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const value = fn(); this.db.exec("COMMIT"); return value; }
    catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  // Provisioning never enables paid inference. Live authorization is a separate gate.
  initialize(ceiling, mode = "OFFLINE_ONLY") {
    if (mode !== "OFFLINE_ONLY") throw Error("WORKSPACE_PAID_BENCHMARK_DISABLED");
    const cap = units(ceiling);
    this.transaction(() => {
      const prior = this.db.prepare("SELECT * FROM policy WHERE id=1").get();
      if (prior && (prior.ceiling !== cap || prior.mode !== mode)) throw Error("WORKSPACE_BUDGET_POLICY_IMMUTABLE");
      if (!prior) this.db.prepare("INSERT INTO policy(id,ceiling,mode) VALUES(1,?,?)").run(cap, mode);
    });
  }
  policy() {
    const p = this.db.prepare("SELECT * FROM policy WHERE id=1").get();
    if (!p) throw Error("WORKSPACE_GLOBAL_BUDGET_REQUIRED");
    if (p.halted) throw Error("WORKSPACE_BUDGET_HALTED");
    return p;
  }
  admit(id, fingerprint, ceiling = 0.6) {
    if (!id || !fingerprint) throw Error("WORKSPACE_BUDGET_ID_REQUIRED");
    const cap = units(ceiling);
    if (cap > units(0.6)) throw Error("WORKSPACE_BUDGET_INVALID_AMOUNT");
    return this.transaction(() => {
      this.policy();
      const prior = this.db.prepare("SELECT * FROM interactions WHERE id=?").get(id);
      if (prior) throw Error(prior.fingerprint === fingerprint ? "WORKSPACE_BUDGET_ALREADY_STARTED" : "WORKSPACE_BUDGET_ID_CONFLICT");
      this.db.prepare("INSERT INTO interactions VALUES(?,?,?,'RUNNING')").run(id, fingerprint, cap);
    });
  }
  finish(id) {
    this.db.prepare("UPDATE interactions SET state='CLOSED' WHERE id=?").run(id);
  }
  reserve(interaction, amount) {
    const cost = units(amount), id = randomUUID();
    this.transaction(() => {
      const p = this.policy();
      const turn = this.db.prepare("SELECT * FROM interactions WHERE id=?").get(interaction);
      if (!turn || turn.state !== "RUNNING") throw Error("WORKSPACE_BUDGET_INTERACTION_REQUIRED");
      const all = this.db.prepare("SELECT coalesce(sum(retained),0) n FROM calls").get().n;
      const local = this.db.prepare("SELECT coalesce(sum(retained),0) n FROM calls WHERE interaction=?").get(interaction).n;
      if (all + cost > p.ceiling || local + cost > turn.ceiling) throw Error("BUDGET_EXHAUSTED");
      this.db.prepare("INSERT INTO calls VALUES(?,?,?,?,'RESERVED')").run(id, interaction, cost, cost);
    });
    return id;
  }
  unknown(id) {
    this.db.prepare("UPDATE calls SET state='UNKNOWN' WHERE id=? AND state='RESERVED'").run(id);
  }
  settle(id, amount) {
    const actual = units(amount);
    const exceeded = this.transaction(() => {
      const call = this.db.prepare("SELECT * FROM calls WHERE id=?").get(id);
      if (!call || call.state !== "RESERVED") throw Error("WORKSPACE_BUDGET_SETTLEMENT_INVALID");
      this.db.prepare("UPDATE calls SET retained=?,state='SETTLED' WHERE id=?").run(actual, id);
      if (actual > call.reserved) this.db.exec("UPDATE policy SET halted=1 WHERE id=1");
      return actual > call.reserved;
    });
    if (exceeded) throw Error("WORKSPACE_USAGE_EXCEEDS_RESERVATION");
  }
  snapshot() {
    const p = this.db.prepare("SELECT * FROM policy WHERE id=1").get();
    return { ceiling_usd: p?.ceiling / SCALE, mode: p?.mode, halted: !!p?.halted,
      retained_usd: this.db.prepare("SELECT coalesce(sum(retained),0) n FROM calls").get().n / SCALE,
      calls: this.db.prepare("SELECT * FROM calls ORDER BY rowid").all(),
      interactions: this.db.prepare("SELECT * FROM interactions ORDER BY rowid").all() };
  }
}

