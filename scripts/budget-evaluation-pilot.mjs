// Offline planning only: reads the frozen public packet and saved public tariffs.
// Provider preparation only; no transport, credentials, DB or policy mutation.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { benchmarkSnapshot } from './benchmark-isolation.mjs';
import { integrateContributions, integrationPacket } from './workspace-integration.mjs';
import { DeepSeekProvider } from '../dist/providers/live.js';
import { compactSourceEvidence, expandSourceEvidence } from './workspace-source-packet.mjs';
import { deepseekEnvelopeTokens, workspaceCallFits } from './workspace-context.mjs';
import { workspacePrice, workspaceCost } from './workspace-pricing.mjs';
import { WorkspaceAnalysisSchema } from '../dist/os-app/packages/workspace/src/tasks.js';

const root = resolve(import.meta.dirname, '../docs/evaluacion-niveles-2026-10-21');
const tariffPath = 'operacion/TARIFAS_PROPUESTAS.json';
const tariffBytes = await readFile(resolve(root, tariffPath));
const tariffs = JSON.parse(tariffBytes);
const sha = b => createHash('sha256').update(b).digest('hex');
const round = n => Number(n.toFixed(6));
const price = (model, input, output) => {
  assert(Number.isSafeInteger(input) && Number.isSafeInteger(output));
  const p = tariffs.models.find(p => p.model_id === model);
  assert(p);
  const row = workspacePrice({ input_per_million_usd:p.input, output_per_million_usd:p.output,
    ...(p.long_context ? {long_context:{above_input_tokens:p.long_context.above_input_tokens,input_per_million_usd:p.long_context.input,output_per_million_usd:p.long_context.output}} : {}) },model);
  return workspaceCost(row,input,output);
};
// Explicit boundary checks prevent the planning sheet silently losing the tier.
assert.equal(price('gpt-6.1-sol', 272000, 1000), .554);
assert.equal(price('gpt-6.1-sol', 272001, 1000), 1.103004);
assert.equal(price('gpt-6-luna', 1000000, 1000), .20075);

const scenarios = [
  { id: 'ACOTADO', input: 8000, outputs: { director: 1500, analysis: 3000, draft: 6000, audit: 1200 },
    turns: [{ director: 2, analysis: 1, audit: 2 }, { director: 2, analysis: 3, audit: 4 }, { director: 2, analysis: 1, audit: 2 }, { director: 2, draft: 1, audit: 2 }] },
  { id: 'CENTRAL', input: 16000, outputs: { director: 2500, analysis: 6000, draft: 10000, audit: 2000 },
    turns: [{ director: 2, analysis: 3, audit: 4 }, { director: 2, analysis: 3, audit: 4 }, { director: 2, analysis: 3, audit: 4 }, { director: 2, draft: 1, audit: 2 }] },
  { id: 'TENSION', input: 32000, outputs: { director: 8000, analysis: 16000, draft: 25000, audit: 8000, fallback: 8000 },
    turns: [{ director: 2, analysis: 4, audit: 5, fallback: 5 }, { director: 2, analysis: 4, audit: 5, fallback: 5 }, { director: 2, analysis: 4, audit: 5, fallback: 5 }, { director: 2, draft: 1, analysis: 1, audit: 3, fallback: 3 }] },
];
const limits = { director: 8000, analysis: 16000, draft: 25000, audit: 8000, fallback: 8000 };
const stages = [], turns = [], totals = [];
for (const s of scenarios) for (const level of ['AGIL', 'MEDIO', 'PROFUNDO']) {
  let expected = 0, maximum = 0, calls = 0;
  for (const [i, counts] of s.turns.entries()) {
    let expectedTurn = 0, maximumTurn = 0, callTurn = 0;
    for (const [role, count] of Object.entries(counts)) {
      const model = ['director', 'fallback'].includes(role) ? 'gpt-6-luna' : role === 'audit' ? 'gemini-3.8-flash' : level === 'PROFUNDO' ? 'gpt-6.1-sol' : 'deepseek-flash';
      const expectedStage = count * price(model, s.input, s.outputs[role]);
      const maximumStage = count * price(model, s.input, limits[role]);
      stages.push({ scenario: s.id, level, turn: i + 1, role, model, calls: count,
        input_tokens_per_call: s.input, billable_output_per_call: s.outputs[role], output_limit: limits[role],
        expected_usd: round(expectedStage), output_limit_exposure_usd: round(maximumStage) });
      expectedTurn += expectedStage; maximumTurn += maximumStage; callTurn += count;
    }
    turns.push({ scenario: s.id, level, turn: i + 1, calls: callTurn, expected_usd: round(expectedTurn),
      output_limit_exposure_usd: round(maximumTurn), proposed_interaction_cap_usd: .6,
      expected_within_cap: expectedTurn <= .6, output_limit_exposure_within_cap: maximumTurn <= .6 });
    expected += expectedTurn; maximum += maximumTurn; calls += callTurn;
  }
  totals.push({ scenario: s.id, level, calls_per_execution: calls, expected_per_execution_usd: round(expected),
    expected_for_12_executions_usd: round(expected * 12), output_limit_exposure_for_12_executions_usd: round(maximum * 12) });
}
const pilot = scenarios.map(s => ({ scenario: s.id,
  calls: totals.filter(t => t.scenario === s.id).reduce((n, t) => n + t.calls_per_execution * 12, 0),
  expected_usd: round(totals.filter(t => t.scenario === s.id).reduce((n, t) => n + t.expected_for_12_executions_usd, 0)),
  output_limit_exposure_usd: round(totals.filter(t => t.scenario === s.id).reduce((n, t) => n + t.output_limit_exposure_for_12_executions_usd, 0)) }));
