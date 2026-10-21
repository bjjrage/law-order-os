import type { PracticeRecord } from "../../../os-core/src/practice-model.js";
import { moneyDigits } from "../../../os-core/src/practice-model.js";
import type { PracticeView } from "./PracticePanel.js";
export const formatOfficeMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency }).format(
    amount / 10 ** moneyDigits(currency),
  );
export function shiftDay(day: string, amount: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function monthWindow(month: string, offset: number) {
  const date = new Date(month + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function financeMetrics(
  data: Pick<PracticeView, "records" | "balances">,
  currency: string,
  today: string,
  month: string,
) {
  const byId = new Map(data.records.map((r) => [r.id, r]));
  const paid = new Map<string, number>();
  for (const r of data.records)
    if (r.payload.type === "DISBURSEMENT")
      paid.set(
        r.payload.payable_id,
        (paid.get(r.payload.payable_id) ?? 0) + r.payload.amount,
      );
  const receivables = data.records.flatMap((r) =>
    r.payload.type === "INVOICE" &&
    r.payload.status === "ISSUED" &&
    r.payload.currency === currency
      ? [
          {
            record: r,
            due: r.payload.due_on,
            balance: data.balances.find((b) => b.id === r.id)?.balance ?? 0,
          },
        ]
      : [],
  );
  const payables = data.records.flatMap((r) =>
    r.payload.type === "PAYABLE" &&
    r.payload.status === "OPEN" &&
    r.payload.currency === currency
      ? [
          {
            record: r,
            due: r.payload.due_on,
            balance: r.payload.total - (paid.get(r.id) ?? 0),
          },
        ]
      : [],
  );
  const outstanding = receivables.filter((r) => r.balance > 0),
    obligations = payables.filter((r) => r.balance > 0);
  const overdue = outstanding.filter((r) => r.due < today),
    overduePayables = obligations.filter((r) => r.due < today);
  const upcoming = obligations.filter(
    (r) => r.due >= today && r.due <= shiftDay(today, 7),
  );
  const flows = Array.from({ length: 6 }, (_, i) => ({
    month: monthWindow(month, i - 5),
    income: 0,
    expense: 0,
    refunds: 0,
  }));
  for (const r of data.records) {
    const p = r.payload;
    if (p.type !== "PAYMENT" && p.type !== "DISBURSEMENT") continue;
    const parent = byId.get(
      p.type === "PAYMENT" ? p.invoice_id : p.payable_id,
    )?.payload;
    if (
      !parent ||
      !("currency" in parent) ||
      parent.currency !== currency ||
      p.date > today
    )
      continue;
    const flow = flows.find((f) => f.month === p.date.slice(0, 7));
    if (!flow) continue;
    if (p.type === "DISBURSEMENT") flow.expense += p.amount;
    else if (p.direction === "RECEIPT") flow.income += p.amount;
    else {
      flow.expense += p.amount;
      flow.refunds += p.amount;
    }
  }
  const aging = [
    { label: "Al día", amount: 0 },
    { label: "1–30 días", amount: 0 },
    { label: "31–60 días", amount: 0 },
    { label: "Más de 60 días", amount: 0 },
  ];
  for (const item of outstanding) {
    const days = Math.floor(
      (Date.parse(today + "T12:00:00Z") - Date.parse(item.due + "T12:00:00Z")) /
        86400000,
    );
    aging[days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3]!.amount +=
      item.balance;
  }
  const sum = (items: { balance: number }[]) =>
    items.reduce((n, r) => n + r.balance, 0);
  const period = flows.at(-1)!;
  return {
    receivables,
    payables,
    outstanding,
    obligations,
    overdue,
    overduePayables,
    upcoming,
    flows,
    aging,
    period,
    receivable: sum(outstanding),
    payable: sum(obligations),
    overdueAmount: sum(overdue),
    overduePayableAmount: sum(overduePayables),
    upcomingAmount: sum(upcoming),
    net: period.income - period.expense,
    next: [
      ...outstanding.map((r) => ({ ...r, kind: "receivable" as const })),
      ...obligations.map((r) => ({ ...r, kind: "payable" as const })),
    ]
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 6),
  };
}
export type OfficeCalendarMode = "month" | "week" | "day";
export function calendarDays(anchor: string, mode: OfficeCalendarMode) {
  if (mode === "day") return [anchor];
  const date = new Date(
    (mode === "month" ? anchor.slice(0, 7) + "-01" : anchor) + "T12:00:00Z",
  );
  const first = shiftDay(
    date.toISOString().slice(0, 10),
    -((date.getUTCDay() + 6) % 7),
  );
  return Array.from({ length: mode === "month" ? 42 : 7 }, (_, i) =>
    shiftDay(first, i),
  );
}
export type OfficeCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: "appointment" | "deadline" | "task";
  detail: string;
  record?: PracticeRecord;
  matterId?: string;
  pendingConfirmation?: boolean;
  editable?: boolean;
};
export function eventOnDay(
  event: OfficeCalendarEvent,
  day: string,
  dayOf: (iso: string) => string,
) {
  const end =
    Date.parse(event.end) > Date.parse(event.start)
      ? new Date(Date.parse(event.end) - 1).toISOString()
      : event.end;
  return dayOf(event.start) <= day && dayOf(end) >= day;
}
