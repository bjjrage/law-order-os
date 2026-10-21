# LAW & ORDER OS
## BLUEPRINT MAESTRO CANÓNICO · V2.0

**13 de octubre de 2026 · Paraguay · Diseño del producto completo + reconciliación con Fase 2**

**Estado documental: listo para revisión/aprobación de producto; NO equivale a certificación de producción.** Este documento sustituye el diseño de la Junta y los estados desactualizados del blueprint v1.1. El v1.1 queda preservado, no se borra ni modifica. **El stack productivo, la identidad del estudio piloto y las condiciones comerciales no están aprobados**.

> **Identidad:** LAW & ORDER OS es el sistema operativo integral de un estudio jurídico: personas, asuntos, documentos, trabajo del equipo, investigación, escritos, agenda, comunicaciones y administración. No es solo un chatbot o base jurisprudencial. El abogado decide en derecho. El checker verifica la autenticidad bibliográfica de las referencias utilizadas por la IA; no decide si el dictamen es jurídicamente correcto.

## 01. Gobierno, precedencia y estado verificado

### Precedencia documental

1. Instrucciones y decisiones expresas recientes del propietario del proyecto.
2. ADR de Junta V2 y los contratos efectivamente implementados, dentro del alcance aprobado.
3. Fuente de código local como prueba de implementación (no de decisiones de producto).
4. Este Blueprint V2 y Roadmap V2 después de su aprobación, para el alcance completo del OS.
5. Blueprint/Roadmap v1.1 como referencia histórica, especialmente para módulos operativos no reemplazados.
6. Informes de Codex como evidencia reportada, sujetos a reproducción independiente.

**No inventar continuidad:** La Junta V2 propia sustituye la clonación de Mussi y la topología 3→2→1. El `ADR OS-001` está pendiente: no elegir backend, base de datos, autentificación, hosting, región ni framework definitivo por inferencia. No iniciar migraciones o despliegues productivos sin aprobación.

### Reporte de estado al 13/10/2026

| Componente | Estado sustentado | Evidencia disponible / límite |
|---|---|---|
| Junta Jurídica V2, orquestador y contratos | **IMPLEMENTED / TESTED_OFFLINE reportado** | Informe Fase 2; código local de esa fase no adjunto aquí. |
| Pruebas integradas | **271/271 PASS reportado** | Typecheck y dos builds PASS reportados; no certificación externa. |
| Checker/citación | **Extracción 11/12; FAIL conocido** | Detección 12/12, una cita con número escrito en palabras queda pendiente; no ocultar. |
| Corpus de jurisprudencia | **3 originales obtenidos, alcance limitado** | Constitucional A&S 1010/2015 (13 pp), Civil A&S 1184/2013 (29 pp), Penal A&S 162/2023 (7 pp). No es corpus completo ni autenticación cerrada. |
| Fact Checker contra documentos oficiales | **BLOCKED** | Política de confianza institucional, verificador y curaduría jurídica externa pendientes. |
| Jev/Luna/Sol/Gemini con cuentas reales | **NOT_RUN/BLOCKED** | Google GET devolvió 401; Jev/OpenAI sin claves verificadas. USD 0 gastados en inferencia. |
| OS Core de dominio y servicio | **IMPLEMENTED / TESTED_OFFLINE reportado** | 42 pruebas del núcleo de dominio; E2E sintético de 14 pasos. |
| App web navegable | **NO ACREDITADA / PENDIENTE** | No se reporta frontend real, login empresarial ni persistencia productiva. |
| Autenticación, persistencia y permisos en infraestructura real | **BLOCKED — ADR OS-001 PENDING** | Servicio con denegación por defecto y adaptadores de prueba; no prueba de sesiones durables ni RLS en base real. |
| Git, CI y despliegues | **NO INICIADO / NO DEPLOY** | No existe Git en carpeta reportada; baseline de 76 archivos y manifiestos preservados. |

**Clasificación obligatoria:** `DECIDED`, `PROPOSED`, `IMPLEMENTED`, `TESTED_OFFLINE`, `VERIFIED_REAL`, `BLOCKED`, `NOT_RUN`, `FAIL`. No convertir pruebas con mocks en validación productiva. El documento está construido a partir de v1.1 y el informe de Fase 2 suministrado; los reportes complementarios como `OS_CORE_ARCHITECTURE.md` no fueron adjuntados a esta revisión y deben contrastarse localmente.

## 02. Objetivo y decisiones no negociables

**Decisiones expresas:** OS real para estudios paraguayos; cada abogado con panel y permisos; gestionar la operativa completa; UI compacta; Junta propia **Jev → Luna → GPT-6.1 Sol Medium → Gemini 3.8 Flash → checker determinístico → revisión humana**; RAG jurídico fundamental; no clonar Mussi; no usar Haiku como auditor en esta fase.

| ID | Invariante / decisión | Consecuencia |
|---|---|---|
| INV-01 | OS completo, no chatbot | El roadmap mantiene clientes, tareas, documentos, agenda, honorarios y cobros. |
| INV-02 | El **asunto** es el ámbito de trabajo; procedimiento/expediente es entidad distinta | Un asunto consultivo puede existir sin juicio; un asunto puede tener varios procedimientos. |
| INV-03 | Cada abogado tiene un panel compacto de trabajo | Mostrar acciones reales y pendientes, no KPIs gigantes decorativos. |
| INV-04 | Junta jurídica **propia**, secuencia Jev/Luna/Sol/Gemini/checker | Sustituye la clonación de Mussi 3→2→1. No reintroducirla. |
| INV-05 | Sol usa `reasoning_effort=medium` | Controlar tokens/herramientas desde el orquestador; no fiar el costo a la etiqueta Medium. |
| INV-06 | Jev prioriza; no borra ni descarta irreversiblemente | El RAG y los originales siguen recuperables. |
| INV-07 | Luna estructura contexto referenciado, no reemplaza el expediente | Sol/Gemini pueden pedir originales acotados. |
| INV-08 | Gemini audita adversarialmente; checker es determinístico y bibliográfico | El consenso LLM no concede identidad verificada. |
| INV-09 | Problema controlado: jurisprudencia falsa usada como fundamento | No sustituir métrica por “predice sentencia” o “acierta el veredicto”. |
| INV-10 | Decisión jurídica final del abogado humano | Documento y análisis entregables requieren revisión/aprobación explícita según flujo. |
| INV-11 | No gastos IA, scraping masivo, emails, despliegues ni migraciones de producción sin aprobación | Smoke pagado permanece NOT_RUN y sujeto a presupuesto. |
| INV-12 | El OS funciona sin LLMs | Tareas, permisos, clientes, documentos y cobros no dependen de proveedores de inferencia. |
| INV-13 | Mocks, datos sintéticos y adaptadores de memoria no son solución productiva | Separación estricta de estados y evidencias. |
| INV-14 | UI desktop-first **extremadamente compacta** (criterio visual ~85% zoom) | Tipografías, densidad, tablas y tarjetas deben someterse a QA visual. |

