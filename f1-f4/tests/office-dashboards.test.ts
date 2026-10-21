import { expect, it } from "vitest";
import type {
  PracticePayload,
  PracticeRecord,
} from "../../os-core/src/practice-model.js";
import {
  financeMetrics,
  calendarDays,
  eventOnDay,
  type OfficeCalendarEvent,
} from "../../apps/web/src/office-metrics.js";
import { layoutDayEvents } from "../../apps/web/src/OfficeCalendar.js";
import { shiftScheduleStart } from "../../apps/web/src/AgendaInputs.js";
import {
  rescheduleRange,
  appointmentRescheduleCommand,
} from "../../apps/web/src/calendar-reschedule.js";
import { asuncionDate } from "../../apps/web/src/local-dates.js";
it("reprograma en horario de Paraguay conservando duración y cruzando medianoche", () => {
  const range = {
    start: "2026-10-20T23:30:00-03:00",
    end: "2026-10-21T01:00:00-03:00",
  };
  expect(rescheduleRange(range, "move", 1, 30)).toEqual({
    start: "2026-10-22T03:00:00.000Z",
    end: "2026-10-22T04:30:00.000Z",
  });
  expect(rescheduleRange(range, "end", 0, -300).end).toBe(
    "2026-10-21T02:45:00.000Z",
  );
  expect(rescheduleRange(range, "start", 0, 300).start).toBe(
    "2026-10-21T03:45:00.000Z",
  );
});
it("reprogramar conserva el contenido, responsable, asunto y revisión de la cita", () => {
  const appointment = record("appointment", {
    type: "APPOINTMENT",
    status: "SCHEDULED",
    title: "Reunión",
    client_id: null,
    responsible_identity_id: "lawyer",
    starts_at: "2026-10-20T13:00:00.000Z",
    ends_at: "2026-10-20T14:00:00.000Z",
    location: "Estudio",
    notes: "Conservar notas",
  });
  const command = appointmentRescheduleCommand(appointment, {
    start: "2026-10-21T13:00:00.000Z",
    end: "2026-10-21T14:30:00.000Z",
  });
  expect(command).toMatchObject({
    record_id: appointment.id,
    expected_revision: appointment.revision,
    matter_id: null,
    client_id: null,
    responsible_identity_id: "lawyer",
    location: "Estudio",
    notes: "Conservar notas",
    ends_at: "2026-10-21T14:30:00.000Z",
  });
  expect(() =>
    appointmentRescheduleCommand(
      {
        ...appointment,
        payload: { ...appointment.payload, status: "DONE" },
      } as PracticeRecord,
      { start: "2026-10-21T13:00:00.000Z", end: "2026-10-21T14:00:00.000Z" },
    ),
  ).toThrow();
});
it("conserva la duración al mover una reserva a otro día, incluso al cruzar medianoche", () => {
  expect(
    shiftScheduleStart(
      "2026-10-20T10:00",
      "2026-10-20T11:30",
      "2026-10-31T23:30",
    ),
  ).toEqual({
    start: "2026-10-31T23:30",
    end: "2026-11-01T01:00",
  });
});
const record = (id: string, payload: PracticePayload): PracticeRecord => ({
  id,
  law_firm_id: "firm",
  matter_id: null,
  revision: 1,
  created_by: "director",
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  payload,
});
const invoice = (id: string, currency: "PYG" | "USD", due: string) =>
  record(id, {
    type: "INVOICE",
    number: id,
    currency,
    lines: [
      {
        description: "Legal work",
        quantity: 1,
        unit_amount: 100000,
        tax_bps: 0,
      },
    ],
    total: 100000,
    issued_on: "2026-09-01",
    due_on: due,
    budget_id: null,
    budget_revision: null,
    entry_ids: [],
    status: "ISSUED",
    void_reason: "",
    fiscal_reference: null,
  });
