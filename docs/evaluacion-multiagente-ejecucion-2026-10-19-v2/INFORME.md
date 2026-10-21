# Resultado del piloto ejecutado

Estado: LIVE_GENERATION_COMPLETED. Modelo efectivo: gpt-6-luna, esfuerzo low. Generaciones completadas: 18/18. Revisiones automáticas: 18. Revisión de abogados: **NO EJECUTADA**. Tiempo humano hasta documento utilizable: **NO MEDIDO**.

Esta comparación utiliza el segundo pase uniforme de evaluación de los mismos dieciocho memos. El primero produjo 14/18 revisiones y tuvo problemas de transporte y metadatos de contexto omitidos. Sus peticiones, notas, costos y resultados se conservan; no se mezclan puntuaciones de ambos evaluadores. El segundo incorporó el inventario efectivamente recibido por los investigadores, pidió citas más breves y tuvo un timeout mayor. No se regeneró ningún memo. Ver AUDITORIA_EVALUADOR_PRIMER_PASE.json y evaluacion-completa-v2/FREEZE.json.

El resultado es mixto. C recibió mayor cobertura suficiente según el evaluador (42/42 frente a 41/42 de B y 38/42 de A), pero no hubo hallazgos de referencia completamente omitidos en ninguna modalidad: las diferencias fueron tratamientos parciales. C tuvo dos objeciones materiales propuestas frente a una de B. Además, la auditoría encontró una inconsistencia del evaluador que afecta precisamente la diferencia de un punto entre C y B. No corresponde declarar superioridad jurídica. C fue más rápido y barato que B en esta configuración; A fue más rápido que C con un costo de generación similar.

## Comparación descriptiva

Los hallazgos son los de una referencia sintética provisional: seis en P01, siete en P02 y ocho en P03. Cada modalidad tiene hasta 42 oportunidades de tratamiento contando las dos repeticiones. Se muestran suficientes, parciales, omitidos y disputados por separado; no se asigna crédito fraccionario elegido después de ver resultados. Una observación automática no equivale a un error jurídico adjudicado.

| Modalidad | Memos completos | Hallazgos suficientes / referencia revisada | Parciales | Omitidos | Referencia disputada | Objeciones críticas propuestas | Mediana de generación, segundos | Costo de generación estimado USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 6/6 | 38/42 | 4 | 0 | 0 | 0 | 46.4245 | 0.189 |
| B | 6/6 | 41/42 | 1 | 0 | 0 | 0 | 128.458 | 0.4382 |
| C | 6/6 | 42/42 | 0 | 0 | 0 | 0 | 67.9025 | 0.1921 |

A es generalista autónomo; B es generalista por etapas; C es investigación contractual, tributaria y laboral en paralelo con integración del titular. La comparación principal fijada fue C contra B. Las medianas reflejan solo el workflow de generación y sus herramientas, no tiempo hasta utilización profesional.

## Auditoría de la comparación

La cobertura anterior conserva las notas automáticas sin corregirlas después de observar quién ganó. En P03-B-R2, el evaluador marcó P03-H07 como PARTIAL por no tratar el artículo 13 de la Ley 6380. En P03-C-R2 marcó el mismo hallazgo SUFFICIENT, pero agregó una objeción MATERIAL por omitir esa misma disposición. Los dos memos recibieron el mismo corpus. La ausencia de ese tratamiento específico se observa en ambos textos; no se explica por un cambio de fuentes. El artículo está en F03-L00129–F03-L00131. Este criterio aplicado de forma desigual vuelve frágil la aparente ventaja de un punto de C. Se requiere adjudicación, no cambiar silenciosamente la nota.

El segundo pase contiene 15 citas que no coinciden literalmente con el memo. 7 se recuperan al normalizar únicamente formato Markdown, comillas y espacios; 8 siguen sin coincidencia bajo esa normalización. Eso no demuestra que cada valoración sea falsa, pero impide tratar todas sus citas como evidencia comprobada. Las observaciones del evaluador y su severidad siguen siendo propuestas.

La auditoría es técnica y de coherencia del evaluador, realizada por el asistente. No equivale a revisión de abogados. Los contadores de localizadores reconocen solo los identificadores completos de su gramática; un cero en ese contador no certifica que toda abreviación o cita normativa esté bien aplicada. Ver AUDITORIA_EVALUADOR_SEGUNDO_PASE.json.

## Resultados por ejecución

