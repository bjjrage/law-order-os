import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PREP = path.resolve(HERE, '../evaluacion-multiagente-piloto');
const sha = b => createHash('sha256').update(b).digest('hex');
const json = x => JSON.stringify(x, null, 2) + '\n';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const summary = await read(path.join(HERE, 'RESULTADOS.json'));
const freezeBytes = await readFile(path.join(HERE, 'FREEZE.json'));
const freeze = JSON.parse(freezeBytes);
const median = xs => { const a = [...xs].sort((a, b) => a - b); return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : null; };
const rounded = x => x === null ? 'No medido' : Number(x.toFixed(4));
const gradeById = new Map(summary.grades.map(g => [g.blind_id, g]));
const references = {};
for (const caseId of ['P01', 'P02', 'P03']) {
  const t = await readFile(path.join(PREP, 'reservado', `REFERENCIA_${caseId}.md`), 'utf8');
  references[caseId] = [...t.matchAll(/\| (P\d{2}-H\d{2}) \| (CRITICA|MATERIAL|MENOR) \|/g)].map(m => ({ id: m[1], severity: m[2] }));
}
const rows = [];
for (const r of summary.results) {
  const g = gradeById.get(r.blind_id);
  const expected = references[r.case_id];
  const f = g?.reference_findings ?? [];
  const valid = !!g && g.status !== 'GRADE_FAILED' && expected.every(e => f.filter(x => x.reference_id === e.id).length === 1) && f.length === expected.length;
  const errors = g?.errors ?? [];
  rows.push({ run_id: r.run_id, case_id: r.case_id, modality: r.modality, repetition: r.repetition, status: r.status, blind_id: r.blind_id,
    valid_automated_reference_inventory: valid,
    sufficient: valid ? f.filter(x => x.treatment === 'SUFFICIENT').length : null,
    partial: valid ? f.filter(x => x.treatment === 'PARTIAL').length : null,
    omitted: valid ? f.filter(x => x.treatment === 'OMITTED').length : null,
    disputed: valid ? f.filter(x => x.treatment === 'DISPUTED_REFERENCE').length : null,
    expected: expected.length,
    critical_omissions_proposed: valid ? f.filter(x => ['OMITTED', 'PARTIAL'].includes(x.treatment) && expected.find(e => e.id === x.reference_id)?.severity === 'CRITICA').length : null,
    critical_errors_proposed: g?.status !== 'GRADE_FAILED' ? errors.filter(x => x.severity === 'CRITICAL').length : null,
    material_errors_proposed: g?.status !== 'GRADE_FAILED' ? errors.filter(x => x.severity === 'MATERIAL').length : null,
    recommendation_coherent_provisional: g?.recommendation_coherent ?? null,
    non_literal_judge_quotes: g?.non_literal_quote_count ?? null,
    generation_calls: r.usage.calls,
    elapsed_seconds: r.elapsed_ms / 1000,
    generation_cost_estimated_usd: r.usage.estimated_standard_no_cache_discount_usd,
    generation_cost_accounted_upper_usd: r.usage.cost_accounted_upper_usd,
    output_words_including_annex: r.output_words_including_annex ?? null,
    invalid_case_locators: r.invalid_case_locators ?? [],
    human_correction_minutes: null,
  });
}
const modality = {};
for (const m of ['A', 'B', 'C']) {
  const group = rows.filter(r => r.modality === m);
  const valid = group.filter(r => r.valid_automated_reference_inventory);
  const sum = key => valid.reduce((a, r) => a + r[key], 0);
  modality[m] = { documents: group.length, successful: group.filter(r => r.status === 'COMPLETED').length, reviewed_validly: valid.length,
    sufficient: sum('sufficient'), partial: sum('partial'), omitted: sum('omitted'), disputed: sum('disputed'), expected: sum('expected'),
    critical_omissions_proposed: sum('critical_omissions_proposed'), critical_errors_proposed: sum('critical_errors_proposed'), material_errors_proposed: sum('material_errors_proposed'),
    non_literal_judge_quotes: valid.reduce((a, r) => a + (r.non_literal_judge_quotes ?? 0), 0),
    median_generation_seconds: median(group.filter(r => r.status === 'COMPLETED').map(r => r.elapsed_seconds)),
    median_generation_calls: median(group.filter(r => r.status === 'COMPLETED').map(r => r.generation_calls)),
    generation_estimated_usd: group.reduce((a, r) => a + r.generation_cost_estimated_usd, 0),
    invalid_case_locator_count: group.reduce((a, r) => a + r.invalid_case_locators.length, 0), human_correction_minutes: null };
}
const prepareBytes = await readFile(path.join(PREP, 'MANIFIESTO.json'));
const prepared = JSON.parse(prepareBytes);
const integrityErrors = [];
if (sha(prepareBytes) !== freeze.input_manifest_sha256) integrityErrors.push('Preparation manifest changed');
for (const f of prepared.files) if (sha(await readFile(path.join(PREP, f.path))) !== f.sha256) integrityErrors.push('Original preparation changed: ' + f.path);
for (const f of prepared.files.filter(x => x.audience === 'RESEARCH_INPUT')) {
  const relative = f.path.slice('publico/'.length);
  if (sha(await readFile(path.join(HERE, 'input-snapshot', relative))) !== f.sha256) integrityErrors.push('Snapshot differs: ' + relative);
}
if (sha(await readFile(path.join(HERE, 'runner.mjs'))) !== freeze.runner_sha256) integrityErrors.push('Runner changed after freeze');
const persisted = { status: 'EXPLORATORY_AUTOMATED_COMPARISON_NOT_LEGAL_VALIDATION', generated: summary.generated, successful: summary.successful, valid_reviews: rows.filter(r => r.valid_automated_reference_inventory).length, model: freeze.model, total_accounted_upper_usd: summary.accounted_upper_usd, actual_invoice_cost_usd: null, human_legal_review: 'NOT_RUN', human_correction_minutes: null, integrity_errors: integrityErrors, modality, rows };
await writeFile(path.join(HERE, 'COMPARACION_AUTOMATICA.json'), json(persisted), { flag: 'wx' });

