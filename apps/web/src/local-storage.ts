import { z } from "zod";
import { PracticeStateSchema, emptyPractice, type PracticeState } from "../../../os-core/src/practice-model.js";
import { WorkProgressSchema, DirectionRequestSchema, AssignmentEventSchema } from "../../../os-core/src/work-management.js";
import {
  DeadlineStateSchema,
  validateDeadlineState,
} from "../../../os-core/src/deadlines.js";
import {
  PilotStateSchema,
  emptyPilotState,
  verifyPilotRun,
  verifyPilotPlan,
  auditPilotOutputs,
  type PilotState,
} from "./contractual-pilot.js";
import {
  TeamStateSchema,
  emptyTeamState,
  verifyTeamRun,
  verifyTeamPlan,
  auditTeamOutputs,
  type TeamState,
} from "./specialist-engine.js";
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
  hierarchy_version?: 1;
  identities?: Array<{
    id: string;
    subject: string;
    display_name: string;
    active: boolean;
  }>;
  tables: Tables;
  specialist_pilot?: PilotState;
  legal_team?: TeamState;
  practice?: PracticeState;
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
    assigned_by: id.optional(),
    assignment_revision: z.number().int().nonnegative().optional(),
    assignment_history: z.array(AssignmentEventSchema).optional(),
    progress: z.array(WorkProgressSchema).optional(),
    direction_request: DirectionRequestSchema.optional(),
    deadline: DeadlineStateSchema.optional(),
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
      coauthor_identity_ids: z.array(id).max(64).optional(),
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
        "SPECIALIST_ASSIGNED",
        "SPECIALIST_PLAN_PREPARED",
        "SPECIALIST_RUN_COMPLETED",
        "SPECIALIST_SOURCES_RECHECKED",
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
        "DEADLINE_REVISED",
        "DEADLINE_CONFIRMED",
        "DEADLINE_ALERT_ACKNOWLEDGED",
        "TASK_ASSIGNED",
        "TASK_PROGRESS_RECORDED",
        "DIRECTION_REQUESTED",
        "DIRECTION_REQUEST_RESOLVED",
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
        hierarchy_version: z.literal(1).optional(),
        practice: PracticeStateSchema.optional(),
        identities: z
          .array(
            z
              .object({
                id: z.uuid(),
                subject: z.string(),
                display_name: z.string().min(1),
                active: z.boolean(),
              })
              .strict(),
          )
          .optional(),
        specialist_pilot: PilotStateSchema.optional(),
        legal_team: TeamStateSchema.optional(),
        tables: z
          .object(
            Object.fromEntries(TABLES.map((t) => [t, z.array(z.unknown())])),
          )
          .strict(),
      })
      .strict()
      .parse(JSON.parse(raw));
    const state = envelope as Snapshot;
    if(state.practice){const seen=new Set<string>();for(const r of state.practice.records){if(seen.has(r.id)||!state.tables.lawFirms.some(f=>f.id===r.law_firm_id)||r.matter_id&&!state.tables.matters.some(m=>m.id===r.matter_id&&m.law_firm_id===r.law_firm_id))throw Error();seen.add(r.id);}}
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
      if (
        !LOCAL_PROFILES.some((p) => p.id === value) &&
        !state.identities?.some((p) => p.id === value)
      )
        throw Error();
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
    for (const task of state.tables.tasks) {
      if (task.assigned_by) identity(task.assigned_by);
      for (const entry of task.progress ?? []) identity(entry.by);
      for (const entry of task.assignment_history ?? []) { identity(entry.assigned_by); identity(entry.responsible_identity_id); }
      if (task.direction_request) {
        const request = task.direction_request;
        if (request.resolved_by) identity(request.resolved_by);
        if (request.draft_id) reference("drafts", request.draft_id, task);
        if (request.document_version_id) reference("documentVersions", request.document_version_id, task);
        if (request.target_task_id) reference("tasks", request.target_task_id, task);
        if (request.resolution_task_id) reference("tasks", request.resolution_task_id, task);
      }
      if (!validateDeadlineState(task)) throw Error();
      for (const version of task.deadline?.versions ?? []) {
        identity(version.responsible_identity_id);
        identity(version.recorded_by);
        if (version.confirmed_by) identity(version.confirmed_by);
        if (version.escalation_identity_id)
          identity(version.escalation_identity_id);
        if (version.source_version_id)
          reference("documentVersions", version.source_version_id, task);
      }
      for (const alert of task.deadline?.alerts ?? [])
        identity(alert.recipient_id);
    }
    for (const version of state.tables.documentVersions) {
      if (
        encodeBase64(decodeBase64(version.original_base64)) !==
        version.original_base64
      )
        throw Error();
    }
    for (const row of state.tables.drafts) {
      for (const coauthor of row.coauthor_identity_ids ?? [])
        identity(coauthor);
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
        (row.document_version_id === draft.document_version_id &&
          draft.coauthor_identity_ids?.includes(row.reviewer_identity_id)) ||
        state.tables.documentVersions.find(
          (v) => v.id === row.document_version_id,
        )?.document_id !== draft.document_id
      )
        throw Error();
    }
    if (state.specialist_pilot) {
      const pilot = state.specialist_pilot;
      for (const rows of [pilot.assignments, pilot.plans, pilot.runs]) {
        const seen = new Set<string>();
        for (const row of rows) {
          if (seen.has(row.id)) throw Error();
          seen.add(row.id);
          reference("matters", row.matter_id, row);
          const matter = state.tables.matters.find(
            (item) => item.id === row.matter_id,
          );
          if (matter?.law_firm_id !== row.law_firm_id) throw Error();
          identity(row.human_owner_id);
        }
      }
      const versions = new Set<string>();
      for (const assignment of pilot.assignments) {
        identity(assignment.assigned_by);
        const key = assignment.matter_id + ":" + assignment.version;
        if (versions.has(key)) throw Error();
        versions.add(key);
      }
      for (const row of [...pilot.plans, ...pilot.runs]) {
        const assignment = pilot.assignments.find(
          (item) => item.id === row.assignment_id,
        );
        if (
          !assignment ||
          assignment.law_firm_id !== row.law_firm_id ||
          assignment.matter_id !== row.matter_id ||
          assignment.human_owner_id !== row.human_owner_id
        )
          throw Error();
        for (const document of row.evidence) {
          reference("documents", document.document_id, row);
          reference("documentVersions", document.version_id, row);
          const version = state.tables.documentVersions.find(
            (item) => item.id === document.version_id,
          );
          if (
            version?.document_id !== document.document_id ||
            version.sha256 !== document.sha256
          )
            throw Error();
        }
      }
      for (const run of pilot.runs) {
        const plan = pilot.plans.find((item) => item.id === run.plan_id);
        if (
          !plan ||
          plan.plan_hash !== run.plan_hash ||
          plan.assignment_id !== run.assignment_id ||
          plan.inventory_hash !== run.inventory_hash
        )
          throw Error();
      }
      const links = new Set<string>();
      for (const link of pilot.draft_links) {
        reference("drafts", link.draft_id, link);
        reference("documentVersions", link.document_version_id, link);
        const run = pilot.runs.find((item) => item.id === link.run_id);
        const draft = state.tables.drafts.find(
          (item) => item.id === link.draft_id,
        );
        const version = state.tables.documentVersions.find(
          (item) => item.id === link.document_version_id,
        );
        const key = link.run_id + ":" + link.document_version_id;
        if (
          links.has(key) ||
          !run ||
          run.matter_id !== link.matter_id ||
          run.law_firm_id !== link.law_firm_id ||
          draft?.document_id !== version?.document_id ||
          version?.sha256 !== link.content_hash ||
          link.audit.final_content_hash !== link.content_hash
        )
          throw Error();
        links.add(key);
      }
      const commands = new Set<string>();
      for (const fixture of pilot.fixture_commands) {
        reference("matters", fixture.matter_id, fixture);
        if (commands.has(fixture.command_id)) throw Error();
        commands.add(fixture.command_id);
        for (const documentId of fixture.document_ids)
          reference("documents", documentId, fixture);
      }
    }
    if (state.legal_team) {
      const team = state.legal_team;
      const documentChanges = new Map<string, string>(),
        changeIds = new Set<string>(),
        changeCommands = new Set<string>();
      for (const change of team.document_changes) {
        reference("documents", change.document_id, change);
        reference("documentVersions", change.version_id, change);
        identity(change.actor_id);
        const document = state.tables.documents.find(
            (d) => d.id === change.document_id,
          ),
          version = state.tables.documentVersions.find(
            (v) => v.id === change.version_id,
          );
        const priorId = documentChanges.get(change.document_id) ?? null,
          prior = team.document_changes.find((item) => item.id === priorId);
        if (
          document?.purpose !== "ORIGINAL" ||
          version?.document_id !== change.document_id ||
          change.previous_change_id !== priorId ||
          changeIds.has(change.id) ||
          changeCommands.has(change.command_id) ||
          change.action === (prior?.action ?? "RESTORE")
        )
          throw Error();
        documentChanges.set(change.document_id, change.id);
        changeIds.add(change.id);
        changeCommands.add(change.command_id);
      }
      const extractedVersions = new Set<string>();
      for (const extraction of team.document_extractions) {
        reference("documents", extraction.document_id, extraction);
        reference("documentVersions", extraction.version_id, extraction);
        const version = state.tables.documentVersions.find(
          (v) => v.id === extraction.version_id,
        );
        if (
          !version ||
          version.document_id !== extraction.document_id ||
          version.sha256 !== extraction.original_sha256 ||
          extractedVersions.has(extraction.version_id) ||
          extraction.units.some(
            (unit) =>
              unit.start > unit.end || unit.end > extraction.text.length,
          )
        )
          throw Error();
        extractedVersions.add(extraction.version_id);
      }
      for (const rows of [team.assignments, team.plans, team.runs]) {
        const seen = new Set<string>();
        for (const row of rows) {
          if (seen.has(row.id)) throw Error();
          seen.add(row.id);
          reference("matters", row.matter_id, row);
          identity(row.human_owner_id);
        }
      }
      const versions = new Set<string>(),
        commands = new Set<string>();
      for (const assignment of team.assignments) {
        identity(assignment.actor_id);
        const key = assignment.matter_id + ":" + assignment.version;
        if (versions.has(key) || commands.has(assignment.command_id))
          throw Error();
        versions.add(key);
        commands.add(assignment.command_id);
      }
      for (const row of [...team.plans, ...team.runs]) {
        const assignment = team.assignments.find(
          (a) => a.id === row.assignment_id,
        );
        if (
          !assignment ||
          assignment.matter_id !== row.matter_id ||
          assignment.law_firm_id !== row.law_firm_id ||
          assignment.human_owner_id !== row.human_owner_id ||
          JSON.stringify(assignment.config) !== JSON.stringify(row.config)
        )
          throw Error();
        for (const e of row.evidence) {
          reference("documents", e.document_id, row);
          reference("documentVersions", e.version_id, row);
          const v = state.tables.documentVersions.find(
            (v) => v.id === e.version_id,
          );
          if (v?.document_id !== e.document_id) throw Error();
          if (e.original_sha256) {
            const extraction = team.document_extractions.find(
              (item) =>
                item.version_id === e.version_id &&
                item.document_id === e.document_id,
            );
            if (
              !extraction ||
              extraction.original_sha256 !== v.sha256 ||
              e.original_sha256 !== v.sha256 ||
              extraction.text_sha256 !== e.sha256 ||
              extraction.text !== e.text ||
              extraction.status !== e.extraction_status ||
              JSON.stringify(extraction.warnings) !==
                JSON.stringify(e.extraction_warnings)
            )
              throw Error();
          } else if (
            v.sha256 !== e.sha256 ||
            new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
              decodeBase64(v.original_base64),
            ) !== e.text
          )
            throw Error();
        }
      }
      for (const run of team.runs) {
        const plan = team.plans.find((p) => p.id === run.plan_id);
        if (
          !plan ||
          plan.plan_hash !== run.plan_hash ||
          plan.assignment_id !== run.assignment_id ||
          plan.inventory_hash !== run.inventory_hash ||
          JSON.stringify(plan.evidence) !== JSON.stringify(run.evidence)
        )
          throw Error();
      }
      const linkCommands = new Set<string>();
      for (const link of team.links) {
        reference("matters", link.matter_id, link);
        identity(link.actor_id);
        const assignment = team.assignments.find(
          (a) => a.id === link.assignment_id,
        );
        if (
          !assignment ||
          assignment.matter_id !== link.matter_id ||
          assignment.law_firm_id !== link.law_firm_id ||
          assignment.actor_id !== link.actor_id ||
          linkCommands.has(link.command_id)
        )
          throw Error();
        linkCommands.add(link.command_id);
      }
      const links = new Set<string>();
      const contextCommands = new Set<string>();
      for (const command of team.context_commands) {
        reference("clients", command.client_id, command);
        reference("matters", command.matter_id, command);
        identity(command.actor_id);
        const matter = state.tables.matters.find(
            (m) => m.id === command.matter_id,
          ),
          assignment = team.assignments.find(
            (a) => a.id === command.assignment_id,
          );
        if (
          matter?.client_id !== command.client_id ||
          !assignment ||
          assignment.matter_id !== command.matter_id ||
          assignment.law_firm_id !== command.law_firm_id ||
          assignment.actor_id !== command.actor_id ||
          contextCommands.has(command.command_id)
        )
          throw Error();
        contextCommands.add(command.command_id);
      }
      const documentCommands = new Set<string>();
      for (const command of team.document_commands) {
        reference("matters", command.matter_id, command);
        identity(command.actor_id);
        if (
          documentCommands.has(command.command_id) ||
          new Set(command.document_ids).size !== command.document_ids.length ||
          new Set(command.reused_document_ids).size !==
            command.reused_document_ids.length ||
          command.reused_document_ids.some(
            (id) => !command.document_ids.includes(id),
          )
        )
          throw Error();
        documentCommands.add(command.command_id);
        for (const documentId of command.document_ids)
          reference("documents", documentId, command);
      }
      for (const link of team.draft_links) {
        reference("drafts", link.draft_id, link);
        reference("documentVersions", link.document_version_id, link);
        const run = team.runs.find((r) => r.id === link.run_id),
          draft = state.tables.drafts.find((d) => d.id === link.draft_id),
          version = state.tables.documentVersions.find(
            (v) => v.id === link.document_version_id,
          );
        const key = link.run_id + ":" + link.document_version_id;
        if (
          !run ||
          run.matter_id !== link.matter_id ||
          run.law_firm_id !== link.law_firm_id ||
          version?.document_id !== draft?.document_id ||
          version?.sha256 !== link.content_hash ||
          link.audit.final_content_hash !== link.content_hash ||
          links.has(key)
        )
          throw Error();
        links.add(key);
      }
    }
    if(state.practice){
      const histories=new Map<string,typeof state.practice.events>();
      const practiceRecords=new Map(state.practice.records.map(r=>[r.id,r]));
      const eventIds=new Set<string>();
      for(const event of state.practice.events){if(eventIds.has(event.id)||!practiceRecords.has(event.record_id))throw Error();eventIds.add(event.id);const rows=histories.get(event.record_id)??[];rows.push(event);histories.set(event.record_id,rows);}
      for(const row of state.practice.records){
        if(row.created_by.startsWith("external:")){const grant=practiceRecords.get(row.created_by.slice(9));if(!grant||grant.payload.type!=="PORTAL_GRANT"||grant.law_firm_id!==row.law_firm_id||grant.matter_id!==row.matter_id||row.payload.type!=="PORTAL_MESSAGE")throw Error();}else identity(row.created_by);
        const history=(histories.get(row.id)??[]).sort((a,b)=>a.revision-b.revision);
        if(history.length!==row.revision)throw Error();
        for(let i=0;i<history.length;i++){const e=history[i]!;if(e.revision!==i+1||e.law_firm_id!==row.law_firm_id||e.matter_id!==row.matter_id||JSON.stringify(e.before)!==JSON.stringify(i?history[i-1]!.after:null))throw Error();}
        if(JSON.stringify(history.at(-1)!.after)!==JSON.stringify(row.payload))throw Error();
        const p=row.payload;
        for(const key of ["session_id","transcript_id","invoice_id","template_id"]){if(key in p){const other=practiceRecords.get((p as Record<string,unknown>)[key] as string);if(!other||other.law_firm_id!==row.law_firm_id||key!=="template_id"&&other.matter_id!==row.matter_id)throw Error();}}
        if(p.type==="RECORDING"&&p.object_key!==`${row.law_firm_id}/${p.session_id}/${p.capture_id}/${p.sequence}-${p.sha256}.audio`)throw Error();
      }
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
  setItemAsync?(key: string, value: string): Promise<void>;
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
  private async commit(state: Snapshot, expected: string | null) {
    if (this.storage.getItem(STORAGE_KEY) !== expected)
      throw Error(
        "Los datos cambiaron en otra pestaña. Recargá antes de continuar.",
      );
    try {
      const raw = JSON.stringify(state);
      if (this.storage.setItemAsync)
        await this.storage.setItemAsync(STORAGE_KEY, raw);
      else this.storage.setItem(STORAGE_KEY, raw);
    } catch {
      throw Error(
        "No se pudo guardar en este navegador. Exportá un respaldo y liberá espacio; la operación no fue guardada.",
      );
    }
  }
  transaction<T>(
    operation: (
      tx: CoreTransaction,
      pilot: PilotState,
      team: TeamState,
      practice: PracticeState,
    ) => T | Promise<T>,
  ): Promise<T> {
    return this.exclusive(async () => {
      const before = this.storage.getItem(STORAGE_KEY);
      const state = before === null ? empty() : parseSnapshot(before);
      const pilot = state.specialist_pilot ?? emptyPilotState();
      const pilotBefore = JSON.stringify(pilot);
      const team = state.legal_team ?? emptyTeamState();
      const teamBefore = JSON.stringify(team);
      const practice=state.practice??emptyPractice(),practiceBefore=JSON.stringify(practice);
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
      const result = await operation(tx, pilot, team, practice);
      if(JSON.stringify(practice)!==practiceBefore){state.practice=practice;dirty=true;}
      if (JSON.stringify(pilot) !== pilotBefore) {
        state.specialist_pilot = pilot;
        dirty = true;
      }
      if (JSON.stringify(team) !== teamBefore) {
        state.legal_team = team;
        dirty = true;
      }
      if (dirty) {
        state.revision++;
        parseSnapshot(JSON.stringify(state));
        await this.commit(state, before);
      }
      return structuredClone(result);
    });
  }
  exportBackup(): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }
  async importBackup(raw: string): Promise<void> {
    const state = parseSnapshot(raw);
    if (state.legal_team) {
      for (const extraction of state.legal_team.document_extractions)
        if (
          (await sha256(new TextEncoder().encode(extraction.text))) !==
          extraction.text_sha256
        )
          throw Error("TEAM_EXTRACTION_MISMATCH");
      for (const plan of state.legal_team.plans) await verifyTeamPlan(plan);
      for (const run of state.legal_team.runs) await verifyTeamRun(run);
      for (const link of state.legal_team.draft_links) {
        const run = state.legal_team.runs.find((r) => r.id === link.run_id)!;
        const version = state.tables.documentVersions.find(
          (v) => v.id === link.document_version_id,
        )!;
        const content = new TextDecoder("utf-8", { fatal: true }).decode(
          decodeBase64(version.original_base64),
        );
        const author = link.audit.outputs.find(
          (o) => o.phase === "INTEGRATION",
        )!.author;
        const outputs = run.outputs.map((o) =>
          o.phase === "INTEGRATION" ? { ...o, author, text: content } : o,
        );
        if (
          JSON.stringify(
            await auditTeamOutputs(outputs, content, link.audit.checked_at),
          ) !== JSON.stringify(link.audit)
        )
          throw Error("TEAM_AUDIT_MISMATCH");
      }
    }
    for (const version of state.tables.documentVersions)
      if (
        (await sha256(decodeBase64(version.original_base64))) !== version.sha256
      )
        throw Error(
          "El respaldo contiene un documento con hash incorrecto. No se importó.",
        );
    if (state.specialist_pilot) {
      for (const plan of state.specialist_pilot.plans)
        await verifyPilotPlan(plan);
      for (const run of state.specialist_pilot.runs) await verifyPilotRun(run);
      for (const link of state.specialist_pilot.draft_links) {
        const run = state.specialist_pilot.runs.find(
          (item) => item.id === link.run_id,
        )!;
        const version = state.tables.documentVersions.find(
          (item) => item.id === link.document_version_id,
        )!;
        const content = new TextDecoder("utf-8", { fatal: true }).decode(
          decodeBase64(version.original_base64),
        );
        const outputs = run.outputs.map((output) =>
          output.id === "final"
            ? { ...output, author: "HUMAN" as const, text: content }
            : output,
        );
        // Original save retains Elena's final authorship; later human editions use HUMAN.
        if (
          link.audit.outputs.find((output) => output.id === "final")?.author ===
          "ELENA"
        )
          outputs[4] = { id: "final", author: "ELENA", text: content };
        if (
          JSON.stringify(
            await auditPilotOutputs(outputs, content, link.audit.checked_at),
          ) !== JSON.stringify(link.audit)
        )
          throw Error(
            "El respaldo contiene una auditoría documental alterada.",
          );
      }
    }
    await this.exclusive(async () => {
      const before = this.storage.getItem(STORAGE_KEY);
      state.revision =
        (before === null ? 0 : parseSnapshot(before).revision) + 1;
      await this.commit(state, before);
    });
  }
}
