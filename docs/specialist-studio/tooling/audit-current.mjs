import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const reports = resolve(root, 'docs/specialist-studio/reports');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceRoots = ['apps/web/src', 'apps/api/src', 'os-core/src', 'junta-juridica/src', 'packages', 'infra', 'supabase', 'scripts'];
const historicalFiles = ['package.json', 'package-lock.json', 'docs/LAW_ORDER_OS_BLUEPRINT_v2.0.md', 'docs/LAW_ORDER_OS_BLUEPRINT_v2.0.html', 'docs/LAW_ORDER_OS_ROADMAP_v2.0.md', 'docs/LAW_ORDER_OS_ROADMAP_v2.0.html', 'docs/ADR_RECONCILIACION_V2.md', 'docs/ADR_OS_001_ACCEPTED.md', 'docs/ADR_OS_001_LOCAL_BROWSER_ADDENDUM.md', 'junta-juridica/docs/ADR_JUNTA_JURIDICA_V2.md', 'PHASE2_IMPLEMENTATION_REPORT.md', 'PHASE2_TEST_RESULTS.md', 'OFFICIAL_CORPUS_MANIFEST.json', 'BIBLIOGRAPHIC_BENCHMARK_REPORT.md', 'MODEL_CONNECTIVITY_REPORT.md', 'KNOWN_LIMITATIONS.md', 'README.md'];

async function filesUnder(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const results = await Promise.all(entries.map(async entry => {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) return filesUnder(path);
    return entry.isFile() && ['.ts', '.tsx', '.mjs', '.css', '.sql', '.json', '.toml'].includes(extname(path)) ? [path] : [];
  }));
  return results.flat();
}

async function fingerprints() {
  const paths = [...new Set([...historicalFiles, ...(await Promise.all(sourceRoots.map(filesUnder))).flat()])].sort();
  return Object.fromEntries(await Promise.all(paths.map(async path => [path, digest(await readFile(resolve(root, path)))])));
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { exit_code: result.status, value: result.status === 0 ? result.stdout.trim() : null };
}

