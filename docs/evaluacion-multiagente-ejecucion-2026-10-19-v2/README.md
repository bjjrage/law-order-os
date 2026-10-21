# Piloto ejecutado con límite de contexto recalibrado

La comparación completa A/B/C se repite desde cero en este directorio. El primer pase se conserva en [registro de calibración](../evaluacion-multiagente-ejecucion-2026-10-19/INTERRUPCION.json): B agotó un límite acumulado de 800.000 tokens de entrada mientras seguía dentro de su presupuesto monetario. No se eligieron respuestas favorables ni se mezclan resultados entre versiones.

V2 permite hasta 3.000.000 tokens de entrada acumulados por workflow para las tres modalidades. Mantiene el mismo modelo `gpt-6-luna`, razonamiento low, fuentes, expedientes, instrucciones breves, presupuesto de salida y herramientas. A/B/C tienen el mismo techo de USD 0,45 por generación completa. La evaluación automática cuenta con hasta USD 0,08 por documento. El techo de V2 es USD 9,54; la suma de ese techo y lo imputado al primer pase sigue por debajo del máximo de sesión de USD 10,80.

Las limitaciones de interpretación siguen vigentes: casos y referencias sintéticos conocidos, sin curaduría jurídica externa; evaluación automática por el mismo modelo; tiempos de corrección humana no medidos. Es un ensayo exploratorio de organización de investigación, no un benchmark acreditado de competencia jurídica ni una prueba del workspace productivo.

## Archivos

- `SELF_CHECK.json`: comprobaciones sin inferencias.
- `RECALIBRACION.json`: costo conservador y causa de interrupción del primer pase, incluida una petición con resultado desconocido.
- `FREEZE.json`: configuración y hashes anteriores a las inferencias de V2.
- `input-snapshot/`: solo los materiales públicos del paquete original.
- `runs/`: peticiones sin credenciales, respuestas del proveedor, herramientas, notas, comunicaciones y memos por ejecución.
- `revision-ciega/`: memos con códigos aleatorios para revisión.
- `telemetry.jsonl`: consumo y tiempos observados por llamada.
- `RESULTADOS.json`: generaciones y revisiones automáticas al terminar.
- `evaluacion-completa-v2/` y `REVISION_COMPLETA_V2.json`: segundo pase uniforme de revisión, con los metadatos completos y las dieciocho revisiones terminadas. El primer pase queda preservado.
- `COMPARACION_AUTOMATICA.json` y `.csv`: comparación descriptiva provisional.
- [Informe final](INFORME.md): resultados, límites y auditoría de la aparente ventaja.
- `AUDITORIA_EVALUADOR_PRIMER_PASE.json` y `AUDITORIA_EVALUADOR_SEGUNDO_PASE.json`: problemas de contexto del primer evaluador, coincidencias de citas y criterio aplicado de forma desigual.
- `GENERATION_VERIFICATION.json`: dieciocho memos, 376 peticiones y respuestas reales, igualdad de material inicial, límites de gasto e integridad.
- `ARTIFACTOS.json`: inventario final con hashes.

La clave de cegamiento y los resultados comparativos se mantienen fuera de la primera lectura de abogados. No se modificó el paquete original ni la arquitectura del OS.

## Comandos

```powershell
node docs/evaluacion-multiagente-ejecucion-2026-10-19-v2/runner.mjs --self-check
node docs/evaluacion-multiagente-ejecucion-2026-10-19-v2/runner.mjs --execute-authorized-pilot
node docs/evaluacion-multiagente-ejecucion-2026-10-19-v2/review-complete.mjs --execute-authorized-review-pass
node docs/evaluacion-multiagente-ejecucion-2026-10-19-v2/summarize.mjs
node docs/evaluacion-multiagente-ejecucion-2026-10-19-v2/audit-results.mjs
```

El segundo y tercer comando realizan llamadas pagas y no sobrescriben ejecuciones. Los dos últimos analizan artefactos guardados sin nuevas inferencias. Repetir la prueba requiere un directorio y congelación nuevos. Las credenciales se toman de la configuración existente y no se incluyen en los archivos de petición.

## Estado de cierre

Se completaron las 18 generaciones y las 18 revisiones del segundo pase. El primer pase de evaluación tuvo 14 respuestas y cuatro resultados de transporte desconocidos. Se imputó conservadoramente el costo de estos últimos y se revisaron todos los memos otra vez, con la misma evidencia completa para cada modalidad. El costo imputado conjunto, incluida la calibración, es USD 2,373870; no es una factura.

La cobertura suficiente según el evaluador fue A 38/42, B 41/42 y C 42/42. No registró omisiones completas de hallazgos de referencia, sino tratamientos parciales. La auditoría encontró que la misma carencia tributaria redujo la cobertura de B, mientras C conservó cobertura completa con una objeción material por esa carencia. Por eso la ventaja de un punto de C no acredita superioridad jurídica. Las medianas de generación fueron A 46,4 s, B 128,5 s y C 67,9 s; C fue más rápido que B, pero A fue más rápido que C.

Las notas originales se conservan sin modificar. La revisión de abogados y el tiempo humano hasta un documento utilizable siguen sin ejecutarse. No se cambia ni activa la arquitectura del OS.
