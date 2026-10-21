# Foto real del OS y reconciliación con especialistas V2

Actualización documental: 15/10/2026, America/Asuncion. Referencia de decisiones/handoff: 14/10/2026; propuestas aún sin aprobación funcional.

Fecha local: 14/10/2026, America/Asuncion. Corte reproducible: 21:18:15 local / `2026-10-15T00:18:15.706Z`.
Alcance: auditoría de lectura, documentación y pruebas offline. Ninguna inferencia jurídica nueva, modificación de orquestación, migración o despliegue. La exploración visual ImageGen posterior responde al nuevo pedido de diseño y permanece separada del OS.

## Revalidación de continuación — 2026-10-14 23:54:15, America/Asuncion

Lectura nueva, sin repetir inferencias ni pruebas de la entrega inicial. [Evidencia estructurada](reports/design-reconciliation-2026-10-14.json).

| Hecho | Observación nueva y límite |
|---|---|
| Home | HTTP 200; loopback 4313 |
| Assets | index-FWglu0Dz.js / index-BqTf4qgQ.css coinciden byte a byte con dist/web; no acredita identidad completa del proceso cargado |
| Core | /api/v1/ HTTP 404; api.ts enruta modo local a localRequest/Core/BrowserPersistence |
| Git | feat/os-core-local nominal; HEAD no existe; cero tracked. Sin rama/commit/reset/clean |
| Biblioteca | Snapshot updated_at=2026-10-15T02:48:53.818Z: 136617 referencias descubiertas, 7050 documentos indexados, 142270 pasajes, 650 documentos OCR; estado RUNNING/INDEXING. Contadores de progreso, sin prueba de cobertura/vigencia |
| Catálogo real | Seis personas/22 subáreas en specialist-catalog.ts; SpecialistStudio usa estado local para abrir detalles |
| Payload real | MatterJunta.prepare manda asunto/pregunta/documentos/materia; no pack/profile/team seleccionados. consult sigue Junta fija |
| Checker real | orchestration/index.ts:45 y :157 reciben analysis, no audit ni documento compuesto; junta-presentation.ts:19/:33 compone esos textos después |
| Nuevo diseño | 22 paquetes y contratos Director/preasunto/modos documentados; ningún especialista habilitado ni orquestación cambiada |

La UI local sí cambió después del corte inicial: PNG humanos y catálogo en Mi día/Trabajo jurídico/asunto. Esa composición fue rechazada; no hay Dashboard separado/Director/voz/asignación durable. La dirección visual aceptada no equivale a aprobación funcional.

### Cómo leer las secciones históricas siguientes

Desde «Conclusión» se conserva la auditoría inicial y sus reportes, con el corte indicado arriba. Sus tests/capturas/cantidades/paridad compilada y afirmaciones «solo documentación/frontend sin cambios» pertenecen a aquel corte. No se usan como pruebas nuevas ni anulan el frontend posterior. Esta revisión preserva código, assets y runtime; solo actualiza el paquete documental.

## Conclusión

Existe un OS local navegable y una Junta que ya produjo una consulta real sintética. La propuesta es una ampliación compatible del producto, pero todavía no está implementada: hoy Luna construye contexto, Sol analiza siempre y Gemini audita siempre. El checker está después de Gemini, aunque solo verifica `run.analysis`. No verifica todas las salidas del auditor ni el documento compuesto exportado.

El problema central es la cobertura terminal y el cambio de responsabilidades/modelos, no invertir el orden existente. Un debate con réplicas también es una capacidad nueva. No corresponde reconstruir OS, Junta, RAG ni registro de fuentes.

## Evidencias y alcance de certeza

`VERIFIED` aquí significa hecho técnico observado, no etiqueta bibliográfica `VERIFIED`. `REPORTED` identifica antecedentes no repetidos; `BLOCKED`, `NOT_RUN` y `FAIL` conservan su significado literal.