const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const columns = ['run_id','case_id','modality','repetition','status','blind_id','valid_automated_reference_inventory','sufficient','partial','omitted','disputed','expected','critical_omissions_proposed','critical_errors_proposed','material_errors_proposed','non_literal_judge_quotes','generation_calls','elapsed_seconds','generation_cost_estimated_usd','output_words_including_annex','human_correction_minutes'];
await writeFile(path.join(HERE, 'COMPARACION_AUTOMATICA.csv'), columns.join(',') + '\n' + rows.map(r => columns.map(c => quote(r[c])).join(',')).join('\n') + '\n', { flag: 'wx' });
await writeFile(path.join(HERE, 'CLAVE_CIEGA.csv'), 'run_id,blind_id,output_sha256,blind_output_sha256\n' + summary.results.map(r => [r.run_id,r.blind_id,r.output_sha256,r.blind_output_sha256].map(quote).join(',')).join('\n') + '\n', { flag: 'wx' });

let interpretation;
const b = modality.B, c = modality.C;
if (b.reviewed_validly !== 6 || c.reviewed_validly !== 6) interpretation = 'La comparación principal está incompleta. No corresponde atribuir una ventaja arquitectónica a los datos faltantes.';
else if (c.sufficient > b.sufficient && c.critical_errors_proposed <= b.critical_errors_proposed && c.critical_omissions_proposed <= b.critical_omissions_proposed) interpretation = 'El evaluador automático propone una señal favorable a C en cobertura de la referencia, sin más objeciones críticas en ese conteo. Esa señal requiere adjudicación humana; no demuestra superioridad jurídica ni ahorro de trabajo profesional.';
else if (c.sufficient <= b.sufficient) interpretation = 'El conteo automático no muestra una ventaja de C sobre B en tratamiento suficiente de la referencia. No hay base en este piloto para afirmar que las investigaciones separadas mejoren la calidad jurídica.';
else interpretation = 'Los resultados automáticos son mixtos: una posible mejora de cobertura viene acompañada de objeciones críticas. No corresponde declarar a C superior.';

