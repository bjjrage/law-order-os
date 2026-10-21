import { useEffect, useId, useRef, useState } from "react";
import { calendarDays, monthWindow } from "./office-metrics.js";

const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-PY", { timeZone: "UTC", ...options }).format(
    new Date(day + "T12:00:00Z"),
  );

export function AgendaSelect({
  label,
  name,
  value,
  defaultValue = "",
  onChange,
  options,
}: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [localValue, setLocalValue] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const selected = value ?? localValue;
  const filtered = options.filter((o) =>
    o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="agenda-select"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          const items = [
            ...root.current!.querySelectorAll<HTMLButtonElement>(
              '[role="option"]',
            ),
          ];
          const current = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          items[
            (current + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length
          ]?.focus();
        }
      }}
    >
      <span id={id + "-label"}>{label}</span>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        ref={trigger}
        type="button"
        className="agenda-select-trigger"
        role="combobox"
        aria-labelledby={id + "-label"}
        aria-expanded={open}
        aria-controls={id + "-list"}
        aria-haspopup="listbox"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (!open && ["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>
          {options.find((o) => o.value === selected)?.label ?? "Elegir"}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="agenda-select-popover">
          {options.length > 7 && (
            <input
              aria-label={`Buscar ${label.toLocaleLowerCase()}`}
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div id={id + "-list"} role="listbox" aria-labelledby={id + "-label"}>
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={selected === o.value}
                onClick={() => {
                  setLocalValue(o.value);
                  onChange?.(o.value);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <span>{o.label}</span>
                {selected === o.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
            {!filtered.length && <p>Sin coincidencias</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function shiftScheduleStart(start: string, end: string, next: string) {
  const duration = Math.max(
    15 * 60000,
    Date.parse(end + "Z") - Date.parse(start + "Z"),
  );
  return {
    start: next,
    end: new Date(Date.parse(next + "Z") + duration).toISOString().slice(0, 16),
  };
}

export function AgendaSchedule({
  initialStart,
  initialEnd,
}: {
  initialStart: string;
  initialEnd: string;
}) {
  const [range, setRange] = useState({ start: initialStart, end: initialEnd });
  const [editing, setEditing] = useState<"start" | "end" | null>(null),
    [month, setMonth] = useState(initialStart.slice(0, 7));
  const timeList = useRef<HTMLDivElement>(null),
    rangeRef = useRef<HTMLDivElement>(null);
  const selected = range[editing ?? "start"];
  const duration =
    (Date.parse(range.end + "Z") - Date.parse(range.start + "Z")) / 60000;
  useEffect(() => {
    const list = timeList.current;
    const option = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (editing && list && option) {
      list.scrollTop =
        option.offsetTop - list.clientHeight / 2 + option.clientHeight / 2;
    }
  }, [editing]);
  function update(next: string) {
    setRange((current) =>
      editing === "end"
        ? { ...current, end: next }
        : shiftScheduleStart(current.start, current.end, next),
    );
  }
  return (
    <div
      className="agenda-schedule"
      ref={rangeRef}
      onKeyDown={(e) => {
        if (editing && e.key === "Escape") {
          e.stopPropagation();
          setEditing(null);
          rangeRef.current
            ?.querySelector<HTMLButtonElement>(`[data-edit="${editing}"]`)
            ?.focus();
        }
      }}
    >
      <input type="hidden" name="start" value={range.start} />
      <input type="hidden" name="end" value={range.end} />
      <div className="agenda-reservation-label">
        <span>Horario reservado</span>
        <small>Hora de Paraguay</small>
      </div>
      <div className="agenda-range">
        {(["start", "end"] as const).map((key) => (
          <button
            type="button"
            key={key}
            data-edit={key}
            className={editing === key ? "is-editing" : ""}
            aria-expanded={editing === key}
            onClick={() => {
              setMonth(range[key].slice(0, 7));
              setEditing(editing === key ? null : key);
            }}
          >
            <span>{key === "start" ? "Inicio" : "Fin"}</span>
            <strong>{range[key].slice(11)}</strong>
            <small>
              {dayLabel(range[key].slice(0, 10), {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </small>
            <i aria-hidden="true">⌄</i>
          </button>
        ))}
      </div>
      <div className="agenda-durations">
        <span>Duración</span>
        {[30, 60, 90, 120].map((minutes) => (
          <button
            type="button"
            key={minutes}
            aria-pressed={duration === minutes}
            onClick={() =>
              setRange((current) => ({
                ...current,
                end: new Date(Date.parse(current.start + "Z") + minutes * 60000)
                  .toISOString()
                  .slice(0, 16),
              }))
            }
          >
            {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
          </button>
        ))}
      </div>
      {editing && (
        <section
          className="agenda-datetime-picker"
          aria-label={`Elegir ${editing === "start" ? "inicio" : "fin"}`}
        >
          <div className="agenda-date-picker">
            <header>
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setMonth(monthWindow(month, -1))}
              >
                ‹
              </button>
              <strong>
                {dayLabel(month + "-01", { month: "long", year: "numeric" })}
              </strong>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setMonth(monthWindow(month, 1))}
              >
                ›
              </button>
            </header>
            <div className="agenda-date-grid">
              {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
              {calendarDays(month + "-01", "month").map((day) => (
                <button
                  type="button"
                  key={day}
                  className={day.slice(0, 7) === month ? "" : "other-month"}
                  aria-label={dayLabel(day, { dateStyle: "full" })}
                  aria-pressed={selected.slice(0, 10) === day}
                  onClick={() => {
                    update(day + "T" + selected.slice(11));
                    setMonth(day.slice(0, 7));
                  }}
                >
                  {Number(day.slice(-2))}
                </button>
              ))}
            </div>
          </div>
          <div className="agenda-time-picker">
            <label>
              Hora exacta
              <input
                key={editing + selected}
                aria-label={`Hora de ${editing === "start" ? "inicio" : "fin"}`}
                type="text"
                inputMode="numeric"
                defaultValue={selected.slice(11)}
                placeholder="HH:MM"
                pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                onBlur={(e) => {
                  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value))
                    update(selected.slice(0, 10) + "T" + e.target.value);
                }}
              />
            </label>
            <div className="agenda-time-options" ref={timeList}>
              {Array.from({ length: 96 }, (_, index) => {
                const time = `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`;
                return (
                  <button
                    type="button"
                    key={time}
                    aria-pressed={selected.slice(11) === time}
                    onClick={() => {
                      update(selected.slice(0, 10) + "T" + time);
                      setEditing(null);
                      rangeRef.current
                        ?.querySelector<HTMLButtonElement>(
                          `[data-edit="${editing}"]`,
                        )
                        ?.focus();
                    }}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className="agenda-picker-done"
            onClick={() => setEditing(null)}
          >
            Listo
          </button>
        </section>
      )}
    </div>
  );
}
