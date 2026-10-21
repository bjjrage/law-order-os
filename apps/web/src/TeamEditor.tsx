import { useState } from 'react';
import { personas, proposedParticipant, loadPack, type TeamConfig } from './specialist-engine.js';

export function Avatar({ id, size = 48 }: { id: string; size?: number }) {
  if (id === 'gabriel' || id === 'santiago') return <span className={'reference-avatar reference-avatar-' + id} style={{ width: size, height: size }} aria-hidden="true"><img src="/agents/approved-team-reference.png" alt="" /></span>;
  return <img className="team-avatar" src={'/agents/' + id + '.png'} alt="" width={size} height={size} />;
}
export default function TeamEditor({ config, onChange, disabled = false }: { config: TeamConfig; onChange: (config: TeamConfig) => void; disabled?: boolean }) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const update = (changes: Partial<TeamConfig>) => onChange({ ...config, ...changes });
  function toggle(id: string) {
    const selected = config.participants.some(p => p.persona_id === id);
    if (selected && config.participants.length === 1) return;
    const participants = selected ? config.participants.filter(p => p.persona_id !== id) : [...config.participants, proposedParticipant(id)];
    update({ participants, lead_id: participants.some(p => p.persona_id === config.lead_id) ? config.lead_id : participants[0]!.persona_id, mode: participants.length === 1 ? 'FOCAL' : participants.length === 6 ? 'FULL_BOARD' : 'SPECIALIZED' });
  }
  return <section className="team-editor" aria-label="Propuesta de equipo">
    <div className="section-heading"><div><span className="eyebrow">EQUIPO PROPUESTO</span><h3>{config.mode === 'FOCAL' ? 'Consulta focal' : config.mode === 'FULL_BOARD' ? 'Junta completa' : 'Equipo especializado'}</h3></div><div className="actions"><button disabled={disabled} onClick={() => setCatalogOpen(!catalogOpen)} aria-expanded={catalogOpen}>Agregar especialista</button><button disabled={disabled} onClick={() => update({ mode: 'FULL_BOARD', participants: personas.map(p => config.participants.find(member => member.persona_id === p.id) ?? proposedParticipant(p.id)) })}>Convocar Junta completa</button></div></div>
    <p className="muted">Cada integrante necesita una cuestión propia. La titularidad, la profundidad y la revisión adversarial se eligen por separado.</p>
    {catalogOpen && <div className="specialist-selector" aria-label="Catálogo de especialistas">{personas.map(p => <button key={p.id} disabled={disabled || config.participants.length === 1 && config.participants[0]!.persona_id === p.id} aria-pressed={config.participants.some(m => m.persona_id === p.id)} onClick={() => toggle(p.id)}><Avatar id={p.id} /><span><strong>{p.name}</strong><small>{p.area}</small></span><span>{config.participants.some(m => m.persona_id === p.id) ? 'Quitar' : 'Agregar'}</span></button>)}</div>}
    <div className="assigned-team">{config.participants.map(member => {
      const persona = personas.find(p => p.id === member.persona_id)!, pack = loadPack(member.persona_id, member.pack_id);
      const change = (changes: Partial<typeof member>) => update({ participants: config.participants.map(p => p.persona_id === member.persona_id ? { ...p, ...changes } : p) });
      return <article key={member.persona_id} className="assigned-person"><header><Avatar id={member.persona_id} size={56} /><div><strong>{persona.name}</strong><small>{persona.area}</small></div><label className="lead-choice"><input type="radio" name="team-lead" aria-label={persona.name + ' como titular'} disabled={disabled} checked={config.lead_id === member.persona_id} onChange={() => update({ lead_id: member.persona_id })} />Titular</label></header>
        <label>Paquete<select disabled={disabled} aria-label={'Paquete de ' + persona.name} value={member.pack_id} onChange={e => change({ pack_id: e.target.value })}>{persona.packs.map(p => <option key={p.subprofile_id} value={p.subprofile_id}>{p.label}{loadPack(persona.id, p.subprofile_id).offline_enabled ? ' · local experimental' : ' · sin habilitar'}</option>)}</select></label>
        <label>Cuestión asignada<textarea disabled={disabled} aria-label={'Cuestión de ' + persona.name} rows={2} maxLength={2000} value={member.question} onChange={e => change({ question: e.target.value })} /></label>
        <label>Motivo de convocatoria<input disabled={disabled} aria-label={'Motivo de ' + persona.name} maxLength={600} value={member.reason} onChange={e => change({ reason: e.target.value })} /></label>
        <button className="text-action" onClick={() => setDetailsId(detailsId === member.persona_id ? null : member.persona_id)} aria-expanded={detailsId === member.persona_id}>Ver método y límites</button>
        {detailsId === member.persona_id && <div className="pack-detail"><strong>{pack.label} · versión {pack.version}</strong><p>{pack.required_inputs.join(' · ')}</p><ol>{pack.procedure.map(step => <li key={step}>{step}</li>)}</ol><p>{pack.abstention_conditions.join(' ')}</p><p>Fuentes requeridas: {pack.source_requirements.join('; ')}.</p><small>{pack.offline_enabled ? 'Herramientas documentales locales disponibles.' : 'Este paquete todavía no tiene ejecución habilitada.'} Evaluación jurídica humana pendiente. Los cálculos requieren reglas aprobadas; no se infieren importes exigibles.</small></div>}
      </article>;
    })}</div>
    <div className="team-options"><label>Profundidad<select disabled={disabled} aria-label="Profundidad del encargo" value={config.depth} onChange={e => update({ depth: e.target.value as TeamConfig['depth'] })}><option value="STANDARD">Estándar · matriz documental</option><option value="DEEP">Ampliada · incluye comparación textual</option></select></label><label className="adversarial-choice"><input type="checkbox" disabled={disabled} checked={config.adversarial} onChange={e => update({ adversarial: e.target.checked })} /><Avatar id="santiago" size={40} /><span><strong>Incluir a Santiago</strong><small>Revisión adversarial · una ronda de objeciones y réplicas</small></span></label></div>
  </section>;
}
