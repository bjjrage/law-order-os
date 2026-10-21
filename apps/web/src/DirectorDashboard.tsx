import { useEffect, useRef, useState } from "react";
import type { Client, Matter } from "../../../os-core/src/contracts.js";
import { api } from "./api.js";
import type { DashboardData } from "./local-team.js";
import type { PracticeSection, PracticeView } from "./PracticePanel.js";
import type { WorkBoardData } from "./WorkManagement.js";
import {
  dashboardOverview,
  type DashboardSources,
  type DashboardAlert,
  type DashboardItem,
} from "./dashboard-overview.js";
import "./dashboard-management.css";

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
const time = (iso: string) =>
  new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

export default function DirectorDashboard({
  firmId,
  actorId,
  director,
  matters,
  clients,
  onOpen,
  onWork,
  onDeadlines,
  onAgenda,
  onMatters,
}: {
  firmId: string;
  actorId: string;
  director: boolean;
  matters: Matter[];
  clients: Client[];
  onOpen: (matter: Matter, tab: string, section?: PracticeSection) => void;
  onWork: () => void;
  onDeadlines: () => void;
  onAgenda: () => void;
  onMatters: () => void;
}) {
  const [sources, setSources] = useState<DashboardSources>({
    dashboard: null,
    work: null,
    alerts: null,
    practice: null,
  });
  const [errors, setErrors] = useState<string[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [expanded, setExpanded] = useState(false),
    [refresh, setRefresh] = useState(0),
    [refreshing, setRefreshing] = useState(true),
    [updated, setUpdated] = useState(new Date()),
    [busyAlert, setBusyAlert] = useState(""),
    [actionError, setActionError] = useState("");
  const generation = useRef(0),
    acknowledging = useRef(false);
  useEffect(() => {
    let alive = true,
      loading = false;
    const load = async () => {
      if (
        loading ||
        acknowledging.current ||
        document.visibilityState === "hidden"
      )
        return;
      loading = true;
      const requested = generation.current;
      setRefreshing(true);
      const result = await Promise.allSettled([
        api<DashboardData>(`/firms/${firmId}/dashboard`),
        api<WorkBoardData>(`/firms/${firmId}/work${director ? "/team" : ""}`),
        api<DashboardAlert[]>(`/firms/${firmId}/deadline-inbox`, {}),
        api<PracticeView>(`/firms/${firmId}/practice`),
      ]);
      if (alive && requested === generation.current) {
        const [dashboard, work, alerts, practice] = result;
        setSources((previous) => ({
          dashboard:
            dashboard.status === "fulfilled"
              ? dashboard.value
              : previous.dashboard,
          work: work.status === "fulfilled" ? work.value : previous.work,
          alerts:
            alerts.status === "fulfilled" ? alerts.value : previous.alerts,
          practice:
            practice.status === "fulfilled"
              ? practice.value
              : previous.practice,
        }));
        setErrors(
          result.flatMap((r, i) =>
            r.status === "rejected"
              ? [["revisiones", "trabajo y plazos", "avisos", "agenda"][i]!]
              : [],
          ),
        );
        setUpdated(new Date());
        setRefreshing(false);
      }
      loading = false;
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    const update = () => void load();
    window.addEventListener("focus", update);
    window.addEventListener("law-order-work-changed", update);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("law-order-work-changed", update);
    };
  }, [firmId, actorId, director, refresh]);
  const overview = dashboardOverview(sources, matters, updated),
    selectedMetric = overview.metrics.find((m) => m.id === selected);
  const items = selectedMetric?.records ?? overview.priorities;
  const matterName = (id: string) =>
    matters.find((m) => m.id === id)?.title ?? "Asunto autorizado";
  const openItem = (item: DashboardItem) => {
    const matter = matters.find((m) => m.id === item.matterId);
    if (matter) onOpen(matter, item.tab);
    else onDeadlines();
  };
  async function acknowledge(entry: DashboardAlert) {
    acknowledging.current = true;
    generation.current++;
    setBusyAlert(entry.alert.id);
    setActionError("");
    try {
      await api(
        `/firms/${firmId}/matters/${entry.matter_id}/deadlines/${entry.task_id}/acknowledgement`,
        { alert_id: entry.alert.id },
      );
      setSources((current) => ({
        ...current,
        alerts:
          current.alerts?.filter((a) => a.alert.id !== entry.alert.id) ?? null,
      }));
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      acknowledging.current = false;
      setBusyAlert("");
      setRefresh((n) => n + 1);
    }
  }
  return (
    <div className="director-dashboard dashboard-overview">
      <header className="dashboard-control-header">
        <div>
          <span className="eyebrow">
            {director ? "CONTROL DEL DESPACHO" : "MI TRABAJO"}
          </span>
          <h2>
            {new Intl.DateTimeFormat("es-PY", {
              timeZone: "America/Asuncion",
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(updated)}
          </h2>
        </div>
        <div>
          <span className="dashboard-updated">
            {refreshing
              ? "Actualizando…"
              : errors.length
                ? "Actualización incompleta"
                : `Actualizado ${time(updated.toISOString())} · Paraguay`}
          </span>
          <button
            className="text-action"
            disabled={refreshing}
            onClick={() => setRefresh((n) => n + 1)}
          >
            Actualizar
          </button>
          <button onClick={onAgenda}>Abrir agenda</button>
        </div>
      </header>
      {!!errors.length && (
        <p role="alert" className="dashboard-refresh-warning">
          No se pudieron actualizar: {errors.join(", ")}. Reintentá para
          completar el resumen.{" "}
          <button onClick={() => setRefresh((n) => n + 1)}>Reintentar</button>
        </p>
      )}
      <section
        className="dashboard-deadline-kpis"
        aria-label="Indicadores y avisos del despacho"
      >
        {overview.metrics.map((metric) => (
          <button
            key={metric.id}
            className="dashboard-operational-kpi"
            data-tone={metric.tone}
            data-attention={!!metric.records?.length}
            aria-pressed={selected === metric.id}
            disabled={!metric.records}
            onClick={() => {
              setSelected(selected === metric.id ? null : metric.id);
              setExpanded(false);
            }}
          >
            <span>{metric.label}</span>
            <strong>
              {metric.records
                ? metric.records.length
                : refreshing
                  ? "—"
                  : "N/D"}
            </strong>
            <small>
              {metric.detail}
              <i aria-hidden="true">↗</i>
            </small>
          </button>
        ))}
      </section>
      <div className="dashboard-office-totals">
        <button onClick={onMatters}>
          <strong>{overview.openMatters.length}</strong> asuntos abiertos
        </button>
        <button onClick={onWork}>
          <strong>{sources.work ? overview.pending : "—"}</strong> pendientes
          asignados
        </button>
        <button onClick={onAgenda}>
          <strong>
            {sources.practice ? overview.appointments.length : "—"}
          </strong>{" "}
          citas hoy
        </button>
        {director && (
          <button onClick={onWork}>
            <strong>{sources.work ? overview.requests.length : "—"}</strong>{" "}
            solicitudes a Dirección
          </button>
        )}
      </div>
      <div className="dashboard-operations-grid">
        <section
          className="dashboard-action-panel"
          aria-label="Prioridades del despacho"
        >
          <header>
            <div>
              <span className="eyebrow">
                {errors.length
                  ? "El resumen está incompleto"
                  : selectedMetric
                    ? "DETALLE DEL INDICADOR"
                    : "ATENCIÓN PRIORITARIA"}
              </span>
              <h3>
                {selectedMetric?.label ??
                  (director
                    ? "Lo que requiere una decisión"
                    : "Tus prioridades")}
                <span>{items.length}</span>
              </h3>
            </div>
            {selectedMetric ? (
              <button
                className="text-action"
                onClick={() => {
                  setSelected(null);
                  setExpanded(false);
                }}
              >
                Ver prioridades
              </button>
            ) : (
              <button className="text-action" onClick={onDeadlines}>
                Ver plazos →
              </button>
            )}
          </header>
          {!sources.work && !sources.alerts && refreshing ? (
            <p role="status" className="dashboard-panel-empty">
              Cargando pendientes autorizados…
            </p>
          ) : !items.length ? (
            <div className="dashboard-panel-empty">
              <span aria-hidden="true">✓</span>
              <strong>
                {selectedMetric
                  ? "Sin registros en este indicador"
                  : "Sin pendientes urgentes registrados"}
              </strong>
              <p>
                La agenda y los asuntos siguen disponibles para continuar el
                trabajo.
              </p>
            </div>
          ) : (
            <div className="dashboard-action-list">
              {items.slice(0, expanded ? undefined : 6).map((item) => (
                <article key={item.id} data-tone={item.tone}>
                  <span className="dashboard-priority-dot" aria-hidden="true" />
                  <button
                    className="dashboard-priority-link"
                    onClick={() => openItem(item)}
                  >
                    <strong>{item.title}</strong>
                    <small>
                      {matterName(item.matterId)}
                      {item.person ? ` · ${item.person}` : ""}
                    </small>
                    <span>
                      {item.category}
                      {item.due ? ` · ${dateTime(item.due)}` : ""}
                    </span>
                  </button>
                  {item.alert ? (
                    <button
                      className="dashboard-acknowledge"
                      disabled={!!busyAlert}
                      onClick={() => void acknowledge(item.alert!)}
                    >
                      {busyAlert === item.alert.alert.id
                        ? "Guardando…"
                        : "Reconocer"}
                    </button>
                  ) : (
                    <span className="dashboard-row-arrow" aria-hidden="true">
                      ↗
                    </span>
                  )}
                </article>
              ))}
            </div>
          )}
          {items.length > 6 && (
            <button
              className="text-action dashboard-show-more"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? "Mostrar menos"
                : `Ver los ${items.length} pendientes`}
            </button>
          )}
          {selected === "alerts" && !!items.length && (
            <p className="dashboard-ack-note">
              Reconocer un aviso no completa el plazo.
            </p>
          )}
          {actionError && (
            <p role="alert" className="error">
              {actionError}
            </p>
          )}
        </section>
        <section className="dashboard-agenda-panel">
          <header>
            <div>
              <span className="eyebrow">AGENDA DE HOY</span>
              <h3>Reuniones y compromisos</h3>
            </div>
            <button className="text-action" onClick={onAgenda}>
              Abrir →
            </button>
          </header>
          {!sources.practice ? (
            <p className="dashboard-panel-empty">
              {refreshing ? "Cargando agenda…" : "Agenda no disponible"}
            </p>
          ) : overview.appointments.length ? (
            <div className="dashboard-today-list">
              {overview.appointments.slice(0, 4).map((a) => (
                <button key={a.id} onClick={onAgenda}>
                  <time>
                    {time(a.starts_at)}
                    <small>{time(a.ends_at)}</small>
                  </time>
                  <span>
                    <strong>{a.title}</strong>
                    <small>{a.person}</small>
                    <small>{a.location || "Sin lugar indicado"}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dashboard-panel-empty">
              <strong>Sin citas programadas para hoy</strong>
              <p>Podés reservar un horario directamente en la agenda.</p>
              <button onClick={onAgenda}>Ver calendario</button>
            </div>
          )}
          {overview.appointments.length > 4 && (
            <button
              className="text-action dashboard-show-more"
              onClick={onAgenda}
            >
              Ver las {overview.appointments.length} citas de hoy
            </button>
          )}
        </section>
        <section className="dashboard-cases-panel">
          <header>
            <div>
              <span className="eyebrow">ASUNTOS EN CURSO</span>
              <h3>Próximos pasos por asunto</h3>
            </div>
            <button className="text-action" onClick={onMatters}>
              Ver todos →
            </button>
          </header>
          <div className="dashboard-case-list">
            {overview.openMatters
              .slice(0, 4)
              .map(({ matter, next, pending, person }) => (
                <button
                  key={matter.id}
                  onClick={() => onOpen(matter, next ? "tasks" : "documents")}
                >
                  <span className="dashboard-case-mark" aria-hidden="true">
                    {matter.title.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{matter.title}</strong>
                    <small>
                      {
                        clients.find((c) => c.id === matter.client_id)
                          ?.display_name
                      }{" "}
                      · {person}
                    </small>
                    <span>
                      {next
                        ? `${next.title} · ${dateTime(next.internal_due_at!)}`
                        : "Sin próximo plazo confirmado"}
                    </span>
                  </span>
                  <small>{sources.work ? pending : "—"} pendientes</small>
                </button>
              ))}
            {!overview.openMatters.length && (
              <p className="dashboard-panel-empty">
                Los asuntos abiertos aparecerán aquí.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
