import { z } from 'zod';
import catalog from '../../../docs/specialist-studio/contracts/SIX_AREA_SPECIALIST_CATALOG.v1.json' with { type: 'json' };
import capabilities from '../../../docs/specialist-studio/contracts/SPECIALIST_CAPABILITY_PACKS.v1.json' with { type: 'json' };
import { EvidenceSchema, contractualFindings, routeContractEvidence, hashText, type PilotEvidence } from './contractual-pilot.js';
import { extractCitationsCore } from '../../../junta-juridica/src/citation-checker/extraction-core.js';
import { executeDocumentaryTool } from './specialist-tools.js';
import { StoredExtractionSchema } from './document-extraction-contract.js';
import { DocumentChangeSchema } from './document-lifecycle.js';
import { MAX_DOCUMENTS, MAX_TEXT_CHARS, MAX_OUTPUT_CHARS } from './document-policy.js';

export const personas = catalog.specialists.map(persona => ({ id: persona.persona_id, name: persona.persona_name, area: persona.public_label, packs: persona.subprofiles }));
export const primaryPacks: Record<string, string> = { elena: 'civil_contractual', valeria: 'comercial_societario', lucia: 'laboral_individual', martin: 'tributario_impuestos', diego: 'penal_defensa', camila: 'publico_administrativo' };
export const PersonaSchema = z.enum(['elena', 'valeria', 'lucia', 'martin', 'diego', 'camila']);
const id = z.string().min(1).max(128), digest = z.string().regex(/^[a-f0-9]{64}$/), time = z.iso.datetime();
const scope = { law_firm_id: id, matter_id: id };
function canonical(value: unknown): unknown { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, item]) => [key, canonical(item)])); return value; }
export const hashTeamValue = (value: unknown) => hashText(JSON.stringify(canonical(value)));
const hashValue = hashTeamValue;
export const ParticipantSchema = z.object({ persona_id: PersonaSchema, pack_id: id, question: z.string().trim().min(15).max(2000), reason: z.string().trim().min(8).max(600) }).strict();
export const TeamConfigSchema = z.object({
  question: z.string().trim().min(15).max(2000), jurisdiction: z.literal('PY'), as_of: z.iso.date(),
  mode: z.enum(['FOCAL', 'SPECIALIZED', 'FULL_BOARD']), depth: z.enum(['STANDARD', 'DEEP']), adversarial: z.boolean(),
  lead_id: PersonaSchema, participants: z.array(ParticipantSchema).min(1).max(6),
}).strict().superRefine((team, ctx) => {
  const ids = team.participants.map(p => p.persona_id);
  if (new Set(ids).size !== ids.length || !ids.includes(team.lead_id)) ctx.addIssue({ code: 'custom', message: 'TEAM_INVALID_MEMBERS' });
  if (team.mode === 'FOCAL' && ids.length !== 1 || team.mode === 'SPECIALIZED' && ids.length < 2 || team.mode === 'FULL_BOARD' && ids.length !== 6) ctx.addIssue({ code: 'custom', message: 'TEAM_INVALID_MODE' });
  for (const participant of team.participants) if (!personas.find(p => p.id === participant.persona_id)?.packs.some(p => p.subprofile_id === participant.pack_id)) ctx.addIssue({ code: 'custom', message: 'TEAM_PACK_MISMATCH' });
});
export type TeamConfig = z.infer<typeof TeamConfigSchema>;
export function sameTeamConfig(left: unknown, right: unknown): boolean {
  const a = TeamConfigSchema.safeParse(left), b = TeamConfigSchema.safeParse(right);
  return a.success && b.success && JSON.stringify(canonical(a.data)) === JSON.stringify(canonical(b.data));
}
export const TeamEvidenceSchema = EvidenceSchema.extend({ text: z.string().min(1).max(MAX_TEXT_CHARS), original_sha256: digest.optional(), extraction_status: z.enum(['COMPLETE_UNREVIEWED', 'REVIEW_REQUIRED']).optional(), extraction_warnings: z.array(z.string()).optional() }).strict();
export const AssignmentSchema = z.object({ ...scope, id, command_id: id, input_hash: digest, version: z.number().int().positive(), human_owner_id: id, actor_id: id, config: TeamConfigSchema, created_at: time }).strict();
export const PlanSchema = z.object({ ...scope, id, command_id: id, assignment_id: id, assignment_version: z.number().int().positive(), human_owner_id: id, config: TeamConfigSchema, evidence: z.array(TeamEvidenceSchema).min(1).max(MAX_DOCUMENTS), inventory_hash: digest, max_cost_usd: z.literal(0), max_debate_rounds: z.literal(1), created_at: time, expires_at: time, plan_hash: digest }).strict();
const OutputSchema = z.object({ id, author: z.string().min(1).max(128), phase: z.enum(['QUESTION', 'COORDINATION', 'EVIDENCE', 'OPINION', 'OBJECTION', 'REPLY', 'INTEGRATION']), text: z.string().max(MAX_OUTPUT_CHARS) }).strict();
const LocalizerSchema = z.object({ document_id: id, version_id: id, start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), quote: z.string().min(1), nature: z.enum(['DOCUMENT_TEXT', 'PARTY_ALLEGATION']) }).strict();
const FindingSchema = z.object({ issue: z.string(), evidence: LocalizerSchema, interpretation: z.string(), alternative: z.string(), missing: z.string() }).strict();
export const OpinionSchema = z.object({ participant_id: PersonaSchema, pack_id: id, pack_version: z.literal(1), assigned_question: z.string(), procedure: z.array(z.string()), tool_ids: z.array(z.string()), findings: z.array(FindingSchema), missing_inputs: z.array(z.string()), source_status: z.literal('NOT_RETRIEVED_OFFLINE'), conclusion: z.string(), evaluation: z.literal('NOT_ACCREDITED'), coverage: z.object({ selected_documents: z.number(), retained_lines: z.number(), examined_lines: z.number(), truncated: z.literal(false) }).strict() }).strict();
export const ObjectionSchema = z.object({ id, target_id: PersonaSchema, opinion_id: id, kind: z.enum(['MISSING_EVIDENCE', 'COUNTEREVIDENCE', 'INFERENCE_LIMIT', 'SOURCE_GAP']), text: z.string(), evidence: z.array(LocalizerSchema), required_response: z.string() }).strict();
export const ReplySchema = z.object({ id, objection_id: id, participant_id: PersonaSchema, disposition: z.enum(['ACCEPTED_LIMIT', 'DISAGREEMENT_PRESERVED']), text: z.string() }).strict();
const AuditSchema = z.object({ checker_version: z.literal('team-terminal-v1'), checked_at: time, final_content_hash: digest, manifest_hash: digest,
  outputs: z.array(z.object({ id, author: z.string(), phase: OutputSchema.shape.phase, sha256: digest }).strict()),
  references: z.array(z.object({ output_id: id, text: z.string(), start: z.number(), end: z.number(), status: z.literal('REVIEW_REQUIRED') }).strict()),
  status: z.enum(['NO_REFERENCES', 'REVIEW_REQUIRED']), coverage: z.literal('ALL_OUTPUTS_GRAMMAR_LIMITED_NO_OFFICIAL_RETRIEVAL'),
}).strict();
export const RunSchema = z.object({ ...scope, id, plan_id: id, plan_hash: digest, assignment_id: id, human_owner_id: id, config: TeamConfigSchema, evidence: z.array(TeamEvidenceSchema), inventory_hash: digest,
  opinions: z.array(OpinionSchema).min(1).max(6), objections: z.array(ObjectionSchema), replies: z.array(ReplySchema), outputs: z.array(OutputSchema), final_markdown: z.string().max(MAX_OUTPUT_CHARS), audit: AuditSchema,
  created_at: time, execution: z.literal('DETERMINISTIC_OFFLINE'), actual_cost_usd: z.literal(0), paid_calls: z.literal(0), human_review: z.literal('PENDING'),
  stages: z.array(z.enum(['COORDINATION', 'COMMON_EVIDENCE', 'INDEPENDENT_OPINIONS', 'OBJECTIONS', 'REPLIES', 'LEAD_INTEGRATION', 'FINAL_CHECKER', 'HUMAN_REVIEW_PENDING'])),
}).strict();
export const TeamStateSchema = z.object({ schema_version: z.literal(1), assignments: z.array(AssignmentSchema), plans: z.array(PlanSchema), runs: z.array(RunSchema),
  links: z.array(z.object({ law_firm_id: id, matter_id: id, command_id: id, actor_id: id, input_hash: digest, assignment_id: id }).strict()),
  context_commands: z.array(z.object({ ...scope, client_id: id, command_id: id, actor_id: id, input_hash: digest, assignment_id: id }).strict()).default([]),
  document_commands: z.array(z.object({ ...scope, command_id: id, actor_id: id, input_hash: digest, document_ids: z.array(id).min(1).max(MAX_DOCUMENTS), reused_document_ids: z.array(id).max(MAX_DOCUMENTS).default([]) }).strict()).default([]),
  document_changes: z.array(DocumentChangeSchema).default([]),
  document_extractions: z.array(StoredExtractionSchema).default([]),
  draft_links: z.array(z.object({ ...scope, run_id: id, draft_id: id, document_version_id: id, content_hash: digest, audit: AuditSchema }).strict()),
}).strict();
export type TeamState = z.infer<typeof TeamStateSchema>;
export type TeamAssignment = z.infer<typeof AssignmentSchema>;
export type TeamPlan = z.infer<typeof PlanSchema>;
export type TeamRun = z.infer<typeof RunSchema>;
export type Opinion = z.infer<typeof OpinionSchema>;
export const emptyTeamState = (): TeamState => ({ schema_version: 1, assignments: [], plans: [], runs: [], links: [], context_commands: [], document_commands: [], document_changes: [], document_extractions: [], draft_links: [] });

