import { lazy, Suspense, useEffect, useState } from "react";
import type {
  Client,
  Matter,
  Membership,
} from "../../../os-core/src/contracts.js";
import type { PracticeRecord } from "../../../os-core/src/practice-model.js";
import {
  amountFromText,
  moneyDigits,
} from "../../../os-core/src/practice-model.js";
import type { PracticeView, PracticeSection } from "./PracticePanel.js";
import { api } from "./api.js";
import { Field, Form } from "./components.js";
import { asuncionDate } from "./local-dates.js";
import "./office-management.css";
import FinanceOverview from "./FinanceOverview.js";
import { matchesSearch } from "./workspace-model.js";
import OfficeCalendar from "./OfficeCalendar.js";
import OfficeDialog from "./OfficeDialog.js";
import { AgendaSchedule, AgendaSelect } from "./AgendaInputs.js";
import {
  appointmentRescheduleCommand,
  type CalendarRange,
} from "./calendar-reschedule.js";
import type { OfficeCalendarEvent } from "./office-metrics.js";
import {
  currentDeadline,
  deadlineInstant,
} from "../../../os-core/src/deadlines.js";
import type { WorkBoardData } from "./WorkManagement.js";
const PracticePanel = lazy(() => import("./PracticePanel.js"));
const money = (n: number, currency: string) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency }).format(
    n / 10 ** moneyDigits(currency),
  );