async function localGet(path, json = true) {
  const response = await fetch('http://127.0.0.1:4313' + path, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw Error('LOCAL_HTTP_' + response.status);
  return { status: response.status, value: json ? await response.json() : await response.text() };
}

async function writeReport(name, data) {
  await mkdir(reports, { recursive: true });
  await writeFile(resolve(reports, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
}

async function compiledParity() {
  return Promise.all(['orchestration/index', 'citation-checker/index', 'citation-checker/extraction', 'providers/live', 'providers/contracts'].map(async module => {
    const source = await readFile(resolve(root, 'junta-juridica/src/' + module + '.ts'), 'utf8');
    const compiled = await readFile(resolve(root, 'dist/' + module + '.js'), 'utf8');
    const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, sourceMap: true } }).outputText;
    const normalize = value => value.replace(/\/\/# sourceMappingURL=.*$/gm, '').replace(/\r\n/g, '\n').trim();
    return { module, matches_transpiled_source: normalize(emitted) === normalize(compiled), compiled_sha256: digest(compiled) };
  }));
}

if (process.argv[2] === 'parity') {
  const result = { checked_at: new Date().toISOString(), method: 'ESNext emit matching the repository ESM package; source maps excluded', supersedes: 'Initial NodeNext isolated-transpile comparison in runtime-audit.json', modules: await compiledParity() };
  await writeReport('compiled-parity.json', result);
  console.log(JSON.stringify(result));
} else if (process.argv[2] === 'verify') {
  const baseline = JSON.parse(await readFile(resolve(reports, 'runtime-audit.json'), 'utf8'));
  const current = await fingerprints();
  const changed = Object.keys(baseline.protected_hashes).filter(path => current[path] !== baseline.protected_hashes[path]);
  const result = { checked_at: new Date().toISOString(), protected_files: Object.keys(baseline.protected_hashes).length, changed, status: changed.length ? 'FAIL' : 'PASS' };
  await writeReport('preservation.json', result);
  console.log(JSON.stringify(result));
  process.exitCode = changed.length ? 1 : 0;
} else {
  const protectedHashes = await fingerprints();
  const handoffPath = resolve('C:/Users/User/Downloads/LAW_ORDER_OS_HANDOFF_HEAD_CHIEF_ESPECIALISTAS_V2_2026-10-14.md');
  const handoff = await readFile(handoffPath);
  const [home, status, progress, previous] = await Promise.all([
    localGet('/', false), localGet('/local/junta/status'), localGet('/local/junta/library/progress'),
    localGet('/local/junta/case/status?id=565ec866-bcd6-4c1a-8dbc-cc905950d3d9'),
  ]);
  const assets = [...home.value.matchAll(/(?:src|href)="(\/assets\/[^"<>]+)"/g)].map(match => match[1]);
  const assetChecks = await Promise.all(assets.map(async path => {
    const response = await fetch('http://127.0.0.1:4313' + path, { signal: AbortSignal.timeout(15000) });
    const served = digest(Buffer.from(await response.arrayBuffer()));
    const disk = digest(await readFile(resolve(root, 'dist/web' + path)));
    return { path, http_status: response.status, served_sha256: served, disk_sha256: disk, matches: served === disk };
  }));
  const parity = await compiledParity();
  const run = previous.value.run;
  const manifest = JSON.parse(await readFile(resolve(root, 'OFFICIAL_CORPUS_MANIFEST.json'), 'utf8'));
  const originals = await Promise.all(manifest.documents.map(async document => ({
    id: document.source_document_id,
    matches_manifest: digest(await readFile(resolve(root, document.original_path))) === document.original_sha256,
    extraction_status: document.extraction_status,
    verification_status: document.verification_status,
  })));
  const report = {
    observed_at: new Date().toISOString(), local_date: '2026-10-14', timezone: 'America/Asuncion',
    root, git: { branch: git('branch', '--show-current'), head: git('rev-parse', '--verify', 'HEAD'), tracked: git('ls-files') },
    handoff: { path: handoffPath, bytes: handoff.length, sha256: digest(handoff), read_in_full: true },
    http: { url: 'http://127.0.0.1:4313', home_status: home.status, home_sha256: digest(home.value), assets: assetChecks },
    provider_status: status.value,
    library_snapshot: { updated_at: progress.value.updated_at, status: progress.value.status, indexed_documents: progress.value.indexed_documents, discovered_documents: progress.value.discovered_documents, indexed_passages: progress.value.indexed_passages, ocr_documents: progress.value.ocr_documents, statuses: progress.value.statuses, paid_calls: progress.value.paid_calls, deployments: progress.value.deployments },
    historical_run: { run_id: run.run_id, mode: run.mode, status: run.status, stages: run.stages, reference_verification: run.reference_verification, human_approval: run.human_approval, cost: run.cost, interpretation: 'Recovered persisted result; no new provider invocation or invoice verification.' },
    compiled_parity: parity, original_integrity: originals, protected_hashes: protectedHashes,
    performed_paid_calls: 0, performed_deployments: 0,
  };
  await writeReport('runtime-audit.json', report);
  globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN_DURING_SYNTHETIC_PROBE'); };
  const { LegalBoard } = await import('../../../dist/orchestration/index.js');
  const { MemoryBoardStore } = await import('../../../dist/persistence/index.js');
  const { createOfflineProviders } = await import('../../../dist/providers/offline.js');
  const { DEFAULT_CONFIG } = await import('../../../dist/providers/config.js');
  const { demoFixture, simulationPrices } = await import('../../../dist/cli/demo.js');
  const { extractCitations } = await import('../../../dist/citation-checker/extraction.js');
  const fixture = demoFixture('specialist-audit-gemini-coverage');
  const providers = createOfflineProviders();
  const originalInvoke = providers.gemini.invoke.bind(providers.gemini);
  const fabricated = 'Sentencia N° 999999 | tribunal: Tribunal Sintético de Prueba | 2024-01-15';
  providers.gemini.invoke = async (...args) => {
    const response = await originalInvoke(...args);
    response.output.findings.push({ finding_id: 'fabricated-only-in-auditor', type: 'SUSPICIOUS_CITATION', severity: 'HIGH', statement: fabricated, related_source_ids: [], recommended_action: 'Revisar referencia de prueba.' });
    response.output.citation_objections.push(fabricated);
    return response;
  };
  const result = await new LegalBoard(fixture.index, new MemoryBoardStore(), providers, DEFAULT_CONFIG, simulationPrices()).execute(fixture.actor, fixture.request, fixture.snapshot);
  const auditExtraction = extractCitations(result.audit.findings.map(finding => finding.statement).join('\n'), 'PY');
  const missed = auditExtraction.citations.length > 0 && !result.citation_checks.some(check => check.matched_source_ids.includes('999999') || check.reference_id.includes('fabricated-only')) && result.reference_verification === 'PASS_IN_SCOPE';
  const inWords = extractCitations('ACUERDO Y SENTENCIA NÚMERO Mil ciento ochenta y cuatro', 'PY');
  const probe = { status: missed ? 'GAP_REPRODUCED' : 'UNEXPECTED_RESULT', mode: 'OFFLINE_SIMULATION', network: 'FORBIDDEN', paid_calls: 0, run_status: result.status, reference_verification: result.reference_verification, auditor_only_reference: fabricated, auditor_reference_detected_when_explicitly_scanned: auditExtraction.citations.length, checked_reference_ids: result.citation_checks.map(check => check.reference_id), current_checker_input: 'analysis only', number_in_words: { extracted: inWords.citations.length, unresolved: inWords.unresolved_markers.length, coverage: inWords.coverage_status } };
  await writeReport('checker-coverage-probe.json', probe);
  console.log(JSON.stringify({ observed_at: report.observed_at, git: report.git, protected_files: Object.keys(protectedHashes).length, library: report.library_snapshot, parity, originals, probe }, null, 2));
}
