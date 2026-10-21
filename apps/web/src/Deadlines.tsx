import { useEffect, useRef, useState } from "react";
import type {
  Document,
  MatterParticipant,
  Membership,
  Task,
} from "../../../os-core/src/contracts.js";
import {
  calculateDeadline,
  currentDeadline,
  ScheduledTaskInputSchema,
  type DeadlineAlert,
  type DeadlineInput,
} from "../../../os-core/src/deadlines.js";
import { api, content, saveBlob } from "./api.js";
import { centralEnabled, accountProfiles } from "./platform-client.js";
import { Form } from "./components.js";
import "./deadlines.css";

const categories = {
  JUDICIAL: "Plazo judicial",
  CONTRACTUAL: "Plazo contractual",
  INTERNAL: "Fecha interna",
};
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const defaultDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function DeadlineForm({
  firmId,
  matterId,
  members,
  actorId,
  identityName,
  task,
  initialCategory = "INTERNAL",
  onClose,
  onSaved,
}: {
  firmId: string;
  matterId: string;
  members: Membership[];
  actorId: string;
  identityName: (id: string) => string;
  task?: Task;
  initialCategory?: DeadlineInput["category"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const current = task && currentDeadline(task);
  const [enabled, setEnabled] = useState(true),
    [category, setCategory] = useState<DeadlineInput["category"]>(
      current?.category ?? initialCategory,
    );
  const [responsible, setResponsible] = useState(
    task?.responsible_identity_id ?? actorId,
  );
  const [mode, setMode] = useState<"MANUAL" | "DAYS">(
    current?.rule.mode ?? "MANUAL",
  );
  const [date, setDate] = useState(
    current?.rule.mode === "MANUAL" ? current.rule.date : defaultDate(),
  );
  const [start, setStart] = useState(
    current?.rule.mode === "DAYS" ? current.rule.start_date : defaultDate(),
  );
  const [time, setTime] = useState(current?.rule.time ?? "17:00"),
    [days, setDays] = useState(
      current?.rule.mode === "DAYS" ? current.rule.days : 5,
    );
  const [dayType, setDayType] = useState<"CALENDAR" | "BUSINESS">(
    current?.rule.mode === "DAYS" ? current.rule.day_type : "CALENDAR",
  );
  const [include, setInclude] = useState(
    current?.rule.mode === "DAYS" ? current.rule.include_start : false,
  );
  const [excluded, setExcluded] = useState(
    current?.rule.mode === "DAYS" ? current.rule.excluded_dates.join("\n") : "",
  );
  const [reminders, setReminders] = useState(
    current?.reminders_hours.join(", ") ?? "72, 24",
  );
  const [escalation, setEscalation] = useState(
    current?.escalation_identity_id ?? "",
  );
  const [after, setAfter] = useState(current?.escalation_after_hours ?? 24);
  const [resources, setResources] = useState<{
    participants: MatterParticipant[];
    documents: Document[];
  }>();
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let alive = true;
    const base = `/firms/${firmId}/matters/${matterId}`;
    void Promise.all([
      api<MatterParticipant[]>(base + "/participants"),
      api<Document[]>(base + "/documents"),
    ])
      .then(([participants, documents]) => {
        if (alive) setResources({ participants, documents });
      })
      .catch((error) => {
        if (alive) setLoadError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [firmId, matterId]);
  const assignableMembers = centralEnabled()
    ? members.filter((m) =>
        accountProfiles().some((p) => p.active && p.id === m.identity_id),
      )
    : members;
  const eligible = assignableMembers.filter(
    (m) =>
      m.active &&
      (m.role === "ADMINISTRATOR" || m.role === "LAWYER") &&
      (members.some(
        (p) =>
          p.active && p.identity_id === actorId && p.role === "ADMINISTRATOR",
      ) ||
        m.identity_id === actorId) &&
      (m.role === "ADMINISTRATOR" ||
        resources?.participants.some(
          (p) =>
            p.active &&
            p.identity_id === m.identity_id &&
            p.permissions.includes("TASK_WRITE") &&
            p.permissions.includes("READ"),
        )),
  );
  const rule: DeadlineInput["rule"] =
    mode === "MANUAL"
      ? { mode, date, time }
      : {
          mode,
          start_date: start,
          time,
          days,
          day_type: dayType,
          include_start: include,
          excluded_dates: [
            ...new Set(excluded.split(/[\s,;]+/).filter(Boolean)),
          ],
          basis: "Vista previa",
        };
  const preview = (() => {
    try {
      return calculateDeadline({
        category,
        origin: "Vista previa",
        source_version_id: null,
        rule,
        reminders_hours: [],
        escalation_identity_id: null,
        escalation_after_hours: 24,
      });
    } catch {
      return null;
    }
  })();
  return (
    <Form
      title={task ? "Modificar plazo o responsable" : "Nueva tarea o plazo"}
      onClose={onClose}
      footerText="Guardado local · el plazo requiere confirmación humana"
      onSave={async (data) => {
        if (!resources)
          throw Error(
            loadError ||
              "Esperá a que se carguen las personas y documentos del asunto.",
          );
        const base = `/firms/${firmId}/matters/${matterId}`;
        if (!enabled && !task) {
          await api(base + "/tasks", {
            title: data.get("title"),
            responsible_identity_id: responsible,
            internal_due_at: null,
          });
        } else {
          const parsed = ScheduledTaskInputSchema.safeParse({
            title: data.get("title"),
            responsible_identity_id: responsible,
            deadline: {
              category,
              origin: data.get("origin"),
              source_version_id: data.get("source") || null,
              rule:
                mode === "DAYS" ? { ...rule, basis: data.get("basis") } : rule,
              reminders_hours: reminders.trim()
                ? reminders
                    .split(/[,;\s]+/)
                    .filter(Boolean)
                    .map(Number)
                : [],
              escalation_identity_id: escalation || null,
              escalation_after_hours: after,
            },
          });
          if (!parsed.success)
            throw Error(
              "Revisá el origen, las fechas, la cantidad de días y los avisos (horas enteras, sin repetir).",
            );
          if (task)
            await api(base + `/deadlines/${task.id}/revision`, {
              input: parsed.data,
              expected_revision: task.deadline?.revision ?? 0,
              reason: data.get("reason"),
            });
          else await api(base + "/deadlines", parsed.data);
        }
        onSaved();
      }}
    >
      <label className="field">
        <span>Próxima acción</span>
        <input
          name="title"
          defaultValue={task?.title}
          required
          maxLength={240}
        />
      </label>
      <label className="field">
        <span>Responsable</span>
        <select
          aria-label="Responsable"
          value={responsible}
          onChange={(e) => setResponsible(e.target.value)}
          required
        >
          <option value="">Elegir persona con acceso al asunto</option>
          {eligible.map((m) => (
            <option key={m.id} value={m.identity_id}>
              {identityName(m.identity_id)}
            </option>
          ))}
        </select>
      </label>
      {!task && (
        <label className="deadline-check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Registrar plazo con avisos
        </label>
      )}
      {enabled && (
        <div className="deadline-form-grid">
          <label className="field">
            <span>Tipo de plazo</span>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as DeadlineInput["category"])
              }
            >
              {Object.entries(categories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Forma de determinar la fecha</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "MANUAL" | "DAYS")}
            >
              <option value="MANUAL">Fecha expresa</option>
              <option value="DAYS">Contar días con calendario declarado</option>
            </select>
          </label>
          <label className="field deadline-wide">
            <span>Origen del plazo</span>
            <textarea
              name="origin"
              required
              maxLength={2000}
              defaultValue={current?.origin}
              placeholder="Notificación, cláusula, resolución o instrucción que origina el plazo…"
            />
          </label>
          <label className="field deadline-wide">
            <span>Documento de respaldo (opcional)</span>
            <select
              name="source"
              defaultValue={current?.source_version_id ?? ""}
            >
              <option value="">Sin documento vinculado</option>
              {current?.source_version_id &&
                !resources?.documents.some(
                  (d) => d.current_version_id === current.source_version_id,
                ) && (
                  <option value={current.source_version_id}>
                    Versión vinculada {current.source_version_id.slice(0, 8)}
                  </option>
                )}
              {resources?.documents
                .filter((d) => d.current_version_id)
                .map((d) => (
                  <option key={d.id} value={d.current_version_id!}>
                    {d.title} · versión {d.current_version_id!.slice(0, 8)}
                  </option>
                ))}
            </select>
          </label>
          {mode === "MANUAL" ? (
            <label className="field">
              <span>Fecha de vencimiento</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>Fecha del hecho inicial</span>
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Cantidad de días</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  required
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Días a contar</span>
                <select
                  value={dayType}
                  onChange={(e) =>
                    setDayType(e.target.value as "CALENDAR" | "BUSINESS")
                  }
                >
                  <option value="CALENDAR">Corridos</option>
                  <option value="BUSINESS">
                    Lunes a viernes + exclusiones indicadas
                  </option>
                </select>
              </label>
              <label className="deadline-check">
                <input
                  type="checkbox"
                  checked={include}
                  onChange={(e) => setInclude(e.target.checked)}
                />{" "}
                Incluir el día inicial
              </label>
              <label className="field deadline-wide">
                <span>
                  Fechas excluidas: feriados, feria o suspensión (AAAA-MM-DD)
                </span>
                <textarea
                  value={excluded}
                  onChange={(e) => setExcluded(e.target.value)}
                  placeholder="Una fecha por línea"
                />
              </label>
              <label className="field deadline-wide">
                <span>Fundamento del cómputo y del calendario</span>
                <textarea
                  name="basis"
                  required
                  maxLength={2000}
                  defaultValue={
                    current?.rule.mode === "DAYS" ? current.rule.basis : ""
                  }
                  placeholder="Regla aplicable y calendario utilizado. Las exclusiones deben cargarse expresamente."
                />
              </label>
            </>
          )}
          <label className="field">
            <span>Hora límite · Paraguay</span>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <output className="deadline-preview deadline-wide">
            {preview
              ? preview.calculation
              : "Completá fechas y calendario para ver el resultado."}
          </output>
          <label className="field">
            <span>Avisar antes (horas, separadas por coma)</span>
            <input
              value={reminders}
              onChange={(e) => setReminders(e.target.value)}
              placeholder="72, 24"
            />
          </label>
          <label className="field">
            <span>Escalar vencimiento a</span>
            <select
              aria-label="Escalar vencimiento a"
              value={escalation}
              onChange={(e) => setEscalation(e.target.value)}
            >
              <option value="">Sin escalamiento</option>
              {assignableMembers
                .filter(
                  (m) =>
                    m.active &&
                    m.identity_id !== responsible &&
                    (m.role === "ADMINISTRATOR" ||
                      (m.identity_id === current?.escalation_identity_id &&
                        resources?.participants.some(
                          (p) =>
                            p.active &&
                            p.identity_id === m.identity_id &&
                            p.permissions.includes("READ"),
                        ))),
                )
                .map((m) => (
                  <option key={m.id} value={m.identity_id}>
                    {identityName(m.identity_id)}
                  </option>
                ))}
            </select>
          </label>
          {escalation && (
            <label className="field">
              <span>Escalar después de vencido (horas)</span>
              <input
                type="number"
                required
                min={1}
                max={8760}
                value={after}
                onChange={(e) => setAfter(Number(e.target.value))}
              />
            </label>
          )}
          {task && (
            <label className="field deadline-wide">
              <span>Motivo del cambio</span>
              <textarea name="reason" required maxLength={2000} />
            </label>
          )}
          <p className="scope-note deadline-wide">
            Se guarda como pendiente de confirmación. Revisá el origen, la regla
            y el calendario antes de activar avisos.{" "}
            {centralEnabled()
              ? "Se entregan dentro del OS; el servidor debe estar encendido."
              : "Modo de prueba: los avisos se evalúan al abrir Mi día o Agenda. Activá cuentas y centralización en Administración para generarlos sin el navegador abierto."}
          </p>
        </div>
      )}
      {loadError && <p role="alert">{loadError}</p>}
    </Form>
  );
}

export function DeadlineDetails({
  task,
  identityName,
  onChanged,
  onEdit,
  canConfirm,
  canEdit,
}: {
  task: Task;
  identityName: (id: string) => string;
  onChanged: () => void;
  onEdit?: (task: Task) => void;
  canConfirm: boolean;
  canEdit: boolean;
}) {
  const current = currentDeadline(task);
  const [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await api(
        `/firms/${task.law_firm_id}/matters/${task.matter_id}/deadlines/${task.id}/confirmation`,
        { expected_revision: task.deadline!.revision },
      );
      onChanged();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openSource = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await content(
        `/firms/${task.law_firm_id}/matters/${task.matter_id}/tasks/${task.id}/deadline-source`,
      );
      const extension =
        blob.type === "application/pdf"
          ? "pdf"
          : blob.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ? "docx"
            : blob.type === "text/html"
              ? "html"
              : "txt";
      saveBlob(blob, `respaldo-del-plazo.${extension}`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!current)
    return canEdit &&
      onEdit &&
      task.kind === "INTERNAL" &&
      task.status === "PENDING" ? (
      <button className="text-action" onClick={() => onEdit(task)}>
        Modificar encargo
      </button>
    ) : null;
  return (
    <details className="deadline-details">
      <summary>
        {categories[current.category]} ·{" "}
        {current.confirmed_at ? "Confirmado" : "Pendiente de confirmación"} ·
        revisar
      </summary>
      <dl>
        <div>
          <dt>Responsable</dt>
          <dd>{identityName(task.responsible_identity_id)}</dd>
        </div>
        <div>
          <dt>Origen</dt>
          <dd>{current.origin}</dd>
        </div>
        <div>
          <dt>Cómputo</dt>
          <dd>{current.calculation}</dd>
        </div>
        {current.rule.mode === "DAYS" && (
          <>
            <div>
              <dt>Fundamento</dt>
              <dd>{current.rule.basis}</dd>
            </div>
            <div>
              <dt>Exclusiones</dt>
              <dd>
                {current.rule.excluded_dates.join(", ") || "Ninguna declarada"}
              </dd>
            </div>
          </>
        )}
        {current.source_version_id && (
          <div>
            <dt>Respaldo</dt>
            <dd>
              <button disabled={busy} onClick={() => void openSource()}>
                Descargar versión de respaldo
              </button>{" "}
              · {current.source_version_id.slice(0, 8)}
            </dd>
          </div>
        )}
        <div>
          <dt>Avisos</dt>
          <dd>
            {current.reminders_hours.length
              ? current.reminders_hours.join(", ") + " horas antes"
              : "Solo al vencer"}
          </dd>
        </div>
        <div>
          <dt>Escalamiento</dt>
          <dd>
            {current.escalation_identity_id
              ? `${identityName(current.escalation_identity_id)} · ${current.escalation_after_hours} h después del vencimiento, si sigue pendiente`
              : "Sin destinatario"}
          </dd>
        </div>
        {current.confirmed_at && (
          <div>
            <dt>Confirmación</dt>
            <dd>
              {identityName(current.confirmed_by!)} ·{" "}
              {dateTime(current.confirmed_at)}
            </dd>
          </div>
        )}
      </dl>
      {!current.confirmed_at && task.status === "PENDING" && canConfirm && (
        <div className="deadline-confirm">
          <label className="deadline-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />{" "}
            Revisé el origen, el calendario y el vencimiento
          </label>
          <button disabled={!checked || busy} onClick={() => void confirm()}>
            Confirmar plazo y activar avisos
          </button>
        </div>
      )}
      {canEdit && onEdit && task.status === "PENDING" && (
        <button onClick={() => onEdit(task)}>
          Modificar plazo / responsable
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <details>
        <summary>
          Historial · {task.deadline!.versions.length} versiones
        </summary>
        {[...task.deadline!.versions].reverse().map((v) => (
          <p key={v.revision}>
            <strong>
              v{v.revision} · {dateTime(v.due_at)}
            </strong>
            <br />
            {v.change_reason} · {identityName(v.recorded_by)} ·{" "}
            {identityName(v.responsible_identity_id)} ·{" "}
            {v.confirmed_at ? "Confirmada" : "Sin confirmar"}
          </p>
        ))}
      </details>
      <details>
        <summary>Registro de avisos · {task.deadline!.alerts.length}</summary>
        {task.deadline!.alerts.map((a) => (
          <p key={a.id}>
            v{a.revision} ·{" "}
            {a.kind === "ESCALATION"
              ? "Escalamiento"
              : a.kind === "OVERDUE"
                ? "Vencimiento"
                : "Recordatorio"}{" "}
            · {identityName(a.recipient_id)}
            <br />
            {a.acknowledged_at
              ? `Reconocido ${dateTime(a.acknowledged_at)}`
              : a.presented_at
                ? `Entregado en bandeja ${dateTime(a.presented_at)}`
                : a.blocked_at && !a.released_at
                  ? "Bloqueado: destinatario sin acceso"
                  : "Generado · pendiente de entrega en bandeja"}
          </p>
        ))}
        {!task.deadline!.alerts.length && (
          <p>Todavía no se generaron avisos.</p>
        )}
      </details>
    </details>
  );
}

type InboxEntry = {
  task_id: string;
  matter_id: string;
  title: string;
  due_at: string;
  alert: DeadlineAlert;
};
export function DeadlineInbox({
  firmId,
  onOpen,
}: {
  firmId: string;
  onOpen: (matterId: string) => void;
}) {
  const [entries, setEntries] = useState<InboxEntry[]>([]),
    [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const generation = useRef(0),
    acknowledging = useRef(false);
  useEffect(() => {
    let alive = true,
      running = false;
    const load = async () => {
      if (
        running ||
        acknowledging.current ||
        document.visibilityState === "hidden"
      )
        return;
      running = true;
      const requestedGeneration = generation.current;
      try {
        const result = await api<InboxEntry[]>(
          `/firms/${firmId}/deadline-inbox`,
          {},
        );
        if (alive && requestedGeneration === generation.current) {
          setEntries(result);
          setError("");
        }
      } catch (cause) {
        if (alive) setError((cause as Error).message);
      } finally {
        running = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [firmId]);
  const acknowledge = async (entry: InboxEntry) => {
    acknowledging.current = true;
    generation.current++;
    setBusy(entry.alert.id);
    setError("");
    try {
      await api(
        `/firms/${firmId}/matters/${entry.matter_id}/deadlines/${entry.task_id}/acknowledgement`,
        { alert_id: entry.alert.id },
      );
      setEntries((items) => items.filter((i) => i.alert.id !== entry.alert.id));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      acknowledging.current = false;
      setBusy(undefined);
    }
  };
  return (
    <section className="deadline-inbox" aria-label="Avisos de plazos">
      <h3>
        Avisos de plazos <span>{entries.length}</span>
      </h3>
      {entries.length ? (
        entries.map((entry) => (
          <article key={entry.alert.id} data-tone={entry.alert.kind}>
            <div>
              <strong>
                {entry.alert.kind === "ESCALATION"
                  ? "Requiere seguimiento"
                  : entry.alert.kind === "OVERDUE"
                    ? "Plazo vencido"
                    : "Próximo vencimiento"}
              </strong>
              <button
                className="text-action"
                onClick={() => onOpen(entry.matter_id)}
              >
                {entry.title} →
              </button>
              <small>{dateTime(entry.due_at)}</small>
            </div>
            <button disabled={!!busy} onClick={() => void acknowledge(entry)}>
              Reconocer aviso
            </button>
          </article>
        ))
      ) : (
        <p className="muted">
          Sin avisos pendientes. Los plazos confirmados aparecen aquí cuando
          corresponde.
        </p>
      )}
      {!!entries.length && (
        <small>
          Reconocer un aviso no completa la tarea ni detiene el escalamiento.
        </small>
      )}
      {error && (
        <p role="alert">No se pudieron actualizar los avisos: {error}</p>
      )}
    </section>
  );
}