**Alcance territorial inicial:** Paraguay. Sala Constitucional, Sala Civil y Comercial, Sala Penal, Constitución, códigos y legislación. El corpus actual de tres PDFs no acredita cobertura. El despliegue regional queda posterior y separado.

**No promesas:** ni ausencia absoluta de alucinaciones, ni certeza legal automática, ni fallos futuros predictivos, ni IA “ilimitada” comercial por una suscripción personal sin acuerdo contractual. No fijar precio definitivo sin benchmark de costos/uso.

## 03. Arquitectura funcional del OS

**PROPUESTO V2 / HEREDADO DE V1.1 — sujeto a aprobación de detalle.** La unidad de trabajo central es el **asunto**, no el chat. Un cliente puede tener múltiples asuntos; un asunto puede estar relacionado con varios clientes o partes y contener cero, uno o varios procedimientos o expedientes judiciales/administrativos. Un encargo contractual o de asesoría no necesita un expediente judicial ficticio.

### Cadena operativa

Consulta entrante → revisión de aceptación y conflictos → propuesta/encargo → apertura de asunto → equipo y plan de trabajo → documentos y evidencia → investigación/Junta → producción → revisión y aprobación → entrega o presentación acreditada → seguimiento → facturación/cobro → cierre y archivo.

No todos los asuntos recorren exactamente los mismos estados. Las plantillas de flujo pueden variar por especialidad, pero no deben borrar responsabilidades, controles de versión o evidencia de las operaciones realizadas.

### Navegación de producto propuesta

| Espacio principal | Trabajo que concentra |
|---|---|
| **Mi día** | Atención personal: tareas, revisiones, citas, vencimientos confirmados, documentación nueva y bloqueos. |
| **Asuntos** | Equipo, partes, documentos, actividad, Junta, escritos y economía de cada encargo. |
| **Clientes** | Contactos, captación, propuestas, solicitudes y relación histórica autorizada. |
| **Agenda** | Eventos, audiencias, fechas internas, vencimientos y responsables. |
| **Trabajo jurídico** | Investigaciones y documentos; siempre vinculables a un asunto o a una investigación interna autorizada. |
| **Administración** | Acuerdos económicos, tiempo, gastos, anticipos, facturación y cobros. |
| **Dirección** | Carga, pendientes, indicadores operativos y económicos con datos verificables. |

La biblioteca, configuración y fuentes pueden vivir en navegación secundaria. Evitar una barra principal interminable. Abrir una tarea debe llevar al documento, comunicación o punto del asunto correspondiente, sin obligar a reconstruir el contexto desde cero.

**La aplicación debe seguir funcionando cuando la IA esté indisponible:** agenda, documentos, permisos, tareas, clientes y cobros no dependen de una respuesta LLM.

## 04. Roles, paneles y acceso

**PROPUESTO V2 / HEREDADO DE V1.1 — sujeto a aprobación de detalle.** El rol define capacidades posibles; la asignación al estudio y al asunto delimita dónde se pueden usar. Ocultar un botón no constituye autorización. Las reglas deben aplicarse a API, consultas, archivos, exportaciones, búsquedas, trabajos en background y contexto IA.

| Perfil | Panel de inicio | Capacidades propuestas | Límites por defecto |
|---|---|---|---|
| Socio/director | Trabajo del equipo, asuntos sin próxima acción, aprobaciones y estado económico | Asignar, supervisar, aprobar según política y gestionar cartera | No acceso irrestricto a asuntos reservados por el solo título; acceso explícito y auditado. |
| Abogado responsable | Sus entregas, plazos, nueva información y bloqueos | Gestionar asuntos asignados, convocar Junta, preparar y aprobar dentro de su autoridad | Sin acceso a otros equipos/asuntos fuera de su ámbito. |
| Abogado colaborador | Producción y revisiones asignadas | Investigar, redactar, comentar y proponer cambios | Aprobación externa solo con permiso concedido. |
| Asistente/procurador | Gestiones y documentos faltantes | Organizar documentación, registrar actuaciones y comprobantes | No aprobar análisis jurídico ni modificar condiciones económicas salvo permiso. |
| Administración | Facturación, cobros, gastos y rendiciones | Operaciones económicas autorizadas y datos necesarios | No acceso automático al contenido jurídico reservado. |
| Cliente externo | Sus solicitudes, citas, entregables y estado de cuenta | Aportar documentos y ver lo compartido | Nunca recibe debate interno, borradores privados o documentos de otros clientes por defecto. |
| Administrador técnico | Usuarios, políticas, integraciones y estado del servicio | Operar configuración y soporte | Acceso al contenido sujeto a política explícita; soporte excepcional temporal, justificado y auditado. |

### Reglas transversales

El acceso se deniega por defecto. Toda entidad privada lleva identificación del estudio; las relaciones no pueden cruzar estudios por un ID recibido del navegador. Los documentos públicos del corpus y los privados se almacenan e indexan con ámbitos distintos. La revocación debe alcanzar enlaces, búsquedas y trabajos en curso, no solo la pantalla.

El portal de cliente se basa en **versiones compartidas explícitamente**, no en “mostrar siempre la última versión”. Un documento posterior interno no se vuelve público por actualizarse el original. Los resultados agregados de Dirección tampoco deben revelar asuntos reservados a usuarios sin autorización.

**DONE de acceso:** pruebas negativas entre dos estudios, entre asuntos del mismo estudio y entre roles internos/cliente; ningún texto privado aparece en búsqueda, cita, log o exportación fuera de su ámbito.

