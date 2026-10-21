import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type {
  OfficeCalendarEvent,
  OfficeCalendarMode,
} from "./office-metrics.js";
import {
  calendarDays,
  shiftDay,
  monthWindow,
  eventOnDay,
} from "./office-metrics.js";
import { asuncionDate } from "./local-dates.js";
import { AgendaSelect } from "./AgendaInputs.js";
import { useCalendarGestures } from "./useCalendarGestures.js";
import type { CalendarRange } from "./calendar-reschedule.js";
const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-PY", { timeZone: "UTC", ...options }).format(
    new Date(day + "T12:00:00Z"),
  );
const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
const kindLabel = {
  appointment: "Reuniones",
  deadline: "Plazos",
  task: "Tareas",
};
export default function OfficeCalendar({
  events,
  loading,
  error,
  onCreate,
  onSelect,
  professionals,
  person,
  onPerson,
  onReschedule,
}: {
  events: OfficeCalendarEvent[];
  loading: boolean;
  error: string;
  onCreate: (day: string, time?: string) => void;
  onSelect: (event: OfficeCalendarEvent) => void;
  professionals: { id: string; name: string }[];
  person: string;
  onPerson: (id: string) => void;
  onReschedule: (
    event: OfficeCalendarEvent,
    range: CalendarRange,
  ) => Promise<void>;
}) {
  const today = asuncionDate(),
    [anchor, setAnchor] = useState(today),
    [mode, setMode] = useState<OfficeCalendarMode>("week"),
    [focusedSlot, setFocusedSlot] = useState(20),
    [sources, setSources] = useState({
      appointment: true,
      deadline: true,
      task: true,
    });
  const scroll = useRef<HTMLDivElement>(null),
    root = useRef<HTMLDivElement>(null);
  const gestures = useCalendarGestures({ root, scroll, mode, onReschedule });
  const visibleEvents = gestures.draft
    ? events.map((e) =>
        e.id === gestures.draft!.id
          ? { ...e, start: gestures.draft!.start, end: gestures.draft!.end }
          : e,
      )
    : events;
  function moveKeys(event: OfficeCalendarEvent, e: KeyboardEvent) {
    if (
      !event.editable ||
      !e.altKey ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    gestures.keyboard(
      event,
      "move",
      e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0,
      e.key === "ArrowUp" ? -15 : e.key === "ArrowDown" ? 15 : 0,
    );
  }
  useEffect(() => {
    if (mode !== "month" && scroll.current) scroll.current.scrollTop = 7 * 52;
  }, [mode]);
  const days = calendarDays(anchor, mode),
    mini = calendarDays(anchor, "month"),
    filtered = visibleEvents.filter((e) => sources[e.kind]);
  const dayEvents = (day: string) =>
    filtered
      .filter((e) => eventOnDay(e, day, (iso) => asuncionDate(new Date(iso))))
      .sort((a, b) => a.start.localeCompare(b.start));
  const advance = (step: number) =>
    setAnchor(
      mode === "month"
        ? monthWindow(anchor.slice(0, 7), step) + "-01"
        : shiftDay(anchor, step * (mode === "week" ? 7 : 1)),
    );
  const period =
    mode === "month"
      ? dateLabel(anchor, { month: "long", year: "numeric" })
      : mode === "day"
        ? dateLabel(anchor, { weekday: "long", day: "numeric", month: "long" })
        : `${dateLabel(days[0]!, { day: "numeric", month: "short" })} – ${dateLabel(days.at(-1)!, { day: "numeric", month: "short", year: "numeric" })}`;
  return (
    <div
      ref={root}
      className={"study-calendar" + (gestures.draft ? " is-rescheduling" : "")}
      onClickCapture={(e) => {
        if (gestures.suppressClick()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <aside className="calendar-sidebar">
        <button
          className="primary calendar-create"
          onClick={() => onCreate(anchor)}
        >
          + Nueva actividad
        </button>
        <header>
          <strong>
            {dateLabel(anchor, { month: "long", year: "numeric" })}
          </strong>
          <div>
            <button
              aria-label="Mes anterior en calendario pequeño"
              onClick={() =>
                setAnchor(monthWindow(anchor.slice(0, 7), -1) + "-01")
              }
            >
              ‹
            </button>
            <button
              aria-label="Mes siguiente en calendario pequeño"
              onClick={() =>
                setAnchor(monthWindow(anchor.slice(0, 7), 1) + "-01")
              }
            >
              ›
            </button>
          </div>
        </header>
        <div className="mini-calendar" aria-label="Elegir fecha">
          {["L", "M", "X", "J", "V", "S", "D"].map((l, i) => (
            <span key={i}>{l}</span>
          ))}
          {mini.map((day) => (
            <button
              key={day}
              className={
                (day === today ? "is-today " : "") +
                (day === anchor ? "is-selected " : "") +
                (day.slice(0, 7) !== anchor.slice(0, 7) ? "other-month" : "")
              }
              aria-label={dateLabel(day, { dateStyle: "full" })}
              aria-pressed={day === anchor}
              onClick={() => setAnchor(day)}
            >
              {Number(day.slice(-2))}
            </button>
          ))}
        </div>
        <div className="calendar-sources">
          <h3>Calendarios del estudio</h3>
          {(["appointment", "deadline", "task"] as const).map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={sources[kind]}
                onChange={(e) =>
                  setSources((v) => ({ ...v, [kind]: e.target.checked }))
                }
              />
              <i data-kind={kind} />
              {kindLabel[kind]}
              <span>{events.filter((e) => e.kind === kind).length}</span>
            </label>
          ))}
        </div>
        {professionals.length > 1 && (
          <AgendaSelect
            label="Profesional"
            value={person}
            onChange={onPerson}
            options={[
              { value: "", label: "Todo el equipo" },
              ...professionals.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        )}
        <div className="calendar-today">
          <span className="eyebrow">
            {anchor === today ? "HOY" : "DÍA SELECCIONADO"}
          </span>
          <strong>
            {dateLabel(anchor, { day: "numeric", month: "long" })}
          </strong>
          {dayEvents(anchor).length ? (
            dayEvents(anchor)
              .slice(0, 4)
              .map((e) => (
                <button key={e.id} onClick={() => onSelect(e)}>
                  <time>{timeLabel(e.start)}</time>
                  <span>{e.title}</span>
                </button>
              ))
          ) : (
            <p>Sin actividades programadas.</p>
          )}
        </div>
        <small>Horario de Paraguay · America/Asuncion</small>
      </aside>
      <section className="calendar-main" aria-label="Calendario del estudio">
        <header className="calendar-toolbar">
          <div>
            <button onClick={() => setAnchor(today)}>Hoy</button>
            <button aria-label="Período anterior" onClick={() => advance(-1)}>
              ‹
            </button>
            <button aria-label="Período siguiente" onClick={() => advance(1)}>
              ›
            </button>
            <h2>{period}</h2>
          </div>
          <nav aria-label="Vista del calendario">
            {(["month", "week", "day"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {{ month: "Mes", week: "Semana", day: "Día" }[value]}
              </button>
            ))}
          </nav>
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {loading && <p role="status">Actualizando calendario…</p>}
        {(gestures.draft || gestures.notice || gestures.error) && (
          <div
            className="calendar-gesture-feedback"
            data-error={!!gestures.error}
          >
            {gestures.error ? (
              <span role="alert">{gestures.error}</span>
            ) : (
              <span role="status" aria-live="polite">
                {gestures.draft && !gestures.saving
                  ? `${dateLabel(asuncionDate(new Date(gestures.draft.start)), { weekday: "short", day: "numeric", month: "short" })} · ${timeLabel(gestures.draft.start)} – ${timeLabel(gestures.draft.end)} · ${gestures.draft.valid ? "Soltá para guardar · Esc cancela" : "Fuera del calendario · soltá para cancelar"}`
                  : gestures.notice}
              </span>
            )}
          </div>
        )}
        {mode === "month" ? (
          <div className="month-calendar">
            <div className="month-weekdays">
              {[
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
                "Domingo",
              ].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="month-cells">
              {days.map((day) => (
                <section
                  key={day}
                  data-month-day={day}
                  className={
                    (day.slice(0, 7) !== anchor.slice(0, 7)
                      ? "other-month "
                      : "") + (day === today ? "today-cell" : "")
                  }
                  aria-label={dateLabel(day, { dateStyle: "full" })}
                  tabIndex={0}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    setAnchor(day);
                    setMode("day");
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      setAnchor(day);
                      setMode("day");
                    }
                  }}
                >
                  <header>
                    <button
                      className={day === today ? "today-number" : ""}
                      onClick={() => {
                        setAnchor(day);
                        setMode("day");
                      }}
                      aria-label={`Ver ${dateLabel(day, { dateStyle: "full" })}`}
                    >
                      {Number(day.slice(-2))}
                    </button>
                  </header>
                  {dayEvents(day)
                    .slice(0, 3)
                    .map((e) => (
                      <button
                        className="month-event"
                        key={e.id}
                        data-kind={e.kind}
                        data-pending={e.pendingConfirmation ?? false}
                        data-editable={e.editable ?? false}
                        data-gesture={gestures.draft?.id === e.id}
                        onPointerDown={(pointer) =>
                          gestures.begin(e, day, "move", pointer)
                        }
                        onKeyDown={(key) => moveKeys(e, key)}
                        aria-keyshortcuts={
                          e.editable
                            ? "Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
                            : undefined
                        }
                        title={
                          e.title +
                          (e.pendingConfirmation
                            ? " - pendiente de confirmacion"
                            : "")
                        }
                        onClick={() => onSelect(e)}
                      >
                        <time>{timeLabel(e.start)}</time>
                        {e.title}
                      </button>
                    ))}
                  {dayEvents(day).length > 3 && (
                    <button
                      className="calendar-more"
                      onClick={() => {
                        setAnchor(day);
                        setMode("day");
                      }}
                    >
                      +{dayEvents(day).length - 3} más
                    </button>
                  )}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="calendar-scroll" ref={scroll}>
            <div
              className="time-calendar"
              style={{
                gridTemplateColumns: `50px repeat(${days.length},minmax(${mode === "day" ? "220" : "90"}px,1fr))`,
              }}
            >
              <div className="time-corner">PY</div>
              {days.map((day) => (
                <header className="time-day-heading" key={day}>
                  <button
                    onClick={() => {
                      setAnchor(day);
                      if (mode === "week") setMode("day");
                    }}
                  >
                    <span>{dateLabel(day, { weekday: "short" })}</span>
                    <strong className={day === today ? "today-number" : ""}>
                      {Number(day.slice(-2))}
                    </strong>
                  </button>
                </header>
              ))}
              <div className="time-axis">
                {Array.from({ length: 24 }, (_, hour) => (
                  <span style={{ top: hour * 52 }} key={hour}>
                    {String(hour).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {days.map((day) => (
                <div
                  className="time-day"
                  key={day}
                  data-time-day={day}
                  aria-label={`Actividades del ${day}`}
                >
                  <div
                    className="calendar-time-slots"
                    role="group"
                    aria-label={`Reservar horario el ${day}`}
                  >
                    {Array.from({ length: 48 }, (_, index) => {
                      const time = `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
                      return (
                        <button
                          type="button"
                          key={time}
                          className="calendar-time-slot"
                          aria-label={`Reservar el ${day} a las ${time}`}
                          tabIndex={index === focusedSlot ? 0 : -1}
                          onFocus={() => setFocusedSlot(index)}
                          onClick={() => onCreate(day, time)}
                          onKeyDown={(e) => {
                            if (
                              !["ArrowDown", "ArrowUp", "Home", "End"].includes(
                                e.key,
                              )
                            )
                              return;
                            e.preventDefault();
                            const next =
                              e.key === "Home"
                                ? 0
                                : e.key === "End"
                                  ? 47
                                  : Math.max(
                                      0,
                                      Math.min(
                                        47,
                                        index +
                                          (e.key === "ArrowDown" ? 1 : -1),
                                      ),
                                    );
                            e.currentTarget.parentElement
                              ?.querySelectorAll<HTMLButtonElement>("button")
                              [next]?.focus();
                          }}
                        >
                          <span>+ {time}</span>
                        </button>
                      );
                    })}
                  </div>
                  {layoutDayEvents(dayEvents(day), day).map(
                    ({ event, top, height, lane, lanes }) => (
                      <div
                        key={event.id}
                        className="time-event-wrap"
                        data-gesture={gestures.draft?.id === event.id}
                        data-valid={
                          gestures.draft?.id !== event.id ||
                          gestures.draft.valid
                        }
                        data-saving={
                          gestures.saving && gestures.draft?.id === event.id
                        }
                        style={{
                          top,
                          height,
                          left: `calc(${(lane / lanes) * 100}% + 3px)`,
                          width: `calc(${100 / lanes}% - 6px)`,
                        }}
                      >
                        <button
                          className={
                            "time-event" + (height < 38 ? " is-short" : "")
                          }
                          data-kind={event.kind}
                          data-pending={event.pendingConfirmation ?? false}
                          data-editable={event.editable ?? false}
                          onPointerDown={(pointer) =>
                            gestures.begin(event, day, "move", pointer)
                          }
                          onKeyDown={(key) => moveKeys(event, key)}
                          aria-keyshortcuts={
                            event.editable
                              ? "Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
                              : undefined
                          }
                          title={
                            event.title +
                            (event.pendingConfirmation
                              ? " - pendiente de confirmacion"
                              : "")
                          }
                          onClick={() => onSelect(event)}
                        >
                          <time>
                            {timeLabel(event.start)}
                            {height > 38 ? ` – ${timeLabel(event.end)}` : ""}
                          </time>
                          <strong>{event.title}</strong>
                          {height > 58 && <span>{event.detail}</span>}
                          {event.pendingConfirmation && height > 40 && (
                            <small>Por confirmar</small>
                          )}
                        </button>
                        {event.editable &&
                          (["start", "end"] as const)
                            .filter(
                              (edge) =>
                                asuncionDate(
                                  new Date(
                                    Date.parse(
                                      edge === "start"
                                        ? event.start
                                        : event.end,
                                    ) - (edge === "end" ? 1 : 0),
                                  ),
                                ) === day,
                            )
                            .map((edge) => (
                              <button
                                type="button"
                                key={edge}
                                className={
                                  "calendar-resize-handle resize-" + edge
                                }
                                aria-label={`${edge === "start" ? "Ajustar inicio" : "Cambiar duración"} de ${event.title}`}
                                title={
                                  edge === "start"
                                    ? "Arrastrá para ajustar el inicio"
                                    : "Arrastrá para cambiar la duración"
                                }
                                onPointerDown={(pointer) =>
                                  gestures.begin(event, day, edge, pointer)
                                }
                                onClick={(click) => click.stopPropagation()}
                                onKeyDown={(key) => {
                                  if (
                                    !["ArrowUp", "ArrowDown"].includes(key.key)
                                  )
                                    return;
                                  key.preventDefault();
                                  gestures.keyboard(
                                    event,
                                    edge,
                                    0,
                                    key.key === "ArrowUp" ? -15 : 15,
                                  );
                                }}
                              >
                                <span aria-hidden="true" />
                              </button>
                            ))}
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <footer className="calendar-footer">
          <span>
            <i data-kind="appointment" />
            Reuniones
          </span>
          <span>
            <i data-kind="deadline" />
            Plazos
          </span>
          <span>
            <i data-kind="task" />
            Tareas
          </span>
          <small>
            {mode === "month"
              ? "Arrastrá una cita a otro día. Elegí un día para ver sus horarios."
              : "Clic para reservar · arrastrá una cita para moverla · estirá sus bordes para cambiar la duración."}
          </small>
        </footer>
      </section>
    </div>
  );
}
export function layoutDayEvents(events: OfficeCalendarEvent[], day: string) {
  const minutes = (iso: string) => {
    const current = asuncionDate(new Date(iso));
    if (current < day) return 0;
    if (current > day) return 1440;
    const [h, m] = timeLabel(iso).split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const blocks = events
    .map((event) => ({
      event,
      start: minutes(event.start),
      end: Math.max(minutes(event.start) + 15, minutes(event.end)),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.start - b.start);
  let cluster: typeof blocks = [],
    ends: number[] = [];
  const finish = () => {
    for (const block of cluster) block.lanes = ends.length;
    cluster = [];
    ends = [];
  };
  for (const block of blocks) {
    if (cluster.length && Math.max(...ends) <= block.start) finish();
    let lane = ends.findIndex((end) => end <= block.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = block.end;
    block.lane = lane;
    cluster.push(block);
  }
  finish();
  return blocks.map((b) => ({
    ...b,
    top: (b.start / 60) * 52,
    height: Math.max(
      18,
      (Math.min(1440, b.end) / 60) * 52 - (b.start / 60) * 52 - 3,
    ),
  }));
}
