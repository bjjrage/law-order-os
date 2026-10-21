import { z } from "zod";
import {
  ClientInputSchema,
  ContactInputSchema,
  MatterInputSchema,
  RelatedPartyInputSchema,
  TaskInputSchema,
  FirmRoleSchema,
  MatterPermissionSchema,
  CoreError,
  type CorePersistence,
  type CoreTransaction,
  type CoreTables,
  type TableName,
  type MutableTable,
} from "../../../os-core/src/contracts.js";
import {
  decodeBase64,
  encodeBase64,
  sha256,
} from "../../../os-core/src/bytes.js";

export const STORAGE_KEY = "law-order-os.local.v1";
export const LOCAL_PROFILES = [
  {
    id: "local-administrator",
    subject: "local-administrator",
    display_name: "Administrador local",
    active: true,
  },
  {
    id: "local-lawyer",
    subject: "local-lawyer",
    display_name: "Abogado local",
    active: true,
  },
] as const;
export const TABLES = [
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
] as const;
type Tables = { [K in TableName]: CoreTables[K][] };
export type Snapshot = {
  format: "LAW_ORDER_LOCAL";
  schema_version: 1;
  revision: number;
  tables: Tables;
};
const id = z.string().min(1).max(128),
  timestamp = z.iso.datetime();