## 05. Módulos y criterios funcionales

Los módulos siguientes forman la visión del OS. Las fases de construcción no autorizan a reducir el producto a una consulta IA.

| ID | Módulo | Capacidad concreta | Criterio de aceptación propuesto |
|---|---|---|---|
| OS-01 | Captación e intake | Consulta, entrevista, documentación inicial y seguimiento | Una consulta puede convertirse en asunto sin duplicar persona ni perder archivos; aceptación registrada. |
| OS-02 | Revisión de conflictos | Coincidencias de partes/contactos y revisión humana | Una coincidencia se muestra como alerta, no como dictamen; búsqueda limitada a datos accesibles y política del estudio. |
| OS-03 | Encargo y propuesta | Alcance, responsables, acuerdo económico y aceptación | Condiciones aceptadas versionadas; no se factura por un acuerdo posterior no aprobado. |
| OS-04 | Asuntos/procedimientos | Estado, equipo, partes y expedientes relacionados | Un asunto asesor sin juicio y un asunto con dos procedimientos funcionan sin artificios. |
| OS-05 | Mi día y equipo | Pendientes, bloqueos, revisiones y reasignaciones | Toda tarjeta abre la tarea real y conserva un responsable; una sustitución mantiene historial. |
| OS-06 | Documentos y expediente | Originales, índice, anexos, versiones y exportaciones | Se puede reconstruir el paquete entregado; el original no se altera por reclasificación. |
| OS-07 | Investigación/Junta | Encargo delimitado, evidencia congelada y resultado | Se conserva el run, sus fuentes y etapas; no aparece resultado “verificado” por terminar llamadas. |
| OS-08 | Editor jurídico | Plantillas, secciones, cambios acotados y revisiones | Comparación de versiones; referencias revisadas contra la versión exportada. |
| OS-09 | Tareas y workflow | Dependencias, aprobaciones y alertas | Un evento repetido no crea dos tareas ni dos envíos; un bloqueo tiene causa y responsable. |
| OS-10 | Agenda y seguimiento | Citas, gestiones y vencimientos confirmados | Una fecha sugerida no se convierte en plazo validado; recordatorio y actividad son entidades distintas. |
| OS-11 | Comunicación y portal | Solicitudes, mensajes vinculados y entregas aprobadas | Cliente ve únicamente su versión compartida; evidencias de entrega no se infieren del borrador. |
| OS-12 | Honorarios y costos | Acuerdos, horas opcionales, gastos y anticipos | Importe, moneda y origen de cada movimiento; no mezclar dinero del cliente con ingreso del estudio. |
| OS-13 | Facturación y cobros | Pendientes, documentos económicos, pagos y aplicaciones | Facturado ≠ cobrado; anticipos aplicados una vez; integración fiscal no simulada como válida. |
| OS-14 | Dirección y cierre | Carga, saldos, costos, cierre/exportación/retención | Indicadores reconciliables; sin “rentabilidad exacta” cuando faltan costos. |

### Diseño de “Mi día”

La prioridad visual debe ser trabajo accionable, no gráficos decorativos. Mostrar primero vencimientos confirmados y entregas próximas, luego aprobaciones, documentación nueva y tareas bloqueadas. Ofrecer filtros por responsabilidad y equipo sin mezclar asuntos no autorizados. La explicación de por qué un elemento aparece como prioritario debe derivar de fechas y estado, no de una urgencia inventada por la IA.

### Contexto refinado para la producción

El abogado puede confirmar una ficha del asunto con cronología, documentos disponibles, afirmaciones del cliente, puntos controvertidos y datos faltantes. Esa ficha conserva vínculos con originales y versiones. Una corrección no borra el registro anterior ni se pierde dentro de un resumen narrativo viejo.

El editor usa plantillas y estilo aprobado del estudio; no “aprende” silenciosamente de documentos de otro cliente. Permite fijar secciones aprobadas y editar una sección sin regenerar todo. Una referencia modificada invalida su comprobación anterior; una nueva fecha exige revisión del contexto afectado, no una sustitución global ciega.

## 06. Datos y relaciones de dominio

**PROPUESTO V1 — modelo lógico, no migraciones aprobadas.** Los nombres siguientes identifican responsabilidades; su DDL, índices y tecnología se fijan después de elegir stack y revisar el motor existente.

| Grupo | Entidades lógicas | Relaciones y restricciones esenciales |
|---|---|---|
| Estudio y personas | `study`, `membership`, `role_grant`, `contact`, `client` | Usuario puede pertenecer a varios estudios con permisos distintos; no deduplicar datos personales entre tenants por inferencia. |
| Trabajo | `matter`, `matter_party`, `matter_membership`, `proceeding`, `engagement` | Matter aislado por estudio; múltiples partes y procedimientos; autorización por relación, no por conocer UUID. |
| Operación | `task`, `task_dependency`, `event`, `deadline`, `workflow_run` | Tarea, evento, plazo y recordatorio distintos; dependencias sin ciclos y dueño verificable. |
| Documentos | `document`, `document_version`, `attachment_link`, `review`, `approval`, `delivery`, `filing_receipt` | Aprobación y entrega referencian versión exacta; original y derivado separados; comprobante no inferido. |
| Contexto | `matter_snapshot`, `fact_record`, `context_link` | Hecho documental, afirmación e inferencia tipificados; edición versionada; no reconstruir snapshot pasado con datos actuales. |
| Inteligencia | `research_request`, `evidence_pack`, `board_run`, `board_stage`, `board_result`, `citation_check` | Cada run ligado a snapshot y versión de evidencia; etapas del workflow Jev/Luna/Sol/Gemini aisladas por snapshot y permisos. |
| Corpus público | `source_provider`, `source_item`, `source_version`, `passage`, `legal_relation`, `coverage_manifest` | Identidad oficial separada de ID interno; hash no sustituye procedencia; ausencia de fecha no se inventa. |
| Economía | `fee_agreement`, `time_entry`, `expense`, `invoice`, `payment`, `allocation`, `ledger_entry` | Importes exactos y moneda; reversos trazables; aplicaciones atómicas para impedir doble cobro/aplicación. |
| Comunicación | `thread`, `message`, `document_request`, `shared_item` | Envíos aprobados; reintentos idempotentes; compartición de versión exacta. |
| Gobierno | `audit_event`, `integration_run`, `outbox_event`, `retention_rule`, `access_exception` | Registro de operaciones; trabajos durables; no almacenar secretos ni texto sensible innecesario en logs. |

