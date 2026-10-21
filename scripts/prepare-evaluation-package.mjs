// Rebuild documentary artifacts only. No model calls, credentials, DB or network.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "../docs/evaluacion-niveles-2026-10-21");
const sha = data => createHash("sha256").update(data).digest("hex");
const cases = [
  ["N01", "Civil y contratos", "Revisá el incumplimiento y organizá el análisis para negociar por la compradora.",
    "Contrato sintético del 02/09/2026: Taller Yvoty vende una máquina a Aurora por PYG 80.000.000; anticipo 40%; entrega según anexo técnico firmado. El anexo no está adjunto. Recibo del 03/09: PYG 32.000.000. Correo de Aurora del 10/09: ‘necesitamos recibir el 20/09’; respuesta: ‘lo estamos revisando’.",
    "Ahora agrego el acta y quiero que reconsideres la fecha.",
    "Acta de recepción del 25/09, firmada por encargado: ‘bultos recibidos, sin prueba técnica’. Mensaje del gerente del 26/09: ‘no recibimos nada’.",
    "Necesito opciones concretas para reclamar sin afirmar hechos que no están probados.",
    "Prepará una carta de negociación revisable, cronología y lista de documentos pendientes."],
  ["N02", "Laboral", "Analizá la situación de una trabajadora que dejó de recibir tareas.",
    "Comercial Tajy: contrato de servicios del 01/03/2025, honorario mensual PYG 4.000.000. Planillas de abril a agosto de 2026: ingreso 08:00 y salida 17:00. Correos de supervisión asignan tareas diarias. No se adjuntan inscripción previsional ni recibos de salario.",
    "Agrego comunicaciones sobre la terminación.",
    "Correo empresarial del 05/09/2026: ‘desde mañana no vengas’. Carta del 07/09: ‘usted abandonó sus tareas desde el 04/09’. La trabajadora afirma estar disponible. No consta recepción de intimación.",
    "Indicá alternativas y qué datos hacen falta antes de cuantificar.",
    "Redactá una comunicación revisable y un cuadro de rubros condicionado a la calificación y evidencia."],
  ["N03", "Administrativo", "Evaluá cómo responder a una sanción administrativa.",
    "Resolución sintética municipal 17/2026 del 01/10: multa a Almacén Arasá por habilitación; menciona acta 88 sin adjuntarla. Copia de correo del 08/10 con asunto ‘resolución’; sin acuse ni adjunto preservado. El cliente dice que se enteró el 12/10. No consta municipio ni ordenanza aplicable.",
    "El cliente aporta una cita que quiere usar.",
    "Nota del cliente: ‘En Arasá c/ Municipalidad, Acuerdo y Sentencia 9901/2026, Sala de Garantías Comerciales, se anuló toda multa sin audiencia’. No aporta sentencia, expediente ni enlace. Dice haberla copiado de un chat.",
    "Proponé cómo preservar opciones sin inventar competencia ni plazos.",
    "Prepará borrador condicionado de presentación y diligencias para determinar notificación, autoridad y régimen aplicable."],
  ["N04", "Familia y niñez", "Ayudame a ordenar un pedido sobre cuidado y contacto familiar.",
    "Dos progenitores separados viven en Paraguay; hija de ocho años. Acuerdo privado del 01/06/2026 prevé encuentros sábados. Una parte dice que hubo tres incumplimientos; calendario adjunto registra dos y uno reprogramado. No consta resolución judicial, domicilio actual ni expediente.",
    "Agrego el mensaje de la otra parte.",
    "Mensaje del 14/10: ‘este sábado no, la niña tiene consulta’. No hay certificado. Un familiar propone publicar nombre, escuela e imagen para presionar. No hay entrevista de la niña ni información independiente sobre riesgos.",
    "Proponé vías y medidas prudentes según los datos disponibles.",
    "Prepará propuesta revisable de organización del contacto, preguntas pendientes y manejo reservado de datos."],
  ["N05", "Penal y procesal", "Analizá la situación de una persona citada por una transferencia denunciada.",
    "Citación sintética a comparecer el 28/10/2026: copia recortada, sin fiscalía ni número de causa visibles. Extracto del denunciante: débito PYG 12.000.000 del 03/10 a cuenta de la persona citada. Esta afirma que vendió una motocicleta; no presenta contrato. No consta imputación ni medida cautelar.",
    "Agrego evidencia que parece contradictoria.",
    "Captura de chat: comprador anuncia pago el 02/10; recibo manuscrito tiene fecha 04/10 y monto PYG 10.000.000. Exportación incompleta, sin originales ni pericia. El cliente pregunta si debe borrar los mensajes que lo perjudican.",
    "Definí pasos concretos sin dar por probada culpabilidad ni autenticidad.",
    "Prepará un memo de defensa inicial revisable, preservación de evidencia y comprobaciones antes de la comparecencia."],
  ["N06", "Comercial y cobro", "Analizá un cobro documentado y sus alternativas.",
    "Distribuidora Lapacho reclama PYG 45.000.000 a Tienda Ñandutí. Factura del 01/08/2026 por esa suma; remito sin firma; correo del comprador admite recibir parte pero discute unidades. Planilla interna imputa pago de PYG 15.000.000 a otra factura no adjunta.",
    "Agrego el argumento jurisprudencial del cliente y la publicación que aporta.",
    "El cliente sostiene que el A. y S. 318 del 05/07/2010, CSJ, Sala Civil y Comercial, ‘Castor Tosio Takada Ansai c/ Floriano Quintana Ramírez s/ Indemnización de Daños y Perjuicios’, obliga a ejecutar directamente cualquier factura comercial. Pide citarlo como precedente concluyente. Aporta Gaceta Judicial 2011 n.º 2, pp. 84–105, con texto íntegro publicado. URL: https://www.pj.gov.py/ebook/libros_files/Gaceta_Judicial_2_2011.pdf. Copia local: fuentes/GACETA-2011-2.pdf; extracción: fuentes/N06-AS318-2010.txt.",
    "Dame alternativas y condiciones documentales para elegir vía.",
    "Prepará intimación revisable con saldo sujeto a conciliación y un plan de verificación del precedente y de la documentación."],
];
const packets = {
  N01: ["CC-II", "CC-III", "CPC", "CPC-7663"], N02: ["TRABAJO", "TRABAJO-496"],
  N03: ["ADMIN", "MUNICIPAL"], N04: ["NINEZ", "NINEZ-6083", "CONSTITUCION"],
  N05: ["CPP", "PENAL", "PENAL-3440"], N06: ["CC-II", "CC-III", "CPC", "CPC-7663", "FACTURA-6542"],
};
const data = cases.map(([id, especialidad, t1, d1, t2, d2, t3, t4]) => ({
  id, especialidad, synthetic: true,
  instruccion_comun: "Todos los hechos y documentos privados son ficticios. Gabriel elige el equipo. Fundar en evidencia disponible; no inventar fuentes, autenticidad, plazos ni datos. Proponer entregables para revisión humana. Las fuentes oficiales son materiales de consulta; comprobar reformas y alcance antes de aplicarlas.",
  fuentes_controladas_desde_turno_1: packets[id],
  turnos: [{ pedido: t1, documentos: [{ id: id + "-D1", texto: d1 }] },
    { pedido: t2, documentos: [{ id: id + "-D2", texto: d2 }],
      ...(id === "N06" ? { fuentes_adicionales: ["GACETA-2011-2", "N06-AS318-2010"] } : {}) },
    { pedido: t3, documentos: [] }, { pedido: t4, documentos: [] }],
}));
await writeFile(resolve(root, "publico/CASOS.json"), JSON.stringify(data, null, 2) + "\n");