const moment = (value: string) =>
  new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const target = (r: PracticeRecord) => ({
  record_id: r.id,
  expected_revision: r.revision,
});
const messages: Record<string, string> = {
  APPOINTMENT_OVERLAP: "El profesional ya tiene una cita en ese horario.",
  INVALID_APPOINTMENT_TIME: "La cita debe terminar después de su inicio.",
  DUPLICATE_PAYABLE: "Ya existe esa factura del proveedor.",
  PAYMENT_EXCEEDS_BALANCE: "El importe supera el saldo pendiente.",
  DUPLICATE_PAYMENT_REFERENCE: "Esa referencia de pago ya está registrada.",
  CLIENT_MATTER_MISMATCH: "El asunto no pertenece al cliente seleccionado.",
  VERSION_CONFLICT:
    "El registro cambió en otra sesión. Actualizá la agenda antes de reintentar.",
  APPOINTMENT_LOCKED:
    "Esta cita ya no está pendiente y no puede reprogramarse.",
};
function usePractice(firm: string) {
  const [data, setData] = useState<PracticeView | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    api<PracticeView>(`/firms/${firm}/practice`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [firm, revision]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden") setRevision((v) => v + 1);
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("law-order-work-changed", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("law-order-work-changed", refresh);
    };
  }, []);
  const command = async <T = unknown,>(
    op: string,
    body: unknown,
  ): Promise<T> => {
    try {
      const result = await api<T>(`/firms/${firm}/practice/${op}`, body);
      setRevision((v) => v + 1);
      return result;
    } catch (e) {
      const cause = e as Error & { code?: string };
      throw Error(messages[cause.code ?? cause.message] ?? cause.message);
    }
  };
  return {
    data,
    error,
    command,
    reload: () => setRevision((v) => v + 1),
    updateRecord: (record: PracticeRecord) =>
      setData((current) =>
        current
          ? {
              ...current,
              records: current.records.map((r) =>
                r.id === record.id ? record : r,
              ),
            }
          : current,
      ),
  };
}
export function MatterAdministration({
  firm,
  matters,
  section,
  onOpenDraft,
  initialMatterId = "",
}: {
  firm: string;
  matters: Matter[];
  section: PracticeSection;
  initialMatterId?: string;
  onOpenDraft: (matter: Matter, id: string) => void;
}) {
  const [selected, setSelected] = useState(initialMatterId);
  const matter = matters.find((m) => m.id === selected);
  return (
    <section className="office-management">
      <label className="office-picker">
        Asunto
        <select
          value={matter?.id ?? ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Elegí el asunto</option>
          {matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      {matter ? (
        <Suspense fallback={<p role="status">Cargando…</p>}>
          <PracticePanel
            key={matter.id + section}
            initialSection={section}
            sectionOnly
            firm={firm}
            matter={matter}
            onOpenDraft={(id) => onOpenDraft(matter, id)}
          />
        </Suspense>
      ) : (
        <p>
          Elegí un asunto para ver{" "}
          {section === "admission"
            ? "su encargo y conflictos"
            : "sus presupuestos, trabajo y liquidaciones"}
          .
        </p>
      )}
    </section>
  );
}
export function OfficeFinance({
  firm,
  matters,
  clients,
  onOpenDraft,
}: {
  firm: string;
  matters: Matter[];
  clients: Client[];
  onOpenDraft: (matter: Matter, id: string) => void;
}) {
  const { data, error, command, reload } = usePractice(firm),
    [tab, setTab] = useState("summary"),
    [currency, setCurrency] = useState("PYG"),
    [month, setMonth] = useState(asuncionDate().slice(0, 7)),
    [query, setQuery] = useState(""),
    [ledgerState, setLedgerState] = useState("pending"),
    [feeMatter, setFeeMatter] = useState(""),
    [form, setForm] = useState<{
      kind: "payable" | "payment";
      row?: PracticeRecord;
    } | null>(null),
    [actionError, setActionError] = useState("");
  if (error && !data)
    return (
      <p role="alert">
        {error} <button onClick={reload}>Reintentar</button>
      </p>
    );
  if (!data) return <p role="status">Cargando finanzas…</p>;
  if (data.role !== "ADMINISTRATOR")
    return (
      <p>
        La administración financiera está reservada al Director del Despacho.
      </p>
    );
  const payables = data.records.filter(
    (r) =>
      r.payload.type === "PAYABLE" &&
      r.payload.status === "OPEN" &&
      r.payload.currency === currency,
  );
  const paid = (id: string) =>
    data.records.reduce(
      (n, r) =>
        n +
        (r.payload.type === "DISBURSEMENT" && r.payload.payable_id === id
          ? r.payload.amount
          : 0),
      0,
    );
  const invoices = data.records.filter(
    (r) =>
      r.payload.type === "INVOICE" &&
      r.payload.status === "ISSUED" &&
      r.payload.currency === currency,
  );
  const matchLedger = (r: PracticeRecord) => {
    const p = r.payload;
    if (p.type !== "INVOICE" && p.type !== "PAYABLE") return false;
    const balance =
      p.type === "INVOICE"
        ? (data.balances.find((b) => b.id === r.id)?.balance ?? 0)
        : p.total - paid(r.id);
    const m = matters.find((m) => m.id === r.matter_id),
      c = clients.find((c) => c.id === m?.client_id);
    return (
      (ledgerState === "all" ||
        (ledgerState === "pending" && balance > 0) ||
        (ledgerState === "overdue" &&
          balance > 0 &&
          p.due_on < asuncionDate()) ||
        (ledgerState === "settled" && balance <= 0)) &&
      matchesSearch(
        query,
        p.type === "PAYABLE" ? p.supplier : c?.display_name,
        p.type === "PAYABLE" ? p.reference : p.number,
        m?.title,
        p.type === "PAYABLE" ? p.description : "",
      )
    );
  };
  const perform = async (op: string, body: unknown) => {
    setActionError("");
    try {
      await command(op, body);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  return (
    <div className="office-management office-finance">
      {error && (
        <p role="alert">
          No se pudo actualizar el panel. Se muestran los últimos datos
          recibidos. <button onClick={reload}>Reintentar</button>
        </p>
      )}
      <div className="office-page-tools">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN DEL DESPACHO</span>
          <p>Control financiero y seguimiento de cobros y pagos.</p>
        </div>
        <div className="office-tool-actions">
          <label>
            Moneda
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Moneda del panel"
            >
              {["PYG", "USD", "EUR", "ARS", "BRL"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {tab === "summary" && (
            <label>
              Mes de movimientos
              <input
                aria-label="Mes de movimientos"
                type="month"
                max={asuncionDate().slice(0, 7)}
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
              />
            </label>
          )}
          <button onClick={reload}>Actualizar</button>
          <button
            className="primary"
            onClick={() => {
              setTab("payable");
              setForm({ kind: "payable" });
            }}
          >
            + Factura por pagar
          </button>
        </div>
      </div>
      <nav className="office-tabs" aria-label="Finanzas">
        <button
          aria-pressed={tab === "summary"}
          onClick={() => setTab("summary")}
        >
          Resumen
        </button>
        <button
          aria-pressed={tab === "receivable"}
          onClick={() => {
            setTab("receivable");
            reload();
          }}
        >
          Por cobrar
        </button>
        <button
          aria-pressed={tab === "payable"}
          onClick={() => setTab("payable")}
        >
          Por pagar
        </button>
        <button aria-pressed={tab === "fees"} onClick={() => setTab("fees")}>
          Presupuestos y honorarios
        </button>
      </nav>
      {actionError && <p role="alert">{actionError}</p>}
      {["receivable", "payable"].includes(tab) && (
        <div className="ledger-toolbar">
          <label>
            Buscar
            <input
              type="search"
              placeholder="Cliente, proveedor, asunto o comprobante"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Estado
            <select
              value={ledgerState}
              onChange={(e) => setLedgerState(e.target.value)}
            >
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidas</option>
              <option value="settled">Saldadas</option>
              <option value="all">Todas las vigentes</option>
            </select>
          </label>
          <span>{currency} · saldos actuales</span>
        </div>
      )}
      {tab === "summary" ? (
        <FinanceOverview
          data={data}
          currency={currency}
          today={asuncionDate()}
          month={month}
          matters={matters}
          clients={clients}
          onNavigate={(next, id, filter = "pending") => {
            if (id) setFeeMatter(id);
            setLedgerState(filter);
            setQuery("");
            setTab(next);
          }}
        />
      ) : tab === "fees" ? (
        <MatterAdministration
          key={feeMatter}
          initialMatterId={feeMatter}
          firm={firm}
          matters={matters}
          section="economy"
          onOpenDraft={onOpenDraft}
        />
      ) : tab === "receivable" ? (
        <>
          <p>
            Liquidaciones y facturas externas registradas de todo el estudio.
            Los cobros se registran en la liquidación correspondiente.
          </p>
          {!invoices.length && (
            <p>
              No hay liquidaciones. Creá la primera en «Presupuestos y
              honorarios».
            </p>
          )}
          <div className="office-table">
            <table>
              <thead>
                <tr>
                  <th>Cliente / asunto</th>
                  <th>Comprobante</th>
                  <th>Vencimiento</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {invoices.filter(matchLedger).map((r) => {
                  if (r.payload.type !== "INVOICE") return null;
                  const p = r.payload,
                    m = matters.find((m) => m.id === r.matter_id),
                    balance =
                      data.balances.find((b) => b.id === r.id)?.balance ?? 0;
                  return (
                    <tr key={r.id}>
                      <td>
                        {
                          clients.find((c) => c.id === m?.client_id)
                            ?.display_name
                        }
                        <small>{m?.title}</small>
                      </td>
                      <td>
                        {p.fiscal_reference?.number ?? p.number}
                        <small>
                          {p.fiscal_reference
                            ? "Factura externa registrada"
                            : "Liquidación interna"}
                        </small>
                      </td>
                      <td>{p.due_on}</td>
                      <td>{money(balance, p.currency)}</td>
                      <td>
                        {balance < 0
                          ? "Saldo a favor"
                          : balance === 0
                            ? "Saldada"
                            : p.due_on < asuncionDate()
                              ? "Vencida"
                              : "Pendiente"}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setFeeMatter(r.matter_id ?? "");
                            setTab("fees");
                          }}
                        >
                          Gestionar cobro
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="office-actions">
            <p>
              Obligaciones con proveedores y gastos del estudio. Registrar un
              pago no transfiere dinero.
            </p>
            <button onClick={() => setForm({ kind: "payable" })}>
              Registrar factura por pagar
            </button>
          </div>
          {!payables.length && <p>No hay facturas por pagar registradas.</p>}
          <div className="office-table">
            <table>
              <thead>
                <tr>
                  <th>Proveedor / concepto</th>
                  <th>Factura</th>
                  <th>Vencimiento</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payables.filter(matchLedger).map((r) => {
                  if (r.payload.type !== "PAYABLE") return null;
                  const p = r.payload,
                    balance = p.total - paid(r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        {p.supplier}
                        <small>{p.description}</small>
                      </td>
                      <td>{p.reference}</td>
                      <td>{p.due_on}</td>
                      <td>{money(balance, p.currency)}</td>
                      <td>
                        {balance === 0
                          ? "Pagada"
                          : p.due_on < asuncionDate()
                            ? "Vencida"
                            : "Pendiente"}
                      </td>
                      <td>
                        {balance > 0 && (
                          <button
                            onClick={() => setForm({ kind: "payment", row: r })}
                          >
                            Registrar pago
                          </button>
                        )}
                        {paid(r.id) === 0 && (
                          <button
                            onClick={() =>
                              void perform("void_payable", target(r))
                            }
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Historial de pagos a proveedores</summary>
            {data.records.map((r) => {
              if (r.payload.type !== "DISBURSEMENT") return null;
              const payment = r.payload;
              const bill = data.records.find(
                (b) => b.id === payment.payable_id,
              );
              if (bill?.payload.type !== "PAYABLE") return null;
              return (
                <p key={r.id}>
                  {bill.payload.supplier} | {payment.date} | {payment.reference}{" "}
                  | {money(payment.amount, bill.payload.currency)}
                </p>
              );
            })}
          </details>
        </>
      )}
      {form && (
        <OfficeDialog label="Registro financiero" onClose={() => setForm(null)}>
          <Form
            title={
              form.kind === "payable" ? "Factura por pagar" : "Pago a proveedor"
            }
            footerText="Registro administrativo local · no ejecuta transferencias"
            onClose={() => setForm(null)}
            onSave={async (f) => {
              const text = (k: string) => String(f.get(k) ?? "");
              if (form.kind === "payable")
                await command("create_payable", {
                  matter_id: null,
                  supplier: text("supplier"),
                  reference: text("reference"),
                  description: text("description"),
                  currency: text("currency"),
                  total: amountFromText(text("amount"), text("currency")),
                  issued_on: text("issued"),
                  due_on: text("due"),
                });
              else if (form.row?.payload.type === "PAYABLE")
                await command("pay_payable", {
                  ...target(form.row),
                  amount: amountFromText(
                    text("amount"),
                    form.row.payload.currency,
                  ),
                  date: text("date"),
                  reference: text("reference"),
                  method: text("method"),
                });
              setForm((current) => (current === form ? null : current));
            }}
          >
            {form.kind === "payable" ? (
              <>
                <Field label="Proveedor" name="supplier" />
                <Field label="Número de factura" name="reference" />
                <Field label="Concepto" name="description" />
                <Field label="Moneda" name="currency">
                  <option>PYG</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>ARS</option>
                  <option>BRL</option>
                </Field>
                <Field label="Importe total" name="amount" />
                <Field
                  label="Emisión"
                  name="issued"
                  type="date"
                  value={asuncionDate()}
                />
                <Field
                  label="Vencimiento"
                  name="due"
                  type="date"
                  value={asuncionDate()}
                />
              </>
            ) : (
              <>
                <Field label="Importe pagado" name="amount" />
                <Field
                  label="Fecha"
                  name="date"
                  type="date"
                  value={asuncionDate()}
                />
                <Field label="Referencia única" name="reference" />
                <Field label="Medio" name="method">
                  <option value="BANK">Transferencia</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="OTHER">Otro</option>
                </Field>
              </>
            )}
          </Form>
        </OfficeDialog>
      )}
    </div>
  );
}
export function ClientAppointments({
  firm,
  actorId,
  director,
  clients,
  matters,
  members,
  identityName,
  onOpenMatter,
}: {
  firm: string;
  actorId: string;
  director: boolean;
  clients: Client[];
  matters: Matter[];
  members: Membership[];
  identityName: (id: string) => string;
  onOpenMatter?: (id: string) => void;
}) {
  const { data, error, command, updateRecord } = usePractice(firm),
    [form, setForm] = useState<"new" | PracticeRecord | null>(null),
    [actionError, setActionError] = useState(""),
    [person, setPerson] = useState(""),
    [calendarWork, setCalendarWork] = useState<WorkBoardData | null>(null),
    [workError, setWorkError] = useState(""),
    [selectedEvent, setSelectedEvent] = useState<OfficeCalendarEvent | null>(
      null,
    ),
    [slot, setSlot] = useState({ day: asuncionDate(), time: "10:00" });
  useEffect(() => {
    let active = true;
    const load = () =>
      api<WorkBoardData>(`/firms/${firm}/work${director ? "/team" : ""}`)
        .then((d) => {
          if (active) {
            setCalendarWork(d);
            setWorkError("");
          }
        })
        .catch(() => {
          if (active)
            setWorkError(
              "No se pudieron cargar los plazos y tareas. Las reuniónes siguen disponibles.",
            );
        });
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") void load();
    }, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [firm, director]);
  const entries = (data?.records ?? [])
    .filter((r) => r.payload.type === "APPOINTMENT")
    .sort((a, b) =>
      a.payload.type === "APPOINTMENT" && b.payload.type === "APPOINTMENT"
        ? a.payload.starts_at.localeCompare(b.payload.starts_at)
        : 0,
    );
  const p =
    form && form !== "new" && form.payload.type === "APPOINTMENT"
      ? form.payload
      : null;
  const change = async (r: PracticeRecord, status: string) => {
    try {
      await command("appointment_status", { ...target(r), status });
      setActionError("");
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const calendarEvents: OfficeCalendarEvent[] = [
    ...entries.flatMap((r) => {
      if (
        r.payload.type !== "APPOINTMENT" ||
        r.payload.status === "CANCELLED" ||
        (person && r.payload.responsible_identity_id !== person)
      )
        return [];
      const p = r.payload;
      return [
        {
          id: r.id,
          title: p.title,
          start: p.starts_at,
          end: p.ends_at,
          kind: "appointment" as const,
          detail:
            clients.find((c) => c.id === p.client_id)?.display_name ??
            "Reunión interna",
          record: r,
          editable:
            p.status === "SCHEDULED" &&
            (director || p.responsible_identity_id === actorId),
        },
      ];
    }),
    ...(calendarWork?.tasks ?? []).flatMap((t) => {
      if (
        t.status !== "PENDING" ||
        !t.internal_due_at ||
        (person && t.responsible_identity_id !== person)
      )
        return [];
      const d = currentDeadline(t);
      return [
        {
          id: t.id,
          title: t.title,
          start: t.internal_due_at,
          end: new Date(
            Date.parse(t.internal_due_at) + 30 * 60000,
          ).toISOString(),
          kind: d ? ("deadline" as const) : ("task" as const),
          detail: matters.find((m) => m.id === t.matter_id)?.title ?? "Asunto",
          matterId: t.matter_id,
          pendingConfirmation: !!d && !d.confirmed_at,
        },
      ];
    }),
  ];
  return (
    <section className="office-agenda" aria-label="Agenda del estudio">
      <OfficeCalendar
        events={calendarEvents}
        loading={!data || (!calendarWork && !workError)}
        error={error || actionError || workError}
        person={person}
        onPerson={setPerson}
        professionals={members
          .filter((m) => m.active && (director || m.identity_id === actorId))
          .map((m) => ({
            id: m.identity_id,
            name: identityName(m.identity_id),
          }))}
        onCreate={(day, time = "10:00") => {
          setSelectedEvent(null);
          setSlot({ day, time });
          setForm("new");
        }}
        onSelect={setSelectedEvent}
        onReschedule={async (event, range: CalendarRange) => {
          if (!event.editable || !event.record)
            throw Error("No tenés permiso para reprogramar esta actividad.");
          const updated = await command<PracticeRecord>(
            "save_appointment",
            appointmentRescheduleCommand(event.record, range),
          );
          updateRecord(updated);
        }}
      />
      {selectedEvent && (
        <OfficeDialog
          label="Detalle de actividad"
          onClose={() => setSelectedEvent(null)}
        >
          <section className="calendar-event-detail">
            <header>
              <span className="office-pill">
                {selectedEvent.kind === "appointment"
                  ? "Reunión"
                  : selectedEvent.kind === "deadline"
                    ? "Plazo"
                    : "Tarea"}
              </span>
              <button
                autoFocus
                aria-label="Cerrar detalle"
                onClick={() => setSelectedEvent(null)}
              >
                Cerrar
              </button>
            </header>
            <h2>{selectedEvent.title}</h2>
            <p>
              {moment(selectedEvent.start)} - {moment(selectedEvent.end)}
            </p>
            <p>{selectedEvent.detail}</p>
            {selectedEvent.pendingConfirmation && (
              <p className="office-pill amber">
                Fecha pendiente de confirmación profesional
              </p>
            )}
            {selectedEvent.record?.payload.type === "APPOINTMENT" && (
              <>
                <p>
                  {identityName(
                    selectedEvent.record.payload.responsible_identity_id,
                  )}
                </p>
                <p>{selectedEvent.record.payload.location}</p>
                <p>{selectedEvent.record.payload.notes}</p>
                {selectedEvent.record.payload.status === "SCHEDULED" && (
                  <div className="office-actions">
                    <button
                      className="primary"
                      onClick={() => {
                        setForm(selectedEvent.record!);
                        setSelectedEvent(null);
                      }}
                    >
                      Editar / reprogramar
                    </button>
                    <button
                      onClick={() => {
                        void change(selectedEvent.record!, "DONE");
                        setSelectedEvent(null);
                      }}
                    >
                      Marcar realizada
                    </button>
                    <button
                      onClick={() => {
                        void change(selectedEvent.record!, "CANCELLED");
                        setSelectedEvent(null);
                      }}
                    >
                      Cancelar actividad
                    </button>
                  </div>
                )}
              </>
            )}
            {selectedEvent.matterId && (
              <button
                className="primary"
                onClick={() => {
                  onOpenMatter?.(selectedEvent.matterId!);
                  setSelectedEvent(null);
                }}
              >
                Abrir asunto y gestionar
              </button>
            )}
          </section>
        </OfficeDialog>
      )}
      {form && (
        <OfficeDialog
          label={form === "new" ? "Nueva actividad" : "Editar actividad"}
          onClose={() => setForm(null)}
        >
          <Form
            key={typeof form === "string" ? form : form.id}
            title={p ? "Editar actividad" : "Nueva actividad"}
            footerText="Se guarda en la agenda local del estudio"
            onClose={() => setForm(null)}
            onSave={async (f) => {
              const text = (k: string) => String(f.get(k) ?? "");
              await command("save_appointment", {
                record_id: form === "new" ? null : form.id,
                expected_revision: form === "new" ? null : form.revision,
                matter_id: form === "new" ? null : form.matter_id,
                title: text("title"),
                client_id: text("client") || null,
                responsible_identity_id: text("responsible"),
                starts_at: deadlineInstant(
                  text("start").slice(0, 10),
                  text("start").slice(11, 16),
                ),
                ends_at: deadlineInstant(
                  text("end").slice(0, 10),
                  text("end").slice(11, 16),
                ),
                location: text("location"),
                notes: text("notes"),
              });
              setForm((current) => (current === form ? null : current));
            }}
          >
            <Field label="Actividad o motivo" name="title" value={p?.title} />
            <AgendaSelect
              label="Cliente (opcional)"
              name="client"
              defaultValue={p?.client_id ?? ""}
              options={[
                { value: "", label: "Sin cliente · reunión interna" },
                ...clients.map((c) => ({ value: c.id, label: c.display_name })),
              ]}
            />
            <AgendaSelect
              label="Profesional"
              name="responsible"
              defaultValue={p?.responsible_identity_id ?? (person || actorId)}
              options={members
                .filter(
                  (m) => m.active && (director || m.identity_id === actorId),
                )
                .map((m) => ({
                  value: m.identity_id,
                  label: identityName(m.identity_id),
                }))}
            />
            <AgendaSchedule
              initialStart={
                p ? localTime(p.starts_at) : slot.day + "T" + slot.time
              }
              initialEnd={
                p
                  ? localTime(p.ends_at)
                  : localTime(
                      new Date(
                        Date.parse(deadlineInstant(slot.day, slot.time)) +
                          3600000,
                      ).toISOString(),
                    )
              }
            />
            <Field
              label="Lugar o enlace"
              name="location"
              value={p?.location}
              required={false}
            />
            <Field
              label="Notas"
              name="notes"
              value={p?.notes}
              required={false}
            />
          </Form>
        </OfficeDialog>
      )}
    </section>
  );
}
function localTime(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
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
}
