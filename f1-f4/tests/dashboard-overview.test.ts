import { expect, it } from "vitest";
import type { Task } from "../../os-core/src/contracts.js";
import { DeadlineStateSchema } from "../../os-core/src/deadlines.js";
import type { PracticeView } from "../../apps/web/src/PracticePanel.js";
import {
  dashboardOverview,
  type DashboardAlert,
  type DashboardSources,
} from "../../apps/web/src/dashboard-overview.js";

const now = new Date("2026-10-19T15:00:00.000Z");
function task(id: string, due: string | null, confirmed?: boolean): Task {
  return {
    id,
    law_firm_id: "firm",
    matter_id: "matter",
    title: id,
    kind: "INTERNAL",
    draft_review_id: null,
    status: "PENDING",
    created_at: now.toISOString(),
    responsible_identity_id: "lawyer",
    internal_due_at: due,
    ...(confirmed === undefined
      ? {}
      : {
          deadline: DeadlineStateSchema.parse({
            revision: 1,
            alerts: [],
            versions: [
              {
                revision: 1,
                category: "JUDICIAL",
                origin: "Notificación de prueba",
                source_version_id: null,
                rule: {
                  mode: "MANUAL",
                  date: due!.slice(0, 10),
                  time: "12:00",
                },
                due_at: due,
                reminders_hours: [24],
                escalation_identity_id: null,
                escalation_after_hours: 24,
                responsible_identity_id: "lawyer",
                calculation: "Fecha de prueba",
                recorded_at: now.toISOString(),
                recorded_by: "lawyer",
                change_reason: "",
                confirmed_at: confirmed ? now.toISOString() : null,
                confirmed_by: confirmed ? "lawyer" : null,
              },
            ],
          }),
        }),
  };
}
function alert(
  id: string,
  kind: DashboardAlert["alert"]["kind"],
): DashboardAlert {
  return {
    task_id: "expired",
    matter_id: "matter",
    title: "Plazo de prueba",
    due_at: "2026-10-18T15:00:00.000Z",
    alert: {
      id,
      kind,
      hours: 24,
      revision: 1,
      recipient_id: "director",
      scheduled_at: now.toISOString(),
      created_at: now.toISOString(),
      presented_at: now.toISOString(),
      acknowledged_at: null,
      blocked_at: null,
      released_at: null,
    },
  };
}
function sources(tasks: Task[] = []): DashboardSources {
  return {
    work: {
      role: "ADMINISTRATOR",
      team: true,
      matters: [],
      tasks,
      requests: [],
      people: [
        {
          identity_id: "lawyer",
          display_name: "Abogada de prueba",
          role: "LAWYER",
        },
      ],
    },
    dashboard: {
      refreshed_at: now.toISOString(),
      timezone: "America/Asuncion",
      scope: "FIRM_TEAM",
      open_requests: 0,
      metrics: [
        { id: "reviews", label: "Revisiones", period: "", records: [] },
      ],
    },
    alerts: [],
    practice: {
      role: "ADMINISTRATOR",
      records: [],
      balances: [],
      events: [],
      approved_templates: [],
      versions: [],
      retention_days: null,
      template_values: {},
    },
  };
}
it("separa plazos confirmados, por confirmar y trabajo interno, excluyendo completados", () => {
  const data = sources([
    task("expired", "2026-10-18T15:00:00.000Z", true),
    task("pending-confirmation", "2026-10-17T15:00:00.000Z", false),
    task("next", "2026-10-22T15:00:00.000Z", true),
    task("internal", "2026-10-18T15:00:00.000Z"),
    { ...task("done", "2026-10-18T15:00:00.000Z", true), status: "DONE" },
  ]);
  const result = dashboardOverview(data, [], now),
    count = (id: string) =>
      result.metrics.find((m) => m.id === id)!.records!.length;
  expect(count("expired")).toBe(1);
  expect(count("unconfirmed")).toBe(1);
  expect(count("upcoming")).toBe(1);
  expect(count("late-work")).toBe(1);
  expect(result.workload[0]!.overdue).toBe(2);
  expect(result.pending).toBe(4);
});
it("una revisión nueva sin confirmar no hereda la confirmación anterior", () => {
  const item = task("revised", "2026-10-18T15:00:00.000Z", true);
  item.deadline!.versions.push({
    ...item.deadline!.versions[0]!,
    revision: 2,
    confirmed_at: null,
    confirmed_by: null,
  });
  item.deadline!.revision = 2;
  const result = dashboardOverview(sources([item]), [], now);
  expect(result.metrics.find((m) => m.id === "expired")!.records).toHaveLength(
    0,
  );
  expect(
    result.metrics.find((m) => m.id === "unconfirmed")!.records,
  ).toHaveLength(1);
});
it("cuenta avisos individuales y muestra una sola prioridad por plazo, conservando la más urgente", () => {
  const data = sources([task("expired", "2026-10-18T15:00:00.000Z", true)]);
  data.alerts = [
    alert("reminder", "REMINDER"),
    alert("escalation", "ESCALATION"),
    {
      ...alert("acknowledged", "OVERDUE"),
      alert: {
        ...alert("acknowledged", "OVERDUE").alert,
        acknowledged_at: now.toISOString(),
      },
    },
  ];
  const result = dashboardOverview(data, [], now);
  expect(result.metrics.find((m) => m.id === "alerts")!.records).toHaveLength(
    2,
  );
  expect(result.priorities).toHaveLength(1);
  expect(result.priorities[0]!.alert!.alert.kind).toBe("ESCALATION");
});
it("usa una ventana de siete días desde ahora para los próximos plazos", () => {
  const result = dashboardOverview(
    sources([
      task("limit", "2026-10-26T15:00:00.000Z", true),
      task("outside", "2026-10-26T15:01:00.000Z", true),
      task("unconfirmed", "2026-10-20T15:00:00.000Z", false),
    ]),
    [],
    now,
  );
  expect(
    result.metrics
      .find((m) => m.id === "upcoming")!
      .records!.map((r) => r.title),
  ).toEqual(["limit"]);
});
it("la agenda de hoy usa Paraguay, incluye reuniones que cruzan medianoche y excluye canceladas", () => {
  const data = sources();
  const meeting = (
    id: string,
    start: string,
    end: string,
    status = "SCHEDULED",
  ) => ({
    id,
    payload: {
      type: "APPOINTMENT",
      title: id,
      starts_at: start,
      ends_at: end,
      status,
      responsible_identity_id: "lawyer",
      client_id: null,
      location: "",
      notes: "",
    },
  });
  data.practice!.records = [
    meeting("late", "2026-10-20T02:00:00.000Z", "2026-10-20T02:30:00.000Z"),
    meeting(
      "overnight",
      "2026-10-19T02:30:00.000Z",
      "2026-10-19T04:00:00.000Z",
    ),
    meeting("tomorrow", "2026-10-20T03:00:00.000Z", "2026-10-20T04:00:00.000Z"),
    meeting(
      "cancelled",
      "2026-10-19T13:00:00.000Z",
      "2026-10-19T14:00:00.000Z",
      "CANCELLED",
    ),
  ] as PracticeView["records"];
  expect(
    dashboardOverview(data, [], now).appointments.map((a) => a.id),
  ).toEqual(["overnight", "late"]);
});
it("distingue datos no disponibles de indicadores en cero", () => {
  expect(
    dashboardOverview(
      { work: null, dashboard: null, alerts: null, practice: null },
      [],
      now,
    ).metrics.every((m) => m.records === null),
  ).toBe(true);
  expect(
    dashboardOverview(sources(), [], now).metrics.every(
      (m) => m.records?.length === 0,
    ),
  ).toBe(true);
});
