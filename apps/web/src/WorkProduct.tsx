import { useEffect, useMemo, useRef, useState } from "react";
import type { Draft } from "../../../os-core/src/contracts.js";
import type { TeamView } from "./local-team.js";
import { personas } from "./specialist-engine.js";
import { api, content, saveBlob } from "./api.js";
import { buildWorkProduct } from "./work-product.js";
import { buildResultSummary, type ResultTopic } from "./team-result-summary.js";
import { MAX_OUTPUT_CHARS } from "./document-policy.js";

function Topic({ topic }: { topic: ResultTopic }) {
  return (
    <article className="result-topic">
      <div>
        <span
          className={
            "topic-kind" + (topic.priority === 0 ? " topic-attention" : "")
          }
        >
          {topic.priority === 0 ? "Por aclarar" : "Por revisar"}
        </span>
        <h4>{topic.title}</h4>
        <p>{topic.action}</p>
      </div>
      <details>
        <summary>
          Ver respaldo documental · {topic.passages.length}{" "}
          {topic.passages.length === 1 ? "pasaje" : "pasajes"}
        </summary>
        <p>
          <strong>Motivo original:</strong> {topic.issue}
        </p>
        {topic.passages.map((p, i) => (
          <div className="topic-passage" key={i}>
            <strong>{p.title}</strong>
            <small>
              {p.participants
                .map(
                  (id) =>
                    personas.find((persona) => persona.id === id)?.name ?? id,
                )
                .join(", ")}{" "}
              · posiciones {p.finding.evidence.start}–{p.finding.evidence.end} ·{" "}
              {p.matches ? "Pasaje localizado" : "Pasaje sin coincidencia"}
            </small>
            <blockquote>{p.finding.evidence.quote}</blockquote>
            <p>
              <strong>Pendiente:</strong> {p.finding.missing}
            </p>
            <p>
              <strong>Límite:</strong> {p.finding.interpretation}
            </p>
          </div>
        ))}
      </details>
    </article>
  );
}

type Props = {
  run: TeamView["runs"][number];
  base: string;
  exampleIds: string[];
  responsibleName: string;
  canEdit: boolean;
  synthetic: boolean;
  onSyntheticChange: (checked: boolean) => void;
  draftStatus?: Draft["status"];
  onSaved: () => Promise<void>;
  onRequestReview: (draftId: string) => void;
  onOpenReviews: () => void;
  reviewerAvailable: boolean;
  professionalAvailable: boolean;
  onManageReviewers: () => void;
  onManageReviewerAccess: () => void;
  onRecheck: () => void;
};

