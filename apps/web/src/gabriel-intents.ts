export const destinations = {
  dashboard: {
    label: "Dashboard",
    description: "Resumen del estudio y accesos a tus asuntos abiertos.",
  },
  day: {
    label: "Mi día",
    description: "Tus tareas, vencimientos internos y revisiones pendientes.",
  },
  clients: {
    label: "Clientes",
    description:
      "Directorio de personas y organizaciones. Abrí un cliente para ver sus asuntos.",
  },
  matters: {
    label: "Asuntos",
    description:
      "Cada caso reúne documentos, equipo jurídico, borradores, tareas y revisiones.",
  },
  agenda: {
    label: "Agenda",
    description:
      "Citas y reuniones con clientes, horarios y profesionales responsables.",
  },
  deadlines: {
    label: "Tareas y plazos",
    description:
      "Encargos del equipo, plazos judiciales y contractuales, origen, avisos y seguimiento.",
  },
  finance: {
    label: "Finanzas",
    description:
      "Administración del Director: cuentas por cobrar, facturas por pagar, presupuestos y honorarios.",
  },
  admission: {
    label: "Admisión y conflictos",
    description:
      "Registrar encargos, partes y decisión del Director sobre conflictos; se accede desde Clientes.",
  },
  work: {
    label: "Trabajo jurídico",
    description:
      "Bandeja de encargos, borradores y revisiones humanas de los asuntos a los que tenés acceso.",
  },
  team: {
    label: "Equipo jurídico",
    description:
      "Presentación de Gabriel, los seis especialistas y Santiago: sus áreas, funciones y cómo delibera la Junta. Los análisis de cada asunto se trabajan en Consulta jurídica; las preguntas generales las respondemos acá.",
  },
  library: {
    label: "Biblioteca jurídica",
    description:
      "Buscá normas y jurisprudencia disponibles. Un documento indexado todavía necesita cotejo jurídico.",
  },
  admin: {
    label: "Administración",
    description: "Configuración del estudio, perfiles y permisos.",
  },
} as const;
export type Destination = keyof typeof destinations;
export type GabrielIntent =
  | { kind: "navigate" | "help"; destination: Destination }
  | { kind: "team" }
  | { kind: "answer" };
export function classifyGabriel(text: string): GabrielIntent {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
  if (/^(?:gabriel[, ]+)?no\b/u.test(normalized)) return { kind: "answer" };
  const routes: [Destination, RegExp][] = [
    ["dashboard", /dashboard|panel principal|inicio/u],
    ["day", /mi dia/u],
    ["clients", /clientes/u],
    ["matters", /asuntos|casos/u],
    ["agenda", /agenda|calendario/u],
    ["deadlines", /plazos|vencimientos|tareas/u],
    ["finance", /finanzas|facturas|cobros|pagos|honorarios/u],
    ["admission", /admision|conflictos/u],
    ["team", /equipo juridico|junta juridica|especialistas/u],
    ["work", /trabajo juridico/u],
    ["library", /biblioteca/u],
    ["admin", /administracion|configuracion/u],
  ];
  const destination = routes.find(([, pattern]) =>
    pattern.test(normalized),
  )?.[0];
  if (
    destination &&
    /^(?:gabriel(?:a)?[, ]+)?(?:abre|abri|abrime|abrir|anda|ir|ve|lleva|llevame|mostra|mostrame|navega|quiero ir|vamos a)(?:\s|$)/u.test(
      normalized,
    )
  )
    return { kind: "navigate", destination };
  const help = normalized
    .match(
      /(?:que (?:es|son|hace)|para que (?:sirve|esta)|como (?:uso|funciona)) (.*)/u,
    )?.[1]
    ?.replace(/^(?:(?:el|la|los|las) |panel de |seccion de )+/u, "");
  const helpDestination =
    help &&
    routes.find(
      ([, pattern]) =>
        pattern.test(help) && (help.match(pattern)?.index ?? 99) === 0,
    )?.[0];
  if (helpDestination) return { kind: "help", destination: helpDestination };
  if (
    /(?:arma|armar|forma|formar|convoca|convocar|prepara|preparar).{0,30}(?:equipo|junta|analisis)|(?:quiero|necesito|vamos a|ayudame a) (?:analizar|revisar|redactar|elaborar|preparar un contrato)|analiza (?:este|un|el)/u.test(
      normalized,
    )
  )
    return { kind: "team" };
  return { kind: "answer" };
}
