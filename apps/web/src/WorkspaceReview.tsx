import { useState } from "react";
import type { Editor } from "@tiptap/core";
import type { WorkspaceJob } from "../../../packages/workspace/src/tasks.js";
import type { ReviewDecision } from "../../../packages/workspace/src/review.js";
import { locateQuote } from "../../../packages/workspace/src/review-marks.js";
import WorkspaceQuality from "./WorkspaceQuality.js";

type Props = {
  job?: WorkspaceJob;
  editor: Editor | null;
  range: { from: number; to: number } | null;
  index: number;
  decisions: ReviewDecision[];
  blocked: boolean;
  error: string;
  notice: string;
  onSelect: (index: number) => void;
  onApply: (index: number) => void;
  onDecision: (index: number, status: "LINKED" | "DISMISSED" | "OPEN") => void;
  onDiscuss: (index: number, instruction: string) => void;
  onPanel: (value: string) => void;
  onClose: () => void;
};
const severity = (s?: string) =>
  s === "HIGH"
    ? "Riesgo alto"
    : s === "MEDIUM"
      ? "Riesgo medio"
      : s === "LOW"
        ? "Riesgo bajo"
        : "Revisar";
export default function WorkspaceReview(p: Props) {
  const [discussion, setDiscussion] = useState("");
  const findings = p.job?.result?.findings ?? [],
    f = findings[p.index];
  const decision = (i: number) =>
    p.decisions.find((d) => d.job_id === p.job?.id && d.finding_index === i);
  function status(i: number) {
    const d = decision(i);
    if (
      d?.status === "APPLIED" &&
      p.editor &&
      !locateQuote(p.editor.state.doc, d.quote)
    )
      return "OPEN";
    return d?.status ?? "OPEN";
  }
  const state = status(p.index),
    range = p.range;
  const original =
    range && p.editor
      ? p.editor.state.doc.textBetween(range.from, range.to, "\n")
      : f?.quote;
  const done = findings.filter((_, i) =>
    ["APPLIED", "DISMISSED"].includes(status(i)),
  ).length;
  const selection = p.editor?.state.selection;
  return (
    <section
      className="workspace-review-canvas"
      aria-label="Revisión junto al documento"
    >
      <header className="review-canvas-header">
        <span>
          <strong>Revisión del documento</strong>
          <small>
            {done}/{findings.length} resueltas · los cambios los decidís vos
          </small>
        </span>
        <button aria-label="Cerrar revisión central" onClick={p.onClose}>
          ×
        </button>
      </header>
      {p.job && <WorkspaceQuality job={p.job} />}
      {p.job?.result?.quality_control?.status === "CHANGES_REQUIRED" && (
        <p role="alert">
          El análisis conserva correcciones pendientes. Podés revisarlo y pedir
          ajustes; aplicá las alternativas después de corregirlo.
        </p>
      )}
      {findings.length ? (
        <>
          <div className="review-controls">
            <button
              disabled={p.index === 0}
              aria-label="Observación anterior"
              onClick={() => p.onSelect(p.index - 1)}
            >
              ←
            </button>
            <label>
              Observación{" "}
              <select
                aria-label="Elegir observación"
                value={p.index}
                onChange={(e) => p.onSelect(Number(e.target.value))}
              >
                {findings.map((f, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {f.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={p.index >= findings.length - 1}
              aria-label="Observación siguiente"
              onClick={() => p.onSelect(p.index + 1)}
            >
              →
            </button>
          </div>
          <nav className="review-index" aria-label="Mapa de observaciones">
            {findings.map((f, i) => (
              <button
                key={i}
                title={`${i + 1}. ${f.title}`}
                aria-label={`Revisar observación ${i + 1}: ${f.title}`}
                aria-pressed={i === p.index}
                className={`severity-${(f.severity ?? "info").toLowerCase()} status-${status(i).toLowerCase()}`}
                onClick={() => p.onSelect(i)}
              >
                {["APPLIED", "DISMISSED"].includes(status(i)) ? "✓ " : ""}
                {i + 1}
              </button>
            ))}
          </nav>
          {f && (
            <article
              className="review-active-finding"
              key={`${p.job!.id}:${p.index}`}
            >
              <div className="review-finding-heading">
                <span
                  className={`review-risk severity-${(f.severity ?? "info").toLowerCase()}`}
                >
                  {severity(f.severity)}
                </span>
                <span>
                  {state === "APPLIED"
                    ? "Cambio aplicado"
                    : state === "DISMISSED"
                      ? "Descartada"
                      : range
                        ? "Vinculada al documento"
                        : f.source_id !== "EDITOR"
                          ? "Referencia de un anexo"
                          : "Necesita ubicar el pasaje"}
                </span>
              </div>
              <h2>{f.title}</h2>
              <p className="review-impact">{f.detail}</p>
              <div className="review-comparison">
                <section>
                  <h3>Texto observado</h3>
                  <blockquote>
                    {original || "No se incluyó una cita textual."}
                  </blockquote>
                  {range && (
                    <button onClick={() => p.onSelect(p.index)}>
                      Ver pasaje marcado ↗
                    </button>
                  )}
                </section>
                <section className="review-alternative">
                  <h3>Alternativa propuesta</h3>
                  <p>
                    {f.proposal ||
                      "Requiere una decisión o información adicional; no hay un reemplazo propuesto."}
                  </p>
                </section>
              </div>
              {!range && !["APPLIED", "DISMISSED"].includes(state) && (
                <div className="review-link-help">
                  <p>
                    {f.source_id !== "EDITOR"
                      ? "Esta observación corresponde a otra fuente. Abrí su copia editable antes de modificarla."
                      : "La cita no tiene una coincidencia única. Seleccioná la cláusula correcta en el documento para vincularla; no se reemplaza texto por aproximación."}
                  </p>
                  {f.source_id === "EDITOR" && (
                    <button
                      disabled={p.blocked || !selection || selection.empty}
                      onClick={() => p.onDecision(p.index, "LINKED")}
                    >
                      Vincular selección del documento
                    </button>
                  )}
                </div>
              )}
              <div className="review-primary-actions">
                {["APPLIED", "DISMISSED"].includes(state) ? (
                  <button
                    disabled={p.blocked}
                    onClick={() => p.onDecision(p.index, "OPEN")}
                  >
                    Reabrir observación
                  </button>
                ) : (
                  <>
                    <button
                      className="primary"
                      disabled={
                        p.blocked ||
                        !range ||
                        !f.proposal ||
                        p.job?.result?.quality_control?.status ===
                          "CHANGES_REQUIRED"
                      }
                      onClick={() => p.onApply(p.index)}
                    >
                      Aplicar alternativa
                    </button>
                    <button
                      disabled={p.blocked}
                      onClick={() => p.onDecision(p.index, "DISMISSED")}
                    >
                      Descartar observación
                    </button>
                  </>
                )}
                <small>
                  {state === "APPLIED"
                    ? "Guardado en el documento · Ctrl+Z deshace el texto"
                    : "El original se conserva. Aplicar modifica la copia abierta."}
                </small>
              </div>
              <details className="review-discussion">
                <summary>
                  Discutir / ajustar esta observación con el equipo
                </summary>
                <textarea
                  aria-label="Consulta sobre la observación"
                  value={discussion}
                  onChange={(e) => setDiscussion(e.target.value)}
                  placeholder="¿Qué querés aclarar o cambiar de esta alternativa?"
                />
                <button
                  disabled={p.blocked || !range || !discussion.trim()}
                  onClick={() => {
                    p.onDiscuss(p.index, discussion);
                    setDiscussion("");
                  }}
                >
                  Preparar consulta sobre este pasaje →
                </button>
              </details>
            </article>
          )}
        </>
      ) : (
        <div className="review-empty">
          <h2>El documento y sus observaciones, juntos</h2>
          <p>
            Presentá el caso a Gabriel y confirmá el equipo. El análisis abrirá
            esta revisión y marcará los pasajes del documento.
          </p>
          <button onClick={() => p.onPanel("assistant")}>
            Presentar el caso →
          </button>
        </div>
      )}
      {(p.error || p.notice) && (
        <p
          className={`review-feedback ${p.error ? "error" : ""}`}
          role={p.error ? "alert" : "status"}
        >
          {p.error || p.notice}
        </p>
      )}
      <footer className="review-canvas-footer">
        <details>
          <summary>Fuentes y controles del análisis</summary>
          <p>
            {p.job?.result?.citation_check.length
              ? `${p.job.result.citation_check.filter((c) => c.quote_match).length}/${p.job.result.citation_check.length} citas coinciden textualmente con sus fuentes.`
              : "No se cotejaron citas jurídicas."}{" "}
            Interpretación y vigencia pendientes de revisión humana.
          </p>
          <button onClick={() => p.onPanel("sources")}>
            Consultar fuentes
          </button>
          {p.job?.result?.limitations.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </details>
      </footer>
    </section>
  );
}
