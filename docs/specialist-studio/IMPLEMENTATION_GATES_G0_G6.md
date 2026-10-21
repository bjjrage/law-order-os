# Implementación incremental y criterios DONE

Actualización documental: 15/10/2026, America/Asuncion. Referencia de decisiones/handoff: 14/10/2026; propuestas aún sin aprobación funcional.

Estado al 15/10/2026: ADR reconciliado aprobado y piloto G2_OFFLINE autorizado/implementado. [Alcance y evidencia del piloto](ELENA_LOCAL_PILOT_2026-10-15.md). El flujo generativo completo/evaluación jurídica de G2 y G3–G6 siguen pendientes. Dashboard/Director completo no se declaran implementados.

## Continuación vigente

Revalidación nueva: [informe de lectura y contratos](reports/design-reconciliation-2026-10-14.json). Los tests/capturas citados más abajo pertenecen a la auditoría anterior; no se repitieron ni equivalen a evaluación de especialistas.

Se agregan 22 [paquetes](SPECIALIST_CAPABILITY_PACKS.md), [catálogo lógico](contracts/SPECIALIST_CAPABILITY_PACKS.v1.json) y [protocolo contractual](CONTRACTUAL_PILOT_EVALUATION.md). Director/preasunto, modalidades, adversario transversal y separación de consentimientos están reconciliados en ADR; no implementados.

## G0 — foto real

Entregado: [mapa actual](CURRENT_RUNTIME_MAP_2026-10-14.md), discrepancias D01–D15, hashes, GET locales, capturas actuales, recuperación del run LIVE, probe negativo y suites offline. G0 local auditado; identificación Git/proceso completa y seguridad empresarial siguen PARTIAL/BLOCKED explícitos.

Rutas comprobadas: `apps/web/src/{App,MatterJunta,local-api,local-storage}.tsx/ts`, `scripts/{local-browser,junta-bridge,junta-case,library-research,library-corpus-store}.mjs`, `os-core/src`, `junta-juridica/src/{orchestration,providers,citation-checker,retrieval,persistence}`, `apps/api/src`, `packages/persistence-postgres`, ADRs V2/OS.

DONE de auditoría: cada afirmación distingue existencia, ejecución, evidencia histórica y límites; fuentes preservadas; sin mutación de runtime. Pendiente antes del slice: baseline recuperable y manifest de versión de implementación, sin inventar SHA; revalidar divergencias que aparezcan. La habilitación empresarial de Supabase/auth no es requisito para diseñar ni probar local sintético, sí para afirmar seguridad de datos reales.

## G1 — diseño reconciliado para aprobar

Ocho entregables escritos en esta carpeta. Decisiones vigentes P01, P02-R1, P03-R1 y P04–P16 están propuestas. C01, catálogo de seis áreas, y V01, primera referencia v3 de personajes humanos 3D tipo emoji, aceptados por el propietario; adaptación visual y catálogo estructurado incorporados sin habilitar runtime. Addendum de Blueprint/Roadmap incluido en ADR sin modificar MD/HTML originales.

DONE de preparación: contratos completos, tabla de reutilización/diferencias, plan, riesgos, pruebas, criterios de aceptación y blockers. DONE del gate: aprobación expresa del propietario de ADR/decisiones y resolución de blockers necesarios para el alcance siguiente. Estado actual READY_FOR_REVIEW, no APPROVED.

## G1: aceptación de capacidades y alcance antes de programar

Curador/revisor humano, fuentes por subperfil, manifest/holdout/umbrales y permisos deben quedar identificados antes de habilitar un perfil. El tamaño propuesto y ejemplos del protocolo no son evidencia de mejora. Aprobar el ADR no activa los 22 paquetes ni permite inferencia paga.

Después de aceptar el ADR, concretar el diseño conectado Dashboard/Mi día/Equipo jurídico y estados; no otra serie de avatares. Implementación offline del piloto dentro de asunto puede avanzar por alcance aprobado, sin depender de voz ni Director generativo completo.

Lotes adicionales futuros: ingreso IntakeDraft/CoordinationGrant y enlace Core; agregado autorizado de KPI; DTO público saneado; diseño/QA reales; Director generativo acotado con presupuesto propio dentro del techo agregado. Son contratos pendientes, sin nuevas URLs/DDL aprobadas.

## G2 — un especialista funcional en un asunto

Alcance recomendado: subperfil contractual de Civil y patrimonial EXPERIMENTAL, datos sintéticos locales, modo asistido por reglas rotulado (Director generativo en lote posterior P02-R1), Jev activo, contexto Luna y opinión Luna separados, checker terminal, persistencia y borrador versionado. El catálogo aprobado contiene seis áreas, pero solo se habilita el subperfil del slice probado. Primero probar sin proveedores reales; una inferencia real futura requiere permiso específico/presupuesto/precios/datos autorizados.

