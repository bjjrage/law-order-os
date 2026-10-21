import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Matter, Document } from '../../../os-core/src/contracts.js';
import { api, localMode } from './api.js';
import type { PilotPlan } from './contractual-pilot.js';
import type { PilotView } from './local-specialist.js';

const MatterJunta = lazy(() => import('./MatterJunta.js'));
const emptyView: PilotView = { assignment: null, assignment_version: 0, plans: [], runs: [] };
const messages: Record<string, string> = {
  PILOT_ASSIGNMENT_CONFLICT: 'La asignación cambió. Actualizá y confirmá nuevamente.',
  PILOT_ASSIGNMENT_REQUIRED: 'Confirmá a Elena como titular antes de preparar.',
  PILOT_PLAN_OUTDATED: 'Cambió el equipo o la evidencia. Prepará una consulta nueva.',
  PILOT_PLAN_EXPIRED: 'La preparación venció. Prepará una consulta nueva.',
  PILOT_OWNER_CHANGED: 'Cambió el responsable humano. Revisá la asignación.',
  PILOT_RESPONSIBLE_REQUIRED: 'Esta acción corresponde al responsable humano del asunto.',
  PILOT_INVALID_INPUT: 'Revisá los datos, la selección y la confirmación de datos sintéticos.',
  PILOT_EVIDENCE_LIMIT: 'Seleccioná hasta cuatro textos y 24 KB en total.',
  PILOT_TEXT_ONLY: 'El piloto admite originales de texto UTF-8.',
  ACCESS_DENIED: 'No tenés permiso para esta acción en el asunto.',
  VERSION_CONFLICT: 'El borrador cambió. Actualizá antes de comprobar sus fuentes.',
};
function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return messages[code] ?? 'No se pudo completar el piloto. Actualizá el asunto y revisá los datos; no se ejecutó una consulta externa.';
}
export default function ContractualPilot(props: {
  matter: Matter; documents: Document[]; actorId: string; responsibleName: string; onSaved: () => void; archiveOnly?: boolean;
}) {
  const { matter, documents, actorId, responsibleName, onSaved } = props;
  const path = `/firms/${matter.law_firm_id}/matters/${matter.id}/contractual-pilot`;
  const [view, setView] = useState<PilotView>(emptyView);
  const [question, setQuestion] = useState('¿Qué obligaciones, condiciones, contradicciones y anexos faltantes aparecen en estos textos sintéticos?');
  const [selected, setSelected] = useState<string[]>([]);
  const [synthetic, setSynthetic] = useState(false);
  const [plan, setPlan] = useState<PilotPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const legacyKey = 'law-order-os.local.legacy-panel.' + matter.id + '.' + actorId;
  const [legacy, setLegacy] = useState(() => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(legacyKey) === 'true');
  const fixtureCommand = useRef(crypto.randomUUID());
  const documentRevision = documents.map(document => document.id + ':' + document.current_version_id).join('|');
  const responsible = actorId === matter.responsible_identity_id;
  useEffect(() => {
    if (!localMode) return;
    let active = true;
    const abort = new AbortController();
    api<PilotView>(path, undefined, abort.signal).then(state => {
      if (!active) return;
      setView(state);
      const latest = state.plans.at(-1);
      if (latest) { setPlan(latest); setQuestion(latest.question); setSelected(latest.evidence.map(document => document.document_id)); }
    }).catch(reason => { if (active) setError(errorText(reason)); });
    return () => { active = false; abort.abort(); };
  }, [path, actorId, documentRevision]);
  async function reload() { setView(await api<PilotView>(path)); }
  async function action(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  const run = view.runs.find(item => item.id === runId) ?? view.runs[0];
  const readyPlan = plan && plan.question === question.trim() && plan.evidence.length === selected.length && plan.evidence.every(document => selected.includes(document.document_id) && documents.find(item => item.id === document.document_id)?.current_version_id === document.version_id) ? plan : null;
  if (props.archiveOnly) return <section className="contractual-pilot" aria-label="Archivo del piloto contractual">
    <h3>Piloto contractual anterior</h3>
    {error && <p role="status">{error}</p>}
    {run ? <>
      <label>Informe guardado<select value={run.id} onChange={event => setRunId(event.target.value)}>{view.runs.map(item => <option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleString('es-PY')}</option>)}</select></label>
      <pre>{run.final_markdown}</pre><button onClick={download}>Descargar informe conservado</button>
    </> : <p>No hay informes guardados del piloto contractual en este asunto.</p>}
  </section>;
  function download() {
    if (!run) return;
    const url = URL.createObjectURL(new Blob([run.final_markdown], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'elena-revision-contractual-sintetica.md'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!localMode) return <Suspense fallback={<p role="status">Cargando consulta…</p>}><MatterJunta {...props} /></Suspense>;
  if (legacy) return <section className="contractual-pilot" aria-label="Consulta anterior del asunto">
    <header><h2>Consulta anterior del asunto</h2><p>Ruta existente e historial conservados. Su equipo y autorización son distintos del piloto contractual offline.</p><button onClick={() => { sessionStorage.setItem(legacyKey, 'false'); setLegacy(false); }}>Volver al piloto contractual</button></header>
    <Suspense fallback={<p role="status">Cargando consulta anterior…</p>}><MatterJunta {...props} /></Suspense>
  </section>;
  return <section className="contractual-pilot" aria-label="Equipo jurídico del asunto" aria-busy={busy}>
    <header className="pilot-team">
      <img src="/agents/elena.png" alt="" width={72} height={72} />
      <div><span className="eyebrow">EQUIPO JURÍDICO · PILOTO LOCAL</span><h2>Elena · Contratos y obligaciones</h2><p>Responsable humano: <strong>{responsibleName}</strong> · Titular IA: {view.assignment ? 'Elena, confirmada' : 'pendiente de confirmación'}</p></div>
      <span className="pilot-mode">Simulación offline · USD 0</span>
    </header>
    <p className="pilot-scope">Ejercicio documental determinístico con datos sintéticos. No es una respuesta generativa ni acredita pericia jurídica. La revisión y aprobación del borrador siguen a cargo del abogado humano.</p>
    {!responsible && <p role="status">Podés consultar el historial según tus permisos. El responsable humano confirma y ejecuta el piloto.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <label className="pilot-confirm"><input type="checkbox" checked={synthetic} disabled={busy || !responsible} onChange={event => setSynthetic(event.target.checked)} />Confirmo datos sintéticos para el piloto offline.</label>
    <div className="actions">
      {!view.assignment && <button disabled={busy || !synthetic || !responsible} onClick={() => action(async () => {
        await api(path + '/assign', { command_id: crypto.randomUUID(), expected_version: view.assignment_version, expected_human_owner_id: matter.responsible_identity_id, profile_id: 'elena', synthetic_data: true, max_cost_usd: 0 }); await reload();
      })}>Confirmar a Elena como titular</button>}
      <button disabled={busy || !synthetic || !responsible} onClick={() => action(async () => {
        const fixture = await api<{ document_ids: string[] }>(path + '/fixture', { command_id: fixtureCommand.current, synthetic_data: true, max_cost_usd: 0 }); setSelected(fixture.document_ids); setPlan(null); onSaved();
      })}>Cargar contrato sintético de ejemplo</button>
    </div>
    <div className="pilot-inputs">
      <fieldset disabled={busy || !responsible}><legend>Documentos para la consulta</legend>
        {documents.length ? documents.map(document => <label key={document.id}><input type="checkbox" checked={selected.includes(document.id)} onChange={event => { setPlan(null); setSelected(current => event.target.checked ? [...current, document.id] : current.filter(id => id !== document.id)); }} />{document.title} · {document.purpose === 'DRAFT' ? 'Borrador/alegación' : 'Original'}</label>) : <p>Incorporá un texto desde Documentos o cargá el ejemplo sintético.</p>}
        <small>Hasta 4 documentos de texto UTF-8 y 24 KB en total. La selección se congela por versión.</small>
      </fieldset>
      <div><label className="field"><span>Pregunta contractual para Elena</span><textarea aria-label="Pregunta contractual para Elena" rows={3} maxLength={2000} disabled={busy || !responsible} value={question} onChange={event => { setQuestion(event.target.value); setPlan(null); }} /></label>
      <p className="muted">Consulta focal · Profundidad estándar · Revisión adversarial pendiente de implementación.</p>
      <div className="actions"><button disabled={busy || !synthetic || !responsible || !view.assignment || question.trim().length < 15 || !selected.length || selected.length > 4} onClick={() => action(async () => {
        setPlan(await api<PilotPlan>(path + '/prepare', { command_id: crypto.randomUUID(), assignment_id: view.assignment!.id, question: question.trim(), document_ids: selected, synthetic_data: true, max_cost_usd: 0 })); await reload();
      })}>Preparar consulta offline</button>
      <button className="primary" disabled={busy || !synthetic || !responsible || !readyPlan} onClick={() => action(async () => {
        const result = await api<{ id: string }>(path + '/run', { plan_id: readyPlan!.id, plan_hash: readyPlan!.plan_hash, authorize_offline: true, synthetic_data: true, max_cost_usd: 0 }); setRunId(result.id); await reload();
      })}>{busy ? 'Procesando…' : 'Ejecutar piloto offline · USD 0'}</button></div>
      {readyPlan && <p role="status">Equipo y evidencia preparados. Ejecutar es una acción separada; esta preparación vence a los 30 minutos.</p>}</div>
    </div>
    {view.runs.length > 0 && <section className="pilot-results" aria-label="Resultados del piloto">
      <div className="pilot-result-heading"><h3>Historial contractual</h3><label>Consulta guardada <select value={run?.id ?? ''} onChange={event => setRunId(event.target.value)}>{view.runs.map(item => <option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })} · {item.question.slice(0, 70)}</option>)}</select></label></div>
      {run && <>
        {run.completion_status === 'NEEDS_MORE_EVIDENCE' && <p role="status" className="pilot-warning">Falta evidencia o texto suficiente para cerrar la revisión documental. Se conservan las observaciones y los pendientes.</p>}
        {run.validity === 'OUTDATED' && <p role="status" className="pilot-warning">Evidencia o asignación desactualizada. Se conserva el resultado histórico; prepará una consulta nueva.</p>}
        <p className="pilot-audit">Control terminal: {run.audit.status === 'NO_REFERENCES' ? 'Sin referencias jurídicas identificadas para cotejar; no significa fuentes verificadas.' : `${run.audit.references.length} menciones jurídicas pendientes; ninguna se presenta como verificada.`} Se inspeccionaron las salidas y el texto final, dentro de la gramática disponible.</p>
        <details><summary>Ver evidencia y trazabilidad de las observaciones</summary><table><thead><tr><th>Documento y versión</th><th>Texto localizado</th><th>Observación</th></tr></thead><tbody>{run.findings.map((finding, index) => <tr key={index}><td>{run.evidence.find(document => document.document_id === finding.document_id)?.title}<br /><small>{finding.version_id.slice(0, 8)} · posición {finding.start}–{finding.end}</small></td><td>{finding.quote}</td><td>{finding.observation}</td></tr>)}</tbody></table></details>
        <article aria-label="Informe contractual offline"><pre className="pilot-report">{run.final_markdown}</pre></article>
        <div className="actions"><button onClick={download}>Descargar informe contractual</button><button disabled={busy || !synthetic || !responsible || run.validity !== 'CURRENT' || !!run.draft_link} onClick={() => action(async () => { await api(path + '/draft', { run_id: run.id, synthetic_data: true, max_cost_usd: 0 }); await reload(); onSaved(); })}>{run.draft_link ? 'Borrador guardado' : 'Guardar borrador contractual'}</button></div>
        {run.draft_link && <p role="status">Revisión humana del borrador: independiente del control de fuentes. {run.draft_link.audit_current ? 'Control ligado a la versión guardada.' : 'El borrador cambió: la nueva versión tiene control pendiente.'}</p>}
        {run.draft_link && !run.draft_link.audit_current && <button disabled={busy || !synthetic || !responsible} onClick={() => action(async () => { await api(path + '/recheck', { run_id: run.id, expected_version_id: run.draft_link!.current_version_id, explicitly_confirmed: true, synthetic_data: true, max_cost_usd: 0 }); await reload(); })}>Comprobar fuentes de la nueva versión</button>}
      </>}
    </section>}
    <details className="pilot-legacy"><summary>Consultas anteriores del asunto</summary><p>Se conserva la consulta existente y su historial. Tiene una autorización de ejecución propia.</p><button onClick={() => { sessionStorage.setItem(legacyKey, 'true'); setLegacy(true); }}>Abrir consulta anterior</button></details>
  </section>;
}
