# LAW & ORDER OS
## Blueprint maestro · v1.1

**Sistema operativo para estudios jurídicos · Paraguay**  
**Corte documental y de investigación: 11 de octubre de 2026**  
**Estado: base de diseño entregada; decisiones técnicas pendientes identificadas; aplicación no implementada por esta sesión.**

> Cada abogado tiene su espacio; cada asunto conserva su equipo, información y trabajo. La Junta Jurídica produce y confronta análisis. El checker comprueba las referencias. El estudio coordina la entrega, el seguimiento y el cobro dentro del mismo sistema.

## 01. Gobierno del blueprint y estado real

Este documento establece el alcance del OS completo y organiza su construcción. No autoriza por sí solo cambios en Mussi, despliegues, acceso a expedientes privados, envíos institucionales ni recolección masiva de datos. Las propuestas detalladas aquí son la versión inicial para revisión; no se presentan como código implementado o decisiones anteriores ya aprobadas.

### Jerarquía y etiquetas

| Etiqueta | Significado |
|---|---|
| **ACORDADO** | Instrucción explícita de Marcelo o decisión canónica recuperada que debe preservarse. |
| **PROPUESTO V1** | Diseño nuevo de este blueprint. Debe revisarse antes de transformarlo en instrucciones de implementación. |
| **VERIFICADO DOCUMENTALMENTE** | Hecho sustentado por una fuente identificada; no implica prueba de runtime. |
| **PENDIENTE / BLOQUEADO** | Falta información o una prueba indispensable. No completar con una suposición. |

Las instrucciones explícitas más recientes gobiernan el producto. Para Mussi, el handoff canónico del 12/09/2026 describe la arquitectura objetivo; GitHub acredita únicamente lo publicado. El código local vigente debe verificarse antes de extraer el motor. Los blueprints antiguos de Mussi no pueden reintroducir una Junta de opinión única.

### Qué existe al cierre de esta entrega

Se entregan blueprint, roadmap,15 fichas de fuentes,20 observaciones y un manifiesto de 8 muestras/candidatos. Se observaron adjuntos SILpy y PDFs de las tres salas por Digesto. El kit diagnóstico pasó 33 pruebas locales; sus GET de red siguen bloqueados por DNS. No se creó repositorio LAW & ORDER, no se clonó el motor, no hay conector productivo ni corpus de producción. Ver AVANCE_F1_v1.1 para límites exactos.

Los intentos HTTP desde el entorno de ejecución fallaron por resolución DNS local; no certifican indisponibilidad de los organismos. Las respuestas vistas mediante la herramienta web son evidencia de investigación, no una prueba reproducible del futuro adaptador. El estado **integración validada** sigue pendiente para todas las fuentes.

### Fuentes de continuidad de Mussi

**MUSSI ONLINE — CONTEXTO MAESTRO DE JUNTA CLÍNICA**, corte 12/09/2026, archivo recuperado `Pegado text(3).txt`: topología 3→2→1, único Orquestador, checker bibliográfico, prevalencia del working tree local para cambios no publicados. Referencia documental: título y fecha anteriores, apartados 1–4 del archivo recuperado.

La rama remota `recovery/canonical-from-229ffc9` de `bjjrage/mussi-online` fue consultada y apunta a `aff5e3897dac37560e0e0653bf9fbb0a09ccb64c`. La fecha del commit previamente recuperada es 07/09/2026: anterior al handoff. El corte local actual no fue inspeccionado. **Esta discrepancia bloquea la clonación literal, no la definición del nuevo OS.**

## 02. Identidad del producto y decisiones no negociables

### Objetivo acordado

LAW & ORDER OS administrará la operativa del estudio jurídico: captación, apertura, asignación, investigación, preparación de documentos y expedientes, revisión, entrega/presentación, seguimiento, comunicación, honorarios, gastos y cobro. La IA es una capacidad central dentro del sistema; no su único módulo.