/** Capability descriptions are loaded, but neither instructions nor an avatar grant execution authority. */
export function loadPack(personaId: string, packId: string) {
  const persona = personas.find(p => p.id === personaId);
  const pack = capabilities.packs.find(p => p.pack_id === packId);
  if (!pack || !persona?.packs.some(p => p.subprofile_id === packId)) throw Error('TEAM_PACK_MISMATCH');
  return { ...pack, persona_id: persona.id, offline_enabled: primaryPacks[persona.id] === packId, legal_release: false as const, common_policy: capabilities.common_policy };
}
const assignments: Record<string, { question: string; reason: string; pattern: RegExp }> = {
  elena: { question: 'Identificar obligaciones, condiciones, excepciones, contradicciones y anexos pendientes.', reason: 'Delimitar prestaciones y dependencias documentales del encargo.', pattern: /contrat|obligaci|anexo|patrimoni|civil/iu },
  valeria: { question: 'Identificar actos societarios, representación, facultades y documentos de aprobación pendientes.', reason: 'Revisar quién actúa y qué respaldo documental tienen sus facultades.', pattern: /socied|societ|accion|represent|poder|empresa|comercial/iu },
  lucia: { question: 'Ordenar la cronología laboral y separar los hechos alegados de su respaldo documental.', reason: 'Revisar relación de trabajo, fechas y documentación de ambas posiciones.', pattern: /laboral|trabaj|salari|despid|emplead/iu },
  martin: { question: 'Relacionar operación, período, obligación tributaria y comprobantes pendientes.', reason: 'Delimitar operaciones y períodos sin aplicar fórmulas no aprobadas.', pattern: /tribut|impuest|fiscal|iva|aduan|factur/iu },
  diego: { question: 'Separar hipótesis penales, elementos alegados, evidencia favorable y contraria y garantías.', reason: 'Identificar límites probatorios sin completar hechos ni presumir responsabilidad.', pattern: /penal|delito|denuncia|imput|fraude|estafa/iu },
  camila: { question: 'Relacionar competencia, acto, procedimiento, fundamento y constancias de notificación.', reason: 'Revisar la secuencia documental de la actuación pública y sus faltantes.', pattern: /administrativ|p[uú]blic|licitaci|resoluci|municipal|constitucion/iu },
};
const subprofileRoutes: Array<[string, string, RegExp]> = [
  ['elena', 'civil_familia', /familia|divorci|custodia|alimentos|niñez/iu],
  ['elena', 'civil_sucesorio', /sucesi[oó]n|sucesorio|herencia|testamento|hereder/iu],
  ['elena', 'civil_inmobiliario', /inmuebl|usufruct|hipoteca|derecho de propiedad/iu],
  ['elena', 'civil_responsabilidad', /daños|responsabilidad civil/iu],
  ['valeria', 'comercial_concursal', /insolvencia|quiebra|concursal/iu],
  ['valeria', 'comercial_bancario', /bancari|financiaci[oó]n|cr[eé]dito bancario/iu],
  ['valeria', 'comercial_negocios', /fusi[oó]n|adquisici[oó]n|operaci[oó]n comercial/iu],
  ['lucia', 'laboral_colectivo', /sindicato|huelga|convenio colectivo/iu],
  ['lucia', 'laboral_seguridad_social', /seguridad social|jubilaci[oó]n|aporte previsional/iu],
  ['martin', 'tributario_fiscalizaciones', /fiscalizaci[oó]n|determinaci[oó]n tributaria|controversia tributaria/iu],
  ['martin', 'aduanero_comercio_exterior', /aduan|arancel|importaci[oó]n|exportaci[oó]n/iu],
  ['diego', 'penal_querella', /querella|v[ií]ctima/iu],
  ['diego', 'penal_economico', /delito econ[oó]mico|lavado de dinero/iu],
  ['camila', 'publico_constitucional', /constitucional|amparo|habeas/iu],
  ['camila', 'publico_contratacion', /licitaci[oó]n|contrataci[oó]n p[uú]blica/iu],
  ['camila', 'publico_regulatorio', /regulatori|regulaci[oó]n sectorial/iu],
];
export function suggestTeam(question: string, asOf: string): TeamConfig {
  const matches = personas.filter(p => assignments[p.id]!.pattern.test(question) || subprofileRoutes.some(([persona, , pattern]) => persona === p.id && pattern.test(question)));
  if (!matches.length) throw Error('TEAM_CLARIFICATION_REQUIRED');
  return TeamConfigSchema.parse({ question, jurisdiction: 'PY', as_of: asOf, mode: matches.length === 1 ? 'FOCAL' : 'SPECIALIZED', depth: 'STANDARD', adversarial: false, lead_id: matches[0]!.id, participants: matches.map(p => {
    const participant = proposedParticipant(p.id), route = subprofileRoutes.find(([persona, , pattern]) => persona === p.id && pattern.test(question));
    if (!route) return participant;
    const pack = loadPack(p.id, route[1]);
    return { ...participant, pack_id: pack.pack_id, question: 'Delimitar ' + pack.label + ': ' + pack.required_inputs.join('; ') + '.', reason: 'El encargo menciona esta subespecialidad. ' + (pack.offline_enabled ? 'Herramienta documental experimental disponible.' : 'Requiere habilitación específica; no se sustituye por el paquete general.') };
  }) });
}
export function proposedParticipant(personaId: string) { return { persona_id: personaId as z.infer<typeof PersonaSchema>, pack_id: primaryPacks[personaId]!, question: assignments[personaId]!.question, reason: assignments[personaId]!.reason }; }

