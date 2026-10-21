import { useEffect, useRef, useState } from "react";
import type {
  Matter,
  Document,
  Draft,
} from "../../../os-core/src/contracts.js";
import { api, content, localMode, saveBlob } from "./api.js";
import { MAX_DOCUMENTS } from "./document-policy.js";
import TeamEditor, { Avatar } from "./TeamEditor.js";
import ContractualPilot from "./ContractualPilot.js";
import DocumentText from "./DocumentText.js";
import TeamDocumentUpload from "./TeamDocumentUpload.js";
import TeamDocuments from "./TeamDocuments.js";
import WorkProduct from "./WorkProduct.js";
import { strToU8, zipSync } from "fflate";
import { buildOfflineComparison } from "./specialist-evaluation.js";
import {
  personas,
  proposedParticipant,
  suggestTeam,
  TeamConfigSchema,
  sameTeamConfig,
  loadPack,
  type TeamConfig,
  type TeamPlan,
  type TeamAssignment,
} from "./specialist-engine.js";
import type { TeamView, TeamDocumentInfo } from "./local-team.js";
import { asuncionDate } from "./local-dates.js";

const empty: TeamView = {
  assignment: null,
  assignment_version: 0,
  plans: [],
  runs: [],
};
const messages: Record<string, string> = {
  TEAM_ASSIGNMENT_CONFLICT:
    "El equipo cambió. Actualizá antes de confirmar nuevamente.",
  TEAM_OWNER_CHANGED: "Cambió el responsable humano del asunto.",
  TEAM_RESPONSIBLE_REQUIRED:
    "La ejecución corresponde al responsable humano del asunto.",
  TEAM_PLAN_OUTDATED:
    "Cambió el equipo o la evidencia. Prepará una nueva consulta.",
  TEAM_PLAN_EXPIRED: "La preparación venció. Prepará nuevamente.",
  TEAM_PACK_NOT_ENABLED:
    "Uno de los paquetes seleccionados aún no tiene ejecución local habilitada.",
  TEAM_EVIDENCE_LIMIT:
    "El texto extraído seleccionado supera 4 MB. Los originales completos se conservan; dividí la revisión en encargos.",
  TEAM_TEXT_ONLY: "Revisá que el archivo de texto tenga codificación UTF-8.",
  TEAM_EXTRACTION_REQUIRED:
    "El documento necesita extracción de texto antes de preparar la consulta.",
  TEAM_EXTRACTION_INCOMPLETE:
    "Hay páginas sin texto legible. El original está guardado; incorporá una copia con texto/OCR antes de analizarlo.",
  TEAM_EXTRACTION_REVIEW_REQUIRED:
    "Revisá y confirmá las observaciones de extracción antes de preparar.",
  TEAM_INVALID_INPUT:
    "Revisá la pregunta, las cuestiones de cada integrante y la confirmación de datos sintéticos.",
  ACCESS_DENIED: "No tenés permiso para esta acción.",
  VERSION_CONFLICT:
    "El borrador cambió. Actualizá antes de controlar sus referencias.",
  TEAM_DOCUMENT_CHANGED:
    "El archivo cambió en otra pestaña. Volvé a abrir el asunto antes de eliminarlo o restaurarlo.",
  TEAM_DOCUMENT_IS_DRAFT:
    "Los borradores se gestionan desde la pestaña Borradores.",
};
function errorText(reason: unknown) {
  return (
    messages[reason instanceof Error ? reason.message : ""] ??
    "No se pudo completar la operación. Se conserva el trabajo guardado; revisá datos y permisos."
  );
}
function configProblem(config: TeamConfig): string | null {
  const parsed = TeamConfigSchema.safeParse(config);
  if (parsed.success) return null;
  const field = parsed.error.issues[0]?.path;
  if (field?.[0] === "question")
    return "Escribí una pregunta de entre 15 y 2000 caracteres.";
  if (field?.[0] === "participants" && typeof field[1] === "number") {
    const personaId = config.participants[field[1]]?.persona_id;
    const name =
      personas.find((p) => p.id === personaId)?.name ?? "cada especialista";
    if (field[2] === "question")
      return `Completá la cuestión de ${name} con entre 15 y 2000 caracteres en Modificar equipo.`;
    if (field[2] === "reason")
      return `Completá el motivo de participación de ${name} con entre 8 y 600 caracteres en Modificar equipo.`;
  }
  return "Revisá los integrantes, el titular y las cuestiones en Modificar equipo antes de confirmar.";
}
export type LegalTeamProps = {
  archiveOnly?: boolean;
  matter: Matter;
  documents: Document[];
  drafts: Draft[];
  actorId: string;
  responsibleName: string;
  onSaved: () => void;
  clientName?: string;
  onDocumentsChanged?: (documents: Document[]) => void;
  onDraftsChanged?: () => Promise<Document[]>;
  onRequestReview: (draftId: string) => void;
  onOpenReviews: () => void;
  activeProfessionalIds: string[];
  eligibleReviewerIds: string[];
  onManageReviewers: () => void;
  onManageReviewerAccess: () => void;
};
export default function LegalTeam(props: LegalTeamProps) {
  const { matter, actorId, responsibleName, onSaved } = props;
  const base = `/firms/${matter.law_firm_id}/matters/${matter.id}`,
    path = base + "/legal-team";
  const archiveKey = "law-order.team.archive." + matter.id + "." + actorId;
  const [view, setView] = useState<TeamView>(empty),
    [config, setConfig] = useState<TeamConfig>(() => {
      const question = "Revisar documentación del asunto: " + matter.title;
      try {
        return suggestTeam(
          question + " · " + matter.subject_area,
          asuncionDate(),
        );
      } catch {
        return {
          question,
          jurisdiction: "PY",
          as_of: asuncionDate(),
          mode: "FOCAL",
          depth: "STANDARD",
          adversarial: false,
          lead_id: "elena",
          participants: [
            {
              ...proposedParticipant("elena"),
              reason:
                "Propuesta provisional: elegí el área y el paquete antes de confirmar el equipo.",
            },
          ],
        };
      }
    });
  const [documents, setDocuments] = useState(props.documents),
    [selected, setSelected] = useState<string[]>([]),
    [synthetic, setSynthetic] = useState(false);
  const [reviewedExtraction, setReviewedExtraction] = useState(false);
  const [documentNotice, setDocumentNotice] = useState("");
  const [documentNoticeRevision, setDocumentNoticeRevision] = useState(0);
  const [plan, setPlan] = useState<TeamPlan | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false);
  const [task, setTask] = useState<"confirm" | "prepare" | "run" | null>(null);
  const [resultTab, setResultTab] = useState("integration"),
    [runId, setRunId] = useState(""),
    [archive, setArchive] = useState(
      () => sessionStorage.getItem(archiveKey) === "true",
    );
  const fixtureCommand = useRef(crypto.randomUUID());
  const [inputsOpen, setInputsOpen] = useState(false);
  const resultSection = useRef<HTMLElement>(null),
    focusResult = useRef(false);
  const responsible = actorId === matter.responsible_identity_id;
  useEffect(() => {
    if (!localMode) return;
    let active = true;
    api<TeamView>(path)
      .then((state) => {
        if (!active) return;
        setView(state);
        if (state.assignment) setConfig(state.assignment.config);
        else setEditing(true);
        const latest = state.plans
          .filter((p) => p.assignment_id === state.assignment?.id)
          .at(-1);
        if (latest) {
          setPlan(latest);
          setSelected(
            latest.evidence
              .filter(
                (e) =>
                  !state.documents?.find(
                    (document) => document.document_id === e.document_id,
                  )?.removed,
              )
              .map((e) => e.document_id),
          );
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [path, actorId]);
  async function reload() {
    const state = await api<TeamView>(path);
    setView(state);
    return state;
  }
  async function refreshDraftRows() {
    await reload();
    if (props.onDraftsChanged) setDocuments(await props.onDraftsChanged());
    else onSaved();
  }
  async function action(
    operation: () => Promise<void>,
    operationTask: typeof task = null,
  ) {
    if (busy) return;
    setBusy(true);
    setTask(operationTask);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setTask(null);
    }
  }
  function changeConfig(next: TeamConfig) {
    setConfig(next);
    setPlan(null);
  }
  const run = view.runs.find((r) => r.id === runId) ?? view.runs[0];
  useEffect(() => {
    if (!run || !focusResult.current) return;
    focusResult.current = false;
    resultSection.current?.scrollIntoView({ block: "start" });
    resultSection.current
      ?.querySelector<HTMLHeadingElement>(".result-heading")
      ?.focus({ preventScroll: true });
  }, [run?.id]);
  const configMatches = Boolean(
    view.assignment && sameTeamConfig(config, view.assignment.config),
  );
  const readyPlan =
    plan &&
    configMatches &&
    plan.assignment_id === view.assignment?.id &&
    plan.evidence.length === selected.length &&
    plan.evidence.every(
      (e) =>
        selected.includes(e.document_id) &&
        documents.find((d) => d.id === e.document_id)?.current_version_id ===
          e.version_id,
    ) &&
    Date.parse(plan.expires_at) > Date.now()
      ? plan
      : null;
  const enabled = config.participants.every(
    (p) => loadPack(p.persona_id, p.pack_id).offline_enabled,
  );
  const extractionObservations =
    view.documents?.filter(
      (d) => selected.includes(d.document_id) && d.status === "REVIEW_REQUIRED",
    ) ?? [];
  const blockedExtraction =
    view.documents?.some((d) => selected.includes(d.document_id) && !d.ready) ??
    false;
  const invalidConfig = configProblem(config);
  const preparationBlock = !responsible
    ? "La preparación corresponde al responsable humano del asunto."
    : !synthetic
      ? "Confirmá los datos sintéticos para preparar este encargo local."
      : (invalidConfig ??
        (!enabled
          ? "Elegí paquetes con ejecución local habilitada en Modificar equipo."
          : selected.length < 1
            ? "Adjuntá y seleccioná al menos un documento para la consulta."
            : selected.length > MAX_DOCUMENTS
              ? `Elegí hasta ${MAX_DOCUMENTS} documentos para esta consulta.`
              : blockedExtraction
                ? "Desmarcá los originales sin extracción completa o incorporá una copia con texto/OCR."
                : extractionObservations.length > 0 && !reviewedExtraction
                  ? "Revisá las observaciones de extracción y marcá su confirmación para continuar."
                  : null));
  async function confirmConfig() {
    const valid = TeamConfigSchema.parse(config);
    setTask("confirm");
    const assignment = await api<TeamAssignment>(path + "/assign", {
      command_id: crypto.randomUUID(),
      expected_version: view.assignment_version,
      expected_human_owner_id: matter.responsible_identity_id,
      config: valid,
      synthetic_data: true,
      max_cost_usd: 0,
    });
    setConfig(assignment.config);
    setView((current) => ({
      ...current,
      assignment,
      assignment_version: assignment.version,
    }));
    setPlan(null);
    setEditing(false);
    return assignment;
  }
  async function prepareConsultation() {
    const assignment = configMatches ? view.assignment! : await confirmConfig();
    setTask("prepare");
    const prepared = await api<TeamPlan>(path + "/prepare", {
      command_id: crypto.randomUUID(),
      assignment_id: assignment.id,
      document_ids: selected,
      ...(reviewedExtraction ? { acknowledge_extraction: true } : {}),
      synthetic_data: true,
      max_cost_usd: 0,
    });
    setPlan(prepared);
    await reload();
  }
  async function changeDocumentStatus(
    document: TeamDocumentInfo,
    status: "REMOVE" | "RESTORE",
  ) {
    await api(path + "/document-status", {
      command_id: crypto.randomUUID(),
      document_id: document.document_id,
      expected_version_id: document.version_id,
      expected_change_id: document.change_id,
      action: status,
    });
    const [items] = await Promise.all([
      api<Document[]>(base + "/documents"),
      reload(),
    ]);
    setDocuments(items);
    props.onDocumentsChanged?.(items);
    setPlan(null);
    setDocumentNoticeRevision((current) => current + 1);
    setSelected((current) =>
      current.filter((id) => items.some((item) => item.id === id)),
    );
    if (status === "REMOVE") setReviewedExtraction(false);
    setDocumentNotice(
      status === "REMOVE"
        ? "Archivo eliminado del asunto. Podés restaurarlo desde Documentos eliminados."
        : "Archivo restaurado al asunto. Marcalo si querés incluirlo en esta consulta.",
    );
  }
  if (!localMode) return <ContractualPilot {...props} />;
  if (archive && !props.archiveOnly)
    return (
      <div className="archived-pilot">
        <button
          onClick={() => {
            sessionStorage.setItem(archiveKey, "false");
            setArchive(false);
          }}
        >
          Volver a Consulta jurídica
        </button>
        <ContractualPilot {...props} />
      </div>
    );
  return (
    <section
      className="legal-team-workspace"
      aria-label="Consulta jurídica del asunto"
      aria-busy={busy}
    >
      <div className="matter-context-strip">
        <span>
          CLIENTE <strong>{props.clientName ?? "Cliente del asunto"}</strong>
        </span>
        <span>
          ASUNTO <strong>{matter.title}</strong>
        </span>
        <small>Documentos y trabajo vinculados a este contexto</small>
      </div>
      {run && (
        <div className="completed-engagement">
          <div>
            <span className="eyebrow">
              CONSULTA EJECUTADA · RESULTADO CONSERVADO
            </span>
            <p>{run.config.question}</p>
            <small>
              {run.evidence.length} documentos usados ·{" "}
              {new Date(run.created_at).toLocaleString("es-PY", {
                timeZone: "America/Asuncion",
              })}
            </small>
          </div>
          <span className="local-mode-tag">Local · USD 0</span>
        </div>
      )}
      {!props.archiveOnly && <details
        className="team-inputs"
        open={!run || inputsOpen}
        onToggle={(event) => {
          if (run) setInputsOpen(event.currentTarget.open);
        }}
      >
        <summary>
          {run
            ? "Encargo y documentos · abrir para modificar o preparar otra consulta"
            : "Preparar el encargo y sus documentos"}
        </summary>
        {run && (
          <div className="input-edit-notice">
            <p>
              Este panel prepara una consulta nueva. El resultado guardado sigue
              abajo; abrirlo no vuelve a ejecutar el equipo.
            </p>
            <button
              type="button"
              onClick={() => {
                setInputsOpen(false);
                resultSection.current?.scrollIntoView({ block: "start" });
              }}
            >
              Volver al resultado
            </button>
          </div>
        )}
        <header className="legal-team-header">
          <div>
            <span className="eyebrow">ENCARGO DEL ASUNTO</span>
            <h2>
              {view.assignment
                ? config.mode === "FOCAL"
                  ? "Consulta focal"
                  : config.mode === "FULL_BOARD"
                    ? "Junta completa"
                    : "Equipo especializado"
                : "Definir equipo jurídico"}
            </h2>
            <p>
              Responsable humano: <strong>{responsibleName}</strong> ·{" "}
              {view.assignment
                ? configMatches
                  ? "Equipo confirmado · versión " + view.assignment.version
                  : "Cambios sin confirmar"
                : "Pendiente de confirmación"}
            </p>
          </div>
          <span className="local-mode-tag">Local · USD 0</span>
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="team-ribbon">
          <div className="coordinator-mini">
            <Avatar id="gabriel" size={48} />
            <span>
              <strong>Gabriel</strong>
              <small>Coordinación</small>
            </span>
          </div>
          <span className="ribbon-separator" aria-hidden="true" />
          {config.participants.map((p) => (
            <div key={p.persona_id}>
              <Avatar id={p.persona_id} size={52} />
              <span>
                <strong>
                  {
                    personas.find((persona) => persona.id === p.persona_id)!
                      .name
                  }
                </strong>
                <small>
                  {config.lead_id === p.persona_id ? "Titular · " : ""}
                  {loadPack(p.persona_id, p.pack_id).label}
                </small>
              </span>
            </div>
          ))}
          {config.adversarial && (
            <div>
              <Avatar id="santiago" size={48} />
              <span>
                <strong>Santiago</strong>
                <small>Revisión adversarial</small>
              </span>
            </div>
          )}
          <button
            disabled={busy}
            onClick={() => setEditing(!editing)}
            aria-expanded={editing}
          >
            {editing ? "Cerrar edición del equipo" : "Modificar equipo"}
          </button>
        </div>
        <p className="workspace-mode-note">
          Herramientas documentales experimentales offline · datos sintéticos ·
          evaluación jurídica humana pendiente.
        </p>
        {editing && (
          <div className="team-configuration">
            <TeamEditor
              config={config}
              onChange={changeConfig}
              disabled={busy || !responsible}
            />
            <label className="synthetic-consent">
              <input
                type="checkbox"
                checked={synthetic}
                disabled={!responsible || busy}
                onChange={(e) => setSynthetic(e.target.checked)}
              />
              Confirmo datos sintéticos para confirmar el equipo.
            </label>
            {invalidConfig && <p role="status">{invalidConfig}</p>}
            <button
              className="primary"
              disabled={
                busy || !synthetic || !responsible || Boolean(invalidConfig)
              }
              onClick={() =>
                action(async () => {
                  await confirmConfig();
                }, "confirm")
              }
            >
              {task === "confirm" ? "Confirmando equipo…" : "Confirmar equipo"}
            </button>
          </div>
        )}
        <div className="legal-work-grid">
          <TeamDocuments
            documents={documents}
            metadata={view.documents ?? []}
            selected={selected}
            busy={busy}
            disabled={busy || !responsible}
            exampleDisabled={busy || !synthetic || !responsible}
            notice={documentNotice}
            onSelect={(id, checked) => {
              setSelected((current) =>
                checked
                  ? [...new Set([...current, id])]
                  : current.filter((item) => item !== id),
              );
              setPlan(null);
              setReviewedExtraction(false);
            }}
            onStatus={(document, status) => {
              void action(() => changeDocumentStatus(document, status));
            }}
            onDownload={(id, version, filename) => {
              void action(async () =>
                saveBlob(
                  await content(
                    base +
                      "/documents/" +
                      id +
                      "/versions/" +
                      version +
                      "/content",
                  ),
                  filename,
                ),
              );
            }}
            onExample={() => {
              void action(async () => {
                const fixture = await api<{ document_ids: string[] }>(
                  base + "/contractual-pilot/fixture",
                  {
                    command_id: fixtureCommand.current,
                    synthetic_data: true,
                    max_cost_usd: 0,
                  },
                );
                const items = await api<Document[]>(base + "/documents");
                setDocuments(items);
                props.onDocumentsChanged?.(items);
                await reload();
                setSelected((current) => [
                  ...new Set([
                    ...current,
                    ...fixture.document_ids.filter((id) =>
                      items.some((document) => document.id === id),
                    ),
                  ]),
                ]);
                setPlan(null);
                setReviewedExtraction(false);
                setDocumentNotice(
                  fixture.document_ids.some(
                    (id) => !items.some((document) => document.id === id),
                  )
                    ? "Hay ejemplos en Documentos eliminados. Podés restaurarlos desde la papelera; no se crearon copias."
                    : "Los ejemplos están en la sección Ejemplos de prueba. Volver a cargarlos no crea copias.",
                );
              });
            }}
          />
          <div className="engagement-main">
            <section className="engagement-question">
              <span className="eyebrow">PREGUNTA DEL ENCARGO</span>
              <label className="sr-only" htmlFor="team-question">
                Pregunta del equipo jurídico
              </label>
              <textarea
                id="team-question"
                rows={3}
                maxLength={2000}
                disabled={busy || !responsible}
                value={config.question}
                onChange={(e) =>
                  changeConfig({ ...config, question: e.target.value })
                }
              />
              <div className="engagement-scope">
                <span>Paraguay · {config.as_of}</span>
                <span>
                  {config.depth === "DEEP"
                    ? "Profundidad ampliada"
                    : "Profundidad estándar"}
                </span>
                <span>
                  {config.adversarial
                    ? "Santiago · 1 ronda autorizable"
                    : "Sin revisión adversarial"}
                </span>
              </div>
              <label className="synthetic-consent">
                <input
                  type="checkbox"
                  checked={synthetic}
                  disabled={busy || !responsible}
                  onChange={(e) => setSynthetic(e.target.checked)}
                />
                Confirmo datos sintéticos para este encargo local.
              </label>
              <TeamDocumentUpload
                base={base}
                disabled={busy || !responsible}
                consent={synthetic}
                noticeRevision={documentNoticeRevision}
                onBusy={setBusy}
                onIncorporated={async (items, ids) => {
                  setDocuments(items);
                  props.onDocumentsChanged?.(items);
                  setDocumentNotice("");
                  setPlan(null);
                  setReviewedExtraction(false);
                  const state = await reload();
                  const readable = ids.filter(
                    (id) =>
                      state.documents?.find((d) => d.document_id === id)?.ready,
                  );
                  setSelected((current) => [
                    ...new Set([
                      ...readable,
                      ...current.filter((id) =>
                        items.some((item) => item.id === id),
                      ),
                    ]),
                  ]);
                }}
              />
              {blockedExtraction && (
                <p role="status">
                  Hay un original sin extracción completa. Se conserva el
                  archivo; desmarcalo o incorporá una copia con texto/OCR antes
                  de preparar.
                </p>
              )}
              {extractionObservations.length > 0 && (
                <label className="synthetic-consent">
                  <input
                    type="checkbox"
                    checked={reviewedExtraction}
                    disabled={busy || !responsible}
                    onChange={(e) => {
                      setReviewedExtraction(e.target.checked);
                      setPlan(null);
                    }}
                  />
                  Revisé las observaciones de extracción y sus límites.
                </label>
              )}
              <div
                className="consultation-next-step"
                id="team-prepare-help"
                role="status"
              >
                {preparationBlock ??
                  (!configMatches
                    ? "Hay cambios en la pregunta o el equipo. Confirmalos y prepará la consulta con el botón de abajo."
                    : !readyPlan
                      ? "Prepará la consulta para habilitar su ejecución local."
                      : "La consulta está preparada para ejecutar.")}
              </div>
              <div className="engagement-actions">
                <button
                  aria-describedby="team-prepare-help"
                  disabled={busy || Boolean(preparationBlock)}
                  onClick={() => action(prepareConsultation, "prepare")}
                >
                  {task === "confirm"
                    ? "Confirmando equipo…"
                    : task === "prepare"
                      ? "Preparando consulta…"
                      : configMatches
                        ? "Preparar consulta"
                        : view.assignment
                          ? "Confirmar cambios y preparar consulta"
                          : "Confirmar equipo y preparar consulta"}
                </button>
                <button
                  className="primary"
                  aria-describedby="team-prepare-help"
                  disabled={busy || !responsible || !synthetic || !readyPlan}
                  onClick={() =>
                    action(async () => {
                      const result = await api<{ id: string }>(path + "/run", {
                        plan_id: readyPlan!.id,
                        plan_hash: readyPlan!.plan_hash,
                        authorize_offline: true,
                        synthetic_data: true,
                        max_cost_usd: 0,
                      });
                      focusResult.current = true;
                      setRunId(result.id);
                      setInputsOpen(false);
                      await reload();
                    }, "run")
                  }
                >
                  {task === "run"
                    ? "Ejecutando encargo…"
                    : "Ejecutar encargo local · USD 0"}
                </button>
              </div>
              {readyPlan && (
                <p role="status" className="prepared-notice">
                  Equipo, cuestiones y evidencia preparados. La ejecución
                  necesita tu acción explícita; vence a los 30 minutos.
                </p>
              )}
            </section>
          </div>
        </div>
      </details>}
      {run ? (
        <section
          ref={resultSection}
          className="team-results"
          aria-label="Resultados del equipo jurídico"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                REVISAR → EDITAR Y GUARDAR → REVISIÓN HUMANA
              </span>
              <h3 className="result-heading" tabIndex={-1}>
                Resultado del encargo
              </h3>
            </div>
            <select
              aria-label="Historial del equipo jurídico"
              value={run.id}
              onChange={(e) => setRunId(e.target.value)}
            >
              {view.runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.created_at).toLocaleString("es-PY", {
                    timeZone: "America/Asuncion",
                  })}{" "}
                  · {r.config.question.slice(0, 45)}
                </option>
              ))}
            </select>
          </div>
          {run.validity === "OUTDATED" && (
            <p role="status" className="pilot-warning">
              Cambió la evidencia, el equipo o el responsable. Este resultado se
              conserva como histórico.
            </p>
          )}
          <WorkProduct
            key={run.id}
            run={run}
            base={base}
            exampleIds={(view.documents ?? [])
              .filter((d) => d.source === "EXAMPLE")
              .map((d) => d.document_id)}
            responsibleName={responsibleName}
            canEdit={!props.archiveOnly && responsible && !busy && run.validity === "CURRENT"}
            synthetic={synthetic}
            onSyntheticChange={setSynthetic}
            draftStatus={
              props.drafts.find((d) => d.id === run.draft_link?.draft_id)
                ?.status
            }
            onSaved={refreshDraftRows}
            onRequestReview={props.onRequestReview}
            onOpenReviews={props.onOpenReviews}
            professionalAvailable={props.activeProfessionalIds.some(
              (id) =>
                id !==
                props.drafts.find((d) => d.id === run.draft_link?.draft_id)
                  ?.author_identity_id,
            )}
            reviewerAvailable={props.eligibleReviewerIds.some(
              (id) =>
                id !==
                props.drafts.find((d) => d.id === run.draft_link?.draft_id)
                  ?.author_identity_id,
            )}
            onManageReviewers={props.onManageReviewers}
            onManageReviewerAccess={props.onManageReviewerAccess}
            onRecheck={() => {
              void action(async () => {
                await api(path + "/recheck", {
                  run_id: run.id,
                  expected_version_id: run.draft_link!.current_version_id,
                  explicitly_confirmed: true,
                  synthetic_data: true,
                  max_cost_usd: 0,
                });
                await reload();
              });
            }}
          />
          <details id="team-internal-review" className="internal-team-review">
            <summary>
              Registro técnico completo y exportaciones · opcional
            </summary>
            <p>
              Este registro conserva los aportes y el intercambio íntegro. El
              resumen para decidir y el chequeo de fuentes están arriba.
            </p>
            <ol className="team-stage-strip" aria-label="Etapas ejecutadas">
              {run.stages.map((stage) => (
                <li key={stage}>
                  {
                    {
                      COORDINATION: "Coordinación",
                      COMMON_EVIDENCE: "Evidencia común",
                      INDEPENDENT_OPINIONS: "Aportes independientes",
                      OBJECTIONS: "Objeciones",
                      REPLIES: "Réplicas",
                      LEAD_INTEGRATION: "Integración del titular",
                      FINAL_CHECKER: "Control final",
                      HUMAN_REVIEW_PENDING: "Revisión humana pendiente",
                    }[stage]
                  }
                </li>
              ))}
            </ol>
            <div
              className="result-tabs"
              role="tablist"
              aria-label="Contenido del resultado"
              onKeyDown={(event) => {
                if (
                  !["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "[role=tab]",
                  ),
                );
                const current = buttons.findIndex(
                  (button) => button === document.activeElement,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? buttons.length - 1
                      : (current +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          buttons.length) %
                        buttons.length;
                event.preventDefault();
                buttons[next]?.focus();
                buttons[next]?.click();
              }}
            >
              {[
                ["integration", "Integración"],
                ["opinions", "Aportes · " + run.opinions.length],
                ["debate", "Objeciones y réplicas · " + run.objections.length],
                ["audit", "Control y pendientes"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  id={"team-tab-" + key}
                  aria-controls={"team-panel-" + key}
                  tabIndex={resultTab === key ? 0 : -1}
                  aria-selected={resultTab === key}
                  onClick={() => setResultTab(key!)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={"team-panel-" + resultTab}
              aria-labelledby={"team-tab-" + resultTab}
            >
              {resultTab === "integration" && (
                <article aria-label="Integración del titular">
                  <DocumentText text={run.final_markdown} />
                </article>
              )}
              {resultTab === "opinions" && (
                <div className="opinion-matrices">
                  {run.opinions.map((o) => (
                    <article key={o.participant_id}>
                      <header>
                        <Avatar id={o.participant_id} />
                        <div>
                          <h3>
                            {
                              personas.find((p) => p.id === o.participant_id)!
                                .name
                            }
                          </h3>
                          <p>{o.assigned_question}</p>
                        </div>
                      </header>
                      <p>
                        {o.coverage.examined_lines} líneas examinadas ·{" "}
                        {o.coverage.selected_documents} documentos · sin
                        truncamiento
                      </p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Problema</th>
                              <th>Respaldo</th>
                              <th>Interpretación y alternativa</th>
                              <th>Pendiente</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.findings.map((f, i) => (
                              <tr key={i}>
                                <td>{f.issue}</td>
                                <td>
                                  <blockquote>{f.evidence.quote}</blockquote>
                                  <small>
                                    {
                                      run.evidence.find(
                                        (e) =>
                                          e.document_id ===
                                          f.evidence.document_id,
                                      )?.title
                                    }{" "}
                                    · {f.evidence.version_id.slice(0, 8)} ·{" "}
                                    {f.evidence.start}–{f.evidence.end} ·{" "}
                                    {f.evidence.nature === "PARTY_ALLEGATION"
                                      ? "Alegación"
                                      : "Texto documental"}
                                  </small>
                                </td>
                                <td>
                                  {f.interpretation}
                                  <p>{f.alternative}</p>
                                </td>
                                <td>{f.missing}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!o.findings.length && (
                        <p>
                          Sin respaldo pertinente localizado. Se mantiene la
                          abstención.
                        </p>
                      )}
                      <p>{o.conclusion}</p>
                    </article>
                  ))}
                </div>
              )}
              {resultTab === "debate" && (
                <div className="team-debate">
                  {run.objections.length ? (
                    run.objections.map((o) => (
                      <article key={o.id}>
                        <div className="debate-objection">
                          <Avatar id="santiago" size={44} />
                          <div>
                            <strong>
                              Santiago →{" "}
                              {personas.find((p) => p.id === o.target_id)!.name}
                            </strong>
                            <p>{o.text}</p>
                            <details>
                              <summary>Pasajes examinados</summary>
                              {o.evidence.map((e, i) => (
                                <blockquote key={i}>
                                  {e.quote}
                                  <small>
                                    {e.version_id.slice(0, 8)} · {e.start}–
                                    {e.end}
                                  </small>
                                </blockquote>
                              ))}
                            </details>
                          </div>
                        </div>
                        <div className="debate-reply">
                          <Avatar id={o.target_id} size={40} />
                          <div>
                            <strong>Réplica · límite aceptado</strong>
                            <p>
                              {
                                run.replies.find((r) => r.objection_id === o.id)
                                  ?.text
                              }
                            </p>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>
                      Santiago no fue autorizado en este encargo. Podés
                      proponerlo al modificar el equipo; requiere una consulta
                      nueva.
                    </p>
                  )}
                </div>
              )}
              {resultTab === "audit" && (
                <div className="team-audit">
                  <h3>Control terminal de referencias</h3>
                  <p>
                    {run.audit.outputs.length} salidas controladas: pregunta,
                    coordinación, evidencia, aportes, debate si fue autorizado e
                    integración exacta.
                  </p>
                  <p>
                    {run.audit.references.length
                      ? run.audit.references.length +
                        " menciones jurídicas pendientes de cotejo oficial."
                      : "No se identificaron referencias jurídicas dentro de la gramática disponible."}{" "}
                    Ninguna fuente se presenta como verificada.
                  </p>
                  {run.audit.references.map((r, i) => (
                    <p key={i}>
                      {r.output_id}: {r.text} · Pendiente
                    </p>
                  ))}
                  <p>
                    La revisión humana sigue pendiente. El control de
                    referencias no certifica la corrección jurídica.
                  </p>
                  <details>
                    <summary>Pendientes por participante</summary>
                    {run.opinions.map((o) => (
                      <p key={o.participant_id}>
                        <strong>
                          {
                            personas.find((p) => p.id === o.participant_id)!
                              .name
                          }
                          :
                        </strong>{" "}
                        {o.missing_inputs.join("; ")}
                      </p>
                    ))}
                  </details>
                </div>
              )}
            </div>
            <div className="result-actions">
              <button
                onClick={() =>
                  saveBlob(
                    new Blob([run.final_markdown], {
                      type: "text/markdown;charset=utf-8",
                    }),
                    "equipo-juridico-integracion-local.md",
                  )
                }
              >
                Exportar registro completo
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const evaluation = await buildOfflineComparison(run);
                    const zip = zipSync({
                      "revision-ciega.md": strToU8(evaluation.blind_review),
                      "clave-privada-no-entregar-al-revisor.json": strToU8(
                        JSON.stringify(evaluation.private_key, null, 2),
                      ),
                      "protocolo.json": strToU8(
                        JSON.stringify(evaluation.protocol, null, 2),
                      ),
                    });
                    saveBlob(
                      new Blob([new Uint8Array(zip)], {
                        type: "application/zip",
                      }),
                      "evaluacion-equipo-local.zip",
                    );
                  })
                }
              >
                Preparar evaluación ciega
              </button>
            </div>
            {run.draft_link && (
              <p role="status">
                {run.draft_link.audit_current
                  ? "Control ligado a la versión guardada. Revisión humana pendiente."
                  : "El borrador cambió: corresponde controlar la nueva versión."}
              </p>
            )}
            {!props.archiveOnly && run.draft_link && !run.draft_link.audit_current && (
              <button
                disabled={busy || !synthetic || !responsible}
                onClick={() =>
                  action(async () => {
                    await api(path + "/recheck", {
                      run_id: run.id,
                      expected_version_id: run.draft_link!.current_version_id,
                      explicitly_confirmed: true,
                      synthetic_data: true,
                      max_cost_usd: 0,
                    });
                    await reload();
                  })
                }
              >
                Controlar referencias de la nueva versión
              </button>
            )}
          </details>
        </section>
      ) : (
        <div className="team-result-empty">
          <span className="eyebrow">
            DOCUMENTO · RESPONSABLE · PRÓXIMAS ACCIONES
          </span>
          <h3>Acá vas a trabajar sobre el entregable</h3>
          <p>
            Prepará y ejecutá el encargo local para abrir el documento de
            trabajo del titular. Sus aportes y la revisión quedan disponibles
            como respaldo.
          </p>
        </div>
      )}
      {!props.archiveOnly && <details className="workspace-archive">
        <summary>Historial y herramientas anteriores</summary>
        <p>
          Se conservan las consultas y el piloto contractual previos del asunto.
        </p>
        <button
          onClick={() => {
            sessionStorage.setItem(archiveKey, "true");
            setArchive(true);
          }}
        >
          Abrir piloto contractual anterior
        </button>
      </details>}
    </section>
  );
}
