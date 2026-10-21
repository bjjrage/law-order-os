import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = async p => JSON.parse(await readFile(path.join(HERE, p), 'utf8'));
const comparison = await read('COMPARACION_AUTOMATICA.json');
const reviews = await read('REVISION_COMPLETA_V2.json');
const byBlind = new Map(comparison.rows.map(r => [r.blind_id, r]));
const normalize = s => s.normalize('NFC').replace(/[*_`]/g, '').replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const quotes = [];
for (const g of reviews.grades) {
  const memo = await readFile(path.join(HERE, 'revision-ciega', g.blind_id + '.md'), 'utf8');
  for (const q of g.quote_checks ?? []) if (!q.literal) quotes.push({
    run_id: byBlind.get(g.blind_id).run_id, blind_id: g.blind_id, ...q,
    matches_after_format_only_normalization: normalize(memo).includes(normalize(q.quote)),
  });
}
const b = comparison.rows.find(r => r.run_id === 'P03-B-R2');
const c = comparison.rows.find(r => r.run_id === 'P03-C-R2');
const bg = reviews.grades.find(g => g.blind_id === b.blind_id);
const cg = reviews.grades.find(g => g.blind_id === c.blind_id);
const bm = await readFile(path.join(HERE, 'runs/P03-B-R2/MEMO.md'), 'utf8');
const cm = await readFile(path.join(HERE, 'runs/P03-C-R2/MEMO.md'), 'utf8');
const specific = /art[ií]culo\s+13\b|art\.\s*13\b|cierre del ejercicio|mismo valor fiscal/i;
const recovered = quotes.filter(q => q.matches_after_format_only_normalization).length;
const remaining = quotes.length - recovered;
const audit = {
  status: 'TECHNICAL_AND_CONSISTENCY_AUDIT_NOT_HUMAN_LEGAL_ADJUDICATION', at: new Date().toISOString(),
  all_second_pass_reviews_completed: reviews.successful === 18, raw_scores_preserved: true,
  no_memo_regenerated: true, blind_copies_byte_identical_to_originals: 18,
  quote_audit: { non_literal: quotes.length, format_only_matches: recovered, unverified_after_format_normalization: remaining, details: quotes },
  comparable_evaluator_criterion: {
    reference_id: 'P03-H07', source: 'F03-L00129-L00131, Ley 6380 artículo 13',
    B_run: 'P03-B-R2', B_reference_treatment: bg.reference_findings.find(f => f.reference_id === 'P03-H07'), B_explicit_specific_rule_text_detected: specific.test(bm),
    C_run: 'P03-C-R2', C_reference_treatment: cg.reference_findings.find(f => f.reference_id === 'P03-H07'),
    C_material_objection: cg.errors.find(e => e.explanation.includes('artículo 13')),
    C_explicit_specific_rule_text_detected: specific.test(cm),
    interpretation: 'The same omission reduces B reference coverage but is treated as a separate material objection without reducing C coverage. The one-point apparent C-vs-B coverage advantage is not robust to this grading inconsistency.',
  },
  initial_review_errors_preserved: 'AUDITORIA_EVALUADOR_PRIMER_PASE.json',
  human_legal_review: 'NOT_RUN', quality_superiority: 'NOT_ESTABLISHED',
};
await writeFile(path.join(HERE, 'AUDITORIA_EVALUADOR_SEGUNDO_PASE.json'), JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });

let report = await readFile(path.join(HERE, 'INFORME.md'), 'utf8');
const original = path.join(HERE, 'INFORME_AUTOMATICO_INICIAL.md');
try { await stat(original); } catch { await writeFile(original, report, { flag: 'wx' }); }
const old = 'El evaluador automático propone una señal favorable a C en cobertura de la referencia, sin más objeciones críticas en ese conteo. Esa señal requiere adjudicación humana; no demuestra superioridad jurídica ni ahorro de trabajo profesional.';
const revised = 'El resultado es mixto. C recibió mayor cobertura suficiente según el evaluador (42/42 frente a 41/42 de B y 38/42 de A), pero no hubo hallazgos de referencia completamente omitidos en ninguna modalidad: las diferencias fueron tratamientos parciales. C tuvo dos objeciones materiales propuestas frente a una de B. Además, la auditoría encontró una inconsistencia del evaluador que afecta precisamente la diferencia de un punto entre C y B. No corresponde declarar superioridad jurídica. C fue más rápido y barato que B en esta configuración; A fue más rápido que C con un costo de generación similar.';
if (!report.includes(old)) throw Error('REPORT_PARAGRAPH_NOT_FOUND');
const section = `## Auditoría de la comparación

La cobertura anterior conserva las notas automáticas sin corregirlas después de observar quién ganó. En P03-B-R2, el evaluador marcó P03-H07 como PARTIAL por no tratar el artículo 13 de la Ley 6380. En P03-C-R2 marcó el mismo hallazgo SUFFICIENT, pero agregó una objeción MATERIAL por omitir esa misma disposición. Los dos memos recibieron el mismo corpus. La ausencia de ese tratamiento específico se observa en ambos textos; no se explica por un cambio de fuentes. El artículo está en F03-L00129–F03-L00131. Este criterio aplicado de forma desigual vuelve frágil la aparente ventaja de un punto de C. Se requiere adjudicación, no cambiar silenciosamente la nota.

El segundo pase contiene ${quotes.length} citas que no coinciden literalmente con el memo. ${recovered} se recuperan al normalizar únicamente formato Markdown, comillas y espacios; ${remaining} siguen sin coincidencia bajo esa normalización. Eso no demuestra que cada valoración sea falsa, pero impide tratar todas sus citas como evidencia comprobada. Las observaciones del evaluador y su severidad siguen siendo propuestas.

La auditoría es técnica y de coherencia del evaluador, realizada por el asistente. No equivale a revisión de abogados. Los contadores de localizadores reconocen solo los identificadores completos de su gramática; un cero en ese contador no certifica que toda abreviación o cita normativa esté bien aplicada. Ver AUDITORIA_EVALUADOR_SEGUNDO_PASE.json.

`;
report = report.replace(old, revised).replace('## Resultados por ejecución\n', section + '## Resultados por ejecución\n');
await writeFile(path.join(HERE, 'INFORME.md'), report);
console.log(JSON.stringify({ raw_scores_preserved: true, quote_failures: quotes.length, format_recovered: recovered, unverified: remaining, B_rule_explicit: specific.test(bm), C_rule_explicit: specific.test(cm) }));
