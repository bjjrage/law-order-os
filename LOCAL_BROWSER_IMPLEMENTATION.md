# Prototipo local sin autenticación

**Addendum de Junta local, 2026-10-13:** ahora **Trabajo jurídico** incluye un panel de configuración y demo offline de la Junta, accesible sin crear estudio. El servidor conserva la gestión en localStorage y agrega únicamente `/local/junta/status` y `/local/junta/demo`; la CSP permite conexiones al mismo origen y bloquea destinos externos. El puente no tiene ruta de IA real, no entrega claves y ejecuta la demo con red bloqueada y sin claves heredadas. Ver [preparación](junta-local/LEEME.md) y [pruebas](junta-local/reports/tests.json): 11/11 locales pasan tras el cambio. La evidencia histórica de 9 pruebas y CSP sin conexiones se conserva como antecedente.

2026-10-13. Decisión vigente: [addendum del ADR](docs/ADR_OS_001_LOCAL_BROWSER_ADDENDUM.md). Sin Docker, credenciales, llamadas pagas ni despliegues. Los informes F1/F4 anteriores conservan la evidencia del desarrollo con HTTP/PostgreSQL; sus bloqueos de Supabase no bloquean este modo local.

## Uso

La app está en http://127.0.0.1:4313. Crear un estudio desde «Crear estudio», agregar clientes y abrir asuntos. El menú permite exportar e importar respaldos. Los perfiles «Administrador local» y «Abogado local» son sintéticos, se eligen libremente y no tienen contraseña. Para probar una revisión, conceder al abogado participación en el asunto con READ y DRAFT_REVIEW, solicitarle revisión y cambiar al perfil abogado. El autor no puede aprobar su propio borrador.

Para iniciarla después:

```powershell
npm.cmd run os:build:web
npm.cmd run os:local
```

No necesita iniciar la API, PostgreSQL ni Supabase. Mantener el mismo navegador y URL para recuperar los datos. Exportar respaldos antes de borrar el almacenamiento. Solo datos sintéticos: esta versión no autentica identidades ni ofrece aislamiento ante quien accede al navegador.

## Implementación

El Core se reutiliza directamente en el navegador. Sus utilidades de bytes ahora usan Uint8Array, TextEncoder, base64 y WebCrypto, también disponibles en Node. No se duplican las reglas de asuntos, tareas, documentos ni aprobación. La API autenticada y el adaptador PostgreSQL existentes conservan sus controles; no se agregó un bypass al servidor.

`BrowserPersistence` conserva quince tablas con IDs/versiones/hashes en un único snapshot JSON versionado. Cada comando ejecuta una copia transaccional, valida referencias y escribe una vez. Se serializan operaciones de la pestaña, se usan Web Locks cuando están disponibles y se comprueba el estado antes de guardar para detectar cambios de otra pestaña. La aplicación recarga ante cambios de almacenamiento realizados por otras pestañas.

Las incorporaciones de original y las revisiones con comprobación de versión son operaciones atómicas. Las lecturas no escriben. La cuota agotada, JSON corrupto, esquema desconocido o referencias inválidas generan errores sin reinicializar ni borrar datos. La importación verifica los SHA-256 de los documentos. Exportación e importación conservan IDs y contenido; una restauración sustituye el estado del navegador solo tras confirmación explícita del usuario.

Los enlaces de documentos y anexos ZIP funcionan con blobs locales. La app no envía requests a `/api`, Supabase ni proveedores de IA en este modo. El servidor estático escucha únicamente en loopback y bloquea conexiones de scripts con CSP. Las claves de IA no se trasladan a localStorage ni al frontend.

## Validación

Resultado: **271/271 regresiones existentes y 9/9 pruebas locales pasan**. Typecheck y compilación del Core/web pasan. La evidencia de este cambio está en `local-browser/reports/`: regresión del Core/Junta (`core-regression.json`), pruebas de persistencia y navegador (`tests-final-verified.json`), captura a 1366×768 y reporte de navegador (`browser.json`). La prueba del navegador crea estudio y cliente desde la UI, recarga, exporta, borra el estado de prueba e importa el respaldo; no hay login ni requests de API o externos. Mantiene fuente de 13 px, barra de 44 px y menú de 212 px. El escenario de rutas locales prueba documentos, tareas, borrador, autor/revisor, rechazo de versión incorrecta, aprobación exacta, ZIP y respaldo con integridad.

Se conservan los primeros resultados fallidos: timeout del lanzamiento del servidor hijo del harness y una aserción que usaba la respuesta de solicitud de revisión sin acceder a su campo `review`. El harness usa ahora un servidor estático en el mismo proceso y la respuesta contractual correcta; la corrida final pasa. No se cambió el Core para aceptar aprobaciones inválidas.

Para repetir el harness histórico HTTP/PostgreSQL de F1–F4 hay que compilar la web con `VITE_DATA_MODE=server` antes de `npm.cmd run os:test`; luego quitar esa variable y reconstruir para volver al modo navegador. El harness local nuevo se ejecuta con `npm.cmd run os:test:local`, después de la compilación predeterminada.

## Pendientes futuros

La migración a Supabase aún no se ejecutó. Requiere identidades reales, mapa de perfiles, migración verificable de objetos/metadata, RLS, QA del modo servidor y las tareas pendientes ya informadas. El modo local no habilita finanzas, portal, PDFs sin escaneo ni IA real. Las claves actualmente configuradas y su validez no cambian por este trabajo. Se mantienen cero llamadas pagas y cero despliegues.
