# Consulta general con IA real — 2026-10-16

El propietario autorizó habilitar la ejecución real mediante «y habilitalas!», después de explicar el consumo de API. Se conserva el presupuesto existente de USD 0,60 por consulta, la confirmación mediante Consultar Junta y el uso de datos sintéticos. No hay inferencia automática, recurrente ni despliegues.

## Uso

Asuntos → asunto → Equipo jurídico → Consulta general. Las nuevas consultas usan IA real por defecto. Si quedó guardada una simulación, **Nueva consulta con IA** prepara un encargo nuevo sin convertir ni volver a ejecutar la simulación anterior.

1. Pregunta concreta, sin archivos obligatorios, y confirmación de datos sintéticos.
2. Preparar consulta guarda el contexto y busca Biblioteca local; no llama a modelos.
3. Consultar Junta confirma el límite de USD 0,60 y ejecuta el análisis real.
4. El informe se conserva, incluidas respuestas parciales. Actualizar resultado es una lectura sin gasto; nunca vuelve a ejecutar la consulta.

El progreso distingue cuatro etapas sin documentos: contexto, análisis, auditoría y verificación de referencias. La falta de una auditoría o de cotejo de fuentes se presenta como pendiente. Un informe recibido no equivale a aprobación jurídica ni a ausencia de alucinaciones.

## Acceso y precios

Los cuatro modelos configurados respondieron a la comprobación autenticada de metadatos: Jev 1.13.0, GPT-6 Luna, GPT-6.1 Sol y Gemini 3.8 Flash. Las claves permanecen en el servidor y no se incorporan a la aplicación web.

Tarifas estándar revisadas el 2026-10-16 por millón de tokens de entrada/salida: Jev USD 0,042/0; Luna USD 0,10/0,50; Sol USD 2/10; Gemini USD 0,75/3,75. Fuentes oficiales: [TypeSafe](https://docs.typesafe.ai/models), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Gemini](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash).

## Correcciones de integración encontradas con modelos reales

- Una hipótesis expresamente no acreditada, sin documentos, se conserva como cuestión pendiente y se retira de las listas factuales. Los hechos documentales inventados y las referencias falsas continúan rechazándose.
- El host vincula el informe general con la pregunta original completa. Si el modelo la resume en el campo de seguimiento, su reformulación se conserva como límite y se entrega al auditor para comprobar el alcance. Una respuesta con un identificador de consulta ajeno sigue rechazada.
- Las continuaciones autorizadas y acotadas pueden reutilizar las salidas inmutables y sus hashes. No repiten las etapas ya cobradas; mantienen sus errores originales y añaden registros de reparación local de costo cero.

## Evidencia

`local-browser/reports/junta-live/activation-results.json` registra los resultados, etapas, costos estimados/reservados y pendientes de las consultas sintéticas. No incluye claves. La primera consulta llegó a Luna y Sol y conservó su informe; Gemini devolvió HTTP 503, por lo que su auditoría quedó pendiente. Los importes desconocidos permanecen desconocidos y se conserva una reserva prudente de presupuesto.

Las pruebas con transporte falso cubren la vía exacta de consulta real, el bloqueo sin confirmación, la ausencia de repetición al recuperar un resultado, las correcciones de contexto y metadatos y el rechazo de hechos inventados o respuestas ajenas. La verificación real usa exclusivamente el estudio sintético de Chrome; no envía los contratos reales del usuario.

La comprobación final desde el navegador, con las instrucciones de contexto corregidas, completó automáticamente las cuatro etapas y terminó en `HUMAN_REVIEW_PENDING`: Luna, Sol, Gemini y checker. Costo estimado de esa consulta: USD 0,0318707; el importe facturado no está disponible en las respuestas de los proveedores. No contenía citas concretas para autenticar: el control detectó cero referencias y eso no acredita ausencia de errores jurídicos. El error HTTP 503 de la primera prueba se conserva como antecedente, no se oculta ni se factura como cero.

Validación: 222 pruebas de motor y cinco pruebas del puente/configuración (que incluyen múltiples casos positivos y negativos), compilación del motor, typecheck del OS y build web. El servidor y los trabajos de Biblioteca no se reiniciaron.