| ID | Regla acordada |
|---|---|
| INV-01 | El producto es un OS del estudio, no un chatbot ni un catálogo de jurisprudencia. |
| INV-02 | Cada abogado dispone de un panel propio sobre asuntos compartidos según permisos. |
| INV-03 | Se preserva el mecanismo de Junta 3→2→1: tres opiniones iniciales independientes, dos cross-reviews y resolución del mismo Orquestador. |
| INV-04 | El Orquestador inicial y final constituyen el mismo rol lógico; no se cambia silenciosamente de modelo entre ambas llamadas. |
| INV-05 | El checker es determinístico y bibliográfico: no decide si la interpretación o conclusión jurídica es correcta. |
| INV-06 | La preocupación central es jurisprudencia fabricada utilizada como fundamento. No sustituir ese objetivo por “acertar veredictos”. |
| INV-07 | La confrontación no es una votación que concede autenticidad a las fuentes. |
| INV-08 | El RAG jurídico y la procedencia documental son fundamentales; una cita no verificada no se presenta como comprobada. |
| INV-09 | Se verifica primero el acceso a fuentes estatales; después se extrae y adapta el motor vigente de Mussi. |
| INV-10 | La interpretación, aprobación y decisión profesional corresponden al abogado. |
| INV-11 | Una limitación, mock o carga manual no se convierte en integración definitiva sin validación explícita. |
| INV-12 | No se modifican silenciosamente decisiones anteriores ni se usa código histórico como prueba del diseño vigente. |

### Qué no se promete

No se promete ausencia absoluta de alucinaciones, asesoramiento automáticamente correcto, éxito procesal ni cobertura íntegra de toda la jurisprudencia paraguaya. El producto debe poder informar exactamente qué fuentes utilizó y comprobó, qué faltó recuperar y sobre qué versión trabajó. Una sentencia real mal interpretada y una sentencia inventada son problemas diferentes; sus evaluaciones no deben mezclarse.

### Alcance territorial y comercial

Paraguay es el ámbito inicial acordado para la investigación de fuentes. No se ha seleccionado todavía estudio piloto, tamaño del equipo, especialidades comerciales prioritarias, pricing ni capacidad mensual de uso. La cobertura documental solicitada incluye las salas Constitucional, Civil y Penal, Constitución, leyes y códigos: no se elimina una sala para facilitar una demo sin autorización.

## 03. Arquitectura funcional del OS

**PROPUESTO V1.** La unidad de trabajo central es el **asunto**, no el chat. Un cliente puede tener múltiples asuntos; un asunto puede estar relacionado con varios clientes o partes y contener cero, uno o varios procedimientos o expedientes judiciales/administrativos. Un encargo contractual o de asesoría no necesita un expediente judicial ficticio.

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

**PROPUESTO V1.** El rol define capacidades posibles; la asignación al estudio y al asunto delimita dónde se pueden usar. Ocultar un botón no constituye autorización. Las reglas deben aplicarse a API, consultas, archivos, exportaciones, búsquedas, trabajos en background y contexto IA.

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
| Inteligencia | `research_request`, `evidence_pack`, `board_run`, `board_stage`, `board_result`, `citation_check` | Cada run ligado a snapshot y versión de evidencia; tres opiniones iniciales sin exposición entre sí. |
| Corpus público | `source_provider`, `source_item`, `source_version`, `passage`, `legal_relation`, `coverage_manifest` | Identidad oficial separada de ID interno; hash no sustituye procedencia; ausencia de fecha no se inventa. |
| Economía | `fee_agreement`, `time_entry`, `expense`, `invoice`, `payment`, `allocation`, `ledger_entry` | Importes exactos y moneda; reversos trazables; aplicaciones atómicas para impedir doble cobro/aplicación. |
| Comunicación | `thread`, `message`, `document_request`, `shared_item` | Envíos aprobados; reintentos idempotentes; compartición de versión exacta. |
| Gobierno | `audit_event`, `integration_run`, `outbox_event`, `retention_rule`, `access_exception` | Registro de operaciones; trabajos durables; no almacenar secretos ni texto sensible innecesario en logs. |

### Invariantes de almacenamiento

Las operaciones privadas incluyen estudio y asunto cuando corresponda; las claves compuestas o controles equivalentes impiden referencias cruzadas. La concurrencia utiliza versionado optimista o equivalente: una revisión sobre una versión anterior no aprueba automáticamente una nueva.

Las escrituras económicas y de workflow se agrupan transaccionalmente con el evento de salida. El envío externo puede reintentarse sin duplicar la operación. El reloj técnico se conserva de forma consistente y la interfaz muestra zona horaria explícita; la política exacta de fechas de todo el estudio se valida con el piloto.

Las monedas se registran en cada importe; PYG es una necesidad del ámbito paraguayo, pero moneda base, monedas secundarias, reglas de cambio, redondeo y retención se aprueban antes de contabilizar. No se hardcodean tasas tributarias en este documento.

## 07. Arquitectura técnica lógica

**PROPUESTO V1.** Separar cinco responsabilidades: interfaz del OS, servicios operativos transaccionales, almacenamiento documental, plano de fuentes/RAG y ejecución de Junta/checker. No exige cinco despliegues ni microservicios: el límite lógico debe existir aunque se implemente primero en una aplicación modular.

