import { useEffect, useRef, useState } from "react";
import type { Result } from "./MatterJunta.js";
import {
  deliberationSteps,
  duration,
  terminalStatuses,
  usd,
} from "./junta-presentation.js";
import { citationExplanation, lawyerError } from "./junta-lawyer-language.js";
export default function JuntaDeliberation({
  result,
  busy,
  startedAt,
  general = false,
}: {
  result: Result | null;
  busy: boolean;
  startedAt: number | null;
  general?: boolean;
}) {
  const [now, setNow] = useState(Date.now()),
    [expanded, setExpanded] = useState<string | null>(null);
  const active =
    busy || (!!result && !terminalStatuses.includes(result.status));
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active)
      panel.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  const stages = result?.stages ?? [];
  const repaired = stages.some(
    (s) => s.stage === "CONTEXT_CLASSIFICATION_REPAIR" && s.status === "PASS",
  );
  const stateOf = (id: string) =>
    id === "BUILDING_CONTEXT" && repaired
      ? "PASS"
      : id === "PRINCIPAL_ANALYSIS" &&
          stages.some(
            (stage) =>
              stage.stage === "ANALYSIS_METADATA_REPAIR" &&
              stage.status === "PASS",
          )
        ? "PASS"
        : (stages.filter((s) => s.stage === id).at(-1)?.status ?? "PENDING");
  const steps =
    general || result?.consultation_mode === "GENERAL"
      ? deliberationSteps.filter((step) => step.id !== "ROUTING_EVIDENCE")
      : deliberationSteps;
  const completed = steps.filter((step) => stateOf(step.id) === "PASS").length;
  const elapsed = active
    ? Math.max(
        result?.timing?.elapsed_ms ?? 0,
        now -
          (result?.timing?.started_at
            ? Date.parse(result.timing.started_at)
            : (startedAt ?? now)),
      )
    : (result?.timing?.elapsed_ms ?? result?.cost.latency_ms ?? 0);
  const current = stages.findLast((s) => s.status === "STARTED");
  const detail = deliberationSteps.find(
    (s) => s.id === (expanded ?? current?.stage),
  );
  const records = detail
    ? stages.filter(
        (s) =>
          s.stage === detail.id ||
          (detail.id === "BUILDING_CONTEXT" &&
            s.stage === "CONTEXT_CLASSIFICATION_REPAIR"),
      )
    : [];
  const outcome =
    detail?.id === "CHECKING_REFERENCES"
      ? citationExplanation(result?.citation_review)
      : detail?.id === "ADVERSARIAL_AUDIT" && result?.audit
        ? result.audit.findings.length
          ? `El auditor formuló ${result.audit.findings.length} observaciones. Revisalas antes de utilizar el informe.`
          : "No se registraron objeciones en la revisión disponible. Esto no garantiza ausencia de errores."
        : detail?.id === "PRINCIPAL_ANALYSIS" && result?.analysis
          ? "El borrador está redactado. Su conclusión y sus reservas requieren revisión del abogado responsable."
          : detail?.id === "BUILDING_CONTEXT" && result?.packet
            ? `Se ordenaron los antecedentes y se señalaron ${result.packet.missing_information?.length ?? 0} documentos o datos faltantes.`
            : detail?.id === "ROUTING_EVIDENCE" && result?.packet
              ? `Se seleccionaron ${result.packet.relevant_documents?.length ?? 0} documentos pertinentes para la consulta.`
              : null;
  return (
    <section
      ref={panel}
      className={`deliberation ${active ? "is-active" : ""} ${general ? "is-general" : ""}`}
      aria-label="Progreso de deliberación"
    >
      <div className="deliberation-header">
        <div>
          <span className="eyebrow">JUNTA JURÍDICA</span>
          <h3>
            {active ? (
              <>
                <span className="thinking-orbit" aria-hidden="true" />
                Deliberación en curso
              </>
            ) : result?.status === "HUMAN_REVIEW_PENDING" ? (
              "Deliberación finalizada"
            ) : result?.analysis ? (
              "Informe disponible · revisión pendiente"
            ) : (
              "Deliberación detenida"
            )}
          </h3>
          <p role="status">
            {active
              ? current
                ? deliberationSteps.find((s) => s.id === current.stage)
                    ?.description
                : "Preparando documentos y comprobando disponibilidad…"
              : result?.status === "HUMAN_REVIEW_PENDING"
                ? "Informe listo · revisión humana pendiente"
                : result?.analysis
                  ? "El borrador se conservó. Revisá las etapas pendientes antes de utilizarlo."
                  : "Revisá la etapa señalada antes de continuar."}
          </p>
        </div>
        <div className="deliberation-metrics">
          <div>
            <span>
              {active
                ? "Tiempo transcurrido"
                : result?.timing?.source === "STAGE_LATENCY_SUM"
                  ? "Tiempo de procesamiento"
                  : "Tiempo total"}
            </span>
            <strong className="elapsed-clock">{duration(elapsed)}</strong>
          </div>
          <div>
            <span>Costo estimado</span>
            <strong>{usd(result?.cost.estimated_total_usd)}</strong>
          </div>
        </div>
      </div>
      <progress
        aria-label="Etapas completadas"
        max={steps.length}
        value={completed}
      />
      <ol className="deliberation-steps">
        {steps.map((step, index) => {
          const state = stateOf(step.id);
          return (
            <li key={step.id} data-state={state}>
              <button
                aria-expanded={detail?.id === step.id}
                onClick={() =>
                  setExpanded(expanded === step.id ? null : step.id)
                }
              >
                <span className="step-dot" aria-hidden="true">
                  {state === "PASS"
                    ? "✓"
                    : state === "FAIL" || state === "BLOCKED"
                      ? "!"
                      : index + 1}
                </span>
                <strong>{step.name}</strong>
                <small>
                  {step.id === "BUILDING_CONTEXT" && repaired
                    ? "Relato revisado"
                    : state === "STARTED"
                      ? "En curso"
                      : state === "PASS"
                        ? "Tarea completada"
                        : state === "FAIL" || state === "BLOCKED"
                          ? "Requiere revisión"
                          : "A continuación"}
                </small>
              </button>
            </li>
          );
        })}
      </ol>
      {detail && (
        <div className="deliberation-detail">
          <strong>{detail.name}</strong>
          <span>{detail.description}</span>
          {stateOf(detail.id) === "PASS" && outcome && <p>{outcome}</p>}
          {records.map((s, i) => (
            <span key={i}>
              {s.status === "STARTED"
                ? "Trabajando…"
                : `Tiempo de la tarea: ${duration(s.latency_ms ?? 0)} · costo estimado ${usd(s.estimated_cost_usd)}`}
              {s.error_code ? " · " + lawyerError(s.error_code) : ""}
            </span>
          ))}
        </div>
      )}
      <small className="deliberation-footnote">
        {completed}/{steps.length} tareas completadas · tocá un rol para conocer
        su intervención. La Junta asiste al abogado responsable y no sustituye
        su revisión.
        {stages.some((s) => s.stage === "CONTEXT_CLASSIFICATION_REPAIR")
          ? " El tiempo total incluye la interrupción y la reanudación de esta consulta."
          : ""}
      </small>
    </section>
  );
}
