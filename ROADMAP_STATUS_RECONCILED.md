# Roadmap reconciliado F0–F10

2026-10-13. Raíz: C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/. Fuente canónica preservada: docs/LAW_ORDER_OS_ROADMAP_v2.0.md. Esta matriz es seguimiento nuevo, no edición de checks del original. Cada descripción corresponde literalmente a su ID canónico; evidencia relativa a raíz. JSON completo: f0-f1/reports/roadmap-matrix.json.

DONE se limita al criterio de la tarea indicada, nunca a la fase por arrastre. TESTED_OFFLINE prueba contrato/servicio, no UI/SQL real. SPECIFIED significa documento preparado, cero implementación nueva; PARTIAL exige completar el faltante. FAIL es defecto conocido conservado. NOT_RUN distingue prueba externa no ejecutada de NOT_STARTED. No hay VERIFIED_REAL nuevo de proveedores o producto; la recuperación oficial histórica tiene alcance explícito en auditoría.

## Estado de fases

| Fase | Resultado reconciliado / gate restante |
|---|---|
| F0 | Reconciliación solicitada entregada; Roadmap F0 PARCIAL por piloto, responsables/fechas y aprobación documental. |
| F1 | Propuesta completa READY_FOR_APPROVAL; BLOCKED para DONE por aprobación stack e infra real. |
| F2 | Especificada; app/sesiones/UI/RLS NOT_STARTED o NOT_RUN. |
| F3 | Biblioteca TESTED_OFFLINE; UI y persistencia pendientes. |
| F4 | Workflow TESTED_OFFLINE; storage/editor/descargas/actos externos/annex pendientes. |
| F5 | Tres originales conservados; confianza/OCR/derechos/RAG real BLOCKED. |
| F6 | Regresión offline reproducida; extracción conocida FAIL, cuenta/smoke real BLOCKED. |
| F7 | Integración OS/Junta no implementada; contratos preparados. |
| F8 | Contratos administrativos propuestos, sin implementación funcional. |
| F9 | Piloto/E2E integral NOT_RUN; requiere decisiones y fases previas. |
| F10 | Release NOT_RUN y deploy no autorizado. |

## Matriz de tareas

