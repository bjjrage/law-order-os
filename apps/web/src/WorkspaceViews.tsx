import { useEffect, useState } from "react";
import type {
  Client,
  Matter,
  Task,
  Draft,
  DraftReview,
  Document,
} from "../../../os-core/src/contracts.js";
import { api } from "./api.js";
import { Badge } from "./components.js";
import { DeadlineDetails, DeadlineInbox } from "./Deadlines.js";
import { currentDeadline } from "../../../os-core/src/deadlines.js";
import { TaskProgress } from "./TaskProgress.js";
import NavIcon from "./NavIcon.js";
import {
  displayDate,
  matchesSearch,
  matterKind,
  orderTasks,
  taskGroup,
  taskGroupLabels,
  type TaskGroup,
} from "./workspace-model.js";

type MatterNavigation = (matter: Matter, tab: string) => void;
export function SectionEmpty({
  title,
  description,
  action,
  onAction,
  icon = "matters",
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  icon?: string;
}) {
  return (
    <div className="section-empty">
      <span className="empty-icon">
        <NavIcon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction && (
        <button onClick={onAction}>
          {action} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
export function SummaryStrip({
  items,
  label = "Resumen",
}: {
  items: Array<{
    label: string;
    value: number | string;
    note?: string;
    action?: string;
    onAction?: () => void;
    active?: boolean;
    controls?: string;
  }>;
  label?: string;
}) {
  return (
    <div className="summary-strip" role="group" aria-label={label}>
      {items.map((item) => {
        const content = (
          <>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.note && <small>{item.note}</small>}
            {item.action && (
              <span className="summary-action">
                {item.action} <span aria-hidden="true">→</span>
              </span>
            )}
          </>
        );
        return item.onAction ? (
          <button
            key={item.label}
            type="button"
            className="summary-control"
            onClick={item.onAction}
            aria-pressed={item.active}
            aria-controls={item.controls}
          >
            {content}
          </button>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </div>
  );
}
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
export function ClientDirectory({
  clients,
  matters,
  search,
  onOpen,
  onCreate,
  onClearSearch,
  onOpenMatters,
}: {
  clients: Client[];
  matters: Matter[];
  search: string;
  onOpen: (client: Client) => void;
  onCreate: () => void;
  onClearSearch: () => void;
  onOpenMatters: () => void;
}) {
  const [kind, setKind] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const openMatters = matters.filter((m) => m.status === "OPEN");
  const clientsWithOpenMatters = new Set(openMatters.map((m) => m.client_id));
  const showClients = (onlyOpen: boolean) => {
    setOpenOnly(onlyOpen);
    setKind("all");
    onClearSearch();
  };
  const visible = clients.filter(
    (c) =>
      (kind === "all" || c.kind === kind) &&
      (!openOnly || clientsWithOpenMatters.has(c.id)) &&
      matchesSearch(search, c.display_name, c.identification),
  );
  return (
    <>
      <SummaryStrip
        label="Accesos a clientes y asuntos"
        items={[
          {
            label: "Todos los clientes",
            value: clients.length,
            note: "Personas y organizaciones del estudio",
            action: "Ver todos",
            onAction: () => showClients(false),
            active: !openOnly && kind === "all" && !search.trim(),
            controls: "client-directory-results",
          },
          {
            label: "Clientes con asuntos abiertos",
            value: clients.filter((c) => clientsWithOpenMatters.has(c.id))
              .length,
            note: "Con al menos un asunto abierto a tu alcance",
            action: "Filtrar clientes",
            onAction: () => showClients(true),
            active: openOnly,
            controls: "client-directory-results",
          },
          {
            label: "Asuntos abiertos",
            value: openMatters.length,
            note: "Casos abiertos que podés consultar",
            action: "Ver asuntos abiertos",
            onAction: onOpenMatters,
          },
        ]}
      />
      <div className="collection-controls">
        <div className="segmented" aria-label="Tipo de cliente">
          {[
            ["all", "Todos"],
            ["ORGANIZATION", "Organizaciones"],
            ["PERSON", "Personas"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={kind === key}
              onClick={() => setKind(key!)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="client-filter-status" role="status">
          {openOnly && (
            <button
              className="client-filter-chip"
              onClick={() => setOpenOnly(false)}
              aria-label="Quitar filtro de clientes con asuntos abiertos"
            >
              Con asuntos abiertos <span aria-hidden="true">×</span>
            </button>
          )}
          <span className="muted">
            {visible.length} {visible.length === 1 ? "cliente" : "clientes"}
            {openOnly ? " con asuntos abiertos" : " en la lista"}
          </span>
        </div>
      </div>
      <div className="client-directory" id="client-directory-results">
        {visible.map((client) => {
          const cases = matters.filter((m) => m.client_id === client.id),
            opened = cases.filter((m) => m.status === "OPEN");
          return (
            <article className="client-entry" key={client.id}>
              <span className="client-monogram" aria-hidden="true">
                {initials(client.display_name)}
              </span>
              <div className="client-entry-main">
                <span className="eyebrow">
                  {client.kind === "PERSON" ? "PERSONA" : "ORGANIZACIÓN"}
                </span>
                <h3>
                  <button
                    className="text-button"
                    onClick={() => onOpen(client)}
                  >
                    {client.display_name}
                  </button>
                </h3>
                <p>
                  {client.identification
                    ? "Identificación · " + client.identification
                    : "Identificación sin registrar"}
                  <span>Alta · {displayDate(client.created_at, true)}</span>
                </p>
              </div>
              <div className="client-caseload">
                <strong>{opened.length}</strong>
                <span>
                  {opened.length === 1 ? "asunto abierto" : "asuntos abiertos"}
                </span>
                <small>
                  {cases.length}{" "}
                  {cases.length === 1 ? "asunto en total" : "asuntos en total"}
                </small>
              </div>
              <button
                className="entry-action"
                aria-label={"Ver asuntos de " + client.display_name}
                onClick={() => onOpen(client)}
              >
                Ver asuntos <span aria-hidden="true">→</span>
              </button>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <SectionEmpty
          icon="clients"
          title={
            clients.length
              ? openOnly
                ? "Sin clientes con asuntos abiertos"
                : "Sin coincidencias"
              : "Tu cartera empieza con un cliente"
          }
          description={
            clients.length
              ? openOnly
                ? "No hay clientes con asuntos abiertos que coincidan con estos filtros. Podés quitar el filtro para ver toda tu cartera."
                : "Probá otro nombre, identificación o tipo de cliente."
              : "Registrá una persona u organización. Después podrás abrir sus asuntos y reunir los documentos."
          }
          {...(!clients.length
            ? { action: "Nuevo cliente", onAction: onCreate }
            : openOnly
              ? {
                  action: "Ver todos los clientes",
                  onAction: () => showClients(false),
                }
              : {})}
        />
      )}
    </>
  );
}
export function ClientSummary({
  client,
  matters,
}: {
  client: Client;
  matters: Matter[];
}) {
  const cases = matters.filter((m) => m.client_id === client.id);
  return (
    <section className="client-context" aria-label="Ficha del cliente">
      <span className="client-monogram" aria-hidden="true">
        {initials(client.display_name)}
      </span>
      <div>
        <span className="eyebrow">FICHA DEL CLIENTE</span>
        <strong>{client.kind === "PERSON" ? "Persona" : "Organización"}</strong>
        <span>
          {client.identification
            ? "Identificación · " + client.identification
            : "Identificación sin registrar"}
        </span>
      </div>
      <div>
        <span>Relación con el estudio</span>
        <strong>Desde {displayDate(client.created_at, true)}</strong>
      </div>
      <div>
        <span>Asuntos abiertos</span>
        <strong>
          {cases.filter((m) => m.status === "OPEN").length}{" "}
          <small>de {cases.length} en total</small>
        </strong>
      </div>
    </section>
  );
}
export function MatterDirectory({
  matters,
  clients,
  search,
  identityName,
  onOpen,
  onCreate,
}: {
  matters: Matter[];
  clients: Client[];
  search: string;
  identityName: (id: string) => string;
  onOpen: MatterNavigation;
  onCreate: () => void;
}) {
  const [state, setState] = useState("OPEN");
  const visible = matters.filter(
    (m) =>
      (state === "all" || m.status === state) &&
      matchesSearch(
        search,
        m.title,
        m.subject_area,
        clients.find((c) => c.id === m.client_id)?.display_name,
        identityName(m.responsible_identity_id),
      ),
  );
  return (
    <>
      <div className="collection-controls">
        <div className="segmented" aria-label="Estado de asuntos">
          {[
            ["OPEN", "Abiertos"],
            ["CLOSED", "Cerrados"],
            ["all", "Todos"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={state === key}
              onClick={() => setState(key!)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="muted">
          {visible.length} {visible.length === 1 ? "asunto" : "asuntos"} · según
          tus permisos
        </span>
      </div>
      <div className="matter-directory">
        {visible.map((m) => (
          <article key={m.id} className="matter-entry">
            <div className="matter-entry-header">
              <span className="eyebrow">
                {matterKind(m.kind)} · {m.subject_area}
              </span>
              <Badge>{m.status === "OPEN" ? "Abierto" : "Cerrado"}</Badge>
            </div>
            <h3>
              <button
                className="text-button"
                onClick={() => onOpen(m, "matter-home")}
              >
                {m.title}
              </button>
            </h3>
            <p>
              {clients.find((c) => c.id === m.client_id)?.display_name ??
                "Cliente autorizado"}
            </p>
            <dl>
              <div>
                <dt>Responsable</dt>
                <dd>{identityName(m.responsible_identity_id)}</dd>
              </div>
              <div>
                <dt>Apertura</dt>
                <dd>{displayDate(m.opened_on, true)}</dd>
              </div>
            </dl>
            <footer>
              <button onClick={() => onOpen(m, "matter-home")}>
                Abrir asunto →
              </button>
              <button
                className="text-action"
                onClick={() => onOpen(m, "junta")}
              >
                Consulta jurídica
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!visible.length && (
        <SectionEmpty
          title="Sin asuntos en esta vista"
          description={
            matters.length
              ? "Cambiá el estado o la búsqueda para encontrar otro asunto."
              : "Abrí un asunto para organizar el encargo, sus documentos y el equipo responsable."
          }
          {...(!matters.length
            ? { action: "Nuevo asunto", onAction: onCreate }
            : {})}
        />
      )}
    </>
  );
}
type AgendaProps = {
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: string;
  tasks: Task[];
  matters: Matter[];
  search: string;
  onOpen: MatterNavigation;
  onComplete: (task: Task) => void;
  onBrowse: () => void;
  scope?: string;
  firmId?: string;
  identityName?: (id: string) => string;
  onChanged?: () => void;
  onEdit?: (task: Task) => void;
  canEditTask?: (task: Task) => boolean;
  canConfirmTask?: (task: Task) => boolean;
  canModifyTask?: (task: Task) => boolean;
  actorId?: string;
  director?: boolean;
  onRequestChange?: (task: Task) => void;
};
export function TaskAgenda({
  compact = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  tasks,
  matters,
  search,
  onOpen,
  onComplete,
  onBrowse,
  scope = "Mis tareas · asuntos autorizados",
  firmId,
  identityName = (id) => id,
  onChanged = () => {},
  onEdit,
  canEditTask = () => false,
  canConfirmTask = () => false,
  canModifyTask = canEditTask,
  actorId = "",
  director = false,
  onRequestChange,
}: AgendaProps) {
  const [filter, setFilter] = useState<TaskGroup | "all">("all");
  const now = new Date(),
    groups: TaskGroup[] = [
      "overdue",
      "unconfirmed",
      "today",
      "upcoming",
      "undated",
      "completed",
    ];
  const visible = orderTasks(
    tasks.filter(
      (task) =>
        !task.direction_request &&
        (filter === "all" || taskGroup(task, now) === filter) &&
        matchesSearch(
          search,
          task.title,
          matters.find((m) => m.id === task.matter_id)?.title,
        ),
    ),
    now,
  );
  return (
    <div className="agenda-workspace">
      {firmId && !compact && (
        <DeadlineInbox
          firmId={firmId}
          onOpen={(id) => {
            const matter = matters.find((m) => m.id === id);
            if (matter) onOpen(matter, "tasks");
          }}
        />
      )}
      {!compact && (
        <div className="agenda-scope">
          <NavIcon name="agenda" />
          <div>
            <strong>{scope}</strong>
            <span>Tareas y plazos · horario de Paraguay</span>
          </div>
        </div>
      )}
      {!compact && (
        <div className="agenda-filters" aria-label="Filtrar agenda">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todas{" "}
            <strong>{tasks.filter((t) => !t.direction_request).length}</strong>
          </button>
          {groups
            .filter(
              (g) =>
                g !== "completed" || tasks.some((t) => taskGroup(t, now) === g),
            )
            .map((group) => (
              <button
                key={group}
                data-tone={group}
                aria-pressed={filter === group}
                onClick={() => setFilter(group)}
              >
                {taskGroupLabels[group]}{" "}
                <strong>
                  {
                    tasks.filter(
                      (t) =>
                        !t.direction_request && taskGroup(t, now) === group,
                    ).length
                  }
                </strong>
              </button>
            ))}
        </div>
      )}
      {groups.map((group) => {
        const entries = visible.filter(
          (task) => taskGroup(task, now) === group,
        );
        return (
          entries.length > 0 && (
            <section key={group} className="agenda-group" data-tone={group}>
              <header>
                <h3>{taskGroupLabels[group]}</h3>
                <span>{entries.length}</span>
              </header>
              {entries.map((task) => {
                const matter = matters.find((m) => m.id === task.matter_id);
                return (
                  <article className="agenda-entry" key={task.id}>
                    <div className="agenda-date">
                      <strong>
                        {task.internal_due_at
                          ? displayDate(task.internal_due_at)
                          : "—"}
                      </strong>
                      <span>
                        {task.internal_due_at
                          ? new Date(task.internal_due_at).toLocaleTimeString(
                              "es-PY",
                              {
                                timeZone: "America/Asuncion",
                                hour: "2-digit",
                                minute: "2-digit",
                                hourCycle: "h23",
                              },
                            )
                          : "por programar"}
                      </span>
                    </div>
                    <div className="agenda-entry-main">
                      <span className="eyebrow">
                        {task.kind === "DRAFT_REVIEW"
                          ? "REVISIÓN HUMANA"
                          : currentDeadline(task)?.category === "JUDICIAL"
                            ? "PLAZO JUDICIAL"
                            : currentDeadline(task)?.category === "CONTRACTUAL"
                              ? "PLAZO CONTRACTUAL"
                              : "TAREA INTERNA"}
                      </span>
                      <h4>{task.title}</h4>
                      {task.status === "PENDING" &&
                        task.progress?.at(-1)?.state === "BLOCKED" && (
                          <Badge>Bloqueada · requiere intervención</Badge>
                        )}
                      <small>
                        Responsable:{" "}
                        {identityName(task.responsible_identity_id)}
                      </small>
                      {matter && (
                        <button
                          className="text-action"
                          onClick={() =>
                            onOpen(
                              matter,
                              task.kind === "DRAFT_REVIEW"
                                ? "reviews"
                                : "tasks",
                            )
                          }
                        >
                          {matter.title} →
                        </button>
                      )}
                      <DeadlineDetails
                        key={task.deadline?.revision ?? 0}
                        task={task}
                        identityName={identityName}
                        onChanged={onChanged}
                        onEdit={onEdit}
                        canEdit={canModifyTask(task)}
                        canConfirm={canConfirmTask(task)}
                      />
                      {task.assigned_by && !compact && (
                        <small className="work-assignment">
                          Encargó: {identityName(task.assigned_by)}
                        </small>
                      )}
                      {!!task.assignment_history?.length && !compact && (
                        <details className="work-progress">
                          <summary>Historial del encargo</summary>
                          {task.assignment_history.map((h) => (
                            <p key={h.revision}>
                              {displayDate(h.at)} ·{" "}
                              {identityName(h.assigned_by)} →{" "}
                              {identityName(h.responsible_identity_id)}
                              <br />
                              {h.title}
                              {h.internal_due_at
                                ? ` · ${displayDate(h.internal_due_at)}`
                                : " · Sin fecha interna"}
                            </p>
                          ))}
                        </details>
                      )}
                      {!task.deadline &&
                        task.kind === "DRAFT_REVIEW" &&
                        task.status === "PENDING" &&
                        director && (
                          <button
                            className="text-action"
                            onClick={() => onEdit?.(task)}
                          >
                            Modificar encargo
                          </button>
                        )}
                      {(!compact || !task.deadline) && (
                        <TaskProgress
                          task={task}
                          actorId={actorId}
                          director={director}
                          onChanged={onChanged}
                        />
                      )}
                      {task.status === "PENDING" &&
                        task.responsible_identity_id === actorId &&
                        !canModifyTask(task) &&
                        onRequestChange && (
                          <button
                            className="text-action"
                            onClick={() => onRequestChange(task)}
                          >
                            Solicitar reprogramación
                          </button>
                        )}
                    </div>
                    {task.kind === "INTERNAL" &&
                    task.status === "PENDING" &&
                    canEditTask(task) ? (
                      <button onClick={() => onComplete(task)}>
                        Completar
                      </button>
                    ) : task.kind === "DRAFT_REVIEW" && matter ? (
                      <button onClick={() => onOpen(matter, "reviews")}>
                        Revisar versión →
                      </button>
                    ) : task.status !== "PENDING" ? (
                      <Badge>
                        {task.status === "DONE" ? "Hecha" : "Cancelada"}
                      </Badge>
                    ) : null}
                  </article>
                );
              })}
            </section>
          )
        );
      })}
      {!visible.length && (
        <SectionEmpty
          icon="agenda"
          title={
            emptyTitle ??
            (tasks.length
              ? "Sin tareas en este filtro"
              : "Sin tareas asignadas")
          }
          description={
            emptyDescription ??
            (tasks.length
              ? "Elegí otra categoría o cambiá la búsqueda."
              : "Las tareas y solicitudes de revisión aparecen al crearlas dentro de un asunto. Las tareas sin fecha quedan separadas.")
          }
          {...(!tasks.length
            ? { action: emptyAction ?? "Elegir un asunto", onAction: onBrowse }
            : {})}
        />
      )}
      {!compact && (
        <p className="scope-note">
          Los plazos se confirman revisando su origen y calendario. Los avisos
          se entregan dentro del OS; el escalamiento no sustituye la realización
          de la tarea.
        </p>
      )}
    </div>
  );
}
export function DailyFocus(props: AgendaProps & { onAgenda: () => void }) {
  const pending = orderTasks(props.tasks.filter((t) => t.status === "PENDING"));
  const next = pending[0],
    matter = props.matters.find((m) => m.id === next?.matter_id);
  return (
    <>
      <section className="daily-focus">
        <div>
          <span className="eyebrow">TU PRÓXIMA ACCIÓN</span>
          <h2>{next ? next.title : "Sin tareas pendientes a tu cargo"}</h2>
          <p>
            {next
              ? `${matter?.title ?? "Asunto autorizado"} · ${next.internal_due_at ? displayDate(next.internal_due_at) : "Todavía sin fecha interna"}`
              : "Revisá los avisos de plazos o continuá con los asuntos del estudio."}
          </p>
          {matter && (
            <button
              className="primary"
              onClick={() =>
                props.onOpen(
                  matter,
                  next?.kind === "DRAFT_REVIEW" ? "reviews" : "tasks",
                )
              }
            >
              Continuar en el asunto →
            </button>
          )}
        </div>
        <div className="daily-count">
          <strong>{pending.length}</strong>
          <span>
            {pending.length === 1 ? "tarea pendiente" : "tareas pendientes"}
          </span>
          <button className="text-action" onClick={props.onAgenda}>
            Ver agenda completa →
          </button>
        </div>
      </section>
      <TaskAgenda {...props} />
    </>
  );
}

type Production = {
  matter: Matter;
  drafts: Draft[];
  reviews: DraftReview[];
  documents: Document[];
  available: boolean;
};
export function WorkOverview({
  firmId,
  actorId,
  matters,
  clients,
  search,
  identityName,
  onOpen,
  onStart,
}: {
  firmId: string;
  actorId: string;
  matters: Matter[];
  clients: Client[];
  search: string;
  identityName: (id: string) => string;
  onOpen: MatterNavigation;
  onStart: () => void;
}) {
  const [records, setRecords] = useState<Production[] | null>(null),
    [filter, setFilter] = useState("all"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setRecords(null);
    // Read only through the same permission-checked routes as the matter detail.
    void Promise.all(
      matters.map(async (matter) => {
        const base = "/firms/" + firmId + "/matters/" + matter.id;
        try {
          const [drafts, reviews, documents] = await Promise.all([
            api<Draft[]>(base + "/drafts"),
            api<DraftReview[]>(base + "/reviews"),
            api<Document[]>(base + "/documents"),
          ]);
          return { matter, drafts, reviews, documents, available: true };
        } catch {
          return {
            matter,
            drafts: [],
            reviews: [],
            documents: [],
            available: false,
          };
        }
      }),
    ).then((next) => {
      if (active) setRecords(next);
    });
    return () => {
      active = false;
    };
  }, [firmId, actorId, matters, retry]);
  const visible = (records ?? []).filter(
    (row) =>
      matchesSearch(
        search,
        row.matter.title,
        row.matter.subject_area,
        clients.find((c) => c.id === row.matter.client_id)?.display_name,
        ...row.documents.map((d) => d.title),
      ) &&
      (filter === "all" ||
        (filter === "review"
          ? row.reviews.some((r) => r.status === "PENDING")
          : filter === "changes"
            ? row.drafts.some((d) => d.status === "CHANGES_REQUESTED")
            : !row.drafts.length && row.available)),
  );
  const available = records?.filter((r) => r.available) ?? [],
    partial = records?.some((r) => !r.available);
  return (
    <div className="production-workspace">
      <div className="production-brief">
        <NavIcon name="work" />
        <p>
          Trabajo de tus asuntos · borradores, revisiones y responsable humano
        </p>
      </div>
      <SummaryStrip
        items={[
          {
            label: "Borradores",
            value: records
              ? available.reduce((n, row) => n + row.drafts.length, 0)
              : "—",
          },
          {
            label: "Revisiones pendientes",
            value: records
              ? available.reduce(
                  (n, row) =>
                    n +
                    row.reviews.filter((r) => r.status === "PENDING").length,
                  0,
                )
              : "—",
          },
          {
            label: "Con cambios solicitados",
            value: records
              ? available.reduce(
                  (n, row) =>
                    n +
                    row.drafts.filter((d) => d.status === "CHANGES_REQUESTED")
                      .length,
                  0,
                )
              : "—",
          },
        ]}
      />
      {partial && (
        <p role="status" className="panel-note">
          Hay asuntos cuya producción no se pudo leer. Los totales incluyen solo
          los disponibles.{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Reintentar</button>
        </p>
      )}
      <div className="collection-controls">
        <div className="segmented" aria-label="Estado de producción">
          {[
            ["all", "Todos"],
            ["review", "Por revisar"],
            ["changes", "Con cambios"],
            ["new", "Por iniciar"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key!)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!records ? (
        <p className="loading" role="status">
          Reuniendo la producción de tus asuntos…
        </p>
      ) : (
        visible.map((row) => (
          <article className="production-entry" key={row.matter.id}>
            <header>
              <div>
                <span className="eyebrow">
                  {clients.find((c) => c.id === row.matter.client_id)
                    ?.display_name ?? "Cliente autorizado"}{" "}
                  · {row.matter.subject_area}
                </span>
                <h3>{row.matter.title}</h3>
              </div>
              <button onClick={() => onOpen(row.matter, "junta")}>
                Continuar encargo →
              </button>
            </header>
            {row.available ? (
              <>
                <div className="production-status">
                  <strong>
                    Responsable ·{" "}
                    {identityName(row.matter.responsible_identity_id)}
                  </strong>
                  <span>{row.drafts.length} borradores</span>
                  <span>
                    {row.reviews.filter((r) => r.status === "PENDING").length}{" "}
                    revisiones pendientes
                  </span>
                  <button
                    className="text-action"
                    onClick={() => onOpen(row.matter, "participants")}
                  >
                    Ver responsable y permisos →
                  </button>
                </div>
                {row.drafts.length ? (
                  <ul>
                    {row.drafts.map((draft) => (
                      <li key={draft.id}>
                        <span className="document-symbol">
                          <NavIcon name="work" />
                        </span>
                        <div>
                          <strong>
                            {row.documents.find(
                              (d) => d.id === draft.document_id,
                            )?.title ?? "Borrador del asunto"}
                          </strong>
                          <small>
                            Creado el {displayDate(draft.created_at, true)}
                          </small>
                        </div>
                        <Badge>
                          {
                            {
                              DRAFT: "Borrador",
                              IN_REVIEW: "En revisión",
                              APPROVED: "Aprobado",
                              CHANGES_REQUESTED: "Cambios solicitados",
                            }[draft.status]
                          }
                        </Badge>
                        <button
                          onClick={() =>
                            onOpen(
                              row.matter,
                              draft.status === "IN_REVIEW"
                                ? "reviews"
                                : "drafts",
                            )
                          }
                        >
                          {draft.status === "IN_REVIEW"
                            ? "Ver revisión"
                            : "Abrir borradores"}{" "}
                          →
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="production-pending">
                    Todavía sin borradores. Abrí Consulta jurídica para definir
                    el encargo y trabajar con los documentos del asunto.
                  </p>
                )}
              </>
            ) : (
              <p className="production-pending">
                Producción no disponible con el acceso actual.
              </p>
            )}
          </article>
        ))
      )}
      {records && !visible.length && (
        <SectionEmpty
          icon="work"
          title={
            matters.length
              ? "Sin encargos en este filtro"
              : "Prepará tu primer encargo"
          }
          description={
            matters.length
              ? "Probá otra búsqueda o continuá desde un asunto."
              : "Gabriel te ayuda a delimitar el trabajo y vincularlo con un cliente y un asunto."
          }
          {...(!matters.length
            ? { action: "Iniciar encargo con Gabriel", onAction: onStart }
            : {})}
        />
      )}
    </div>
  );
}
