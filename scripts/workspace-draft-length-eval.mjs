import { writeFile } from "node:fs/promises";
import { runWorkspaceAI } from "./workspace-ai.mjs";
if (!process.argv.includes("--live-synthetic"))
  throw Error("EXPLICIT_LIVE_SYNTHETIC_FLAG_REQUIRED_MAX_USD_0_10");
// No database, browser, uploaded document or real client information is read.
const clauses = [
  [
    "Objeto",
    "Alfa proveera cajas de carton a Beta segun ordenes de compra. Las especificaciones y cantidades se definiran por escrito en cada pedido.",
  ],
  [
    "Pedidos",
    "Las ordenes remitidas por Beta se incorporaran al contrato. No se ha precisado si Alfa debe aceptarlas ni que ocurre ante cambios posteriores.",
  ],
  [
    "Precio",
    "El precio de cien unidades monetarias por caja presupone un volumen anual de cinco mil cajas. No existe una obligacion expresa de adquirir ese volumen.",
  ],
  [
    "Pago",
    "El pago se efectuara a los treinta dias de la entrega de cada pedido. No se ha precisado como se discutiran importes ni cuales importes continuaran exigibles.",
  ],
  [
    "Entrega",
    "Las fechas de entrega constaran en la orden. Debe distinguirse demora atribuible al proveedor de cambios o falta de informacion de la compradora.",
  ],
  [
    "Inspeccion",
    "Beta podra formular observaciones en cuarenta y ocho horas. La reposicion se solicita dentro de las veinticuatro horas de la notificacion, sin procedimiento de verificacion acordado.",
  ],
  [
    "Responsabilidad",
    "Alfa responde por incumplimientos demostrados. Las partes no han acordado un limite global ni una distincion entre danos directos e indirectos.",
  ],
  [
    "Terminacion",
    "Beta puede terminar mediante aviso previo de treinta dias. No se ha precisado el tratamiento de ordenes ya aceptadas, materias primas ni productos fabricados.",
  ],
  [
    "Notificaciones",
    "Los avisos se remitiran a las direcciones que las partes confirmen por escrito. No existe aun un domicilio electronico confirmado.",
  ],
  [
    "Homologacion",
    "El comienzo de las entregas requiere conformidad de las muestras. Las partes deben documentar criterios objetivos y decisiones de aprobacion.",
  ],
  [
    "Fuerza mayor",
    "La parte afectada informara el hecho y sus efectos, aportara respaldo y tomara medidas razonables para reducir el impacto.",
  ],
  [
    "Solucion de diferencias",
    "Las partes procuraran resolver las diferencias mediante intercambio de antecedentes, sin afirmar plazos ni sedes no acordadas.",
  ],
];
let text =
  "CONTRATO ENTERAMENTE FICTICIO. Alfa y Beta son partes inventadas para una prueba tecnica.\n";
for (let round = 0; text.length < 21000; round++) {
  for (const [index, [title, clause]] of clauses.entries()) {
    text += `\nSeccion ${round + 1}.${index + 1}: ${title}\n${clause} Esta seccion trata exclusivamente el pedido identificado como LOTE-${round + 1}-${index + 1}. Los datos de cada lote deben confirmarse por ambas partes. Ninguna mencion de un antecedente constituye prueba de cumplimiento.\n`;
  }
}
const job = {
  request: {
    action: "REWRITE",
    agent_id: "valeria",
    workflow_version: 3,
    instruction:
      "Preparar una version revisable del contrato completo desde la perspectiva de Alfa como proveedor. Conservar nombres, precios, fechas, cantidades y condiciones existentes. Resolver la redaccion de pedidos, volumen y precios, recepcion, responsabilidad y terminacion sin inventar acuerdos. Marcar alternativas comerciales pendientes para confirmacion, sin afirmar que fueron aceptadas. No certificar ni aplicar cambios.",
    execution_mode: "LIVE",
    authorize_paid_calls: true,
    include_library: false,
    max_cost_usd: 0.6,
  },
  context: {
    text,
    quote: text,
    from: 0,
    to: text.length,
    title: "Ensayo sintetico de longitud",
    matter_title: "FICTICIO",
    generated_from_director: true,
  },
};
const trace = [];
let posts = 0;
try {
  const result = await runWorkspaceAI(
    process.cwd(),
    job,
    async (url, init) => {
      if (init.method === "POST" && ++posts > 8) throw Error("TEST_CALL_LIMIT");
      const response = await fetch(url, init);
      if (init.method === "POST") {
        const body = JSON.parse(init.body),
          raw = await response.clone().json();
        trace.push({
          max_output_tokens: body.max_output_tokens,
          status: raw.status,
          incomplete_reason: raw.incomplete_details?.reason ?? null,
          usage: raw.usage,
          output_chars: (raw.output ?? [])
            .flatMap((m) => m.content ?? [])
            .filter((p) => p.type === "output_text")
            .reduce((n, p) => n + (p.text?.length ?? 0), 0),
        });
      }
      return response;
    },
    undefined,
    0.1,
  );
  const markers = [...new Set(text.match(/LOTE-\d+-\d+/g) ?? [])];
  const missingMarkers = markers.filter(
    (m) => !result.replacement_text?.includes(m),
  );
  const report = {
    status: "COMPLETED",
    source_chars: text.length,
    result_chars: result.replacement_text?.length,
    source_markers: markers.length,
    missing_markers: missingMarkers.length,
    trace,
    private_documents_sent: 0,
    documents_modified: 0,
    max_cost_usd: 0.1,
  };
  await writeFile(
    ".local-dev/draft-length-" +
      (process.argv.includes("--baseline") ? "baseline" : "current") +
      ".json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (missingMarkers.length) process.exitCode = 1;
} catch (e) {
  const report = {
    status: "FAILED",
    code: e.message,
    source_chars: text.length,
    trace,
    private_documents_sent: 0,
    documents_modified: 0,
    max_cost_usd: 0.1,
  };
  await writeFile(
    ".local-dev/draft-length-" +
      (process.argv.includes("--baseline") ? "baseline" : "current") +
      ".json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  process.exitCode = 1;
}
