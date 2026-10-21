# Auditoría factual del estado actual

Corte: 2026-10-13. Raíz: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/`. IMPLEMENTED significa código presente; TESTED_OFFLINE significa prueba local; VERIFIED_REAL queda limitado a un hecho externo observado. No se etiqueta un servicio de memoria como producto real.

## Inventario reutilizable

Las rutas abreviadas de Junta parten de `junta-juridica/src/`. Pruebas están en `junta-juridica/tests/` salvo indicación. Todos los módulos siguientes dependen de contratos TypeScript/Zod y runtime Node; las integraciones HTTP reales siguen NOT_RUN para inferencia.

| Módulo / ruta | Entrada → salida | Estado / evidencia | Riesgo y reutilización |
|---|---|---|---|
| domain/contracts.ts, guards.ts | Requests/ACL/snapshot/config → contratos validados | IMPLEMENTED / TESTED_OFFLINE; unit y adversarial | Reutilizar contratos versionados; el host debe autenticar ACL. |
| ingestion/index.ts, bundle.ts, provenance.ts | Original UTF-8/bundle/claims/registry → documentos y verificación | TESTED_OFFLINE; provenance/versions | No admite PDF binario separado del texto revisado. Registry externo, no autodeclarado. |
| retrieval/index.ts | Consulta/scope/snapshot → pasajes y cobertura | TESTED_OFFLINE; retrieval | Recuperación local; no RAG oficial autenticado ni índice multiestudio productivo. |
| evidence-router/index.ts | Evidencias → selección/prioridad Jev | TESTED_OFFLINE; contratos/providers | No eliminar originales; proveedor real bloqueado. |
| context-builder/index.ts | Evidencias/prioridades → contexto Luna con referencias | TESTED_OFFLINE | Preservar manifiesto/omisiones; sin calidad real de cuenta medida. |
| principal-analysis/index.ts | Cuestión/contexto → análisis Sol Medium | TESTED_OFFLINE | Un problema delimitado, límite de presupuesto; análisis nunca aprobación. |
| adversarial-audit/index.ts | Análisis íntegro/originales → objeciones Gemini | TESTED_OFFLINE; auditor-budget | Bloqueo si no cabe; no truncar ni afirmar cobertura total. |
| citation-checker/index.ts, extraction.ts | Texto/citas/registry → identidad/cotejo/gate | TESTED_OFFLINE; extracción y procedencia adversariales | FAIL conocido 11/12 civil en palabras; confianza real bloqueada. No modificar holdout. |
| orchestration/index.ts, issue-plan.ts | Request inmutable → stages/run parcial/revisión | TESTED_OFFLINE; E2E | Conservar cancelación, locks, presupuesto, no replay incierto. |
| providers/contracts.ts, offline.ts | Interfaces → respuestas simuladas rotuladas | TESTED_OFFLINE; providers | Simuladores solo prueba; no UI de producción con respuestas falsas. |
| providers/live.ts, config.ts, preflight.ts | Config/proofs/HTTP → adapters/readiness | TESTED_OFFLINE; preflight/wire | Transporte falso probado, cuenta real bloqueada. No cambiar modelos. |
| persistence/index.ts | Artefactos/run/locks → archivo local durable | TESTED_OFFLINE | Persistencia local de Junta no es BD empresarial del OS, ni auth web. |
| telemetry/index.ts | Usage/costos/eventos → registros de ejecución | TESTED_OFFLINE | Costos simulados no factura; evitar prompts/documentos privados en logs. |
| cli/index.ts, demo.ts, benchmark.ts; scripts/board.mjs | Comandos → reportes/estado | TESTED_OFFLINE; smoke actual guardado aparte | Usar IDs/salidas nuevas; rutas live exigen autorización que sigue ausente. |
| os-core/src/contracts.ts | Inputs/entidades → schemas/puertos | IMPLEMENTED / TESTED_OFFLINE | Reutilizar identidad≠membresía; requiere delta async/blob/proceeding. |
| os-core/src/authorization.ts | Principal/membresía/participación → permiso o rechazo | TESTED_OFFLINE; core/review | Denegación servidor reutilizable; BD aún no implementada. |
| os-core/src/service.ts | Credencial/comando → dominio+actividad atómicos según puerto | TESTED_OFFLINE; 42 casos OS | Reutilizar métodos y reglas, adaptar await, no crear backend paralelo duplicado. |
| os-core/testing/memory.ts | Identidades sintéticas/datos → repositorio volátil | TESTED_OFFLINE, excluido build | Nunca conectar a app real como persistencia; test demuestra pérdida de datos. |
| phase2/tooling/review-pdfs.mjs | PDFs locales → texto/render PDF.js | IMPLEMENTED; revisión local documentada | Alternativa Node a Python existente; no OCR ni revisión jurídica integral. |
| phase2/corpus/originals; OFFICIAL_CORPUS_MANIFEST.json | Tres descargas previas → bytes/hash/metadatos | Recuperación VERIFIED_REAL histórica; integridad offline actual | Sin nueva descarga; constitutional escaneado, penal identidad contextual. |

## Superficie real del OS

13 tablas de contratos: lawFirms, memberships, clients, contacts, relatedParties, matters, participants, documents, documentVersions, tasks, drafts, reviews, activities. Identity se obtiene por Authenticator, no por una tabla empresarial implementada. Métodos presentes: create/getLawFirm, add/deactivateMember, create/getClient, createContact, create/getMatter, grant/revokeParticipant, createRelatedParty, create/getDocument, add/publish/getDocumentVersion, create/getTask, setTaskStatus, prepare/get/reviseDraft, request/decideDraftReview, matterActivity. No endpoints HTTP implementados.

Faltan consultas paginadas/listados operativos, actualización/cierre de asunto, reasignación responsable, procedimientos, búsqueda productiva, agenda/plazos, comunicaciones/portal, honorarios/cobros, entrega/presentación. Campo cerrado/estado en contrato no prueba un caso de uso para cerrarlo. Los 14 pasos de Fase 2 son de servicio y difieren del nuevo slice: no incluyen crear identidad real ni un onboarding web.

Persistencia: CorePersistence.transaction acepta callback async pero get/list/insert/replace de CoreTransaction retornan valores síncronos. Authorization y comandos consumen esos valores sin await. Un adaptador `pg` no puede satisfacerlo directamente; precargar un tenant entero genera riesgos de aislamiento/concurrencia y no se propone. `original_base64` incorpora bytes en la entidad; se propone migrar con versionado explícito, manteniendo original y SHA.

## Verificación en este corte

| Verificación | Resultado y límite |
|---|---|
| node --version | v24.20.0; package requiere >=22 |
| Dependencias instaladas/lock | TypeScript 5.9, Vitest 4, Zod 4; sin React/Vite/Next/Fastify/pg/Supabase en app actual. package.json usa rangos; conservar lock y fijar nuevas versiones al aprobar. |
| Suite nueva integrada | 271/271 PASS, 17 archivos; OS 42 incluidos, no sumar. `f0-f1/reports/vitest.json` |
| npm.cmd run typecheck | PASS, exit 0 |
| npm.cmd run build / build:os-core | PASS ambos, exit 0; biblioteca, no servidor ejecutable |
| CLI guardia sin red | HUMAN_REVIEW_PENDING, PASS_IN_SCOPE, SIMULATED_VERIFIED; `f0-f1/reports/smoke-check.json` |
| Corpus | Siete pruebas integridad incluidas; no revisión nueva ni atestación. |
| Benchmark bibliográfico | Se inspeccionó medición congelada: detección12/12, extracción11/12, false_verified0 con gate cerrado. No reejecutado ni afinado. |
| Google401/Jev/OpenAI | Evidencia histórica inspeccionada; no se consultaron cuentas de nuevo. |
| Git | `git rev-parse --show-toplevel`: exit128, sin repositorio. Rama/SHA null. |

Configuración `vitest.config.ts` incluye Junta, OS y corpus; setup bloquea fetch. El smoke añade preload `phase2/tooling/block-network.mjs`. No se agregaron tests de aplicación inexistente; las nuevas pruebas durables están especificadas en OS_CORE_E2E_ACCEPTANCE.md para ejecutarlas cuando exista infraestructura.

## Preservación

Antes de instalar docs se capturaron 483 archivos en `f0-f1/reports/baseline.json` (incluye fuentes, dist, históricos, originales, paquetes; excluye node_modules, .npm-cache, .git y nuevos f0-f1). Es inventario SHA, no backup de contenido independiente; el baseline de contenido previo `phase2/baseline` permanece. Verificación posterior en `f0-f1/reports/final-verification.json`. No se inicializó Git ni se tocó otro proyecto. Persisten BLOCKED auth real/BD/RLS/UI y NOT_RUN E2E empresarial, inferencia real y despliegue.

## Matriz de alcance Blueprint → código → Roadmap

Fuente: `docs/LAW_ORDER_OS_BLUEPRINT_v2.0.md` §05. Los módulos de producto no son equivalentes uno a uno a carpetas de Junta. Prueba de presencia de un campo no acredita la capacidad entera.

| ID / módulo | Código o evidencia actual / pruebas | Estado y faltante | Roadmap / decisión |
|---|---|---|---|
| OS-01 Captación/intake | Client/Contact, core.test.ts | PARTIAL offline; faltan consulta/aceptación/conversión sin duplicar | F3,F8; política directorio/piloto |
| OS-02 Conflictos | Ningún motor de conflictos; RelatedParty solo almacena relación | NOT_STARTED; revisión humana y búsqueda con permisos | F3,F8; grant de conflictos explícito |
| OS-03 Encargo/propuesta | Contrato financiero nuevo, sin código engagement | SPECIFIED; aceptación/versión/alcance económico pendientes | F8-T05; FIN-01 |
| OS-04 Asuntos/procedimientos | Matter/participants/service, core.test.ts | TESTED_OFFLINE de asunto; falta Proceeding0..N, UI y SQL | F3-T03/07; ADR+política |
| OS-05 Mi día/equipo | Task/reviews offline; UI spec/GETmy-day propuestos | SPECIFIED; queries y panel efectivo pendientes | F2-T04,F3-T05 |
| OS-06 Documentos/expediente | Version/hash/CAS; persistence/review tests | TESTED_OFFLINE parcial; blob privado/annex/export web faltan | F4; delta blob V2 |
| OS-07 Investigación/Junta | Junta modular, e2e/providers/adversarial | TESTED_OFFLINE; cuenta/corpus/OS integration BLOCKED | F5,F6,F7; DATA/AI |
| OS-08 Editor jurídico | Draft/revise/review offline, review.test.ts | TESTED_OFFLINE workflow; editor/plantillas/secciones/checker export final faltan | F4-T03,F7-T04 |
| OS-09 Tareas/workflow | Task/review+actividad; core/review tests | TESTED_OFFLINE parcial; dependencias/jobs/notificaciones faltan | F3-T04,F4,F8; outbox propuesto |
| OS-10 Agenda/seguimiento | Task.internal_due_at; no event/deadline | SPECIFIED; fechas internas≠audiencia/plazo legal | F8-T01/02; LOCAL-01 |
| OS-11 Comunicación/portal | Ningún conector/shared_item | SPECIFIED; share versión exacta, aprobación de envío | F8-T03/04; GOV-01 |
| OS-12 Honorarios/costos | Contratos de diseño, sin servicio | SPECIFIED; importes/moneda/fondos separados | F8-T05; FIN-01 |
| OS-13 Facturación/cobros | Contratos de diseño, sin ledger | SPECIFIED; allocations/reversos/tributos no implementados | F8-T05/06; LOCAL-01 |
| OS-14 Dirección/cierre | Estado CLOSED existe sin comando de cierre | SPECIFIED; reportes/cierre/retención/export faltan | F8-T07,F9,F10; GOV/FIN |

| Invariante §02 | Evidencia / límite de cumplimiento | Gate |
|---|---|---|
| INV-01 OS integral | Plan conserva OS-01..14; implementación parcial, no producto completo | F2–F10 |
| INV-02 asunto distinto de procedimiento | Matter consultivo probado; Proceeding nuevo propuesto | F3-T07 |
| INV-03 panel por abogado | UI spec accionable preparada; app ausente | F2-T04 |
| INV-04 Junta propia | ADR Junta aceptado + módulos existentes/tests | F0-T02 DONE documental |
| INV-05 Sol Medium | config/providers.live y tests de wire; cuenta real no validada | F6-T03 |
| INV-06 Jev no elimina originales | evidence-router + snapshots/persistencia probados offline | F6/F7 reales pendientes |
| INV-07 Luna no sustituye originales | context-builder/retrieval/budget tests | F7-T03 real pendiente |
| INV-08 Gemini/checker separados | adversarial-audit/citation-checker + tests | F5/F6 confianza pendiente |
| INV-09 jurisprudencia falsa como objetivo | benchmark preservado; false_verified0 no demuestra precisión | F5-T08/F9-T06 |
| INV-10 decisión humana | HUMAN_REVIEW_PENDING smoke, review.test.ts exact version | E2E persistente pendiente |
| INV-11 sin operaciones no autorizadas | Guardia red tests/smoke, cero inference/deploy, código histórico intacto | Restricción vigente |
| INV-12 operación sin LLM | Servicio Core no depende providers; AI01 futuro prueba app | F3/F4 |
| INV-13 mocks separados | testing excluido build; assurance y reportes honestos | Producto real BLOCKED |
| INV-14 UI compacta | Tokens/rangos/QA medible en UI spec; screenshots NOT_RUN | F2-T03/06/07 |

Secciones complementarias del Blueprint: §01 autoridad→D-02; §03 navegación/cadena→UI spec y plan P4–P9; §04 acceso→contratos/SEC; §06 datos→contratos/FKs; §07 stack/UI→ADR/UI spec; §08–09 fuentes→OFFICIAL_CORPUS_MANIFEST/P2-TRUST/PDF/OCR; §10 EvidencePack→D-11; §11 pipeline→inventario Junta; §12 checker→benchmark/FAIL y registry; §13 documento→S08,S12–14/DOC; §14 agenda/comunicaciones→contratos posteriores; §15 economía→FIN-01; §16 propia→ADR Junta; §17 integración→contratos mapping; §18 QA→aceptación/roadmap; §19 operación→ADR backups/logs; §20 pendientes→BLOCKERS_AND_DECISIONS; §21 alcance→plan/dependencias; §22 instalación→DOCS_RECONCILIATION_REPORT. Ninguna sección no implementada queda marcada DONE por tener una especificación.
