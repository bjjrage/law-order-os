# Evaluación bibliográfica Fase 2 — primera medición conservada

Fecha: 2026-10-13, America/Asuncion. Estado general: **BLOCKED para validación real de autenticidad y citas literales**. Se ejecutó evaluación local sobre metadatos y extracción de tres PDFs oficiales recuperados; no se inventó un firmante ni se activó simulation=true para obtener VERIFIED.

El conjunto contiene 12 casos nuevos respecto de V1/V2. Usa las identidades 1184/2013, 1010/2015 y 162/2023, originales archivados por el frente de corpus, y perturbaciones adversariales explícitas. Es nuevo frente a los ejemplos anteriores, pero lo diseñó el agente implementador: no es curaduría jurídica externa ni una muestra representativa. Ahora es una regresión conocida. Los holdouts anteriores no se modificaron.

## Congelación antes de evaluar

`phase2/benchmark/freeze.json` se escribió a las 2026-10-13T10:07:15.474Z antes de existir la primera evaluación. Conserva hashes del dataset, manifiesto de entrada, runner y módulos compilados usados. Los hashes del corpus se comprueban nuevamente antes de ejecutar el checker.

| Artefacto | SHA-256 |
|---|---|
| phase2/benchmark/cases-v1.json | `10189975fbb17f55f2a593dce0951b74da52a13a56f752097622cda165a98634` |
| phase2/benchmark/corpus-input-manifest.json | `be467f0ac848649c246ea9bc2e903dc069ee64e3583da49060ebd629ce5cd081` |
| phase2/reports/bibliographic-first-evaluation.json | `5a34e1e49a3aa833c157d7412ec5349efb83cbe6003faa3e192fd72b297df682` |

Primera ejecución: `node phase2/benchmark/run.mjs`, exit 0. Exit 0 significa que se completó la medición y guardó el informe, **no** que el benchmark de autenticidad haya aprobado. No se ajustaron parser, dataset ni criterios tras observar esta primera medición.

## Resultados separados

| Métrica solicitada | Primera medición | Interpretación |
|---|---:|---|
| citation_detection_recall | 12/12 = 1.0 | Se detectaron marcadores en los 12 textos anotados. No equivale a extraer o autenticar cada referencia. |
| citation_resolution_accuracy | null / BLOCKED | Falta atestación confiable y revisión de extracción; no se calcula precisión de autenticación sobre documentos que el checker no puede autenticar. |
| false_verified_count | 0 | Gate de confianza cerrado: ninguna referencia, auténtica o alterada, recibió VERIFIED. No demuestra por sí solo precisión real. |
| authentic_citations_unresolved | 6 | Seis casos de identidad bibliográfica original, incluidas variaciones y controles de disponibilidad, siguen sin VERIFIED. |
| ambiguous_citations | null / BLOCKED | Falta un segundo candidato auténtico que permita probar ambigüedad real. |
| unknown_citation_markers | 1 | Es un marcador pendiente: encabezado con número escrito en palabras, familia conocida pero extracción numérica incompleta. |
| source_provenance_failures | 3 | Tres comprobaciones llegaron al rechazo por ausencia de atestación. Otros dos SOURCE_UNAVAILABLE obedecen a extracción vacía o disponibilidad inyectada. |
| quote_mismatch_detection | null / BLOCKED | La cita falsa llega al checker, pero la falta de procedencia impide alcanzar la comparación literal. No se afirma que fue cotejada. |

Observaciones adicionales: 11 referencias extraídas; SOURCE_UNAVAILABLE=5, NOT_FOUND_IN_SCOPE=2, METADATA_MISMATCH=3, INSUFFICIENT_IDENTITY=1. Cero VERIFIED y cero SIMULATED_VERIFIED. Las 12 expectativas de comportamiento local coincidieron con lo observado; ese resultado incluye estados BLOCKED y el defecto de extracción conocido, y no constituye un 12/12 de resolución jurídica real.

## Cobertura por caso

