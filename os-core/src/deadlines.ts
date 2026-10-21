import { z } from "zod";
import type { Task, Membership, MatterParticipant } from "./contracts.js";

export const DEADLINE_ZONE = "America/Asuncion";
const civilDate = z.iso.date().refine((value) => {
  const date = new Date(value + "T12:00:00Z");
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
});
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const DeadlineInputSchema = z
  .object({
    category: z.enum(["JUDICIAL", "CONTRACTUAL", "INTERNAL"]),
    origin: z.string().trim().min(1).max(2000),
    source_version_id: z.string().min(1).max(128).nullable(),
    rule: z.discriminatedUnion("mode", [
      z
        .object({ mode: z.literal("MANUAL"), date: civilDate, time: clock })
        .strict(),
      z
        .object({
          mode: z.literal("DAYS"),
          start_date: civilDate,
          days: z.number().int().min(1).max(3650),
          day_type: z.enum(["CALENDAR", "BUSINESS"]),
          include_start: z.boolean(),
          excluded_dates: z.array(civilDate).max(5000),
          time: clock,
          basis: z.string().trim().min(1).max(2000),
        })
        .strict(),
    ]),
    reminders_hours: z
      .array(z.number().int().min(1).max(8760))
      .max(8)
      .refine((values) => new Set(values).size === values.length),
    escalation_identity_id: z.string().min(1).max(128).nullable(),
    escalation_after_hours: z.number().int().min(1).max(8760),
  })
  .strict();
export type DeadlineInput = z.infer<typeof DeadlineInputSchema>;
export const ScheduledTaskInputSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    responsible_identity_id: z.string().min(1).max(128),
    deadline: DeadlineInputSchema,
  })
  .strict();
const stamp = z.iso.datetime();
export const DeadlineVersionSchema = DeadlineInputSchema.extend({
  revision: z.number().int().positive(),
  due_at: stamp,
  responsible_identity_id: z.string().min(1).max(128),
  calculation: z.string(),
  recorded_at: stamp,
  recorded_by: z.string(),
  change_reason: z.string(),
  confirmed_at: stamp.nullable(),
  confirmed_by: z.string().nullable(),
}).strict();
export const DeadlineAlertSchema = z
  .object({
    id: z.string(),
    revision: z.number().int().positive(),
    kind: z.enum(["REMINDER", "OVERDUE", "ESCALATION"]),
    hours: z.number().int().nonnegative(),
    recipient_id: z.string(),
    scheduled_at: stamp,
    created_at: stamp,
    blocked_at: stamp.nullable(),
    released_at: stamp.nullable(),
    presented_at: stamp.nullable(),
    acknowledged_at: stamp.nullable(),
  })
  .strict();
export type DeadlineAlert = z.infer<typeof DeadlineAlertSchema>;
export const DeadlineStateSchema = z
  .object({
    revision: z.number().int().positive(),
    versions: z.array(DeadlineVersionSchema).min(1),
    alerts: z.array(DeadlineAlertSchema),
  })
  .strict();
export type DeadlineState = z.infer<typeof DeadlineStateSchema>;

