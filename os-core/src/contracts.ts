import { z } from "zod";
import type { DeadlineState } from "./deadlines.js";
import type { DirectionRequest } from "./work-management.js";

export const IdSchema = z.string().min(1).max(128);
export const TimestampSchema = z.iso.datetime();
export const FirmRoleSchema = z.enum([
  "ADMINISTRATOR",
  "COORDINATOR",
  "LAWYER",
  "ASSISTANT",
  "ADMINISTRATION",
]);
export type FirmRole = z.infer<typeof FirmRoleSchema>;
export const MatterPermissionSchema = z.enum([
  "READ",
  "MANAGE",
  "DOCUMENT_WRITE",
  "TASK_WRITE",
  "DRAFT_WRITE",
  "DRAFT_REVIEW",
]);
export type MatterPermission = z.infer<typeof MatterPermissionSchema>;
export const ALL_MATTER_PERMISSIONS: readonly MatterPermission[] =
  Object.freeze([
    "READ",
    "MANAGE",
    "DOCUMENT_WRITE",
    "TASK_WRITE",
    "DRAFT_WRITE",
    "DRAFT_REVIEW",
  ]);

/** These are proposed application contracts, not a production identity provider. */
export interface Identity {
  id: string;
  subject: string;
  display_name: string;
  active: boolean;
}
export interface AuthenticatedPrincipal {
  identity_id: string;
  subject: string;
  session_id: string;
  expires_at: string;
}
export interface Authenticator {
  /** Must validate issuer, audience, signature/session and revocation in the selected host. Never trust a request body principal. */
  authenticate(credential: string): Promise<AuthenticatedPrincipal | null>;
  identity(identityId: string): Promise<Identity | null>;
}
export interface LawFirm {
  id: string;
  name: string;
  created_at: string;
}
export interface Membership {
  id: string;
  law_firm_id: string;
  identity_id: string;
  role: FirmRole;
  active: boolean;
  created_at: string;
}
export const ClientInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("PERSON"),
      display_name: z.string().min(1).max(240),
      identification: z.string().max(100).nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("ORGANIZATION"),
      display_name: z.string().min(1).max(240),
      identification: z.string().max(100).nullable(),
    })
    .strict(),
]);
export type ClientInput = z.infer<typeof ClientInputSchema>;
export type Client = ClientInput & {
  id: string;
  law_firm_id: string;
  created_at: string;
};
export const ContactInputSchema = z
  .object({
    client_id: IdSchema,
    display_name: z.string().min(1).max(240),
    email: z.email().nullable(),
    phone: z.string().max(100).nullable(),
  })
  .strict();
export type Contact = z.infer<typeof ContactInputSchema> & {
  id: string;
  law_firm_id: string;
  created_at: string;
};
export const RelatedPartyInputSchema = z
  .object({
    kind: z.enum(["OPPOSING_PARTY", "WITNESS", "EXPERT", "OTHER"]),
    display_name: z.string().min(1).max(240),
    contact_id: IdSchema.nullable(),
  })
  .strict();
export type RelatedParty = z.infer<typeof RelatedPartyInputSchema> & {
  id: string;
  law_firm_id: string;
  matter_id: string;
  created_at: string;
};
export const MatterInputSchema = z
  .object({
    client_id: IdSchema,
    title: z.string().min(1).max(240),
    kind: z.enum(["JUDICIAL", "ADVISORY", "CONTRACTUAL", "OTHER"]),
    subject_area: z.string().min(1).max(100),
    responsible_identity_id: IdSchema,
    opened_on: z.iso.date(),
    closed_on: z.iso.date().nullable(),
  })
  .strict();
export type Matter = z.infer<typeof MatterInputSchema> & {
  id: string;
  law_firm_id: string;
  status: "OPEN" | "CLOSED";
  created_at: string;
};
export interface MatterParticipant {
  id: string;
  law_firm_id: string;
  matter_id: string;
  identity_id: string;
  permissions: MatterPermission[];
  active: boolean;
  created_at: string;
}
export interface Document {
  id: string;
  law_firm_id: string;
  matter_id: string;
  title: string;
  purpose: "ORIGINAL" | "DRAFT";
  current_version_id: string | null;
  created_at: string;
}
export interface DocumentVersion {
  id: string;
  law_firm_id: string;
  matter_id: string;
  document_id: string;
  original_base64: string;
  sha256: string;
  mime_type: string;
  original_filename: string;
  incorporated_by: string;
  incorporated_at: string;
}
export const TaskInputSchema = z
  .object({
    title: z.string().min(1).max(240),
    responsible_identity_id: IdSchema,
    internal_due_at: TimestampSchema.nullable(),
  })
  .strict();
