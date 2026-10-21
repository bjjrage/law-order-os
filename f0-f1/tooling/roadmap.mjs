import fs from 'node:fs';
const groups={
F0:[
 ['DONE','docs/**; canonical-installation.json','Instalación de12 documentos preservada; auto-hash del manifiesto discrepante registrado D-01.'],
 ['DONE','junta-juridica/docs/ADR_JUNTA_JURIDICA_V2.md; DOCS_RECONCILIATION_REPORT.md','Junta propia vigente; Mussi histórico no se ejecuta.'],
 ['DONE','OS_CURRENT_STATE_AUDIT.md; f0-f1/reports/baseline.json','483 archivos inventariados; Git ausente.'],
 ['BLOCKED','BLOCKERS_AND_DECISIONS.md / PROD-01','Propietario debe designar estudio piloto, responsables jurídicos/operativos.'],
 ['DONE','f0-f1/reports/final-verification.json; phase2/baseline','Preservación SHA de todos archivos previos; informes/holdouts intactos.'],
 ['PARTIAL','BLOCKERS_AND_DECISIONS.md','Dueños por función propuestos; personas/fechas de cierre no aprobadas.']
],
F1:[
 ['DONE','OS_CORE_ARCHITECTURE.md; ADR_OS_001_DECISION_PROPOSAL.md','Lectura y comparación A/B/C completas, sin adopción.'],
 ['BLOCKED','ADR_OS_001_DECISION_PROPOSAL.md','B propuesta; falta aceptación expresa del propietario.'],
 ['SPECIFIED','ADR_OS_001_DECISION_PROPOSAL.md; OS_CORE_IMPLEMENTATION_PLAN.md','Dev/preview/prod/secretos definidos; entornos no creados ni probados.'],
 ['SPECIFIED','OS_CORE_DATA_API_CONTRACTS.md; authorization.ts','Fronteras propuestas, no RLS empresarial; cerrar política de directorio/roles.'],
 ['BLOCKED','OS_CORE_IMPLEMENTATION_PLAN.md / Git','Baseline y estrategia listos; no se inicializó Git, ningún remoto autorizado.'],
 ['SPECIFIED','ADR_OS_001_DECISION_PROPOSAL.md / operación','DB+objetos/RPO/RTO/logs propuestos; restore NOT_RUN.'],
 ['BLOCKED','OS_CORE_DATA_API_CONTRACTS.md; ADR propuesto','Contratos preparados; falta ADR aceptado y pruebas básicas de infraestructura.']
],
F2:[
 ['NOT_STARTED','apps/web y apps/api inexistentes','F1 aprobado; implementar sesión IdP real, no Authenticator sintético.'],
 ['TESTED_OFFLINE','os-core/src/service.ts; os-core/tests/core.test.ts','Servicios firm/membership; faltan SQL/API/selector web.'],
 ['SPECIFIED','UI_COMPACT_DESIGN_SPEC.md / tokens','Implementar CSS/shell real, sin zoom.'],
 ['SPECIFIED','UI_COMPACT_DESIGN_SPEC.md; contrato GET my-day','Query autorizada/vistas por rol y acciones reales pendientes.'],
 ['TESTED_OFFLINE','os-core/tests/core.test.ts; persistence.test.ts','Aislamiento servicio probado; E2E/RLS/storage/sesión reales NOT_RUN.'],
 ['NOT_RUN','UI_COMPACT_DESIGN_SPEC.md / QA','Falta UI; screenshots1440/1366 a100% y referencia85%.'],
 ['SPECIFIED','UI_COMPACT_DESIGN_SPEC.md / accesibilidad','Teclado/foco/estados/reflow especificados, browser QA NOT_RUN.']
],
F3:[
 ['PARTIAL','os-core/src/**; OS_CURRENT_STATE_AUDIT.md','Auditado y plan de reuso; adaptación async y app aún pendientes.'],
 ['TESTED_OFFLINE','contracts.ts/service.ts; core.test.ts','Client/contact/relatedParty separadas; falta persistencia SQL.'],
 ['TESTED_OFFLINE','service.ts createMatter/grantParticipant; core.test.ts','Tipos/responsable/participantes presentes; procedimiento nuevo, UI/SQL pendientes.'],
 ['TESTED_OFFLINE','service.ts createTask/matterActivity; core.test.ts','Tarea/actividad de servicio; faltan queries Mi día/transporte durable.'],
 ['SPECIFIED','UI_COMPACT_DESIGN_SPEC.md; contratos listados','Clientes/asuntos/tareas con filtros no implementados web.'],
 ['NOT_RUN','OS_CORE_E2E_ACCEPTANCE.md S03–S11/TX03','Ejecutar con2 estudios/usuarios IdP, reinicio y nueva sesión.'],
 ['PARTIAL','MatterInputSchema; OS_CORE_DATA_API_CONTRACTS.md / proceeding','Asunto consultivo sin expediente funciona offline; 0..N Proceeding y política plazos pendientes.']
],
F4:[
 ['TESTED_OFFLINE','service.ts add/publishDocumentVersion; persistence.test.ts','Original/hash/publicación local; faltan Storage/staging/scan/SQL.'],
 ['TESTED_OFFLINE','contracts.ts; service.ts decideDraftReview; review.test.ts','Vínculo de asunto/review+actividad; approval append-only SQL pendiente.'],
 ['TESTED_OFFLINE','prepareDraft/reviseDraft; review.test.ts','Workflow local; editor real no implementado.'],
 ['TESTED_OFFLINE','os-core/tests/review.test.ts','Versión exacta/no herencia probado; repetir contra SQL/browser.'],
 ['SPECIFIED','OS_CORE_DATA_API_CONTRACTS.md / delivery,filing_receipt','Estados reales/recibos nuevos; no inferir presentación de descarga.'],
 ['NOT_RUN','OS_CORE_E2E_ACCEPTANCE.md S08/S12–14/DOC01–08','Descarga privada/session/RLS/E2E documental pendiente.'],
 ['SPECIFIED','OS_CORE_IMPLEMENTATION_PLAN.md P9; DOC08','Índice/annex package reproducible aún no existe.']
],
F5:[
 ['DONE','phase2/corpus/originals; phase2/tests/corpus-integrity.test.ts','Tres originales preservados/hash comprobado offline; DONE limitado a conservación.'],
 ['BLOCKED','ingestion/provenance.ts; PHASE2_BLOCKERS.md P2-TRUST','Ed25519 local probado; falta política/emisor institucional autorizado.'],
 ['BLOCKED','OFFICIAL_CORPUS_MANIFEST.json; docs/fuentes/**','production_indexing_permitted=false; derechos/privacidad/versiones pendientes.'],
 ['BLOCKED','phase2/tooling/review-pdfs.mjs; revisiones corpus','PDF.js sin Python ya disponible; OCR constitucional/QA humana civil/penal pendientes.'],
 ['NOT_STARTED','download-official-corpus.mjs (recuperación finita, no conector)','Definir alcance/permiso y checkpoints de conector; no scraping masivo.'],
 ['BLOCKED','retrieval/index.ts; citation-checker/index.ts','RAG local existe; falta corpus verificado e importación PDF trazable.'],
 ['NOT_STARTED','docs/fuentes/FUENTES_Y_APIS_PARAGUAY_v1.1.*','Inventario no es corpus vigente; ingesta normativa autorizada pendiente.'],
 ['BLOCKED','BIBLIOGRAPHIC_BENCHMARK_REPORT.md; phase2/benchmark','12/12 detección,11/12 extracción históricos; holdout externo/cotejo auténtico pendientes.']
],
F6:[
 ['DONE','f0-f1/reports/vitest.json; smoke-check.json; checks.json','271 tests/typecheck/2 builds/smoke reproducidos, solo offline.'],
 ['FAIL','citation-checker/extraction.ts; bibliographic-first-evaluation.json','Número civil en palabras conocido11/12; no cambiar engine/holdout en reconciliación.'],
 ['BLOCKED','MODEL_CONNECTIVITY_REPORT.md; providers/live.ts','Inferencia NOT_RUN; ningún modelo probado accesible en cuenta.'],
 ['BLOCKED','phase2/reports/model-connectivity-metadata.json','Google401 histórico, no reintentado; configuración fuera del gate documental.'],
 ['PARTIAL','providers/preflight.ts; metadata histórico; pruebas HTTP falsas','GET Google401 es hecho previo; Jev/OpenAI sin consulta; no cuenta validada.'],
 ['BLOCKED','LIVE_SMOKE_PLAN.md; providers/preflight.ts','Gasto no autorizado; plan/corpus/proofs insuficientes.'],
 ['NOT_RUN','telemetry/index.ts; LIVE_SMOKE_PLAN.md','Contadores offline no son costo real ni p50/p90 de producción.'],
 ['TESTED_OFFLINE','orchestration/index.ts; tests e2e','Run parcial/revisión humana local probado; ejecución real pendiente.']
],
F7:[
 ['SPECIFIED','OS_CORE_DATA_API_CONTRACTS.md / integración Junta','Falta UI/API investigación autorizada y mapping AccessContext servidor.'],
 ['PARTIAL','Junta snapshots/versiones; OS_CURRENT_STATE_AUDIT.md','Engine tiene scope/versiones; historial web CURRENT/OUTDATED no existe.'],
 ['TESTED_OFFLINE','principal-analysis/adversarial-audit; unit budget','Acceso originales acotado local; falta aislamiento OS real y proveedores.'],
 ['PARTIAL','citation-checker; safeExport CLI','Checker local/export Junta; borrador editable OS/export final sin integrar.'],
 ['SPECIFIED','OS_CORE_DATA_API_CONTRACTS.md / integration','No enlace durable análisis→documento/revisor aún.'],
 ['NOT_RUN','OS_CORE_E2E_ACCEPTANCE.md SEC/DOC; tests adversariales Junta','E2E combinado real pendiente F4/F5/F6.'],
 ['NOT_RUN','telemetry/index.ts; MODEL_CONNECTIVITY_REPORT.md','Costo/latencia por trabajo real sin muestra.']
],
F8:[
 ['SPECIFIED','OS_CORE_DATA_API_CONTRACTS.md / agenda; UI spec','Eventos/audiencias/estados nuevos, no confundir tarea con agenda.'],
 ['BLOCKED','Contratos deadline; BLOCKERS_AND_DECISIONS.md LOCAL-01','Reglas/calendarios jurídicos revisados y confirmación humana pendientes.'],
 ['SPECIFIED','Contratos comunicaciones; Blueprint §14','Conector/canal autorizado y aprobación de envío pendientes, nada enviado.'],
 ['SPECIFIED','Contratos explicit_share; Blueprint §04/14','Portal/roles nuevos sin implementación; compartir solo versión exacta.'],
 ['SPECIFIED','Contratos finanzas; Blueprint §15','Acuerdos/gastos/anticipos/caja separados; ledger/allocations no implementados.'],
 ['BLOCKED','BLOCKERS_AND_DECISIONS.md LOCAL-01/FIN-01','Moneda/tributos/localización fiscal por profesional; no inventar factura fiscal.'],
 ['SPECIFIED','UI spec Dirección; contratos finanzas','Datos económicos/carga reconciliables futuros, sin KPIs ficticios.']
],
F9:[
 ['BLOCKED','BLOCKERS_AND_DECISIONS.md PROD-01','Propietario designa piloto/casos/consentimiento; no datos reales ahora.'],
 ['NOT_RUN','OS_CORE_E2E_ACCEPTANCE.md; dependencias F7/F8','Ciclo completo con abogados/administración/revisor del piloto pendiente.'],
 ['NOT_RUN','SEC01–06; futuros F7/F8','Aislamiento/IA/exports reales en piloto no probado.'],
 ['NOT_RUN','TX/DOC/OPS01; plan P10','Carga/concurrencia/fallos/restore deben medirse en infra aprobada.'],
 ['NOT_RUN','ADR propuesta operación; OPS01','Auditar permisos,backup,costos/límites antes de preproducción.'],
 ['BLOCKED','PHASE2_BLOCKERS.md P2-BENCH','Curaduría externa/ground truth y política confianza pendientes.'],
 ['NOT_RUN','UI_COMPACT_DESIGN_SPEC.md / QA','Cero críticos y capturas aceptadas por piloto aún sin evidencia.']
],
F10:[
 ['BLOCKED','BLOCKERS_AND_DECISIONS.md GOV-01/DATA-01','Políticas/términos/retención comerciales no aprobados.'],
 ['NOT_RUN','ADR propuesta costos; Blueprint §15/20','Medir frecuencia/costo/margen, no prometer IA ilimitada.'],
 ['SPECIFIED','Plan ambientes/rollback; ADR propuesta','CI/deploy previews/productivo todavía no implementados/autorizados.'],
 ['BLOCKED','Pedido propietario: sin despliegues','Publicación requiere autorización futura, operación y rollback probados.'],
 ['NOT_STARTED','Blueprint §21; F9 pendiente','Clientes comerciales no activados.'],
 ['NOT_STARTED','docs/fuentes/** inventario histórico','Expansión por evidencia/permiso; sin cobertura total declarada.'],
 ['NOT_RUN','DOCS_RECONCILIATION_REPORT.md (reconciliación, no release)','Nueva edición/release aprobada futura; originales canónicos preservados.']
]};
const text=fs.readFileSync('docs/LAW_ORDER_OS_ROADMAP_v2.0.md','utf8');
const tasks=[...text.matchAll(/- \[ \] \*\*(F(\d+)-T(\d+))\*\* — ([^\n]+)/g)].map(m=>{
 const entry=groups['F'+m[2]]?.[Number(m[3])-1];if(!entry)throw Error('Missing '+m[1]);
 return {id:m[1],phase:'F'+m[2],requirement:m[4],status:entry[0],evidence:entry[1],missing_or_decision:entry[2]};
});
fs.writeFileSync('f0-f1/reports/roadmap-matrix.json',JSON.stringify(tasks,null,2));
const intro=`# Roadmap reconciliado F0–F10

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
`;
const rows=tasks.map(t=>`| **${t.id}** — ${t.requirement.replaceAll('|','/')} | ${t.status} | ${t.evidence} | ${t.missing_or_decision} |`).join('\n');
fs.writeFileSync('ROADMAP_STATUS_RECONCILED.md',intro+rows+'\n\n## Fuente de verdad de comprobación\n\nSuite nueva271/271 en17 archivos, OS42 incluidos; typecheck/ambos builds/smoke PASS. f0-f1/reports/final-verification.json verifica preservación y cobertura de todos IDs. Gasto0, deploy0, cambios en motor0. La documentación V2 aparece por primera vez instalada en este corte; no reescribir los informes previos que registraban su ausencia.\n');
console.log(JSON.stringify({tasks:tasks.length}));
