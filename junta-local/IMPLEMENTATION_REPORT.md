# Preparación de Junta y demo desde la interfaz

2026-10-13. Solicitud: dejar preparado lo que el propietario necesita cargar. No se autoriza ni ejecuta inferencia paga ni despliegue.

## Entrega

`.env` creado exclusivamente con claves vacías, modelos requeridos por los adaptadores y límites conservadores. Se conserva en el workspace, ignorado por Git; no se guarda en dist ni se incluye en respaldos del navegador. La clave Gemini del entorno se detecta por presencia, sin imprimir/copiar/persistir su valor. Faltan JEV_API_KEY y OPENAI_API_KEY; Gemini sigue sin verificar.

`junta:preparar` crea el archivo solo si falta. `junta:estado` lee configuración actual y reporta presencia/fuente de claves, IDs esperados y coincidencia de modelos sin red. Nunca devuelve valores de claves ni valores arbitrarios de variables de modelo al frontend. Una clave presente no se presenta como cuenta validada.

Panel Junta Jurídica en Trabajo jurídico, disponible sin estudio: instrucciones, tabla de configuración, refresco, demo offline y descarga JSON. Las claves se introducen en el archivo local, no en controles del navegador. Se conserva el equipo del estudio en un bloque desplegable. El Core y las reglas de asuntos no cambian.

El servidor local agrega dos rutas acotadas: status GET y demo POST. Se exige host local exacto, mismo origen y encabezado específico en el POST, se rechazan cuerpos/argumentos arbitrarios, se impide ejecución simultánea y se conserva cada run con ID único. No hay rutas de ejecución real. La demo invoca el CLI compilado en proceso aislado con guardia de red, sin API keys ni NODE_OPTIONS heredados; solo usa los proveedores offline existentes. Resultado validado como OFFLINE_SIMULATION y gasto real 0 antes de devolverlo.

El servidor fue reiniciado en el puerto habitual 4313, conservando origen y datos del navegador. La CSP ahora admite únicamente conexiones al propio origen para el puente, sin destinos externos.

## Pruebas

`npm.cmd run build`, `npm.cmd run os:build:web` y `npm.cmd run os:typecheck`: PASS. `npm.cmd run os:test:local`: **11/11 PASS**, cuatro archivos; evidencia `reports/tests.json`. Incluye las nueve pruebas locales anteriores y dos nuevas:

- Preparación de .env, preservación de archivo existente, herencia de Gemini y redacción completa de secretos con valores sintéticos.
- Navegador sin estudio: panel visible, claves solo por nombre, demo con motor offline, resultado sintético y descarga; rechazo de ruta real, origen ajeno y payload arbitrario. Cero requests externos del navegador. Evidencia `reports/browser.json` y `reports/junta-1366.png`.

Las 271 regresiones existentes del Core/Junta pasaron en el cambio local anterior; no se vuelven a atribuir como inferencia ni como prueba del acceso real de proveedores. El Core no cambió en esta preparación.

## Alcance pendiente

La ficha `consulta.example.json` es entrada para preparar un caso, no un bundle ejecutable. Cuenta/capacidades, tarifas vigentes, corpus y atestaciones, compatibilidad PDF y congelación de evidencia siguen pendientes. Los IDs de modelo se mantienen exactamente como exige el repositorio; no se asume acceso. La prohibición de gasto permanece aunque se completen claves. La demo no analiza datos del estudio ni responde una consulta jurídica real.