export type Task = z.infer<typeof TaskInputSchema> & {
  assigned_by?: string;
  assignment_revision?: number;
  assignment_history?: Array<{ revision: number; assigned_by: string; responsible_identity_id: string; title: string; internal_due_at: string | null; at: string }>;
  progress?: Array<{ id: string; by: string; at: string; state: "UPDATE" | "BLOCKED"; note: string }>;
  direction_request?: DirectionRequest;
  deadline?: DeadlineState;
  id: string;
  law_firm_id: string;
  matter_id: string;
  kind: "INTERNAL" | "DRAFT_REVIEW";
  draft_review_id: string | null;
  status: "PENDING" | "DONE" | "CANCELLED";
  created_at: string;
};
export interface Draft {
  id: string;
  law_firm_id: string;
  matter_id: string;
  document_id: string;
  document_version_id: string;
  author_identity_id: string;
  /** Contributors to collaborative content; they cannot approve their own work. */
  coauthor_identity_ids?: string[];
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "CHANGES_REQUESTED";
  created_at: string;
}
export interface DraftReview {
  id: string;
  law_firm_id: string;
  matter_id: string;
  draft_id: string;
  document_version_id: string;
  reviewer_identity_id: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "SUPERSEDED";
  decided_at: string | null;
  created_at: string;
}
export interface Proceeding {
  id: string;
  law_firm_id: string;
  matter_id: string;
  title: string;
  court: string | null;
  number: string | null;
  created_at: string;
}
export interface Delivery {
  id: string;
  law_firm_id: string;
  matter_id: string;
  document_version_id: string;
  kind: "DELIVERY" | "FILING";
  recipient: string;
  receipt_version_id: string;
  occurred_at: string;
  recorded_by: string;
  created_at: string;
}
export type ActivityAction =
  | "SPECIALIST_ASSIGNED"
  | "SPECIALIST_PLAN_PREPARED"
  | "SPECIALIST_RUN_COMPLETED"
  | "SPECIALIST_SOURCES_RECHECKED"
  | "PROCEEDING_CREATED"
  | "DELIVERY_RECORDED"
  | "RESPONSIBLE_CHANGED"
  | "FIRM_CREATED"
  | "MEMBER_ADDED"
  | "MEMBER_DEACTIVATED"
  | "CLIENT_CREATED"
  | "CONTACT_CREATED"
  | "MATTER_CREATED"
  | "PARTICIPANT_GRANTED"
  | "PARTICIPANT_REVOKED"
  | "RELATED_PARTY_CREATED"
  | "DOCUMENT_CREATED"
  | "VERSION_INCORPORATED"
  | "VERSION_PUBLISHED"
  | "TASK_CREATED"
  | "TASK_STATUS_CHANGED"
  | "DEADLINE_REVISED"
  | "DEADLINE_CONFIRMED"
  | "DEADLINE_ALERT_ACKNOWLEDGED"
  | "TASK_ASSIGNED"
  | "TASK_PROGRESS_RECORDED"
  | "DIRECTION_REQUESTED"
  | "DIRECTION_REQUEST_RESOLVED"
  | "DRAFT_CREATED"
  | "DRAFT_REVISED"
  | "REVIEW_REQUESTED"
  | "DRAFT_APPROVED"
  | "CHANGES_REQUESTED";
/** IDs and event codes only: no document text, credentials or client/contact names in activity. */
export interface Activity {
  id: string;
  law_firm_id: string;
  matter_id: string | null;
  actor_identity_id: string;
  action: ActivityAction;
  resource_id: string;
  version_id: string | null;
  created_at: string;
}
export interface CoreTables {
  lawFirms: LawFirm;
  memberships: Membership;
  clients: Client;
  contacts: Contact;
  relatedParties: RelatedParty;
  matters: Matter;
  participants: MatterParticipant;
  documents: Document;
  documentVersions: DocumentVersion;
  tasks: Task;
  drafts: Draft;
  reviews: DraftReview;
  activities: Activity;
  proceedings: Proceeding;
  deliveries: Delivery;
}
export type TableName = keyof CoreTables;
export type MutableTable = Exclude<
  TableName,
  "documentVersions" | "activities" | "deliveries"
>;
export interface CoreTransaction {
  get<K extends TableName>(
    table: K,
    id: string,
  ): Promise<CoreTables[K] | undefined>;
  list<K extends Exclude<TableName, "lawFirms">>(
    table: K,
    scope: { law_firm_id: string; matter_id?: string },
  ): Promise<CoreTables[K][]>;
  insert<K extends TableName>(table: K, record: CoreTables[K]): Promise<void>;
  replace<K extends MutableTable>(
    table: K,
    record: CoreTables[K],
  ): Promise<void>;
}
export interface CorePersistence {
  /** Atomic serializable commit/rollback required. Production adapters must enforce tenant foreign keys and immutable version/activity storage. */
  transaction<T>(
    operation: (transaction: CoreTransaction) => T | Promise<T>,
    actor?: AuthenticatedPrincipal,
  ): Promise<T>;
  readonly assurance:
    | "TESTED_OFFLINE"
    | "PERSISTENT_ADAPTER_UNVERIFIED"
    | "VERIFIED_REAL"
    | "LOCAL_BROWSER_UNAUTHENTICATED";
}
export class CoreError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CoreError";
  }
}
export function reject(code = "ACCESS_DENIED"): never {
  throw new CoreError(code);
}
export function immutable<T>(value: T): T {
  const copy: T = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item && typeof item === "object") {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
  };
  freeze(copy);
  return copy;
}