### Invariantes de almacenamiento

Las operaciones privadas incluyen estudio y asunto cuando corresponda; las claves compuestas o controles equivalentes impiden referencias cruzadas. La concurrencia utiliza versionado optimista o equivalente: una revisión sobre una versión anterior no aprueba automáticamente una nueva.

Las escrituras económicas y de workflow se agrupan transaccionalmente con el evento de salida. El envío externo puede reintentarse sin duplicar la operación. El reloj técnico se conserva de forma consistente y la interfaz muestra zona horaria explícita; la política exacta de fechas de todo el estudio se valida con el piloto.

Las monedas se registran en cada importe; PYG es una necesidad del ámbito paraguayo, pero moneda base, monedas secundarias, reglas de cambio, redondeo y retención se aprueban antes de contabilizar. No se hardcodean tasas tributarias en este documento.

## 07. Arquitectura técnica del OS y sistema UI compacto

### Capas lógicas, no selección de stack definitivo

`Web OS` → `Auth/tenant authorization` → `Domain services` → `Durable database/document storage/jobs` → `AI research orchestration` → `RAG+corpus+checker`. Separar dominio empresarial del runtime LLM. Las interfaces de prueba actuales pueden ser reutilizadas, pero no son persistencia ni auth empresarial.

**ADR OS-001: PENDING_DECISION.** Comparar alternativas con compatibilidad con código TypeScript existente, PostgreSQL, autenticación y autorización multiestudio, control de documentos privados, backups, residencia, costo/operación, jobs y testing E2E. Next.js + TypeScript + PostgreSQL/Supabase puede evaluarse como **candidato**, no como decisión congelada.

### UI obligatoria — alta densidad desktop-first

El usuario pide una interfaz **COMPACTA**, visualmente como una app que habitualmente se vería al **85% del zoom**, sin depender de aplicar CSS `zoom` ni de obligar al navegador al 85%. Usar dimensiones de diseño compactas a zoom 100%, respetando legibilidad y accesibilidad.

| Token UI propuesto para evaluar en QA | Rango de diseño inicial |
|---|---|
| Body | 12.5–13.5px, line-height 1.35–1.45; no tipografía inflada |
| Texto secundario | 11–12px, contraste suficiente |
| H1 / H2 / H3 | 19–22 / 15–17 / 13–14px, jerarquía sobria |
| Altura topbar | 42–48px |
| Sidebar | 200–224px (colapsable) |
| Filas de tabla | 30–36px desktop; ampliación accesible cuando corresponda |
| Inputs y botones | 30–34px, controles densos con hit target accesible |
| Cards / paneles | Padding 10–14px; densidad operativa; no tarjetas gigantes |
| Gap estándar | 4 / 8 / 12 / 16px, evitando vacíos decorativos |
| Hover | Sutil: cambio tenue de fondo/borde; sin elevación teatral ni animaciones excesivas |
| Foco / teclado | Focus visible, navegación operable y estados accesibles |

**Prohibido:** cards enormes, hero dashboards, 4 KPIs gigantes repetidos, navbar interminable, banners inflados, fila táctil de 56px sin razón, padding de 24–32px indiscriminado, tipografía de 16–18px para datos densos, hover llamativo.

**Diseño de Mi día:** tareas y plazos confirmados arriba; revisiones pendientes; asuntos sin próxima acción; documentos recién incorporados. Acciones de una línea, tabla compacta, búsqueda/filtros sobre el contenido, detalles en panel o navegación contextual. Los estados son reales, no tarjetas visuales de mock.

**QA UI:** captura a 1440×900 y 1366×768 a zoom 100% para validar densidad; captura adicional a 85% para comparación visual; verificar responsive y accesibilidad. Criterio preliminar: navegación, filtros y al menos 8–12 filas de trabajo visibles sin scroll excesivo según pantalla, siempre que el contenido lo permita. Este objetivo visual es **PROPOSED**, no un umbral de accesibilidad.

## 08. Fuentes estatales y estado de adquisición

**Dato nuevo de Fase 2:** tres PDFs oficiales obtenidos vía HTTPS, bytes originales conservados con SHA-256, URL, fechas, MIME, páginas y metadatos. PDF.js 6.4.299 permitió extracción/render. No equivale a cobertura completa, permisos universales ni atestación institucional real.

| Sala | Muestra preservada (según informe de Codex) | Limitación |
|---|---|---|
| Constitucional | Acuerdo y Sentencia **1010**, 11/12/2015, 13 páginas | Escaneo sin texto digital; OCR/curaduría pendiente. |
| Civil y Comercial | Acuerdo y Sentencia **1184**, 19/09/2013, 29 páginas | Texto digital, sin revisión de contenido integral. |
| Penal | Acuerdo y Sentencia **162**, 24/05/2023, 7 páginas | Número/fecha identificados por publicación oficial, no impresos en encabezado PDF. |

**Fuente reportada:** `PHASE2_IMPLEMENTATION_REPORT.md`, 13/10/2026. La documentación original debe permanecer referenciada en el repositorio y debe contrastarse contra `OFFICIAL_CORPUS_MANIFEST.json` y los originales antes de marcar hechos como verificados independientemente.

| Canal | Estado de investigación heredado | Gate restante |
|---|---|---|
| CSJ / IIJ jurisprudencia Constitucional, Civil, Penal | Buscador y muestras públicas identificadas | API/exportación oficial o conector autorizado, identidad y cobertura por sala/año. |
| Digesto Legislativo | Muestras PDF de tres salas identificadas, + corpus F2 real | Procedencia y permisos de uso sistemático, actualizaciones y reconciliación con CSJ. |
| Congreso SILpy y OpenAPI v2 | API documental/metadatos y adjuntos tipados conocidos | Confirmar versión aplicable, semántica, originales y publicaciones frente a proyectos. |
| CSJ legislación, Constitución, Gaceta y códigos | Portales y candidatos localizados | Texto oficial/versionado, modificaciones, uso autorizado, integridad y permisos. |