| Componente | Responsabilidad | No debe hacer |
|---|---|---|
| Aplicación operativa | Usuarios, asuntos, workflow, documentos y economía | Depender del proveedor LLM para guardar una tarea o consultar un saldo. |
| Almacén transaccional | Integridad, relaciones, permisos y estados | Sustituir control de acceso por filtros del cliente. |
| Almacén de objetos | Originales, versiones, derivados y exportaciones | Sobrescribir el original al extraer texto. |
| Recuperación/indexación | Búsqueda textual y semántica con metadatos | Otorgar autenticidad por similitud. |
| Resolver de referencias | Identificación exacta y candidatos ambiguos | Convertir el top-1 semántico en fallo comprobado. |
| Orquestación durable | Etapas, tiempos, costos, reintentos y continuidad | Omitir una revisión porque falló un proveedor. |
| Checker | Existencia/identidad, localización y citas textuales | Emitir aprobación de la interpretación jurídica. |

La selección de framework, base de datos, vector store, proveedor de hosting, cola, autenticación y observabilidad está **pendiente**. Se requiere una decisión técnica con costo, residencia de datos, operación, límites de ejecución, exportación y compatibilidad del motor de Mussi. No elegir un stack por ser el de otro proyecto sin esa decisión.

Una abstracción de proveedor LLM es útil; no autoriza a sustituir el Orquestador entre sus dos llamadas dentro de un run. Las credenciales públicas de fuentes y privadas de modelos se mantienen fuera del navegador y de los artefactos compartidos.

## 08. Fuentes estatales: alcance y realidad comprobada

El registro completo y las URLs están en `fuentes/FUENTES_Y_APIS_PARAGUAY_v1.1.json` y su informe legible. Ninguna fuente posee todavía conector de producción implementado.

| Prioridad | Fuente | Situación verificada | Condición para usarla en el corpus |
|---|---|---|---|
| P0 | Congreso / SILpy | Metadatos de ley y adjuntos tipados observados; OpenAPIv 2 ubicado sin cuerpo validado | Validar v2, paginación, adjuntos oficiales y texto completo; conservar condiciones CC-BY del portal. |
| P0 | CSJ jurisprudencia | Formulario de las salas Constitucional, Civil y Penal | API/exportación autorizada, identidad estable y prueba de originales por sala. |
| P0 | CSJ legislación | Portal de normas, fuentes y relaciones | Acceso automatizado habilitado y prueba de leyes/versiones. |
| P0 | Gaceta Oficial | Índice→detalle→enlace observados; documento pendiente y muestra de Avisos | Documentos completos, asociación norma-publicación, condiciones y actualizaciones. |
| P0 | Constitución / Cultura | PDF oficial accesible | Validación de edición, enmiendas, texto y procedencia. |
| P0 | Códigos | Digesto CP/CPP abiertos; Civil CONATEL abierto; CPC candidato sin apertura | Ediciones/integridad/modificatorias y permisos pendientes; no ingerir compilaciones restringidas. |
| P0 | Digesto jurisprudencia | PDF de cada sala abierto y páginas de identidad revisadas | Muestra finita; acceso recurrente, cotejoCSJ y cobertura pendientes. |
| P1 | ResolucionesWeb | Portal de tribunales de apelación | Ampliación separada con cobertura real y permisos. |