export default function WorkProduct({
  run,
  base,
  exampleIds,
  responsibleName,
  canEdit,
  synthetic,
  onSyntheticChange,
  draftStatus,
  onSaved,
  onRequestReview,
  onOpenReviews,
  reviewerAvailable,
  professionalAvailable,
  onManageReviewers,
  onManageReviewerAccess,
  onRecheck,
}: Props) {
  const product = useMemo(
    () => buildWorkProduct(run, exampleIds),
    [run, exampleIds],
  );
  const summary = useMemo(() => buildResultSummary(run), [run]);
  const lead = personas.find((p) => p.id === run.config.lead_id)!;
  const [loadFailed, setLoadFailed] = useState(false),
    [editorOpen, setEditorOpen] = useState(false);
  const [text, setText] = useState(product.content),
    [savedText, setSavedText] = useState(""),
    [loading, setLoading] = useState(Boolean(run.draft_link)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const editorSection = useRef<HTMLDetailsElement>(null),
    editor = useRef<HTMLTextAreaElement>(null),
    sources = useRef<HTMLElement>(null),
    nextAction = useRef<HTMLElement>(null),
    afterSave = useRef(false);
  const dirty = text !== savedText;
  const saved = Boolean(run.draft_link && !dirty && !loading && !loadFailed);
  const step = saved ? 4 : editorOpen ? 3 : 2;
  const audit =
    saved && run.draft_link?.audit_current ? run.draft_link.audit : run.audit;
  const approved = saved && draftStatus === "APPROVED";
  const inReview = saved && draftStatus === "IN_REVIEW";
  const needsReviewer =
    !reviewerAvailable &&
    !approved &&
    !inReview &&
    draftStatus !== "CHANGES_REQUESTED";
  useEffect(() => {
    if (!saved || saving || !afterSave.current) return;
    afterSave.current = false;
    setEditorOpen(false);
    nextAction.current?.scrollIntoView({ block: "start" });
    nextAction.current
      ?.querySelector<HTMLHeadingElement>("h3")
      ?.focus({ preventScroll: true });
  }, [saved, saving]);
  useEffect(() => {
    if (!run.draft_link) return;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void (async () => {
      const drafts = await api<Draft[]>(base + "/drafts"),
        draft = drafts.find((d) => d.id === run.draft_link!.draft_id);
      if (!draft) throw Error("DRAFT_MISSING");
      const value = await (
        await content(
          base +
            "/documents/" +
            draft.document_id +
            "/versions/" +
            draft.document_version_id +
            "/content",
        )
      ).text();
      if (active) {
        setText(value === run.final_markdown ? product.content : value);
        setSavedText(value);
        if (value === run.final_markdown)
          setNotice(
            "El borrador anterior contiene el registro técnico. Guardá el documento de trabajo como nueva versión antes de solicitar revisión.",
          );
      }
    })()
      .catch(() => {
        if (active) {
          setLoadFailed(true);
          setError(
            "No se pudo recuperar la versión guardada. Volvé a abrir el asunto antes de editar.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [base, run.draft_link?.current_version_id, run.draft_link?.draft_id]);
  function openEditor() {
    if (!editorSection.current) return;
    editorSection.current.open = true;
    setEditorOpen(true);
    editorSection.current.scrollIntoView({ block: "start" });
    editor.current?.focus({ preventScroll: true });
  }
  function showSources() {
    sources.current?.scrollIntoView({ block: "start" });
    sources.current?.focus({ preventScroll: true });
  }
  async function save() {
    if (
      saving ||
      loading ||
      loadFailed ||
      !canEdit ||
      !synthetic ||
      !text.trim()
    )
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (run.draft_link) {
        const drafts = await api<Draft[]>(base + "/drafts"),
          draft = drafts.find((d) => d.id === run.draft_link!.draft_id);
        if (
          !draft ||
          draft.document_version_id !== run.draft_link.current_version_id
        )
          throw Error("VERSION_CONFLICT");
        const revised = await api<{ document_version_id: string }>(
          base + "/drafts/" + draft.id + "/versions",
          { expected_version_id: draft.document_version_id, content: text },
        );
        await api(base + "/legal-team/recheck", {
          run_id: run.id,
          expected_version_id: revised.document_version_id,
          explicitly_confirmed: true,
          synthetic_data: true,
          max_cost_usd: 0,
        });
      } else
        await api(base + "/legal-team/draft", {
          run_id: run.id,
          content: text,
          synthetic_data: true,
          max_cost_usd: 0,
        });
      setSavedText(text);
      setNotice(
        "Versión guardada y control local de menciones actualizado. Ahora podés solicitar revisión humana.",
      );
      await onSaved();
      afterSave.current = true;
    } catch (e) {
      setError(
        e instanceof Error && e.message === "VERSION_CONFLICT"
          ? "El borrador cambió en otra pestaña. Volvé a abrirlo para trabajar sobre la versión actual."
          : "No se pudo completar el guardado y su control. Tu texto sigue en el editor; revisá la versión en Borradores antes de reintentar.",
      );
    } finally {
      setSaving(false);
    }
  }
  const blocked = !canEdit
    ? run.validity === "OUTDATED"
      ? "Este resultado es histórico. Abrí el encargo y prepará una consulta actualizada."
      : "La edición y el guardado corresponden al responsable humano del asunto."
    : loadFailed
      ? error
      : loading
        ? "Recuperando la versión guardada…"
        : "";
  return (
    <section
      className="work-product result-workspace"
      aria-label="Resultado y próximas acciones"
      aria-busy={loading || saving}
    >
      <ol
        className="work-order result-progress"
        aria-label="Pasos para completar el trabajo"
        data-complete={approved}
      >
        {[
          ["Encargo definido", "Gabriel y equipo"],
          ["Revisar resultado", "Conflictos y fuentes"],
          ["Editar y guardar", lead.name + " · documento"],
          ["Revisión humana", responsibleName],
        ].map(([title, owner], i) => (
          <li
            className="work-stage"
            key={title}
            aria-current={step === i + 1 ? "step" : undefined}
          >
            {step === i + 1 && (
              <span className="work-stage-pointer" aria-hidden="true">
                ›
              </span>
            )}
            <span className="result-step-number" aria-hidden="true">
              {i + 1}
            </span>
            <div className="work-stage-copy">
              <strong>{title}</strong>
              <small>{owner}</small>
            </div>
            <span className="work-stage-state">
              {i + 1 < step
                ? i === 0
                  ? "Ejecutado"
                  : "Paso anterior"
                : i + 1 === step
                  ? approved
                    ? "Versión aprobada"
                    : "Tu próxima acción"
                  : "Después"}
            </span>
          </li>
        ))}
      </ol>
      <section
        ref={nextAction}
        className="work-next-action"
        aria-label="Qué hacer ahora"
      >
        <div>
          <span className="eyebrow">PASO {step} · QUÉ HACER AHORA</span>
          <h3 tabIndex={-1}>
            {step === 2
              ? "Revisá los puntos marcados y el chequeo de fuentes"
              : step === 3
                ? "Editá el documento y guardá una versión"
                : approved
                  ? "Esta versión tiene aprobación humana"
                  : inReview
                    ? "La versión está en revisión humana"
                    : draftStatus === "CHANGES_REQUESTED"
                      ? "Hay cambios solicitados por el revisor"
                      : needsReviewer
                        ? professionalAvailable
                          ? "Falta habilitar un revisor en este asunto"
                          : "Falta otro profesional para revisar"
                        : "Solicitá la revisión de otro profesional"}
          </h3>
          <p>
            {step === 2
              ? "El equipo terminó este encargo. No hace falta volver a cargar la pregunta. Abajo tenés los temas que requieren atención; después continuá al documento."
              : step === 3
                ? "Completá o corregí el texto. Guardar crea una versión y vuelve a localizar sus menciones jurídicas; la aprobación se solicita después."
                : approved
                  ? "La aprobación corresponde a la versión guardada. Una nueva edición necesita su propia revisión."
                  : inReview
                    ? "Abrí Revisiones para consultar o resolver la revisión asignada."
                    : draftStatus === "CHANGES_REQUESTED"
                      ? "Abrí las observaciones del revisor o editá el documento para crear una versión nueva."
                      : needsReviewer
                        ? professionalAvailable
                          ? "El borrador está guardado. Otorgá a otro profesional acceso al asunto y permiso para revisar borradores; después solicitá la revisión."
                          : "El documento ya está guardado. Incorporá otro profesional al estudio y después habilitá su revisión en este asunto. El autor no puede aprobar su propia versión."
                        : "El documento ya está guardado. Elegí un revisor distinto del autor; la solicitud no aprueba el contenido."}
          </p>
        </div>
        <div className="work-next-controls">
          {step === 3 && (
            <label className="synthetic-consent">
              <input
                type="checkbox"
                checked={synthetic}
                disabled={!canEdit || saving}
                onChange={(e) => onSyntheticChange(e.target.checked)}
              />
              Confirmo datos sintéticos para guardar en local.
            </label>
          )}
          {step === 2 ? (
            <button
              className="primary"
              type="button"
              disabled={Boolean(blocked)}
              onClick={openEditor}
            >
              Continuar: editar documento
            </button>
          ) : step === 3 ? (
            <button
              className="primary"
              type="button"
              aria-busy={saving}
              disabled={
                Boolean(blocked) || saving || !synthetic || !text.trim()
              }
              onClick={() => {
                void save();
              }}
            >
              {saving ? "Guardando y controlando…" : "Guardar y continuar"}
            </button>
          ) : (
            <button
              className="primary"
              type="button"
              disabled={!canEdit || loading || saving}
              onClick={() =>
                inReview || approved || draftStatus === "CHANGES_REQUESTED"
                  ? onOpenReviews()
                  : needsReviewer
                    ? professionalAvailable
                      ? onManageReviewerAccess()
                      : onManageReviewers()
                    : onRequestReview(run.draft_link!.draft_id)
              }
            >
              {inReview || approved || draftStatus === "CHANGES_REQUESTED"
                ? "Abrir revisión humana"
                : needsReviewer
                  ? professionalAvailable
                    ? "Configurar acceso del revisor"
                    : "Incorporar profesional"
                  : "Solicitar revisión humana"}
            </button>
          )}
          {step !== 3 && (
            <button
              type="button"
              onClick={step === 4 ? openEditor : showSources}
            >
              {step === 4 ? "Editar nueva versión" : "Ver chequeo de fuentes"}
            </button>
          )}
        </div>
        {blocked && (
          <p className="next-action-block" role="status">
            {blocked}
          </p>
        )}
      </section>
      {loading && <p role="status">Recuperando documento guardado…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="result-notice">
          {notice}
        </p>
      )}
      <div className="result-overview">
        <div>
          <span className="eyebrow">QUÉ PRODUJO EL EQUIPO</span>
          <h3>{product.title}</h3>
          <p>
            {product.drafting
              ? "Texto base para adaptar las partes, cláusulas y condiciones del nuevo contrato."
              : "Informe editable basado en los documentos seleccionados."}
          </p>
        </div>
        <div className="result-facts">
          <span>
            <strong>{run.evidence.length}</strong> documentos usados ·{" "}
            <strong>{summary.topics.length}</strong> temas por revisar
          </span>
          <span className="source-pending">Cotejo oficial: no realizado</span>
          <span>RAG en este encargo: no utilizado</span>
        </div>
      </div>
      <section
        className="result-topics"
        aria-label="Puntos conflictivos y pendientes"
      >
        <header>
          <h3>Puntos que requieren tu atención</h3>
          <p>
            Temas agrupados. Abrí el respaldo solo cuando necesites ver el
            pasaje y su límite.
          </p>
        </header>
        <div className="result-topic-grid">
          {summary.topics.slice(0, 6).map((topic) => (
            <Topic key={topic.issue} topic={topic} />
          ))}
        </div>
        {summary.topics.length > 6 && (
          <details className="more-result-topics">
            <summary>
              Ver {summary.topics.length - 6}{" "}
              {summary.topics.length === 7 ? "tema más" : "temas más"}
            </summary>
            <div className="result-topic-grid">
              {summary.topics.slice(6).map((topic) => (
                <Topic key={topic.issue} topic={topic} />
              ))}
            </div>
          </details>
        )}
        {!summary.topics.length && (
          <p>
            No se localizaron patrones dentro del procedimiento disponible. Eso
            no demuestra ausencia de problemas.
          </p>
        )}
      </section>
      <section
        ref={sources}
        tabIndex={-1}
        className="source-check"
        aria-label="Chequeo de fuentes y citas"
      >
        <header>
          <span className="eyebrow">CONTROL DEL RESULTADO</span>
          <h3>¿Qué se chequeó y qué falta?</h3>
          <span className="source-pending">
            Alucinaciones jurídicas: sin determinar
          </span>
        </header>
        <p>
          Se localizaron menciones y se compararon los pasajes con los textos
          seleccionados. La existencia, vigencia y pertinencia de normas o
          fallos no se cotejaron con una fuente oficial.
        </p>
        <dl className="source-check-list">
          <div>
            <dt>Pasajes del registro</dt>
            <dd>
              {summary.totalPassages
                ? `${summary.matchedPassages}/${summary.totalPassages} coinciden con el texto seleccionado`
                : "Sin pasajes para comparar"}
              {summary.unmatchedPassages > 0 && (
                <strong className="error">
                  {" "}
                  · {summary.unmatchedPassages} sin coincidencia
                </strong>
              )}
            </dd>
          </div>
          <div>
            <dt>Menciones jurídicas localizadas</dt>
            <dd>
              {audit.references.length
                ? audit.references.length +
                  (audit.references.length === 1
                    ? " pendiente de cotejo"
                    : " pendientes de cotejo")
                : "Ninguna dentro de las reglas disponibles"}
            </dd>
          </div>
          <div>
            <dt>Fuentes oficiales / jurisprudencia</dt>
            <dd className="source-pending-text">No verificadas</dd>
          </div>
          <div>
            <dt>RAG / Biblioteca en este encargo</dt>
            <dd>No utilizado · no se recuperaron fuentes oficiales</dd>
          </div>
          <div>
            <dt>Documento editable</dt>
            <dd>
              {saved && run.draft_link?.audit_current
                ? "Control local ligado a la versión guardada"
                : saved
                  ? "Versión guardada con control local pendiente"
                  : "Guardá la versión para actualizar su control local"}
            </dd>
          </div>
        </dl>
        <p className="source-check-limit">
          “Ninguna mención localizada” no significa “sin alucinaciones”. Este
          control local no certifica la corrección jurídica.
        </p>
        {saved && !run.draft_link?.audit_current && (
          <button
            type="button"
            disabled={!canEdit || !synthetic || saving || loading}
            onClick={onRecheck}
          >
            Controlar menciones de la versión guardada
          </button>
        )}
        <details>
          <summary>
            Ver menciones y alcance del chequeo · {audit.references.length}
          </summary>
          <p>
            {saved && run.draft_link?.audit_current
              ? "Alcance: versión guardada y registro del encargo."
              : "Alcance: registro del encargo; las ediciones no guardadas quedan fuera."}{" "}
            Fecha:{" "}
            {new Date(audit.checked_at).toLocaleString("es-PY", {
              timeZone: "America/Asuncion",
            })}
            . Detección limitada a las reglas disponibles.
          </p>
          {audit.references.map((reference, i) => (
            <div className="citation-pending" key={i}>
              <strong>{reference.text}</strong>
              <span>Pendiente de cotejo oficial</span>
              <small>
                {audit.outputs.find((o) => o.id === reference.output_id)
                  ?.phase === "EVIDENCE"
                  ? "Texto documental seleccionado"
                  : "Registro del equipo"}{" "}
                · posiciones {reference.start}–{reference.end}
              </small>
            </div>
          ))}
        </details>
      </section>
      <section
        className="debate-summary"
        aria-label="Resumen de la revisión adversarial"
      >
        <div>
          <h3>Revisión adversarial · resumen</h3>
          <p>
            {!summary.debate.authorized
              ? "No se incluyó a Santiago en este encargo."
              : !summary.debate.total
                ? "No se formularon objeciones en esta ejecución."
                : `${summary.debate.total} objeciones · ${summary.debate.accepted} límites aceptados · ${summary.debate.disagreements} desacuerdos conservados · ${summary.debate.unanswered} sin respuesta.`}
          </p>
        </div>
        {summary.debate.total > 0 && (
          <details>
            <summary>Qué dejó pendiente la revisión</summary>
            <ul>
              {run.objections.map((objection) => (
                <li key={objection.id}>
                  <strong>
                    {
                      {
                        MISSING_EVIDENCE: "Respaldo faltante",
                        COUNTEREVIDENCE: "Evidencia contraria",
                        INFERENCE_LIMIT: "Límite de interpretación",
                        SOURCE_GAP: "Fuente pendiente",
                      }[objection.kind]
                    }{" "}
                    · {personas.find((p) => p.id === objection.target_id)?.name}
                  </strong>
                  <p>{objection.required_response}</p>
                  <small>
                    {run.replies.find((r) => r.objection_id === objection.id)
                      ?.disposition === "ACCEPTED_LIMIT"
                      ? "Se aceptó el límite; el asunto sigue sujeto a revisión humana."
                      : "Pendiente o desacuerdo conservado."}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <details
        ref={editorSection}
        open={editorOpen}
        onToggle={(event) => setEditorOpen(event.currentTarget.open)}
        className="work-editor-section"
      >
        <summary>
          {editorOpen
            ? "Documento de trabajo · edición"
            : "Abrir documento para editar"}
        </summary>
        <p>
          Responsable del documento: <strong>{lead.name}</strong>.{" "}
          {product.drafting
            ? "Adaptá el texto base antes de guardarlo."
            : "Revisá y ajustá el informe."}{" "}
          Los cambios se conservan en el editor hasta que guardes.
        </p>
        {product.observations.length > 0 && (
          <details>
            <summary>
              Observaciones de extracción · {product.observations.length}
            </summary>
            {product.observations.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </details>
        )}
        <details>
          <summary>
            Decisiones para completar el encargo · {product.decisions.length}
          </summary>
          <ul>
            {product.decisions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
        <label htmlFor={"work-product-" + run.id}>
          {product.drafting ? "Contrato para editar" : "Informe para editar"}
        </label>
        <textarea
          ref={editor}
          id={"work-product-" + run.id}
          className="work-product-editor"
          value={text}
          maxLength={MAX_OUTPUT_CHARS}
          disabled={loading || saving || loadFailed || !canEdit}
          onChange={(e) => {
            setText(e.target.value);
            setNotice("");
          }}
          spellCheck
        />
        {!synthetic && (
          <label className="synthetic-consent">
            <input
              type="checkbox"
              checked={synthetic}
              disabled={!canEdit || saving}
              onChange={(e) => onSyntheticChange(e.target.checked)}
            />
            Confirmo datos sintéticos para guardar este borrador local.
          </label>
        )}
        <div className="result-actions">
          <button
            className="primary"
            type="button"
            aria-busy={saving}
            disabled={
              loading ||
              saving ||
              loadFailed ||
              !canEdit ||
              !synthetic ||
              !text.trim() ||
              !dirty
            }
            onClick={() => {
              void save();
            }}
          >
            {saving
              ? "Guardando y controlando…"
              : "Guardar y continuar a revisión humana"}
          </button>
          <button
            type="button"
            disabled={loading || saving || loadFailed}
            onClick={() =>
              saveBlob(
                new Blob([text], { type: "text/markdown;charset=utf-8" }),
                product.drafting
                  ? "borrador-contractual.md"
                  : "informe-de-revision.md",
              )
            }
          >
            Descargar documento
          </button>
          {saved && (
            <button
              type="button"
              onClick={() =>
                inReview || approved
                  ? onOpenReviews()
                  : needsReviewer
                    ? professionalAvailable
                      ? onManageReviewerAccess()
                      : onManageReviewers()
                    : onRequestReview(run.draft_link!.draft_id)
              }
            >
              Continuar a revisión humana
            </button>
          )}
        </div>
      </details>
    </section>
  );
}
