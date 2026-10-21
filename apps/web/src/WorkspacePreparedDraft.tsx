import type { WorkspaceJob } from "../../../packages/workspace/src/tasks.js";
import WorkspaceQuality from "./WorkspaceQuality.js";

export default function WorkspacePreparedDraft({
  job,
  busy,
  error,
  notice,
  applied,
  onApply,
  onClose,
}: {
  job: WorkspaceJob;
  busy: boolean;
  error: string;
  notice: string;
  applied: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <section
      className="workspace-prepared-draft"
      aria-label="Versión propuesta junto al documento"
    >
      <header>
        <div>
          <strong>
            {job.result?.execution?.scope === "SELECTION"
              ? "Propuesta para el fragmento"
              : "Versión propuesta del documento"}
          </strong>
          <small>
            {applied
              ? "Insertada en la copia abierta · guardado automático"
              : job.result?.execution?.analysis_job_id ||
                  job.request.analysis_job_id
                ? "Basada en los hallazgos · todavía sin aplicar"
                : "Propuesta de texto · todavía sin aplicar"}
            {job.result?.simulated ? " · prueba offline" : ""}
          </small>
        </div>
        <button onClick={onClose} aria-label="Cerrar versión propuesta">
          ×
        </button>
      </header>
      <div className="workspace-prepared-actions">
        <button
          disabled={
            busy ||
            job.status !== "COMPLETED" ||
            applied ||
            job.result?.quality_control?.status === "CHANGES_REQUIRED"
          }
          onClick={onApply}
        >
          {applied ? "Versión insertada" : "Aplicar versión al documento"}
        </button>
        <small>
          {job.result?.execution?.scope === "SELECTION"
            ? "Reemplaza el fragmento seleccionado"
            : "Reemplaza el texto completo de la copia"}{" "}
          con formato básico. El original se conserva; Ctrl+Z deshace.
        </small>
      </div>
      <WorkspaceQuality job={job} />
      {job.result?.quality_control?.status === "CHANGES_REQUIRED" && (
        <p role="alert">
          El control detectó errores materiales pendientes. Pedile a Gabriel que
          corrija la propuesta antes de aplicarla.
        </p>
      )}
      {(error || notice) && (
        <p role={error ? "alert" : "status"}>{error || notice}</p>
      )}
      <details>
        <summary>Qué cambió y qué falta revisar</summary>
        <p>{job.result?.summary}</p>
        {job.result?.limitations.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </details>
      <div
        className="workspace-prepared-text"
        tabIndex={0}
        aria-label="Texto de la versión propuesta"
      >
        {job.result?.replacement_text}
      </div>
    </section>
  );
}
