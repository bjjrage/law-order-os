import { useEffect, useId, useRef, useState } from "react";
import {
  workspaceAgents,
  canResumeIntegration,
  isWorkspaceAnalysis,
  hasWorkspaceAnalysis,
  type WorkspaceJob,
  type WorkspaceAttachment,
} from "../../../packages/workspace/src/tasks.js";
import { Avatar } from "./TeamEditor.js";
import WorkspaceVoice from "./WorkspaceVoice.js";
import WorkspaceQuality from "./WorkspaceQuality.js";
import AnalysisLevelPicker from "./AnalysisLevelPicker.js";
import { workspaceFailure } from "../../../packages/workspace/src/revision-intent.js";

type Props = {
  voiceScope: string;
  active: boolean;
  jobs: WorkspaceJob[];
  instruction: string;
  onInstruction: (value: string) => void;
  mode: string;
  onMode: (value: string) => void;
  library: boolean;
  onLibrary: (value: boolean) => void;
  busy: boolean;
  readOnly: boolean;
  saved: boolean;
  attachments: WorkspaceAttachment[];
  attachmentsLoading: boolean;
  attachmentIssues: string[];
  selection: string;
  rewrite: boolean;
  onClearSelection: () => void;
  onSend: () => void;
  onConfirm: (job: WorkspaceJob) => void;
  onResumeIntegration: (job: WorkspaceJob) => void;
  onApply: (job: WorkspaceJob) => void;
  onPrepareReview: () => void;
  onOpenDraft: (job: WorkspaceJob) => void;
  onPanel: (value: string) => void;
};
const person = (id: string) => workspaceAgents.find((a) => a.id === id);
const isAnalysis = isWorkspaceAnalysis;
function FailureDetail({ job }: { job: WorkspaceJob }) {
  const d = job.result?.failure_details;
  return (
    <details>
      <summary>Detalle de la interrupción</summary>
      <small>{job.error_code}</small>
      {job.result?.failure_context && (
        <p>
          {job.result.failure_context.category} ·{" "}
          {job.result.failure_context.error_name}
          {job.result.failure_context.native_code
            ? ` · ${job.result.failure_context.native_code}`
            : ""}
          {job.result.failure_context.source
            ? ` · ${job.result.failure_context.source}`
            : ""}
        </p>
      )}
      {d && (
        <p>
          Motivo: {d.incomplete_reason}. Límite: {d.max_output_tokens} tokens.
          Usados: {d.output_tokens ?? "sin dato"}; razonamiento:{" "}
          {d.reasoning_tokens ?? "sin dato"}.
        </p>
      )}
    </details>
  );
}
function BriefReply({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 420;
  return (
    <div className="workspace-brief-reply">
      <p>
        {!long || expanded
          ? text
          : text.slice(0, 400).replace(/\s+\S*$/, "") + "…"}
      </p>
      {long && (
        <button aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Reducir explicación" : "Ampliar explicación"}
        </button>
      )}
    </div>
  );
}
const stateLabel = (job: WorkspaceJob) =>
  job.status === "RUNNING"
    ? "Trabajando…"
    : job.result?.quality_control?.status === "CHANGES_REQUIRED"
      ? "Requiere correcciones"
      : job.status === "COMPLETED"
        ? "Terminado"
        : job.status === "OUTCOME_UNKNOWN"
          ? "Ejecución interrumpida · no se reintenta"
          : "No se pudo completar";
export default function WorkspaceConversation(p: Props) {
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);
  const [focusRequest, setFocusRequest] = useState(0);
  const message = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const messageId = useId();
  const planJob = p.jobs.find(
    (j) => j.request.action === "PLAN" && j.result?.team_plan,
  );
  const latestPlan = planJob?.result?.team_plan;
  const analysis = p.jobs.find((j) => hasWorkspaceAnalysis(j));
  const activeJob = p.jobs.find((j) => j.status === "RUNNING");
  const progress =
    activeJob?.result?.team_progress ?? analysis?.result?.team_progress;
  const activeRole = activeJob?.result?.team_progress?.active;
  const conversational =
    !p.jobs.length || p.jobs[0]?.request.workflow_version === 4;
  const running = p.jobs.some((j) => j.status === "RUNNING");
  const working = p.busy || running;
  const taskBlocked = p.busy || running || p.readOnly || p.attachmentsLoading;
  const blocked = taskBlocked || voiceBusy;
  const spokenReply =
    p.jobs.find((j) => j.status === "COMPLETED" && j.result?.summary)?.result
      ?.summary ?? "";
  const changeKey = p.jobs
    .map((j) => `${j.id}:${j.status}:${j.result?.team_progress?.active ?? ""}`)
    .join();
  useEffect(() => {
    if (transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [changeKey]);
  useEffect(() => {
    setComposerOpen(!working);
  }, [working]);
  useEffect(() => {
    if (composerOpen && focusRequest) message.current?.focus();
  }, [composerOpen, focusRequest]);
  function prepareMessage(instruction: string) {
    p.onInstruction(instruction);
    setComposerOpen(true);
    setFocusRequest((value) => value + 1);
  }
  return (
    <>
      {working && (
        <div className="workspace-task-progress" role="status">
          <span className="workspace-working-dot" aria-hidden="true" />
          <div>
            <strong>
              {activeRole === "integration"
                ? "Integrando los aportes"
                : activeRole
                  ? `${person(activeRole)?.name ?? "El equipo"} ${activeJob?.result?.execution ? "está preparando la propuesta" : "está analizando"}`
                  : "Procesando tu solicitud"}
            </strong>
            <small>
              El progreso y las propuestas aparecen en la conversación.
            </small>
          </div>
        </div>
      )}
      {!conversational && (
        <ol className="workspace-case-steps" aria-label="Etapas del trabajo">
          {(latestPlan?.kind === "CONTINUE"
            ? [
                "Pedido interpretado",
                planJob?.status === "FAILED" ||
                planJob?.status === "OUTCOME_UNKNOWN"
                  ? "Redacción interrumpida"
                  : "Preparando propuesta",
                "Revisá la propuesta",
              ]
            : ["Presentá el caso", "Confirmá el equipo", "Revisá el análisis"]
          ).map((label, i) => (
            <li
              key={label}
              aria-current={
                i ===
                (latestPlan?.kind === "CONTINUE"
                  ? working || !planJob?.result?.replacement_text
                    ? 1
                    : 2
                  : analysis
                    ? 2
                    : latestPlan?.kind === "TEAM"
                      ? 1
                      : 0)
                  ? "step"
                  : undefined
              }
            >
              <b>{i + 1}</b>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      )}
      {latestPlan?.kind === "TEAM" && (
        <div className="workspace-team-roster" aria-label="Equipo convocado">
          {latestPlan.participants.map((member) => (
            <div
              key={member.agent_id}
              title={`${person(member.agent_id)?.expertise}. ${member.question}`}
            >
              <Avatar id={member.agent_id} size={28} />
              <span>
                <strong>{person(member.agent_id)?.name}</strong>
                <small>
                  {activeRole === member.agent_id
                    ? "Analizando…"
                    : progress?.completed.includes(member.agent_id)
                      ? "Aporte recibido"
                      : latestPlan.lead_id === member.agent_id
                        ? "Titular"
                        : "Convocado"}
                </small>
              </span>
            </div>
          ))}
          {activeRole === "integration" && (
            <small role="status">Integrando aportes…</small>
          )}
        </div>
      )}
      {latestPlan?.kind === "CONTINUE" && latestPlan.continuation && (
        <div
          className="workspace-team-roster"
          aria-label="Responsable elegido por Gabriel"
        >
          <Avatar id={latestPlan.continuation.agent_id} size={28} />
          <span>
            <strong>{person(latestPlan.continuation.agent_id)?.name}</strong>
            <small>
              {working ? "Preparando propuesta" : "Encargo de Gabriel"}
            </small>
          </span>
        </div>
      )}

      <>
        <div
          className="workspace-conversation"
          ref={transcript}
          role="log"
          aria-label="Conversación con Gabriel"
        >
          {!p.jobs.length && (
            <div className="workspace-conversation-empty">
              <Avatar id="gabriel" size={46} />
              <h2>Trabajemos sobre el documento</h2>
              <p>
                Contame qué necesita tu cliente. Puedo responder una pregunta,
                organizar el equipo o preparar una propuesta sobre el texto
                abierto.
              </p>
              <div className="workspace-starter-actions">
                <button
                  aria-controls={messageId}
                  onClick={() =>
                    prepareMessage(
                      "Analizá el documento abierto: riesgos para nuestro cliente, puntos de conflicto y alternativas para negociar.",
                    )
                  }
                >
                  ✦ Analizar el documento
                </button>
                <button
                  aria-controls={messageId}
                  onClick={() =>
                    prepareMessage(
                      "Quiero redactar un documento. Ayudame a definir sus partes y lo que falta.",
                    )
                  }
                >
                  ＋ Preparar un documento
                </button>
              </div>
              <small>Elegí un pedido, ajustalo y enviáselo a Gabriel.</small>
            </div>
          )}
          {[...p.jobs].reverse().map((job) => {
            const plan = job.result?.team_plan,
              executed = p.jobs.some((j) => j.request.plan_id === job.id);
            if (
              canResumeIntegration(job) &&
              p.jobs.some(
                (j) =>
                  j.request.resume_job_id === job.id &&
                  j.status === "COMPLETED",
              )
            )
              return (
                <section key={job.id} className="workspace-chat-turn">
                  <details className="workspace-chat-answer">
                    <summary>
                      Integración inicial recuperada · aportes conservados
                    </summary>
                    <p>
                      La continuación se completó sin volver a ejecutar a los
                      especialistas.
                    </p>
                    <small>{job.error_code}</small>
                  </details>
                </section>
              );
            return (
              <section key={job.id} className="workspace-chat-turn">
                {(!isAnalysis(job) || job.request.workflow_version === 4) && (
                  <div className="workspace-chat-user">
                    <small>Vos</small>
                    <p>{job.request.instruction}</p>
                  </div>
                )}
                <article className="workspace-chat-answer">
                  <header>
                    <Avatar
                      id={
                        job.request.action === "PLAN"
                          ? "gabriel"
                          : job.request.agent_id
                      }
                      size={26}
                    />
                    <strong>
                      {job.request.action === "PLAN"
                        ? "Gabriel"
                        : (person(job.request.agent_id)?.name ?? "Equipo")}
                    </strong>
                    <small>
                      {job.result?.simulated
                        ? "Prueba offline · no IA"
                        : stateLabel(job)}
                    </small>
                  </header>
                  {(job.status === "FAILED" ||
                    job.status === "OUTCOME_UNKNOWN") && (
                    <p role="alert">
                      {workspaceFailure(job.error_code)} El contrato y los
                      hallazgos anteriores se conservan.
                    </p>
                  )}
                  {isAnalysis(job) ? (
                    <>
                      <BriefReply
                        text={
                          job.status === "RUNNING"
                            ? job.result?.team_progress?.active ===
                              "integration"
                              ? job.result.summary
                              : "El equipo está preparando los aportes sobre esta versión del documento. Podés seguir trabajando; los resultados conservarán su versión."
                            : job.status === "COMPLETED"
                              ? (job.result?.summary ?? "Resultado disponible.")
                              : hasWorkspaceAnalysis(job)
                                ? "El análisis está conservado. La tarea posterior no terminó."
                                : "No hay una integración completa."
                        }
                      />
                      {hasWorkspaceAnalysis(job) &&
                        !!job.result?.findings.length &&
                        job.id === analysis?.id && (
                          <button
                            className="workspace-review-cta"
                            onClick={() => p.onPanel("findings")}
                          >
                            Revisar {job.result?.findings.length ?? 0} hallazgos
                            en el documento →
                          </button>
                        )}
                      {job.status === "COMPLETED" &&
                        job.id === analysis?.id &&
                        !!job.result?.findings.length && (
                          <button
                            disabled={blocked || !p.saved}
                            onClick={p.onPrepareReview}
                          >
                            Preparar versión con estos hallazgos ·{" "}
                            {p.mode === "LIVE" ? "hasta USD 0,60" : "USD 0"} →
                          </button>
                        )}
                      {job.status !== "RUNNING" &&
                        job.status !== "COMPLETED" &&
                        !!job.result?.team_outputs?.length && (
                          <button onClick={() => p.onPanel("findings")}>
                            Ver aportes conservados →
                          </button>
                        )}
                      {canResumeIntegration(job) && (
                        <div className="workspace-team-proposal">
                          <p>
                            El contrato y los aportes superaron el tamaño de una
                            sola integración. Completá la integración por
                            bloques usando los aportes guardados.
                          </p>
                          <button
                            className="word-send"
                            disabled={
                              blocked ||
                              p.jobs.some(
                                (j) => j.request.resume_job_id === job.id,
                              )
                            }
                            onClick={() => p.onResumeIntegration(job)}
                          >
                            {p.jobs.some(
                              (j) => j.request.resume_job_id === job.id,
                            )
                              ? "Continuación registrada"
                              : `Completar integración · ${job.request.execution_mode === "OFFLINE_TEST" ? "USD 0" : "hasta USD " + (Math.ceil(52 / (job.context.team_plan!.participants.length + 1)) / 100).toFixed(2).replace(".", ",")}`}
                          </button>
                          <small>
                            Continúa desde los aportes recibidos. No vuelve a
                            ejecutar a los especialistas.
                          </small>
                        </div>
                      )}
                      {job.error_code && <FailureDetail job={job} />}
                    </>
                  ) : job.status === "FAILED" ||
                    job.status === "OUTCOME_UNKNOWN" ? null : (
                    <BriefReply
                      text={
                        job.result?.summary ??
                        (job.status === "RUNNING"
                          ? "Leyendo tu consulta y el documento…"
                          : workspaceFailure(job.error_code))
                      }
                    />
                  )}
                  {!isAnalysis(job) && job.error_code && (
                    <FailureDetail job={job} />
                  )}
                  {job.status === "FAILED" &&
                    job.request.action === "ANALYZE" &&
                    !!analysis?.result?.findings.length &&
                    !job.result?.execution && (
                      <button
                        disabled={blocked || !p.saved}
                        onClick={p.onPrepareReview}
                      >
                        Preparar desde el análisis actual ·{" "}
                        {p.mode === "LIVE" ? "hasta USD 0,60" : "USD 0"} →
                      </button>
                    )}
                  {job.request.action === "PLAN" &&
                    job.request.workflow_version !== 4 &&
                    plan?.kind === "TEAM" && (
                      <div
                        className="workspace-team-proposal"
                        aria-label="Equipo propuesto por Gabriel"
                      >
                        {plan.participants.map((member) => (
                          <div key={member.agent_id}>
                            <Avatar id={member.agent_id} size={32} />
                            <span>
                              <strong>
                                {person(member.agent_id)?.name}
                                {plan.lead_id === member.agent_id
                                  ? " · titular"
                                  : ""}
                              </strong>
                              <small>{member.question}</small>
                              <details>
                                <summary>Por qué participa</summary>
                                <p>{member.reason}</p>
                              </details>
                            </span>
                          </div>
                        ))}
                        {plan.missing_inputs.length > 0 && (
                          <details>
                            <summary>
                              Datos pendientes · {plan.missing_inputs.length}
                            </summary>
                            {plan.missing_inputs.map((s) => (
                              <p key={s}>{s}</p>
                            ))}
                          </details>
                        )}
                        <button
                          className="primary word-send"
                          disabled={
                            blocked || executed || job.id !== planJob?.id
                          }
                          onClick={() => p.onConfirm(job)}
                        >
                          {executed
                            ? "Equipo confirmado · ejecución registrada"
                            : job.id !== planJob?.id
                              ? "Propuesta anterior"
                              : job.request.execution_mode === "OFFLINE_TEST"
                                ? "Confirmar equipo y probar análisis · USD 0"
                                : "Confirmar equipo y analizar · hasta USD 0,52"}
                        </button>
                        {!executed && (
                          <small>
                            Para cambiar el enfoque, contáselo a Gabriel abajo.
                          </small>
                        )}
                      </div>
                    )}
                  {!!job.result?.agent_trace?.length && (
                    <details>
                      <summary>
                        Trabajo de este pedido · {job.result.agent_trace.length}{" "}
                        tareas
                      </summary>
                      {job.result.agent_trace.map((task, i) => (
                        <p key={i}>
                          <strong>
                            {(
                              {
                                consult_specialist: "Consulta a especialista",
                                analyze_with_specialists: "Análisis encargado",
                                prepare_document: "Preparación del documento",
                                read_saved_work: "Trabajo anterior consultado",
                                list_saved_work: "Historial consultado",
                                study_work: "Trabajo y permisos consultados",
                                assign_task: "Asignación de trabajo humano",
                                assign_review: "Revisión humana encargada",
                                update_task: "Avance de tarea",
                                request_direction: "Solicitud a Dirección",
                                resolve_direction:
                                  "Solicitud atendida por Dirección",
                              } as Record<string, string>
                            )[task.tool] ?? task.tool}
                          </strong>
                          {task.agent_id
                            ? ` · ${person(task.agent_id)?.name ?? task.agent_id}`
                            : ""}
                          {` · ${task.status === "COMPLETED" ? "Completado" : task.status === "REJECTED" ? "Requiere aclaración" : "En curso"}`}
                        </p>
                      ))}
                    </details>
                  )}
                  {job.result?.replacement_text &&
                    (job.request.analysis_job_id || job.result?.execution ? (
                      <button onClick={() => p.onOpenDraft(job)}>
                        Revisar versión junto al documento →
                      </button>
                    ) : (
                      <>
                        <details className="workspace-rewrite-preview" open>
                          <summary>
                            Texto propuesto · todavía sin aplicar
                          </summary>
                          <div className="word-diff">
                            <p>{job.result.replacement_text}</p>
                          </div>
                        </details>
                        <button
                          disabled={blocked || !p.saved}
                          onClick={() => p.onApply(job)}
                        >
                          Aplicar propuesta al documento
                        </button>
                      </>
                    ))}
                  <WorkspaceQuality job={job} />
                  {job.request.action !== "PLAN" &&
                    !isAnalysis(job) &&
                    !!job.result?.findings.length && (
                      <button onClick={() => p.onPanel("findings")}>
                        Ver puntos para revisar →
                      </button>
                    )}
                </article>
              </section>
            );
          })}
          {p.busy && !running && (
            <p role="status" className="workspace-chat-thinking">
              Gabriel está trabajando…
            </p>
          )}
        </div>
        <details
          className="workspace-chat-composer workspace-message-editor"
          open={composerOpen}
          onToggle={(e) => setComposerOpen(e.currentTarget.open)}
        >
          <summary>
            <strong>
              {working ? "Solicitud en curso" : "Tu mensaje a Gabriel"}
            </strong>
            <span>{composerOpen ? "Plegar ▾" : "Escribir ▴"}</span>
          </summary>
          <div className="workspace-compose-content">
            <AnalysisLevelPicker disabled={working || p.busy || p.readOnly} />
            {(p.selection || p.rewrite) && (
              <div className="workspace-chat-context">
                <span>
                  {p.rewrite
                    ? "Propuesta de redacción"
                    : "Fragmento seleccionado"}
                  {p.selection ? ` · ${p.selection.length} caracteres` : ""}
                </span>
                <button
                  aria-label="Quitar selección de la consulta"
                  onClick={p.onClearSelection}
                >
                  ×
                </button>
              </div>
            )}
            {!!p.attachments.length && (
              <small className="workspace-chat-attachments">
                ▤ Documento abierto + {p.attachments.length} anexo
                {p.attachments.length > 1 ? "s" : ""}
              </small>
            )}
            {p.attachmentsLoading && (
              <small role="status">Leyendo archivos…</small>
            )}
            {p.attachmentIssues.map((issue, i) => (
              <p key={i} role="alert" className="error">
                {issue}
              </p>
            ))}
            <div className="workspace-compose-heading">
              <small>Enter para enviar · Shift+Enter para otra línea</small>
            </div>
            <div className="workspace-chat-entry">
              <textarea
                ref={message}
                id={messageId}
                aria-label="Tu mensaje a Gabriel"
                placeholder="Preguntá, pedí un análisis o indicá qué cambiar…"
                value={p.instruction}
                onChange={(e) => p.onInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (!blocked && p.instruction.trim().length > 0) p.onSend();
                  }
                }}
              />
              <div className="workspace-chat-send-row">
                <small>
                  {p.mode === "LIVE"
                    ? "Gabriel y ejecución · hasta USD 0,60 por mensaje"
                    : "Offline · USD 0"}
                </small>
                <button
                  className="primary word-send"
                  disabled={blocked || !p.instruction.trim()}
                  onClick={p.onSend}
                >
                  {p.busy
                    ? "En curso…"
                    : p.mode === "OFFLINE_TEST"
                      ? "Ejecutar prueba offline"
                      : "Enviar →"}
                </button>
              </div>
            </div>
            <WorkspaceVoice
              key={p.voiceScope + p.mode}
              instruction={p.instruction}
              onInstruction={p.onInstruction}
              response={spokenReply}
              active={p.active && composerOpen}
              disabled={taskBlocked}
              offline={p.mode !== "LIVE"}
              onBusy={setVoiceBusy}
            />
            <details className="word-mode">
              <summary>
                Opciones ·{" "}
                {p.mode === "LIVE" ? "IA configurada" : "prueba offline"}
              </summary>
              <label className="word-check">
                <input
                  type="checkbox"
                  checked={p.library}
                  onChange={(e) => p.onLibrary(e.target.checked)}
                />
                Consultar Biblioteca local
              </label>
              <select
                aria-label="Modo de ejecución del editor"
                value={p.mode}
                onChange={(e) => p.onMode(e.target.value)}
              >
                <option value="LIVE">
                  IA configurada · llamada autorizada al enviar
                </option>
                <option value="OFFLINE_TEST">
                  Prueba offline · resultado sintético, no IA
                </option>
              </select>
            </details>
          </div>
        </details>
      </>
    </>
  );
}