**Doctrina de autenticidad:** una firma Ed25519 válida de un emisor configurado no prueba por sí sola que el documento provenga de autoridad pública; registry y canal de atestación deben vincularse a evidencia institucional autorizada. Nunca autodeclarar `VERIFIED`. `NOT_FOUND_IN_SCOPE` no significa “no existe”. No sortear restricciones, CAPTCHA, ni crear corpus comercial con contenido editorial restringido sin autorización.

## 09. RAG jurídico: ingesta, identidad y versiones

### Estado técnico del RAG en Fase 2

El servicio local admite extracción UTF-8, búsqueda por texto/metadatos, IDs/localizadores, snapshots e interfaz semántica. Esa implementación fue **probada offline**. Embeddings/corpus completo/conectores estatales reproducibles siguen bloqueados. Las reglas siguientes son especificación de destino: no interpretarlas como ya implementadas.



### Separación de colecciones

**Jurisprudencia pública:** resoluciones y originales identificados. **Normativa pública:** leyes, Constitución, códigos como instrumentos/versiones y modificatorias. **Documentación privada:** archivos autorizados del estudio/asunto. **Material editorial autorizado:** colección distinta, no confundida con texto normativo o resolución judicial.

Una referencia a un fallo dentro de un escrito del cliente es una cita candidata, no un registro auténtico del corpus. Un resumen generado por IA puede facilitar navegación, pero jamás convertirse en original de autoridad.

### Cadena de ingesta propuesta

Registro y permiso de fuente → captura autorizada de originales y metadatos → comprobación de contenido → extracción → estructuración → identidad y deduplicación → control de versión → QA documental → índices → manifiesto de cobertura → publicación del snapshot.

Cada paso puede quedar pendiente o fallido. `HTTP 200`, JSON bien formado o embeddings generados no cierran el proceso. Se detectan páginas de login, PDFs truncados, adjuntos ajenos, errores servidos como HTML y campos faltantes.

### Identidad canónica

Conservar `provider_id`, ID oficial cuando exista, URI estable, jurisdicción, órgano, sala, tipo de resolución, número, fecha y referencias secundarias disponibles. Asignar un ID interno inmutable sin fingir que sea un identificador estatal. No fijar una llave universal tribunal+número+año antes de verificar colisiones reales en los datos.

Las fusiones de duplicados guardan alias y razones. Cuando varios documentos puedan coincidir, se devuelve ambigüedad; no se elige uno por cercanía semántica y se declara validado. Una resolución publicada en dos fuentes puede asociarse con evidencia explícita, conservando ambos originales/versiones.

### Original, texto y extracción

Se conservan bytes originales, tipo, fecha de obtención, hash, origen y permisos. El hash demuestra identidad de bytes entre observaciones, no autenticidad estatal por sí solo. Se extrae primero texto digital; OCR solo cuando el original no ofrece una alternativa utilizable, con calidad y páginas problemáticas registradas.

Una normalización de texto conserva los offsets/páginas para volver al original. Los errores de extracción no se “corrigen” inventando un número, una palabra citada o una fecha. El documento ilegible queda marcado para revisión.

### Estructura documental

Segmentar por documento y estructura: encabezado, artículos, secciones, párrafos y páginas. Recuperar un pasaje con contexto de su fuente. Mantener separados fallo, voto, transcripción de partes, sumario y comentario cuando la estructura permita identificarlos; si no, registrar incertidumbre de clasificación.

### Temporalidad

Registrar fecha de emisión, publicación y vigencia según la fuente y sus límites. Son campos diferentes. Las relaciones de modificación/derogación deben tener procedencia; un modelo no inventa una fecha de vigencia. Conservar versiones históricas sin sobrescribirlas.

Una compilación “actualizada 2024” no se presenta como normativa consolidada vigente a 2026. La selección jurídica aplicable la revisa el abogado; el RAG aporta la versión y la información documental conocida.

### Cobertura

Por cada fuente y partición se conserva `sala/órgano`, años cubiertos, documentos obtenidos, documentos íntegros, registros sin original, exclusiones, fallos de captura y último control. El total conocido del proveedor se registra solamente si se verificó. Mostrar cantidad de documentos indexados no permite afirmar cobertura completa.

## 10. RAG jurídico y paquetes de contexto por encargo

### Dos trabajos distintos

**Investigación temática:** buscar antecedentes relevantes de una cuestión. **Resolución bibliográfica exacta:** comprobar identidad de una sentencia/norma citada. La segunda no se resuelve con similitud semántica.

### Flujo de contexto para expedientes extensos

1. **Ingesta persistente por documento y versión:** original, extracción, índice textual/metadatos, localizadores y hashes. Evitar reprocesar si no cambia la versión.
2. **Research Request delimitada:** abogado elige una cuestión; el expediente completo queda en el OS. No activar diez Juntas por un pedido general.
3. **RAG híbrido:** recuperar candidatos exactos, textuales y semánticos con filtros de estudio/asunto, fecha, jurisdicción, permisos y snapshots.
4. **Jev Evidence Router:** clasificar candidatos por lotes; esencial, relevante, contextual, contradictorio, incierto o no relacionado con la cuestión. No elimina documentos.
5. **Luna Context Builder:** producir hechos, alegaciones de partes, cronología, contradicciones, vacíos, cobertura y citas de fragmentos originales.
6. **Sol 6.1 Medium:** recibe contexto compacto más originales críticos, recuperables bajo demanda con límites.
7. **Gemini auditor:** no depender únicamente del resumen de Luna; puede consultar originales con límites.
8. **Checker determinístico:** resolver todas las citas finales con registro de identidad auténtica.

### Contrato mínimo de evidencia

`EvidencePack { pack_id, run_id, matter_snapshot_id, corpus_snapshot_id, retrieved_passages[{source_id,document_version_id,passage_id,page_range,source_status}], query_intents, search_filters, coverage_limitations, created_at }`.

**Reglas:** una fuente privada citando jurisprudencia no constituye una sentencia oficial; un resumen LLM no se vuelve original. Contextos congelados por run, con `OUTDATED` cuando cambian datos, no nueva Junta automática. Un fallo de recuperación o truncamiento no se silencia: resultado parcial/pending o escalamiento al abogado.

