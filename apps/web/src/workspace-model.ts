import type {
  ActivityAction,
  Matter,
  Task,
} from "../../../os-core/src/contracts.js";
import { asuncionDate } from "./local-dates.js";
import { currentDeadline } from "../../../os-core/src/deadlines.js";

export const matterKind = (kind: Matter["kind"]) =>
  ({
    ADVISORY: "Consultivo",
    CONTRACTUAL: "Contractual",
    JUDICIAL: "Judicial",
    OTHER: "Otro",
  })[kind];
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("es-PY");
export const matchesSearch = (
  query: string,
  ...values: Array<string | null | undefined>
) =>
  normalizeSearch(values.filter(Boolean).join(" ")).includes(
    normalizeSearch(query.trim()),
  );
export function displayDate(value: string | null, year = false) {
  if (!value) return "Sin fecha";
  // A civil date is not an instant: noon UTC keeps it in the same day in Paraguay.
  const instant =
    value.length === 10 ? new Date(value + "T12:00:00Z") : new Date(value);
  return new Intl.DateTimeFormat("es-PY", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "America/Asuncion",
  }).format(instant);
}
export type TaskGroup =
  "overdue" | "unconfirmed" | "today" | "upcoming" | "undated" | "completed";
export const taskGroupLabels: Record<TaskGroup, string> = {
  overdue: "Atrasadas",
  unconfirmed: "Plazos por confirmar",
  today: "Para hoy",
  upcoming: "Próximas fechas",
  undated: "Sin fecha asignada",
  completed: "Finalizadas",
};
export function taskGroup(task: Task, now = new Date()): TaskGroup {
  if (task.status !== "PENDING") return "completed";
  if (task.deadline && !currentDeadline(task)?.confirmed_at)
    return "unconfirmed";
  if (!task.internal_due_at) return "undated";
  // Match Dashboard's overdue cutoff, including elapsed times earlier today.
  if (Date.parse(task.internal_due_at) < now.getTime()) return "overdue";
  const due = asuncionDate(new Date(task.internal_due_at)),
    today = asuncionDate(now);
  return due === today ? "today" : "upcoming";
}
export function orderTasks(tasks: Task[], now = new Date()) {
  const rank: Record<TaskGroup, number> = {
    overdue: 0,
    unconfirmed: 1,
    today: 2,
    upcoming: 3,
    undated: 4,
    completed: 5,
  };
  return [...tasks].sort(
    (a, b) =>
      rank[taskGroup(a, now)] - rank[taskGroup(b, now)] ||
      (a.internal_due_at ?? "9999").localeCompare(
        b.internal_due_at ?? "9999",
      ) ||
      a.created_at.localeCompare(b.created_at),
  );
}
export const permissionLabels: Record<string, string> = {
  READ: "Ver asunto",
  MANAGE: "Gestionar asunto",
  DOCUMENT_WRITE: "Incorporar documentos",
  TASK_WRITE: "Gestionar tareas",
  DRAFT_WRITE: "Editar borradores",
  DRAFT_REVIEW: "Revisar borradores",
};
export const activityLabels: Record<ActivityAction, string> = {
  SPECIALIST_ASSIGNED: "Equipo jurídico confirmado",
  SPECIALIST_PLAN_PREPARED: "Consulta preparada",
  SPECIALIST_RUN_COMPLETED: "Encargo local completado",
  SPECIALIST_SOURCES_RECHECKED: "Fuentes revisadas",
  PROCEEDING_CREATED: "Procedimiento incorporado",
  DELIVERY_RECORDED: "Entrega o presentación registrada",
  RESPONSIBLE_CHANGED: "Responsable actualizado",
  FIRM_CREATED: "Estudio creado",
  MEMBER_ADDED: "Profesional incorporado",
  MEMBER_DEACTIVATED: "Participación desactivada",
  CLIENT_CREATED: "Cliente registrado",
  CONTACT_CREATED: "Contacto registrado",
  MATTER_CREATED: "Asunto abierto",
  PARTICIPANT_GRANTED: "Acceso concedido",
  PARTICIPANT_REVOKED: "Acceso revocado",
  RELATED_PARTY_CREATED: "Parte relacionada incorporada",
  DOCUMENT_CREATED: "Documento incorporado",
  VERSION_INCORPORATED: "Nueva versión incorporada",
  VERSION_PUBLISHED: "Versión publicada",
  TASK_CREATED: "Tarea creada",
  TASK_STATUS_CHANGED: "Estado de tarea actualizado",
  DEADLINE_REVISED: "Plazo o responsable actualizado",
  DEADLINE_CONFIRMED: "Plazo confirmado por un abogado",
  DEADLINE_ALERT_ACKNOWLEDGED: "Aviso de plazo reconocido",
  TASK_ASSIGNED: "Encargo actualizado por Dirección",
  TASK_PROGRESS_RECORDED: "Avance de tarea registrado",
  DIRECTION_REQUESTED: "Intervención solicitada a Dirección",
  DIRECTION_REQUEST_RESOLVED: "Solicitud atendida por Dirección",
  DRAFT_CREATED: "Borrador creado",
  DRAFT_REVISED: "Borrador editado",
  REVIEW_REQUESTED: "Revisión humana solicitada",
  DRAFT_APPROVED: "Versión aprobada",
  CHANGES_REQUESTED: "Cambios solicitados",
};
