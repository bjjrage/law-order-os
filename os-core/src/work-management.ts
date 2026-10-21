import { z } from "zod";
import type { FirmRole, Task } from "./contracts.js";

// The persisted ADMINISTRATOR code remains compatible with existing accounts and SQL.
export const OperationalRoleSchema = z.enum(["ADMINISTRATOR", "LAWYER"]);
export const isDirectorRole = (role: FirmRole | undefined) =>
  role === "ADMINISTRATOR";
export const roleLabel = (role: FirmRole | undefined) =>
  role === "ADMINISTRATOR"
    ? "Director del despacho"
    : role === "LAWYER"
      ? "Abogado"
      : "Perfil histórico";
const id = z.string().min(1).max(128),
  stamp = z.iso.datetime();
export const WorkProgressSchema = z
  .object({
    id,
    by: id,
    at: stamp,
    state: z.enum(["UPDATE", "BLOCKED"]),
    note: z.string().trim().min(1).max(4000),
  })
  .strict();
export const AssignmentEventSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    assigned_by: id,
    responsible_identity_id: id,
    title: z.string(),
    internal_due_at: stamp.nullable(),
    at: stamp,
  })
  .strict();
export const DirectionRequestSchema = z
  .object({
    kind: z.enum(["HELP", "REVIEW", "RESCHEDULE"]),
    note: z.string().trim().min(1).max(4000),
    draft_id: id.nullable(),
    document_version_id: id.nullable(),
    target_task_id: id.nullable(),
    target_revision: z.number().int().nonnegative().nullable(),
    status: z.enum(["OPEN", "ASSIGNED", "RESOLVED", "DECLINED"]),
    resolved_by: id.nullable(),
    resolved_at: stamp.nullable(),
    resolution_task_id: id.nullable(),
    resolution_note: z.string().max(4000).nullable(),
  })
  .strict();
export type DirectionRequest = z.infer<typeof DirectionRequestSchema>;
export const RequestInputSchema = z
  .object({
    kind: z.enum(["HELP", "REVIEW", "RESCHEDULE"]),
    note: z.string().trim().min(1).max(4000),
    draft_id: id.nullable(),
    target_task_id: id.nullable(),
  })
  .strict();
export const WorkAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    responsible_identity_id: id,
    internal_due_at: stamp.nullable(),
  })
  .strict();
export function taskAssigner(task: Task) {
  return task.assigned_by ?? task.responsible_identity_id;
}