**Presupuestos son experimentales:** Sol Medium objetivo inicial 30K–60K de entrada, ampliación hasta 100K, salida total hasta 25K, máximo dos recuperaciones acotadas. Deben medirse pérdida de evidencia crítica, tokens facturados, P50/P90 y costo real; no recortar fuentes decisivas solo para alcanzar precios. Para Jev y Luna el tamaño depende de límites efectivamente documentados y la versión de modelo accesible.

## 11. Junta Jurídica V2 — workflow aprobado

### Arquitectura propia, no clonación de Mussi

`ResearchRequest → Ingestion/RAG → Jev (clasifica) → Luna (estructura) → GPT-6.1 Sol MEDIUM (analiza) → Gemini 3.8 Flash (audita) → Checker determinístico (verifica identidad) → HUMAN_REVIEW_PENDING`.

| Etapa | Contrato de entrada | Salida y control |
|---|---|---|
| Jev | Cuestión, candidatos, IDs y localizadores | Scores/categorías, explícitos inciertos y contradictorios; conserva cobertura. |
| Luna | Fragmentos seleccionados + originales localizables | LegalCasePacket con hechos vs alegaciones vs inferencias, cronología, vacíos y procedencia. |
| Sol 6.1 Medium | Cuestión, pack versionado, hechos y fuentes identificadas | Análisis delimitado con citas estructuradas, alternativas, faltantes y `completion_status`. |
| Gemini 3.8 Flash | Análisis Sol, contexto y originales, cobertura | Objeciones independientes, referencias sospechosas, inconsistencias y evidencias omitidas. No dictamen final autónomo. |
| Checker | Citas en campos y prosa + corpus/registro de confianza | Identidad `VERIFIED_IDENTITY` o fallo/ambiguo; citas textuales exactas o estado pendiente. |
| Abogado | Análisis, objeciones, verificaciones | Acepta, corrige, rechaza; la IA no aprueba ni presenta autónomamente. |

**Separación decisiva:** el auditor puede observar errores jurídicos, pero la métrica y bloqueo duro que motivan el checker son jurisprudencia inventada y citas no acreditadas, no “acertar la sentencia”. Una fuente real mal interpretada corresponde a revisión profesional.

### Estados de ejecución y gobernanza

`CREATED → PREPARING_EVIDENCE → ROUTING_EVIDENCE → BUILDING_CONTEXT → PRINCIPAL_ANALYSIS → ADVERSARIAL_AUDIT → CHECKING_REFERENCES → HUMAN_REVIEW_PENDING`; con estados `PARTIAL`, `FAILED`, `CANCELLED` y vigencia `CURRENT/OUTDATED` separados. Nunca etiquetar verificado cuando haya citas no examinadas o ambigüedad. Presupuestos de gasto, latencia, intentos, llamadas extra y salida deben aplicarse en backend.

### Estado reportado de implementación

La Fase 2 implementó la secuencia modular, un preflight y un live-smoke **no ejecutado**, con techo planeado de **USD 0,60**, un candidato, cero reintentos/recuperaciones; adaptadores reales sin cuentas validadas. Google Models GET devolvió HTTP 401. No declarar conectividad por un test con transportes falsos.

**Deuda activa de citas:** extractor es-bibliography-v3 detectó 12/12 referencias pero estructuró 11/12; un encabezado civil en palabras permanece `PENDING`. Cero etiquetas `VERIFIED` proviene de confianza cerrada, no de una validación efectiva de jurisprudencia auténtica.

## 12. Checker bibliográfico — contratos, atestación y gate

**Función exclusiva:** comprobación determinística de identidad de referencias y correspondencia literal de citas textuales. NO decide si la interpretación de la fuente es correcta.

### Identidad y clasificación

`VERIFIED_IDENTITY`, `METADATA_MISMATCH`, `AMBIGUOUS`, `NOT_FOUND_IN_SCOPE`, `SOURCE_UNAVAILABLE`, `INSUFFICIENT_IDENTITY`. Para cita textual: `QUOTE_MATCH`, `QUOTE_MISMATCH`, `TEXT_UNAVAILABLE`, `EXTRACTION_UNCERTAIN`, `NOT_APPLICABLE`.

Verificar metadatos disponibles: tribunal/sala, tipo y número, fecha, id oficial, URL/original, versión, localizador y texto. Resolver duplicados sin afirmar una coincidencia solo por número o por embedding.

**Atestación:** registro confiable de verificadores externo al bundle; Ed25519 para integridad de documentos y claims; revocación y fecha; `trust_registry` separado. El reporte señala corrección local probada, pero **canal oficial y política jurídica de emisores autorizados sigue pendiente**. Firma interna válida ≠ certificación institucional.

**Salida segura:** toda referencia detectada/estructurada/presente en prosa requiere estado; sin cobertura total el documento nunca lleva `VERIFIED` global. La extracción numérica en palabras en una cabecera civil sigue siendo fallo documentado. No ocultar el 11/12 ni reutilizar un holdout ya visto como independiente.

## 13. Documentos, aprobación, entrega y presentación

**PROPUESTO V2 / HEREDADO DE V1.1 — sujeto a aprobación de detalle.** Cada documento tiene versiones. Un original recibido es inmutable; una corrección produce un derivado o una nueva versión con vínculo al original. La clasificación y el índice no modifican bytes.

Estados propuestos: `DRAFT → IN_REVIEW → CHANGES_REQUESTED / APPROVED`. La entrega y la presentación son actos separados con su evidencia: `DELIVERED` y `FILED` no son sinónimos de aprobación. La descarga de un Word o PDF no demuestra presentación judicial.

Cada aprobación registra quién, cuándo y qué versión aprobó. Si cambia el contenido, esa aprobación no cubre automáticamente la nueva versión. El OS puede exigir revisor distinto del autor según política del estudio; la regla se configura y prueba, no se presume universal.

El armado de expediente produce índice, orden, anexos y paquete versionado, sin destruir originales. Debe permitir ver qué archivos se incluyeron y reconstruir el paquete entregado. Plantillas del estudio, números, partes y anexos se validan antes de exportar; no se inventan identificadores judiciales ausentes.