export function compareTexts(left: PilotEvidence, right: PilotEvidence) {
  const a = left.text.split('\n'), b = right.text.split('\n');
  return { left_version_id: left.version_id, right_version_id: right.version_id, removed: a.filter(line => !b.includes(line)), added: b.filter(line => !a.includes(line)), meaning: 'TEXT_DIFFERENCE_ONLY' as const };
}
/** Read-only retrieval over the exact, authorized evidence snapshot. No document can enable a tool. */
export function retrievePassages(evidence: PilotEvidence[], query: RegExp) { return routeContractEvidence(evidence).filter(line => query.test(line.quote)); }
function opinionText(opinion: Opinion) {
  const name = personas.find(p => p.id === opinion.participant_id)!.name;
  return `## ${name} · ${loadPack(opinion.participant_id, opinion.pack_id).label}\nPregunta propia: ${opinion.assigned_question}\n\n` + opinion.findings.map(f => `- Problema: ${f.issue}\n  Respaldo: ${f.evidence.document_id} / ${f.evidence.version_id}, posiciones ${f.evidence.start}–${f.evidence.end}: «${f.evidence.quote}»\n  Interpretación documental: ${f.interpretation}\n  Alternativa: ${f.alternative}\n  Pendiente: ${f.missing}`).join('\n') + `\n\nFaltantes: ${opinion.missing_inputs.join('; ')}.\nConclusión condicionada: ${opinion.conclusion}`;
}
/** Independent by construction: no opinions or summaries are accepted as inputs. */
export function executePackage(participant: TeamConfig['participants'][number], evidence: Array<PilotEvidence & { extraction_warnings?: string[] }>, depth: TeamConfig['depth']): Opinion {
  const pack = loadPack(participant.persona_id, participant.pack_id);
  if (!pack.offline_enabled) throw Error('TEAM_PACK_NOT_ENABLED');
  const all = routeContractEvidence(evidence);
  const matrix = participant.persona_id === 'elena' ? null : executeDocumentaryTool(participant.persona_id, evidence);
  const localized = (line: typeof all[number]) => ({ document_id: line.document_id, version_id: line.version_id, start: line.start, end: line.end, quote: line.quote, nature: line.nature });
  const findings: Opinion['findings'] = participant.persona_id === 'elena'
    ? contractualFindings(evidence).map(f => ({ issue: f.observation, evidence: localized(all.find(l => l.document_id === f.document_id && l.start === f.start)!), interpretation: 'El texto contiene esta mención; su eficacia, cumplimiento y alcance jurídico no están acreditados.', alternative: 'Cotejar versión firmada, anexos y evidencia de ambas partes antes de concluir.', missing: 'Determinar versión aplicable, cumplimiento y fuentes pertinentes.' }))
    : matrix!.rows.map(row => ({ issue: matrix!.columns[0] + ': ' + row.cells[0], evidence: localized(row.evidence), interpretation: row.cells.slice(1).map((cell, i) => matrix!.columns[i + 1] + ': ' + cell).join('. '), alternative: 'Contrastar este pasaje con originales, fechas y documentos de la posición contraria.', missing: pack.required_inputs.join('; ') }));
  if (depth === 'DEEP' && evidence.length > 1) {
    const diff = compareTexts(evidence[0]!, evidence[1]!);
    // A textual difference never establishes which instrument governs.
    if (diff.added.length || diff.removed.length) {
      const first = all[0];
      if (first) findings.push({ issue: 'Los textos seleccionados difieren.', evidence: localized(first), interpretation: `${diff.removed.length} líneas solo en el primer texto y ${diff.added.length} solo en el segundo. No determina prelación jurídica.`, alternative: 'Examinar la comparación íntegra y la aceptación de cada instrumento.', missing: 'Confirmación humana de la versión aplicable.' });
    }
  }
  return OpinionSchema.parse({ participant_id: participant.persona_id, pack_id: pack.pack_id, pack_version: pack.version, assigned_question: participant.question, procedure: pack.procedure, tool_ids: [matrix?.tool_id ?? 'contract_obligation_matrix_v1', 'authorized_snapshot_retrieval_v1', ...(depth === 'DEEP' ? ['text_diff_v1'] : [])], findings,
    missing_inputs: [...pack.required_inputs, 'Fuentes oficiales pertinentes por jurisdicción y fecha: no recuperadas en modo offline.', ...evidence.flatMap(e => (e.extraction_warnings ?? []).map(warning => e.title + ': ' + warning)), ...(all.some(l => /\[ILEGIBLE\]|\[TRUNCADO\]|�/u.test(l.quote)) ? ['Calidad insuficiente en parte del texto aportado.'] : []), ...(!findings.length ? ['No se localizó respaldo pertinente para la pregunta; abstención de conclusión sustantiva.'] : [])],
    source_status: 'NOT_RETRIEVED_OFFLINE', conclusion: 'Se entrega una matriz documental experimental. No permite afirmar validez, deuda, responsabilidad o viabilidad jurídica; requiere revisión humana y evidencia pendiente.', evaluation: 'NOT_ACCREDITED', coverage: { selected_documents: evidence.length, retained_lines: all.length, examined_lines: all.length, truncated: false } });
}
export async function auditTeamOutputs(outputs: TeamRun['outputs'], finalMarkdown: string, checkedAt = new Date().toISOString()) {
  if (new Set(outputs.map(o => o.id)).size !== outputs.length || outputs.filter(o => o.phase === 'INTEGRATION').length !== 1 || outputs.find(o => o.phase === 'INTEGRATION')?.text !== finalMarkdown) throw Error('TEAM_MANIFEST_INVALID');
  const manifest = await Promise.all(outputs.map(async o => ({ id: o.id, author: o.author, phase: o.phase, sha256: await hashText(o.text) })));
  const references: z.infer<typeof AuditSchema>['references'] = [];
  for (const o of outputs) {
    const found = extractCitationsCore(o.text, 'PY', (_raw, start) => o.id + ':' + start);
    for (const citation of found.citations) references.push({ output_id: o.id, text: citation.citation.raw_text ?? '', start: citation.start, end: citation.end, status: 'REVIEW_REQUIRED' });
    for (const marker of found.unresolved_markers) references.push({ output_id: o.id, text: marker.text, start: marker.start, end: marker.end, status: 'REVIEW_REQUIRED' });
  }
  return AuditSchema.parse({ checker_version: 'team-terminal-v1', checked_at: checkedAt, final_content_hash: await hashText(finalMarkdown), manifest_hash: await hashValue(manifest), outputs: manifest, references, status: references.length ? 'REVIEW_REQUIRED' : 'NO_REFERENCES', coverage: 'ALL_OUTPUTS_GRAMMAR_LIMITED_NO_OFFICIAL_RETRIEVAL' });
}
export async function verifyTeamPlan(plan: TeamPlan) {
  const { plan_hash, ...content } = plan;
  if (await hashValue(content) !== plan_hash) throw Error('TEAM_PLAN_HASH_MISMATCH');
  for (const item of plan.evidence) if (await hashText(item.text) !== item.sha256) throw Error('TEAM_EVIDENCE_HASH_MISMATCH');
}
/** Santiago receives every independent contribution and the complete selected evidence, including contrary passages. */
export function reviewAdversarial(opinions: Opinion[], evidence: PilotEvidence[]) {
  const all = routeContractEvidence(evidence);
  const contrary = all.filter(line => /salvo|excepto|niega|contradic|no consta|sin acreditar/iu.test(line.quote));
  const contractual = contractualFindings(evidence), missingAnnex = contractual.filter(f => f.kind === 'MISSING_ANNEX');
  const differingAmounts = contractual.some(f => f.kind === 'AMOUNT' && f.observation.includes('importes diferentes'));
  return opinions.map(opinion => {
    const relevant = [...opinion.findings.map(f => f.evidence), ...contrary];
    const unique = new Map(relevant.map(e => [e.document_id + ':' + e.version_id + ':' + e.start, e]));
    const localizers = [...unique.values()].map(({ document_id, version_id, start, end, quote, nature }) => ({ document_id, version_id, start, end, quote, nature }));
    return ObjectionSchema.parse({ id: 'objection:' + opinion.participant_id, target_id: opinion.participant_id, opinion_id: 'opinion:' + opinion.participant_id, kind: contrary.length || differingAmounts ? 'COUNTEREVIDENCE' : missingAnnex.length ? 'MISSING_EVIDENCE' : 'INFERENCE_LIMIT',
      text: `La matriz de ${personas.find(p => p.id === opinion.participant_id)!.name} no acredita los hechos ni la eficacia jurídica. Se revisaron ${all.length} pasajes de la evidencia común y su aporte íntegro. ${contrary.length ? 'Se conserva evidencia contraria o excepciones: ' + contrary.map(e => '«' + e.quote + '»').join('; ') + '. ' : ''}${differingAmounts ? 'Hay importes distintos: no elegir uno sin justificar su relación con la prestación. ' : ''}${missingAnnex.length ? 'Hay anexos remitidos sin respaldo en la selección. ' : ''}Examinar supuestos, fuentes y faltantes: ${opinion.missing_inputs.join('; ')}`,
      evidence: localizers, required_response: 'Indicar qué puede sostenerse con estos pasajes, qué debe corregirse y qué permanece sin resolver.' });
  });
}
export async function executeTeam(plan: TeamPlan): Promise<TeamRun> {
  await verifyTeamPlan(plan);
  const outputs: TeamRun['outputs'] = [
    { id: 'question', author: 'HUMAN', phase: 'QUESTION', text: plan.config.question },
    { id: 'coordination', author: 'gabriel', phase: 'COORDINATION', text: JSON.stringify(plan.config) },
    { id: 'evidence', author: 'DOCUMENT_ROUTER', phase: 'EVIDENCE', text: plan.evidence.map(e => `${e.document_id}/${e.version_id} · ${e.nature}\n${e.text}`).join('\n\n') },
  ];
  const opinions = plan.config.participants.map(p => executePackage(p, plan.evidence, plan.config.depth));
  for (const o of opinions) outputs.push({ id: 'opinion:' + o.participant_id, author: o.participant_id, phase: 'OPINION', text: opinionText(o) });
  const objections: TeamRun['objections'] = [], replies: TeamRun['replies'] = [];
  if (plan.config.adversarial) for (const objection of reviewAdversarial(opinions, plan.evidence)) {
    objections.push(objection);
    outputs.push({ id: objection.id, author: 'santiago', phase: 'OBJECTION', text: JSON.stringify(objection) });
    const reply = ReplySchema.parse({ id: 'reply:' + objection.target_id, objection_id: objection.id, participant_id: objection.target_id, disposition: 'ACCEPTED_LIMIT', text: 'Se acepta el límite: se mantienen únicamente las menciones documentales localizadas, se conservan condiciones y contraevidencia y se suspende toda conclusión sustantiva. Los faltantes siguen abiertos; no se resuelven por consenso.' });
    replies.push(reply); outputs.push({ id: reply.id, author: reply.participant_id, phase: 'REPLY', text: reply.text });
  }
  const lead = personas.find(p => p.id === plan.config.lead_id)!;
  const final = `# Equipo jurídico · revisión documental local\n\nIntegración del titular: ${lead.name}. Gabriel coordinó el encargo; no emitió opinión jurídica.\nJurisdicción: Paraguay. Corte: ${plan.config.as_of}.\n\nEJERCICIO OFFLINE CON DATOS SINTÉTICOS · USD 0 · Revisión humana pendiente.\nPaquetes experimentales, sin evaluación jurídica habilitante. No se recuperaron fuentes oficiales.\n\n## Encargo\n${plan.config.question}\n\n${opinions.map(opinionText).join('\n\n')}\n\n## Objeciones y respuestas\n${objections.length ? objections.map(o => `### Santiago → ${personas.find(p => p.id === o.target_id)!.name}\n${o.text}\nRespuesta: ${replies.find(r => r.objection_id === o.id)!.text}`).join('\n\n') : 'Revisión adversarial no autorizada para este encargo.'}\n\n## Integración y pendientes\n${lead.name} conserva las matrices de cada área y los límites aceptados. No se elimina ningún desacuerdo ni se infiere verdad por acuerdo. ${opinions.map(o => `${personas.find(p => p.id === o.participant_id)!.name}: ${o.missing_inputs.join('; ')}`).join('\n')}\n\n## Control de referencias\nLas menciones jurídicas de todos los aportes, objeciones, réplicas y esta integración se inspeccionan con la gramática disponible. Sin cotejo oficial offline, ninguna fuente se presenta como verificada. El control no certifica mérito jurídico.\n`;
  outputs.push({ id: 'integration', author: lead.id, phase: 'INTEGRATION', text: final });
  return RunSchema.parse({ law_firm_id: plan.law_firm_id, matter_id: plan.matter_id, id: crypto.randomUUID(), plan_id: plan.id, plan_hash: plan.plan_hash, assignment_id: plan.assignment_id, human_owner_id: plan.human_owner_id, config: plan.config, evidence: plan.evidence, inventory_hash: plan.inventory_hash, opinions, objections, replies, outputs, final_markdown: final, audit: await auditTeamOutputs(outputs, final), created_at: new Date().toISOString(), execution: 'DETERMINISTIC_OFFLINE', actual_cost_usd: 0, paid_calls: 0, human_review: 'PENDING', stages: ['COORDINATION', 'COMMON_EVIDENCE', 'INDEPENDENT_OPINIONS', ...(plan.config.adversarial ? ['OBJECTIONS', 'REPLIES'] : []), 'LEAD_INTEGRATION', 'FINAL_CHECKER', 'HUMAN_REVIEW_PENDING'] });
}
export async function verifyTeamRun(run: TeamRun) {
  RunSchema.parse(run);
  if (JSON.stringify(await auditTeamOutputs(run.outputs, run.final_markdown, run.audit.checked_at)) !== JSON.stringify(run.audit)) throw Error('TEAM_AUDIT_MISMATCH');
  const ids = run.config.participants.map(p => p.persona_id);
  const requiredContent = { question: run.config.question, coordination: JSON.stringify(run.config), evidence: run.evidence.map(e => `${e.document_id}/${e.version_id} · ${e.nature}\n${e.text}`).join('\n\n') };
  for (const [id, text] of Object.entries(requiredContent)) if (run.outputs.find(o => o.id === id)?.text !== text) throw Error('TEAM_CONTEXT_MISMATCH');
  if (run.outputs.find(o => o.id === 'integration')?.author !== run.config.lead_id || run.outputs.find(o => o.id === 'coordination')?.author !== 'gabriel') throw Error('TEAM_AUTHORSHIP_MISMATCH');
  if (run.opinions.length !== ids.length || new Set(run.opinions.map(o => o.participant_id)).size !== ids.length) throw Error('TEAM_INCOMPLETE_OPINIONS');
  for (const o of run.opinions) {
    const participant = run.config.participants.find(p => p.persona_id === o.participant_id);
    const output = run.outputs.find(output => output.id === 'opinion:' + o.participant_id);
    if (!participant || participant.pack_id !== o.pack_id || participant.question !== o.assigned_question || output?.text !== opinionText(o) || output.author !== o.participant_id || output.phase !== 'OPINION') throw Error('TEAM_OPINION_MISMATCH');
    for (const f of o.findings) {
      const doc = run.evidence.find(e => e.document_id === f.evidence.document_id && e.version_id === f.evidence.version_id);
      if (!doc || doc.text.slice(f.evidence.start, f.evidence.end) !== f.evidence.quote || doc.nature !== f.evidence.nature) throw Error('TEAM_INVALID_LOCALIZER');
    }
  }
  const expected = ['question', 'coordination', 'evidence', ...ids.map(id => 'opinion:' + id), ...(run.config.adversarial ? ids.flatMap(id => ['objection:' + id, 'reply:' + id]) : []), 'integration'];
  if (run.outputs.length !== expected.length || expected.some(id => !run.outputs.some(o => o.id === id)) || run.objections.length !== (run.config.adversarial ? ids.length : 0) || run.replies.length !== run.objections.length) throw Error('TEAM_INCOMPLETE_DEBATE');
  for (const o of run.objections) {
    const output = run.outputs.find(output => output.id === o.id), reply = run.replies.find(r => r.objection_id === o.id);
    const replyOutput = reply && run.outputs.find(output => output.id === reply.id);
    if (!ids.includes(o.target_id) || o.opinion_id !== 'opinion:' + o.target_id || output?.author !== 'santiago' || output.phase !== 'OBJECTION' || output.text !== JSON.stringify(o) || !reply || reply.participant_id !== o.target_id || replyOutput?.text !== reply.text || replyOutput.author !== reply.participant_id || replyOutput.phase !== 'REPLY') throw Error('TEAM_DEBATE_MISMATCH');
    for (const e of o.evidence) if (!run.evidence.some(d => d.document_id === e.document_id && d.version_id === e.version_id && d.nature === e.nature && d.text.slice(e.start, e.end) === e.quote)) throw Error('TEAM_INVALID_LOCALIZER');
  }
  for (const item of run.evidence) if (await hashText(item.text) !== item.sha256) throw Error('TEAM_EVIDENCE_HASH_MISMATCH');
}