El Congreso publica reutilización bajo CC-BY 4.0 para los documentos sujetos a sus términos; incluye atribución y conservación de metadatos. Esa autorización no se traslada automáticamente a la CSJ o a otros portales. [Fuente oficial](https://datosv2.congreso.gov.py/web/pages/avisoLegal.xhtml?i=2).

La CSJ declara textos de las salas desde 1995; es una cobertura declarada, no un recuento auditado de todos los fallos. [Descripción institucional](https://www.pj.gov.py/contenido/2753-base-de-jurisprudencia-de-la-corte-suprema-de-justicia/2753).

La edición 2024 del Código Procesal Penal actualizado y concordado exige autorización escrita para reproducción/archivo del ejemplar. Se separará la reutilización del texto normativo original de esa compilación editorial; este documento no resuelve el alcance legal de la restricción. [Publicación, página de créditos](https://www.pj.gov.py/ebook/libros_files/codigo-procesal-penal.pdf#page=4).

### Regla de adquisición

Preferir API oficial documentada; en su defecto, exportación oficial autorizada; después, conector de portal permitido y estable. Una carga manual autorizada puede respaldar una prueba finita, siempre identificada como tal. No sortear bloqueos, credenciales, CAPTCHA o términos para acelerar la ingesta. No copiar corpus de competidores.

No se envían solicitudes a organismos desde esta entrega. Los borradores institucionales están preparados para revisión, con canales oficiales; faltan identidad legal del solicitante y aprobación del texto de envío.

## 09. RAG jurídico: ingesta, identidad y versiones

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

## 10. RAG jurídico: recuperación y paquete de evidencia

### Dos modos que no deben confundirse

**Investigación temática:** recuperar material relevante para una cuestión. **Resolución de referencia:** comprobar una identidad concreta citada. El segundo no puede limitarse a los primeros K resultados de una búsqueda temática.

La recuperación propuesta combina búsquedas exactas por metadatos, búsqueda textual y búsqueda semántica; luego deduplicación, fusión y reordenamiento de resultados. Los parámetros —cantidad de candidatos, tamaño de pasajes, modelo de embeddings y reranker— se eligen con pruebas sobre este corpus, no copiando los de PubMed.

Los filtros de país, ámbito, fuente, fecha y acceso se aplican antes de entregar material. La jurisprudencia extranjera, si se incorpora después, se ofrece en un ámbito explícito, no disimulada como paraguaya.

### Planificador

El planificador recibe el encargo y propone intenciones y filtros. No redacta un dictamen previo que condicione las tres opiniones. Las consultas y limitaciones quedan registradas. No se reescribe una búsqueda sin dejar la versión que produjo la evidencia.

### Evidence Pack

**Contrato lógico propuesto:** `pack_id`, `version`, `request_id`, `matter_snapshot_id`, `corpus_snapshot_id`, consultas, filtros, documentos, pasajes con localizadores, estado de cada fuente, límites y fecha de creación. El paquete incluye originales localizables y metadatos, no solamente una síntesis generada.

La primera adaptación propone un paquete común congelado para A, B y Orquestador. Comparten evidencia, pero no sus opiniones iniciales. Se verificará contra el motor vigente exactamente dónde se construye y transmite este paquete antes de implementar. Habilitar búsquedas durante el debate requeriría una decisión explícita sobre sincronización y cambios de evidencia; no se incorpora ahora por accidente.

### Ámbito de uso

El corpus público se comparte según permisos de licencia; la recuperación privada se limita al estudio y asunto autorizados. Cachear por texto de pregunta sin ámbito de acceso es inválido. Un trabajo en background debe verificar permisos también antes de publicar su resultado, por si el usuario fue removido durante la ejecución.

Un documento recuperado es contenido no confiable como instrucción: no puede ordenar al sistema exportar información, omitir verificaciones o usar otra identidad.

## 11. Junta Jurídica: motor heredado y adaptación

### Topología acordada

| Llamada | Entrada mínima | Salida / responsabilidad |
|---|---|---|
| A inicial | Snapshot del encargo y Evidence Pack | Análisis inicial independiente y referencias estructuradas. |
| B inicial | El mismo snapshot y Evidence Pack | Segunda posición independiente; no recibe la salida de A. |
| Orquestador inicial | El mismo snapshot y Evidence Pack | Opinión privada propia, antes de conocer A/B. |
| Cross-review A | Opiniones iniciales, evidencia y contrato de confrontación | Objeciones y respuestas estructuradas; referencias cuestionadas. |
| Cross-review B | Opiniones iniciales, evidencia y contrato de confrontación | Revisión independiente de esa confrontación. |
| Orquestador final | Su opinión inicial, A/B, ambas revisiones y evidencia | Resolución del análisis, diferencias y pendientes para el abogado. |

Son seis llamadas deliberativas, no seis agentes nuevos ni una conversación libre indefinida. La distribución exacta de payloads de las revisiones debe copiarse del corte canónico auditado y mapearse al dominio jurídico. El presupuesto de llamadas auxiliares de planificación o extracción se registra aparte.

No se agrega automáticamente un Safety Challenger histórico si no pertenece al motor canónico que se va a extraer. Tampoco se elimina una capa realmente canónica sin autorización. Se resuelve esa correspondencia en el gate de extracción.

### Contrato legal propuesto

El resultado separa análisis, alternativas si corresponden, hechos usados, información faltante, referencias candidatas y desacuerdos. Se mantienen tres estados independientes: **identidad bibliográfica**, **comprobación de citas textuales** y **revisión/aprobación jurídica humana**. Ninguna aprobación bibliográfica declara correcta la interpretación.

Los proveedores y modelos específicos son **pendientes de selección y prueba**. No se presupone que nombres de modelos de documentos antiguos existan o estén disponibles hoy. Debe conservarse un solo Orquestador lógico y una identidad de proveedor/modelo consistente entre sus dos llamadas dentro de cada run, salvo rediseño explícitamente aprobado.

### Estado y fallas

Estados de ejecución propuestos: `REQUESTED`, `PREPARING_EVIDENCE`, `INITIAL_OPINIONS`, `CROSS_REVIEW`, `RESOLVING`, `CHECKING_REFERENCES`, `REVIEW_PENDING`, `PARTIAL`, `FAILED`, `CANCELLED`. La vigencia del contexto es un eje separado: `CURRENT` u `OUTDATED`.

El sistema conserva resultados parciales sin presentarlos como Junta terminada. Un proveedor caído no habilita un camino de una opinión. Se registran retries, costos y fallos; límites y tiempos máximos se aprueban después de medir. Reanudar no debe mezclar un modelo nuevo con una opinión inicial anterior de otro Orquestador.

### Conversación posterior

Preguntar por una Junta existente explica el resultado sobre su snapshot, sin fingir nuevas verificaciones ni volver a ejecutar las seis llamadas. Un nuevo documento marca la relación con el contexto actual como desactualizada y permite solicitar reevaluación. La Junta histórica se puede consultar como histórica; no se reconstruye su evidencia usando el expediente actual.

## 12. Checker bibliográfico: especificación de control

### Responsabilidad

Comprobar que las referencias utilizadas corresponden a fuentes identificadas y auténticas según el registro autorizado; detectar datos discordantes y citas literales ausentes del texto correspondiente. No resuelve validez de tesis, interpretación, procedencia de una acción ni probabilidad de éxito.

### Resolución y estados

| Estado | Significado | Conducta |
|---|---|---|
| `VERIFIED_IDENTITY` | Identidad de la referencia respaldada por el registro/fuente correspondiente | Puede mostrarse como identidad comprobada; no implica interpretación correcta. |
| `METADATA_MISMATCH` | Hay documento candidato pero los datos atribuidos no coinciden | No validar la cita; mostrar diferencias. |
| `AMBIGUOUS` | Múltiples candidatos sin resolución suficiente | Pedir identificación adicional; no seleccionar top-1 por similitud. |
| `NOT_FOUND_IN_SCOPE` | No se localizó dentro del ámbito consultado | No afirmar inexistencia universal. |
| `SOURCE_UNAVAILABLE` | Falló acceso, permisos o proveedor | No transformar una falla técnica en aprobación ni en invención comprobada. |
| `INSUFFICIENT_IDENTITY` | Falta información para resolver la referencia | Mantener pendiente y solicitar aclaración. |

El control textual es separado: `QUOTE_MATCH`, `QUOTE_MISMATCH`, `TEXT_UNAVAILABLE`, `EXTRACTION_UNCERTAIN` o `NOT_APPLICABLE`. Una paráfrasis no recibe validación de cita literal; la interpretación de lo parafraseado sigue fuera del checker determinístico.

### Citas estructuradas y texto libre

La Junta referencia IDs del paquete. El software compone tribunal, fecha y número desde el registro, en lugar de pedir a la LLM que los reconstruya. Los IDs se validan y deben apuntar al documento/version realmente entregado.

Además se detectan referencias en texto libre, notas, citas entre comillas y contenido pegado. Comprobar solo la bibliografía estructurada permite que una referencia inventada sobreviva dentro de un párrafo. La cobertura de detección se evalúa sobre todas las referencias anotadas por revisores, no solo sobre las que el extractor encontró.

Si aparece una referencia nueva fuera del paquete, queda pendiente de resolver mediante fuentes autorizadas; el acuerdo entre modelos no la autentica. El checker también tiene límites de cobertura y posibles defectos: debe probarse, no tratarse como infalible porque sea determinístico.

### Condición de salida

Un borrador puede conservar pendientes visibles. Una versión no puede llevar la etiqueta global de **referencias comprobadas** si alguna referencia exigible está pendiente o discordante. El abogado puede revisar su análisis; no puede, con un clic genérico, convertir un `NOT_FOUND_IN_SCOPE` en verificación determinística.

Una comprobación manual documental, cuando la política la permita, debe tener evidencia, responsable y etiqueta distinta. No elimina el resultado original del checker. Si se retira una cita inválida se revisa el fundamento afectado; no se sustituye silenciosamente por un fallo parecido.

La exportación valida el hash/versión del contenido final. Una edición posterior requiere una nueva comprobación de los elementos afectados. El sello de verificación de una versión no se hereda ciegamente a la siguiente.

## 13. Documentos, aprobación, entrega y presentación

**PROPUESTO V1.** Cada documento tiene versiones. Un original recibido es inmutable; una corrección produce un derivado o una nueva versión con vínculo al original. La clasificación y el índice no modifican bytes.

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

## 16. Extracción y adaptación del motor Mussi

### Gate obligatorio previo

Obtener el corte local vigente: rama, SHA, estado de cambios no publicados, archivos canónicos de Junta/evidencia/checker, contratos, pruebas y última decisión. Reconciliarlo con `aff5e389…` remoto y el handoff del 12/09. Si hay diferencias, registrarlas sin revertir trabajo ni asumir que GitHub define el destino.

Se requiere aprobación de repositorio destino, estructura técnica y responsables. No usar repositorio de otro producto ni una rama de producción de Mussi como área temporal de LAW & ORDER.

### Plan de extracción

Primero caracterizar el motor con fixtures y tests del corte correcto. Después aislar orquestación, contratos de etapas, continuidad, fallas y evidencias de ejecución. Copiar únicamente lo autorizado a un entorno separado, sin datos de pacientes, secretos, configuraciones de producción o credenciales personales.

Crear un adaptador de dominio jurídico para `encargo/contexto`, `Evidence Pack`, tipos de fuentes, salidas y bibliografía. Sustituir integración PubMed y su modelo PMID por los proveedores jurídicos habilitados. Mantener constantes de negocio médicas fuera del nuevo dominio.

El contrato del nuevo checker debe distinguir identidad, cita textual y revisión jurídica. No se trasplantan dosis, diagnósticos, pacientes o permisos médicos como si fueran equivalentes legales. Reutilizar el mecanismo no implica copiar el esquema de datos clínico.

### Aceptación de la clonación

Se demuestra que hay tres opiniones iniciales independientes, dos cross-reviews completos y continuidad del mismo Orquestador; que el Evidence Pack corresponde al run; que no hay fast path silencioso; que un fallo no se presenta como éxito y que una referencia inventada no se aprueba por consenso.

Las diferencias entre origen y adaptador quedan en un informe. Las pruebas pueden ser inicialmente determinísticas con fixtures marcadas; la validación con proveedores reales y costo autorizado es otra fase. No se llama automáticamente a LLMs reales ni se despliega para “probar que funciona”.

## 17. Contratos de servicio y fallas

**PROPUESTO V1 — operaciones lógicas, no endpoints estatales ni APIs ya implementadas.**

| Operación | Entrada | Salida | Rechazos / condiciones |
|---|---|---|---|
| Abrir asunto | Estudio, cliente/partes, encargo y responsable | Asunto + membresías + auditoría | Sin permisos, referencias cruzadas, encargo no aceptado según política. |
| Ingerir fuente | Proveedor aprobado, contrato y original | Registro/version en staging + validación | Fuente no habilitada, tipo inesperado, identidad ambigua. |
| Buscar evidencia | Ámbito, snapshot, consulta y filtros | Candidatos y pasajes localizables | ACL, fuente indisponible, corpus sin cobertura; no inventar resultados. |
| Resolver referencia | Cita candidata y ámbito documental | Estado + candidatos + evidencia | Ambigüedad y ausencia explícitas; no fallback semántico autoaprobado. |
| Convocar Junta | Solicitud, snapshot, Evidence Pack, presupuesto autorizado | Run durable + resultado versionado | Paquete inválido, permisos/costo sin aprobar, etapa incompleta. |
| Comprobar salida | Versión y todas sus referencias | Reporte de identidad/texto por referencia | Cambió versión, original faltante, extracción incierta. |
| Aprobar documento | Versión, revisor y decisión | Registro inmutable de aprobación | Versión obsoleta, permisos o controles pendientes según política. |
| Compartir/presentar | Versión aprobada y destino/acto | Entrega o comprobante registrado | No derivar acto de la descarga; deduplicar reintentos. |
| Aplicar cobro | Pago, moneda, obligaciones y monto | Aplicaciones + saldos transaccionales | Sobreaplicación, moneda incompatible, doble ejecución. |

Cada operación de escritura admite una clave de idempotencia en su ámbito cuando pueda reintentarse. La misma clave con un payload diferente produce conflicto. Las respuestas de error conservan código, causa y estado, sin incluir contenido sensible innecesario.

## 18. QA, evaluación y criterios de DONE

### Evaluaciones separadas

**Recuperación:** material relevante encontrado y cobertura declarada. **Autenticidad bibliográfica:** referencias falsas o discordantes aprobadas indebidamente. **Citas textuales:** coincidencia atribuida al documento correcto. **Operación del OS:** flujo, permisos y consistencia. La evaluación jurídica humana del análisis es independiente; no sustituye ninguna de las anteriores.

### Batería mínima propuesta

| ID | Caso | Resultado exigido |
|---|---|---|
| QA-01 | Fallo completamente inventado | No puede recibir identidad comprobada. |
| QA-02 | Número real con sala, año o tribunal cambiados | Discordancia/ambigüedad visible; no false positive. |
| QA-03 | Fuente real y cita literal fabricada | Identidad y texto divergen en estados separados. |
| QA-04 | Referencia auténtica no indexada | No confundir ausencia en el corpus con inexistencia. |
| QA-05 | Fuente caída o login HTML con 200 | Falla técnica; no verificación positiva. |
| QA-06 | Referencia en párrafo/nota y no en bibliografía | Debe entrar al control; medir referencias omitidas por extractor. |
| QA-07 | Original truncado o extracción dudosa | Pendiente de texto, sin completar por imaginación. |
| QA-08 | Misma numeración en múltiples tribunales | Identidad compuesta/ambigüedad, no deduplicación destructiva. |
| QA-09 | Ley y proyecto intermedio con títulos similares | No publicar proyecto como ley vigente. |
| QA-10 | Edición antigua y modificatoria posterior | Versiones separadas, fuente y fecha visibles. |
| QA-11 | Dos estudios y asuntos reservados | Sin filtración en UI, API, RAG, jobs, logs o exportaciones. |
| QA-12 | Falla de una opinión/revisión | Junta parcial/fallida, nunca fast path presentado como completo. |
| QA-13 | Cambio de modelo entre Orquestador inicial/final | Rechazo o reinicio de run conforme política aprobada. |
| QA-14 | Nuevo documento durante un run | Snapshot consistente; estado OUTDATED al corresponder. |
| QA-15 | Edición después de aprobación/verificación | Nueva versión no hereda indebidamente ambos estados. |
| QA-16 | Webhook o envío duplicado | Un único efecto operativo/económico. |
| QA-17 | IA indisponible | Documentos, tareas, agenda y administración continúan. |
| QA-18 | Restauración de respaldo | Asuntos, originales, referencias, aprobaciones y saldos reconciliados. |

La batería cerrada de referencias fabricadas debe tener **cero falsos aprobados** como objetivo de aceptación propuesto para el corte evaluado. Eso no es una garantía estadística de cero fallos futuros. Deben reportarse tamaño, denominadores, falsos positivos/negativos, referencias no detectadas, fallas técnicas e intervalos de incertidumbre cuando corresponda.

El tamaño del holdout, umbrales de recuperación, latencia, costos, carga y recuperación ante desastre están pendientes de fijar antes de ejecutar las pruebas que los validarán. No se eligen después de ver los resultados. El set de desarrollo no se presenta como holdout independiente.

### DONE de producto, no de pantalla

Un estudio piloto debe completar apertura, documentos, asignación, Junta, escrito, revisión, entrega con evidencia, seguimiento y cobro dentro del OS, usando permisos reales de prueba y fuentes habilitadas. No basta que la interfaz renderice ni que los tests de mocks estén verdes.

## 19. Operación, protección de datos y continuidad

Proponer ambientes separados, secretos fuera del repositorio, control de acceso del lado servidor, cifrado según proveedor, auditoría útil, exportaciones autorizadas y backups con restauración ensayada. La selección de proveedores debe revisar ubicación, retención y uso de entradas por los modelos; no se declara cumplimiento normativo por contratar un servicio determinado.

Los documentos estatales pueden contener datos personales o material reservado. El carácter público de un portal no habilita republicar indiscriminadamente todo dato. Registrar exclusiones, retiro/corrección, permisos y solicitudes de borrado conforme a políticas revisadas profesionalmente.

El sistema limita tamaño de archivos, protege la recuperación de URLs contra destinos no permitidos y separa instrucciones de documentos. Los logs operativos no deben almacenar prompts completos privados por defecto. El soporte no puede leer todos los asuntos para depurar sin control.

Tareas de ingesta usan límites aprobados, reintentos con espera, checkpoints y alarmas; nunca un scraper infinito agresivo. La falla de actualización conserva el último snapshot identificable y muestra su fecha, sin anunciar actualidad inexistente.

Se monitorean pipeline de fuentes, colas, etapas de Junta, costos, permisos fallidos y entrega de notificaciones. Las métricas de éxito operativo se mantienen separadas de la calidad bibliográfica.

## 20. Decisiones abiertas y bloqueos de implementación

| ID | Decisión / información pendiente | Qué bloquea | Responsable por designar |
|---|---|---|---|
| DEC-01 | Estudio piloto, organización y especialidades operativas | Validación de flujos, roles y plantillas del piloto | Producto + abogado referente |
| DEC-02 | Corte local vigente de Mussi y autorización de extracción | Clonar código correcto; gate F2 | Dueño técnico de Mussi |
| DEC-03 | Repositorio destino y política de ramas/ambientes | Cualquier cambio de código del nuevo OS | Marcelo + responsable técnico |
| DEC-04 | Stack, hosting, datos, autenticación y jobs | DDL, APIs concretas y despliegue | Arquitectura |
| DEC-05 | Acceso/API/exportación y condiciones CSJ/Gaceta/BACN | Corpus automatizado de jurisprudencia y normativa | Producto + organismos |
| DEC-06 | Versiones/permiso de Constitución y códigos | Publicación del corpus normativo habilitado | Curaduría + revisión jurídica |
| DEC-07 | Modelos, presupuesto, límites y retención | Pruebas pagas, operación IA real | Producto + arquitectura |
| DEC-08 | Dataset/holdout, metas de recuperación/costos/latencia | Aceptación reproducible | QA + abogado referente |
| DEC-09 | Modalidades de honorarios e integración fiscal | Emisión real y reglas económicas locales | Administración + especialista |
| DEC-10 | Comunicaciones, firma y seguimiento judicial | Conectores y actuaciones externas | Producto + proveedor |
| DEC-11 | Retención, residencia, soporte y datos personales | Uso de expedientes reales y producción | Estudio + revisión profesional |

No se completa ninguna de estas decisiones por afinidad con NIUPACK, Control de Facturas o Trading OS. Se documenta la elección y se actualizan blueprint y roadmap antes de ejecutar cambios dependientes.

## 21. Fronteras de alcance y criterio de inicio

Quedan fuera de la primera implementación: juez automático, predicción de sentencias o éxito sin validación, presentación judicial autónoma, expansión simultánea a 18 países, scraping no autorizado, entrenamiento con expedientes de clientes por defecto y réplica completa de sistemas fiscales sin contrato local validado.

No queda fuera la operativa del estudio. El roadmap construye ese alcance en fases y exige un flujo completo para piloto. Un motor aislado puede ser un hito técnico, pero no se comercializa como el OS terminado.

**Próximo gate:** cerrar la viabilidad de fuentes y el corte correcto de Mussi. Puede avanzar investigación documental y diseño lógico; no puede adelantarse la clonación desde un corte antiguo ni emitir un prompt de implementación que adivine stack, permisos, contratos o criterios de aceptación pendientes.

## 22. Referencias de evidencia y archivos del paquete

Las fichas de fuentes conservan entradas oficiales, observaciones, límites y siguiente prueba. Referencias principales: [API SILpy](https://datos.congreso.gov.py/opendata/api), [muestra JSON](https://datos.congreso.gov.py/opendata/api/data/ley/134254), [Swagger v2](https://datosv2.congreso.gov.py/web/api-doc/index.html), [jurisprudencia CSJ](https://www.csj.gov.py/app/jur/), [legislación CSJ](https://www.csj.gov.py/legislacion), [Gaceta](https://www.gacetaoficial.gov.py/), [Constitución/Cultura](https://cultura.gov.py/marcolegal/constitucion-nacional-1992/).

`LAW_ORDER_OS_ROADMAP_v1.1.html` y `.md` contienen las fases y gates. `fuentes/` contiene el informe y registro JSON. `anexos/` contiene solicitudes no enviadas, registro de decisiones, contrato de arranque y handoff de continuidad. `evidencia/` diferencia observaciones web, limitaciones del runtime y controles del paquete documental.

**La aplicación no está construida. El blueprint sí queda documentado; las decisiones abiertas siguen abiertas.**


---

## ADDENDUM DE EJECUCIÓN v1.1 — no modifica la arquitectura

F1 continúa abierto. Se ampliaron fuentes de 11 a 15 fichas y se creó un manifiesto de 8 muestras/candidatos. Las tres salas están representadas mediante PDFs vistos por herramienta web, no mediante una integración operativa. Cero fases cerradas. F2 permanece bloqueado por el snapshot local vigente.

Registro de hallazgos: `AVANCE_F1_v1.1.md`. Contratos/correcciones de fuentes: `fuentes/FUENTES_Y_APIS_PARAGUAY_v1.1.json`. Lo descrito antes como pendiente puede tener una muestra observada; no se convierte por eso en DONE.
