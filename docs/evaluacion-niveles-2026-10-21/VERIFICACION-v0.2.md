# Verificación preparatoria — 21/10/2026

**Resultado: no habilitar inferencias del piloto.** Se prepararon seis dossiers y se archivaron 15 publicaciones oficiales. Se verificó documentalmente la publicación del precedente N06. Persisten dos controles técnicos sin acreditar y la aprobación jurídica humana. No se modificó código de producción, configuración de aprobación, precios, base de datos ni permisos del sistema operativo.

## Evidencia técnica

`node scripts/verify-evaluation-readiness.mjs` genera [VERIFICACION_TECNICA.json](operacion/VERIFICACION_TECNICA.json). Extrae la función `perform()` actual y la ejecuta con proveedores sintéticos, sin importar configuración ni proveedores reales. Examina los archivos concretos identificados por hash en el informe. No es una prueba de extremo a extremo del servicio en producción.

| Control | Resultado observado | Límite de la evidencia |
|---|---|---|
| Saldo por interacción | Una llamada sintética de USD 0,40 cabe en USD 0,60; la siguiente se rechaza | Prueba unitaria de la función de producción |
| Resultado incierto | Mantiene USD 0,40 reservados en memoria al fallar la llamada | No demuestra persistencia tras reinicio |
| Techo total del piloto | Dos saldos nuevos permiten USD 0,80; no hay cuenta global en esta función | Demostración con techo hipotético USD 0,60; no gasto real |
| Concurrencia | Dos llamadas que esperan conteo consumen USD 0,80 de un saldo USD 0,60; termina en -0,20 | Concurrencia sintética; no demuestra que el flujo normal ejecute especialistas en paralelo |
| Separación de dossiers | El proceso preparador lee canario en dossiers por ruta absoluta y relativa | El modelo tiene herramientas distintas; no se certificó su alcance por esta prueba |
| Lectura mediante enlace | No se pudo crear symlink: EPERM | NO PROBADO; no equivale a una denegación correcta de lectura |
| Red/base productiva | Puerto 55432 sin conexión durante la prueba TCP | Ausencia de respuesta no demuestra aislamiento; no se hicieron consultas SQL |

Prueba existente ejecutada con transporte sintético y credenciales ficticias: `node node_modules/vitest/vitest.mjs run --config f1-f4/vitest.config.ts f1-f4/tests/workspace-agent.test.ts` — **17/17 aprobadas**. Incluye presupuesto compartido entre director/delegados, reserva ante fallo de Gemini/fallback, denegación de herramientas y corrección de selección fuera de alcance. No cubre el límite global ni el aislamiento por identidad del sistema operativo.

## Hallazgos de código

1. `scripts/workspace-ai.mjs`: `executionLedger ?? { remaining: executionBudget }` crea saldo nuevo por invocación raíz; las delegadas sí reciben el compartido. `perform()` retiene reservas inciertas en ese objeto. No persiste sus débitos/conciliaciones como cuenta global del benchmark.
2. `scripts/workspace-bridge.mjs`: la llamada raíz pasa `undefined` como ledger externo. La inicialización normal exige base local 55432 y usa `.local-dev/workspace-objects`. No hay una instancia aislada del benchmark configurada por este paquete.
3. `apps/api/src/workspace.ts`: registra `reserved_usd` duradero por job e idempotencia del comando. Ese registro no es un techo global ni evidencia de conciliación por llamada; no confundir ambos conceptos. La suma mostrada por gestión tampoco basta para impedir admisiones que superen un límite.
4. `scripts/platform-bridge.mjs`: las herramientas de actas/transcripción pueden admitir su propio presupuesto. No se acreditó que debiten el saldo compartido del trabajo jurídico. En el piloto deben estar deshabilitadas o pasar por una reserva total común. Se preservó la modificación previa de este archivo.
5. `scripts/workspace-agent.mjs`: el catálogo del modelo usa herramientas controladas, no acceso general al filesystem. Historial está delegado al repositorio autorizado y gestión al bridge; biblioteca puede leer fuentes del host mediante el runtime. No se probó que esas vías no puedan alcanzar referencias, otros casos, backups o material futuro. La prueba de canario del host no se atribuye al modelo.

## Correcciones necesarias antes de ejecutar

- Preparar una identidad/instancia con base, almacenamiento e índices propios. Entregar solo documentos liberados por caso/turno. Sacar dossiers y clave de todas las rutas legibles por esa identidad. Conservar el workflow del producto; no crear recorridos de análisis alternativos.
- Probar canarios contra cada herramienta habilitada y registrar denegaciones; incluir historial ajeno, biblioteca, rutas/enlaces, red y documento de turno futuro. No se puede marcar este punto aprobado usando solo nombres de carpetas.
- Reservar cada admisión y cada gasto en una cuenta persistente única del piloto con operación atómica. Mantener reservas inciertas y vincular reintentos/reinicio por ID. Impedir un segundo envío que rebase el saldo después de un conteo asíncrono. Cubrir todos los proveedores y herramientas; demostrarlo con fallos, concurrencia y reinicios sin modelos reales.
- Validar tarifas y cotas de llamadas/contexto; el cálculo de USD 86,40 es nominal. Obtener aprobación jurídica por dossier y autorización total solo después de cerrar estas comprobaciones.

## Integridad y repetición

`node scripts/prepare-evaluation-package.mjs` reconstruye casos, inventario y manifiesto solo a partir de fuentes ya archivadas; no usa red, credenciales ni modelos. Conserva el manifiesto v0.1, genera v0.2 y valida seis casos, 36 filas y referencias de fuentes. Los hashes de fuentes y código permiten detectar cambios posteriores; si cambian, repetir los controles afectados antes de congelar.

No hay firma humana, clave ciega, runner habilitado ni autorización de gasto guardados por estos scripts. Las banderas negativas en el informe son estado de preparación, no un bloqueo técnico de todas las rutas del producto; la instancia actual conserva su configuración previa.
