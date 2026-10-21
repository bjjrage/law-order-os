import { routeContractEvidence, type PilotEvidence } from './contractual-pilot.js';

type Passage = ReturnType<typeof routeContractEvidence>[number];
export type DocumentaryMatrix = { tool_id: string; columns: string[]; rows: Array<{ cells: string[]; evidence: Passage }>; limits: string[] };
const dates = (text: string) => [...text.matchAll(/\b\d{4}-\d{2}(?:-\d{2})?\b/gu)].map(m => m[0]).join(', ') || 'Fecha no localizada';
const amounts = (text: string) => [...text.matchAll(/\b(?:PYG|USD)\s*[\d.,]+/giu)].map(m => m[0]).join(', ') || 'Importe no localizado';
const stance = (text: string) => /niega|no consta|contradice|descarta|salvo|excepto/iu.test(text) ? 'Posible contraevidencia o excepción; requiere lectura contextual' : /alega|denuncia|imputa|hip[oó]tesis/iu.test(text) ? 'Alegación o hipótesis; no hecho probado' : 'Mención documental; fuerza probatoria pendiente';
const registry: Record<string, { tool: string; columns: string[]; match: RegExp; cells: (line: Passage) => string[]; limits: string[] }> = {
  valeria: { tool: 'corporate_authority_dependencies_v1', columns: ['Acto o facultad mencionada', 'Instrumento', 'Dependencia pendiente'], match: /represent|poder|acta|socied|directori|asamblea|facultad|accion/iu, cells: l => [l.quote, /poder/iu.test(l.quote) ? 'Mención de poder; original por cotejar' : /acta|asamblea/iu.test(l.quote) ? 'Mención de acto societario; aprobación por cotejar' : 'Instrumento no identificado', 'Confirmar sujeto, vigencia, autorización y facultades específicas'], limits: ['La mención de representación no prueba facultades ni aprobación societaria.'] },
  lucia: { tool: 'labor_timeline_evidence_v1', columns: ['Fecha o período', 'Hecho alegado o mención', 'Naturaleza y respaldo'], match: /\d{4}-\d{2}-\d{2}|trabaj|salari|emplead|despid|horario|antig[uü]edad/iu, cells: l => [dates(l.quote), l.quote, stance(l.quote)], limits: ['Ordenar fechas no acredita relación, antigüedad o despido. No se calculan indemnizaciones.'] },
  martin: { tool: 'tax_operation_period_matrix_v1', columns: ['Operación u obligación mencionada', 'Período localizado', 'Importe textual', 'Conciliación pendiente'], match: /\d{4}-\d{2}|PYG|USD|impuest|tribut|per[ií]odo|factur|IVA|aduan/iu, cells: l => [l.quote, dates(l.quote), amounts(l.quote), 'Cotejar operación, comprobante, régimen y vigencia; no calcular deuda'], limits: ['Sin régimen, parámetros y fórmula aprobados no se aplica ningún cálculo tributario.'] },
  diego: { tool: 'penal_hypothesis_counterevidence_v1', columns: ['Hipótesis, elemento o garantía mencionados', 'Posición documental', 'Inferencia permitida'], match: /alega|denunci|imput|evidencia|testigo|niega|contradic|garant[ií]a|hip[oó]tesis/iu, cells: l => [l.quote, stance(l.quote), 'Solo registrar el contenido; identidad, corroboración y elemento jurídico pendientes'], limits: ['No completar hechos, inferir dolo, responsabilidad ni tipicidad desde una mención.'] },
  camila: { tool: 'public_act_procedure_matrix_v1', columns: ['Acto o actuación mencionada', 'Fecha', 'Etapa o requisito por cotejar'], match: /resoluci|acto|competencia|notifica|procedimiento|expediente|recurso|autoridad/iu, cells: l => [l.quote, dates(l.quote), /notifica/iu.test(l.quote) ? 'Notificación: destinatario, medio y constancia pendientes' : /competencia|autoridad/iu.test(l.quote) ? 'Competencia: norma atributiva y delegación pendientes' : 'Acto, procedimiento y fundamento pendientes de cotejo'], limits: ['No declarar competencia, nulidad ni vencimiento de recursos sin fuentes y constancias.'] },
};
export function executeDocumentaryTool(persona: string, evidence: PilotEvidence[]): DocumentaryMatrix {
  const entry = registry[persona];
  if (!entry) throw Error('TEAM_TOOL_NOT_ALLOWED');
  let lines = routeContractEvidence(evidence).filter(line => entry.match.test(line.quote));
  if (persona === 'lucia') lines = lines.slice().sort((a, b) => dates(a.quote).localeCompare(dates(b.quote)) || a.document_id.localeCompare(b.document_id) || a.start - b.start);
  return { tool_id: entry.tool, columns: entry.columns, rows: lines.map(line => ({ cells: entry.cells(line), evidence: line })), limits: entry.limits };
}