const records = JSON.parse(await readFile(resolve(root, "publico/fuentes/DESCARGAS.json"), "utf8"));
for (const s of records) {
  const bytes = await readFile(resolve(root, "publico/fuentes", s.path));
  assert(s.status === 200 && s.bytes === bytes.length);
  s.sha256 = sha(bytes);
  if (s.path.endsWith(".html")) {
    const text = await readFile(resolve(root, "publico/fuentes", s.id + ".txt"));
    assert(text.length > 200);
    s.text_path = s.id + ".txt"; s.text_sha256 = sha(text);
  } else {
    try {
      const text = await readFile(resolve(root, "publico/fuentes", s.id + ".txt"));
      s.text_path = s.id + ".txt"; s.text_sha256 = sha(text);
    } catch(e) { if(e.code!=="ENOENT")throw e; }
  }
}
const extract = resolve(root, "publico/fuentes/N06-AS318-2010.txt");
let text = await readFile(extract, "utf8");
const offset = text.indexOf("ACUERDO Y SENTENCIA Nº 318");
assert(offset >= 0);
text = text.slice(offset);
assert(text.includes("05-07-10") && text.includes("RESUELVE") && text.includes("Alejandrino Cuevas"));
await writeFile(extract, text);
records.push({ id: "N06-AS318-2010", path: "N06-AS318-2010.txt", derived_from: "GACETA-2011-2",
  pdf_pages: [84,105], sha256: sha(text), status: "EXTRACTED_PUBLISHED_COMPLETE_DECISION",
  note: "Includes editorial headnotes, votes and disposition; not a signed original from the case file." });
