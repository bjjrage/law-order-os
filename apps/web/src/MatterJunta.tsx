import { useEffect, useState } from "react";
import type { Document, Matter } from "../../../os-core/src/contracts.js";
import { api, localMode, saveBlob } from "./api.js";
import { browserStore } from "./local-api.js";
import JuntaDeliberation from './JuntaDeliberation.js';
import JuntaLegalDocument from './JuntaLegalDocument.js';
import JuntaSources from './JuntaSources.js';
import type {LibraryResearch} from './junta-sources.js';
import { terminalStatuses, legalDocumentHtml, legalDocumentMarkdown } from './junta-presentation.js';
import { lawyerError, type CitationReview } from './junta-lawyer-language.js';
type Prepared = {
  library_research?: LibraryResearch;
  study_id: string;
  matter_id: string;
  prepared_id: string;
  prepared_hash: string;
  question: string;
  budget_usd: number;
  reserved_ceiling_usd: number;
  snapshot_id: string;
  documents: Array<{ document_id: string; version_id: string; sha256: string }>;
  execution_authorized?: boolean;
  run?: Result | null;
};
export type Result = {
  consultation_mode?: 'GENERAL' | 'DOCUMENT_REVIEW';
  library_research?: LibraryResearch;
  run_id: string;
  mode: string;
  status: string;
  question: string;
  error_code: string | null;
  analysis: {
    legal_analysis: string;
    limitations: string[];
    unresolved_issues: string[];
    alternative_interpretations?: string[];
  } | null;
  audit: {
    audit_status: string;
    findings: Array<{ statement: string; recommended_action: string; severity?: string; type?: string }>;
    citation_objections?: string[];
    unsupported_fact_flags?: string[];
    missing_evidence_flags?: string[];
  } | null;
  stages: Array<{
    stage: string;
    model_id: string;
    status: string;
    error_code: string | null;
    latency_ms?: number;
    estimated_cost_usd?: number | null;
  }>;
  reference_verification: string;
  citation_review?: CitationReview;
  packet?: {relevant_documents?:string[];missing_information?:string[]}|null;
  cost: { estimated_total_usd: number | null; actual_total_usd: number | null; latency_ms?: number };
  timing?: {started_at:string|null;finished_at:string|null;elapsed_ms:number;stage_time_ms:number;source:string};
};
async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/local/junta/case/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    signal,
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Junta-Case": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(lawyerError(data.code??data.error));
  return data;
}
export default function MatterJunta({
  matter,
  documents,
  actorId,
  responsibleName,
  onSaved,
  archiveOnly = true,
}: {
  matter: Matter;
  documents: Document[];
  actorId: string;
  responsibleName: string;
  onSaved: () => void;
  archiveOnly?: boolean;
}) {
  const storageKey = "law-order-os.junta." + matter.id;
  const [question, setQuestion] = useState(""),
    [scope, setScope] = useState(
      "Revisar solo la cuestión delimitada con los documentos seleccionados.",
    ),
    [selected, setSelected] = useState<string[]>([]),
    [synthetic, setSynthetic] = useState(false),
    [prepared, setPrepared] = useState<Prepared | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [savedDraft, setSavedDraft] = useState(false);
  const [consulting,setConsulting]=useState(false),[startedAt,setStartedAt]=useState<number|null>(null);
  useEffect(()=>{
    if(!prepared || !(consulting || result&&!terminalStatuses.includes(result.status)))return;
    const abort=new AbortController();let pending=false;
    const update=async()=>{if(pending)return;pending=true;try{
      const p=await request<Prepared>('status?id='+encodeURIComponent(prepared.prepared_id),undefined,abort.signal);
      if(!abort.signal.aborted&&p.run)setResult(p.run);
    }catch{/* The main request reports failures; polling is read-only and retryable. */}finally{pending=false;}};
    void update();const timer=setInterval(()=>void update(),1200);
    return()=>{clearInterval(timer);abort.abort();};
  },[prepared?.prepared_id,consulting,result?.status]);
  useEffect(() => {
    const abort = new AbortController();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (
        saved &&
        typeof saved.question === "string" &&
        typeof saved.scope === "string" &&
        Array.isArray(saved.selected) &&
        saved.selected.every((id: unknown) => typeof id === "string")
      ) {
        setQuestion(saved.question);
        setScope(saved.scope);
        setSelected(saved.selected);
        if (typeof saved.prepared_id === "string")
          request<Prepared>(
            "status?id=" + encodeURIComponent(saved.prepared_id),
            undefined,
            abort.signal,
          )
            .then((p) => {
              if (!abort.signal.aborted) {
                setPrepared(p);
                setResult(p.run ?? null);
              }
            })
            .catch(() => {
              if (!abort.signal.aborted)
                setError(
                  "La preparación anterior no está disponible. Prepará nuevamente la consulta.",
                );
            });
      }
    } catch {
      setError(
        "No se pudo leer el formulario guardado. Tus documentos se conservaron.",
      );
    }
    return () => abort.abort();
  }, [storageKey]);
  function changed() {
    setPrepared(null);
    setResult(null);
    setSavedDraft(false);
  }
  function persist(id?: string) {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ question, scope, selected, prepared_id: id }),
    );
  }
  async function check() {
    if (!prepared) return;
    try {
      setError("");
      const p = await request<Prepared>(
        "status?id=" + encodeURIComponent(prepared.prepared_id),
      );
      setPrepared(p);
      setResult(p.run ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function prepare(){
              const state = browserStore().snapshot();
              const docs = selected.map((id) => {
                const document = state.tables.documents.find(
                  (d) =>
                    d.id === id &&
                    d.matter_id === matter.id &&
                    d.law_firm_id === matter.law_firm_id,
                );
                const version = state.tables.documentVersions.find(
                  (v) =>
                    v.id === document?.current_version_id &&
                    v.document_id === id &&
                    v.matter_id === matter.id &&
                    v.law_firm_id === matter.law_firm_id,
                );
                if (!document || !version)
                  throw Error(
                    "Un documento cambió o dejó de estar disponible. Revisá la selección.",
                  );
                return {
                  id,
                  title: document.title,
                  version_id: version.id,
                  sha256: version.sha256,
                  base64: version.original_base64,
                  nature:
                    document.purpose === "DRAFT"
                      ? "PARTY_ALLEGATION"
                      : "UNKNOWN",
                };
              });
              const p = await request<Prepared>("prepare", {
                study_id: matter.law_firm_id,
                matter_id: matter.id,
                actor_id: actorId,
                question,
                scope,
                as_of_date: new Date().toLocaleDateString("en-CA", {
                  timeZone: "America/Asuncion",
                }),
                synthetic_data: true,
                include_library: true,
                subject_area: matter.subject_area,
                documents: docs,
              });
              persist(p.prepared_id);
              setPrepared(p);
              return p;
  }
  async function consult(){
    if(busy)return;
    setBusy(true);setConsulting(true);setStartedAt(Date.now());setError('');
    try {
      let p=prepared;
      if(p&&!p.library_research)p=null;
      if(p&&p.documents.some(v=>documents.find(d=>d.id===v.document_id)?.current_version_id!==v.version_id))p=null;
      if(!p)p=await prepare();
      setResult(await request<Result>('consult',{prepared_id:p.prepared_id,owner_approval:true,max_cost_usd:0.6,synthetic_data:true}));
    } catch(e){setError((e as Error).message);}
    finally{setBusy(false);setConsulting(false);}
  }
  if (archiveOnly) return <section className="junta-result" aria-label="Informe histórico de junta">
    <h3>Informe de la junta anterior</h3>
    {error && <p role="status">{error}</p>}
    {result ? <>
      <JuntaLegalDocument result={result} />
      <button disabled={!result.analysis} onClick={() => saveBlob(new Blob([legalDocumentHtml(result)], { type: "text/html;charset=utf-8" }), "informe-juridico-anterior.html")}>Descargar informe conservado</button>
    </> : <p>No hay un informe anterior vinculado a este navegador para el asunto.</p>}
  </section>;
  if (!localMode)
    return (
      <p className="panel-note">
        La conexión de asuntos con la Junta está preparada para el modo local.
        El modo servidor requiere integración de identidad verificada.
      </p>
    );
  return (
    <section className="junta-panel matter-workbench" aria-labelledby="matter-junta-title">
      <aside className="matter-document-rail" aria-label="Documentación para la consulta">
      <div className="document-rail-heading"><span className="eyebrow">EXPEDIENTE DE TRABAJO</span><h2>Documentos del asunto</h2><p>{documents.filter((document) => document.current_version_id).length} disponibles · {selected.length} seleccionados</p></div>
      <fieldset disabled={busy}>
        <legend className="sr-only">Seleccionar documentos</legend>
        <label className="document-upload button">
          <span>Incorporar texto (.txt)</span>
          <input className="sr-only" aria-label="Cargar documento para consultar (.txt)" type="file" accept=".txt,text/plain" disabled={busy} onChange={async e=>{
            const file=e.currentTarget.files?.[0];if(!file)return;
            try {
              setBusy(true);setError('');
              if(!file.size||file.size>12000)throw Error('Para esta prueba cargá un TXT de hasta 12 KB.');
              const bytes=new Uint8Array(await file.arrayBuffer());try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('No se pudo leer el texto. Guardá el documento como archivo de texto y volvé a cargarlo.');}
              let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
              const response=await api<{document:Document}>(`/firms/${matter.law_firm_id}/matters/${matter.id}/originals`,{title:file.name.replace(/\.txt$/i,''),original_filename:file.name,mime_type:'text/plain',original_base64:btoa(binary)});
              changed();setSynthetic(false);
              localStorage.setItem(storageKey,JSON.stringify({question,scope,selected:[response.document.id]}));
              onSaved();
            }catch(cause){setError((cause as Error).message);}
            finally{setBusy(false);}
          }}/>
        </label>
        {documents
          .filter((d) => d.current_version_id)
          .map((d) => (
            <label className="junta-document" key={d.id}>
              <input
                type="checkbox"
                checked={selected.includes(d.id)}
                onChange={(e) => {
                  changed();
                  setSelected((ids) =>
                    e.target.checked
                      ? [...ids, d.id]
                      : ids.filter((id) => id !== d.id),
                  );
                }}
              />
              <span>
                <strong>{d.title}</strong><small>{d.purpose === "ORIGINAL" ? "Original" : "Borrador"} · versión disponible</small>
              </span>
            </label>
          ))}
        {!documents.some((d) => d.current_version_id) && (
          <p>
            Incorporá un original de texto o prepará un borrador antes de
            consultar.
          </p>
        )}
      </fieldset>
      <p className="document-rail-note">Seleccioná hasta 4 documentos de texto, 12 KB en total. Las fuentes de la Biblioteca se buscan al preparar la consulta.</p>
      </aside>
      <div className="matter-analysis-space">
      <div className="matter-responsibility"><span>Responsable humano <strong>{responsibleName}</strong></span><span>Junta actual · revisión humana obligatoria</span></div>
      <section className="matter-query-card">
      <header><span className="eyebrow">JUNTA JURÍDICA</span><h2 id="matter-junta-title">Una pregunta concreta. Un análisis en contexto.</h2><p className="muted">La Junta trabaja sobre los documentos elegidos y busca legislación y jurisprudencia en la Biblioteca.</p></header>
      <details className="junta-inputs" open={!consulting&&!result}>
      <summary>{result ? "Ver pregunta y autorización" : "Preparar la consulta"}</summary>
      <label className="field wide">
        <span id="junta-question-label">Pregunta jurídica concreta</span>
        <textarea
          aria-labelledby="junta-question-label"
          rows={3}
          maxLength={2000}
          value={question}
          disabled={busy}
          onChange={(e) => {
            changed();
            setQuestion(e.target.value);
          }}
          placeholder="¿Qué documentación falta para evaluar las obligaciones indicadas en este contrato?"
        />
      </label>

      <p className="muted">
        El contenido se trata como no verificado; un relato no se convierte
        automáticamente en un hecho probado.
      </p>
      <label className="junta-document">
        <input
          type="checkbox"
          checked={synthetic}
          disabled={busy}
          onChange={(e) => setSynthetic(e.target.checked)}
        />
        <span>
          Confirmo que esta prueba contiene únicamente datos sintéticos y no
          confidenciales.
        </span>
      </label>
      </details>
      {!result&&!consulting&&<p className="muted">Al tocar Consultar Junta autorizás el análisis de esta consulta, hasta USD 0,60 en total. Sin cobro recurrente.</p>}
      <div className="actions">
        <button disabled={busy||question.trim().length<15||!selected.length||!!result} onClick={async()=>{setBusy(true);setError('');try{await prepare();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Buscar fuentes · sin gasto de IA</button>
        <button className="primary" disabled={busy||!synthetic||question.trim().length<15||!selected.length||!!result} onClick={consult}>
          {busy?'Consultando Junta…':'Consultar Junta · hasta USD 0,60'}
        </button>
        {prepared&&<button disabled={busy} onClick={check}>Actualizar resultado</button>}
        {result&&<button disabled={busy||!terminalStatuses.includes(result.status)} onClick={()=>{changed();persist();}}>Nueva consulta</button>}
      </div>
      {!synthetic&&!result&&!consulting&&<p className="muted">Confirmá que el documento contiene datos ficticios para habilitar la prueba.</p>}
      {busy&&!prepared&&<p role="status">Buscando leyes y jurisprudencia para la consulta…</p>}
      {prepared&&!result&&<JuntaSources research={prepared.library_research}/>}
      {(consulting||result)&&<JuntaDeliberation result={result} busy={consulting} startedAt={startedAt}/>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <details><summary>Opciones de la consulta</summary>
      <label className="field wide">
        <span>Contexto y límites de la consulta</span>
        <textarea
          rows={2}
          maxLength={2000}
          value={scope}
          disabled={busy}
          onChange={(e) => {
            changed();
            setScope(e.target.value);
          }}
        />
      </label>



      </details>
      </section>
      {result && (
        <div className="junta-result">
          {result.error_code&&<p role="alert" className="error">{lawyerError(result.error_code)}</p>}
          <JuntaLegalDocument result={result}/>
          {!result.analysis&&<JuntaSources research={result.library_research}/>}
          <div className="actions">
            <button disabled={!result.analysis} onClick={()=>saveBlob(new Blob([legalDocumentHtml(result)],{type:'text/html;charset=utf-8'}),'informe-juridico-junta.html')}>Descargar informe jurídico</button>


            <button
              disabled={!result.analysis || savedDraft || busy}
              onClick={async () => {
                try {
                  setBusy(true);
                  await api(
                    `/firms/${matter.law_firm_id}/matters/${matter.id}/drafts`,
                    {
                      title: "Junta — " + question.slice(0, 180),
                      content: legalDocumentMarkdown(result),
                    },
                  );
                  setSavedDraft(true);
                  onSaved();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {savedDraft
                ? "Borrador guardado"
                : "Guardar como borrador del asunto"}
            </button>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
