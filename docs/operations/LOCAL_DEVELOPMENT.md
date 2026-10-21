# Desarrollo local del OS

**Modo vigente desde el cambio solicitado el 2026-10-13:** sin login, con localStorage. Ejecutar `npm.cmd run os:build:web` y `npm.cmd run os:local`, abrir http://127.0.0.1:4313. No requiere Docker, PostgreSQL, Supabase ni credenciales. Ver [informe actual](../../LOCAL_BROWSER_IMPLEMENTATION.md) y [addendum del ADR](../ADR_OS_001_LOCAL_BROWSER_ADDENDUM.md). Las instrucciones siguientes conservan el modo servidor como antecedente y futura migración; no son requisitos para empezar a usar el prototipo.

2026-10-13. ADR aceptado: docs/ADR_OS_001_ACCEPTED.md. Raíz: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS`. Solo datos sintéticos. APIs/BD/SDK admiten loopback; São Paulo es región futura, no ubicación de este proceso Windows.

## Arranque

Node observado24.20.0; dependencias nuevas exactas y lockfile incluidos.

```powershell
npm.cmd ci --ignore-scripts --cache .npm-cache --no-audit --no-fund
npm.cmd run os:build:api
npm.cmd run os:build:web
```

Terminal1: `npm.cmd run os:postgres`. PostgreSQL portátil real escucha127.0.0.1:55432, BD law_order_local. Datos y contraseñas aleatorias en `.local-dev/`, ignorado por Git. No instala servicio Windows ni usuario del sistema. Codex restringido puede requerir permiso de proceso por userInfo de Windows; no exige administrador en terminal normal. Paquete18.4.0-beta.17 es herramienta de desarrollo, no versión cloud elegida. Supabase local configura PG17: comprobarlo al habilitar Docker.

Primera configuración: `npm.cmd run os:configure`. No sobrescribe `.local-dev/app-config.json`. Contiene URLs/contraseñas locales y clave AES de sesiones: nunca chat/logs/Git. database_url usa os_app_login sin dueño/BYPASSRLS; auth_database_url es conexión privilegiada local separada para identidad/sesión/audit/outbox, a endurecer antes de datos reales.

## Supabase pendiente

CLI2.117.0; config generado con init y migración creada con migration new. `supabase start` observado exit1 por Docker ausente; f1-f4/reports/supabase-local-runtime.json conserva solo estado, sin claves. No se instaló Docker/WSL ni creó cloud. La alternativa nativa documentada para Linux/macOS no cubre este Windows.

Cuando el operador disponga de runtime Docker compatible, arrancar Supabase local enlazado a127.0.0.1, consultar estado privado y completar clave **local** de servidor en app-config.json. os_private no está expuesto al Data API; analytics apagado, correo atrapado localmente, sin SMTP externo. Core puede permanecer en portátil55432 y Auth/Storage en stack54321: topología exclusivamente de desarrollo.

Ejecutar una vez `npm.cmd run os:seed`: crea cuatro identidades sintéticas reales del IdP y bucket law-order-private privado. Credenciales/IDs solo en `.local-dev/synthetic-credentials.json`. Si falla, diagnosticar antes de repetir: no borra usuarios ni garantiza idempotencia de un seed parcial. La migración CLI entrega esquema para reproducirlo; Core ya fue creado en portátil, no se aplicó nada remoto.

Terminal2: `npm.cmd run os:start`. Abrir http://127.0.0.1:4310, mismo origen web/API. Hoy puede revisarse login/estados, pero no iniciar sesión real hasta resolver Supabase. `/health` identifica local/IA apagada; `/ready` devuelve503 mientras Auth/Storage no estén verificados. No usar proxy4311 sin ajustar Origin/CSRF; se recomienda el build servido por API.

Recorrido: admin local→estudio atómico/membership→incorporar lawyer por ID privado→cliente→asunto/responsable→original/tarea→borrador→Equipo concede READ/DRAFT_REVIEW al revisor→solicitar revisión→otra sesión del revisor→confirmar versión exacta. Revocación afecta comandos y replay idempotente. Descargar/completar tarea no aprueba. Procedimientos0..N y entrega/presentación con comprobante son registros manuales, nunca envíos/juzgado automáticos.

Solo originales UTF-8 text/plain≤20MiB. PDF/Office/binarios bloqueados hasta scanner/staging/quarantine. SQL almacena blob_key/hash, no bytes base64; Core los usa transitoriamente. Blob escrito antes de rollback puede quedar huérfano privado: no hay transacción distribuida ni reconciliador completo.

## Pruebas y operación

```powershell
npm.cmd run typecheck
npm.cmd run os:typecheck
npm.cmd run build
npm.cmd run build:os-core
npm.cmd run os:build:api
npm.cmd run os:build:web
npm.cmd run board:test -- --reporter=json --outputFile=f1-f4/reports/nueva-regresion.json
npm.cmd run os:test -- --reporter=json --outputFile=f1-f4/reports/nueva-integracion.json
npm.cmd run os:worker
```

Elegir salidas nuevas. Suite adicional requiere portátil activo y Edge local. Harness solo en f1-f4/tests, nunca importado por main; usa identidad sintética/archivos locales y PostgreSQL real, no acredita IdP/Storage Supabase. Navegador bloquea destinos no locales. Worker one-shot reclama100 eventos con SKIP LOCKED; no correo/IA/efectos externos.

Ctrl+C detiene cada proceso conservando datos. No DROP law_order_local. Tests eliminan solo BD law_order_test_UUID con nombre validado. pg_dump/restore no incluidos en portátil, restore completo NOT_RUN: backup SQL debe incluir objetos, IdP/config/secretos; restaurar aislado y comprobar hashes/permisos antes de piloto. Sin datos reales, gasto, deploy, push ni producción.
