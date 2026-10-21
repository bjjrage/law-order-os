# Ejecución exploratoria del piloto jurídico

Ejecución solicitada el 19/10/2026 después de la preparación documental. El paquete original se conserva íntegro en `../evaluacion-multiagente-piloto/`. Este directorio contiene únicamente el ejecutor y los artefactos del ensayo, sin modificar ni iniciar la arquitectura, base de datos o flujos del OS.

Se utiliza el modelo configurado `gpt-6-luna` para A, B, C y la revisión automática, con esfuerzo `low`. El presupuesto máximo conjunto es USD 10,80: USD 0,50 por generación completa y USD 0,10 por revisión automática, para hasta dieciocho documentos. El control reserva costo antes de cada petición y conserva el máximo ante un resultado de transporte desconocido. Las estimaciones de precio y los tokens observados no son una factura.

El usuario autorizó correr el test. Se ejecuta como **piloto exploratorio**, porque todavía no hubo revisión jurídica externa de los casos y las referencias. Se guardan explícitamente esas desviaciones en `FREEZE.json` antes de generar. Las revisiones de modelo no se presentan como revisión humana, tiempos de corrección de abogados ni demostración de superioridad.

## Artefactos

- `SELF_CHECK.json`: comprobaciones sin inferencias del aislamiento por herramientas, localizadores, documentos y límites de reserva.
- `FREEZE.json`: condiciones efectivas, hash del ejecutor y referencia al manifiesto original, creados antes de la primera inferencia.
- `input-snapshot/`: copia exclusiva de las entradas públicas; ninguna referencia reservada llega a los investigadores.
- `runs/`: peticiones sin credenciales, respuestas, herramientas, notas, comunicaciones y memo por ejecución.
- `revision-ciega/`: dieciocho documentos con códigos aleatorios cuando la generación termine.
- `telemetry.jsonl`: eventos y consumo por llamada, con ID de respuesta del proveedor.
- `GENERATION_RESULTS.json`: resultados de todas las generaciones, incluidas las fallidas.
- `evaluacion-automatica/` y `AUTOMATED_REVIEWS.json`: revisión provisional ciega por modelo, después de cerrar todas las generaciones.
- `RESULTADOS.json`: cierre completo, si el proceso llega a término.
- `INFORME.md`: interpretación de resultados al terminar.

Los directorios de operación revelan la modalidad. Para revisión jurídica humana, entregar solo un memo ciego y el expediente público correspondiente; no entregar este directorio completo. La referencia propuesta para la evaluación automática se limita a la tabla de hallazgos y controles negativos, omitiendo la clasificación de dependencias y cualquier indicación sobre qué arquitectura podría resultar favorecida.

## Reproducción

Desde la raíz del proyecto:

```powershell
node docs/evaluacion-multiagente-ejecucion-2026-10-19/runner.mjs --self-check
node docs/evaluacion-multiagente-ejecucion-2026-10-19/runner.mjs --execute-authorized-pilot
```

El segundo comando realiza llamadas pagas. Los archivos de ejecución se crean sin sobrescritura; para otra evaluación se requiere un directorio nuevo y una congelación propia. No ejecutar otra vez para sustituir silenciosamente resultados anteriores. No hay reintentos automáticos de peticiones cuyo resultado se desconoce.

## Fuentes técnicas

Se comprobó acceso al modelo mediante metadatos de la cuenta y se consultó [OpenAI Docs para GPT 6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) y el [control de gasto por ejecución](https://developers.openai.com/cookbook/articles/per_run_spending_controller_responses_api). Las credenciales se leen mediante la configuración existente y nunca se guardan en las peticiones archivadas.
