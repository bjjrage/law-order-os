import type { Client, Matter } from "../../../os-core/src/contracts.js";
import type { PracticeView } from "./PracticePanel.js";
import {
  financeMetrics,
  formatOfficeMoney as money,
} from "./office-metrics.js";
export default function FinanceOverview({
  data,
  currency,
  today,
  month,
  matters,
  clients,
  onNavigate,
}: {
  data: PracticeView;
  currency: string;
  today: string;
  month: string;
  matters: Matter[];
  clients: Client[];
  onNavigate: (
    tab: "receivable" | "payable" | "fees",
    matterId?: string,
    filter?: "pending" | "overdue",
  ) => void;
}) {
  const metrics = financeMetrics(data, currency, today, month),
    max = Math.max(1, ...metrics.flows.flatMap((f) => [f.income, f.expense]));
  const monthLabel = new Intl.DateTimeFormat("es-PY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T12:00:00Z"));
  const cards = [
    {
      label: "Por cobrar",
      amount: metrics.receivable,
      note: `${metrics.outstanding.length} comprobantes pendientes`,
      tab: "receivable" as const,
      tone: "neutral",
    },
    {
      label: "Cobros vencidos",
      amount: metrics.overdueAmount,
      note: `${metrics.overdue.length} requieren seguimiento`,
      tab: "receivable" as const,
      tone: "danger",
    },
    {
      label: "Cobrado en el mes",
      amount: metrics.period.income - metrics.period.refunds,
      note: "Cobros menos devoluciones",
      tab: "receivable" as const,
      tone: "positive",
    },
    {
      label: "Por pagar",
      amount: metrics.payable,
      note: `${metrics.obligations.length} obligaciones pendientes`,
      tab: "payable" as const,
      tone: "neutral",
    },
    {
      label: "Pagos vencidos",
      amount: metrics.overduePayableAmount,
      note: `${metrics.overduePayables.length} facturas de proveedores`,
      tab: "payable" as const,
      tone: "danger",
    },
    {
      label: "Flujo neto del mes",
      amount: metrics.net,
      note: "Ingresos menos egresos registrados",
      tab: "payable" as const,
      tone: metrics.net < 0 ? "danger" : "positive",
    },
  ];
  return (
    <>
      <div className="office-kpis" aria-label="Indicadores financieros">
        {cards.map((c) => {
          const content = (
            <>
              <span>{c.label}</span>
              <strong>{money(c.amount, currency)}</strong>
              <small>{c.note}</small>
            </>
          );
          return ["Cobrado en el mes", "Flujo neto del mes"].includes(
            c.label,
          ) ? (
            <article key={c.label} className="office-kpi" data-tone={c.tone}>
              {content}
            </article>
          ) : (
            <button
              key={c.label}
              className="office-kpi"
              data-tone={c.tone}
              onClick={() =>
                onNavigate(
                  c.tab,
                  undefined,
                  c.label.includes("vencidos") ? "overdue" : "pending",
                )
              }
            >
              {content}
            </button>
          );
        })}
      </div>
      <div className="finance-insights">
        <section className="office-card finance-cash">
          <header>
            <div>
              <h2>Movimientos de caja</h2>
              <p>Seis meses hasta {monthLabel}</p>
            </div>
            <span className="chart-legend">
              <i className="income" />
              Ingresos <i className="expense" />
              Egresos
            </span>
          </header>
          <div
            className="cash-chart"
            role="img"
            aria-label={`Ingresos y egresos registrados en ${currency}, últimos seis meses`}
          >
            {metrics.flows.map((f) => (
              <div className="cash-month" key={f.month}>
                <div className="cash-bars">
                  <span
                    className="income"
                    style={{ height: `${(f.income / max) * 100}%` }}
                    title={`Ingresos: ${money(f.income, currency)}`}
                  />
                  <span
                    className="expense"
                    style={{ height: `${(f.expense / max) * 100}%` }}
                    title={`Egresos: ${money(f.expense, currency)}`}
                  />
                </div>
                <span>
                  {new Intl.DateTimeFormat("es-PY", {
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(f.month + "-01T12:00:00Z"))}
                </span>
              </div>
            ))}
          </div>
          {!metrics.flows.some((f) => f.income || f.expense) && (
            <p className="chart-empty">
              Sin movimientos registrados en este período.
            </p>
          )}
          <details className="office-disclosure">
            <summary>Ver importes por mes</summary>
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Ingresos</th>
                  <th>Egresos</th>
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {metrics.flows.map((f) => (
                  <tr key={f.month}>
                    <td>{f.month}</td>
                    <td>{money(f.income, currency)}</td>
                    <td>{money(f.expense, currency)}</td>
                    <td>{money(f.income - f.expense, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
        <section className="office-card finance-aging">
          <header>
            <div>
              <h2>Antigüedad de cobranza</h2>
              <p>Saldo pendiente al {today}</p>
            </div>
          </header>
          <strong className="aging-total">
            {money(metrics.receivable, currency)}
          </strong>
          {metrics.aging.map((bucket, i) => (
            <div key={bucket.label} className="aging-row">
              <span>{bucket.label}</span>
              <strong>{money(bucket.amount, currency)}</strong>
              <div>
                <i
                  data-level={i}
                  style={{
                    width: metrics.receivable
                      ? `${(bucket.amount / metrics.receivable) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          ))}
          <button
            className="text-action"
            onClick={() => onNavigate("receivable")}
          >
            Revisar cuentas por cobrar →
          </button>
        </section>
      </div>
      <div className="finance-bottom">
        <section className="office-card">
          <header>
            <div>
              <h2>Vencimientos a atender</h2>
              <p>Cobros y pagos pendientes, ordenados por fecha</p>
            </div>
          </header>
          {metrics.next.length ? (
            <div className="office-table">
              <table>
                <thead>
                  <tr>
                    <th>Persona / concepto</th>
                    <th>Tipo</th>
                    <th>Vence</th>
                    <th>Pendiente</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {metrics.next.map((item) => {
                    const p = item.record.payload,
                      m = matters.find((m) => m.id === item.record.matter_id);
                    return (
                      <tr key={item.record.id}>
                        <td>
                          {p.type === "PAYABLE"
                            ? p.supplier
                            : (clients.find((c) => c.id === m?.client_id)
                                ?.display_name ?? "Cliente")}
                          <small>
                            {p.type === "PAYABLE" ? p.description : m?.title}
                          </small>
                        </td>
                        <td>
                          <span
                            className={
                              "office-pill " +
                              (item.kind === "receivable"
                                ? "positive"
                                : "amber")
                            }
                          >
                            {item.kind === "receivable" ? "Cobrar" : "Pagar"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={item.due < today ? "overdue-text" : ""}
                          >
                            {item.due}
                          </span>
                        </td>
                        <td>{money(item.balance, currency)}</td>
                        <td>
                          <button
                            onClick={() =>
                              onNavigate(
                                item.kind === "receivable" ? "fees" : "payable",
                                item.record.matter_id ?? undefined,
                              )
                            }
                          >
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="office-empty">
              <strong>No hay vencimientos pendientes</strong>
              <p>
                Las liquidaciones y facturas que registres aparecerán aquí con
                su saldo y fecha.
              </p>
              <button onClick={() => onNavigate("fees")}>
                Preparar liquidación
              </button>
            </div>
          )}
        </section>
        <aside className="office-card finance-next">
          <span className="eyebrow">PRÓXIMOS 7 DÍAS</span>
          <h2>Compromisos de pago</h2>
          <strong>{money(metrics.upcomingAmount, currency)}</strong>
          <p>{metrics.upcoming.length} facturas de proveedores por vencer.</p>
          <hr />
          <p>
            Los indicadores separan cada moneda. El flujo refleja movimientos
            registrados, no el saldo de una cuenta bancaria.
          </p>
          <button onClick={() => onNavigate("payable")}>
            Ver pagos pendientes →
          </button>
        </aside>
      </div>
    </>
  );
}
