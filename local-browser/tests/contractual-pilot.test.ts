import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BrowserPersistence, STORAGE_KEY, parseSnapshot } from '../../apps/web/src/local-storage.js';
import { auditPilotOutputs, verifyPilotRun, type PilotPlan, type PilotRun } from '../../apps/web/src/contractual-pilot.js';
import type { PilotView } from '../../apps/web/src/local-specialist.js';

class Storage {
  values = new Map<string, string>(); fail = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw Error('QuotaExceededError'); this.values.set(key, value); }
}
let data: Storage;
let request: <T>(path: string, body?: unknown) => Promise<T>;
let selectProfile: (id: string) => void;
let network: ReturnType<typeof vi.fn>;
const consent = { synthetic_data: true, max_cost_usd: 0 };
beforeEach(async () => {
  vi.resetModules(); data = new Storage();
  vi.stubGlobal('localStorage', data);
  network = vi.fn(() => { throw Error('TEST_FORBIDS_NETWORK'); });
  vi.stubGlobal('fetch', network);
  const local = await import('../../apps/web/src/local-api.js');
  request = async <T>(path: string, body?: unknown) => await local.localRequest(path, body) as T;
  selectProfile = local.selectLocalProfile;
});
afterEach(() => { expect(network).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

async function setup(title = 'Contrato sintético') {
  const firm = await request<{ id: string }>('/firms', { name: 'Estudio sintético' });
  const F = '/firms/' + firm.id;
  const client = await request<{ id: string }>(F + '/clients', { kind: 'PERSON', display_name: 'Cliente sintético', identification: null });
  const matter = await request<{ id: string }>(F + '/matters', { client_id: client.id, title, kind: 'CONTRACTUAL', subject_area: 'Contratos', responsible_identity_id: 'local-administrator', opened_on: '2026-10-15', closed_on: null });
  const M = F + '/matters/' + matter.id, P = M + '/contractual-pilot';
  const assignment = await request<{ id: string }>(P + '/assign', { command_id: crypto.randomUUID(), expected_version: 0, expected_human_owner_id: 'local-administrator', profile_id: 'elena', ...consent });
  const fixture = await request<{ document_ids: string[] }>(P + '/fixture', { command_id: crypto.randomUUID(), ...consent });
  return { firm, matter, F, M, P, assignment, fixture };
}
async function prepare(s: Awaited<ReturnType<typeof setup>>, question = '¿Qué obligaciones, condiciones y anexos faltantes aparecen en estos documentos sintéticos?') {
  return request<PilotPlan>(s.P + '/prepare', { command_id: crypto.randomUUID(), assignment_id: s.assignment.id, document_ids: s.fixture.document_ids, question, ...consent });
}
const execute = (P: string, plan: PilotPlan) => request<PilotRun>(P + '/run', { plan_id: plan.id, plan_hash: plan.plan_hash, authorize_offline: true, ...consent });

it('runs the selected contractual package offline, preserves conditions and exceptions, and reuses an exact plan once', async () => {
  const s = await setup();
  const plan = await prepare(s);
  expect((await request<PilotView>(s.P)).runs).toHaveLength(0);
  const run = await execute(s.P, plan);
  expect(run.paid_calls).toBe(0); expect(run.actual_cost_usd).toBe(0);
  expect(run.stages.map(stage => stage.role)).toEqual(['DOCUMENT_ROUTER', 'CONTEXT_BUILDER', 'ELENA', 'FINAL_CHECKER']);
  expect(run.findings.some(f => f.kind === 'CONDITION')).toBe(true);
  expect(run.findings.some(f => f.kind === 'OBLIGATION' && f.quote.includes('deberá'))).toBe(true);
  expect(run.findings.some(f => f.kind === 'EXCEPTION')).toBe(true);
  expect(run.findings.find(f => f.kind === 'MISSING_ANNEX')?.observation).toContain('Anexo B');
  expect(run.final_markdown).toContain('10.000.000'); expect(run.final_markdown).toContain('12.000.000');
  expect(run.final_markdown).toContain('Hay importes diferentes');
  expect(run.outputs).toHaveLength(5); expect(run.audit.status).toBe('NO_REFERENCES');
  expect(await execute(s.P, plan)).toEqual(run);
  expect((await request<PilotView>(s.P)).runs).toHaveLength(1);
  await verifyPilotRun(run);
});

it('preserves assignments, runs and exact evidence through reload and backup roundtrip; legacy backups remain importable', async () => {
  const s = await setup(), plan = await prepare(s), run = await execute(s.P, plan);
  const adapter = new BrowserPersistence(data);
  const backup = adapter.exportBackup();
  const destination = new Storage();
  await new BrowserPersistence(destination).importBackup(backup);
  expect(new BrowserPersistence(destination).snapshot().specialist_pilot?.runs[0]?.id).toBe(run.id);
  expect(new BrowserPersistence(destination).snapshot().specialist_pilot?.assignments[0]?.profile_id).toBe('elena');
  const legacy = JSON.parse(backup); delete legacy.specialist_pilot;
  await new BrowserPersistence(new Storage()).importBackup(JSON.stringify(legacy));
  expect(parseSnapshot(JSON.stringify(legacy)).specialist_pilot).toBeUndefined();
});

it('requires separate offline consent and rejects paid, substituted-profile and unknown execution parameters', async () => {
  const s = await setup(), plan = await prepare(s);
  for (const payload of [
    { plan_id: plan.id, plan_hash: plan.plan_hash, ...consent },
    { plan_id: plan.id, plan_hash: plan.plan_hash, ...consent, authorize_offline: true, max_cost_usd: 1 },
    { plan_id: plan.id, plan_hash: plan.plan_hash, ...consent, authorize_offline: true, synthetic_data: false },
    { plan_id: plan.id, plan_hash: plan.plan_hash, ...consent, authorize_offline: true, model: 'unauthorized' },
  ]) await expect(request(s.P + '/run', payload)).rejects.toThrow('PILOT_INVALID_INPUT');
  await expect(request(s.P + '/assign', { command_id: crypto.randomUUID(), expected_version: 1, expected_human_owner_id: 'local-administrator', profile_id: 'valeria', ...consent })).rejects.toThrow('PILOT_INVALID_INPUT');
  expect((await request<PilotView>(s.P)).runs).toHaveLength(0);
});

it('uses compare-and-swap assignments and rejects a stale plan after reassignment', async () => {
  const s = await setup(), plan = await prepare(s);
  const input = { command_id: crypto.randomUUID(), expected_version: 1, expected_human_owner_id: 'local-administrator', profile_id: 'elena', ...consent };
  const outcomes = await Promise.allSettled([request(s.P + '/assign', input), request(s.P + '/assign', { ...input, command_id: crypto.randomUUID() })]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
  await expect(execute(s.P, plan)).rejects.toThrow('PILOT_PLAN_OUTDATED');
});

it('denies foreign matter documents, known IDs from another firm, and a nonparticipant even on read', async () => {
  const a = await setup('A'), b = await setup('B');
  await expect(request(a.P + '/prepare', { command_id: crypto.randomUUID(), assignment_id: a.assignment.id, document_ids: b.fixture.document_ids, question: '¿Qué obligaciones aparecen en estos documentos?', ...consent })).rejects.toThrow('PILOT_DOCUMENT_UNAVAILABLE');
  await expect(request(a.F + '/matters/' + b.matter.id + '/contractual-pilot')).rejects.toThrow('ACCESS_DENIED');
  selectProfile('local-lawyer');
  await expect(request(a.P)).rejects.toThrow('ACCESS_DENIED');
});

it('invalidates prepared work and preserves historical outputs when originals are added or changed', async () => {
  const s = await setup(), plan = await prepare(s), run = await execute(s.P, plan);
  await request(s.M + '/originals', { title: 'Nuevo antecedente sintético', original_base64: btoa('Nuevo documento'), original_filename: 'nuevo.txt', mime_type: 'text/plain' });
  await expect(execute(s.P, plan)).rejects.toThrow('PILOT_PLAN_OUTDATED');
  const state = await request<PilotView>(s.P);
  expect(state.runs[0]?.validity).toBe('OUTDATED'); expect(state.runs[0]?.final_markdown).toBe(run.final_markdown);
  await expect(request(s.P + '/draft', { run_id: run.id, ...consent })).rejects.toThrow('PILOT_PLAN_OUTDATED');
});

it('covers references in the human question, retained context and final artifact without a false VERIFIED', async () => {
  const s = await setup(), plan = await prepare(s, '¿Se sustenta lo afirmado en Sentencia N° 999999 | tribunal: Tribunal Sintético | 2024-01-15?');
  const run = await execute(s.P, plan);
  expect(run.audit.status).toBe('REVIEW_REQUIRED');
  expect(run.audit.references.some(ref => ref.output_id === 'question')).toBe(true);
  expect(run.audit.references.some(ref => ref.output_id === 'final')).toBe(true);
  expect(run.audit.references.every(ref => ref.status === 'REVIEW_REQUIRED')).toBe(true);
  const corrupted = structuredClone(run); corrupted.final_markdown += '\nLey 12345';
  await expect(verifyPilotRun(corrupted)).rejects.toThrow('INCOMPLETE_OUTPUT_MANIFEST');
  const malformed = run.outputs.filter(output => output.id !== 'context');
  await expect(auditPilotOutputs(malformed, run.final_markdown)).rejects.toThrow('INCOMPLETE_OUTPUT_MANIFEST');
});

it('links draft audit to the exact version, rechecks a human edition, and never approves the draft', async () => {
  const s = await setup(), run = await execute(s.P, await prepare(s));
  const link = await request<{ draft_id: string; document_version_id: string }>(s.P + '/draft', { run_id: run.id, ...consent });
  expect(await request(s.P + '/draft', { run_id: run.id, ...consent })).toEqual(link);
  expect((await request<unknown[]>(s.M + '/drafts')).length).toBe(1);
  const revised = await request<{ document_version_id: string }>(s.M + '/drafts/' + link.draft_id + '/versions', { expected_version_id: link.document_version_id, content: run.final_markdown + '\nSentencia N° 999999 | tribunal: Tribunal Sintético | 2024-01-15' });
  expect((await request<PilotView>(s.P)).runs[0]?.draft_link?.audit_current).toBe(false);
  await expect(request(s.P + '/recheck', { run_id: run.id, expected_version_id: link.document_version_id, explicitly_confirmed: true, ...consent })).rejects.toThrow('VERSION_CONFLICT');
  await request(s.P + '/recheck', { run_id: run.id, expected_version_id: revised.document_version_id, explicitly_confirmed: true, ...consent });
  const current = (await request<PilotView>(s.P)).runs[0]!;
  expect(current.draft_link?.audit_current).toBe(true);
  expect(current.draft_link?.audit.status).toBe('REVIEW_REQUIRED');
  expect((await request<Array<{ status: string }>>(s.M + '/drafts'))[0]?.status).toBe('DRAFT');
  const backup = new BrowserPersistence(data).exportBackup();
  await new BrowserPersistence(new Storage()).importBackup(backup);
});

it('rolls back run/history atomically on quota failure and does not charge or silently retry', async () => {
  const s = await setup(), plan = await prepare(s), before = data.getItem(STORAGE_KEY);
  data.fail = true;
  await expect(execute(s.P, plan)).rejects.toThrow('No se pudo guardar');
  expect(data.getItem(STORAGE_KEY)).toBe(before);
  data.fail = false;
  expect((await request<PilotView>(s.P)).runs).toHaveLength(0);
});

it('rejects a corrupted pilot audit on import and preserves the destination data', async () => {
  const s = await setup(); await execute(s.P, await prepare(s));
  const before = data.getItem(STORAGE_KEY)!;
  const corrupted = JSON.parse(before); corrupted.specialist_pilot.runs[0].audit.final_content_hash = '0'.repeat(64);
  await expect(new BrowserPersistence(data).importBackup(JSON.stringify(corrupted))).rejects.toThrow('PILOT_AUDIT_HASH_MISMATCH');
  expect(data.getItem(STORAGE_KEY)).toBe(before);
});

it('treats selected drafts as allegations and marks an edited selected draft outdated', async () => {
  const s = await setup();
  const draft = await request<{ id: string; document_id: string; document_version_id: string }>(s.M + '/drafts', { title: 'Alegación sintética', content: 'El cliente afirma que deberá pagar si recibe el informe. [ILEGIBLE]' });
  const plan = await request<PilotPlan>(s.P + '/prepare', { command_id: crypto.randomUUID(), assignment_id: s.assignment.id, document_ids: [draft.document_id], question: '¿Qué condiciones y faltantes aparecen en este texto sintético?', ...consent });
  const run = await execute(s.P, plan);
  expect(run.evidence[0]?.nature).toBe('PARTY_ALLEGATION');
  expect(run.completion_status).toBe('NEEDS_MORE_EVIDENCE');
  expect(run.final_markdown).toContain('no completar contenido');
  await request(s.M + '/drafts/' + draft.id + '/versions', { expected_version_id: draft.document_version_id, content: 'Nueva alegación sintética.' });
  expect((await request<PilotView>(s.P)).runs[0]?.validity).toBe('OUTDATED');
  await expect(request(s.P + '/draft', { run_id: run.id, ...consent })).rejects.toThrow('PILOT_PLAN_OUTDATED');
});

it('invalidates assignment and plan on human-owner change, keeping attribution historical', async () => {
  const s = await setup(), plan = await prepare(s), run = await execute(s.P, plan);
  await request(s.M + '/responsible', { identity_id: 'local-lawyer', expected_responsible_id: 'local-administrator' });
  const state = await request<PilotView>(s.P);
  expect(state.assignment).toBeNull(); expect(state.runs[0]?.human_owner_id).toBe('local-administrator'); expect(state.runs[0]?.validity).toBe('OUTDATED');
  await expect(execute(s.P, plan)).rejects.toThrow('PILOT_RESPONSIBLE_REQUIRED');
  expect(state.runs[0]?.id).toBe(run.id);
});
