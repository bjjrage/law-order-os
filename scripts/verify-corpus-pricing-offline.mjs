// Verifies saved offline evidence; never contacts a model or opens the work DB.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const workspace=resolve(import.meta.dirname,'..'),root=resolve(workspace,'docs/evaluacion-niveles-2026-10-21');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const budget=await read('operacion/PRESUPUESTO_DETALLADO.json'),tests=await read('operacion/OFFLINE_TESTS.json');
const technical=await read('operacion/VERIFICACION_TECNICA.json'),native=await read('operacion/AISLAMIENTO_OFFLINE.json');
assert(tests.success&&tests.numFailedTests===0&&tests.numPassedTests>=50);
assert(technical.gates.offline_technical_checks_passed&&technical.gates.corpus_and_context_verified&&technical.gates.long_context_price_verified);
assert(!technical.gates.paid_execution_enabled&&!technical.gates.total_spend_authorized);
assert.equal(budget.corpus.length,24);
assert(budget.corpus.every(c=>c.round_trip_exact&&c.integration_result==='OFFLINE_ACCEPTED_FULL_CORPUS'&&c.synthetic_integrations===1&&c.provider_invocations===0));
assert.equal(budget.tariff_sha256,sha(await readFile(resolve(root,'operacion/TARIFAS_PROPUESTAS.json'))));
assert.equal(budget.cases_sha256,sha(await readFile(resolve(root,'publico/CASOS.json'))));
assert.equal(budget.source_inventory_sha256,sha(await readFile(resolve(root,'publico/fuentes/INVENTARIO.json'))));
const currentControls=technical.code_matches.filter(f=>f.path.startsWith('scripts/')||f.path.startsWith('packages/')||f.path.startsWith('node_modules/@huggingface/tokenizers/')||f.path==='package.json');
for(const c of currentControls)assert.equal(sha(await readFile(resolve(workspace,c.path))),c.sha256,c.path);
// Check all four capsule code sets, rather than trusting the last turn alone.
assert.equal(native.completed_turns,4);assert.equal(native.turns.length,4);
for(const [i,turn]of native.turns.entries()) {
  assert.equal(turn.history_jobs,i);assert.equal(turn.generations,9);assert(turn.specialist_count>=2);
  assert(turn.foreign_history_denied&&turn.attestation.appContainer&&turn.attestation.capabilityCount===0);
  const manifest=JSON.parse(await readFile(resolve(turn.base,'capsule/capsule.json'),'utf8'));
  assert.equal(manifest.source_ids.includes('N06-AS318-2010'),i>=1);
  for(const control of currentControls) {
    const capsule=manifest.code.find(c=>c.path===control.path);
    // Host-only controls are verified separately in VERIFICACION_TECNICA.
    if(capsule)assert.equal(capsule.sha256,control.sha256,control.path+':turn'+(i+1));
  }
}
const law=await readFile(resolve(root,'publico/fuentes/CPC-7663.txt'),'utf8');
assert(law.includes('[PDF page 4]')&&/La\s+presente\s+ley\s+entrar[áa]\s+en\s+vigencia/iu.test(law));
const inputs=[];
for(const path of ['README.md','CORPUS_Y_TARIFAS.md','PRESUPUESTO.md','VIGENCIA.md','VALIDACION_ABOGADO.md','publico/CASOS.json','publico/fuentes/INVENTARIO.json','operacion/TARIFAS_PROPUESTAS.json','operacion/PRESUPUESTO_DETALLADO.json','operacion/OFFLINE_TESTS.json','operacion/AISLAMIENTO_OFFLINE.json','operacion/VERIFICACION_TECNICA.json'])inputs.push({path,sha256:sha(await readFile(resolve(root,path)))});
const summary={version:'0.5',created_at:new Date().toISOString(),paid_inferences:0,real_provider_requests:0,
  offline_tests_passed:tests.numPassedTests,offline_tests_failed:0,corpus_case_turns:24,corpus_round_trip_exact:true,
  corpus_text_truncated:false,source_selection_performed:false,legacy_cutoff_rejections_reproduced:24,corrected_offline_integrations_accepted:24,
  cpc_7663_full_pdf_text_restored:true,context_count_scope:'DeepSeek V4 local envelope; OpenAI/Gemini counts in protocol fixtures are synthetic, not real provider counts',
  pricing_boundary_tests:[272000,272001],whole_request_long_tariff_verified:true,concurrent_long_tier_reservations_verified:true,
  native_turns_verified:4,native_synthetic_generations:36,native_control_hashes_match_all_turns:true,
  paid_execution_enabled:false,total_spend_authorized:false,human_legal_validation:'PENDING',
  remaining:['LEGAL_SIGNOFF_AND_REGULATION_OF_7663','BLINDING_AND_FEES','REAL_TOKEN_AND_COST_PREFLIGHT','TOTAL_AUTHORIZATION','LIVE_TRANSPORT_NOT_IMPLEMENTED'],inputs};
await writeFile(resolve(root,'operacion/CORPUS_TARIFAS_OFFLINE.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',tests:summary.offline_tests_passed,corpus:24,native_turns:4,synthetic_generations:36,paid_inferences:0}));
