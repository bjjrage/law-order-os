import type { Matter, Task } from "../../../os-core/src/contracts.js";
import type { DeadlineAlert } from "../../../os-core/src/deadlines.js";
import {
  currentDeadline,
  deadlineInstant,
} from "../../../os-core/src/deadlines.js";
import type { DashboardData } from "./local-team.js";
import type { WorkBoardData } from "./WorkManagement.js";
import type { PracticeView } from "./PracticePanel.js";
import { asuncionDate } from "./local-dates.js";
import { shiftDay } from "./office-metrics.js";

export type DashboardAlert = {
  task_id: string;
  matter_id: string;
  title: string;
  due_at: string;
  alert: DeadlineAlert;
};
export type DashboardSources = {
  work: WorkBoardData | null;
  dashboard: DashboardData | null;
  alerts: DashboardAlert[] | null;
  practice: PracticeView | null;
};
export type DashboardItem = {
  id: string;
  title: string;
  matterId: string;
  tab: string;
  category: string;
  tone: "danger" | "warning" | "neutral";
  due?: string | null;
  person?: string;
  alert?: DashboardAlert;
  priority: number;
};
export function dashboardOverview(
  sources: DashboardSources,
  matters: Matter[],
  now: Date,
) {
  const stamp = now.getTime(),
    today = asuncionDate(now),
    pending =
      sources.work?.tasks.filter(
        (t) => t.status === "PENDING" && !t.direction_request,
      ) ?? [];
  const person = (id: string) =>
    sources.work?.people.find((p) => p.identity_id === id)?.display_name ??
    "Profesional asignado";
  const taskItem = (
    task: Task,
    category: string,
    priority: number,
    tone: DashboardItem["tone"],
  ): DashboardItem => ({
    id: "task-" + task.id,
    title: task.title,
    matterId: task.matter_id,
    tab: "tasks",
    category,
    priority,
    tone,
    due: task.internal_due_at,
    person: person(task.responsible_identity_id),
  });
  const scheduled = pending.filter(
    (t) => !!currentDeadline(t)?.confirmed_at && !!t.internal_due_at,
  );
  const expired = scheduled
    .filter((t) => Date.parse(t.internal_due_at!) < stamp)
    .map((t) => taskItem(t, "Plazo vencido", 0, "danger"));
  const upcoming = scheduled
    .filter(
      (t) =>
        Date.parse(t.internal_due_at!) >= stamp &&
        Date.parse(t.internal_due_at!) <= stamp + 7 * 86400000,
    )
    .map((t) => taskItem(t, "Próximo plazo", 5, "warning"));
  const unconfirmed = pending
    .filter((t) => !!currentDeadline(t) && !currentDeadline(t)?.confirmed_at)
    .map((t) => taskItem(t, "Por confirmar", 1, "warning"));
  const lateWork = pending
    .filter(
      (t) =>
        t.kind === "INTERNAL" &&
        !t.deadline &&
        t.internal_due_at &&
        Date.parse(t.internal_due_at) < stamp,
    )
    .map((t) => taskItem(t, "Trabajo atrasado", 2, "danger"));
  const alerts: DashboardItem[] = (sources.alerts ?? [])
    .filter((a) => !a.alert.acknowledged_at)
    .map((a) => ({
      id: "alert-" + a.alert.id,
      title: a.title,
      matterId: a.matter_id,
      tab: "tasks",
      category:
        a.alert.kind === "ESCALATION"
          ? "Requiere seguimiento"
          : a.alert.kind === "OVERDUE"
            ? "Plazo vencido"
            : "Aviso de plazo",
      priority: a.alert.kind === "REMINDER" ? 4 : 0,
      tone: a.alert.kind === "REMINDER" ? "warning" : "danger",
      due: a.due_at,
      alert: a,
    }));
  const reviewMetric = sources.dashboard?.metrics.find(
    (m) => m.id === "reviews",
  );
  const reviewItems: DashboardItem[] = (reviewMetric?.records ?? []).map(
    (r) => ({
      id: "review-" + r.id,
      title: r.label,
      matterId: r.matter_id,
      tab: r.tab,
      category: "Revisión pendiente",
      tone: "neutral",
      priority: 4,
      due: r.due_at,
    }),
  );
  const changes: DashboardItem[] = (
    sources.dashboard?.metrics.find((m) => m.id === "changes")?.records ?? []
  ).map((r) => ({
    id: "draft-" + r.id,
    title: r.label,
    matterId: r.matter_id,
    tab: r.tab,
    category: "Cambios solicitados",
    tone: "neutral",
    priority: 4,
  }));
  const requests: DashboardItem[] = (sources.work?.requests ?? [])
    .filter((t) => t.direction_request?.status === "OPEN")
    .map((t) => taskItem(t, "Intervención de Dirección", 3, "warning"));
  const metrics = [
    {
      id: "alerts",
      label: "Avisos de plazos",
      detail: "Sin reconocer · dirigidos a vos",
      records: sources.alerts ? alerts : null,
      tone: "warning",
    },
    {
      id: "expired",
      label: "Plazos vencidos",
      detail: "Confirmados · aún pendientes",
      records: sources.work ? expired : null,
      tone: "danger",
    },
    {
      id: "upcoming",
      label: "Vencen en 7 días",
      detail: "Plazos confirmados · desde ahora",
      records: sources.work ? upcoming : null,
      tone: "warning",
    },
    {
      id: "unconfirmed",
      label: "Plazos por confirmar",
      detail: "Requieren revisión profesional",
      records: sources.work ? unconfirmed : null,
      tone: "warning",
    },
    {
      id: "late-work",
      label: "Trabajo atrasado",
      detail: "Tareas internas · sin completar",
      records: sources.work ? lateWork : null,
      tone: "danger",
    },
    {
      id: "reviews",
      label: "Revisiones pendientes",
      detail: "Borradores esperando revisión",
      records: reviewMetric ? reviewItems : null,
      tone: "neutral",
    },
  ];
  const priorityMap = new Map<string, DashboardItem>();
  for (const item of [
    ...alerts,
    ...expired,
    ...unconfirmed,
    ...lateWork,
    ...requests,
    ...reviewItems,
    ...changes,
    ...upcoming,
  ]) {
    const key = item.alert ? "task-" + item.alert.task_id : item.id;
    const prior = priorityMap.get(key);
    if (!prior || item.priority < prior.priority) priorityMap.set(key, item);
  }
  const priorities = [...priorityMap.values()].sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.due ?? "9999").localeCompare(b.due ?? "9999"),
  );
  const dayStart = Date.parse(deadlineInstant(today, "00:00")),
    dayEnd = Date.parse(deadlineInstant(shiftDay(today, 1), "00:00"));
  const appointments = (sources.practice?.records ?? [])
    .flatMap((r) =>
      r.payload.type === "APPOINTMENT" &&
      r.payload.status === "SCHEDULED" &&
      Date.parse(r.payload.starts_at) < dayEnd &&
      Date.parse(r.payload.ends_at) > dayStart
        ? [
            {
              id: r.id,
              ...r.payload,
              person: person(r.payload.responsible_identity_id),
            },
          ]
        : [],
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const workload = (sources.work?.people ?? [])
    .map((p) => {
      const tasks = pending.filter(
        (t) => t.responsible_identity_id === p.identity_id,
      );
      return {
        ...p,
        pending: tasks.length,
        overdue: tasks.filter(
          (t) =>
            t.internal_due_at &&
            (!t.deadline || currentDeadline(t)?.confirmed_at) &&
            Date.parse(t.internal_due_at) < stamp,
        ).length,
      };
    })
    .sort(
      (a, b) =>
        b.pending - a.pending || a.display_name.localeCompare(b.display_name),
    );
  const openMatters = matters
    .filter((m) => m.status === "OPEN")
    .map((m) => {
      const tasks = pending.filter((t) => t.matter_id === m.id);
      const next = tasks
        .filter((t) => currentDeadline(t)?.confirmed_at && t.internal_due_at)
        .sort((a, b) =>
          a.internal_due_at!.localeCompare(b.internal_due_at!),
        )[0];
      return {
        matter: m,
        pending: tasks.length,
        next,
        person: person(m.responsible_identity_id),
      };
    })
    .sort(
      (a, b) =>
        (a.next?.internal_due_at ?? "9999").localeCompare(
          b.next?.internal_due_at ?? "9999",
        ) || a.matter.title.localeCompare(b.matter.title),
    );
  return {
    metrics,
    priorities,
    appointments,
    workload,
    openMatters,
    requests,
    pending: pending.length,
  };
}