| ID | Hecho | Estado y evidencia |
|---|---|---|
| E01 | Proyecto local en la ruta informada | VERIFIED: raíz Git y archivos inspeccionados |
| E02 | Rama nominal `feat/os-core-local`, sin primer commit, SHA null, cero archivos tracked | VERIFIED: `git rev-parse --verify HEAD` falla; `git ls-files` vacío. No existe baseline Git recuperable |
| E03 | OS responde HTTP 200 en `http://127.0.0.1:4313` | VERIFIED: GET de home y navegador. No se acreditó dominio remoto/productivo |
| E04 | JS/CSS servidos coinciden byte a byte con `dist/web` | VERIFIED: hashes HTTP/disco en [runtime-audit.json](reports/runtime-audit.json) |
| E05 | Cinco módulos críticos compilados coinciden con fuente TS transpiliada ESM | VERIFIED: [compiled-parity.json](reports/compiled-parity.json). No acredita la memoria de módulos ya cargados en el proceso |
| E06 | UI usa perfiles locales sin login y Core con localStorage | VERIFIED: navegador, `local-api.ts:14`, `local-storage.ts:346`, ADR local. No es identidad autenticada ni aislamiento de seguridad |
| E07 | Puente Node local para Junta y Biblioteca; dominio administrativo se ejecuta en navegador | VERIFIED: `scripts/local-browser.mjs`, `junta-bridge.mjs`, `api.ts`. `/api/` HTTP no sirve el Core en este modo |
| E08 | Backend Fastify/pg/Supabase está en código como camino distinto | VERIFIED de existencia: `apps/api/src`, `packages/persistence-postgres`, `supabase`. Conexión y E2E actual de ese modo NOT_RUN |
| E09 | Claves presentes, modelos esperados y Sol medium coinciden | VERIFIED solo de configuración: GET `/local/junta/status`; credenciales nunca impresas/copied. Acceso vigente de cuenta NOT_RUN |
| E10 | Consulta histórica LIVE recuperable sin repetir inferencias | VERIFIED de persistencia: GET status de preparación `565ec866-bcd6-4c1a-8dbc-cc905950d3d9`, run `run:6c068939d23695960768c605ddf8f3a4`; resultado HUMAN_REVIEW_PENDING |
| E11 | Uso histórico registrado: 12.241 tokens de entrada, 4.692 salida; USD 0,033777218 estimados | VERIFIED del registro, factura y transporte histórico no reobservados. `actual_total_usd=null`; reparación factual original preservada |
| E12 | Biblioteca SQLite FTS5 + BM25 y OCR local en marcha | VERIFIED: GET progress; 136.267 referencias, 3.773 textos, 80.277 pasajes, 241 documentos con OCR en el corte. Cobertura parcial, cifras cambiantes |
| E13 | Tres originales históricos mantienen hashes del manifiesto | VERIFIED: originales constitucional/civil/penal; siguen UNVERIFIED_FOR_CHECKER en ese manifiesto |
| E14 | Checker posterior a auditor, limitado al análisis | VERIFIED: `orchestration/index.ts:153` y `:158`; `citation-checker/index.ts:64`. También aplica al recheck de caché |
| E15 | Cita inventada solo en Gemini escapa del gate global actual | FAIL de cobertura reproducido en memoria, OFFLINE_SIMULATION, red prohibida: [checker-coverage-probe.json](reports/checker-coverage-probe.json). No implica una etiqueta bibliográfica VERIFIED en producción |
| E16 | Número civil escrito en palabras aún deja marcador sin extraer | FAIL de extracción completa, cierre conservador correcto: probe nuevo. El 11/12 completo pertenece al benchmark histórico; no se reejecutó ni alteró |
| E17 | 271/271 pruebas existentes y 10/10 contratos locales focalizados pasan | VERIFIED_OFFLINE: [Core/Junta](reports/core-junta-tests.json), [local](reports/local-contract-tests.json). No sustituyen aceptación de especialistas |
| E18 | Typecheck raíz pasa | VERIFIED_OFFLINE: `node node_modules/typescript/bin/tsc --noEmit`, exit 0. No se recompilaron assets del OS levantado |
| E19 | Pantalla asunto/Junta conserva shell compacto a 1366×768 y 1440×900 | VERIFIED visual: capturas de este corte, 13px, topbar 44px, sidebar 212px, zoom CSS 1; detalles en [UI](SPECIALISTS_COMPACT_UI_SPEC.md) |

La comparación inicial aislada con `ModuleKind.NodeNext` produjo cinco falsos negativos por tratar el archivo como CommonJS. Se conservó esa observación en runtime-audit y se corrigió el método a emisión ESNext coherente con `package.json` type=module. `compiled-parity.json` la reemplaza; no se reconstruyó dist para conseguir coincidencia.

## Mapa del recorrido actual

```text
React/Vite servido desde dist/web (loopback 4313)
  gestión -> api.ts -> localRequest -> Core -> BrowserPersistence/localStorage
  Junta del asunto -> MatterJunta -> /local/junta/case/prepare
      -> TXT/versiones del Core + Biblioteca SQLite -> preparación/hash en disco
      -> clic humano + política del host -> /local/junta/case/consult
      -> runCase -> FileBoardStore + LegalBoard
      -> Jev -> Luna Context Builder -> Sol análisis -> Gemini auditor
      -> checker(analysis) -> resultado guardado -> UI/HTML/Markdown/borrador Core
```

El plan de especialistas no debe utilizar ese último `LegalBoard.execute` sin adaptación: hoy dispararía Sol y Gemini. `prepareIssuePlan` es planificación de cuestiones aportadas por humano, no Head Chief ni selector de especialistas.

## Módulos de producto

