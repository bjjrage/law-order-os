# Implementación local F1–F4

**Addendum 2026-10-13:** por cambio de alcance del propietario, el modo predeterminado ahora funciona sin autenticación y persiste en localStorage. No requiere Docker ni credenciales. Ver [implementación vigente](LOCAL_BROWSER_IMPLEMENTATION.md); el informe siguiente conserva evidencia del stack servidor preparado para migración futura.

2026-10-13. **Implementado y comprobado por capas; fases empresariales PARCIALES/BLOCKED**, no release. Autorización: docs/ADR_OS_001_ACCEPTED.md. São Paulo aprobado para futuro; nada desplegado.

| Frente | Código/comportamiento | Evidencia y límite |
|---|---|---|
| Gobierno | ADR aceptado, Git feat/os-core-local, ignore secretos/datos; baseline558 archivos | Sin remoto/push/commit. Históricos preservados. |
| Core reutilizado | os-core/src: puerto async, Authorization/comandos await, actor propagado a tx; memory actualizado solo testing |271 regresiones conservadas. Junta/modelos sin cambios. |
| PostgreSQL real | packages/persistence-postgres; conexión única tx serializable, SET LOCAL ROLE/contexto, RLS/FKs compuestas/CAS | Rol no dueño/no BYPASSRLS probado. JSONB de dominio con columnas generadas/FKs, no DDL empresarial final. |
| Inmutabilidad | Versiones/actividad sin UPDATE, approval append-only por trigger, versión/revisor exactos | Concurrencia produce una approval; SQL rechaza takeover. Lock global MVP, no throughput certificado. |
| API | apps/api: firm/member/client/contact/matter/participant/task/document/draft/review/proceeding/delivery/activity/my-day/annex | CSRF/Origin/cookie HttpOnly, idempotencia y replay reautorizado, errores mínimos, audit antes de respuesta. |
| Auth preparada | SupabaseSessions, BFF SQL durable, AES-GCM, SDK signIn/getUser, expiración/logout | Supabase real local NOT_RUN por Docker; no login de harness en main. MFA/refresh/auth.sessions estricta pendientes. |
| Storage preparado | Supabase privado/upsert false, SQL metadata/blob_key/SHA | Storage real NOT_RUN; tests filesystem real separado. Solo UTF-8; PDF/scanner/staging pendientes. |
| UI compacta | React/Vite: Mi día, asuntos, clientes, agenda interna, equipo, documentos/editor/revisión/actos/actividad | Browser+HTTP+PG pasó con identidad TEST-ONLY.15 filas1366 y16 filas1440,13/44/212px. |
| Documentos | Revisiones versionadas, autor distinto, confirmación exacta, edición no hereda approval | Dos usuarios de browser/SQL PASS, no E2E Supabase. |
| Procedimientos/actos/export | Proceeding0..N, Delivery solo aprobado+comprobante, anexos ZIP estable | Manual/sintético; no actuación judicial ni comunicación externa. |
| Jobs | Outbox misma tx de actividad, worker one-shot sin efectos externos | No IA/correo/scraping. |

Windows sin Docker motivó PostgreSQL portátil **real** para comprobar SQL ahora, sin cambiar proveedor productivo. Migración CLI materializada desde schema.ts. Runtime/SDK rechazan URLs remotas, fetch sin redirects externos. Base de aplicación sin memory adapter.

Blobs: DocumentVersion mantiene base64 transitorio compatible con Core/tests; SQL omite bytes y guarda blob_key. `/originals` agrupa documento+versión+publicación en tx de catálogo; objeto externo puede quedar huérfano privado tras rollback. Intent/quarantine/scan/reconciliación todavía no implementados.

API local usa POST explícitos donde propuesta mencionaba PUT/PATCH, sin cursor SQL/ETag universal. Publicación/borradores/reasignación conservan expected version/estado y CAS SQL. Listas autorizadas materializan resultados del alcance; paginación, límites de export y N+1 Mi día pendientes antes de carga. Clientes conservan directorio por estudio, solo sintéticos hasta cerrar política.

E2E real IdP/Storage, reinicio/restore completo, MFA/refresh, binarios/scan, contraste y zoom real85%/200% siguen pendientes. Captura320 no acredita accesibilidad integral. `/ready` permanece503. No declarar F1–F4 DONE por pruebas parciales.

Baseline de fuentes/paquetes en f1-f4/baseline,558 hashes en reports/baseline.json. Cambios autorizados en Core/paquetes/ignore/README; Junta, canónicos, originales/holdouts/reportes históricos preservados. delivery-verification.json detalla hashes finales. Arranque: docs/operations/LOCAL_DEVELOPMENT.md. App4310/PG55432 iniciados; sin inferencia, cloud, deploy o migración productiva.