it("keeps KPI zero states and six-month boundaries meaningful without any records", () => {
  const m = financeMetrics(
    { records: [], balances: [] },
    "PYG",
    "2026-01-05",
    "2026-01",
  );
  expect([
    m.receivable,
    m.payable,
    m.net,
    m.overdueAmount,
    m.upcomingAmount,
  ]).toEqual([0, 0, 0, 0, 0]);
  expect(m.flows.map((f) => f.month)).toEqual([
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
});
it("separates currency, outstanding balances, refunds, cash movements and overdue age", () => {
  const records = [
    invoice("invoice", "PYG", "2026-09-01"),
    invoice("usd", "USD", "2026-09-01"),
    record("bill", {
      type: "PAYABLE",
      supplier: "Supplier",
      reference: "b1",
      description: "Rent",
      currency: "PYG",
      total: 40000,
      issued_on: "2026-10-01",
      due_on: "2026-10-22",
      status: "OPEN",
    }),
    record("receipt", {
      type: "PAYMENT",
      invoice_id: "invoice",
      direction: "RECEIPT",
      amount: 50000,
      date: "2026-10-02",
      reference: "r1",
      method: "BANK",
      proof_version_id: null,
    }),
    record("refund", {
      type: "PAYMENT",
      invoice_id: "invoice",
      direction: "REFUND",
      amount: 10000,
      date: "2026-10-03",
      reference: "r2",
      method: "BANK",
      proof_version_id: null,
    }),
    record("usd-receipt", {
      type: "PAYMENT",
      invoice_id: "usd",
      direction: "RECEIPT",
      amount: 999,
      date: "2026-10-02",
      reference: "u1",
      method: "BANK",
      proof_version_id: null,
    }),
    record("future", {
      type: "PAYMENT",
      invoice_id: "invoice",
      direction: "RECEIPT",
      amount: 1000,
      date: "2026-11-01",
      reference: "future",
      method: "BANK",
      proof_version_id: null,
    }),
    record("paid", {
      type: "DISBURSEMENT",
      payable_id: "bill",
      amount: 15000,
      date: "2026-10-03",
      reference: "p1",
      method: "BANK",
    }),
  ];
  const m = financeMetrics(
    {
      records,
      balances: [
        {
          id: "invoice",
          balance: 60000,
          received: 40000,
          credits: 0,
          currency: "PYG",
        },
        {
          id: "usd",
          balance: 99001,
          received: 999,
          credits: 0,
          currency: "USD",
        },
      ],
    },
    "PYG",
    "2026-10-19",
    "2026-10",
  );
  expect(m.receivable).toBe(60000);
  expect(m.overdueAmount).toBe(60000);
  expect(m.aging[2]!.amount).toBe(60000);
  expect(m.payable).toBe(25000);
  expect(m.upcomingAmount).toBe(25000);
  expect(m.period).toEqual({
    month: "2026-10",
    income: 50000,
    expense: 25000,
    refunds: 10000,
  });
  expect(m.net).toBe(25000);
  expect(m.next.map((n) => n.record.id)).toEqual(["invoice", "bill"]);
});
it("builds Monday-based calendar ranges across leap years and year boundaries", () => {
  expect(calendarDays("2026-01-01", "week")).toEqual([
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ]);
  const month = calendarDays("2024-02-20", "month");
  expect(month).toHaveLength(42);
  expect(month).toContain("2024-02-29");
  expect(calendarDays("2026-10-19", "day")).toEqual(["2026-10-19"]);
});
it("does not duplicate a meeting ending at midnight on the following day", () => {
  const event: OfficeCalendarEvent = {
    id: "a",
    title: "Late meeting",
    kind: "appointment",
    detail: "",
    start: "2026-10-19T23:00:00-03:00",
    end: "2026-10-20T00:00:00-03:00",
  };
  const dayOf = (iso: string) => asuncionDate(new Date(iso));
  expect(eventOnDay(event, "2026-10-19", dayOf)).toBe(true);
  expect(eventOnDay(event, "2026-10-20", dayOf)).toBe(false);
});
it("keeps concurrent activities visible in separate lanes and reuses space after overlap", () => {
  const events: OfficeCalendarEvent[] = [
    {
      id: "a",
      title: "A",
      kind: "appointment",
      detail: "",
      start: "2026-10-19T13:00:00Z",
      end: "2026-10-19T14:00:00Z",
    },
    {
      id: "b",
      title: "B",
      kind: "deadline",
      detail: "",
      start: "2026-10-19T13:30:00Z",
      end: "2026-10-19T14:00:00Z",
    },
    {
      id: "c",
      title: "C",
      kind: "task",
      detail: "",
      start: "2026-10-19T15:00:00Z",
      end: "2026-10-19T16:00:00Z",
    },
  ];
  const blocks = layoutDayEvents(events, "2026-10-19");
  expect(blocks[0]!.lanes).toBe(2);
  expect(blocks[0]!.lane).not.toBe(blocks[1]!.lane);
  expect(blocks[2]!.lanes).toBe(1);
  expect(blocks[0]!.top).toBe(10 * 52);
});
