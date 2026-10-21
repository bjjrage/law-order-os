import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  CoreError,
  type AuthenticatedPrincipal,
  type CorePersistence,
  type CoreTransaction,
  type CoreTables,
  type MutableTable,
  type TableName,
} from "../../../os-core/src/contracts.js";
export interface BlobStore {
  writeOnce(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  read(key: string): Promise<Uint8Array>;
}
export const TABLES: TableName[] = [
  "lawFirms",
  "memberships",
  "clients",
  "contacts",
  "relatedParties",
  "matters",
  "participants",
  "documents",
  "documentVersions",
  "tasks",
  "drafts",
  "reviews",
  "activities",
  "proceedings",
  "deliveries",
];
const quote = (name: TableName) => {
  if (!TABLES.includes(name)) throw new CoreError("INVALID_TABLE");
  return `os_private."${name}"`;
};
type Context = {
  client: PoolClient;
  actor: AuthenticatedPrincipal;
  tx: CoreTransaction;
};
export class PostgresPersistence implements CorePersistence {
  readonly assurance = "PERSISTENT_ADAPTER_UNVERIFIED" as const;
  private readonly context = new AsyncLocalStorage<Context>();
  constructor(
    readonly pool: Pool,
    readonly blobs: BlobStore,
  ) {}
  /** Trusted host extensions share the Core transaction and its authenticated RLS context. */
  async extensionQuery(text: string, values: unknown[] = []) {
    const context = this.context.getStore();
    if (!context) throw new CoreError("TRANSACTION_REQUIRED");
    return context.client.query(text, values);
  }
  private transactionAdapter(client: PoolClient): CoreTransaction {
    const revisions = new Map<string, string>();
    const decode = async <K extends TableName>(
      table: K,
      row: { data: CoreTables[K]; revision: string },
    ) => {
      revisions.set(`${table}:${row.data.id}`, row.revision);
      const data = structuredClone(row.data);
      if (table === "documentVersions") {
        const record = data as unknown as Record<string, unknown>;
        const bytes = await this.blobs.read(String(record.blob_key));
        if (createHash("sha256").update(bytes).digest("hex") !== record.sha256)
          throw new CoreError("DOCUMENT_INTEGRITY_FAILURE");
        record.original_base64 = Buffer.from(bytes).toString("base64");
        delete record.blob_key;
      }
      return data;
    };
    return {
      get: async <K extends TableName>(table: K, id: string) => {
        const r = await client.query(
          `SELECT data,revision::text FROM ${quote(table)} WHERE id=$1`,
          [id],
        );
        return r.rows[0] ? decode<K>(table, r.rows[0]) : undefined;
      },
      list: async <K extends Exclude<TableName, "lawFirms">>(
        table: K,
        scope: { law_firm_id: string; matter_id?: string },
      ) => {
        const r = await client.query(
          `SELECT data,revision::text FROM ${quote(table)} WHERE law_firm_id=$1 ${scope.matter_id === undefined ? "" : "AND matter_id=$2"} ORDER BY id`,
          scope.matter_id === undefined
            ? [scope.law_firm_id]
            : [scope.law_firm_id, scope.matter_id],
        );
        return Promise.all(r.rows.map((row) => decode<K>(table, row)));
      },
      insert: async <K extends TableName>(table: K, record: CoreTables[K]) => {
        const data = structuredClone(record) as unknown as Record<
          string,
          unknown
        >;
        if (table === "documentVersions") {
          const bytes = Buffer.from(String(data.original_base64), "base64");
          const key = `${data.law_firm_id}/${data.matter_id}/${data.document_id}/${data.id}`;
          if (createHash("sha256").update(bytes).digest("hex") !== data.sha256)
            throw new CoreError("DOCUMENT_INTEGRITY_FAILURE");
          await this.blobs.writeOnce(key, bytes, String(data.mime_type));
          delete data.original_base64;
          data.blob_key = key;
        }
        await client.query(`INSERT INTO ${quote(table)}(data) VALUES($1)`, [
          data,
        ]);
        revisions.set(`${table}:${record.id}`, "1");
      },
      replace: async <K extends MutableTable>(
        table: K,
        record: CoreTables[K],
      ) => {
        if (["documentVersions", "activities", "deliveries"].includes(table))
          throw new CoreError("IMMUTABLE_RECORD");
        const revision = revisions.get(`${table}:${record.id}`);
        if (!revision) throw new CoreError("MISSING_RECORD");
        const r = await client.query(
          `UPDATE ${quote(table)} SET data=$1,revision=revision+1 WHERE id=$2 AND revision=$3 RETURNING revision::text`,
          [record, record.id, revision],
        );
        if (!r.rowCount) throw new CoreError("VERSION_CONFLICT");
        revisions.set(`${table}:${record.id}`, r.rows[0].revision);
      },
    };
  }
  async transaction<T>(
    operation: (tx: CoreTransaction) => T | Promise<T>,
    actor?: AuthenticatedPrincipal,
  ): Promise<T> {
    if (!actor) throw new CoreError("UNAUTHENTICATED");
    const existing = this.context.getStore();
    if (existing) {
      if (existing.actor.identity_id !== actor.identity_id)
        throw new CoreError("ACCESS_DENIED");
      return operation(existing.tx);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      // Local MVP: serialize mutations/reads across Core units of work; no external side-effect replay.
      await client.query("SELECT pg_advisory_xact_lock(70613001)");
      await client.query("SET LOCAL ROLE os_runtime");
      await client.query("SELECT set_config('os.actor',$1,true)", [
        actor.identity_id,
      ]);
      const tx = this.transactionAdapter(client);
      const result = await this.context.run({ client, actor, tx }, () =>
        operation(tx),
      );
      await client.query("COMMIT");
      return structuredClone(result);
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "40001")
        throw new CoreError("VERSION_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }
  async idempotent<T>(
    actor: AuthenticatedPrincipal,
    key: string,
    fingerprint: string,
    operation: () => Promise<T>,
    authorize?: () => Promise<void>,
  ): Promise<T> {
    return this.transaction(async () => {
      if (authorize) await authorize();
      const client = this.context.getStore()!.client;
      const prior = await client.query(
        "SELECT fingerprint,result FROM os_private.idempotency WHERE actor=$1 AND key=$2",
        [actor.identity_id, key],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].fingerprint !== fingerprint)
          throw new CoreError("IDEMPOTENCY_CONFLICT");
        return prior.rows[0].result as T;
      }
      const result = await operation();
      await client.query(
        "INSERT INTO os_private.idempotency(actor,key,fingerprint,result) VALUES($1,$2,$3,$4)",
        [actor.identity_id, key, fingerprint, result],
      );
      return result;
    }, actor);
  }
}