| Módulo | Estado observado/código |
|---|---|
| Mi día, clientes, asuntos | Navegables; asunto sintético con responsable humano, documentos y tarea presentes |
| Documentos, versiones, borradores/revisiones, equipo/actividad | Core y vistas existentes; borrador del run LIVE presente. No se crearon ni aprobaron documentos durante la auditoría |
| Procedimientos y entregas/presentaciones | Contratos/vistas existentes; operación real y recibos externos NOT_RUN |
| Trabajo jurídico | Junta y configuración existentes; demo offline separada de consulta real por asunto |
| Biblioteca | Catálogo y búsqueda local, originales/derivados, progreso digital/OCR; no corpus universal autenticado |
| Agenda, Administración, portal y economía | Navegación no prueba implementación completa; agenda/finanzas productivas y portal no acreditados por esta auditoría |
| Titular IA persistente, perfiles de materia, Head Chief, override manual y debate por rondas | NOT_IMPLEMENTED en las rutas actuales inspeccionadas |

## Discrepancias registradas

| ID | Fuente / divergencia | Resolución documental propuesta |
|---|---|---|
| D01 | Blueprint/Roadmap/ADR reconciliación del 13/10 dicen OS-001 pendiente | OS-001_ACCEPTED y addendum local son posteriores; no reabrir selección de stack por el histórico |
| D02 | Informe histórico dice sin Git | Existe Git unborn, sin commit; no afirmar SHA ni versionado completo |
| D03 | Histórico dice sin frontend/persistencia | Hay web y persistencia navegador; seguridad empresarial continúa sin acreditar |
| D04 | Histórico dice 401 Google y ninguna inferencia | Metadatos posteriores y run LIVE guardado superan ese estado; disponibilidad actual sigue sin revalidar |
| D05 | Tres PDFs / 743 / 1.317 textos según diferentes reportes | Son cortes distintos. Registrar snapshot vivo E12; OCR reciente no cura automáticamente el manifiesto histórico |
| D06 | Junta vigente fija Luna=contexto, Sol=principal, Gemini=obligatorio | V2 especialistas propone Luna principal, Sol manual, Gemini optativo; ampliación versionada, nunca cambio silencioso |
| D07 | Imagen dice Jev solo si mucho volumen | Handoff V2 mantiene Jev por defecto y exige aprobar bypass. Prevalece texto explícitamente adoptado por el usuario |
| D08 | Imagen no incluye Constitucional entre los convocados y muestra cinco áreas | Handoff propone catálogo de visión más amplio, pero solo habilitar áreas evaluadas. No crear cinco/seis servicios por el dibujo |
| D09 | Checker ya va después de Gemini, pero su cobertura no incluye audit | Conservar orden y ampliar manifiesto de salidas/versiones; regresión E15 obligatoria |
| D10 | Gemini solo objeta; posible segunda llamada por recuperación | No existe réplica de especialistas ni integración posterior. Recuperación no equivale a debate |
| D11 | Exportación Markdown/HTML compone consulta, hallazgos, fuentes y limitaciones después del checker | Verificar artefacto compuesto y sus versiones; cambiar render puede afectar incluso citas sin nuevo LLM |
| D12 | Biblioteca va al análisis/auditor como `library_research`, fuera de `citationScope` | Resolver referencias sobre el mismo registro/procedencia autorizado; no fingir que los fragments de Biblioteca ya son documentos autenticados del checker |
| D13 | Gate PASS_IN_SCOPE puede existir sin referencias | Significa sin objeciones detectadas en ese ámbito; no fuentes verificadas universalmente ni tesis correcta |
| D14 | Propuesta permite uso multiestudio seguro | Core tiene reglas, pero el modo local y puente confían en perfil/actor del navegador. G2 local sintético y habilitación empresarial son gates separados |
| D15 | Handoff previo V1 no localizado en repo/Downloads | Comparación literal BLOCKED; se pueden identificar diferencias con código/ADR sin inventar contenido V1 |

## Límites y G0

Auditoría local entregada. G0 queda PARTIAL para una identificación reproducible completa del proceso y para entorno empresarial: no SHA, no manifiesto de build firmado ni identidad real. Los cinco módulos muestreados coinciden en disco; no se afirma equivalencia de todo el bundle web con todos los TSX actuales ni de todo el proceso en memoria. Política, tablas SQL/RLS y storage del modo servidor existen en código, pero no recibieron aquí certificación de seguridad ni E2E.

No se cambió de rama ni se creó worktree: un repo sin commit y con todo el producto untracked no permite obtener un worktree útil sin crear historia o copiar estado por cuenta propia. Se agregó únicamente esta carpeta documental nueva. [preservation.json](reports/preservation.json) registra la comparación final de los 100 archivos protegidos; no se incluyen BD/progreso de Biblioteca porque el proceso autorizado continúa escribiéndolos.

Fuentes leídas: handoff V2 íntegro (hash en runtime-audit); Blueprint/Roadmap MD y contenido pertinente de HTML; ADR reconciliación, ADR Junta, OS-001 aceptado/addendum; OS_CORE_ARCHITECTURE; informes PHASE2, corpus/benchmark/conectividad/limitaciones; reportes posteriores de Junta real, Biblioteca/RAG/OCR; código y tests referidos. Ninguna instrucción en esos documentos se trató como autorización independiente de gasto, deploy o cambio de producción.