| ID / requisito canónico | Estado | Código, pruebas o evidencia | Faltante / decisión |
|---|---|---|---|
| **F0-T01** — Instalar blueprint, roadmap, ADR y dossier F1 en `docs/` sin borrar fuentes previas. | DONE | docs/**; canonical-installation.json | Instalación de12 documentos preservada; auto-hash del manifiesto discrepante registrado D-01. |
| **F0-T02** — Registrar decisión de Junta propia y mapa de reemplazo 3→2→1 / Mussi sin arrastrar código. | DONE | junta-juridica/docs/ADR_JUNTA_JURIDICA_V2.md; DOCS_RECONCILIATION_REPORT.md | Junta propia vigente; Mussi histórico no se ejecuta. |
| **F0-T03** — Inspeccionar repositorio y estado local (sin Git reportado) antes de crear tareas. | DONE | OS_CURRENT_STATE_AUDIT.md; f0-f1/reports/baseline.json | 483 archivos inventariados; Git ausente. |
| **F0-T04** — Aprobar/ajustar responsables y estudio piloto para flujos jurídicos reales. | BLOCKED | BLOCKERS_AND_DECISIONS.md / PROD-01 | Propietario debe designar estudio piloto, responsables jurídicos/operativos. |
| **F0-T05** — Conservar los reportes F1/F2 y hashes históricos como evidencia inmutable. | DONE | f0-f1/reports/final-verification.json; phase2/baseline | Preservación SHA de todos archivos previos; informes/holdouts intactos. |
| **F0-T06** — Registrar decisiones pendientes, bloqueos y no negociables con dueño y fecha de cierre. | PARTIAL | BLOCKERS_AND_DECISIONS.md | Dueños por función propuestos; personas/fechas de cierre no aprobadas. |
| **F1-T01** — Leer el `OS_CORE_ARCHITECTURE.md` real y comparar alternativas documentadas. | DONE | OS_CORE_ARCHITECTURE.md; ADR_OS_001_DECISION_PROPOSAL.md | Lectura y comparación A/B/C completas, sin adopción. |
| **F1-T02** — Proponer y aprobar framework web, API/backend, PostgreSQL, auth, storage, jobs y región. | BLOCKED | ADR_OS_001_DECISION_PROPOSAL.md | B propuesta; falta aceptación expresa del propietario. |
| **F1-T03** — Definir entornos dev/preview/prod, secrets, auditoría y responsabilidades de deploy. | SPECIFIED | ADR_OS_001_DECISION_PROPOSAL.md; OS_CORE_IMPLEMENTATION_PLAN.md | Dev/preview/prod/secretos definidos; entornos no creados ni probados. |
| **F1-T04** — Definir frontera tenant y autorización por asunto en API/BD/storage/jobs. | SPECIFIED | OS_CORE_DATA_API_CONTRACTS.md; authorization.ts | Fronteras propuestas, no RLS empresarial; cerrar política de directorio/roles. |
| **F1-T05** — Crear Git local y estrategia de rama protegida tras preservar baseline; remoto solo con autorización. | BLOCKED | OS_CORE_IMPLEMENTATION_PLAN.md / Git | Baseline y estrategia listos; no se inicializó Git, ningún remoto autorizado. |
| **F1-T06** — Definir restauración, backup, logs seguros y plan mínimo de operación. | SPECIFIED | ADR_OS_001_DECISION_PROPOSAL.md / operación | DB+objetos/RPO/RTO/logs propuestos; restore NOT_RUN. |
| **F1-T07** — Crear ADR aprobado y contratos API/datos compatibles con OS Core offline. | BLOCKED | OS_CORE_DATA_API_CONTRACTS.md; ADR propuesto | Contratos preparados; falta ADR aceptado y pruebas básicas de infraestructura. |
| **F2-T01** — Implementar shell web navegable y autenticación real en dev. | NOT_STARTED | apps/web y apps/api inexistentes | F1 aprobado; implementar sesión IdP real, no Authenticator sintético. |
| **F2-T02** — Implementar estudio, membresías y selector/contexto; denegación por defecto. | TESTED_OFFLINE | os-core/src/service.ts; os-core/tests/core.test.ts | Servicios firm/membership; faltan SQL/API/selector web. |
| **F2-T03** — Crear sidebar compacta y topbar 42–48px, tipografía 12.5–13.5px, tablas densas. | SPECIFIED | UI_COMPACT_DESIGN_SPEC.md / tokens | Implementar CSS/shell real, sin zoom. |
| **F2-T04** — Crear panel «Mi día» para abogado, rol coordinador y administración con datos reales. | SPECIFIED | UI_COMPACT_DESIGN_SPEC.md; contrato GET my-day | Query autorizada/vistas por rol y acciones reales pendientes. |
| **F2-T05** — QA negativo multiestudio, RLS/servidor, sesión/revocación y controles de storage. | TESTED_OFFLINE | os-core/tests/core.test.ts; persistence.test.ts | Aislamiento servicio probado; E2E/RLS/storage/sesión reales NOT_RUN. |
| **F2-T06** — Capturas desktop 1440×900 y 1366×768 al 100%; comparación visual 85% sin CSS zoom. | NOT_RUN | UI_COMPACT_DESIGN_SPEC.md / QA | Falta UI; screenshots1440/1366 a100% y referencia85%. |
| **F2-T07** — Definir navegación teclado, focus visible y estados loading/empty/error. | SPECIFIED | UI_COMPACT_DESIGN_SPEC.md / accesibilidad | Teclado/foco/estados/reflow especificados, browser QA NOT_RUN. |
| **F3-T01** — Reutilizar contrato de dominio OS Core ya probado offline; auditar cambios del servicio. | PARTIAL | os-core/src/**; OS_CURRENT_STATE_AUDIT.md | Auditado y plan de reuso; adaptación async y app aún pendientes. |
| **F3-T02** — Persistir cliente/contacto/parte/estudio sin cruzar tenants. | TESTED_OFFLINE | contracts.ts/service.ts; core.test.ts | Client/contact/relatedParty separadas; falta persistencia SQL. |
| **F3-T03** — Crear asunto consultivo y asunto litigioso con responsables, participantes y estado. | TESTED_OFFLINE | service.ts createMatter/grantParticipant; core.test.ts | Tipos/responsable/participantes presentes; procedimiento nuevo, UI/SQL pendientes. |
| **F3-T04** — Implementar tareas y actividad auditada con asignación y vencimiento interno. | TESTED_OFFLINE | service.ts createTask/matterActivity; core.test.ts | Tarea/actividad de servicio; faltan queries Mi día/transporte durable. |
| **F3-T05** — Implementar vistas compactas de clientes/asuntos/tareas y filtros útiles. | SPECIFIED | UI_COMPACT_DESIGN_SPEC.md; contratos listados | Clientes/asuntos/tareas con filtros no implementados web. |
| **F3-T06** — Verificar E2E permisos y persistencia tras recarga, con dos estudios y dos abogados. | NOT_RUN | OS_CORE_E2E_ACCEPTANCE.md S03–S11/TX03 | Ejecutar con2 estudios/usuarios IdP, reinicio y nueva sesión. |
| **F3-T07** — No confundir asunto con procedimiento judicial ni calcular plazos por LLM. | PARTIAL | MatterInputSchema; OS_CORE_DATA_API_CONTRACTS.md / proceeding | Asunto consultivo sin expediente funciona offline; 0..N Proceeding y política plazos pendientes. |
| **F4-T01** — Subir originales sin sobrescritura; hash, extracción, versiones explícitas y permisos. | TESTED_OFFLINE | service.ts add/publishDocumentVersion; persistence.test.ts | Original/hash/publicación local; faltan Storage/staging/scan/SQL. |
| **F4-T02** — Relacionar documentos con asunto y responsables; registros inmutables de aprobación. | TESTED_OFFLINE | contracts.ts; service.ts decideDraftReview; review.test.ts | Vínculo de asunto/review+actividad; approval append-only SQL pendiente. |
| **F4-T03** — Implementar editor/borrador con versión y revisión interna, sin IA de producción. | TESTED_OFFLINE | prepareDraft/reviseDraft; review.test.ts | Workflow local; editor real no implementado. |
| **F4-T04** — Probar cambios de versión y prohibir aprobación implícita de una versión nueva. | TESTED_OFFLINE | os-core/tests/review.test.ts | Versión exacta/no herencia probado; repetir contra SQL/browser. |
| **F4-T05** — Diferenciar draft, revisión, aprobación, entrega y presentación con comprobante real. | SPECIFIED | OS_CORE_DATA_API_CONTRACTS.md / delivery,filing_receipt | Estados reales/recibos nuevos; no inferir presentación de descarga. |
| **F4-T06** — QA acceso privado y descargas/exports; E2E del ciclo documental. | NOT_RUN | OS_CORE_E2E_ACCEPTANCE.md S08/S12–14/DOC01–08 | Descarga privada/session/RLS/E2E documental pendiente. |
| **F4-T07** — Construir índice de expediente y anexos reproducibles sin alterar originales. | SPECIFIED | OS_CORE_IMPLEMENTATION_PLAN.md P9; DOC08 | Índice/annex package reproducible aún no existe. |
| **F5-T01** — Conservar y verificar los tres originales de Constitucional/Civil/Penal y sus hashes. | DONE | phase2/corpus/originals; phase2/tests/corpus-integrity.test.ts | Tres originales preservados/hash comprobado offline; DONE limitado a conservación. |
| **F5-T02** — Definir política de atestaciones institucionales autorizadas y registro confiable. | BLOCKED | ingestion/provenance.ts; PHASE2_BLOCKERS.md P2-TRUST | Ed25519 local probado; falta política/emisor institucional autorizado. |
| **F5-T03** — Acordar permisos de ingestión/indexación comercial, alcance de portales y versión normativa. | BLOCKED | OFFICIAL_CORPUS_MANIFEST.json; docs/fuentes/** | production_indexing_permitted=false; derechos/privacidad/versiones pendientes. |
| **F5-T04** — Cerrar OCR/QA de escaneos y anomalías de encabezados con revisión humana. | BLOCKED | phase2/tooling/review-pdfs.mjs; revisiones corpus | PDF.js sin Python ya disponible; OCR constitucional/QA humana civil/penal pendientes. |
| **F5-T05** — Construir conector autorizado para corpus finito y manifiesto sala/año/versión. | NOT_STARTED | download-official-corpus.mjs (recuperación finita, no conector) | Definir alcance/permiso y checkpoints de conector; no scraping masivo. |
| **F5-T06** — Conectar corpus verificado con resolver de referencias y RAG híbrido. | BLOCKED | retrieval/index.ts; citation-checker/index.ts | RAG local existe; falta corpus verificado e importación PDF trazable. |
| **F5-T07** — Ampliar leyes, códigos, Constitución y Gaceta con trazabilidad y texto vigente solo si comprobado. | NOT_STARTED | docs/fuentes/FUENTES_Y_APIS_PARAGUAY_v1.1.* | Inventario no es corpus vigente; ingesta normativa autorizada pendiente. |
| **F5-T08** — Benchmark externo independiente; registrar detección, extracción, ambigüedad, falso VERIFIED. | BLOCKED | BIBLIOGRAPHIC_BENCHMARK_REPORT.md; phase2/benchmark | 12/12 detección,11/12 extracción históricos; holdout externo/cotejo auténtico pendientes. |
| **F6-T01** — Reproducir 271 pruebas reportadas, typecheck, dos builds y smoke sobre código F2. | DONE | f0-f1/reports/vitest.json; smoke-check.json; checks.json | 271 tests/typecheck/2 builds/smoke reproducidos, solo offline. |
| **F6-T02** — Resolver el FAIL conocido de extracción 11/12 en development; congelar holdout externo nuevo. | FAIL | citation-checker/extraction.ts; bibliographic-first-evaluation.json | Número civil en palabras conocido11/12; no cambiar engine/holdout en reconciliación. |
| **F6-T03** — Verificar accesos reales: Jev, Luna, Sol 6.1 Medium, Gemini 3.8 Flash; no fallback oculto. | BLOCKED | MODEL_CONNECTIVITY_REPORT.md; providers/live.ts | Inferencia NOT_RUN; ningún modelo probado accesible en cuenta. |
| **F6-T04** — Solucionar Google HTTP 401 y configurar claves de forma segura; no imprimir secretos. | BLOCKED | phase2/reports/model-connectivity-metadata.json | Google401 histórico, no reintentado; configuración fuera del gate documental. |
| **F6-T05** — Preflight GET no generativo donde esté documentado; diferenciar 401/403/404. | PARTIAL | providers/preflight.ts; metadata histórico; pruebas HTTP falsas | GET Google401 es hecho previo; Jev/OpenAI sin consulta; no cuenta validada. |
| **F6-T06** — Ejecutar UNA Junta acotada solo con autorización expresa de gasto, techo y datos sintéticos. | BLOCKED | LIVE_SMOKE_PLAN.md; providers/preflight.ts | Gasto no autorizado; plan/corpus/proofs insuficientes. |
| **F6-T07** — Medir tokens reales, costo final, P50/P90 cuando haya muestra, cobertura y checker. | NOT_RUN | telemetry/index.ts; LIVE_SMOKE_PLAN.md | Contadores offline no son costo real ni p50/p90 de producción. |
| **F6-T08** — Marcar ejecución parcial y requerir revisión humana; no presentar result real si falla proveedor. | TESTED_OFFLINE | orchestration/index.ts; tests e2e | Run parcial/revisión humana local probado; ejecución real pendiente. |
| **F7-T01** — Desde un asunto autorizado crear cuestión jurídica y snapshot de evidencia. | SPECIFIED | OS_CORE_DATA_API_CONTRACTS.md / integración Junta | Falta UI/API investigación autorizada y mapping AccessContext servidor. |
| **F7-T02** — Permitir abrir investigaciones pasadas y distinguir CURRENT/OUTDATED. | PARTIAL | Junta snapshots/versiones; OS_CURRENT_STATE_AUDIT.md | Engine tiene scope/versiones; historial web CURRENT/OUTDATED no existe. |
| **F7-T03** — Recuperar originales en Sol/Gemini con presupuesto controlado y aislamiento tenant. | TESTED_OFFLINE | principal-analysis/adversarial-audit; unit budget | Acceso originales acotado local; falta aislamiento OS real y proveedores. |
| **F7-T04** — Aplicar checker a citas del borrador exportado, no solo a la salida inicial. | PARTIAL | citation-checker; safeExport CLI | Checker local/export Junta; borrador editable OS/export final sin integrar. |
| **F7-T05** — Enlazar análisis aprobado al documento y al responsable de revisión. | SPECIFIED | OS_CORE_DATA_API_CONTRACTS.md / integration | No enlace durable análisis→documento/revisor aún. |
| **F7-T06** — QA E2E de citas manipuladas, documento nuevo, revoke de permisos y bloqueo de fuentes. | NOT_RUN | OS_CORE_E2E_ACCEPTANCE.md SEC/DOC; tests adversariales Junta | E2E combinado real pendiente F4/F5/F6. |
| **F7-T07** — Verificar costo y latencia por trabajo sin presentar éxito de dictamen como validación de autenticidad. | NOT_RUN | telemetry/index.ts; MODEL_CONNECTIVITY_REPORT.md | Costo/latencia por trabajo real sin muestra. |
| **F8-T01** — Agenda de audiencias/fechas internas con responsable y estados no ambiguos. | SPECIFIED | OS_CORE_DATA_API_CONTRACTS.md / agenda; UI spec | Eventos/audiencias/estados nuevos, no confundir tarea con agenda. |
| **F8-T02** — Plazos procesales sugeridos ≠ confirmados; cálculo automático solo con reglas validadas. | BLOCKED | Contratos deadline; BLOCKERS_AND_DECISIONS.md LOCAL-01 | Reglas/calendarios jurídicos revisados y confirmación humana pendientes. |
| **F8-T03** — Solicitudes de documentación y comunicaciones con aprobación previa. | SPECIFIED | Contratos comunicaciones; Blueprint §14 | Conector/canal autorizado y aprobación de envío pendientes, nada enviado. |
| **F8-T04** — Portal de clientes para versiones explícitamente compartidas. | SPECIFIED | Contratos explicit_share; Blueprint §04/14 | Portal/roles nuevos sin implementación; compartir solo versión exacta. |
| **F8-T05** — Acuerdos de honorarios, gastos, anticipos, facturado y cobrado separados. | SPECIFIED | Contratos finanzas; Blueprint §15 | Acuerdos/gastos/anticipos/caja separados; ledger/allocations no implementados. |
| **F8-T06** — Conservar moneda/IVA/tributos sin inventar integración fiscal paraguaya. | BLOCKED | BLOCKERS_AND_DECISIONS.md LOCAL-01/FIN-01 | Moneda/tributos/localización fiscal por profesional; no inventar factura fiscal. |
| **F8-T07** — Panel de dirección con carga y economía reconciliable, sin KPIs decorativos. | SPECIFIED | UI spec Dirección; contratos finanzas | Datos económicos/carga reconciliables futuros, sin KPIs ficticios. |
| **F9-T01** — Elegir estudio piloto y casos de práctica autorizados; convenio de confidencialidad. | BLOCKED | BLOCKERS_AND_DECISIONS.md PROD-01 | Propietario designa piloto/casos/consentimiento; no datos reales ahora. |
| **F9-T02** — Ejecutar ciclo completo con dos abogados, administración y responsable de revisión. | NOT_RUN | OS_CORE_E2E_ACCEPTANCE.md; dependencias F7/F8 | Ciclo completo con abogados/administración/revisor del piloto pendiente. |
| **F9-T03** — Probar aislamiento entre dos estudios, revocación, recuperaciones IA y exports. | NOT_RUN | SEC01–06; futuros F7/F8 | Aislamiento/IA/exports reales en piloto no probado. |
| **F9-T04** — Pruebas de carga de documentos y operación concurrente; fallos y restauración. | NOT_RUN | TX/DOC/OPS01; plan P10 | Carga/concurrencia/fallos/restore deben medirse en infra aprobada. |
| **F9-T05** — Auditar seguridad, backups, observabilidad, costos por asiento y límites de modelos. | NOT_RUN | ADR propuesta operación; OPS01 | Auditar permisos,backup,costos/límites antes de preproducción. |
| **F9-T06** — Benchmark legal independiente contra jurisprudencia verdadera/falsa y adversarial. | BLOCKED | PHASE2_BLOCKERS.md P2-BENCH | Curaduría externa/ground truth y política confianza pendientes. |
| **F9-T07** — Cerrar defectos críticos y criterios de aceptación de UI compacta con capturas. | NOT_RUN | UI_COMPACT_DESIGN_SPEC.md / QA | Cero críticos y capturas aceptadas por piloto aún sin evidencia. |
| **F10-T01** — Aprobar políticas de datos, retención y términos de fuentes comerciales. | BLOCKED | BLOCKERS_AND_DECISIONS.md GOV-01/DATA-01 | Políticas/términos/retención comerciales no aprobados. |
| **F10-T02** — Validar precios y márgenes medidos con frecuencia de uso real. | NOT_RUN | ADR propuesta costos; Blueprint §15/20 | Medir frecuencia/costo/margen, no prometer IA ilimitada. |
| **F10-T03** — Separar cambios preview/productivo con gates y rollback documentados. | SPECIFIED | Plan ambientes/rollback; ADR propuesta | CI/deploy previews/productivo todavía no implementados/autorizados. |
| **F10-T04** — Publicar con monitoring, backups/restauración y soporte. | BLOCKED | Pedido propietario: sin despliegues | Publicación requiere autorización futura, operación y rollback probados. |
| **F10-T05** — Activar clientes comerciales gradualmente sin prometer corpus total. | NOT_STARTED | Blueprint §21; F9 pendiente | Clientes comerciales no activados. |
| **F10-T06** — Planificar nuevas salas/territorios y conectores según evidencia. | NOT_STARTED | docs/fuentes/** inventario histórico | Expansión por evidencia/permiso; sin cobertura total declarada. |
| **F10-T07** — Actualizar blueprint, roadmap y ADRs con release real y trazabilidad. | NOT_RUN | DOCS_RECONCILIATION_REPORT.md (reconciliación, no release) | Nueva edición/release aprobada futura; originales canónicos preservados. |

## Fuente de verdad de comprobación

Suite nueva271/271 en17 archivos, OS42 incluidos; typecheck/ambos builds/smoke PASS. f0-f1/reports/final-verification.json verifica preservación y cobertura de todos IDs. Gasto0, deploy0, cambios en motor0. La documentación V2 aparece por primera vez instalada en este corte; no reescribir los informes previos que registraban su ausencia.
