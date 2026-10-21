# Continuidad de desarrollo local

**Instrucción vigente 2026-10-13:** continuar el modo local sin autenticación y con localStorage; no pedir Docker ni credenciales para entrar. Ver [informe actual](LOCAL_BROWSER_IMPLEMENTATION.md). Arranque: `npm.cmd run os:build:web`, `npm.cmd run os:local`, http://127.0.0.1:4313. Los pasos siguientes se conservan para la futura migración al modo servidor.

2026-10-13. Stack B/São Paulo aprobados; continuar implementación, no repetir gate. Solo sintéticos locales, sin modelos pagos, deploy/push o producción.

1. Leer F1_F4_IMPLEMENTATION_REPORT.md, F1_F4_TEST_RESULTS.md, F1_F4_BLOCKERS.md y docs/operations/LOCAL_DEVELOPMENT.md.
2. Verificar PostgreSQL55432/app4310 iniciados. Datos/config/credenciales en .local-dev, ignorados; nunca imprimirlos.
3. Resolver Docker local, iniciar Supabase, configurar clave local privada y seed una vez. Main importa SDK real; HarnessSessions/FileTestBlobs solo en f1-f4/tests.
4. Ejecutar aceptación S01–S14 con IdP/Storage reales, nuevas sesiones y reinicio. Browser actual sí prueba HTTP/SQL, identidad de harness no acredita login real.
5. Completar MFA/refresh/auth.sessions, scanner/staging/reconciliación, paginación/ETag/limits/locks por alcance, política de clientes/roles y restore. Mantener denegación y estados honestos.
6. Preservar resultados iniciales/finales y baseline, usar salidas nuevas. El verificador F0 espera fuentes intactas y ya no corresponde al Core cambiado autorizadamente: usar delivery-verification de esta fase.

Rutas: apps/web React/Vite; apps/api Fastify/Auth/Storage/worker; packages/persistence-postgres adaptador/DDL; infra/local arranque/config/seed; supabase config y migración CLI. os-core sigue dueño de invariantes. SQL JSONB con FKs generadas, blobs privados separados, approvals inmutables. Junta/modelos/corpus/holdouts no reconstruidos.

Git local feat/os-core-local, sin commits/remoto. Revisar staging/secretos antes de primer commit; excluir .local-dev/node_modules/dist/caches/keys. Baseline558 diferencia archivos anteriores y cambios autorizados.

UI compacta13/44/212px, screenshots y medidas en f1-f4/reports. Finanzas/IA pendiente visible sin cifras falsas. Original text/plain hasta scanner, acto manual distinto de aprobación/descarga y review exacta confirmada. Siguiente dependencia: runtime Supabase Windows; ninguna evidencia actual declara DONE productivo.
