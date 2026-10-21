# Roadmap F1–F4 después de aprobación

**Addendum 2026-10-13:** modo local sin autenticación/localStorage aprobado por el propietario para avanzar sin Docker ni credenciales. Ver [informe actual](LOCAL_BROWSER_IMPLEMENTATION.md). Esto no da por completas las tareas de seguridad/Supabase/productivas de la matriz histórica siguiente.

2026-10-13. Addendum a la matriz F0/F1 histórica preservada. Stack aprobado; F1–F4 permanecen PARCIALES/BLOCKED para sus gates empresariales. PASS local SQL/browser no acredita Supabase Auth/Storage ni producción.

| ID / requisito | Estado | Evidencia / límite |
|---|---|---|
| **F1-T01** Leer el `OS_CORE_ARCHITECTURE.md` real y comparar alternativas documentadas. | DONE | Comparación histórica preservada; ADR aceptado referencia propuesta. |
| **F1-T02** Proponer y aprobar framework web, API/backend, PostgreSQL, auth, storage, jobs y región. | DONE_DECISION | B/São Paulo aprobados por propietario, docs/ADR_OS_001_ACCEPTED.md; no autoriza cloud. |
| **F1-T03** Definir entornos dev/preview/prod, secrets, auditoría y responsabilidades de deploy. | IMPLEMENTED_LOCAL_PARTIAL | Config/arranque/secretos/ignore local listos; preview/prod/operación no creados. |
| **F1-T04** Definir frontera tenant y autorización por asunto en API/BD/storage/jobs. | VERIFIED_LOCAL_SQL_PARTIAL | RLS/FKs/API negativos con PG real; IdP/Storage completos bloqueados. |
| **F1-T05** Crear Git local y estrategia de rama protegida tras preservar baseline; remoto solo con autorización. | PARTIAL | Git local feat/os-core-local, baseline preservado, sin commits/remoto/push; protección remota no existe. |
| **F1-T06** Definir restauración, backup, logs seguros y plan mínimo de operación. | SPECIFIED_NOT_RUN_RESTORE | Runbook y límites; restore completo pendiente, portátil sin pg_dump. |
| **F1-T07** Crear ADR aprobado y contratos API/datos compatibles con OS Core offline. | ACCEPTED_PARTIAL_CONTRACTS | ADR aprobado y APIs implementadas; POST/paginación/ETag/staging difieren del objetivo documentado. |
| **F2-T01** Implementar shell web navegable y autenticación real en dev. | IMPLEMENTED_BLOCKED_AUTH | Shell/API reales arrancados4310; Supabase Auth local falta Docker. |
| **F2-T02** Implementar estudio, membresías y selector/contexto; denegación por defecto. | VERIFIED_LOCAL_SQL_PARTIAL | Firm/membership/selector/core durables; usuario efectivo IdP NOT_RUN. |
| **F2-T03** Crear sidebar compacta y topbar 42–48px, tipografía 12.5–13.5px, tablas densas. | PASS_BROWSER_LOCAL | Body13/topbar44/sidebar212;15 filas1366/16 filas1440 a100%. |
| **F2-T04** Crear panel «Mi día» para abogado, rol coordinador y administración con datos reales. | PASS_BROWSER_SQL_HARNESS | Mi día consulta tareas autorizadas reales SQL; auth de pruebas explícita. |
| **F2-T05** QA negativo multiestudio, RLS/servidor, sesión/revocación y controles de storage. | PARTIAL | RLS/HTTP/CSRF/denegaciones/revoke/replay PASS; sesión/Storage reales pendientes. |
| **F2-T06** Capturas desktop 1440×900 y 1366×768 al 100%; comparación visual 85% sin CSS zoom. | PARTIAL | Capturas1440/1366 a100% listas; comparación85% browser real pendiente. |
| **F2-T07** Definir navegación teclado, focus visible y estados loading/empty/error. | PARTIAL | Foco visible/estado/reflow320 comprobados; auditoría integral teclado/contraste/zoom pendiente. |
| **F3-T01** Reutilizar contrato de dominio OS Core ya probado offline; auditar cambios del servicio. | IMPLEMENTED | Core reutilizado async, invariantes271 regresiones PASS, sin reconstruir Junta. |
| **F3-T02** Persistir cliente/contacto/parte/estudio sin cruzar tenants. | PASS_LOCAL_SQL | Client/contact/parte/firm durables con FKs; política directorio provisional solo sintéticos. |
| **F3-T03** Crear asunto consultivo y asunto litigioso con responsables, participantes y estado. | PASS_LOCAL_SQL_PARTIAL_UI | Matter responsable/participants/proceedings0..N; API reassignment y UI gestión permisos. |
| **F3-T04** Implementar tareas y actividad auditada con asignación y vencimiento interno. | PASS_LOCAL_SQL_HTTP | Tasks/activity/outbox/audit antes de respuesta; worker sin efectos externos. |
| **F3-T05** Implementar vistas compactas de clientes/asuntos/tareas y filtros útiles. | PASS_BROWSER_PARTIAL | Clientes/asuntos/tareas filtros locales compactos; cursor SQL/edición CRUD completa pendientes. |
| **F3-T06** Verificar E2E permisos y persistencia tras recarga, con dos estudios y dos abogados. | PARTIAL_NOT_REAL_IDP | Cliente tras recarga/newadapter PG probado; auth real y reinicio integral pendientes. |
| **F3-T07** No confundir asunto con procedimiento judicial ni calcular plazos por LLM. | PASS_LOCAL_SCOPE | Asunto consultivo y0..N procedimientos, sin cálculo plazos LLM. |
| **F4-T01** Subir originales sin sobrescritura; hash, extracción, versiones explícitas y permisos. | PARTIAL | Text/plain privado/hash/inmutable; PDF/binarios/scan/staging/Supabase Storage real pendientes. |
| **F4-T02** Relacionar documentos con asunto y responsables; registros inmutables de aprobación. | PASS_LOCAL_SQL | Document/matter y approvals append-only exactas SQL; permisos negativos comprobados. |
| **F4-T03** Implementar editor/borrador con versión y revisión interna, sin IA de producción. | PASS_BROWSER_SQL_HARNESS | Editor texto plano versionado/review real SQL, sin IA. |
| **F4-T04** Probar cambios de versión y prohibir aprobación implícita de una versión nueva. | PASS_LOCAL_SQL_HTTP | No herencia/version-conflict/least privilege/concurrencia/SQL takeover PASS. |
| **F4-T05** Diferenciar draft, revisión, aprobación, entrega y presentación con comprobante real. | PASS_LOCAL_MANUAL_PARTIAL | Delivery/Filing con versión aprobada+receipt, manual sintético; ninguna actuación externa. |
| **F4-T06** QA acceso privado y descargas/exports; E2E del ciclo documental. | PARTIAL | Descarga/annex autorizados y negativos PASS con filesystem de test; Storage/IdP real pendientes. |
| **F4-T07** Construir índice de expediente y anexos reproducibles sin alterar originales. | PASS_LOCAL_EXPORT | ZIP por versiones/hash reproducible, acceso ajeno denegado; límites escala pendientes. |

F5–F10 no cambiaron: corpus/confianza/modelos/piloto/finanzas/deploy conservan sus gates. Gasto0, deploy0. Históricos anteriores siguen intactos con su fecha; la aprobación vigente está en docs/ADR_OS_001_ACCEPTED.md.