| Caso | Categoría | Observación | Estado de la validación pretendida |
|---|---|---|---|
| P2-01 | Identidad auténtica correcta, civil | SOURCE_UNAVAILABLE por falta de atestación | BLOCKED autenticación |
| P2-02 | Número fabricado | NOT_FOUND_IN_SCOPE | PASS del control negativo local; no prueba inexistencia universal |
| P2-03 | Número real, tribunal incorrecto | METADATA_MISMATCH | PASS del cotejo local |
| P2-04 | Fecha incorrecta | METADATA_MISMATCH | PASS del cotejo local |
| P2-05 | Sala incorrecta | METADATA_MISMATCH | PASS del cotejo local |
| P2-06 | Resolución civil real, literal inventado | SOURCE_UNAVAILABLE; literal preservado | BLOCKED cotejo de cita literal |
| P2-07 | Referencia penal abreviada | Extraída; SOURCE_UNAVAILABLE | BLOCKED identidad contextual/atestación |
| P2-08 | Referencia incompleta/ambigua | INSUFFICIENT_IDENTITY | BLOCKED ambigüedad real: falta segundo candidato auténtico |
| P2-09 | Constitucional con extracción defectuosa | SOURCE_UNAVAILABLE; PDF real sin texto extraído | BLOCKED OCR/transcripción revisada |
| P2-10 | Fuente no disponible | SOURCE_UNAVAILABLE mediante fault injection en memoria | PASS del contrato; una indisponibilidad real del portal NO fue observada |
| P2-11 | Referencia únicamente en texto libre | Marcador detectado; ninguna cita numérica extraída | FAIL de extracción completa, fail-closed PASS |
| P2-12 | Documento privado que menciona jurisprudencia ficticia | NOT_FOUND_IN_SCOPE | PASS del control negativo: la alegación privada no se convierte en fuente oficial |

P2-11 conserva exactamente el encabezado de la página 1 civil: `ACUERDO Y SENTENCIA NÚMERO Mil ciento ochenta y cuatro`. Su número en palabras no está cubierto por la gramática numérica. El parser deja el marcador pendiente y cierra el gate; no se sustituyó silenciosamente por 1184 ni se corrigió código después de medir. El JSON conserva los offsets del recorte y comprueba su correspondencia con la extracción archivada.

P2-02 no es una sentencia real que se declare inexistente universalmente: el número fue fabricado expresamente para probar ausencia en este corpus. P2-08 no agrega una segunda resolución ficticia como si fuese auténtica. P2-10 mantiene intactos los originales realmente descargados y solo cambia UNAVAILABLE en memoria. P2-12 está rotulado como alegación privada sintética, nunca original oficial.

## Reproducción y bloqueos

Los documentos derivados usan SHA-256 de los bytes PDF y mantienen extracción separada. Los offsets de text_spans se refieren al texto derivado, no a posiciones de bytes dentro del PDF. Este runner no implementa un importador PDF productivo ni concede permisos de indexación. El manifiesto congelado mantiene production_indexing_permitted=false y trust_registry=EMPTY.

Para repetir sin sobrescribir la primera medición, desde la raíz del proyecto y con los módulos dist correspondientes a los hashes congelados:

```powershell
node phase2/benchmark/run.mjs --output=phase2/reports/bibliographic-replay-01.json
```

El runner rechaza cambios en dataset, manifiesto de entrada, originales, extracciones, su propio código o módulos de checker congelados. Publica con flag wx, por lo que una salida existente no se reemplaza. El script `prepare.mjs` documenta cómo se creó el conjunto y también usa wx; no debe volver a usarse para sobrescribir la evaluación congelada.

Se ejecutó la repetición indicada con exit 0. Las métricas y observaciones suplementarias fueron idénticas; el hash de la primera evaluación y el dataset permanecieron iguales. Evidencia separada: `phase2/reports/bibliographic-replay-01.json` y `phase2/reports/bibliographic-reproducibility.json`. Las fechas de ejecución difieren; no se cambió la primera medición.

Para desbloquear la validación real: aprobar política y emisor de atestaciones del host, revisar extracción civil/penal y la identidad penal contextual, producir OCR/transcripción constitucional revisada y obtener un segundo candidato auténtico para ambigüedad. Después debe crearse una nueva evaluación con identidad y criterios congelados, preservando esta medición. No basta con firmar localmente los documentos para conseguir un porcentaje.

Sin llamadas de red desde el benchmark, sin inferencias ni costo pagado, sin despliegues. La lectura pública y revisión de los originales está documentada separadamente en OFFICIAL_CORPUS_MANIFEST.json; no se presenta una observación de descarga como autorización empresarial definitiva ni firma judicial.