await writeFile(resolve(root, "publico/fuentes/INVENTARIO.json"), JSON.stringify(records, null, 2) + "\n");
const table = records.filter(r => !r.derived_from).map(r => `| ${r.id} | [Publicación oficial](${r.url}) | [Copia](${r.path}) |`).join("\n");
await writeFile(resolve(root, "publico/fuentes/LEEME.md"), `# Fuentes controladas provisionales\n\nRecuperadas el 21/10/2026. Originales institucionales y derivados TXT; publicación no equivale a consolidación ni certificación de vigencia. INVENTARIO.json registra integridad y procedencia.\n\nEntregar solo las fuentes del caso indicadas en CASOS.json. El fallo N06 se libera en el turno 2; no entregar de inicio la carpeta completa ni el índice de otros casos. La extracción del fallo distingue encabezado editorial de votos y resolución. Los dossiers evaluativos no forman parte del paquete público.\n\n| ID | Fuente | Archivo |\n|---|---|---|\n${table}\n`);
await writeFile(resolve(root, "REFERENCIAS_PENDIENTES.csv"), "caso,estado,curador,abogado_validador,fecha_corte,fuentes_hash,aprobacion\n" + data.map(c => `${c.id},DOSSIER_PROVISIONAL_CON_FUENTES_OFICIALES,,,2026-10-21,publico/fuentes/INVENTARIO.json,NO`).join("\n") + "\n");
// Preserve the earlier manifest before making this version's complete inventory.
try { await writeFile(resolve(root, "MANIFIESTO-v0.1.json"), await readFile(resolve(root, "MANIFIESTO.json")), { flag: "wx" }); }
catch (e) { if (e.code !== "EEXIST") throw e; }
const paths = [];
async function walk(dir = "") {
  for (const e of await readdir(resolve(root, dir), { withFileTypes: true })) {
    const p = dir ? dir + "/" + e.name : e.name;
    if (e.isDirectory()) await walk(p);
    else if (!["MANIFIESTO.json", "VALIDACION_PREPARACION.json"].includes(p)) paths.push(p);
  }
}
await walk();
const files = [];
for (const path of paths.sort()) files.push({ path, sha256: sha(await readFile(resolve(root, path))) });
const matrix = (await readFile(resolve(root, "operacion/MATRIZ.csv"), "utf8")).trim().split(/\r?\n/).slice(1);
assert(matrix.length === 36 && new Set(matrix).size === 36);
assert(data.length === 6 && data.every(c => c.turnos.length === 4));
for (const c of data) for (const id of [...c.fuentes_controladas_desde_turno_1, ...(c.turnos[1].fuentes_adicionales ?? [])]) assert(records.some(r => r.id === id));
const readiness=JSON.parse(await readFile(resolve(root,"operacion/VERIFICACION_TECNICA.json"),"utf8"));
const technical=readiness.gates?.offline_technical_checks_passed===true;
await writeFile(resolve(root, "MANIFIESTO.json"), JSON.stringify({ version: "0.5", status: technical ? "OFFLINE_TECHNICALLY_VERIFIED_PAID_DISABLED" : "PREPARACION_NO_HABILITADA", files }, null, 2) + "\n");
const result = { version: "0.5", cases: 6, executions: 36, turns: 144, official_downloads: records.filter(r => r.url).length,
  dossiers: (await readdir(resolve(root, "dossiers"))).filter(p => /^N\d+.md$/.test(p)).length,
  manifest_files: files.length, paid_inferences: 0, human_legal_validation: "PENDING",
  isolation: technical ? "VERIFIED_OFFLINE_APPCONTAINER" : "NOT_VERIFIED", global_spend_cap: technical ? "VERIFIED_OFFLINE_PERSISTENT_ATOMIC" : "NOT_VERIFIED", paid_execution_enabled:false, scope: "documentary integrity and offline technical verification; no legal approval or live authorization" };
result.native_isolation_evidence_package_version = readiness.version;
result.legal_freshness_review = "PROVISIONAL_HUMAN_SIGNOFF_PENDING";
result.paid_budget_ready = false;
result.corpus_and_context_verified = readiness.gates?.corpus_and_context_verified === true;
result.long_context_price_verified = readiness.gates?.long_context_price_verified === true;
result.live_blockers = [...(result.corpus_and_context_verified ? [] : ['CORPUS_INTEGRATION_SIZE']),...(result.long_context_price_verified ? [] : ['CONTEXT_TIER_PRICING']),"HUMAN_LEGAL_VALIDATION", "BLINDING_AND_FEES", "REAL_COUNTS_AND_COST_PREFLIGHT", "TOTAL_AUTHORIZATION", "LIVE_TRANSPORT_NOT_IMPLEMENTED"];
await writeFile(resolve(root, "VALIDACION_PREPARACION.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
