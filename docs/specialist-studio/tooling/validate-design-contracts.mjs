import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only document checks; no providers, runtime, databases or app imports.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(resolve(root, 'contracts/SIX_AREA_SPECIALIST_CATALOG.v1.json'), 'utf8'));
const capabilities = JSON.parse(await readFile(resolve(root, 'contracts/SPECIALIST_CAPABILITY_PACKS.v1.json'), 'utf8'));
const checks = [];
function check(id, condition, detail) {
  checks.push({ id, status: condition ? 'PASS' : 'FAIL', detail });
}
const expected = catalog.specialists.flatMap(person => person.subprofiles.map(profile => ({ ...profile, persona: person.persona_name })));
const packs = capabilities.packs;
const ids = packs.map(pack => pack.pack_id);
check('catalog_cardinality', catalog.specialists.length === 6 && expected.length === 22 && packs.length === expected.length, 'Six accepted areas and all 22 subprofiles represented.');
check('unique_pack_ids', new Set(ids).size === ids.length, 'No duplicate subprofile packages.');
check('exact_catalog_mapping', expected.every(profile => packs.some(pack => pack.pack_id === profile.subprofile_id && pack.persona === profile.persona && pack.status === profile.status)) && ids.every(id => expected.some(profile => profile.subprofile_id === id)), 'IDs, personas and draft/pilot status match the accepted catalog.');
check('no_runtime_activation', capabilities.runtime_activation === false && capabilities.common_policy.runtime_enabled === false && packs.every(pack => pack.runtime_enabled === false), 'Generative specialist packages remain disabled; the deterministic offline workflow is recorded separately.');
check('offline_workflow_scope', capabilities.activation_scope === 'GENERATIVE_SPECIALIST_RUNTIME' && capabilities.offline_workflow.enabled === true && capabilities.offline_workflow.paid_calls_allowed === false && capabilities.offline_workflow.legal_skill_evaluation === 'NOT_RUN', 'The implemented offline exercise does not claim generative or legal qualification.');
const arrayFields = ['required_inputs', 'private_evidence', 'source_requirements', 'procedure', 'output_columns', 'tool_specs', 'abstention_conditions', 'escalation'];
check('complete_package_contracts', packs.every(pack => pack.version === 1 && pack.jurisdiction === 'PY' && pack.common_policy_ref === capabilities.common_policy.policy_id && arrayFields.every(field => Array.isArray(pack[field]) && pack[field].length >= 2 && pack[field].every(value => typeof value === 'string' && value.trim()))), 'Every package has inputs, evidence, procedure, output, tools, limits and escalation.');
check('no_source_or_tool_certification', packs.every(pack => pack.source_status === 'CANDIDATE_REQUIRES_LEGAL_CURATOR' && pack.tool_status === 'SPECIFICATION_ONLY_NO_NEW_PERMISSION'), 'Source and tool readiness is explicit.');
check('evaluations_not_fabricated', packs.every(pack => pack.evaluation.executed === false && pack.evaluation.reviewer === null && pack.evaluation.holdout_manifest === null && pack.evaluation.release_decision === null && pack.evaluation.positive_controls.length >= 2 && pack.evaluation.negative_controls.length >= 2), 'Positive/negative cases are specified; no evaluation or release is claimed.');

const documents = [
  'ADR_SPECIALIST_STUDIO_002.md', 'HEAD_CHIEF_DISPATCH_CONTRACT.md',
  'SPECIALIST_PROFILES_AND_RAG.md', 'ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md',
  'SPECIALISTS_COMPACT_UI_SPEC.md', 'IMPLEMENTATION_GATES_G0_G6.md',
  'BLOCKERS_AND_APPROVALS.md', 'CURRENT_RUNTIME_MAP_2026-10-14.md',
  'SPECIALIST_CAPABILITY_PACKS.md', 'CONTRACTUAL_PILOT_EVALUATION.md',
  'ELENA_LOCAL_PILOT_2026-10-15.md',
  'EQUIPO_JURIDICO_LOCAL_2026-10-15.md',
];
const texts = new Map();
const brokenLinks = [];
let linkCount = 0;
for (const name of documents) {
  const path = resolve(root, name);
  const text = await readFile(path, 'utf8');
  texts.set(name, text);
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const reference = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!reference || /^(?:https?:|mailto:|codex:)/i.test(reference)) continue;
    linkCount++;
    try { await stat(resolve(dirname(path), decodeURIComponent(reference))); }
    catch { brokenLinks.push({ document: name, reference }); }
  }
}
check('local_document_links', brokenLinks.length === 0, { checked: linkCount, broken: brokenLinks });
check('readable_fiches_match_catalog', packs.every(pack => texts.get('SPECIALIST_CAPABILITY_PACKS.md').includes('`' + pack.pack_id + '@1`')), 'All machine package IDs appear in readable fiches.');
const adr = texts.get('ADR_SPECIALIST_STUDIO_002.md');
check('adr_authority_recorded', adr.includes('ACCEPTED — DISEÑO RECONCILIADO; IMPLEMENTACIÓN LOCAL OFFLINE') && ['P02-R1', 'P03-R1', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'].every(id => adr.includes('| ' + id + ' |')), 'Design authority is recorded; expanded execution remains local, synthetic and offline.');
check('team_workflow_experimental', capabilities.team_workflow.pack_ids.length === 6 && capabilities.team_workflow.pack_ids.every(id => ids.includes(id)) && capabilities.team_workflow.paid_calls_allowed === false && capabilities.team_workflow.legal_skill_evaluation === 'NOT_RUN' && capabilities.team_workflow.automatic_legal_release === false, 'Six documentary packages can exercise the workflow without claiming legal accreditation.');
check('intake_and_execution_are_separate', texts.get('HEAD_CHIEF_DISPATCH_CONTRACT.md').includes('### IntakeDraft v1') && texts.get('HEAD_CHIEF_DISPATCH_CONTRACT.md').includes('### CoordinationGrant v1') && texts.get('HEAD_CHIEF_DISPATCH_CONTRACT.md').includes('execution_authorization_id?'), 'Pre-matter intake, conversational grant and analysis authorization are distinct.');
check('three_team_modes', ['Consulta focal', 'Equipo especializado', 'Junta completa'].every(label => adr.includes('| ' + label + ' |')), 'Team breadth modes are explicit.');
check('terminal_checker_and_artifacts', texts.get('ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md').includes('final_content_hash') && texts.get('ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md').includes('manifiesto') && texts.get('ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md').includes('réplicas') && texts.get('ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md').includes('HTML/Markdown/documento final'), 'All outputs, replies and exact final artifact are in the design contract.');
check('holdout_honestly_pending', texts.get('CONTRACTUAL_PILOT_EVALUATION.md').includes('no existe ni está congelado') && texts.get('CONTRACTUAL_PILOT_EVALUATION.md').includes('no holdout'), 'Development examples are not represented as reserved evaluation data.');

const failed = checks.filter(item => item.status === 'FAIL');
console.log(JSON.stringify({ mode: 'DOCUMENT_CONTRACT_CHECKS_ONLY', observed_at: new Date().toISOString(), status: failed.length ? 'FAIL' : 'PASS', checks, package_count: packs.length, legal_evaluation: 'NOT_RUN', app_tests: 'NOT_RUN', paid_calls: 0 }, null, 2));
if (failed.length) process.exitCode = 1;