| Lote | Rutas existentes a extender después de aprobar | Trabajo |
|---|---|---|
| G2.1 | Core `contracts.ts`, `service.ts`, `authorization.ts`; BrowserPersistence/local-api | Asignación IA relacionada, schema/versionado y CAS, activity; responsable humano canónico. Import/export legacy compatibles; no reemplazar snapshots locales |
| G2.2 | `orchestration/issue-plan.ts`, providers/contracts/live, domain/contracts | ChiefDispatchPlan y perfil/opinión; reusar adaptador OpenAI genérico para Luna, sin rebautizar Context Builder ni ejecutar Junta fija por error |
| G2.3 | `evidence-router`, `context-builder`, retrieval, `scripts/library-research.mjs` | Congelar evidencia y bibliografía, recuperar originales y cobertura por perfil; permisos y versiones conservados |
| G2.4 | orchestration, telemetry, persistence; `scripts/junta-case.mjs` | Ejecutor aditivo/versionado, consentimiento y reserva central; registrar tareas/consumo y errores, lectura legacy intacta |
| G2.5 | citation-checker/extraction/index, registry, junta-presentation | Gate sobre manifiesto completo y artefacto final; identidad/procedencia reales, referencia falsa bloqueada, documento/renderer versionados |
| G2.6 | MatterJunta, componentes fuentes/revisión/resultado, App/styles | Controles mínimos del titular/equipo y UI seleccionada; estado de fuente y revisión humana separados; creación de borrador con vínculo de auditoría |

La ubicación exacta de archivos nuevos y schemas de persistencia se fija al implementar sobre baseline aprobado. No hay nuevos endpoints/DDL aprobados por esta lista. Si se modifica el puerto Core, aplicar coherencia a adaptadores/browser/backup; modo servidor conserva controles y no se migra producción.

DONE: crear/confirmar titular y humano separados; consulta del asunto persiste y recupera tras recarga; modelo registrado Luna, cero Sol/Gemini; evidencia localizable y cobertura honesta; cita falsa no VERIFIED; auditoría ligada a output/borrador exactos; nueva versión invalida verificación; errores sin demo encubierta; costo/reserva contabilizados; capturas compactas y navegación/teclado probados. Un positivo SIMULATED_VERIFIED es solo fixture; positivo VERIFIED real requiere fuente autorizada independiente. Mostrar pendientes es un resultado válido del piloto, no certificación de fuentes.

## G3 — convocatoria dinámica

Extender plan/ejecutor/perfiles y vista del equipo, manteniendo G2 intacto. Dos materias evaluadas, snapshots comunes y aportes diferenciados; evidencia propia/localizable, fuente no disponible y disciplina faltante explícitas. Invitar/quitar manual invalida plan cuando corresponda. No activar Tributario por tener un avatar o prompt sin corpus/pruebas.

DONE: E2E dos perfiles, autorías/disensos y fuentes por participante, ausencia de llamadas ocultas, presupuesto agregado con fan-out y cancelación controlados, aislamiento en datos/cachés/jobs, regresión G2. El experto titular propone integración, Chief no dicta.

## G3: Junta completa como ampliación posterior

La prueba inicial de dos perfiles no demuestra Junta completa. Para ofrecer FULL_BOARD funcional, las seis áreas necesitan subperfil habilitado, pregunta propia, presupuesto central y estado por participante. Seleccionar/confirmar prepara plan, no seis llamadas automáticas. Un perfil ausente o fuera de ámbito produce carencia visible. Profundidad y adversario no se heredan de la modalidad.

## G4 — debate Gemini y checker final de todos

Extender AuditInput/AuditSchema mediante versión/adaptador y nuevos eventos de objeción/réplica, sin romper lectura legacy. Límites P06/P09 explícitos. Recoger todas las salidas y render final antes del checker. Cache/revalidación usa la misma política completa, no solo PrincipalAnalysis.

DONE: una cita falsa introducida SOLO en Gemini queda detectada/no verificada; titulares/consultores responden; disenso persiste; una nueva cita en integración o exportación reabre control. Rondas/costos/timeouts se detienen y muestran parcial. Cero falsos VERIFIED en conjunto de evaluación, con positivos genuinos y cobertura medida, no solo gate permanentemente cerrado.

## G5 — Sol manual

Extender consentimiento, provider de opinión y control de potencia; preservar perfil/evidencia/herramientas. Modelo efectivo y reasoning medium registrados. El override se liga a encargo/participante, no a Matter global ni a todos los invitados.

DONE: sin autorización no hay llamada Sol; solo perfil seleccionado se potencia; solicitud posterior crea nueva edición y checker nuevo; consulta siguiente vuelve a Luna; gasto bajo techo; sin fallback silencioso; ruta G2 conserva funcionamiento.

