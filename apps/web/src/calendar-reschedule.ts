import type { PracticeRecord } from "../../../os-core/src/practice-model.js";
import { deadlineInstant } from "../../../os-core/src/deadlines.js";

export type CalendarRange = { start: string; end: string };
export type CalendarGesture = "move" | "start" | "end";
export const CALENDAR_HOUR_HEIGHT = 52;
export const CALENDAR_SNAP_MINUTES = 15;
const minute = 60000;
const civil = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(" ", "T");

function shift(iso: string, days: number, minutes: number) {
  const next = new Date(
    Date.parse(civil(iso) + "Z") + (days * 1440 + minutes) * minute,
  ).toISOString();
  return deadlineInstant(next.slice(0, 10), next.slice(11, 16));
}

/** Move in Paraguay civil time; keep the actual duration, including overnight meetings. */
export function rescheduleRange(
  range: CalendarRange,
  gesture: CalendarGesture,
  days: number,
  minutes: number,
): CalendarRange {
  if (gesture === "move") {
    const start = shift(range.start, days, minutes);
    return {
      start,
      end: new Date(
        Date.parse(start) + Date.parse(range.end) - Date.parse(range.start),
      ).toISOString(),
    };
  }
  if (gesture === "end")
    return {
      start: range.start,
      end: new Date(
        Math.max(
          Date.parse(range.start) + CALENDAR_SNAP_MINUTES * minute,
          Date.parse(shift(range.end, days, minutes)),
        ),
      ).toISOString(),
    };
  return {
    start: new Date(
      Math.min(
        Date.parse(range.end) - CALENDAR_SNAP_MINUTES * minute,
        Date.parse(shift(range.start, days, minutes)),
      ),
    ).toISOString(),
    end: range.end,
  };
}

export function appointmentRescheduleCommand(
  record: PracticeRecord,
  range: CalendarRange,
) {
  const p = record.payload;
  if (p.type !== "APPOINTMENT" || p.status !== "SCHEDULED")
    throw Error("Esta actividad no se puede reprogramar.");
  if (
    !Number.isFinite(Date.parse(range.start)) ||
    !Number.isFinite(Date.parse(range.end)) ||
    Date.parse(range.end) <= Date.parse(range.start)
  )
    throw Error("El fin debe ser posterior al inicio.");
  return {
    record_id: record.id,
    expected_revision: record.revision,
    matter_id: record.matter_id,
    title: p.title,
    client_id: p.client_id,
    responsible_identity_id: p.responsible_identity_id,
    starts_at: range.start,
    ends_at: range.end,
    location: p.location,
    notes: p.notes,
  };
}