| Ejecución | Estado | Suficientes / esperados | Parciales | Omitidos | Objeciones críticas / materiales propuestas | Segundos | Llamadas de generación |
|---|---|---:|---:|---:|---:|---:|---:|
| P01-A-R1 | COMPLETED | 6/6 | 0 | 0 | 0 / 1 | 74.086 | 27 |
| P01-B-R1 | COMPLETED | 6/6 | 0 | 0 | 0 / 0 | 150.94 | 29 |
| P01-C-R1 | COMPLETED | 6/6 | 0 | 0 | 0 / 1 | 74.449 | 30 |
| P02-B-R1 | COMPLETED | 7/7 | 0 | 0 | 0 / 0 | 94.56 | 13 |
| P02-C-R1 | COMPLETED | 7/7 | 0 | 0 | 0 / 0 | 57.731 | 23 |
| P02-A-R1 | COMPLETED | 6/7 | 1 | 0 | 0 / 1 | 39.261 | 10 |
| P03-C-R1 | COMPLETED | 8/8 | 0 | 0 | 0 / 0 | 67.73 | 24 |
| P03-A-R1 | COMPLETED | 7/8 | 1 | 0 | 0 / 0 | 56.703 | 21 |
| P03-B-R1 | COMPLETED | 8/8 | 0 | 0 | 0 / 0 | 143.384 | 26 |
| P01-C-R2 | COMPLETED | 6/6 | 0 | 0 | 0 / 0 | 81.982 | 29 |
| P01-B-R2 | COMPLETED | 6/6 | 0 | 0 | 0 / 0 | 136.63 | 28 |
| P01-A-R2 | COMPLETED | 6/6 | 0 | 0 | 0 / 1 | 52.465 | 15 |
| P02-A-R2 | COMPLETED | 6/7 | 1 | 0 | 0 / 0 | 40.384 | 7 |
| P02-C-R2 | COMPLETED | 7/7 | 0 | 0 | 0 / 0 | 68.075 | 25 |
| P02-B-R2 | COMPLETED | 7/7 | 0 | 0 | 0 / 0 | 101.764 | 18 |
| P03-B-R2 | COMPLETED | 7/8 | 1 | 0 | 0 / 1 | 120.286 | 24 |
| P03-A-R2 | COMPLETED | 7/8 | 1 | 0 | 0 / 0 | 36.127 | 9 |
| P03-C-R2 | COMPLETED | 8/8 | 0 | 0 | 0 / 1 | 64.96 | 18 |

## Consumo y trazabilidad

El total conservador imputado a generación y evaluación automática es **USD 2.094295**, con techo de USD 9.54. No es un importe facturado: el proveedor devuelve tokens y la imputación usa precios estándar con reserva conservadora para escrituras de caché. Los descuentos por lectura de caché no se descuentan de la estimación estándar. Los costos desconocidos, si existen, se imputan por su reserva máxima.

El primer pase de calibración conserva una imputación de USD 0.279575, incluida la petición cuyo resultado quedó desconocido al interrumpir. La suma conservadora de ambos pases es **USD 2.373870**, dentro del techo de sesión de USD 10,80. Las salidas del primer pase no se mezclan con esta comparación. V2 amplió el límite acumulado de entrada a tres millones de tokens para todas las modalidades antes de repetir la matriz completa.

Se guardan peticiones sin credenciales, respuestas con ID del proveedor, uso observado, herramientas, comunicaciones, memos originales, copias ciegas y referencias de hashes. El paquete de preparación y la copia de entradas públicas mantienen todos sus hashes originales.

## Límites de interpretación

- Se ejecutó un harness separado con herramientas locales de evidencia equivalentes. No se ensayó el workspace productivo, Jev, la junta profunda ni paquetes permanentes de especialidad.
- El mismo modelo generó y evaluó. Puede compartir sesgos y errores; el cegamiento no lo convierte en un abogado independiente. Las referencias también son de autoría IA y no fueron validadas externamente.
- La falta de metadatos en el primer contexto del evaluador produjo objeciones incorrectas sobre etiquetas reales del inventario. La corrección se aplicó en un segundo pase a todas las modalidades, con las notas anteriores preservadas; no se seleccionó el evaluador según qué arquitectura ganara.
- La revisión automática contiene 15 citas del memo que no coincidieron literalmente. Esas observaciones requieren especial revisión antes de aceptarlas como errores o tratamientos suficientes.
- Tres asuntos sintéticos conocidos no son un holdout. Las repeticiones no aumentan a dieciocho el número de asuntos independientes.
- No hubo revisión humana, adjudicación jurídica, sesiones reales de corrección ni umbrales profesionales de adopción fijados. Por tanto **no se acredita superioridad jurídica ni reducción del trabajo humano**.
- Los techos de turnos y salida por etapa forman parte de esta configuración. A pudo usar el pool total; B y los investigadores de C tuvieron hasta ocho turnos por etapa. La API utilizó el alias configurado y no un snapshot inmutable.
- No se calculan p95, significancia ni equivalencia práctica a partir de esta muestra.

## Siguiente comprobación

Entregar los memos de revision-ciega junto con el expediente público a los abogados usando las plantillas originales. Mantener CLAVE_CIEGA.csv y esta comparación fuera de su primera lectura. Adjudicar hallazgos, corregir memos con tiempos reales y decidir si la señal merece confirmación sobre asuntos nuevos. No se activa ni modifica la arquitectura del OS.