## G6 — consolidación del OS integral

Conectar resultado/auditoría con editor/revisión/documentos/tareas y después agenda/comunicaciones/honorarios según roadmap. No condicionar operativa convencional a disponibilidad IA. Evaluación comparativa contra Junta fija con misma evidencia/preguntas y revisión humana.

DONE: asunto → especialistas → debate opcional → checker final → revisión humana → escrito versionado, con costos/fuentes/procedencia auditables. Regresiones de operación sin LLM. Retirar/modificar ruta legacy exige equivalencia comprobada y autorización independiente; este plan no la concede. Enterprise exige sesión/tenant/RLS/storage/jobs/backup y revocación probados; producción exige su propio permiso.

## Matriz de los 22 casos del handoff

Los IDs corresponden a la lista original, no a pruebas ya implementadas. La suite vigente no demuestra estos DONE nuevos.

| Caso | Aceptación | Gate principal |
|---|---|---|
| 01 | Civil Luna sin Sol/Gemini ni Junta fija involuntaria | G2 |
| 02 | Chief solo plan estructurado, sin mérito | G2 |
| 03 | Humano/titular separados, asignación durable/versionada | G2 |
| 04 | Selección explícita y fuera de alcance visible | G2 |
| 05 | Materias/evidencias diferentes, tenant protegido | G3 + enterprise |
| 06 | Jev no elimina evidencia; bypass necesita política | G2 |
| 07 | Sol solo encargo/perfil autorizado | G5 |
| 08 | Gemini opcional, objeción/réplica/disenso | G4 |
| 09 | Cita falsa solo Gemini bloqueada al final | G4; hueco actual reproducido |
| 10 | Cita falsa titular bloqueada | G2 |
| 11 | Cita falsa consultor bloqueada | G3 |
| 12 | Metadatos Gemini erróneos → METADATA_MISMATCH | G4 |
| 13 | Referencia ambigua/no extraída cierra gate de cobertura | G2/G4 |
| 14 | Integración post debate cubierta por versión exacta | G4 |
| 15 | Edición humana no hereda comprobación | G2/G6 |
| 16 | Fuente no autenticada/firma interna no VERIFIED | G2 + fuentes |
| 17 | Corpus ausente ≠ inexistencia; proveedor caído honesto | G2 |
| 18 | 401/429/timeout → parcial/bloqueo real | G2/G4 |
| 19 | Retries/reservas/tokenización sin fallback | G2/G5 |
| 20 | UI compacta y estados distinguibles en dos tamaños | G2 y regresión cada gate |
| 21 | Acceso directo por ID/caché/jobs entre estudios denegado | G2 contratos + gate enterprise real |
| 22 | Nuevo documento conserva snapshot y marca OUTDATED | G2/G6 |

Adicionales: cita en recomendación/annexo/consulta reproducida; título de norma sin número; normativa por instrumento/artículo/edición; output omitido del manifiesto; renderer altera literal; revocación de atestación; clic de personaje humano 3D no ejecuta modelos; prefers-reduced-motion; cambio de dueño revoca plan; dos workers consumen el mismo presupuesto; aprobación humana nunca cambia label bibliográfico. Cero nombres/versiones de modelos o proveedores en DOM/ARIA/tooltips/errores/configuración/historial/costos/exports y texto de assets; identificadores efectivos solo en auditoría técnica interna. El personaje conserva identidad al cambiar profundidad.

## Negativos adicionales de la reconciliación

Director emite mérito → rechazo; preasunto no obtiene acceso por ID; enlace/creación no duplica Matter; confirmación de equipo sin autorización no ejecuta; grant conversacional no autoriza análisis; cambio de alcance invalida grant; reserva coordinación+especialistas+debate no supera techo; FULL_BOARD con perfil faltante no aparece completado; focal+adversario no activa seis; paquete nuevo no hereda evaluación; KPI personal no se rotula estudio; voz sin contrato no se anuncia disponible.

## Métricas y reversión

Registrar por ruta/versión/perfil: recuperación decisiva, detección/extracción y pendientes, falso VERIFIED, fuentes genuinas sin resolver, costo estimado/facturado/incierto, llamadas extra, latencia y utilidad humana. P50/P90 solo con muestra identificada. No comparar precio de una respuesta Luna con costo de Junta completa sin sumar contexto/Jev/debate/checker y fallos.

Mantener pruebas actuales y benchmark histórico intactos. Las regresiones nuevas se agregan después de aprobación a la suite correspondiente; no ajustar holdout visto para anunciar validación independiente. Reversión del piloto deshabilita nuevos encargos especialistas, preserva datos/historial y mantiene lectura Junta legacy y operativa del estudio. No rerun automático ni borrado de asignaciones/historial.
