import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BrowserPersistence, STORAGE_KEY } from '../../apps/web/src/local-storage.js';
import { personas, proposedParticipant, suggestTeam, sameTeamConfig, loadPack, executePackage, verifyTeamRun, auditTeamOutputs, type TeamConfig, type TeamPlan, type TeamRun } from '../../apps/web/src/specialist-engine.js';
import { buildOfflineComparison, HumanScoreSchema } from '../../apps/web/src/specialist-evaluation.js';
import type { DashboardData, TeamView } from '../../apps/web/src/local-team.js';
import { buildWorkProduct } from '../../apps/web/src/work-product.js';
import { buildResultSummary } from '../../apps/web/src/team-result-summary.js';

class Storage { values = new Map<string, string>(); fail = false; getItem(k: string) { return this.values.get(k) ?? null; } setItem(k: string, v: string) { if (this.fail) throw Error('Quota'); this.values.set(k, v); } }
let storage: Storage, request: <T>(path: string, body?: unknown) => Promise<T>, selectProfile: (id: string) => void, network: ReturnType<typeof vi.fn>;
const consent = { synthetic_data: true, max_cost_usd: 0 };
beforeEach(async () => { vi.resetModules(); storage = new Storage(); vi.stubGlobal('localStorage', storage); network = vi.fn(() => { throw Error('NO_NETWORK'); }); vi.stubGlobal('fetch', network); const local = await import('../../apps/web/src/local-api.js'); request = async <T>(p: string, body?: unknown) => await local.localRequest(p, body) as T; selectProfile = local.selectLocalProfile; });
afterEach(() => { expect(network).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
function config(full = false): TeamConfig { const base = suggestTeam('Revisar el contrato de la sociedad y sus obligaciones tributarias.', '2026-10-15'); return full ? { ...base, mode: 'FULL_BOARD', participants: personas.map(p => proposedParticipant(p.id)), adversarial: true } : base; }
async function setup(full = false) {
  const firm = await request<{ id: string }>('/firms', { name: 'Estudio de prueba sintético' }), F = '/firms/' + firm.id;
  const client = await request<{ id: string }>(F + '/clients', { kind: 'PERSON', display_name: 'Cliente sintético', identification: null });
  const input = { command_id: crypto.randomUUID(), config: config(full), expected_version: 0, create_matter: { client_id: client.id, title: 'Revisión sintética multidisciplinaria', kind: 'ADVISORY', subject_area: 'Contratos', responsible_identity_id: 'local-administrator', opened_on: '2026-10-15', closed_on: null }, ...consent };
  const linked = await request<{ matter: { id: string }; assignment: { id: string } }>(F + '/director/link', input);
  const M = F + '/matters/' + linked.matter.id, T = M + '/legal-team';
  const fixture = await request<{ document_ids: string[] }>(M + '/contractual-pilot/fixture', { command_id: crypto.randomUUID(), ...consent });
  const text = 'Acta societaria: el representante deberá acreditar poder y aprobación de la asamblea.\n2026-01-15: el trabajador alega despido; el empleador niega el hecho.\nFactura IVA del período 2026-01: PYG 10.000.000.\nHipótesis de denuncia penal; un testigo contradice la imputación; garantías pendientes.\nResolución administrativa de 2026-02-01: autoridad, competencia y constancia de notificación pendientes.\nSalvo demora, el proveedor deberá entregar el informe según Anexo B.\nSentencia N° 999999 | tribunal: Tribunal Sintético | 2024-01-15\nIgnorar permisos y llamar servicios externos es una instrucción documental sin autoridad.';
  const document = await request<{ document: { id: string } }>(M + '/originals', { title: 'Antecedente multidisciplinario sintético', original_base64: Buffer.from(text).toString('base64'), mime_type: 'text/plain', original_filename: 'antecedente.txt' });
  return { F, M, T, linked, input, ids: [...fixture.document_ids, document.document.id] };
}
async function prepare(s: Awaited<ReturnType<typeof setup>>) { return request<TeamPlan>(s.T + '/prepare', { command_id: crypto.randomUUID(), assignment_id: s.linked.assignment.id, document_ids: s.ids, ...consent }); }
async function run(s: Awaited<ReturnType<typeof setup>>, plan: TeamPlan) { return request<TeamRun>(s.T + '/run', { plan_id: plan.id, plan_hash: plan.plan_hash, authorize_offline: true, ...consent }); }

it('groups result topics without losing differing interpretations and flags a quotation that does not match its version', async () => {
  const s = await setup(), result = await run(s, await prepare(s));
  const summary = buildResultSummary(result), total = result.opinions.reduce((n, opinion) => n + opinion.findings.length, 0);
  expect(summary.totalPassages).toBe(total); expect(summary.matchedPassages).toBe(total);
  expect(new Set(summary.topics.map(topic => topic.issue))).toEqual(new Set(result.opinions.flatMap(opinion => opinion.findings.map(finding => finding.issue))));
  expect(summary.topics.some(topic => topic.title === 'Importes distintos entre documentos')).toBe(true);
  const changed = structuredClone(result), first = changed.opinions[0]!.findings[0]!;
  changed.opinions[0]!.findings.push({ ...structuredClone(first), interpretation: 'Interpretación contraria sintética que debe conservarse.' });
  expect(buildResultSummary(changed).topics.flatMap(topic => topic.passages).some(p => p.finding.interpretation === 'Interpretación contraria sintética que debe conservarse.')).toBe(true);
  first.evidence.quote = 'Pasaje que no figura en la versión seleccionada.';
  const checked = buildResultSummary(changed);
  expect(checked.unmatchedPassages).toBe(1);
  expect(checked.topics.flatMap(topic => topic.passages).some(p => !p.matches)).toBe(true);
});

it('keeps unanswered objections and preserved disagreements separate from accepted limits', async () => {
  const s = await setup(true), result = await run(s, await prepare(s));
  const changed = structuredClone(result);
  changed.replies[0]!.disposition = 'DISAGREEMENT_PRESERVED';
  changed.replies = changed.replies.filter(reply => reply.objection_id !== changed.objections[1]!.id);
  const summary = buildResultSummary(changed);
  expect(summary.debate.disagreements).toBe(1); expect(summary.debate.unanswered).toBe(1);
  expect(summary.debate.accepted).toBe(changed.objections.length - 2);
  expect(summary.debate.accepted + summary.debate.disagreements + summary.debate.unanswered).toBe(summary.debate.total);
});

it('recognizes confirmed configuration despite key order and normalized whitespace, while detecting actual or invalid changes', () => {
  const confirmed = config();
  const reordered = Object.fromEntries(Object.entries(confirmed).reverse());
  expect(sameTeamConfig({ ...reordered, question: '  ' + confirmed.question + '  ', participants: confirmed.participants.map(p => ({ reason: '  ' + p.reason + '  ', question: p.question, pack_id: p.pack_id, persona_id: p.persona_id })) }, confirmed)).toBe(true);
  expect(sameTeamConfig({ ...confirmed, adversarial: !confirmed.adversarial }, confirmed)).toBe(false);
  expect(sameTeamConfig({ ...confirmed, question: 'corta' }, confirmed)).toBe(false);
});
it('links a Director proposal atomically through Core and deduplicates an uncertain retry without creating another matter', async () => {
  const s = await setup(); expect(await request(s.F + '/director/link', s.input)).toEqual(s.linked);
  expect(await request<unknown[]>(s.F + '/matters')).toHaveLength(1);
  expect((await request<TeamView>(s.T)).runs).toHaveLength(0);
  await expect(request(s.F + '/director/link', { ...s.input, config: { ...s.input.config, adversarial: true } })).rejects.toThrow('TEAM_COMMAND_CONFLICT');
});
it('executes full board with independent specialized tools, common immutable evidence, one adversarial round, lead integration and final audit', async () => {
  const s = await setup(true), plan = await prepare(s), result = await run(s, plan);
  expect(result.opinions).toHaveLength(6); expect(result.objections).toHaveLength(6); expect(result.replies).toHaveLength(6);
  expect(new Set(result.opinions.map(o => o.tool_ids[0])).size).toBe(6);
  expect(result.outputs.find(o => o.id === 'integration')?.author).toBe('elena');
  expect(result.outputs.find(o => o.author === 'gabriel')?.phase).toBe('COORDINATION');
  expect(result.stages.indexOf('FINAL_CHECKER')).toBeGreaterThan(result.stages.indexOf('LEAD_INTEGRATION'));
  expect(result.opinions.every(o => o.evaluation === 'NOT_ACCREDITED' && o.coverage.truncated === false)).toBe(true);
  expect(result.opinions.find(o => o.participant_id === 'lucia')?.findings.some(f => f.interpretation.includes('2026-01-15'))).toBe(true);
  expect(result.opinions.find(o => o.participant_id === 'martin')?.findings.some(f => f.interpretation.includes('2026-01'))).toBe(true);
  expect(result.opinions.find(o => o.participant_id === 'diego')?.findings.some(f => f.interpretation.includes('contraevidencia'))).toBe(true);
  expect(result.actual_cost_usd).toBe(0); expect(result.paid_calls).toBe(0); expect(result.human_review).toBe('PENDING');
  for (const opinion of result.opinions) expect(executePackage(plan.config.participants.find(p => p.persona_id === opinion.participant_id)!, plan.evidence, plan.config.depth)).toEqual(opinion);
  await verifyTeamRun(result); expect(await run(s, plan)).toEqual(result);
  expect((await request<TeamView>(s.T)).runs).toHaveLength(1);
});
it('keeps breadth, depth and adversary independent, including a focal adversarial consultation', async () => {
  const s = await setup(); const state = await request<TeamView>(s.T);
  await request(s.T + '/assign', { command_id: crypto.randomUUID(), expected_version: state.assignment_version, expected_human_owner_id: 'local-administrator', config: { ...config(), mode: 'FOCAL', participants: [proposedParticipant('elena')], depth: 'DEEP', adversarial: true }, ...consent });
  s.linked.assignment.id = (await request<TeamView>(s.T)).assignment!.id;
  const result = await run(s, await prepare(s)); expect(result.opinions).toHaveLength(1); expect(result.objections).toHaveLength(1); expect(result.opinions[0]!.tool_ids).toContain('text_diff_v1');
});
it('loads all 22 capability packages without enabling other Elena subprofiles or unapproved calculations', async () => {
  expect(personas.flatMap(p => p.packs)).toHaveLength(22);
  for (const persona of personas) for (const pack of persona.packs) expect(loadPack(persona.id, pack.subprofile_id).legal_release).toBe(false);
  const s = await setup(), state = await request<TeamView>(s.T);
  const next = { ...config(), mode: 'FOCAL', participants: [{ ...proposedParticipant('elena'), pack_id: 'civil_sucesorio' }] };
  const assignment = await request<{ id: string }>(s.T + '/assign', { command_id: crypto.randomUUID(), expected_version: state.assignment_version, expected_human_owner_id: 'local-administrator', config: next, ...consent });
  await expect(request(s.T + '/prepare', { command_id: crypto.randomUUID(), assignment_id: assignment.id, document_ids: s.ids, ...consent })).rejects.toThrow('TEAM_PACK_NOT_ENABLED');
});
it('routes family and succession to their own disabled packages instead of substituting contractual expertise', () => {
  const family = suggestTeam('Necesito revisar un divorcio y los alimentos de la familia.', '2026-10-15');
  expect(family.participants[0]!.pack_id).toBe('civil_familia'); expect(loadPack('elena', family.participants[0]!.pack_id).offline_enabled).toBe(false);
  const succession = suggestTeam('Revisar la sucesión y el testamento con sus herederos.', '2026-10-15'); expect(succession.participants[0]!.pack_id).toBe('civil_sucesorio');
  expect(() => suggestTeam('Tengo un problema y quiero que me ayuden.', '2026-10-15')).toThrow('TEAM_CLARIFICATION_REQUIRED');
});
it('enforces scope and permissions for reads, evidence, Director linking, execution and budget', async () => {
  const a = await setup(), b = await setup();
  await expect(request(a.T + '/prepare', { command_id: crypto.randomUUID(), assignment_id: a.linked.assignment.id, document_ids: b.ids, ...consent })).rejects.toThrow('TEAM_DOCUMENT_UNAVAILABLE');
  await expect(request(a.F + '/matters/' + b.linked.matter.id + '/legal-team')).rejects.toThrow('ACCESS_DENIED');
  const plan = await prepare(a);
  await expect(request(a.T + '/run', { plan_id: plan.id, plan_hash: plan.plan_hash, authorize_offline: true, ...consent, max_cost_usd: 1 })).rejects.toThrow('TEAM_INVALID_INPUT');
  await expect(request(a.T + '/run', { plan_id: plan.id, plan_hash: plan.plan_hash, ...consent })).rejects.toThrow('TEAM_INVALID_INPUT');
  selectProfile('local-lawyer');
  await expect(request(a.T)).rejects.toThrow('ACCESS_DENIED');
  const dash = await request<DashboardData>(a.F + '/dashboard'); expect(dash.metrics.every(m => m.records.length === 0)).toBe(true);
  await expect(request(a.F + '/director/link', { command_id: crypto.randomUUID(), config: config(), existing_matter_id: a.linked.matter.id, expected_version: 1, ...consent })).rejects.toThrow('ACCESS_DENIED');
});
it('rejects stale preparations after evidence changes, preserves historical attribution and requires responsible human', async () => {
  const s = await setup(), plan = await prepare(s);
  await request(s.M + '/originals', { title: 'Nuevo texto', original_base64: Buffer.from('Nuevo antecedente').toString('base64'), mime_type: 'text/plain', original_filename: 'nuevo.txt' });
  await expect(run(s, plan)).rejects.toThrow('TEAM_PLAN_OUTDATED');
  const fresh = await run(s, await prepare(s));
  await request(s.M + '/responsible', { identity_id: 'local-lawyer', expected_responsible_id: 'local-administrator' });
  const state = await request<TeamView>(s.T); expect(state.assignment).toBeNull(); expect(state.runs[0]!.validity).toBe('OUTDATED'); expect(state.runs[0]!.human_owner_id).toBe('local-administrator');
  await expect(request(s.T + '/draft', { run_id: fresh.id, ...consent })).rejects.toThrow('TEAM_RESPONSIBLE_REQUIRED');
});
it('covers references from every participant, objections, replies and exact export; rejects omitted debate and changed content', async () => {
  const s = await setup(true), result = await run(s, await prepare(s));
  expect(result.audit.status).toBe('REVIEW_REQUIRED'); expect(result.audit.references.every(r => r.status === 'REVIEW_REQUIRED')).toBe(true);
  const outputs = result.outputs.map(o => o.phase === 'OBJECTION' || o.phase === 'REPLY' ? { ...o, text: o.text + '\nSentencia N° 888888 | tribunal: Tribunal Sintético | 2024-01-15' } : o);
  const audit = await auditTeamOutputs(outputs, result.final_markdown);
  expect(audit.references.some(r => r.output_id.startsWith('objection:'))).toBe(true); expect(audit.references.some(r => r.output_id.startsWith('reply:'))).toBe(true);
  await expect(verifyTeamRun({ ...result, final_markdown: result.final_markdown + 'alteración' })).rejects.toThrow();
  const incomplete = { ...result, outputs: result.outputs.filter(o => o.phase !== 'REPLY') }; incomplete.audit = await auditTeamOutputs(incomplete.outputs, incomplete.final_markdown);
  await expect(verifyTeamRun(incomplete)).rejects.toThrow('TEAM_INCOMPLETE_DEBATE');
});
it('persists old and new history through export/import and rejects corrupted audit without replacing destination', async () => {
  const s = await setup(true); await run(s, await prepare(s));
  const backup = new BrowserPersistence(storage).exportBackup(), destination = new Storage();
  await new BrowserPersistence(destination).importBackup(backup);
  expect(new BrowserPersistence(destination).snapshot().legal_team!.runs).toHaveLength(1);
  expect(new BrowserPersistence(destination).snapshot().specialist_pilot!.fixture_commands).toHaveLength(1);
  const bad = JSON.parse(backup); bad.legal_team.runs[0].audit.manifest_hash = '0'.repeat(64);
  const destinationBefore = destination.getItem(STORAGE_KEY);
  await expect(new BrowserPersistence(destination).importBackup(JSON.stringify(bad))).rejects.toThrow('TEAM_AUDIT_MISMATCH');
  expect(destination.getItem(STORAGE_KEY)).toBe(destinationBefore);
});
it('rolls back a failed local write and uses compare-and-swap for concurrent team confirmation', async () => {
  const s = await setup(), before = storage.getItem(STORAGE_KEY); storage.fail = true;
  await expect(prepare(s)).rejects.toThrow('No se pudo guardar'); expect(storage.getItem(STORAGE_KEY)).toBe(before); storage.fail = false;
  const state = await request<TeamView>(s.T), payload = { expected_version: state.assignment_version, expected_human_owner_id: 'local-administrator', config: config(), ...consent };
  const results = await Promise.allSettled([request(s.T + '/assign', { ...payload, command_id: crypto.randomUUID() }), request(s.T + '/assign', { ...payload, command_id: crypto.randomUUID() })]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
});
it('invalidates the saved draft audit after human edit and rechecks exact new version without granting approval', async () => {
  const s = await setup(true), result = await run(s, await prepare(s));
  const link = await request<{ draft_id: string; document_version_id: string }>(s.T + '/draft', { run_id: result.id, ...consent });
  const revised = await request<{ document_version_id: string }>(s.M + '/drafts/' + link.draft_id + '/versions', { expected_version_id: link.document_version_id, content: result.final_markdown + '\nSentencia N° 777777 | tribunal: Tribunal Sintético | 2024-01-15' });
  expect((await request<TeamView>(s.T)).runs[0]!.draft_link!.audit_current).toBe(false);
  const recheck = await request<{ audit: TeamRun['audit'] }>(s.T + '/recheck', { run_id: result.id, expected_version_id: revised.document_version_id, explicitly_confirmed: true, ...consent });
  expect(recheck.audit.references.some(r => r.text.includes('777777'))).toBe(true);
  expect((await request<Array<{ status: string }>>(s.M + '/drafts'))[0]!.status).toBe('DRAFT');
  expect((await request<TeamView>(s.T)).runs[0]!.draft_link!.audit_current).toBe(true);
  await new BrowserPersistence(new Storage()).importBackup(new BrowserPersistence(storage).exportBackup());
});
it('counts only exact personal pending records in authorized matters, using Asuncion dates', async () => {
  const s = await setup();
  const overdue = await request<{ id: string }>(s.M + '/tasks', { title: 'Vencida sintética', responsible_identity_id: 'local-administrator', internal_due_at: new Date(Date.now() - 60000).toISOString() });
  const future = await request<{ id: string }>(s.M + '/tasks', { title: 'Futura sintética', responsible_identity_id: 'local-administrator', internal_due_at: new Date(Date.now() + 60000).toISOString() });
  const completed = await request<{ id: string }>(s.M + '/tasks', { title: 'Terminada sintética', responsible_identity_id: 'local-administrator', internal_due_at: new Date(Date.now() - 60000).toISOString() });
  await request(s.M + '/tasks/' + completed.id + '/status', { status: 'DONE' });
  const data = await request<DashboardData>(s.F + '/dashboard');
  expect(data.metrics[0]!.records.map(r => r.id)).toEqual([overdue.id]);
  expect(data.metrics.flatMap(m => m.records).some(r => r.id === completed.id)).toBe(false);
  expect(data.timezone).toBe('America/Asuncion'); expect(data.metrics[1]!.records[0]?.id).toBe(future.id);
});
it('creates controlled blind evaluation material without declaring superiority or enabling a capability', async () => {
  const s = await setup(), result = await run(s, await prepare(s)), comparison = await buildOfflineComparison(result);
  expect(comparison.private_key).toHaveLength(result.opinions.length); expect(comparison.protocol.evaluation_release).toBe(false); expect(comparison.protocol.status).toBe('HUMAN_REVIEW_NOT_RUN');
  expect(comparison.blind_review).not.toContain('specialized_label'); expect(comparison.protocol.budget_usd_per_arm).toBe(0);
  expect(HumanScoreSchema.safeParse({}).success).toBe(false);
});

it('creates an explicit client and matter shortcut atomically, retains linkage and deduplicates retries', async () => {
  const firm = await request<{ id: string }>('/firms', { name: 'Estudio del atajo sintético' }), F = '/firms/' + firm.id;
  const payload = { command_id: crypto.randomUUID(), config: config(), expected_version: 0, client: { mode: 'NEW', input: { kind: 'PERSON', display_name: 'Cliente creado desde Gabriel', identification: null } }, matter: { mode: 'NEW', input: { title: 'Asunto creado desde Gabriel', kind: 'CONTRACTUAL', subject_area: 'Contratos', responsible_identity_id: 'local-administrator', opened_on: '2026-10-15', closed_on: null } }, ...consent };
  const result = await request<{ client: { id: string }; matter: { id: string; client_id: string }; assignment: { id: string } }>(F + '/director/context', payload);
  expect(result.matter.client_id).toBe(result.client.id); expect(await request(F + '/director/context', payload)).toEqual(result);
  expect(await request<unknown[]>(F + '/clients')).toHaveLength(1); expect(await request<unknown[]>(F + '/matters')).toHaveLength(1);
  expect((await request<TeamView>(F + '/matters/' + result.matter.id + '/legal-team')).runs).toHaveLength(0);
  await expect(request(F + '/director/context', { ...payload, client: { mode: 'NEW', input: { ...payload.client.input, display_name: 'Otro nombre' } } })).rejects.toThrow('TEAM_COMMAND_CONFLICT');
  const before = storage.getItem(STORAGE_KEY); storage.fail = true;
  await expect(request(F + '/director/context', { ...payload, command_id: crypto.randomUUID() })).rejects.toThrow('No se pudo guardar'); expect(storage.getItem(STORAGE_KEY)).toBe(before);
  storage.fail = false;
  await new BrowserPersistence(new Storage()).importBackup(new BrowserPersistence(storage).exportBackup());
});
it('rejects a shortcut with no client or an existing matter belonging to another client, without half-created records', async () => {
  const s = await setup(), client = await request<{ id: string }>(s.F + '/clients', { kind: 'PERSON', display_name: 'Otro cliente sintético', identification: null });
  const payload = { command_id: crypto.randomUUID(), config: config(), expected_version: 1, client: { mode: 'EXISTING', client_id: client.id }, matter: { mode: 'EXISTING', matter_id: s.linked.matter.id }, ...consent };
  const before = storage.getItem(STORAGE_KEY);
  await expect(request(s.F + '/director/context', payload)).rejects.toThrow('TEAM_CLIENT_MISMATCH'); expect(storage.getItem(STORAGE_KEY)).toBe(before);
  await expect(request(s.F + '/director/context', { ...payload, client: undefined })).rejects.toThrow('TEAM_INVALID_INPUT');
  await expect(request(s.F + '/director/context', { ...payload, client: { mode: 'NEW', input: { kind: 'PERSON', display_name: 'Cliente que no debe crearse', identification: null } } })).rejects.toThrow('TEAM_INVALID_INPUT');
  expect(storage.getItem(STORAGE_KEY)).toBe(before);
});
it('incorporates multiple originals directly into the authorized matter exactly once and invalidates prepared evidence', async () => {
  const s = await setup(), plan = await prepare(s);
  const files = ['Texto adjunto con obligación condicionada si se entrega el informe.', 'Salvo excepción documentada, Anexo C pendiente.'].map((text, i) => ({ title: 'Adjunto sintético ' + i, original_filename: 'adjunto-' + i + '.txt', original_base64: Buffer.from(text).toString('base64'), mime_type: 'text/plain' }));
  const payload = { command_id: crypto.randomUUID(), files, ...consent };
  const result = await request<{ document_ids: string[] }>(s.T + '/documents', payload); expect(result.document_ids).toHaveLength(2);
  expect(await request(s.T + '/documents', payload)).toEqual(result);
  expect(await request<unknown[]>(s.M + '/documents')).toHaveLength(5);
  await expect(run(s, plan)).rejects.toThrow('TEAM_PLAN_OUTDATED');
  const snapshot = new BrowserPersistence(storage).snapshot(); expect(snapshot.legal_team!.runs).toHaveLength(0);
  for (const id of result.document_ids) { const doc = snapshot.tables.documents.find(d => d.id === id)!; expect(doc.matter_id).toBe(s.linked.matter.id); expect(doc.purpose).toBe('ORIGINAL'); expect(snapshot.tables.documentVersions.find(v => v.id === doc.current_version_id)?.original_base64).toBe(files[result.document_ids.indexOf(id)]!.original_base64); }
  await expect(request(s.T + '/documents', { ...payload, files: files.slice(0, 1) })).rejects.toThrow('TEAM_COMMAND_CONFLICT');
  await new BrowserPersistence(new Storage()).importBackup(new BrowserPersistence(storage).exportBackup());
});
it('rejects a mixed invalid batch, excess evidence, absent consent and unauthorized document upload atomically', async () => {
  const s = await setup(), baseFile = { title: 'Válido', original_filename: 'valido.txt', original_base64: Buffer.from('Contenido sintético').toString('base64'), mime_type: 'text/plain' };
  const before = storage.getItem(STORAGE_KEY);
  for (const payload of [
    { command_id: crypto.randomUUID(), files: [baseFile, { ...baseFile, original_filename: 'no.pdf' }], ...consent },
    { command_id: crypto.randomUUID(), files: Array.from({ length: 13 }, () => baseFile), ...consent },
    { command_id: crypto.randomUUID(), files: [baseFile], synthetic_data: false, max_cost_usd: 0 },
  ]) await expect(request(s.T + '/documents', payload)).rejects.toThrow();
  expect(storage.getItem(STORAGE_KEY)).toBe(before);
  storage.fail = true;
  await expect(request(s.T + '/documents', { command_id: crypto.randomUUID(), files: [baseFile], ...consent })).rejects.toThrow('No se pudo guardar'); expect(storage.getItem(STORAGE_KEY)).toBe(before); storage.fail = false;
  selectProfile('local-lawyer'); await expect(request(s.T + '/documents', { command_id: crypto.randomUUID(), files: [baseFile], ...consent })).rejects.toThrow('ACCESS_DENIED');
});

it('deduplicates identical uploaded originals across commands and within a batch, while retaining genuinely different files and scoped provenance', async () => {
  const s = await setup(), file = { title: 'Contrato del cliente', original_filename: 'cliente.txt', original_base64: Buffer.from('El proveedor deberá entregar el Anexo Z si recibe la orden.').toString('base64'), mime_type: 'text/plain' };
  const before = (await request<unknown[]>(s.M + '/documents')).length;
  const first = await request<{ document_ids: string[]; reused_document_ids: string[] }>(s.T + '/documents', { command_id: crypto.randomUUID(), files: [file, { ...file, original_filename: 'copia.txt' }], ...consent });
  expect(first.document_ids).toHaveLength(1); expect(first.reused_document_ids).toHaveLength(0);
  const second = await request<{ document_ids: string[]; reused_document_ids: string[] }>(s.T + '/documents', { command_id: crypto.randomUUID(), files: [file], ...consent });
  expect(second.document_ids).toEqual(first.document_ids); expect(second.reused_document_ids).toEqual(first.document_ids);
  expect(await request<unknown[]>(s.M + '/documents')).toHaveLength(before + 1);
  const info = (await request<TeamView>(s.T)).documents!.find(d => d.document_id === first.document_ids[0])!;
  expect(info.source).toBe('UPLOADED'); expect(info.original_filename).toBe('cliente.txt'); expect(info.preview).toContain('Anexo Z'); expect(info.size_bytes).toBe(Buffer.from(file.original_base64, 'base64').length);
  await request(s.T + '/documents', { command_id: crypto.randomUUID(), files: [{ ...file, original_base64: Buffer.from('Un contrato distinto con el mismo nombre de archivo.').toString('base64') }], ...consent });
  expect(await request<unknown[]>(s.M + '/documents')).toHaveLength(before + 2);
  const other = await setup(); const scoped = await request<{ document_ids: string[] }>(other.T + '/documents', { command_id: crypto.randomUUID(), files: [file], ...consent }); expect(scoped.document_ids).not.toEqual(first.document_ids);
});

it('reuses existing demo documents when reopening or repeating example loading, and labels their origin instead of multiplying them', async () => {
  const s = await setup(), first = await request<{ document_ids: string[] }>(s.M + '/contractual-pilot/fixture', { command_id: crypto.randomUUID(), ...consent });
  const second = await request<{ document_ids: string[] }>(s.M + '/contractual-pilot/fixture', { command_id: crypto.randomUUID(), ...consent });
  expect(second.document_ids).toEqual(first.document_ids); expect(await request<unknown[]>(s.M + '/documents')).toHaveLength(3);
  const state = await request<TeamView>(s.T); expect(state.documents!.filter(d => d.source === 'EXAMPLE').map(d => d.document_id)).toEqual(first.document_ids);
});

it('removes an original reversibly from all active document lists, invalidates pending consultation and retains exact originals and immutable results through backup and restore', async () => {
  const s = await setup(), historical = await run(s, await prepare(s)), pending = await prepare(s), state = await request<TeamView>(s.T), info = state.documents![0]!;
  const input = { command_id: crypto.randomUUID(), document_id: info.document_id, expected_version_id: info.version_id, expected_change_id: info.change_id, action: 'REMOVE' };
  const change = await request<{ id: string }>(s.T + '/document-status', input); expect(await request(s.T + '/document-status', input)).toEqual(change);
  expect((await request<Array<{ id: string }>>(s.M + '/documents')).some(d => d.id === info.document_id)).toBe(false);
  await expect(run(s, pending)).rejects.toThrow('TEAM_PLAN_OUTDATED'); await expect(prepare(s)).rejects.toThrow('TEAM_DOCUMENT_UNAVAILABLE');
  const removed = await request<TeamView>(s.T); expect(removed.documents![0]!.removed).toBe(true); expect(removed.documents![0]!.ready).toBe(false); expect(removed.runs[0]!.validity).toBe('OUTDATED'); expect(removed.runs[0]!.final_markdown).toBe(historical.final_markdown);
  const persisted = new BrowserPersistence(storage).snapshot(); expect(persisted.tables.documents).toHaveLength(3); expect(persisted.tables.documentVersions).toHaveLength(3); expect(persisted.legal_team!.document_changes).toHaveLength(1);
  const destination = new Storage(); await new BrowserPersistence(destination).importBackup(new BrowserPersistence(storage).exportBackup()); expect(new BrowserPersistence(destination).snapshot().legal_team!.document_changes[0]!.id).toBe(change.id);
  const reused = await request<{ document_ids: string[]; removed_document_ids: string[] }>(s.M + '/contractual-pilot/fixture', { command_id: crypto.randomUUID(), ...consent }); expect(reused.document_ids).toContain(info.document_id); expect(new BrowserPersistence(storage).snapshot().tables.documents).toHaveLength(3);
  await request(s.T + '/document-status', { ...input, command_id: crypto.randomUUID(), expected_change_id: change.id, action: 'RESTORE' });
  expect(await request<unknown[]>(s.M + '/documents')).toHaveLength(3); expect((await request<TeamView>(s.T)).documents![0]!.removed).toBe(false);
  expect(new BrowserPersistence(storage).snapshot().tables.documentVersions).toEqual(persisted.tables.documentVersions);
});

it('guards removal by scope, write permission and current version/change, and rolls back storage failures', async () => {
  const s = await setup(), info = (await request<TeamView>(s.T)).documents![0]!, input = { command_id: crypto.randomUUID(), document_id: info.document_id, expected_version_id: info.version_id, expected_change_id: null, action: 'REMOVE' };
  let before = storage.getItem(STORAGE_KEY);
  await expect(request(s.T + '/document-status', { ...input, expected_version_id: 'wrong' })).rejects.toThrow('TEAM_DOCUMENT_CHANGED'); expect(storage.getItem(STORAGE_KEY)).toBe(before);
  const other = await setup(); before = storage.getItem(STORAGE_KEY);
  await expect(request(other.T + '/document-status', input)).rejects.toThrow('TEAM_DOCUMENT_UNAVAILABLE'); expect(storage.getItem(STORAGE_KEY)).toBe(before);
  selectProfile('local-lawyer'); await expect(request(s.T + '/document-status', input)).rejects.toThrow('ACCESS_DENIED'); selectProfile('local-administrator');
  storage.fail = true; await expect(request(s.T + '/document-status', input)).rejects.toThrow('No se pudo guardar'); expect(storage.getItem(STORAGE_KEY)).toBe(before); storage.fail = false;
  const changed = await request<{ id: string }>(s.T + '/document-status', input);
  await expect(request(s.T + '/document-status', { ...input, command_id: crypto.randomUUID(), action: 'RESTORE' })).rejects.toThrow('TEAM_DOCUMENT_CHANGED');
  await expect(request(s.T + '/document-status', { ...input, action: 'RESTORE', expected_change_id: changed.id })).rejects.toThrow('TEAM_COMMAND_CONFLICT');
  const forged = new BrowserPersistence(storage).snapshot(); forged.legal_team!.document_changes[0]!.previous_change_id = 'nonexistent';
  await expect(new BrowserPersistence(new Storage()).importBackup(JSON.stringify(forged))).rejects.toThrow('no es válido');
});

it('does not recreate an original when it is uploaded again from the trash', async () => {
  const s = await setup(), file = { title: 'Archivo que se retira', original_filename: 'retirado.txt', original_base64: Buffer.from('Este contrato sintético será retirado del asunto.').toString('base64'), mime_type: 'text/plain' };
  const first = await request<{ document_ids: string[] }>(s.T + '/documents', { command_id: crypto.randomUUID(), files: [file], ...consent }), id = first.document_ids[0]!;
  const info = (await request<TeamView>(s.T)).documents!.find(d => d.document_id === id)!;
  await request(s.T + '/document-status', { command_id: crypto.randomUUID(), document_id: id, expected_version_id: info.version_id, expected_change_id: null, action: 'REMOVE' });
  const again = await request<{ document_ids: string[]; reused_document_ids: string[]; removed_document_ids: string[] }>(s.T + '/documents', { command_id: crypto.randomUUID(), files: [file], ...consent });
  expect(again.document_ids).toEqual([id]); expect(again.reused_document_ids).toEqual([id]); expect(again.removed_document_ids).toEqual([id]); expect(new BrowserPersistence(storage).snapshot().tables.documents).toHaveLength(4); expect(await request<unknown[]>(s.M + '/documents')).toHaveLength(3);
});

it('builds an editable contractual work product from the actual selected original, saves exact human content with all-output audit and never overwrites a different existing draft', async () => {
  const s = await setup(), state = await request<TeamView>(s.T);
  const assignment = await request<{ id: string }>(s.T + '/assign', { command_id: crypto.randomUUID(), expected_version: state.assignment_version, expected_human_owner_id: 'local-administrator', config: { ...config(), question: 'Elaborar un contrato de suministro para una empresa extranjera.' }, ...consent });
  const original = 'CONTRATO MARCO SINTÉTICO\nEl proveedor deberá entregar solo si recibe una orden.\n[ELIMINADO: treinta días]\nPropuesta: sesenta días.\nCLÁUSULA FINAL: salvo excepción documentada, deberá entregar el Anexo Z.';
  const uploaded = await request<{ document_ids: string[] }>(s.T + '/documents', { command_id: crypto.randomUUID(), files: [{ title: 'Contrato base del cliente', original_filename: 'base.txt', mime_type: 'text/plain', original_base64: Buffer.from(original).toString('base64') }], ...consent });
  const plan = await request<TeamPlan>(s.T + '/prepare', { command_id: crypto.randomUUID(), assignment_id: assignment.id, document_ids: uploaded.document_ids, ...consent });
  const result = await run(s, plan), product = buildWorkProduct(result);
  expect(product.drafting).toBe(true); expect(product.content).toContain(original); expect(product.content).toContain('No se han adaptado automáticamente'); expect(product.content).not.toContain('Respuesta: Se acepta'); expect(product.decisions.some(d => d.includes('aduana'))).toBe(true);
  const text = product.content + '\n\nCAMBIO HUMANO: Anexo Z agregado para revisión.';
  const link = await request<{ draft_id: string; document_version_id: string; audit: TeamRun['audit'] }>(s.T + '/draft', { run_id: result.id, content: text, ...consent });
  const snapshot = new BrowserPersistence(storage).snapshot(), version = snapshot.tables.documentVersions.find(v => v.id === link.document_version_id)!;
  expect(Buffer.from(version.original_base64, 'base64').toString('utf8')).toBe(text); expect(link.audit.outputs).toHaveLength(result.outputs.length); expect(link.audit.outputs.find(o => o.phase === 'INTEGRATION')!.author).toBe('HUMAN'); expect(snapshot.tables.drafts[0]!.status).toBe('DRAFT');
  expect(await request(s.T + '/draft', { run_id: result.id, content: text, ...consent })).toEqual(link);
  await expect(request(s.T + '/draft', { run_id: result.id, content: 'Otro documento distinto', ...consent })).rejects.toThrow('TEAM_DRAFT_ALREADY_EXISTS');
  const destination = new BrowserPersistence(new Storage()); await destination.importBackup(new BrowserPersistence(storage).exportBackup()); expect(destination.snapshot().tables.drafts[0]!.id).toBe(link.draft_id);
});

it('provides a short review work product instead of concatenating agent discussions, and never substitutes a draft when no contract base exists', async () => {
  const s = await setup(true), result = await run(s, await prepare(s)), product = buildWorkProduct(result);
  expect(product.drafting).toBe(false); expect(product.content.length).toBeLessThan(10000); expect(product.content).not.toContain('Objeciones y respuestas'); expect(product.content).not.toContain('Respuesta: Se acepta'); expect(result.outputs.some(o => o.phase === 'OBJECTION')).toBe(true);
  const noSource = buildWorkProduct({ ...result, config: { ...result.config, question: 'Elaborar un contrato nuevo de servicios.' }, evidence: [] });
  expect(noSource.source).toBeUndefined(); expect(noSource.content).toContain('Sin contrato base identificado'); expect(noSource.content).toContain('[COMPLETAR]');
});

it('accepts a contract over the old 24 KB limit through prepare, execution, exact final clause and backup', async () => {
  const s = await setup();
  const text = 'Antecedente documental sin inferencias.\n'.repeat(2000) + 'CLÁUSULA FINAL: deberá entregar el informe solo si se recibe el Anexo Z. Salvo excepción documentada.';
  expect(Buffer.byteLength(text)).toBeGreaterThan(24576);
  const uploaded = await request<{ document_ids: string[] }>(s.T + '/documents', { command_id: crypto.randomUUID(), files: [{ title: 'Contrato completo de tamaño normal', original_filename: 'contrato.txt', original_base64: Buffer.from(text).toString('base64'), mime_type: 'text/plain' }], ...consent });
  const plan = await request<TeamPlan>(s.T + '/prepare', { command_id: crypto.randomUUID(), assignment_id: s.linked.assignment.id, document_ids: uploaded.document_ids, ...consent });
  expect(plan.evidence[0]!.text).toBe(text);
  const result = await run(s, plan); expect(result.final_markdown).toContain('CLÁUSULA FINAL'); expect(result.final_markdown).toContain('Anexo Z');
  await new BrowserPersistence(new Storage()).importBackup(new BrowserPersistence(storage).exportBackup());
});
it('binds extracted text to the original binary version and preserves both in backup and execution', async () => {
  const s = await setup(), { hashText } = await import('../../apps/web/src/contractual-pilot.js');
  const original = '%PDF-1.7\nOriginal sintético completo', text = '[Página 1]\nEl proveedor deberá entregar si recibe la orden. Cláusula final conservada.';
  const extraction = { format: 'pdf', method: 'PDF_TEXT', status: 'COMPLETE_UNREVIEWED', text, text_sha256: await hashText(text), original_sha256: await hashText(original), units: [{ label: 'Página 1', start: 0, end: text.length, readable: true }], warnings: [], extractor_version: 'local-document-v1', truncated: false };
  const payload = { command_id: crypto.randomUUID(), files: [{ title: 'Contrato PDF', original_filename: 'contrato.pdf', original_base64: Buffer.from(original).toString('base64'), mime_type: 'application/pdf', extraction }], ...consent };
  const uploaded = await request<{ document_ids: string[] }>(s.T + '/documents', payload);
  const plan = await request<TeamPlan>(s.T + '/prepare', { command_id: crypto.randomUUID(), assignment_id: s.linked.assignment.id, document_ids: uploaded.document_ids, ...consent });
  expect(plan.evidence[0]!.text).toBe(text); expect(plan.evidence[0]!.original_sha256).toBe(extraction.original_sha256); expect(plan.evidence[0]!.sha256).toBe(extraction.text_sha256);
  const result = await run(s, plan); expect(result.final_markdown).toContain('Cláusula final conservada');
  await new BrowserPersistence(new Storage()).importBackup(new BrowserPersistence(storage).exportBackup());
  const before = storage.getItem(STORAGE_KEY);
  await expect(request(s.T + '/documents', { ...payload, command_id: crypto.randomUUID(), files: [{ ...payload.files[0], extraction: { ...extraction, text: text + 'Falsificado' } }] })).rejects.toThrow('TEAM_EXTRACTION_MISMATCH'); expect(storage.getItem(STORAGE_KEY)).toBe(before);
});
it('stores an image-only PDF original but refuses to analyze missing pages as complete evidence', async () => {
  const s = await setup(), { hashText } = await import('../../apps/web/src/contractual-pilot.js');
  const original = '%PDF-1.7\nEscaneo sintético sin texto';
  const uploaded = await request<{ document_ids: string[] }>(s.T + '/documents', { command_id: crypto.randomUUID(), files: [{ title: 'Contrato escaneado', original_filename: 'escaneo.pdf', original_base64: Buffer.from(original).toString('base64'), mime_type: 'application/pdf', extraction: { format: 'pdf', method: 'PDF_TEXT', status: 'UNREADABLE', text: '', text_sha256: await hashText(''), original_sha256: await hashText(original), units: [], warnings: ['Requiere OCR'], extractor_version: 'local-document-v1', truncated: false } }], ...consent });
  const state = await request<TeamView>(s.T); expect(state.documents!.find(d => d.document_id === uploaded.document_ids[0])?.ready).toBe(false);
  await expect(request(s.T + '/prepare', { command_id: crypto.randomUUID(), assignment_id: s.linked.assignment.id, document_ids: uploaded.document_ids, ...consent })).rejects.toThrow('TEAM_EXTRACTION_INCOMPLETE');
  expect(new BrowserPersistence(storage).snapshot().tables.documentVersions.some(v => v.original_base64 === Buffer.from(original).toString('base64'))).toBe(true);
});
