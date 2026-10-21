import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration } from '../../scripts/junta-setup.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '../..');
const PREP = path.resolve(HERE, '../evaluacion-multiagente-piloto');
const OUT = path.join(HERE, 'evaluacion-completa-v2');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';
const now = () => new Date().toISOString();
const CAP = 0.08;
let key, previous, total = 0, reserved = 0;
let template;
const records = [];
const cost = (i, o, upper = false) => (i * (i > 272000 ? 0.20 : 0.10) * (upper ? 1.25 : 1) + o * (i > 272000 ? 0.75 : 0.50)) / 1e6;

async function save(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof value === 'string' ? value : json(value), { flag: 'wx' });
}
async function api(endpoint, body, timeout) {
  const r = await fetch('https://api.openai.com/v1' + endpoint, { method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  const data = await r.json();
  if (!r.ok) { const e = Error('PROVIDER_HTTP_' + r.status); e.httpStatus = r.status; throw e; }
  return data;
}
function textOf(response) {
  return (response.output ?? []).flatMap(x => x.content ?? []).filter(x => x.type === 'output_text').map(x => x.text).join('\n');
}
async function review(run) {
  const folder = path.join(OUT, run.blind_id);
  const publicRoot = path.join(HERE, 'input-snapshot');
  const memo = await readFile(path.join(HERE, 'revision-ciega', run.blind_id + '.md'), 'utf8');
  if (sha(memo) !== run.blind_output_sha256) throw Error('BLIND_MEMO_CHANGED');
  const registry = JSON.parse(await readFile(path.join(publicRoot, 'fuentes/FUENTES.json'), 'utf8'));
  const sources = {};
  for (const s of registry.sources) {
    const bytes = await readFile(path.join(publicRoot, 'fuentes', s.extraction_file));
    if (sha(bytes) !== s.extraction_sha256) throw Error('SOURCE_CHANGED');
    sources[s.id] = bytes.toString('utf8').trimEnd().split('\n');
  }
  const catalog = registry.sources.map(s => ({ id: s.id, title: s.title, institution: s.institution, url: s.requested_url, lines: s.extraction_lines, original_sha256: s.original_sha256, temporal_review: s.consolidated_at_case_cutoff }));
  const reference = await readFile(path.join(PREP, 'reservado', `REFERENCIA_${run.case_id}.md`), 'utf8');
  const body = {
    model: 'gpt-6-luna', store: false, service_tier: 'default', reasoning: { effort: 'low' }, max_output_tokens: 6144,
    instructions: template.instructions + '\nUsá citas breves de hasta veinte palabras copiadas literalmente del memo; no añadas comillas, puntos suspensivos ni Markdown a esas citas. Explicá cada decisión en una o dos frases concisas. El inventario de fuentes y sus metadatos forman parte del material recibido por todos los investigadores. Conservá la diferencia entre un hecho inventado y un metadato efectivamente aportado.',
    input: [{ role: 'user', content: JSON.stringify({
      blind_id: run.blind_id,
      brief: await readFile(path.join(publicRoot, 'BRIEF_COMUN.md'), 'utf8'),
      encargo: await readFile(path.join(publicRoot, 'casos', run.case_id, 'ENCARGO.md'), 'utf8'),
      documentos: await readFile(path.join(publicRoot, 'casos', run.case_id, 'DOCUMENTOS.md'), 'utf8'),
      fuentes_disponibles_recibidas_por_el_investigador: catalog,
      fuentes_juridicas_completas: sources,
      referencia_provisional: reference.split('\n').filter(l => l.startsWith('|')).join('\n'),
      controles_negativos: reference.match(/## Controles negativos[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? '',
      memo,
    }) }],
    text: template.text,
  };
  const start = performance.now();
  const record = { blind_id: run.blind_id, started_at: now(), status: 'STARTED', max_cost_usd: CAP };
  let hold = 0, response, didReserve = false;
  try {
    const counted = await api('/responses/input_tokens', { model: body.model, instructions: body.instructions, input: body.input, text: body.text }, 45000);
    if (!Number.isInteger(counted.input_tokens)) throw Error('INPUT_COUNT_UNAVAILABLE');
    hold = cost(counted.input_tokens + 2048, body.max_output_tokens, true);
    if (hold > CAP || total + reserved + hold > 18 * CAP || previous.accounted_upper_usd + total + reserved + hold > 9.54 || previous.combined_accounted_upper_usd + total + reserved + hold > 10.80) throw Error('REVIEW_BUDGET_EXHAUSTED');
    reserved += hold; didReserve = true;
    record.reserved_upper_usd = hold; record.counted_input_tokens = counted.input_tokens;
    await save(path.join(folder, 'request.json'), body);
    response = await api('/responses', body, 240000);
    await save(path.join(folder, 'response.json'), response);
    if (response.model !== 'gpt-6-luna' || response.status !== 'completed') throw Error('REVIEW_RESPONSE_NOT_COMPLETED');
    const parsed = JSON.parse(textOf(response));
    const quoteChecks = [...parsed.reference_findings.map(x => ({ kind: 'FINDING', reference_id: x.reference_id, quote: x.exact_output_quote, treatment: x.treatment })), ...parsed.errors.map((x, i) => ({ kind: 'ERROR', index: i, quote: x.exact_output_quote }))].map(x => ({ ...x, literal: !x.quote || memo.includes(x.quote), empty_when_evidence_expected: !x.quote && (x.kind === 'ERROR' || ['SUFFICIENT', 'PARTIAL'].includes(x.treatment)) }));
    Object.assign(parsed, { blind_id: run.blind_id, status: 'AUTOMATED_PROVISIONAL_NOT_HUMAN_ADJUDICATED', evaluation_pass: 2, quote_checks: quoteChecks, non_literal_quote_count: quoteChecks.filter(x => !x.literal).length, missing_required_quote_count: quoteChecks.filter(x => x.empty_when_evidence_expected).length });
    record.status = 'COMPLETED';
    await save(path.join(folder, 'REVISION.json'), parsed);
    record.review = parsed;
  } catch (error) {
    record.status = 'FAILED'; record.error = /^[A-Z_0-9]+$/.test(error.message) ? error.message : 'TRANSPORT_OUTCOME_UNKNOWN';
    if (error.httpStatus && [400, 401, 403, 404, 422, 429].includes(error.httpStatus)) record.known_rejection_without_observed_generation = true;
  } finally {
    const known = Number.isInteger(response?.usage?.input_tokens) && Number.isInteger(response?.usage?.output_tokens);
    const accounted = known ? cost(response.usage.input_tokens, response.usage.output_tokens, true) : !didReserve || record.known_rejection_without_observed_generation ? 0 : hold;
    if (didReserve) reserved -= hold;
    total += accounted;
    record.finished_at = now(); record.elapsed_ms = Math.round(performance.now() - start); record.response_id = response?.id ?? null; record.usage = response?.usage ?? null; record.accounted_upper_usd = accounted; record.actual_invoice_cost_usd = null;
    await save(path.join(folder, 'EVENTO.json'), { ...record, review: undefined });
    records.push(record);
    await writeFile(path.join(OUT, 'PROGRESS.json'), json({ completed_attempts: records.length, planned: 18, successful: records.filter(r => r.status === 'COMPLETED').length, accounted_upper_usd: total }));
    console.log(JSON.stringify({ event: 'REVIEW_PASS_2_FINISHED', blind_id: run.blind_id, status: record.status, error: record.error ?? null, non_literal_quotes: record.review?.non_literal_quote_count ?? null }));
  }
}

async function main() {
  if (!process.argv.includes('--execute-authorized-review-pass')) throw Error('EXPLICIT_REVIEW_EXECUTION_FLAG_REQUIRED');
  previous = JSON.parse(await readFile(path.join(HERE, 'RESULTADOS.json'), 'utf8'));
  if (previous.successful !== 18) throw Error('ALL_GENERATIONS_REQUIRED');
  if (previous.accounted_upper_usd + 18 * CAP > 9.54 || previous.combined_accounted_upper_usd + 18 * CAP > 10.80) throw Error('SESSION_BUDGET_EXHAUSTED');
  const { env } = await loadConfiguration(PROJECT); key = env.OPENAI_API_KEY;
  if (!key || env.OPENAI_LUNA_MODEL !== 'gpt-6-luna') throw Error('MODEL_CONFIGURATION_REQUIRED');
  const gradeFolders = await readdir(path.join(HERE, 'evaluacion-automatica'));
  for (const folder of gradeFolders.sort()) {
    const files = await readdir(path.join(HERE, 'evaluacion-automatica', folder));
    const request = files.find(f => f.endsWith('.request.json'));
    if (request) { template = JSON.parse(await readFile(path.join(HERE, 'evaluacion-automatica', folder, request), 'utf8')); break; }
  }
  if (!template?.text?.format?.schema) throw Error('REVIEW_SCHEMA_REQUIRED');
  await mkdir(OUT, { recursive: true });
  await save(path.join(OUT, 'FREEZE.json'), {
    status: 'SECOND_UNIFORM_AUTOMATED_REVIEW', at: now(), script_sha256: sha(await readFile(fileURLToPath(import.meta.url))), generation_results_sha256: sha(await readFile(path.join(HERE, 'GENERATION_RESULTS.json'))),
    reason: 'First review had transport outcomes unknown and omitted metadata that researchers had received; do not silently accept its unsupported metadata objections.',
    coverage: 'Every one of the same eighteen memos, not only favorable or failed cases.', model: 'gpt-6-luna', reasoning: 'low', timeout_ms: 240000, concurrency: 2, max_output_tokens: 6144,
    per_review_cap_usd: CAP, pass_cap_usd: 18 * CAP, previous_accounted_upper_usd: previous.accounted_upper_usd, previous_combined_with_calibration_usd: previous.combined_accounted_upper_usd, maximum_session_usd: 10.80,
    no_generation_changed: true, no_prior_grades_sent_to_new_reviewer: true, no_transport_retry_of_first_pass_request: true, metadata_included: true, original_review_preserved: true, human_review: 'NOT_RUN',
  });
  const queue = previous.results.filter(r => r.status === 'COMPLETED').sort((a, b) => a.blind_id.localeCompare(b.blind_id));
  let cursor = 0;
  await Promise.all([0, 1].map(async () => { for (;;) { const index = cursor++; if (index >= queue.length) return; await review(queue[index]); } }));
  const result = { status: records.every(r => r.status === 'COMPLETED') && records.length === 18 ? 'SECOND_REVIEW_COMPLETED' : 'SECOND_REVIEW_PARTIAL', completed: records.length, successful: records.filter(r => r.status === 'COMPLETED').length, accounted_upper_usd: total, all_evaluation_and_generation_accounted_upper_usd: previous.accounted_upper_usd + total, combined_with_calibration_upper_usd: previous.combined_accounted_upper_usd + total, actual_invoice_cost_usd: null, grades: records.filter(r => r.review).map(r => r.review), records: records.map(({ review, ...r }) => r), human_review: 'NOT_RUN' };
  await save(path.join(HERE, 'REVISION_COMPLETA_V2.json'), result);
  console.log(JSON.stringify({ event: result.status, successful: result.successful, accounted_upper_usd: total, combined_upper_usd: result.combined_with_calibration_upper_usd }));
}
main().catch(error => { console.error(JSON.stringify({ status: 'STOPPED', error: /^[A-Z_0-9]+$/.test(error.message) ? error.message : 'REVIEW_ERROR' })); process.exitCode = 1; });
