import { useEffect, useState } from "react";
import type {
  Matter,
  MatterParticipant,
  Task,
} from "../../../os-core/src/contracts.js";
import { taskAssigner } from "../../../os-core/src/work-management.js";
import { asuncionDate } from "./local-dates.js";
import { taskGroup } from "./workspace-model.js";
import { shiftDay } from "./office-metrics.js";
import { DeadlineInbox } from "./Deadlines.js";
import { currentDeadline } from "../../../os-core/src/deadlines.js";
import { api } from "./api.js";
import { Form } from "./components.js";
import { TaskAgenda } from "./WorkspaceViews.js";
import "./work-management.css";

export type WorkBoardData = {
  role: string;
  team: boolean;
  matters: Matter[];
  tasks: Task[];
  requests: Task[];
  people: Array<{ identity_id: string; display_name: string; role: string }>;
};
import { workChanged, errorText } from "./work-management-client.js";
export function DirectionRequestForm({
  firmId,
  matters,
  drafts = [],
  task,
  initialKind,
  onClose,
  onSaved,
}: {
  firmId: string;
  matters: Matter[];
  drafts?: Array<{ id: string; matter_id: string }>;
  task?: Task;
  initialKind?: "HELP" | "REVIEW" | "RESCHEDULE";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<"HELP" | "REVIEW" | "RESCHEDULE">(
    initialKind ?? (task ? "RESCHEDULE" : "HELP"),
  );
  const [matterId, setMatterId] = useState(
    task?.matter_id ?? matters[0]?.id ?? "",
  );
  return (
    <Form
      title="Solicitar intervención a Dirección"
      onClose={onClose}
      footerText="La solicitud no asigna trabajo a otro abogado"
      onSave={async (data) => {
        await api(
          `/firms/${firmId}/matters/${data.get("matter")}/direction-requests`,
          {
            kind,
            note: data.get("note"),
            draft_id: kind === "REVIEW" ? data.get("draft") : null,
            target_task_id: kind === "RESCHEDULE" ? (task?.id ?? null) : null,
          },
        );
        workChanged();
        onSaved();
      }}
    >
      <label className="field">
        <span>Asunto</span>
        <select
          name="matter"
          value={matterId}
          onChange={(e) => setMatterId(e.target.value)}
          required
        >
          {matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Intervención necesaria</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="HELP">Ayuda de otro profesional</option>
          {drafts.length > 0 && (
            <option value="REVIEW">Revisión documental</option>
          )}
          {task && <option value="RESCHEDULE">Reprogramar este encargo</option>}
        </select>
      </label>
      {kind === "REVIEW" && (
        <label className="field">
          <span>Borrador</span>
          <select name="draft" required>
            {drafts
              .filter((d) => d.matter_id === matterId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id.slice(0, 8)}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="field deadline-wide">
        <span>Qué necesitás y por qué</span>
        <textarea name="note" required maxLength={4000} />
      </label>
    </Form>
  );
}

export function WorkDialog({
  firmId,
  data,
  task,
  request,
  onClose,
  onSaved,
  onSchedule,
}: {
  firmId: string;
  data: WorkBoardData;
  task?: Task;
  request?: Task;
  onClose: () => void;
  onSaved: () => void;
  onSchedule?: (task: Task) => void;
}) {
  const [matterId, setMatterId] = useState(
    task?.matter_id ?? request?.matter_id ?? data.matters[0]?.id ?? "",
  );
  const [access, setAccess] = useState<MatterParticipant[]>([]),
    [error, setError] = useState("");
  const [decision, setDecision] = useState<"ASSIGN" | "RESOLVED" | "DECLINE">(
    request?.direction_request?.kind === "RESCHEDULE" ? "RESOLVED" : "ASSIGN",
  );
  useEffect(() => {
    let alive = true;
    setAccess([]);
    void api<MatterParticipant[]>(
      `/firms/${firmId}/matters/${matterId}/participants`,
    )
      .then((rows) => {
        if (alive) setAccess(rows);
      })
      .catch((cause) => {
        if (alive) setError(errorText(cause));
      });
    return () => {
      alive = false;
    };
  }, [firmId, matterId]);
  const eligible = data.people.filter(
    (p) =>
      p.role === "ADMINISTRATOR" ||
      access.some(
        (a) =>
          a.active &&
          a.identity_id === p.identity_id &&
          a.permissions.includes(
            request?.direction_request?.kind === "REVIEW" ||
              task?.kind === "DRAFT_REVIEW"
              ? "DRAFT_REVIEW"
              : "TASK_WRITE",
          ),
      ),
  );
  return (
    <Form
      title={
        request
          ? "Atender solicitud a Dirección"
          : task
            ? "Modificar encargo"
            : "Asignar tarea"
      }
      onClose={onClose}
      footerText="La asignación se registra con tu cuenta"
      onSave={async (form) => {
        const base = `/firms/${firmId}/matters/${matterId}`,
          rawDate = String(form.get("due") ?? "");
        const { deadlineInstant } =
          await import("../../../os-core/src/deadlines.js");
        const due = rawDate
          ? deadlineInstant(rawDate.slice(0, 10), rawDate.slice(11, 16))
          : null;
        try {
          if (request)
            await api(base + `/direction-requests/${request.id}/resolution`, {
              decision,
              responsible_identity_id:
                decision === "ASSIGN" ? form.get("responsible") : null,
              internal_due_at: due,
              note: form.get("note"),
            });
          else {
            const input = {
              title: form.get("title"),
              responsible_identity_id: form.get("responsible"),
              internal_due_at: due,
            };
            await api(
              base + (task ? `/tasks/${task.id}/assignment` : "/tasks"),
              task
                ? { input, expected_revision: task.assignment_revision ?? 0 }
                : input,
            );
          }
        } catch (cause) {
          throw Error(errorText(cause));
        }
        workChanged();
        onSaved();
      }}
    >
      {request && (
        <p className="deadline-wide">{request.direction_request!.note}</p>
      )}
      <label className="field">
        <span>Asunto</span>
        <select
          aria-label="Asunto de la tarea"
          value={matterId}
          disabled={!!task || !!request}
          onChange={(e) => setMatterId(e.target.value)}
        >
          {data.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      {request ? (
        <label className="field">
          <span>Decisión</span>
          <select
            aria-label="Decisión de Dirección"
            value={decision}
            onChange={(e) => setDecision(e.target.value as typeof decision)}
          >
            {request.direction_request?.kind !== "RESCHEDULE" && (
              <option value="ASSIGN">Asignar intervención</option>
            )}
            {request.direction_request?.kind !== "REVIEW" && (
              <option value="RESOLVED">Intervención realizada</option>
            )}
            <option value="DECLINE">Rechazar con motivo</option>
          </select>
        </label>
      ) : (
        <label className="field">
          <span>Trabajo a realizar</span>
          <input
            name="title"
            required
            maxLength={240}
            defaultValue={task?.title}
          />
        </label>
      )}
      {(!request || decision === "ASSIGN") && (
        <>
          <label className="field">
            <span>Abogado responsable</span>
            <select
              aria-label="Abogado responsable"
              name="responsible"
              required
              defaultValue={task?.responsible_identity_id ?? ""}
            >
              <option value="">Elegir persona con acceso</option>
              {eligible.map((p) => (
                <option key={p.identity_id} value={p.identity_id}>
                  {p.display_name} ·{" "}
                  {p.role === "ADMINISTRATOR" ? "Dirección" : "Abogado"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha interna · Paraguay (opcional)</span>
            <input
              name="due"
              type="datetime-local"
              defaultValue={
                task?.internal_due_at
                  ? new Intl.DateTimeFormat("sv-SE", {
                      timeZone: "America/Asuncion",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    })
                      .format(new Date(task.internal_due_at))
                      .replace(" ", "T")
                  : ""
              }
            />
          </label>
        </>
      )}
      {request && (
        <label className="field deadline-wide">
          <span>Encargo o motivo de la decisión</span>
          <textarea name="note" required maxLength={4000} />
        </label>
      )}
      {task?.kind === "INTERNAL" && !task.deadline && onSchedule && (
        <button type="button" onClick={() => onSchedule(task)}>
          Registrar plazo con origen y avisos
        </button>
      )}
      <p className="scope-note deadline-wide">
        Solo aparecen personas habilitadas en el asunto. Los plazos judiciales
        se registran con su origen y calendario desde el asunto.
      </p>
      {error && <p role="alert">{error}</p>}
    </Form>
  );
}

export default function WorkManagement({
  firmId,
  actorId,
  director,
  search,
  initialPane = "deadlines",
  identityName,
  onOpen,
  onEditDeadline,
  onCreateDeadline,
}: {
  firmId: string;
  actorId: string;
  director: boolean;
  search: string;
  initialPane?: "deadlines" | "tasks";
  identityName: (id: string) => string;
  onOpen: (matter: Matter, tab: string) => void;
  onEditDeadline: (task: Task) => void;
  onCreateDeadline?: (matter: Matter) => void;
}) {
  const [team, setTeam] = useState(director),
    [data, setData] = useState<WorkBoardData>(),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  const [person, setPerson] = useState(""),
    [matter, setMatter] = useState(""),
    [state, setState] = useState("PENDING"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [category, setCategory] = useState("ALL"),
    [pane, setPane] = useState<"deadlines" | "tasks">(initialPane),
    [priority, setPriority] = useState("all"),
    [localSearch, setLocalSearch] = useState(""),
    [creatingDeadline, setCreatingDeadline] = useState(false);
  const [editing, setEditing] = useState<Task>(),
    [request, setRequest] = useState<Task>(),
    [create, setCreate] = useState(false),
    [ask, setAsk] = useState(false);
  const [changeTask, setChangeTask] = useState<Task>();
  const changed = () => setRevision((v) => v + 1);
  useEffect(() => {
    let alive = true;
    setError("");
    void api<WorkBoardData>(`/firms/${firmId}/work${team ? "/team" : ""}`)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((cause) => {
        if (alive) setError(errorText(cause));
      });
    return () => {
      alive = false;
    };
  }, [firmId, team, revision]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") changed();
    }, 30000);
    window.addEventListener("law-order-work-changed", changed);
    return () => {
      clearInterval(timer);
      window.removeEventListener("law-order-work-changed", changed);
    };
  }, []);
  const tasks =
    data?.tasks.filter((t) => {
      const day = t.internal_due_at
        ? asuncionDate(new Date(t.internal_due_at))
        : null;
      const matchesState =
        state === "ALL" ||
        (state === "BLOCKED"
          ? t.status === "PENDING" && t.progress?.at(-1)?.state === "BLOCKED"
          : t.status === state);
      return (
        (!person || t.responsible_identity_id === person) &&
        (!matter || t.matter_id === matter) &&
        matchesState &&
        (pane === "deadlines" ? !!t.deadline : !t.deadline) &&
        (priority === "all" ||
          (priority === "week" &&
            taskGroup(t) !== "unconfirmed" &&
            !!t.internal_due_at &&
            t.internal_due_at >= new Date().toISOString() &&
            asuncionDate(new Date(t.internal_due_at)) <=
              shiftDay(asuncionDate(), 7)) ||
          (priority === "overdue" && taskGroup(t) === "overdue") ||
          (priority === "unconfirmed" && taskGroup(t) === "unconfirmed") ||
          (priority === "blocked" && t.progress?.at(-1)?.state === "BLOCKED") ||
          (priority === "undated" && !t.internal_due_at)) &&
        (category === "ALL" || currentDeadline(t)?.category === category) &&
        (!from || (!!day && day >= from)) &&
        (!to || (!!day && day <= to))
      );
    }) ?? [];
  const requests =
    data?.requests.filter((t) => t.direction_request?.status === "OPEN") ?? [];
  const pending = (data?.tasks ?? []).filter(
    (t) =>
      t.status === "PENDING" &&
      !t.direction_request &&
      (!person || t.responsible_identity_id === person) &&
      (!matter || t.matter_id === matter) &&
      (category === "ALL" || currentDeadline(t)?.category === category) &&
      (!from ||
        (!!t.internal_due_at &&
          asuncionDate(new Date(t.internal_due_at)) >= from)) &&
      (!to ||
        (!!t.internal_due_at &&
          asuncionDate(new Date(t.internal_due_at)) <= to)) &&
      (pane === "deadlines" ? !!t.deadline : !t.deadline),
  );
  const close = () => {
    setEditing(undefined);
    setRequest(undefined);
    setCreate(false);
    changed();
  };
  return (
    <div className="work-management">
      <header className="work-control-header">
        <div>
          <span className="eyebrow">CONTROL DEL DESPACHO</span>
          <p>
            {pane === "deadlines"
              ? "Vencimientos con origen, responsable y confirmación profesional."
              : "Encargos, avances y bloqueos del equipo."}
          </p>
        </div>
        <div className="office-tool-actions">
          {director && (
            <div className="office-segmented">
              <button aria-pressed={team} onClick={() => setTeam(true)}>
                Todo el estudio
              </button>
              <button aria-pressed={!team} onClick={() => setTeam(false)}>
                Mis encargos
              </button>
            </div>
          )}
          {!director && (
            <button onClick={() => setAsk(true)}>Solicitar a Dirección</button>
          )}
          <button onClick={() => setCreate(true)}>
            {director ? "+ Asignar tarea" : "+ Tarea propia"}
          </button>
          {onCreateDeadline && (
            <button
              className="primary"
              onClick={() => setCreatingDeadline(true)}
            >
              + Registrar plazo
            </button>
          )}
        </div>
      </header>
      <nav className="office-tabs" aria-label="Control de trabajo">
        <button
          aria-pressed={pane === "deadlines"}
          onClick={() => {
            setPane("deadlines");
            setPriority("all");
            setCategory("ALL");
          }}
        >
          Plazos y vencimientos
        </button>
        <button
          aria-pressed={pane === "tasks"}
          onClick={() => {
            setPane("tasks");
            setPriority("all");
            setCategory("ALL");
          }}
        >
          Trabajo del equipo
        </button>
      </nav>
      <div
        className="work-kpis office-kpis"
        aria-label="Indicadores de trabajo"
      >
        {[
          {
            label: "Vencidos",
            value: pending.filter((t) => taskGroup(t) === "overdue").length,
            key: "overdue",
            note: "Requieren atención",
            tone: "danger",
          },
          {
            label: "Próximos 7 días",
            value: pending.filter(
              (t) =>
                !!t.internal_due_at &&
                t.internal_due_at >= new Date().toISOString() &&
                asuncionDate(new Date(t.internal_due_at)) <=
                  shiftDay(asuncionDate(), 7) &&
                taskGroup(t) !== "unconfirmed",
            ).length,
            key: "week",
            note: "Vencimientos confirmados",
            tone: "amber",
          },
          {
            label: pane === "deadlines" ? "Por confirmar" : "Bloqueadas",
            value: pending.filter((t) =>
              pane === "deadlines"
                ? taskGroup(t) === "unconfirmed"
                : t.progress?.at(-1)?.state === "BLOCKED",
            ).length,
            key: pane === "deadlines" ? "unconfirmed" : "blocked",
            note:
              pane === "deadlines"
                ? "Revisar origen y calendario"
                : "Requieren intervención",
            tone: "amber",
          },
          {
            label: pane === "deadlines" ? "Plazos activos" : "Sin fecha",
            value:
              pane === "deadlines"
                ? pending.length
                : pending.filter((t) => !t.internal_due_at).length,
            key: pane === "deadlines" ? "all" : "undated",
            note:
              pane === "deadlines"
                ? "Total pendiente del ámbito elegido"
                : "Pendientes de programar",
            tone: "neutral",
          },
        ].map((k) => (
          <button
            className="office-kpi"
            key={k.key}
            data-tone={k.tone}
            aria-pressed={priority === k.key}
            onClick={() => {
              setPriority(k.key);
              setState("PENDING");
            }}
          >
            <span>{k.label}</span>
            <strong>{data ? k.value : "..."}</strong>
            <small>{k.note}</small>
          </button>
        ))}
      </div>
      {creatingDeadline && onCreateDeadline && (
        <Form
          title="Elegí el asunto del plazo"
          footerText="Después se registra el origen, vencimiento y avisos"
          onClose={() => setCreatingDeadline(false)}
          onSave={async (f) => {
            const m = data?.matters.find((m) => m.id === f.get("matter"));
            if (!m) throw Error("Elegí un asunto");
            setCreatingDeadline(false);
            onCreateDeadline(m);
          }}
        >
          <label className="field">
            <span>Asunto del plazo</span>
            <select name="matter" required defaultValue="">
              <option value="">Elegí un asunto</option>
              {data?.matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </Form>
      )}
      {data && (create || editing || request) && (
        <WorkDialog
          firmId={firmId}
          data={data}
          task={editing}
          request={request}
          onClose={close}
          onSaved={close}
          onSchedule={onEditDeadline}
        />
      )}
      {data && ask && (
        <DirectionRequestForm
          firmId={firmId}
          matters={data.matters}
          onClose={() => setAsk(false)}
          onSaved={() => {
            setAsk(false);
            changed();
          }}
        />
      )}
      {data && changeTask && (
        <DirectionRequestForm
          firmId={firmId}
          matters={data.matters}
          task={changeTask}
          onClose={() => setChangeTask(undefined)}
          onSaved={() => {
            setChangeTask(undefined);
            changed();
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <div className="work-control-layout">
        <section className="office-card work-board">
          <header>
            <div>
              <h2>
                {pane === "deadlines"
                  ? "Vencimientos del estudio"
                  : "Plan de trabajo"}
              </h2>
              <p>
                {priority === "all"
                  ? "Ordenados por urgencia y fecha"
                  : "Vista filtrada por prioridad"}
              </p>
            </div>
            <button
              className="text-action"
              onClick={() => {
                setPriority("all");
                setCategory("ALL");
                setPerson("");
                setMatter("");
                setFrom("");
                setTo("");
                setState("PENDING");
                setLocalSearch("");
              }}
            >
              Limpiar filtros
            </button>
          </header>
          <div className="work-board-toolbar">
            <input
              aria-label="Buscar en control de trabajo"
              type="search"
              placeholder="Buscar encargo o asunto..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
            <details className="work-advanced">
              <summary>Filtros avanzados</summary>{" "}
              <div className="work-filters">
                <label>
                  Tipo
                  <select
                    aria-label="Filtrar tipo de plazo"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="ALL">Todos los tipos de plazo</option>
                    <option value="JUDICIAL">Plazos judiciales</option>
                    <option value="CONTRACTUAL">Plazos contractuales</option>
                    <option value="INTERNAL">Fechas internas</option>
                  </select>
                </label>
                {director && (
                  <label>
                    Abogado
                    <select
                      aria-label="Filtrar por abogado"
                      value={person}
                      onChange={(e) => setPerson(e.target.value)}
                    >
                      <option value="">Todo el equipo</option>
                      {data?.people.map((p) => (
                        <option key={p.identity_id} value={p.identity_id}>
                          {p.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Asunto
                  <select
                    aria-label="Filtrar por asunto"
                    value={matter}
                    onChange={(e) => setMatter(e.target.value)}
                  >
                    <option value="">Todos los asuntos</option>
                    {data?.matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Estado
                  <select
                    aria-label="Filtrar por estado"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  >
                    <option value="PENDING">Pendientes</option>
                    <option value="BLOCKED">Con bloqueo</option>
                    <option value="DONE">Completadas</option>
                    <option value="CANCELLED">Canceladas</option>
                    <option value="ALL">Todos</option>
                  </select>
                </label>
                <label>
                  Desde
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
            </details>
          </div>{" "}
          <TaskAgenda
            key={pane + priority}
            compact
            emptyTitle={
              pane === "deadlines"
                ? "No hay plazos en esta vista"
                : "No hay encargos en esta vista"
            }
            emptyDescription={
              pane === "deadlines"
                ? "Registrá el origen y la fecha del plazo. Una vez confirmado, el OS activa sus avisos y seguimiento."
                : "Asigná un encargo con responsable y fecha para organizar el trabajo del equipo."
            }
            emptyAction={
              pane === "deadlines"
                ? "Registrar primer plazo"
                : "Crear primer encargo"
            }
            tasks={tasks}
            matters={data?.matters ?? []}
            search={localSearch || search}
            identityName={identityName}
            actorId={actorId}
            director={director}
            firmId={firmId}
            scope={
              team
                ? "Trabajo del equipo · estudio actual"
                : "Mi trabajo · asuntos autorizados"
            }
            onChanged={changed}
            onOpen={onOpen}
            onBrowse={() =>
              pane === "deadlines" && onCreateDeadline
                ? setCreatingDeadline(true)
                : director
                  ? setCreate(true)
                  : setAsk(true)
            }
            canEditTask={(t) =>
              director || t.responsible_identity_id === actorId
            }
            canConfirmTask={(t) =>
              director || t.responsible_identity_id === actorId
            }
            onEdit={(t) => (t.deadline ? onEditDeadline(t) : setEditing(t))}
            canModifyTask={(t) =>
              director ||
              (t.responsible_identity_id === actorId &&
                taskAssigner(t) === actorId)
            }
            onRequestChange={(t) => setChangeTask(t)}
            onComplete={async (t) => {
              try {
                await api(
                  `/firms/${firmId}/matters/${t.matter_id}/tasks/${t.id}/status`,
                  {
                    status: "DONE",
                    expected_deadline_revision: t.deadline?.revision,
                  },
                );
                changed();
                workChanged();
              } catch (cause) {
                setError(errorText(cause));
              }
            }}
          />
        </section>
        <aside className="work-control-aside">
          <section className="office-card">
            <DeadlineInbox
              firmId={firmId}
              onOpen={(id) => {
                const m = data?.matters.find((m) => m.id === id);
                if (m) onOpen(m, "tasks");
              }}
            />
          </section>
          <section className="office-card workload-panel">
            <header>
              <div>
                <h2>Carga de trabajo</h2>
                <p>Encargos pendientes por profesional</p>
              </div>
            </header>
            {(data?.people ?? [])
              .filter((p) => team || p.identity_id === actorId)
              .map((p) => {
                const count = data!.tasks.filter(
                  (t) =>
                    t.status === "PENDING" &&
                    t.responsible_identity_id === p.identity_id,
                ).length;
                return (
                  <button
                    key={p.identity_id}
                    aria-pressed={person === p.identity_id}
                    onClick={() =>
                      setPerson(person === p.identity_id ? "" : p.identity_id)
                    }
                  >
                    <span>{p.display_name}</span>
                    <strong>{count}</strong>
                    <i
                      style={{
                        width: count
                          ? Math.min(
                              100,
                              (count /
                                Math.max(
                                  1,
                                  ...data!.people.map(
                                    (p) =>
                                      data!.tasks.filter(
                                        (t) =>
                                          t.status === "PENDING" &&
                                          t.responsible_identity_id ===
                                            p.identity_id,
                                      ).length,
                                  ),
                                )) *
                                100,
                            ) + "%"
                          : "0%",
                      }}
                    />
                  </button>
                );
              })}
          </section>
          <section className="office-card work-requests">
            {" "}
            <details className="direction-requests" open={requests.length > 0}>
              <summary>
                Solicitudes a Dirección · {requests.length} pendientes
              </summary>
              {requests.map((t) => (
                <article key={t.id}>
                  <div>
                    <strong>{t.title}</strong>
                    <p>{t.direction_request!.note}</p>
                    <small>
                      {identityName(t.responsible_identity_id)} ·{" "}
                      {data?.matters.find((m) => m.id === t.matter_id)?.title}
                    </small>
                  </div>
                  {director && (
                    <button onClick={() => setRequest(t)}>
                      Atender solicitud
                    </button>
                  )}
                </article>
              ))}
              {!requests.length && <p>Sin solicitudes pendientes.</p>}
            </details>
            {!!data?.requests.some(
              (t) => t.direction_request?.status !== "OPEN",
            ) && (
              <details className="direction-requests">
                <summary>Solicitudes atendidas</summary>
                {data.requests
                  .filter((t) => t.direction_request?.status !== "OPEN")
                  .map((t) => (
                    <article key={t.id}>
                      <div>
                        <strong>{t.title}</strong>
                        <p>
                          {t.direction_request?.status === "DECLINED"
                            ? "Rechazada"
                            : t.direction_request?.status === "ASSIGNED"
                              ? "Intervención asignada"
                              : "Resuelta"}{" "}
                          · {t.direction_request?.resolution_note}
                        </p>
                        <small>{identityName(t.responsible_identity_id)}</small>
                      </div>
                    </article>
                  ))}
              </details>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
