# Verificación técnica offline — v0.5

**Addendum documental v0.4, 21/10/2026:** [vigencia](VIGENCIA.md), [presupuesto](PRESUPUESTO.md) y [validación pendiente](VALIDACION_ABOGADO.md). Se consultaron tarifas actuales y se identificaron dos bloqueos adicionales para pagos: corpus excedido en las 24 combinaciones de caso/turno, y cálculo financiero escalar sin tramo de contexto largo. La prueba sintética anterior conserva validez para concurrencia, persistencia y controles de acceso con sus entradas; no acredita que el nuevo paquete complete el piloto ni que toda tarifa comercial esté cubierta. El código nativo no cambió; no se repitió su lanzamiento en esta revisión documental. Evidencia nueva separada: [REVISION_DOCUMENTAL_OFFLINE.json](operacion/REVISION_DOCUMENTAL_OFFLINE.json).

**Estado actual v0.5:** ambos defectos quedaron corregidos; véase [CORPUS_Y_TARIFAS.md](CORPUS_Y_TARIFAS.md). Las fuentes se transportan íntegras una sola vez y las referencias permiten reconstrucción exacta. Los 24 paquetes pasan integración offline; se prueba rechazo de excesos reales. El tramo largo se aplica en reserva y liquidación, con pruebas de frontera, incertidumbre y concurrencia. Se repitió aislamiento nativo con cuatro turnos, dos especialistas e integración, nueve generaciones sintéticas por turno. No se ejecutó la matriz paga. Los párrafos v0.3/v0.4 siguientes describen el antecedente, no bloqueos de tamaño/precio pendientes hoy.

Se corrigieron las reservas concurrentes del runtime actual y se añadió un registro global persistente al ejecutor aislado del benchmark. La verificación usa respuestas sintéticas: **cero inferencias pagas y cero solicitudes a proveedores reales**. Los dossiers siguen pendientes de validación humana y cierre de vigencia.

## Cambios y evidencia

`scripts/workspace-spend.mjs` contiene la función que ahora usa `workspace-ai.mjs` para todos los roles. Después de un conteo asíncrono vuelve a leer el saldo; la comprobación y el débito son síncronos. Solo libera una reserva cuando conoce el uso. `workspace-spend-store.mjs` registra política, interacciones y reservas en SQLite, con enteros conservadores en nanodólares y transacciones `BEGIN IMMEDIATE`. La base queda fuera del proceso evaluado. No se admite repetir un ID iniciado; reservas sin cierre o inciertas sobreviven al reinicio. Una responsabilidad informada superior a la reserva detiene gastos posteriores en vez de ocultar el exceso.

`benchmark-isolation.mjs` construye snapshots con fuentes verificadas por hash, liberación temporal y copias de código sin enlaces. El lanzador nativo `benchmark-appcontainer.cs` crea un AppContainer sin capacidades, comprueba su token y permite únicamente lectura de la cápsula. La cuenta global se opera desde el host por mensajes limitados a la interacción/tickets autorizados. Se rechazan biblioteca y herramientas de gestión en el runtime del benchmark, por lo que no pueden iniciar presupuestos laterales.

La política implementada solo acepta **OFFLINE_ONLY**. No modifica el límite normal del producto ni autoriza USD 86,40 de gasto real. El transporte del worker es una fixture local sin llamadas a fetch; la barrera de red de Windows impide además la salida directa.

## Comprobaciones reproducibles

- [OFFLINE_TESTS.json](operacion/OFFLINE_TESTS.json): suite del agente, reservas persistentes/concurrentes y aislamiento de snapshots. Comprueba el techo global antes de cualquier transporte del runtime; dos procesos que intentan reservar USD 0,40 contra USD 0,60 solo admiten uno; reapertura del registro, replay, incertidumbre, reembolso, exceso de uso, importes inválidos y límite por interacción. Comprueba los seis casos y liberación del precedente N06 a partir del segundo turno.
- [AISLAMIENTO_OFFLINE.json](operacion/AISLAMIENTO_OFFLINE.json): prueba en Windows del token, permisos, canario SQLite fuera de alcance, denegación de escritura/procesos y ausencia de conexión al listener local. El workflow real ejecuta especialista/auditor con respuestas sintéticas.
- [VERIFICACION_TECNICA.json](operacion/VERIFICACION_TECNICA.json): nueva prueba financiera sin red y comparación de hashes de código contra el ejecutor aislado probado. Rechaza evidencia obsoleta si cambia el código.
- Comprobación TypeScript: `node node_modules/typescript/bin/tsc -p apps/os.tsconfig.json`.

Comandos de repetición:

```powershell
node node_modules/vitest/vitest.mjs run --config f1-f4/vitest.config.ts f1-f4/tests/workspace-corpus.test.ts f1-f4/tests/workspace-spend.test.ts f1-f4/tests/workspace-agent.test.ts f1-f4/tests/workspace-integration.test.ts f1-f4/tests/benchmark-isolation.test.ts f1-f4/tests/workspace-quality.test.ts f1-f4/tests/workspace-specialists.test.ts --reporter=json --outputFile=docs/evaluacion-niveles-2026-10-21/operacion/OFFLINE_TESTS.json
node scripts/budget-evaluation-pilot.mjs
node scripts/benchmark-offline-check.mjs
node scripts/verify-evaluation-readiness.mjs
node scripts/prepare-evaluation-package.mjs
```

## Límites conservados

La fixture produjo un resultado `REVIEW_REQUIRED`: el checker detecta referencias también en el texto de fuentes transportado dentro de aportes. No se alteró el checker ni se suprimieron esos hallazgos para conseguir una aprobación. El informe distingue éxito técnico de aislamiento/gasto de aprobación jurídica. Esta observación debe examinarse al calibrar el piloto.

La prueba aislada recorre cuatro interacciones con proveedor sintético y conservación del historial propio en SQLite fuera de la cápsula. Rechaza IDs de otras ejecuciones y claims de turnos ya iniciados; no demuestra calidad jurídica ni reemplaza conversaciones con modelos reales. Persisten la revisión humana de dossiers/vigencia, revisión de corpus y tamaño de contexto, tarifas comerciales, preparación del cegamiento final y autorización del total. No hay modo de pago habilitado en este ejecutor.

La modificación previa de `scripts/platform-bridge.mjs` se preservó. No se arrancó ni detuvo PostgreSQL, no se cargaron contratos reales y no se cambiaron interfaz ni recorridos del producto. Se conservan VERIFICACION-v0.2.md y el JSON anterior como evidencia histórica de los fallos corregidos.

Referencias de implementación: [AppContainer de Microsoft](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation), [token y capacidades](https://learn.microsoft.com/windows/win32/api/winnt/ne-winnt-token_information_class), [permisos y límites de Node 24](https://nodejs.org/download/release/v24.20.0/docs/api/permissions.html), [SQLite de Node](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).
