export type CitationReview={completed:boolean;detected_mentions:number;identified_references:number;unresolved_mentions:string[];verified_references:number;observations:Array<{reason:string;identity_status:string;quote_status:string}>};
export type ReviewFinding={statement:string;recommended_action:string;severity?:string;type?:string};
export type LawyerReview={audit:{findings:ReviewFinding[];citation_objections?:string[];unsupported_fact_flags?:string[];missing_evidence_flags?:string[];audit_status?:string}|null;citation_review?:CitationReview};
export function lawyerText(text:string){
  return text
    .replace(/\bUNKNOWN\b/g,'contenido sin verificar')
    .replace(/\bDOCUMENT_CONTENT\b/g,'contenido documental')
    .replace(/\bMODEL_INFERENCE\b/g,'inferencia del análisis')
    .replace(/\bPARTY_ALLEGATION\b/g,'afirmación de una parte')
    .replace(/\bPRIVATE_MATTER\b/g,'documentación del asunto')
    .replace(/\bUNVERIFIED\b/g,'sin verificar')
    .replace(/\bPASS_IN_SCOPE\b/g,'comprobación limitada a los documentos consultados')
    .replace(/\bREVIEW_REQUIRED\b/g,'requiere revisión')
    .replace(/\bchecker\b/gi,'verificador de citas')
    .replace(/\bcorpus normativo oficial\b/gi,'fuentes normativas oficiales')
    .replace(/\bcorpus (?:autorizado|consultado|disponible)\b/gi,'documentación consultada')
    .replace(/\bsnapshot\b/gi,'versión de los documentos consultados')
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:p\d+\b/gi,'referencia del expediente');
}
const errors:Record<string,string>={
  LIBRARY_SEARCH_UNAVAILABLE:'No se pudo consultar el índice de la Biblioteca. La consulta no se ejecutó; revisá la disponibilidad de los textos antes de volver a intentar.',
  BUDGET_EXHAUSTED:'Se alcanzó el límite de gasto autorizado. Conservamos la respuesta disponible.',
  STAGE_TIMEOUT:'Una tarea no terminó a tiempo. Revisá el resultado guardado antes de iniciar otra consulta.',
  CANCELLED:'La consulta se interrumpió. Conservamos el trabajo recibido.',
  RUN_INTERRUPTED_NO_AUTOMATIC_REPLAY:'La consulta se interrumpió. El trabajo recibido quedó guardado; no se repitieron tareas con costo.',
  RUN_ALREADY_STARTED_NO_AUTOMATIC_REPLAY:'Esta consulta ya fue iniciada. Actualizá el resultado para evitar repetirla.',
  ALLEGATION_PROMOTED_TO_FACT:'Una afirmación del relato fue tratada con una certeza que los documentos no respaldan. El informe requiere revisión.',
  INVALID_PROVENANCE:'No se pudo vincular una afirmación con el documento que la respalda.',
  MISSING_PROVENANCE:'El contexto incluyó una afirmación sin respaldo documental. La consulta se detuvo para conservarla como una cuestión pendiente, sin presentarla como un hecho.',
  PROVIDER_HTTP_503:'El proveedor no estuvo disponible en esa etapa. El borrador recibido se conservó; la revisión pendiente todavía no acredita su resultado.',
  REFERENCE_VERIFICATION_REQUIRED:'No fue posible comprobar una o más citas con la documentación disponible.',
  CITATION_EXTRACTION_REVIEW_REQUIRED:'Se encontró una posible referencia legal que no pudo identificarse con precisión. Requiere cotejo.',
  EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED:'Falta confirmar el gasto de esta consulta desde el botón Consultar Junta.',
  BROWSER_APPROVAL_NOT_ENABLED:'La consulta desde el navegador no está habilitada en este equipo.',
  PRICE_REVALIDATION_REQUIRED:'Es necesario actualizar las tarifas del servicio antes de iniciar otra consulta.',
  INVALID_INPUT:'Revisá que la pregunta sea concreta y que los documentos seleccionados puedan leerse.',
};
export function lawyerError(code:string|undefined){return errors[code??'']??(/^[A-Z0-9_]+$/.test(code??'')?'La consulta no pudo completarse. El resultado recibido requiere revisión.':lawyerText(code||'No se pudo completar la consulta.'));}
export function citationExplanation(review:CitationReview|undefined){
  if(!review?.completed)return 'La comprobación de citas todavía no tiene un resultado registrado.';
  if(review.detected_mentions===0&&review.identified_references===0)return 'No se identificaron citas concretas de leyes, decretos o decisiones judiciales para cotejar. Esto no acredita la corrección jurídica del informe.';
  if(review.identified_references===0)return `Se detectaron ${review.detected_mentions} menciones que podrían remitir a normas o decisiones judiciales, pero no se logró identificar una cita completa. Deben revisarse antes de usarlas.`;
  return `Se identificaron ${review.identified_references} referencias para cotejar con la documentación disponible. ${review.verified_references} pudieron comprobarse.${review.unresolved_mentions.length?' Quedaron '+review.unresolved_mentions.length+' menciones sin identificar con precisión.':''} La comprobación no certifica la vigencia ni garantiza que se hayan detectado todas las citas.`;
}
export function lawyerReviewSummary(r:LawyerReview){
  const findings=r.audit?.findings??[];
  return {reviewed:!!r.audit,factObservations:findings.filter(f=>f.type==='UNSUPPORTED_FACT'||f.type==='CONTRADICTION'),missingDocuments:findings.filter(f=>f.type==='MISSING_EVIDENCE'),referenceWarnings:findings.filter(f=>f.type==='SUSPICIOUS_CITATION'||f.type==='QUOTE_OBJECTION'),total:findings.length,citations:citationExplanation(r.citation_review)};
}
export function citationObservationText(o:CitationReview['observations'][number]){
  if(o.quote_status==='QUOTE_MISMATCH')return 'La transcripción citada no coincide con el texto que pudo consultarse.';
  if(['TEXT_UNAVAILABLE','EXTRACTION_UNCERTAIN'].includes(o.quote_status)&&o.identity_status==='VERIFIED_IDENTITY')return 'La referencia pudo identificarse, pero no se pudo comprobar la transcripción con un texto suficientemente legible.';
  return ({NOT_FOUND_IN_SCOPE:'La cita no se localizó en la documentación consultada; puede existir en otras fuentes.',SOURCE_UNAVAILABLE:'No se cuenta con un original validado para cotejar esta referencia.',INSUFFICIENT_IDENTITY:'Faltan datos para identificar con precisión la norma o decisión citada.',AMBIGUOUS:'Hay varias referencias posibles; falta determinar cuál es la citada.',METADATA_MISMATCH:'Los datos de la cita no coinciden con el documento consultado.'} as Record<string,string>)[o.identity_status]??'Esta referencia requiere un cotejo profesional.';
}
