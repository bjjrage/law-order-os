import {
  workspaceAgents,
  type WorkspaceJob,
} from "../../../packages/workspace/src/tasks.js";
import { analysisLevels } from "../../../packages/workspace/src/analysis-levels.js";

export default function WorkspaceQuality({ job }: { job: WorkspaceJob }) {
  const result = job.result,
    control = result?.quality_control;
  if (!result?.specialist_bindings?.length && !control) return null;
  const bindings = [
    ...new Map(
      result?.specialist_bindings?.map((b) => [
        `${b.agent_id}:${b.pack_id}`,
        b,
      ]) ?? [],
    ).values(),
  ];
  return (
    <details
      className="workspace-quality"
      data-status={control?.status ?? "PENDING"}
      aria-label="Especialidades y control del trabajo"
    >
      <summary>
        {control
          ? control.status === "CHANGES_REQUIRED"
            ? "Santiago · requiere correcciones"
            : control.status === "REVIEW_REQUIRED"
              ? "Santiago · revisión con pendientes"
              : "Santiago · revisión IA realizada"
          : "Especialistas · control pendiente"}
      </summary>
      {result?.execution_profile && <p>
        Nivel {analysisLevels[result.execution_profile.level].label} · {result.execution_profile.analyst_model} · {result.execution_profile.reasoning_effort}.
        Auditoría y control de citas comunes a los tres niveles.
      </p>}
      {bindings.map((b) => (
        <p key={`${b.agent_id}:${b.pack_id}`}>
          <strong>
            {workspaceAgents.find((a) => a.id === b.agent_id)?.name ??
              b.agent_id}
          </strong>{" "}
          · {b.pack_label ?? b.pack_id}
          <br />
          <small>
            Herramientas documentales ejecutadas: {b.executed_tools.length}.
            Configuración experimental; calidad jurídica no acreditada.
          </small>
        </p>
      ))}
      {control && (
        <>
          {!!control.audit_attempts?.some((attempt) => attempt.fallback_from) && (
            <p>Se usó Luna xhigh como respaldo de Gemini para esta revisión.</p>
          )}
          <small>Modelo de la última revisión: {control.model_id}.</small>
          <p>{control.audit.summary}</p>
          {!!control.upstream_controls?.length && (
            <p>
              Se conservan pendientes de {control.upstream_controls.length}{" "}
              controles anteriores de este trabajo. La respuesta final no los da
              por resueltos.
            </p>
          )}
          {control.audit.issues.map((issue, i) => (
            <div key={i}>
              <strong>{issue.problem}</strong>
              {control.audit_anchors?.[i]?.quote_match === false && (
                <small>
                  Observación sin localizador validado; requiere revisión.
                </small>
              )}
              {issue.quote && <blockquote>{issue.quote}</blockquote>}
              <p>{issue.requested_change}</p>
            </div>
          ))}
          <p>
            {control.reference_checks.filter((c) => c.quote_match).length}/
            {control.reference_checks.length} citas coinciden con los pasajes
            recibidos.{" "}
            {control.document_checks.filter((c) => c.quote_match).length}/
            {control.document_checks.length} anclajes documentales coinciden.
          </p>
          <small>
            Se controlaron {control.checked_outputs.length} salidas, incluida la
            del auditor. Identidad de fuentes y vigencia sin autenticar;
            revisión jurídica humana pendiente.
          </small>
        </>
      )}
    </details>
  );
}