const base = { id, law_firm_id: id, created_at: timestamp };
const matterBase = { ...base, matter_id: id };
const schemas = {
  lawFirms: z
    .object({ id, name: z.string().min(1).max(240), created_at: timestamp })
    .strict(),
  memberships: z
    .object({
      ...base,
      identity_id: id,
      role: FirmRoleSchema,
      active: z.boolean(),
    })
    .strict(),
  clients: z.intersection(ClientInputSchema, z.object(base)),
  contacts: ContactInputSchema.extend(base).strict(),
  relatedParties: RelatedPartyInputSchema.extend(matterBase).strict(),
  matters: MatterInputSchema.extend({
    ...base,
    status: z.enum(["OPEN", "CLOSED"]),
  }).strict(),
  participants: z
    .object({
      ...matterBase,
      identity_id: id,
      permissions: z.array(MatterPermissionSchema).min(1).max(6),
      active: z.boolean(),
    })
    .strict(),
  documents: z
    .object({
      ...matterBase,
      title: z.string().min(1).max(240),
      purpose: z.enum(["ORIGINAL", "DRAFT"]),
      current_version_id: id.nullable(),
    })
    .strict(),
  documentVersions: z
    .object({
      id,
      law_firm_id: id,
      matter_id: id,
      document_id: id,
      original_base64: z.string().min(4),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      mime_type: z.string().min(1).max(100),
      original_filename: z.string().min(1).max(240),
      incorporated_by: id,
      incorporated_at: timestamp,
    })
    .strict(),
  tasks: TaskInputSchema.extend({
    ...matterBase,
    kind: z.enum(["INTERNAL", "DRAFT_REVIEW"]),
    draft_review_id: id.nullable(),
    status: z.enum(["PENDING", "DONE", "CANCELLED"]),
  }).strict(),
  drafts: z
    .object({
      ...matterBase,
      document_id: id,
      document_version_id: id,
      author_identity_id: id,
      status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "CHANGES_REQUESTED"]),
    })
    .strict(),
  reviews: z
    .object({
      ...matterBase,
      draft_id: id,
      document_version_id: id,
      reviewer_identity_id: id,
      status: z.enum([
        "PENDING",
        "APPROVED",
        "CHANGES_REQUESTED",
        "SUPERSEDED",
      ]),
      decided_at: timestamp.nullable(),
    })
    .strict(),
  activities: z
    .object({
      ...base,
      matter_id: id.nullable(),
      actor_identity_id: id,
      action: z.enum([
        "PROCEEDING_CREATED",
        "DELIVERY_RECORDED",
        "RESPONSIBLE_CHANGED",
        "FIRM_CREATED",
        "MEMBER_ADDED",
        "MEMBER_DEACTIVATED",
        "CLIENT_CREATED",
        "CONTACT_CREATED",
        "MATTER_CREATED",
        "PARTICIPANT_GRANTED",
        "PARTICIPANT_REVOKED",
        "RELATED_PARTY_CREATED",
        "DOCUMENT_CREATED",
        "VERSION_INCORPORATED",
        "VERSION_PUBLISHED",
        "TASK_CREATED",
        "TASK_STATUS_CHANGED",
        "DRAFT_CREATED",
        "DRAFT_REVISED",
        "REVIEW_REQUESTED",
        "DRAFT_APPROVED",
        "CHANGES_REQUESTED",
      ]),
      resource_id: id,
      version_id: id.nullable(),
    })
    .strict(),
  proceedings: z
    .object({
      ...matterBase,
      title: z.string().min(1).max(240),
      court: z.string().nullable(),
      number: z.string().nullable(),
    })
    .strict(),
  deliveries: z
    .object({
      ...matterBase,
      document_version_id: id,
      kind: z.enum(["DELIVERY", "FILING"]),
      recipient: z.string().min(1),
      receipt_version_id: id,
      occurred_at: timestamp,
      recorded_by: id,
    })
    .strict(),
};
// ClientInputSchema is a strict input union; validate metadata separately.
function validClient(value: unknown): boolean {
  const result = z
    .object({
      ...base,
      kind: z.enum(["PERSON", "ORGANIZATION"]),
      display_name: z.string().min(1).max(240),
      identification: z.string().max(100).nullable(),
    })
    .strict()
    .safeParse(value);
  return result.success;
}
function empty(): Snapshot {
  return {
    format: "LAW_ORDER_LOCAL",
    schema_version: 1,
    revision: 0,
    tables: Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Tables,
  };
}
export function parseSnapshot(raw: string): Snapshot {
  try {
    const envelope = z
      .object({
        format: z.literal("LAW_ORDER_LOCAL"),
        schema_version: z.literal(1),
        revision: z.number().int().nonnegative(),
        tables: z
          .object(
            Object.fromEntries(TABLES.map((t) => [t, z.array(z.unknown())])),
          )
          .strict(),
      })
      .strict()
      .parse(JSON.parse(raw));
    const state = envelope as Snapshot;
    for (const t of TABLES) {
      const ids = new Set<string>();
      for (const row of state.tables[t]) {
        if (
          !(t === "clients"
            ? validClient(row)
            : schemas[t].safeParse(row).success) ||
          ids.has(row.id)
        )
          throw Error();
        ids.add(row.id);
      }
    }
    const reference = (
      table: TableName,
      value: string,
      row: { law_firm_id: string; matter_id?: string | null },
    ) => {
      const target = state.tables[table].find((r) => r.id === value) as
        { law_firm_id?: string; matter_id?: string } | undefined;
      if (
        !target ||
        (target.law_firm_id && target.law_firm_id !== row.law_firm_id) ||
        (row.matter_id &&
          target.matter_id &&
          row.matter_id !== target.matter_id)
      )
        throw Error();
    };
    const identity = (value: string) => {
      if (!LOCAL_PROFILES.some((p) => p.id === value)) throw Error();
    };
    for (const t of TABLES)
      if (t !== "lawFirms")
        for (const row of state.tables[t]) {
          reference("lawFirms", row.law_firm_id, row);
          if ("matter_id" in row && row.matter_id)
            reference("matters", row.matter_id, row);
          if ("client_id" in row) reference("clients", row.client_id, row);
          if ("contact_id" in row && row.contact_id)
            reference("contacts", row.contact_id, row);
          if ("document_id" in row)
            reference("documents", row.document_id, row);
          if ("document_version_id" in row)
            reference("documentVersions", row.document_version_id, row);
          if ("current_version_id" in row && row.current_version_id)
            reference("documentVersions", row.current_version_id, row);
          if ("draft_id" in row) reference("drafts", row.draft_id, row);
          if ("draft_review_id" in row && row.draft_review_id)
            reference("reviews", row.draft_review_id, row);
          if ("receipt_version_id" in row)
            reference("documentVersions", row.receipt_version_id, row);
          for (const key of [
            "identity_id",
            "responsible_identity_id",
            "author_identity_id",
            "reviewer_identity_id",
            "actor_identity_id",
            "incorporated_by",
            "recorded_by",
          ] as const)
            if (key in row)
              identity((row as unknown as Record<string, string>)[key]!);
        }
    for (const version of state.tables.documentVersions) {
      if (
        encodeBase64(decodeBase64(version.original_base64)) !==
        version.original_base64
      )
        throw Error();
    }
    for (const row of state.tables.drafts) {
      if (
        state.tables.documentVersions.find(
          (v) => v.id === row.document_version_id,
        )?.document_id !== row.document_id
      )
        throw Error();
      if (
        row.status === "APPROVED" &&
        !state.tables.reviews.some(
          (r) =>
            r.draft_id === row.id &&
            r.document_version_id === row.document_version_id &&
            r.status === "APPROVED",
        )
      )
        throw Error();
    }
    for (const row of state.tables.reviews) {
      const draft = state.tables.drafts.find((d) => d.id === row.draft_id)!;
      if (
        draft.author_identity_id === row.reviewer_identity_id ||
        state.tables.documentVersions.find(
          (v) => v.id === row.document_version_id,
        )?.document_id !== draft.document_id
      )
        throw Error();
    }
    return state;
  } catch {
    throw Error(
      "El respaldo o almacenamiento local no es válido. Los datos existentes se conservaron.",
    );
  }
}
export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
/** Local prototype only: browser-editable data and profiles do not establish a security boundary. */
export class BrowserPersistence implements CorePersistence {
  readonly assurance = "LOCAL_BROWSER_UNAUTHENTICATED" as const;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: LocalStorageLike) {}
  snapshot(): Snapshot {
    const raw = this.storage.getItem(STORAGE_KEY);
    return raw === null ? empty() : parseSnapshot(raw);
  }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      if (typeof navigator !== "undefined" && navigator.locks)
        return (await navigator.locks.request(STORAGE_KEY, operation)) as T;
      return operation();
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
  private commit(state: Snapshot, expected: string | null) {
    if (this.storage.getItem(STORAGE_KEY) !== expected)
      throw Error(
        "Los datos cambiaron en otra pestaña. Recargá antes de continuar.",
      );
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      throw Error(
        "No se pudo guardar en este navegador. Exportá un respaldo y liberá espacio; la operación no fue guardada.",
      );
    }
  }
  transaction<T>(
    operation: (tx: CoreTransaction) => T | Promise<T>,
  ): Promise<T> {
    return this.exclusive(async () => {
      const before = this.storage.getItem(STORAGE_KEY);
      const state = before === null ? empty() : parseSnapshot(before);
      let dirty = false;
      const tx: CoreTransaction = {
        get: async <K extends TableName>(t: K, key: string) =>
          structuredClone(state.tables[t].find((r) => r.id === key)),
        list: async <K extends Exclude<TableName, "lawFirms">>(
          t: K,
          scope: { law_firm_id: string; matter_id?: string },
        ) =>
          structuredClone(
            state.tables[t].filter(
              (r) =>
                r.law_firm_id === scope.law_firm_id &&
                (!scope.matter_id ||
                  ("matter_id" in r && r.matter_id === scope.matter_id)),
            ),
          ),
        insert: async <K extends TableName>(t: K, record: CoreTables[K]) => {
          if (state.tables[t].some((r) => r.id === record.id))
            throw new CoreError("DUPLICATE_ID");
          (state.tables[t] as CoreTables[K][]).push(structuredClone(record));
          dirty = true;
        },
        replace: async <K extends MutableTable>(
          t: K,
          record: CoreTables[K],
        ) => {
          if (["documentVersions", "activities", "deliveries"].includes(t))
            throw new CoreError("IMMUTABLE_RECORD");
          const rows = state.tables[t] as CoreTables[K][];
          const index = rows.findIndex((r) => r.id === record.id);
          if (index < 0) throw new CoreError("NOT_FOUND");
          for (const key of ["law_firm_id", "matter_id", "created_at"] as const)
            if (
              key in record &&
              (record as unknown as Record<string, unknown>)[key] !==
                (rows[index] as unknown as Record<string, unknown>)[key]
            )
              throw new CoreError("IMMUTABLE_SCOPE");
          rows[index] = structuredClone(record);
          dirty = true;
        },
      };
      const result = await operation(tx);
      if (dirty) {
        state.revision++;
        parseSnapshot(JSON.stringify(state));
        this.commit(state, before);
      }
      return structuredClone(result);
    });
  }
  exportBackup(): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }
  async importBackup(raw: string): Promise<void> {
    const state = parseSnapshot(raw);
    for (const version of state.tables.documentVersions)
      if (
        (await sha256(decodeBase64(version.original_base64))) !== version.sha256
      )
        throw Error(
          "El respaldo contiene un documento con hash incorrecto. No se importó.",
        );
    await this.exclusive(async () => {
      const before = this.storage.getItem(STORAGE_KEY);
      state.revision =
        (before === null ? 0 : parseSnapshot(before).revision) + 1;
      this.commit(state, before);
    });
  }
}