assert.deepEqual(pilot.map(p => p.calls), [864, 1152, 2088]);
assert.deepEqual(totals.filter(t => t.level === 'AGIL').map(t => t.expected_per_execution_usd), totals.filter(t => t.level === 'MEDIO').map(t => t.expected_per_execution_usd));

const corpus = [];
const denyTransport = async () => { throw Error('BUDGET_RESEARCH_OFFLINE_NO_TRANSPORT'); };
const provider = new DeepSeekProvider('deepseek-flash', '', WorkspaceAnalysisSchema, '', 'high', 1048576, 16000, denyTransport);
for (const caseId of ['N01', 'N02', 'N03', 'N04', 'N05', 'N06']) for (const turn of [1, 2, 3, 4]) {
  const { job, sourceIds } = await benchmarkSnapshot({ caseId, turn });
  // Compare the old artificial byte cutoff with the corrected full packet.
  const payload = { task: 'INTEGRATE', question: job.request.instruction,
    context: { text: job.context.text }, sources: job.context.sources };
  const contribution = { agent_id: 'synthetic-measurement', summary: '', findings: [], references: [], limitations: [] };
  const packet = integrationPacket(payload, [contribution]);
  const call = provider.prepare(packet);
  let invocations = 0, failure = null;
  try { await integrateContributions(payload, [contribution], { fits: p => provider.prepare(p).input_token_upper_bound <= 60000,
    invoke: async () => { invocations++; throw Error('UNEXPECTED_INVOKE'); }, progress: async () => {} }); }
  catch (e) { failure = e.message; }
  assert.equal(invocations, 0); assert.equal(failure, 'WORKSPACE_INTEGRATION_SIZE_LIMIT');
  const full = { ...payload, context:job.context };
  const contributions = [{...contribution,sources:job.context.sources},{...contribution,agent_id:'second',sources:job.context.sources}];
  const original = integrationPacket(full, contributions), compact = compactSourceEvidence(original);
  assert.deepEqual(expandSourceEvidence(compact),original);
  const compactCall = provider.prepare(compact), localTokens = await deepseekEnvelopeTokens(compactCall);
  let integrations=0;
  await integrateContributions(full,contributions,{fits:p=>workspaceCallFits(provider,provider.prepare(compactSourceEvidence(p))),
    invoke:async()=>{integrations++;return contribution;},progress:async()=>{}});
  assert.equal(integrations,1);
  corpus.push({ case: caseId, turn, source_ids: sourceIds,
    source_text_utf8_bytes: job.context.sources.reduce((n, s) => n + s.excerpts.reduce((n, e) => n + Buffer.byteLength(e.text), 0), 0),
    source_json_utf8_bytes: Buffer.byteLength(JSON.stringify(job.context.sources)),
    snapshot_utf8_bytes: Buffer.byteLength(JSON.stringify(job)),
    minimal_prepared_upper_bound: call.input_token_upper_bound,
    legacy_integration_gate: 60000, legacy_integration_result: failure,
    original_integration_utf8_bytes:Buffer.byteLength(JSON.stringify(original)),compact_integration_utf8_bytes:Buffer.byteLength(JSON.stringify(compact)),
    local_tokenizer_envelope:localTokens,token_count_kind:'LOCAL_DEEPSEEK_V4_ENVELOPE_NOT_PROVIDER_USAGE',
    round_trip_exact:true,integration_result:'OFFLINE_ACCEPTED_FULL_CORPUS',synthetic_integrations:integrations,provider_invocations:0 });
}
const human = [
  { task: 'Curaduría jurídica de 6 dossiers', hours: 18, basis: '6 × 3 h', rate_usd_hour: null },
  { task: 'Validación jurídica independiente inicial', hours: 12, basis: '6 × 2 h', rate_usd_hour: null },
  { task: 'Dos revisiones ciegas de cada ejecución', hours: 54, basis: '36 × 2 × 0,75 h; intermedios y final incluidos', rate_usd_hour: null },
  { task: 'Resolución de discrepancias', hours: 3, basis: 'Bolsa inicial; ampliar solo mediante presupuesto', rate_usd_hour: null },
  { task: 'Corrección humana cronometrada', hours: 18, basis: '36 × 0,5 h', rate_usd_hour: null },
  { task: 'Preparación y operación técnica', hours: 6, basis: 'Bolsa inicial; trabajo futuro, no factura de esta sesión', rate_usd_hour: null },
];
assert.equal(human.reduce((n, h) => n + h.hours, 0), 111);
const report = { version: '0.5', as_of_date: tariffs.as_of_date, paid_inferences: 0,
  network_requests_by_this_script: 0, tariff_sha256: sha(tariffBytes),
  cases_sha256: sha(await readFile(resolve(root, 'publico/CASOS.json'))),
  source_inventory_sha256: sha(await readFile(resolve(root, 'publico/fuentes/INVENTARIO.json'))),
  proposed_nominal_cap_usd: 86.4, interaction_cap_usd: .6, executions: 36, interactions: 144,
  scenarios, role_output_limits: limits, totals, pilot, turns, stages, corpus, human,
  human_hours: 111, human_fees_quoted: false, total_cost_including_human_usd: null,
  scenario_status: 'CONDITIONAL_PLANNING_NOT_CURRENT_PACKET_FORECAST',
  paid_ready: false, blockers: ['HUMAN_LEGAL_SIGNOFF_PENDING',
    'REAL_PROVIDER_TOKEN_COUNTS_AND_DYNAMIC_CALLS_UNMEASURED',
    'SCENARIO_INTERACTION_CAP_CAN_BIND', 'LIVE_TRANSPORT_ABSENT', 'TOTAL_SPEND_NOT_AUTHORIZED'] };
