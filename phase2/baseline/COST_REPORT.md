# Tokens, latencia y costos tras auditoría

Costo pagado por inferencias: USD 0. No se hicieron solicitudes externas ni despliegues.

Smoke de remediación: reports/smoke-offline.json, run:9b23f158562c0cba3e36fee47e5c1158.

| Etapa simulada | Costo artificial USD |
|---|---:|
| Jev | 0.001572 |
| Luna | 0.003226 |
| Sol | 0.003520 |
| Gemini | 0.003232 |
| Checker | 0 |
| Total artificial | 0.011550 |

Entrada 8792 y salida 1379 tokens SIMULATED, estimados por bytes/4. Tarifas artificiales USD 1/M entrada y USD 2/M salida; no son precios reales. Idempotencia y consulta conservaron costo y run sin repetir modelos.

Benchmark: diez ejecuciones sintéticas, 87820 tokens de entrada y 13770 de salida simulados; estimación artificial 0.011536/run y gasto real cero. Las latencias locales están en reports/benchmark-offline.json; no incluyen compilación ni representan APIs o casos grandes.

Cambios de auditor: presupuesto de entrada/salida configurable y reserva previa siguen vigentes; aumentar el límite local no autoriza gasto ni acredita economía. El modelo debe afirmar una ventana suficiente; entradas excesivas guardan cobertura y bloquean sin truncamiento.

Cota operativa previa: bytes serializados + margen, no tokenizer exacto. Uso/costo reales desconocidos quedan null. Resultados inciertos no se reenvían automáticamente; expiración de evidencia se revalida sin replay.

BLOCKED: tarifas/cuentas, counters y factura real. NOT_RUN: evaluación económica con proveedores. Se conservan reportes históricos y primera evaluación bibliográfica; no mezclar simulación con facturación.

