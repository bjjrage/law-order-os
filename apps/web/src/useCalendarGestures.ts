import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type {
  OfficeCalendarEvent,
  OfficeCalendarMode,
} from "./office-metrics.js";
import {
  CALENDAR_HOUR_HEIGHT,
  CALENDAR_SNAP_MINUTES,
  rescheduleRange,
  type CalendarGesture,
  type CalendarRange,
} from "./calendar-reschedule.js";

type Draft = CalendarRange & {
  id: string;
  valid: boolean;
  gesture: CalendarGesture;
};
export function useCalendarGestures({
  root,
  scroll,
  mode,
  onReschedule,
}: {
  root: RefObject<HTMLDivElement | null>;
  scroll: RefObject<HTMLDivElement | null>;
  mode: OfficeCalendarMode;
  onReschedule: (
    event: OfficeCalendarEvent,
    range: CalendarRange,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const cleanup = useRef<(() => void) | null>(null),
    busy = useRef(false),
    ignoreClick = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cleanup.current?.();
    };
  }, []);
  useEffect(() => {
    if (!notice || draft || saving) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice, draft, saving]);
  async function persist(event: OfficeCalendarEvent, next: CalendarRange) {
    busy.current = true;
    setSaving(true);
    setError("");
    setNotice("Guardando nuevo horario…");
    try {
      await onReschedule(event, next);
      if (alive.current) setNotice("Horario actualizado.");
    } catch (cause) {
      if (alive.current) {
        setNotice("");
        setError(
          `${(cause as Error).message} La cita conserva su horario anterior.`,
        );
      }
    } finally {
      busy.current = false;
      if (alive.current) {
        setSaving(false);
        setDraft(null);
      }
    }
  }
  function begin(
    event: OfficeCalendarEvent,
    day: string,
    gesture: CalendarGesture,
    pointer: ReactPointerEvent<HTMLElement>,
  ) {
    if (
      !event.editable ||
      busy.current ||
      pointer.button !== 0 ||
      !root.current
    )
      return;
    cleanup.current?.();
    const surface = root.current,
      pointerId = pointer.pointerId;
    const startX = pointer.clientX,
      startY = pointer.clientY;
    const source = surface.querySelector<HTMLElement>(
      `[data-time-day="${day}"]`,
    );
    const initialY = source ? startY - source.getBoundingClientRect().top : 0;
    let x = startX,
      y = startY,
      moved = false,
      next: Draft | null = null,
      frame = 0;
    const rangeAtPointer = () => {
      const cells = [
        ...surface.querySelectorAll<HTMLElement>(
          mode === "month" ? "[data-month-day]" : "[data-time-day]",
        ),
      ];
      const viewport = scroll.current?.getBoundingClientRect();
      const column = cells.find((cell) => {
        const r = cell.getBoundingClientRect();
        return (
          x >= r.left &&
          x < r.right &&
          (mode === "month"
            ? y >= r.top && y < r.bottom
            : !!viewport &&
              y >= viewport.top + 62 &&
              y < viewport.bottom &&
              x >= viewport.left &&
              x < viewport.right)
        );
      });
      if (!column) {
        if (next?.valid) {
          next = { ...next, valid: false };
          setDraft(next);
        }
        return;
      }
      const targetDay = column.dataset.monthDay ?? column.dataset.timeDay!;
      const days = Math.round(
        (Date.parse(targetDay + "T12:00:00Z") -
          Date.parse(day + "T12:00:00Z")) /
          86400000,
      );
      const minutes =
        mode === "month"
          ? 0
          : Math.round(
              (((y - column.getBoundingClientRect().top - initialY) /
                CALENDAR_HOUR_HEIGHT) *
                60) /
                CALENDAR_SNAP_MINUTES,
            ) * CALENDAR_SNAP_MINUTES;
      const range = rescheduleRange(event, gesture, days, minutes);
      if (next?.start === range.start && next.end === range.end && next.valid)
        return;
      next = { ...range, id: event.id, gesture, valid: true };
      setDraft(next);
    };
    const autoScroll = () => {
      if (mode !== "month" && scroll.current) {
        const box = scroll.current.getBoundingClientRect();
        if (
          x >= box.left &&
          x <= box.right &&
          y >= box.top &&
          y <= box.bottom
        ) {
          const delta = y > box.bottom - 32 ? 9 : y < box.top + 92 ? -9 : 0;
          if (delta) {
            scroll.current.scrollTop += delta;
            rangeAtPointer();
          }
        }
      }
      frame = requestAnimationFrame(autoScroll);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      x = e.clientX;
      y = e.clientY;
      if (!moved && Math.hypot(x - startX, y - startY) < 5) return;
      if (!moved) {
        moved = true;
        surface.setPointerCapture(pointerId);
        setNotice("");
        setError("");
        frame = requestAnimationFrame(autoScroll);
      }
      e.preventDefault();
      rangeAtPointer();
    };
    const clear = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
      cancelAnimationFrame(frame);
      if (surface.hasPointerCapture(pointerId))
        surface.releasePointerCapture(pointerId);
      cleanup.current = null;
    };
    const finish = (cancelled: boolean) => {
      clear();
      if (!moved) return;
      ignoreClick.current = true;
      // The synthetic click after pointerup must not open a form or event detail.
      setTimeout(() => {
        ignoreClick.current = false;
      }, 0);
      if (cancelled || !next?.valid) {
        setDraft(null);
        setNotice("Movimiento cancelado. La cita conserva su horario.");
        return;
      }
      if (
        Date.parse(next.start) === Date.parse(event.start) &&
        Date.parse(next.end) === Date.parse(event.end)
      ) {
        setDraft(null);
        return;
      }
      void persist(event, next);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointerId) finish(false);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) finish(true);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    cleanup.current = clear;
  }
  function keyboard(
    event: OfficeCalendarEvent,
    gesture: CalendarGesture,
    days: number,
    minutes: number,
  ) {
    if (!event.editable || busy.current) return;
    const range = rescheduleRange(event, gesture, days, minutes);
    setDraft({ ...range, id: event.id, valid: true, gesture });
    void persist(event, range);
  }
  return {
    begin,
    keyboard,
    draft,
    saving,
    notice,
    error,
    suppressClick: () => ignoreClick.current,
  };
}