**DONE documental:** crear dos versiones, revisar la primera, modificar la segunda y demostrar que ni la aprobación ni el estado de referencias se arrastran indebidamente; compartir solo la versión autorizada; registrar entrega/presentación con comprobante.

## 14. Agenda, tareas, comunicaciones y portales

### Fechas y responsabilidades

Una fecha extraída, una fecha interna y un plazo procesal confirmado son tipos distintos. Las fechas sugeridas se identifican como pendientes. Un calculador de plazos requiere reglas locales revisadas, hecho de inicio confirmado, calendario/versionado y casos de prueba; queda bloqueado mientras eso no exista.

Cada tarea tiene responsable, asunto, fecha si aplica, estado y dependencia. Los recordatorios escalan según política conocida. Reintentar una notificación no crea otra tarea. Vacaciones o sustituciones mantienen el historial de asignación.

### Comunicaciones

Se integrarán correo, calendario y otros canales solo mediante conexiones autorizadas y contratos comprobados. No se importan bandejas completas indiscriminadamente ni se comparten contactos de un estudio con otro. Los mensajes se vinculan explícitamente a asuntos y conservan adjuntos y procedencia.

Los borradores IA no se envían automáticamente como asesoramiento final. Los envíos externos requieren permiso y aprobación acorde al tipo de mensaje. El portal permite solicitar documentos, recibirlos, confirmar recepción y compartir entregables; debe distinguir recepción técnica de aceptación o revisión profesional.

La agenda operativa y las comunicaciones pueden funcionar sin integración judicial automática: el origen manual se etiqueta. Ese modo no se comercializa como sincronización estatal ni autoriza promesas de monitoreo continuo.

## 15. Honorarios, administración y dirección

### Gestión económica propuesta

Soportar acuerdos por monto fijo, etapas, abono y tiempo cuando el estudio los utilice; otras modalidades se validan con el piloto. Registrar alcance, moneda, responsables y versión aceptada. No suponer que todas las horas son facturables ni que un importe estimado ya se devengó.

Separar acordado, trabajo registrado, facturado, cobrado y pendiente. Los anticipos y gastos recuperables se aplican una sola vez; las anulaciones se hacen con reversos y autorización, no borrando historial. Los fondos de clientes requieren cuentas/registros separados de ingresos propios y revisión profesional de la modalidad aplicable.

La emisión fiscal e integración contable se trata como un conector específico, no como un PDF visualmente parecido a una factura. Tasas, autorizaciones y obligaciones no se definen por memoria de una LLM. No se implementa contabilidad tributaria completa sin cerrar esos requisitos.

### Reportes útiles

Dirección ve trabajo sin próxima acción, entregas demoradas, carga por abogado, asuntos con saldo pendiente y trabajo aún no facturado. La rentabilidad necesita costos y reglas acordadas; cuando falten, mostrar cobertura de datos y métricas parciales en vez de un margen ficticio.

Cada KPI debe poder abrir el listado que lo explica. Los totales respetan permisos, fechas, monedas y estados. Un reporte no suma monedas distintas sin una conversión identificable ni trata facturación como caja.

## 16. Desarrollo de Junta propia — sin dependencia de Mussi

**Decisión aprobada posterior a v1.1:** construir nuestro workflow desde cero. Cualquier texto antiguo que ordene clonar `juntaClinica.js` o reconstruir el 3→2→1 queda superado. Mussi se preserva sin cambios, y sus benchmarks no sirven como validación de la Junta jurídica nueva.

La Fase 1 implementó el motor offline; Fase 2 corrigió extracción, firmas/registry, versiones, restricciones de proveedor, introdujo corpus de tres originales y OS Core en servicios; todo pendiente de pruebas reales de proveedores y de política de procedencia oficial. Preservar historial, pruebas y fixtures; avanzar por cambios pequeños sin reconstruir desde cero.

**Paralelismo autorizado:** frente Junta/RAG y frente OS Core, con ramas separadas cuando Git exista. Ningún avance en la Junta debe bloquear el desarrollo convencional de clientes, asuntos, permisos, tareas, documentos y administración. El OS debe operar sin LLMs.

## 17. Contratos funcionales entre OS y Junta

| Operación lógica | Entrada / propiedad | Resultado / obligación |
|---|---|---|
| `openMatter` | study_id, client_id, responsable, fecha, estado | Asunto durable, autorización y actividad. |
| `attachDocument` | matter_id, original, scope | Versión inmutable y hash, permisos y estado de extracción. |
| `createResearchRequest` | cuestión, materia, alcance, snapshot, presupuesto | Request versionada; no dispara inferencia sin autorización. |
| `assembleEvidencePack` | run_id, filtros, permisos, versiones | Snapshot localizable, cobertura y estado RAG. |
| `runJunta` | request congelada, permiso, presupuesto | Ejecución idempotente con stages, costo, timeout y resultado no aprobado. |
| `checkCitation` | referencia, corpus oficial, policy de confianza | Clasificación determinística con evidencia y razones. |
| `createDraft` | asunto, plantilla, análisis seleccionado | Documento editable, no aprobado por IA. |
| `approveDocumentVersion` | ID exacto de versión y usuario autorizado | Aprobación inmutable para esa versión; no aprobación genérica del archivo. |
| `recordDeliveryOrFiling` | documento aprobado, acto externo, recibo | Entrega/presentación acreditada, nunca inferida por descarga. |

Especificación lógica: contratos productivos en SQL/API pendientes del **ADR OS-001**. El servicio offline existente no constituye backend productivo autorizado. Consentimiento, aislamiento por tenant y revisiones deben verificarse también en jobs/cachés/contexto LLM. No automatizar plazos procesales por LLM.

## 18. QA, evaluaciones y criterios de DONE

### Gates independientes