const report = `# Resultado del piloto ejecutado

Estado: ${summary.status}. Modelo efectivo: ${summary.model}, esfuerzo low. Generaciones completadas: ${summary.successful}/${18}. Revisiones automáticas: ${summary.automated_reviews}. Revisión de abogados: **NO EJECUTADA**. Tiempo humano hasta documento utilizable: **NO MEDIDO**.

${interpretation}

## Comparación descriptiva

Los hallazgos son los de una referencia sintética provisional: seis en P01, siete en P02 y ocho en P03. Cada modalidad tiene hasta 42 oportunidades de tratamiento contando las dos repeticiones. Se muestran suficientes, parciales, omitidos y disputados por separado; no se asigna crédito fraccionario elegido después de ver resultados. Una observación automática no equivale a un error jurídico adjudicado.

| Modalidad | Memos completos | Hallazgos suficientes / referencia revisada | Parciales | Omitidos | Referencia disputada | Objeciones críticas propuestas | Mediana de generación, segundos | Costo de generación estimado USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${['A','B','C'].map(m => { const v=modality[m]; return `| ${m} | ${v.successful}/${v.documents} | ${v.sufficient}/${v.expected} | ${v.partial} | ${v.omitted} | ${v.disputed} | ${v.critical_errors_proposed} | ${rounded(v.median_generation_seconds)} | ${rounded(v.generation_estimated_usd)} |`; }).join('\n')}

A es generalista autónomo; B es generalista por etapas; C es investigación contractual, tributaria y laboral en paralelo con integración del titular. La comparación principal fijada fue C contra B. Las medianas reflejan solo el workflow de generación y sus herramientas, no tiempo hasta utilización profesional.

## Resultados por ejecución

| Ejecución | Estado | Suficientes / esperados | Parciales | Omitidos | Objeciones críticas / materiales propuestas | Segundos | Llamadas de generación |
|---|---|---:|---:|---:|---:|---:|---:|
${rows.map(r => `| ${r.run_id} | ${r.status} | ${r.sufficient ?? 'ND'}/${r.expected} | ${r.partial ?? 'ND'} | ${r.omitted ?? 'ND'} | ${r.critical_errors_proposed ?? 'ND'} / ${r.material_errors_proposed ?? 'ND'} | ${rounded(r.elapsed_seconds)} | ${r.generation_calls} |`).join('\n')}

## Consumo y trazabilidad

El total conservador imputado a generación y evaluación automática es **USD ${summary.accounted_upper_usd.toFixed(6)}**, con techo de USD ${freeze.total_cap_usd.toFixed(2)}. No es un importe facturado: el proveedor devuelve tokens y la imputación usa precios estándar con reserva conservadora para escrituras de caché. Los descuentos por lectura de caché no se descuentan de la estimación estándar. Los costos desconocidos, si existen, se imputan por su reserva máxima.

Se guardan peticiones sin credenciales, respuestas con ID del proveedor, uso observado, herramientas, comunicaciones, memos originales, copias ciegas y referencias de hashes. El paquete de preparación y la copia de entradas públicas ${integrityErrors.length ? 'presentan incidencias: '+integrityErrors.join('; ') : 'mantienen todos sus hashes originales'}.

## Límites de interpretación

- Se ejecutó un harness separado con herramientas locales de evidencia equivalentes. No se ensayó el workspace productivo, Jev, la junta profunda ni paquetes permanentes de especialidad.
- El mismo modelo generó y evaluó. Puede compartir sesgos y errores; el cegamiento no lo convierte en un abogado independiente. Las referencias también son de autoría IA y no fueron validadas externamente.
- La revisión automática contiene ${rows.reduce((a,r)=>a+(r.non_literal_judge_quotes??0),0)} citas del memo que no coincidieron literalmente. Esas observaciones requieren especial revisión antes de aceptarlas como errores o tratamientos suficientes.
- Tres asuntos sintéticos conocidos no son un holdout. Las repeticiones no aumentan a dieciocho el número de asuntos independientes.
- No hubo revisión humana, adjudicación jurídica, sesiones reales de corrección ni umbrales profesionales de adopción fijados. Por tanto **no se acredita superioridad jurídica ni reducción del trabajo humano**.
- Los techos de turnos y salida por etapa forman parte de esta configuración. A pudo usar el pool total; B y los investigadores de C tuvieron hasta ocho turnos por etapa. La API utilizó el alias configurado y no un snapshot inmutable.
- No se calculan p95, significancia ni equivalencia práctica a partir de esta muestra.

## Siguiente comprobación

Entregar los memos de revision-ciega junto con el expediente público a los abogados usando las plantillas originales. Mantener CLAVE_CIEGA.csv y esta comparación fuera de su primera lectura. Adjudicar hallazgos, corregir memos con tiempos reales y decidir si la señal merece confirmación sobre asuntos nuevos. No se activa ni modifica la arquitectura del OS.
`;
await writeFile(path.join(HERE, 'INFORME.md'), report, { flag: 'wx' });

async function walk(dir) { const out=[]; for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);} return out; }
const inventory=[];
for(const p of (await walk(HERE)).sort()){if(path.basename(p)==='ARTIFACTOS.json')continue;const bytes=await readFile(p);inventory.push({path:path.relative(HERE,p).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)});}
await writeFile(path.join(HERE, 'ARTIFACTOS.json'),json({status:'LIVE_ARTIFACT_INVENTORY',created_at:new Date().toISOString(),freeze_sha256:sha(freezeBytes),preparation_unchanged:integrityErrors.length===0,files:inventory}),{flag:'wx'});
console.log(json({status:summary.status,successful:summary.successful,automatic_reviews:summary.automated_reviews,accounted_upper_usd:summary.accounted_upper_usd,modality,integrity_errors:integrityErrors}));