/** Resolve a civil time through IANA rules; never depend on the browser's time zone. */
export function deadlineInstant(date: string, time: string): string {
  civilDate.parse(date);
  clock.parse(time);
  const target = Date.parse(date + "T" + time + ":00Z");
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEADLINE_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(
      format.formatToParts(instant).map((p) => [p.type, p.value]),
    );
    const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`;
    const difference = target - Date.parse(local);
    if (!difference) return new Date(instant).toISOString();
    instant += difference;
  }
  throw Error("La hora indicada no existe en el calendario de Paraguay.");
}
export function calculateDeadline(input: DeadlineInput) {
  const rule = DeadlineInputSchema.shape.rule.parse(input.rule);
  if (rule.mode === "MANUAL")
    return {
      due_at: deadlineInstant(rule.date, rule.time),
      calculation: `Fecha indicada: ${rule.date} ${rule.time} · ${DEADLINE_ZONE}`,
    };
  const excluded = new Set(rule.excluded_dates);
  const current = new Date(rule.start_date + "T12:00:00Z");
  let counted = 0,
    skipped = 0,
    iterations = 0;
  if (!rule.include_start) current.setUTCDate(current.getUTCDate() + 1);
  while (counted < rule.days) {
    if (++iterations > 30000)
      throw Error("No se pudo resolver el calendario indicado.");
    const date = current.toISOString().slice(0, 10);
    const weekday = current.getUTCDay();
    if (
      (rule.day_type === "BUSINESS" && (weekday === 0 || weekday === 6)) ||
      excluded.has(date)
    )
      skipped++;
    else counted++;
    if (counted < rule.days) current.setUTCDate(current.getUTCDate() + 1);
  }
  const finalDate = current.toISOString().slice(0, 10);
  return {
    due_at: deadlineInstant(finalDate, rule.time),
    calculation: `${rule.days} días ${rule.day_type === "BUSINESS" ? "de lunes a viernes" : "corridos"} desde ${rule.start_date}; ${rule.include_start ? "incluye" : "excluye"} el día inicial; ${skipped} días omitidos; ${excluded.size} exclusiones declaradas. Resultado: ${finalDate} ${rule.time} · ${DEADLINE_ZONE}`,
  };
}
export function currentDeadline(task: Task) {
  return task.deadline?.versions.find(
    (v) => v.revision === task.deadline?.revision,
  );
}
export function deadlineRecipientAllowed(
  task: Task,
  recipient: string,
  memberships: Membership[],
  participants: MatterParticipant[],
) {
  return (
    memberships.some(
      (m) =>
        m.active &&
        m.law_firm_id === task.law_firm_id &&
        m.identity_id === recipient,
    ) &&
    (memberships.some(
      (m) =>
        m.active &&
        m.law_firm_id === task.law_firm_id &&
        m.identity_id === recipient &&
        m.role === "ADMINISTRATOR",
    ) ||
      participants.some(
        (p) =>
          p.active &&
          p.law_firm_id === task.law_firm_id &&
          p.matter_id === task.matter_id &&
          p.identity_id === recipient &&
          p.permissions.includes("READ"),
      ))
  );
}
/** Durable in-app notices. Catch up after downtime; do not flood old reminders after expiry. */
export function advanceDeadlineAlerts(
  task: Task,
  memberships: Membership[],
  participants: MatterParticipant[],
  now: string,
  newId: () => string,
): Task {
  const version = currentDeadline(task);
  if (!version?.confirmed_at || task.status !== "PENDING") return task;
  const time = Date.parse(now),
    due = Date.parse(version.due_at);
  const next = structuredClone(task),
    alerts = next.deadline!.alerts;
  const candidates: Array<{
    kind: DeadlineAlert["kind"];
    hours: number;
    recipient: string;
    at: number;
  }> = [];
  if (time < due) {
    const hours = [...version.reminders_hours]
      .filter((h) => due - h * 3600000 <= time)
      .sort((a, b) => a - b)[0];
    if (hours !== undefined)
      candidates.push({
        kind: "REMINDER",
        hours,
        recipient: task.responsible_identity_id,
        at: due - hours * 3600000,
      });
  } else {
    candidates.push({
      kind: "OVERDUE",
      hours: 0,
      recipient: task.responsible_identity_id,
      at: due,
    });
    if (
      version.escalation_identity_id &&
      time >= due + version.escalation_after_hours * 3600000
    )
      candidates.push({
        kind: "ESCALATION",
        hours: version.escalation_after_hours,
        recipient: version.escalation_identity_id,
        at: due + version.escalation_after_hours * 3600000,
      });
  }
  for (const candidate of candidates) {
    const allowed = deadlineRecipientAllowed(
      task,
      candidate.recipient,
      memberships,
      participants,
    );
    let alert = alerts.find(
      (a) =>
        a.revision === version.revision &&
        a.kind === candidate.kind &&
        a.hours === candidate.hours &&
        a.recipient_id === candidate.recipient,
    );
    if (!alert) {
      alert = {
        id: newId(),
        revision: version.revision,
        kind: candidate.kind,
        hours: candidate.hours,
        recipient_id: candidate.recipient,
        scheduled_at: new Date(candidate.at).toISOString(),
        created_at: now,
        blocked_at: allowed ? null : now,
        released_at: null,
        presented_at: null,
        acknowledged_at: null,
      };
      alerts.push(alert);
    } else if (!allowed && !alert.presented_at && !alert.acknowledged_at) {
      alert.blocked_at ??= now;
      alert.released_at = null;
    } else if (alert.blocked_at && !alert.released_at && allowed)
      alert.released_at = now;
  }
  return next;
}
export function validateDeadlineState(task: Task): boolean {
  if (!task.deadline) return true;
  const state = task.deadline;
  if (
    state.versions.length !== state.revision ||
    new Set(state.alerts.map((a) => a.id)).size !== state.alerts.length
  )
    return false;
  for (let index = 0; index < state.versions.length; index++) {
    const v = state.versions[index]!;
    if (
      v.revision !== index + 1 ||
      calculateDeadline(v).due_at !== v.due_at ||
      Boolean(v.confirmed_at) !== Boolean(v.confirmed_by)
    )
      return false;
  }
  const current = currentDeadline(task)!;
  return (
    current.due_at === task.internal_due_at &&
    current.responsible_identity_id === task.responsible_identity_id &&
    state.alerts.every(
      (a) =>
        state.versions.some((v) => v.revision === a.revision) &&
        (!a.acknowledged_at || !!a.presented_at),
    )
  );
}
