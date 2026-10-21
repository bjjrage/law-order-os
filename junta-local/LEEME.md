# Qué cargar para la Junta

**Actualización del flujo conectado:** ahora se consulta desde **Asuntos → asunto → Consultar Junta**, con pregunta y versiones seleccionadas. Jev/Luna/Sol/Gemini pasan el nuevo chequeo de metadatos con prioridad de `.env`. La ruta real está implementada y requiere autorización del propietario vinculada a la consulta concreta; no basta una casilla del navegador. Ver [informe vigente](CONNECTED_CASE_REPORT.md). Las indicaciones siguientes sobre la demo aislada y la ausencia de ruta real describen la preparación anterior.

2026-10-13. Preparación local; no se ejecutan proveedores reales, llamadas pagas ni despliegues.

## Lo que completás vos

### Proveedor de análisis del workspace

Gabriel por texto conserva `gpt-6-luna` con `GABRIEL_REASONING_EFFORT=xhigh`.
La voz nativa conserva su modelo Realtime; subir el esfuerzo del modelo de texto
no es una mejora de latencia de audio. La junta completa conserva Jev/Luna/Sol/Gemini.

Para activar DeepSeek directo para los especialistas y las propuestas de redacción,
agregar al `.env` local. Santiago audita con Gemini en una llamada independiente;
si Gemini no está disponible, usa Luna `xhigh` como respaldo independiente del autor
DeepSeek. Se registra el modelo que realmente auditó y el motivo técnico del cambio,
sin aumentar el presupuesto. No se activa por observaciones adversas del auditor ni
por límites de presupuesto; tampoco se permite Luna como respaldo si el autor es Luna.
Las correcciones vuelven al autor y pasan por una nueva auditoría con el mismo criterio.

```dotenv
DEEPSEEK_API_KEY=COMPLETAR_SOLO_EN_EL_ARCHIVO_LOCAL
WORKSPACE_ANALYSIS_PROVIDER=deepseek
DEEPSEEK_ANALYSIS_MODEL=deepseek-flash
GABRIEL_REASONING_EFFORT=xhigh
```

Sin activación explícita, las instalaciones existentes mantienen el proveedor
OpenAI. Seleccionar DeepSeek sin su clave produce un error explícito: no se
sustituye por Luna ni se envía la clave OpenAI a DeepSeek. Para volver al proveedor
anterior, usar `WORKSPACE_ANALYSIS_PROVIDER=openai`.

El alias público `deepseek-flash` sirve actualmente V4.1-Flash-1017; no fija una
revisión inmutable. Tarifas y compatibilidad verificadas el 19/10/2026 en
[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/).
La reserva usa la tarifa pico sin caché (USD 0,30 entrada / USD 1,20 salida por
millón de tokens); fuera de hora pico las tarifas publicadas son USD 0,15 / 0,60.
El resultado y las auditorías registran el modelo utilizado. La compatibilidad
técnica no acredita mejor desempeño jurídico: requiere evaluación con casos y
fuentes revisadas. La integración se prueba con transporte simulado, sin enviar
contratos a un proveedor nuevo ni ejecutar llamadas pagas automáticamente.

Abrir `.env` en la raíz del proyecto. Está preparado con los modelos y límites. Solo completar los campos de clave que falten:

| Campo | Para qué se usa |
|---|---|
| `JEV_API_KEY` | Router Jev, adaptador TypeSafe existente |
| `OPENAI_API_KEY` | Contexto Luna y análisis Sol; comparten la misma clave |
| `GEMINI_API_KEY` | Auditor Gemini; si ya existe en el entorno del proceso, se reutiliza sin copiarla |

Ejemplo de formato: `OPENAI_API_KEY=valor_de_tu_clave`. El archivo creado deja los valores vacíos; no incluye claves inventadas. No pegar claves en el chat ni en la pantalla de la app. No agregar prefijo `VITE_`. La clave de OpenAI debe usarse desde el proceso de Node, fuera del navegador, según [OpenAI Docs](https://developers.openai.com/api/reference/overview).

Después de guardar:

```powershell
npm.cmd run junta:estado
```

El comando no usa red ni muestra valores, fragmentos o hashes de las claves. Distingue ausencia/presencia de credencial y configuración de modelo; no afirma que la clave sea válida ni que la cuenta tenga acceso. `junta:preparar` crea `.env` solo si falta y nunca pisa uno existente. Los comandos leen el archivo actualizado sin reiniciar la app. Una clave cargada como variable del proceso sí depende del entorno con que se inició el servidor.

## Dónde se ve y se prueba

En http://127.0.0.1:4313, abrir **Trabajo jurídico → Junta Jurídica**. No hace falta crear un estudio para acceder al panel. **Revisar configuración** muestra presencia de claves y los campos faltantes. No permite introducir claves en el navegador.

**Ejecutar demo offline** ejecuta el motor real de orquestación con sus proveedores simulados y un expediente fijo sintético; permite ver y descargar el resultado. No usa claves ni consultas de tus asuntos. El proceso tiene una guardia que bloquea red, no hereda claves y no admite parámetros arbitrarios. Cada demo se conserva en `.board-data/browser-junta/`. Las etiquetas SIMULATED no acreditan fuentes oficiales.

Para arrancar desde cero con las dependencias ya instaladas:

```powershell
npm.cmd run junta:preparar
npm.cmd run build
npm.cmd run os:build:web
npm.cmd run os:local
```

Sin Docker, PostgreSQL ni login. `build` compila el motor para el botón de demo. También sigue disponible la CLI offline del Runbook.

## Datos de la consulta

La ficha `consulta.example.json` deja preparados pregunta jurídica, jurisdicción, fecha de corte, hechos documentados, alegaciones y documentos. Completar una copia con datos sintéticos cuando quieras preparar un escenario. La ficha es de recepción, **no es un bundle listo para ejecutar**: después hay que convertirla en evidencia con IDs/versiones, originales, extracción y hashes válidos.

## Lo que aún requiere trabajo técnico

Cargar tres claves no completa la Junta real. Siguen pendientes comprobaciones auténticas de acceso y capacidades de cuenta; tarifas vigentes con fuente/fecha; evidencia compatible con el importador, versiones y hashes congelados; y verificación de procedencia por un host autorizado. No se debe completar una atestación ni marcar un modelo VERIFIED_REAL a mano para forzar el gate. El corpus PDF tiene bloqueos de importación/extracción ya documentados en LIVE_SMOKE_PLAN.md.

El panel y el puente **no tienen ruta de inferencia real**. La autorización anterior prohíbe llamadas pagas; cargar configuración no modifica esa restricción. El plan anterior de un smoke conserva su techo de USD 0.60 y no está autorizado. Los modelos ya indicados son los exigidos por los adaptadores del repositorio, sin prometer disponibilidad de cuenta ni sustituirlos automáticamente.
