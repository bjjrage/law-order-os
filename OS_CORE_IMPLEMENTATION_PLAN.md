# Plan prescriptivo F1–F4

2026-10-13. **READY_FOR_APPROVAL / implementación nueva NOT_RUN**. No ejecutar este plan antes de aceptación explícita de ADR_OS_001_DECISION_PROPOSAL.md. Raíz: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/`. Todo trabajo inicial usa datos sintéticos locales; gastos/deploy/producción siguen fuera de autorización.

## Orden y entregas

| Lote / Roadmap | Archivos objetivo nuevos o existentes | Trabajo preciso | Criterio de salida / dependencia |
|---|---|---|---|
| P0 / F0,F1 | ADR aceptado nuevo, baseline, `.gitignore` propuesto | Registrar texto/aprobador/fecha/alcance; ratificar política de directorio/roles y dev local | Stack aprobado; piloto puede quedar pendiente para datos reales. No inventar responsable/fecha. |
| P1 / F1-T03..07 | apps/api, apps/web, packages/persistence-postgres, infra/local, docs/operations | Fijar versiones/lock, workspace incremental, Supabase local Auth/PG/Storage, sin tocar scripts Junta; health/readiness | Arranque documentado, cero conexiones a modelos/cloud en tests; secrets fuera repo. |
| P2 / F1-T04,F3-T01 | os-core/src/contracts.ts, authorization.ts, service.ts; testing/memory.ts | Puerto tx async + await completo, consultas acotadas, Authenticator real de desarrollo | 271 regresiones existentes PASS, 42 OS sin relajación; contrato async con rollback probado. |
| P3 / F1,F2 | packages/persistence-postgres; supabase/migrations (solo local tras aprobación) | Tablas Core/FKs/RLS/no BYPASSRLS, CAS, idempotency, audit/outbox; no blob base64 en modelo productivo | Tests SQL directos entre tenants, rollback y dos conexiones concurrentes; migraciones repetibles en BD vacía. |
| P4 / F2-T01,02,05 | apps/api/auth, sessions, routes/firms; apps/web/auth | Login/logout/refresh/revocación/CSRF, onboarding estudio+admin atómico y selector seguro | E2E S01–S04 + SEC01–06, persiste tras reinicio; no estudio sin admin. |
| P5 / F2-T03,04,06,07 | apps/web/styles/tokens.css, shell, pages/my-day | Aplicar tokens compactos, router, tabla/filtros, estados reales y teclado | Screens 1440/1366 a100%, comparación85%, Mi día lee SQL autorizado. Sin cifras simuladas. |
| P6 / F3-T02..07 | apps/api/routes/clients, matters, participants, tasks; apps/web/pages | CRUD mínimo, listados paginados, responsables/participación, asunto consultivo y litigioso | S05–S11 y persistencia/new session, IDs ajenos denegados en HTTP y SQL. |
| P7 / F4-T01,02,06 | storage adapter, uploads, scanner, reconciliation worker; web/documents | Intent→bytes privados→validación→versión available→publish CAS; descarga proxy | Hash original intacto tras restart/restore; fallos entre blob/SQL no publican; malware no descargable. |
| P8 / F4-T03,04 | web/editor/reviews; API drafts/reviews | Editor texto plano inicial, nueva versión, tarea revisión, decisión explícita exacta | S12–S14 + DOC01–08; editar invalida review y aprobación no migra. |
| P9 / F4-T05,07 | delivery/filing contracts/routes + package exporter | Evidencia separada de entrega/presentación; índice/anexos ordenados por manifest SHA | Paquete reproducible, originales intactos; sin automatizar envío/juzgado. F4 parcial hasta estas pruebas. |
| P10 / F1-T06,F9 futuro | backup/restore runbook, E2E runner | Restore DB+objetos+config en ambiente aislado, smoke del slice | Sin pérdidas fuera RPO aprobado y permisos intactos; prueba de restauración previa a piloto. |

F5/F6 no bloquean P1–P10. Continúan con sus gates propios: confianza/OCR/corpus/modelos/permiso de gasto. F7 requiere F4+F5+F6; no inventar una respuesta Junta para demostrar UI. F8 requiere contratos financieros/comunicaciones del piloto, no introducir contabilidad fiscal en este slice.

## Reuso sin reconstrucción

Mantener `junta-juridica/src/**`, scripts/board.mjs, fixtures, corpus y resultados históricos. No sustituir motor por framework de agentes. El módulo `os-core/src` sigue siendo único dueño de invariantes; routes traduce sesión/input/error, no replica reglas. `os-core/testing/memory.ts` se adapta a interfaz async únicamente para conservar pruebas; producción lo excluye de imports/build.

La conversión async afecta Authorization.membership/participant/matter, helpers de servicio activity/targetMember/document/incorporate/draft y todos los comandos que los consumen. Revisar cada get/list/insert/replace y for-loop; usar await secuencial en operaciones dependientes. No Promise.all sobre la misma conexión para operaciones cuya secuencia importa. Conservar inmutabilidad de retornos y copia de bytes antes de cualquier await. Usar queries de existencia para permisos y predicados compuestos, no list completo en memoria.

Autenticación IdP precede la transacción de negocio; no mantener conexión serializable abierta durante petición externa. Cargar target identidad de forma confiable antes y verificar su estado/mirror y membresía actual dentro de tx. Bootstrap enrolment único evita alta ilimitada de estudios. Una baja concurrente con una mutación/review requiere política definida: bloquear/serializar fila de membership/participant para decidir orden de commit y probar ambos interleavings; no afirmar que simple SELECT bajo READ COMMITTED garantiza revocación.

No instalar un ORM para simular compatibilidad síncrona. pg usa conexión única; rollback siempre seguido de release, SET LOCAL se elimina al terminar; prueba un tenant A y luego B en mismo pool. Retrys SQL serializable acotados (propuesta2) solo para comandos idempotentes sin efectos externos; inference/reenvío externo nunca dentro de retry. Consistencia outbox at least once exige consumidor idempotente; no prometer exactly once externo.

## Definición del primer slice implementable

Un administrador completa onboarding de estudio; segundo abogado entra con identidad real de desarrollo; crean cliente/asunto/responsable/documento/tarea, consultan autorizado, rechazan ajeno, preparan borrador, solicitan revisión y aprueban versión exacta. Lecturas y escrituras pasan por HTTP/sesión/RLS y sobreviven reinicio y nueva sesión. `OS_CORE_E2E_ACCEPTANCE.md` detalla los 14 pasos y pruebas adversas. Integración real del IdP local y PostgreSQL prueba el ambiente de desarrollo; no certifica residencia, SLA ni producción.

El orden visual pedido (estudio, identidad, membresía) se implementa como wizard: formulario de estudio pendiente sin persistir → creación/verificación de identidad → commit conjunto firm+membership. No crear primero un estudio durable sin administrador para seguir literalmente la lista. La UI muestra pendiente hasta commit; cancelación/identidad fallida no deja tenant huérfano. Fase2 crea estudio con identidad ya existente: esa regresión sigue válida pero no sustituye onboarding.

## Git y ambientes

Sin Git actual. Baseline SHA483 archivos actual y copia histórica phase2/baseline preservados. Proponer, tras aprobación de estrategia: `.gitignore` para node_modules/, dist/, .npm-cache/, .board-data/, f0-f1/local-board-data/, .env y .env.*, exceptuar `.env.example` sin valores; coverage/, logs/temporales y claves privadas. No ignorar indiscriminadamente JSON/PDF/fixtures/reportes: son evidencia. Los tres PDFs públicos pueden versionarse si derechos/política lo permiten; originales privados futuros nunca se commitean. ZIP/duplicados canónicos permanecen archivados, decidir inclusión después, no borrarlos.

Antes del primer commit: inventario con allowlist + escaneo de secretos por nombres/contenido sin imprimir valores, revisar staging. Inicializar local `main` y rama `feat/os-core-vertical-slice` tras baseline; no remoto/push. Sin remoto no hay protección de rama enforceable: política local de review, checks y commits pequeños; protección remota posterior autorizada. Históricos de Mussi no identifican la rama de este proyecto.

Dev local reproducible, preview/prod separados por proyecto DB/Auth/bucket, claves y tenant sintéticos. Migrador separado runtime. CI propuesta ejecuta typecheck/builds/testoffline, SQL/RLS y browser local con denylist de red a modelos, sin secrets productivos. Preview/deploy requiere autorización futura específica y aprobación de acceso a datos. Responsable operativo y sustituto pendientes, no adjudicados a una persona sin confirmación.

## Evidencia obligatoria por lote

Registrar commit si existe (hoy null), comandos/exit, ambiente, usuario sintético/rol, tablas/objetos tocados, screenshots sin datos reales y límites de verificación. No sobreescribir `phase2/reports`, `junta-juridica/reports` ni os-core/test-results.json; nuevos resultados en carpeta de fase siguiente. Gates UI/HTTP/SQL deben pasar juntos. Ante fallo conservar resultado inicial y corregir en commit posterior; no cambiar expectativas para ocultar regresión.
