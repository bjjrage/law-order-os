import { useEffect, useRef, useState } from "react";
import type { Matter } from "../../../os-core/src/contracts.js";
import { api } from "./api.js";
import type { TeamView } from "./local-team.js";
import { asuncionDate } from "./local-dates.js";
import JuntaSources from "./JuntaSources.js";
import JuntaLegalDocument from "./JuntaLegalDocument.js";
import JuntaDeliberation from "./JuntaDeliberation.js";
import { terminalStatuses } from "./junta-presentation.js";
import type { LibraryResearch } from "./junta-sources.js";
import type { Result } from "./MatterJunta.js";
import { lawyerError } from "./junta-lawyer-language.js";

type Prepared = {
  prepared_id: string;
  study_id: string;
  matter_id: string;
  question: string;
  consultation_mode: "GENERAL";
  execution_mode: "OFFLINE_TEST" | "LIVE";
  documents: unknown[];
  budget_usd: number;
  library_research?: LibraryResearch;
  run?: Result | null;
};
const scopeDefault =
  "Orientación general sobre la pregunta delimitada. Tratar el relato como hipótesis, sin acreditar hechos ni emitir una conclusión sobre un caso concreto.";
const generalScopePolicy =
  " En esta consulta GENERAL sin documentos, el contexto debe mantener documentary_facts, party_allegations, chronology, contested_facts y contradictions vacíos. Registrar hipótesis y dudas solo en unresolved_questions; la pregunta no es evidencia. En el análisis, question_analyzed debe copiar EXACTAMENTE request.legal_question, sin resumir ni reformular.";