await writeFile(resolve(root, 'operacion/PRESUPUESTO_DETALLADO.json'), JSON.stringify(report, null, 2) + '\n');
for (const [name, rows] of [['PRESUPUESTO_ETAPAS', stages], ['PRESUPUESTO_TURNOS', turns], ['MEDICION_CORPUS', corpus]]) {
  const keys = Object.keys(rows[0]);
  const escape = value => '"' + String(Array.isArray(value) ? value.join('|') : value).replaceAll('"', '""') + '"';
  await writeFile(resolve(root, 'operacion/' + name + '.csv'), [keys.join(','), ...rows.map(row => keys.map(k => escape(row[k])).join(','))].join('\n') + '\n');
}
// Keep only the measured table synchronized; preserve all authored budget prose.
const number = n => new Intl.NumberFormat('es-PY').format(n);
const table = '| Caso, turno 2 | Paquete original UTF-8 | Paquete con catálogo UTF-8 | Conteo local de envolvente DeepSeek |\n|---|---:|---:|---:|\n' +
  corpus.filter(c=>c.turn===2).map(c=>`| ${c.case} | ${number(c.original_integration_utf8_bytes)} | ${number(c.compact_integration_utf8_bytes)} | ${number(c.local_tokenizer_envelope)} |`).join('\n')+'\n';
const budgetPath=resolve(root,'PRESUPUESTO.md'),prose=await readFile(budgetPath,'utf8');
assert(/\| Caso, turno 2 \|[\s\S]*?\| N06 \|[^\n]*\n/.test(prose));
await writeFile(budgetPath,prose.replace(/\| Caso, turno 2 \|[\s\S]*?\| N06 \|[^\n]*\n/,table));
console.log(JSON.stringify({ pilot, totals, corpus_snapshots_checked: corpus.length, human_hours: 111, paid_inferences: 0, paid_ready: false }, null, 2));