1. **Motor offline:** tests unitarios, contratos, checker y orquestador; 271/271 PASS **reportado** al 13/10, aún sujeto a reproducción en este corte de código.
2. **Extractor:** medir detección y resolución sobre corpus real; 12/12 detectadas y 11/12 extraídas reportado. Un FAIL conocido impide certificar cobertura.
3. **Procedencia oficial:** originales con hash ≠ autenticación cerrada. Falta policy de emisores/autoridad y curaduría externa.
4. **Proveedores:** solo smoke sin costo reportado; acceso API real BLOQUEADO (Google 401, Jev/OpenAI sin credenciales).
5. **OS Core:** 42 pruebas sintéticas y flujo de 14 pasos; no equivale a app web, sesiones o RLS productivos.
6. **Integración:** carga de original, asunto, Junta, auditoría/checker, borrador, revisión/aprobación, entrega registrada, actividad y costos.
7. **UI:** densidad, jerarquía, navegación por teclado, error y vacío, estados reales; screenshots desktop 100% + referencia visual 85%.
8. **Seguridad:** dos estudios, varios asuntos, acceso negativo a API/documentos/índices/caché/LLM y revocación.

### Definición de DONE de un producto OS real

Solo si existe autenticación empresarial, persistencia durable, permisos a nivel servidor/BD, flujos transaccionales completos, UI navegable, E2E no sintético, restauración y gestión de errores; pruebas reales de integración de la Junta/identidad de referencias o bloqueo explícito visible. El OS Core aislado no cierra el producto. No hacer deploy con mocks.

**Métricas principales de la Junta:** `citation_detection_recall`, `false_verified_count`, `authentic_citations_unresolved`, `critical_document_omission`, `source_provenance_failures`, costo real por asunto/encargo, p50/p90, reintentos, tokens reales. Separar dictamen jurídico revisado por abogado de identidad de referencias.

## 19. Operación, protección de datos y continuidad

Proponer ambientes separados, secretos fuera del repositorio, control de acceso del lado servidor, cifrado según proveedor, auditoría útil, exportaciones autorizadas y backups con restauración ensayada. La selección de proveedores debe revisar ubicación, retención y uso de entradas por los modelos; no se declara cumplimiento normativo por contratar un servicio determinado.

Los documentos estatales pueden contener datos personales o material reservado. El carácter público de un portal no habilita republicar indiscriminadamente todo dato. Registrar exclusiones, retiro/corrección, permisos y solicitudes de borrado conforme a políticas revisadas profesionalmente.

El sistema limita tamaño de archivos, protege la recuperación de URLs contra destinos no permitidos y separa instrucciones de documentos. Los logs operativos no deben almacenar prompts completos privados por defecto. El soporte no puede leer todos los asuntos para depurar sin control.

Tareas de ingesta usan límites aprobados, reintentos con espera, checkpoints y alarmas; nunca un scraper infinito agresivo. La falla de actualización conserva el último snapshot identificable y muestra su fecha, sin anunciar actualidad inexistente.

Se monitorean pipeline de fuentes, colas, etapas de Junta, costos, permisos fallidos y entrega de notificaciones. Las métricas de éxito operativo se mantienen separadas de la calidad bibliográfica.

## 20. Decisiones pendientes — no resolver por intuición

| ID | Decisión | Estado e impacto |
|---|---|---|
| ADR OS-001 | Web stack, backend, BD, auth, storage, jobs, hosting/región | **PENDING_DECISION**; impide implementación empresarial final. Requiere leer `OS_CORE_ARCHITECTURE.md`. |
| PROD-01 | Estudio piloto, tamaño, roles reales, especialidades y proceso de cobros | PENDIENTE; regula prioridades y aceptación de UI/operativa. |
| DATA-01 | Fuentes oficiales, licencias, atestadores/registry, OCR y cobertura | **BLOCKED** para verificar jurisprudencia real. |
| AI-01 | Model IDs accesibles, credenciales, política de costos y datos | **BLOCKED**; Google 401, Jev/OpenAI sin confirmación. |
| QA-01 | Umbrales de recall real y holdout externo independiente | PENDIENTE; 11/12 no acredita certificación. |
| OPS-01 | Dominio/Git/CI, ambiente dev/preview/prod y deploy | PENDIENTE; no existe Git según último reporte. |
| COM-01 | Modelo comercial y costo real por abogado/Junta | PENDIENTE; no sostener IA ilimitada por supuestos. |
| LOCAL-01 | Plazos, facturación paraguaya, firma y conectores judiciales | FUERA de Fase 2; requiere contratos/localización. |
| GOV-01 | Residencia, confidencialidad, retención y borrado | PENDIENTE; no subir datos reales a IA sin política. |

**Tratamiento:** cada cierre requiere ADR con responsable, criterio, alternativas descartadas, evidencia y alcance. Los documentos actuales no constituyen permiso para que un agente tome decisiones por el propietario.

## 21. Alcance de producto y próximos gates

**Entrega prioritaria:** cerrar ADR OS-001 y comenzar app compacta real con estudios, login, membresías, clientes, asuntos, documentos, tareas y versiones; en paralelo, curar corpus oficial y ejecutar un smoke real acotado de Junta solo tras autorización de gasto y credenciales. No desplazar el OS completo por otra iteración indefinida del motor offline.

**Fuera de fase próxima:** predicción de sentencias, presentación judicial automática, scraping no autorizado, expansión a 18 países, facturación paraguaya productiva sin reglas validadas, promesas de uso LLM ilimitado. **Dentro del alcance total:** comunicaciones, workflow, agenda, portal, honorarios, gastos y cobros.

## 22. Fuentes del blueprint y ruta de instalación

- `PHASE2_IMPLEMENTATION_REPORT.md` (usuario, 13/10/2026) = estado reportado más reciente.
- `AUDIT_REMEDIATION.md` (usuario) e `IMPLEMENTATION_REPORT.md` (usuario) = historia de F1 / remediación.
- Blueprint y Roadmap V1.1 = alcance histórico de OS completo, preservado bajo `docs/historico/`.
- Investigación pública de fuentes V1.1 = informe/registro preservados bajo `docs/fuentes/`.
- `docs/ADR_RECONCILIACION_V2.md` = cambios explícitos y asuntos abiertos.
- `docs/CODEX_HANDOFF_INSTALACION.md` = cómo incorporar documentación en carpeta local sin modificar código.

**Este documento no prueba acceso al disco C: del usuario.** Debe instalarse bajo `C:\Users\User\Desktop\PORYECTOS\LAW & ORDER OS\docs\`; después Codex valida la ruta exacta y prioriza este blueprint. No sobrescribir reportes existentes.