const maxUserScope = 2000 - generalScopePolicy.length;
const stageNames: Record<string, string> = {
  BUILDING_CONTEXT: "Contexto y supuestos",
  PRINCIPAL_ANALYSIS: "Análisis",
  ADVERSARIAL_AUDIT: "Revisión crítica",
  CHECKING_REFERENCES: "Control de referencias",
};
async function request<T>(
  path: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/local/junta/case/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    signal,
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Junta-Case": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Error(lawyerError(data.code ?? data.error));
  return data;
}
export default function GeneralConsultation({
  matter,
  actorId,
  responsibleName,
  clientName,
}: {
  matter: Matter;
  actorId: string;
  responsibleName: string;
  clientName?: string;
}) {
  const storageKey = `law-order.general.${matter.law_firm_id}.${matter.id}.${actorId}`;
  const [question, setQuestion] = useState(""),
    [scope, setScope] = useState(scopeDefault);
  const [synthetic, setSynthetic] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null),
    [result, setResult] = useState<Result | null>(null);
  const [executionMode, setExecutionMode] = useState<"LIVE" | "OFFLINE_TEST">(
    "LIVE",
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<"prepare" | "run" | null>(null),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    dirty = useRef(false);
  const focusResult = useRef(false);
  const focusQuestion = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null),
    resultHeading = useRef<HTMLHeadingElement>(null);
  const responsible = matter.responsible_identity_id === actorId;
  useEffect(() => {
    const abort = new AbortController();
    let savedId: string | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (
        saved &&
        typeof saved.question === "string" &&
        typeof saved.scope === "string"
      ) {
        setQuestion(saved.question);
        setScope(saved.scope);
        dirty.current = true;
        if (typeof saved.prepared_id === "string") savedId = saved.prepared_id;
      }
    } catch {
      setError(
        "No se pudo leer la consulta guardada. Podés prepararla nuevamente.",
      );
    }
    async function load() {
      try {
        if (savedId) {
          const saved = await request<Prepared>(
            "status?id=" + encodeURIComponent(savedId),
            abort.signal,
          );
          if (
            saved.study_id !== matter.law_firm_id ||
            saved.matter_id !== matter.id ||
            !["OFFLINE_TEST", "LIVE"].includes(saved.execution_mode) ||
            saved.consultation_mode !== "GENERAL"
          )
            throw Error(
              "La preparación guardada no corresponde a esta consulta general.",
            );
          if (!abort.signal.aborted) {
            setPrepared(saved);
            setResult(saved.run ?? null);
            setExecutionMode(saved.execution_mode);
          }
        } else {
          const team = await api<TeamView>(
            `/firms/${matter.law_firm_id}/matters/${matter.id}/legal-team`,
          );
          if (!abort.signal.aborted && !dirty.current && team.assignment)
            setQuestion(team.assignment.config.question);
        }
      } catch (cause) {
        if (!abort.signal.aborted) setError((cause as Error).message);
      } finally {
        if (!abort.signal.aborted) setLoaded(true);
      }
    }
    void load();
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [storageKey, matter.law_firm_id, matter.id]);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            question,
            scope,
            prepared_id: prepared?.prepared_id,
          }),
        );
      } catch {
        setError(
          "No se pudo guardar la consulta en este navegador. Revisá el espacio disponible antes de cerrar.",
        );
      }
  }, [loaded, storageKey, question, scope, prepared?.prepared_id]);
  useEffect(() => {
    if (
      !prepared ||
      executionMode !== "LIVE" ||
      !(busy === "run" || (result && !terminalStatuses.includes(result.status)))
    )
      return;
    const abort = new AbortController();
    let pending = false;
    const update = async () => {
      if (pending) return;
      pending = true;
      try {
        const status = await request<Prepared>(
          "status?id=" + encodeURIComponent(prepared.prepared_id),
          abort.signal,
        );
        if (!abort.signal.aborted && status.run) setResult(status.run);
      } catch {
        /* The submission reports errors; status polling never repeats inference. */
      } finally {
        pending = false;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 1500);
    return () => {
      clearInterval(timer);
      abort.abort();
    };
  }, [prepared?.prepared_id, executionMode, busy, result?.status]);
  const requirements = [
    ...(!responsible
      ? ["Esta consulta corresponde al responsable humano del asunto."]
      : []),
    ...(question.trim().length < 15 || question.trim().length > 2000
      ? ["Escribí una pregunta de entre 15 y 2000 caracteres."]
      : []),
    ...(scope.trim().length < 5
      ? ["Completá el alcance en Opciones de la consulta."]
      : []),
    ...(scope.length > maxUserScope
      ? [
          `Acortá el alcance a ${maxUserScope} caracteres en Opciones de la consulta.`,
        ]
      : []),
    ...(!synthetic
      ? ["Confirmá que usás datos sintéticos para esta consulta."]
      : []),
  ];
  function change() {
    dirty.current = true;
    setPrepared(null);
    setResult(null);
    setError("");
  }
  function newQuestion() {
    if (busy || (result && !terminalStatuses.includes(result.status))) return;
    focusQuestion.current = !!result;
    if (!result) input.current?.focus();
    change();
    setSynthetic(false);
    setExecutionMode("LIVE");
  }
  async function prepare() {
    if (busy || requirements.length || !loaded) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy("prepare");
    setError("");
    try {
      const next = await request<Prepared>("prepare", abort.signal, {
        study_id: matter.law_firm_id,
        matter_id: matter.id,
        actor_id: actorId,
        question,
        scope: scope + generalScopePolicy,
        as_of_date: asuncionDate(),
        synthetic_data: true,
        consultation_mode: "GENERAL",
        execution_mode: executionMode,
        include_library: true,
        subject_area: matter.subject_area,
        documents: [],
      });
      if (
        next.execution_mode !== executionMode ||
        next.consultation_mode !== "GENERAL" ||
        next.budget_usd !== (executionMode === "LIVE" ? 0.6 : 0)
      )
        throw Error(
          "El servidor no confirmó el modo y el límite de gasto elegidos. Prepará nuevamente antes de consultar.",
        );
      setPrepared(next);
      setResult(null);
    } catch (cause) {
      if (!abort.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!abort.signal.aborted) setBusy(null);
    }
  }
  async function run() {
    if (busy || !prepared || requirements.length) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy("run");
    setStartedAt(Date.now());
    setError("");
    try {
      const next = await request<Result>(
        executionMode === "LIVE" ? "consult" : "run",
        abort.signal,
        executionMode === "LIVE"
          ? {
              prepared_id: prepared.prepared_id,
              owner_approval: true,
              max_cost_usd: 0.6,
              synthetic_data: true,
            }
          : { prepared_id: prepared.prepared_id },
      );
      if (
        next.mode !==
          (executionMode === "LIVE" ? "LIVE" : "OFFLINE_SIMULATION") ||
        (executionMode === "OFFLINE_TEST" && next.cost.actual_total_usd !== 0)
      )
        throw Error(
          "La respuesta no corresponde al modo solicitado. Revisá el resultado guardado antes de repetir la consulta.",
        );
      focusResult.current = true;
      setResult(next);
    } catch (cause) {
      if (!abort.signal.aborted) {
        setError((cause as Error).message);
        // A lost HTTP response may follow a successful paid run. Recover by
        // read-only status, never by automatically submitting again.
        try {
          const status = await request<Prepared>(
            "status?id=" + encodeURIComponent(prepared.prepared_id),
            abort.signal,
          );
          if (status.run) setResult(status.run);
        } catch {
          /* Keep the original error. */
        }
      }
    } finally {
      if (!abort.signal.aborted) setBusy(null);
    }
  }
  async function refreshResult() {
    if (busy || refreshing || !prepared) return;
    const abort = new AbortController();
    controller.current = abort;
    setRefreshing(true);
    setError("");
    try {
      const status = await request<Prepared>(
        "status?id=" + encodeURIComponent(prepared.prepared_id),
        abort.signal,
      );
      if (
        status.study_id !== matter.law_firm_id ||
        status.matter_id !== matter.id ||
        status.execution_mode !== executionMode
      )
        throw Error("El resultado no corresponde a esta consulta.");
      setResult(status.run ?? null);
    } catch (cause) {
      if (!abort.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!abort.signal.aborted) setRefreshing(false);
    }
  }
  useEffect(() => {
    if (result && focusResult.current) {
      focusResult.current = false;
      resultHeading.current?.focus();
    }
    if (!result && focusQuestion.current) {
      focusQuestion.current = false;
      input.current?.focus();
    }
  }, [result]);
  const passed = result?.status === "HUMAN_REVIEW_PENDING";
  const simulated = executionMode === "OFFLINE_TEST";
  const active =
    busy === "run" || (!!result && !terminalStatuses.includes(result.status));
  return (
    <section
      className="general-consultation"
      aria-labelledby="general-title"
      aria-busy={!!busy}
    >
      <div className="matter-context-strip">
        <span>
          CLIENTE <strong>{clientName ?? "Cliente del asunto"}</strong>
        </span>
        <span>
          ASUNTO <strong>{matter.title}</strong>
        </span>
      </div>
      <header className="general-heading">
        <div>
          <span className="eyebrow">CONSULTA JURÍDICA GENERAL</span>
          <h2 id="general-title">Una pregunta, sin adjuntos obligatorios</h2>
          <p>
            Responsable humano: <strong>{responsibleName}</strong> · Paraguay ·{" "}
            {asuncionDate()}
          </p>
        </div>
        <span className="local-mode-tag">
          {simulated ? "Prueba offline · USD 0" : "IA real · tope USD 0,60"}
        </span>
      </header>
      <p className="general-mode-notice">
        {simulated
          ? "Estás viendo una prueba offline con respuestas controladas. Usá Nueva consulta con IA para obtener una respuesta real."
          : "La Junta está habilitada para responder con IA. Preparar no consume IA; al consultar se envían la pregunta y las fuentes de Biblioteca a los proveedores configurados, con un límite de USD 0,60."}
      </p>
      {simulated && !result && (
        <button type="button" disabled={!!busy} onClick={newQuestion}>
          Nueva consulta con IA
        </button>
      )}
      <details className="general-inputs" open={!result}>
        <summary>
          {result
            ? "Pregunta y preparación · ver o modificar"
            : "Preparar pregunta general"}
        </summary>
        <div className="general-query">
          <label className="field wide">
            <span>¿Qué querés consultar?</span>
            <textarea
              ref={input}
              rows={3}
              maxLength={2000}
              value={question}
              disabled={!!busy || !loaded || !!result}
              onChange={(event) => {
                change();
                setQuestion(event.target.value);
              }}
              placeholder="¿Qué riesgos debería evaluar si se vende el 55% de una empresa?"
            />
          </label>
          <p className="muted">
            No necesitás subir un contrato. Los datos que describas se tratarán
            como supuestos, hasta contar con respaldo.
          </p>
          <details>
            <summary>Opciones de la consulta</summary>
            <label className="field">
              <span>Modo de ejecución</span>
              <select
                value={executionMode}
                disabled={!!busy || !!result}
                onChange={(event) => {
                  change();
                  setExecutionMode(
                    event.target.value as "LIVE" | "OFFLINE_TEST",
                  );
                  setSynthetic(false);
                }}
              >
                <option value="LIVE">IA real · hasta USD 0,60</option>
                <option value="OFFLINE_TEST">Prueba offline · USD 0</option>
              </select>
            </label>
            <label className="field wide">
              <span>Alcance y límites</span>
              <textarea
                rows={2}
                maxLength={maxUserScope}
                value={scope}
                disabled={!!busy || !!result}
                onChange={(event) => {
                  change();
                  setScope(event.target.value);
                }}
              />
            </label>
          </details>
          <label className="synthetic-consent">
            <input
              type="checkbox"
              checked={synthetic}
              disabled={!!busy || !responsible || !!result}
              onChange={(event) => setSynthetic(event.target.checked)}
            />
            Confirmo que esta consulta contiene solo datos sintéticos.
          </label>
          <div id="general-requirements" aria-live="polite">
            {!result && requirements.length > 0 && (
              <ul className="general-requirements">
                {requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {busy && (
              <p role="status">
                {busy === "prepare"
                  ? "Preparando la pregunta y buscando en la Biblioteca local…"
                  : simulated
                    ? "Probando contexto, análisis, revisión y control sin llamar a modelos…"
                    : "La Junta está preparando el contexto, redactando y revisando la respuesta…"}
              </p>
            )}
            {prepared && !result && !busy && (
              <p className="consultation-next-step">
                Consulta preparada con {prepared.documents.length} documentos.
                {simulated
                  ? "Siguiente paso: probá el circuito offline."
                  : "Podés consultar la Junta. Al pulsar Consultar autorizás hasta USD 0,60 para esta consulta."}
              </p>
            )}
          </div>
          <div className="actions">
            <button
              type="button"
              className={!prepared ? "primary" : ""}
              disabled={
                !!busy || !loaded || requirements.length > 0 || !!prepared
              }
              aria-describedby="general-requirements"
              onClick={() => void prepare()}
            >
              {busy === "prepare" ? "Preparando…" : "1. Preparar consulta"}
            </button>
            <button
              type="button"
              className={prepared ? "primary" : ""}
              disabled={
                !!busy || !prepared || requirements.length > 0 || !!result
              }
              aria-describedby="general-requirements"
              onClick={() => void run()}
            >
              {busy === "run"
                ? simulated
                  ? "Probando…"
                  : "Consultando…"
                : simulated
                  ? "2. Probar circuito offline · USD 0"
                  : "2. Consultar Junta · hasta USD 0,60"}
            </button>
            {prepared && (
              <button type="button" disabled={!!busy} onClick={newQuestion}>
                Modificar pregunta
              </button>
            )}
          </div>
        </div>
      </details>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {prepared && (
        <div className="actions">
          <button
            type="button"
            disabled={!!busy || refreshing}
            onClick={() => void refreshResult()}
          >
            {refreshing ? "Actualizando…" : "Actualizar resultado · sin gasto"}
          </button>
        </div>
      )}
      {((busy === "run" && !simulated) || result?.mode === "LIVE") && (
        <JuntaDeliberation
          result={result}
          busy={busy === "run"}
          startedAt={startedAt}
          general
        />
      )}
      {result?.mode === "LIVE" && (
        <section
          className="general-result"
          aria-labelledby="general-live-result-title"
        >
          <span className="eyebrow">
            RESPUESTA DE IA · REVISIÓN HUMANA PENDIENTE
          </span>
          <h3 id="general-live-result-title" ref={resultHeading} tabIndex={-1}>
            {active
              ? "La Junta está trabajando"
              : result.analysis
                ? "Respuesta de la Junta"
                : "La consulta requiere revisión"}
          </h3>
          {result.error_code && (
            <p role="alert" className="error">
              {lawyerError(result.error_code)}
            </p>
          )}
          {result.analysis ? (
            <JuntaLegalDocument result={result} />
          ) : (
            !active && (
              <p>
                No se recibió un informe jurídico completo. Revisá la etapa
                indicada antes de iniciar otra consulta.
              </p>
            )
          )}
          {!active && (
            <div className="actions">
              <button type="button" onClick={newQuestion}>
                Nueva consulta con IA
              </button>
            </div>
          )}
        </section>
      )}
      {result?.mode === "OFFLINE_SIMULATION" && (
        <section
          className="general-result"
          aria-labelledby="general-result-title"
        >
          <span className="eyebrow">RESULTADO DE LA PRUEBA · SIMULACIÓN</span>
          <h3 ref={resultHeading} tabIndex={-1} id="general-result-title">
            {passed
              ? "El circuito offline funcionó"
              : "La prueba requiere revisión"}
          </h3>
          <p className="general-tested-question">
            <strong>Pregunta probada:</strong> {result.question}
          </p>
          <p>
            {passed
              ? "La Junta procesó la pregunta sin documentos y ejecutó sus controles con respuestas controladas. Todavía no se generó una respuesta jurídica de IA."
              : lawyerError(result.error_code ?? "INVALID_STAGE_OUTPUT")}
          </p>
          <div className="general-checks">
            <div>
              <strong>Respuesta jurídica</strong>
              <span>No generada en esta prueba</span>
            </div>
            <div>
              <strong>Fuentes y alucinaciones</strong>
              <span>No evaluadas con una respuesta real</span>
            </div>
            <div>
              <strong>Consumo externo</strong>
              <span>0 llamadas · USD 0</span>
            </div>
          </div>
          <p className="muted">
            La prueba no autentica leyes, fallos ni vigencia normativa. No
            agrega documentos de ejemplo al asunto.
          </p>
          <details>
            <summary>Ver comprobación técnica del recorrido</summary>
            <p>Clasificación documental: no aplica al no adjuntar archivos.</p>
            <table>
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Resultado de prueba</th>
                </tr>
              </thead>
              <tbody>
                {result.stages.map((stage, index) => (
                  <tr key={stage.stage + index}>
                    <td>{stageNames[stage.stage] ?? stage.stage}</td>
                    <td>
                      {stage.status === "PASS"
                        ? "Comprobada con simulación"
                        : lawyerError(
                            stage.error_code ?? "INVALID_STAGE_OUTPUT",
                          )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Referencias verificadas:{" "}
              {result.citation_review?.verified_references ?? 0}. Sin validación
              jurídica real.
            </p>
          </details>
          <div className="actions">
            <button type="button" onClick={newQuestion}>
              Nueva consulta con IA
            </button>
          </div>
        </section>
      )}
      {prepared?.library_research && !result?.analysis && (
        <details className="general-library">
          <summary>
            Biblioteca local · {prepared.library_research.sources.length}{" "}
            fuentes candidatas, pendientes de cotejo
          </summary>
          <JuntaSources research={prepared.library_research} />
        </details>
      )}
    </section>
  );
}
