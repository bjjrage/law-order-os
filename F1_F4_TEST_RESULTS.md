# Pruebas locales F1–F4

**Addendum 2026-10-13:** pruebas del nuevo modo sin autenticación/localStorage en [informe actual](LOCAL_BROWSER_IMPLEMENTATION.md) y `local-browser/reports/`. Los resultados siguientes conservan la validación previa con PostgreSQL y dobles de identidad; no representan la autenticación del modo local actual.

2026-10-13. **271 regresiones y15 pruebas nuevas**, con límites separados. No equivalen a E2E empresarial Supabase.

| Comprobación | Resultado / evidencia |
|---|---|
| Suite previa |271/271 PASS,17 archivos,42 OS incluidos; core-regression-first.json y core-regression-final.json |
| Suite adicional |15/15 PASS,3 archivos; local-integration-final.json, PostgreSQL real e identidad de harness |
| Typecheck/builds | Raíz, OS app, Junta/Core/API/Web PASS; checks.json |
| RLS | Otro estudio y mismo estudio sin participación denegados en SQL directo, rol no dueño/no BYPASSRLS |
| Transacciones | Rollback/blob failure sin publicar catálogo/FKs entre tenants rechazadas |
| Aprobación | Versión exacta/revisor distinto/no herencia, concurrencia una approval, READ+DRAFT_REVIEW sin write, takeover SQL rechazado |
| Idempotencia | Mismo key mismo ID, payload diferente409, replay después de revocación404 sin privado |
| HTTP | CSRF/401/404, tenant/actor inyectados, binario no escaneado rechazado; audit antes de transmitir |
| Export | ZIP idéntico por hash entre repeticiones, acceso ajeno404 |
| Browser100% |1366×768:15 filas;1440×900:16; body13px/topbar44/sidebar212; browser-evidence.json y screenshots |
| Browser workflow | Cliente persiste tras recarga, borrador→otro usuario→confirmación→approval SQL; exact-review-browser.png |
| Foco/reflow | BUTTON/outline solid, captura320px; contraste/zoom/teclado exhaustivo pendiente |
| Supabase start | BLOCKED exit1 Docker; supabase-local-runtime.json sin claves |
| IdP/Storage/restore/MFA/refresh/zoom real | NOT_RUN/BLOCKED; no simular acreditación |

Todos los artefactos viven en f1-f4/reports. La comprobación más reciente, después de afinar políticas de tareas de revisión y replay, es local-integration-verified.json (15/15). Fallos iniciales preservados: postgres-first.json4/6 fallos porque BEFORE trigger comparaba columnas generadas NEW aún no calculadas, y ZIP UTC1980 caía en1979 local. Se corrigieron comparación JSON y fecha fija local; postgres-second.json6/6 PASS. local-integration-third.json7/7 PASS.

local-integration-fourth.json12/13: auditoría en onResponse aún escribía al observar respuesta. Se movió a onSend, esperado antes de transmitir; si audit falla,503 con retry idempotente. Añadidas regresiones least privilege/replay revocado; final15/15 PASS. No se modificaron resultados iniciales.

Harness aislado de main: autenticación TEST-ONLY, filesystem real de pruebas, PostgreSQL real. Navegador bloquea red externa. Sin llamadas a modelos/embeddings/OCR pago/deploy. Mediciones bibliográficas12/12–11/12 y engine permanecen intactos.
