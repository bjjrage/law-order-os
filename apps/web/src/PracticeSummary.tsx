import { useEffect, useState } from "react";
import { api } from "./api.js";
import { platformRequest, centralEnabled } from "./platform-client.js";
import type { PracticeView } from "./PracticePanel.js";
import { moneyDigits } from "../../../os-core/src/practice-model.js";
export default function PracticeSummary({
  firm,
  onOpen,
}: {
  firm: string;
  onOpen: (matterId: string) => void;
}) {
  const [data, setData] = useState<PracticeView | null>(null),
    [costs, setCosts] = useState<any>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<PracticeView>(`/firms/${firm}/practice`),
      centralEnabled()
        ? platformRequest("cost-metrics", { firm })
        : Promise.resolve(null),
    ])
      .then(([d, c]) => {
        if (active) {
          setData(d);
          setCosts(c);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [firm]);
  if (error)
    return (
      <p role="status">
        Indicadores económicos no disponibles. Reintentá al actualizar el
        Dashboard.
      </p>
    );
  if (!data || data.role !== "ADMINISTRATOR") return null;
  const invoices = data.records.filter(
      (r) => r.payload.type === "INVOICE" && r.payload.status === "ISSUED",
    ),
    today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Asuncion",
    }),
    currencies = [...new Set(data.balances.map((b) => b.currency))];
  return (
    <details className="dashboard-practice-summary">
      <summary>Honorarios, sesiones y consumo de IA</summary>
      <div className="dashboard-practice-cards">
        {currencies.map((currency) => {
          const balances = data.balances.filter((b) => b.currency === currency),
            balance = balances.reduce((n, b) => n + b.balance, 0),
            overdue = balances
              .filter(
                (b) =>
                  b.balance > 0 &&
                  invoices.some(
                    (r) =>
                      r.id === b.id &&
                      r.payload.type === "INVOICE" &&
                      r.payload.due_on < today,
                  ),
              )
              .reduce((n, b) => n + b.balance, 0),
            format = (n: number) =>
              new Intl.NumberFormat("es-PY", {
                style: "currency",
                currency,
              }).format(n / 10 ** moneyDigits(currency));
          return (
            <article key={currency}>
              <strong>{format(balance)}</strong>
              <span>Saldo por cobrar · {currency}</span>
              <small>Vencido: {format(overdue)}</small>
            </article>
          );
        })}
        <article>
          <strong>
            {
              data.records.filter(
                (r) =>
                  r.payload.type === "MINUTES" &&
                  r.payload.status === "PROPOSED",
              ).length
            }
          </strong>
          <span>Actas pendientes de revisión</span>
        </article>
        {costs && (
          <article>
            <strong>
              USD {Number(costs.session_estimated_usd).toFixed(4)}
            </strong>
            <span>Sesiones IA · consumo estimado</span>
            <small>
              Reservas con resultado incierto: USD{" "}
              {Number(costs.session_uncertain_usd).toFixed(4)} · Workspace
              reservado: USD {Number(costs.workspace_reserved_usd).toFixed(4)} -
              Gabriel voz: USD{" "}
              {Number(costs.gabriel_voice_estimated_usd ?? 0).toFixed(4)} -
              Gabriel texto/reservas: USD{" "}
              {Number(costs.gabriel_text_retained_usd ?? 0).toFixed(4)}
            </small>
          </article>
        )}
      </div>
      {invoices
        .filter((r) =>
          data.balances.some((b) => b.id === r.id && b.balance > 0),
        )
        .slice(0, 8)
        .map((r) => (
          <button key={r.id} onClick={() => onOpen(r.matter_id!)}>
            {r.payload.type === "INVOICE" ? r.payload.number : ""} · Ver cuenta
            del asunto
          </button>
        ))}
      <p className="muted">
        {costs?.unattributed_historical_usd > 0
          ? `Historico sin atribucion al estudio: USD ${Number(costs.unattributed_historical_usd).toFixed(4)}. `
          : ""}
        Sin convertir monedas. Los costos IA son estimaciones y reservas
        registradas, sujetos a conciliación con el proveedor.
      </p>
    </details>
  );
}
