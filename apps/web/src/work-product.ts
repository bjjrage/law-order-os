import type { TeamRun } from './specialist-engine.js';

export function buildWorkProduct(run: TeamRun, exampleIds: readonly string[] = []) {
  const question = run.config.question.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const drafting = /elabor|redact|prepar|borrador|confeccion/iu.test(question) && /contrat|convenio/iu.test(question);
  const candidates = run.evidence.filter(e => e.nature === 'DOCUMENT_TEXT' && /contrat|convenio/iu.test(e.title + '\n' + e.text));
  const source = candidates.sort((a, b) => Number(exampleIds.includes(a.document_id)) - Number(exampleIds.includes(b.document_id)) || b.text.length - a.text.length)[0];
  const decisions = drafting ? [
    'Confirmar las partes de este nuevo contrato y las facultades de sus representantes.',
    'Definir productos, especificaciones y anexos que integrarán el contrato.',
    'Confirmar precio, moneda y condiciones de pago.',
    'Acordar cantidades, órdenes de compra, plazos y lugar de entrega.',
    ...(/extranj|internacional|export/iu.test(question) ? ['Definir transporte, aduana, costos y riesgos de la operación internacional.', 'Definir ley aplicable, idioma y mecanismo de solución de controversias.'] : []),
    'Revisar las cláusulas de terminación, responsabilidad y garantías antes de aprobar.',
  ] : ['Determinar la versión documental que rige el encargo.', 'Resolver las observaciones con los documentos y anexos completos.', 'Cotejar las referencias pertinentes y aprobar el resultado humano.'];
  const observations = [...new Set(run.evidence.flatMap(e => e.extraction_warnings ?? []))];
  const findings = [...new Map(run.opinions.flatMap(o => o.findings).map(f => [f.issue + ':' + f.evidence.document_id + ':' + f.evidence.start, f])).values()];
  const review = findings.slice(0, 6).map((f, i) => `## ${i + 1}. ${f.issue}\n${f.interpretation}\n\nPasaje para cotejar: «${f.evidence.quote.slice(0, 350)}${f.evidence.quote.length > 350 ? '…' : ''}»`).join('\n\n');
  return {
    drafting, source, decisions, observations, findings_count: findings.length,
    title: drafting ? 'Borrador contractual de trabajo' : 'Informe de revisión documental',
    content: drafting
      ? `# Borrador contractual de trabajo\n\nEstado: base documental editable, pendiente de adaptación y aprobación humana.\nEncargo: ${run.config.question}\n\n${source ? `Texto base: ${source.title}. Se conserva íntegro el texto extraído, incluidos los cambios marcados. No se han adaptado automáticamente las partes ni las condiciones al nuevo encargo.\n\n## Texto contractual para trabajar\n\n${source.text}` : 'Sin contrato base identificado. Este esquema requiere completar sus cláusulas.\n\n## Partes\n[COMPLETAR]\n\n## Objeto y especificaciones\n[COMPLETAR]\n\n## Precio y pago\n[COMPLETAR]\n\n## Entregas\n[COMPLETAR]\n\n## Condiciones y anexos\n[COMPLETAR]'}`
      : `# Informe de revisión documental\n\nEncargo: ${run.config.question}\n\nEstado: revisión documental local; pendiente de criterio y aprobación humana.\n\n## Resultado de la revisión\n${findings.length} observaciones localizadas en ${run.evidence.length} documentos. Se presentan hasta seis cuestiones para empezar la revisión; el respaldo completo queda en la revisión interna.\n\n${review || 'No se localizaron pasajes suficientes para sostener una conclusión sobre este encargo.'}\n\n## Próximas acciones\n${decisions.map(d => '- ' + d).join('\n')}`,
  };
}
