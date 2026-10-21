# Alcance del checker y evidencia actual

Fecha: 16 de octubre de 2026. Revisión de código fuente y pruebas offline. Este informe describe controles existentes; no habilita el workspace propuesto ni certifica un corpus productivo.

El checker principal es bibliográfico y determinístico. Comprueba referencias contra documentos registrados y coincidencia literal de citas. No contiene un modelo de contraste semántico ni evalúa si una conclusión se desprende de una fuente.

## Checker principal de la Junta existente

Entrada: Citation, documentos elegibles y corpusSnapshotId. checkAnalysis recibe PrincipalAnalysis y jurisdicción. Salida: checks por referencia, reporte de extracción y gate PASS_IN_SCOPE o REVIEW_REQUIRED.

| Control implementado | Mecanismo y límite |
|---|---|
| Forma de la referencia | CitationSchema valida campos; no demuestra existencia |
| Identidad suficiente | Exige official_id y court, o number/court/date/resolution_type. Referencias que no encajan quedan insuficientes; esta forma no resuelve universalmente normativa/artículos |
| Descubrimiento de candidatos | ExactCitationResolver filtra tipo de fuente/jurisdicción y busca source_id, official_id o número; no consulta Internet |
| Identidad y versión | Compara metadatos no nulos, aliases de resolución y versión solicitada. Cero coincidencias o varias coincidencias quedan pendientes |
| Disponibilidad | Requiere original disponible y estado de ingesta READY |
| Procedencia | OfficialEvidenceRegistry exige atestación de verificador configurado, firma Ed25519, host HTTPS permitido, fechas válidas y vínculo con fingerprint/hash/URL del documento |
| Simulación | Solo fixtures explícitos permiten SIMULATION; su etiqueta es SIMULATED_VERIFIED, no VERIFIED real |
| Localizador | Comprueba existencia del passage_id indicado; no demuestra pertinencia del fragmento |
| Cita textual | Busca substring literal normalizando espacios y conserva offsets/texto original. No acepta por equivalencia paráfrasis, cambios de acento o puntuación |
| Calidad de extracción | Si no es GOOD, devuelve EXTRACTION_UNCERTAIN para el cotejo textual |
| Extracción de referencias en prosa | Gramática de familias y marcadores. Los marcadores no resueltos quedan pendientes; no hay detección universal de toda afirmación jurídica |
| Etiqueta asociada al control | citationLabel vincula hash de referencia, snapshot, gate y procedencia. Una referencia modificada no hereda el resultado anterior |

La expiración de una atestación no comprueba vigencia sustantiva de la norma o precedente. Una firma válida tampoco demuestra corrección jurídica. Los tests de normativa usan metadata sintética; no acreditan resolución completa de las identidades reales de leyes y artículos.

checkAnalysis recorre legal_analysis, alternative_interpretations, unresolved_issues, limitations, factual_basis.statement y supporting_references.raw_text, y combina lo extraído con las referencias estructuradas. En el orquestador actual se aplica a run.analysis. No incluye automáticamente el texto del auditor, todos los mensajes o el documento/export compuesto. Ampliar ese manifiesto es una tarea propuesta del workspace.

PASS_IN_SCOPE significa que las referencias y marcadores inspeccionados no dejaron objeciones en ese alcance. Puede existir si no se detectó ninguna referencia. No significa respaldo semántico, completitud, vigencia jurídica ni aprobación humana.

## Validadores relacionados que no son contraste semántico

validateProvenance comprueba referencias de hechos a document/source/version/passage existentes y evita etiquetar como DOCUMENT_CONTENT un pasaje cuya naturaleza no lo es. No compara el significado de factual_basis.statement con el contenido del pasaje. La mera presencia de una referencia válida no autentica la afirmación.

LocalEvidenceIndex valida ámbito, snapshots y versiones autorizadas. Conservar una versión histórica accesible no la convierte en la versión actual ni en una revisión vigente del documento editado.

El piloto local usa auditTeamOutputs/verifyTeamRun y auditPilotOutputs/verifyPilotRun. Conserva hashes/manifiesto, verifica localizadores exactos y detecta referencias mediante gramática. auditTeamOutputs devuelve REVIEW_REQUIRED si encuentra menciones y NO_REFERENCES si no las encuentra; declara ALL_OUTPUTS_GRAMMAR_LIMITED_NO_OFFICIAL_RETRIEVAL. No autentica fuentes oficiales ni evalúa respaldo semántico. Sus reglas de detección de condiciones o contradicciones documentales tampoco son auditoría jurídica integral.

No se identificó un control semántico existente que Jev de salida duplique. Esa ausencia no demuestra que Jev lo pueda suplir con calidad suficiente: debe evaluarse por separado.

## Pruebas reproducidas en esta revisión

Resultado: **83 pruebas offline aprobadas en cuatro archivos**, con fetch bloqueado por el setup de tests. Sin llamadas de inferencia ni cambios del motor.

| Archivo | Pruebas | Alcance cubierto |
|---|---:|---|
| adversarial/checker.test.ts | 21 | Identidades falsas o ambiguas, metadata/versión/localizador incorrectos, citas inventadas, calidad de extracción, offsets y etiquetas sintéticas |
| adversarial/extraction.test.ts | 30 | Familias, abreviaturas, fechas, marcadores no resueltos, offsets, campos de prosa y bloqueo de referencias no admitidas |
| adversarial/provenance.test.ts | 24 | Firmas, claves no configuradas, cambios de texto/metadata, hashes, ámbitos, expiración y recuperación sin repetir etapas |
| unit/versions.test.ts | 8 | Publicación explícita, snapshots históricos y versiones/ámbitos incompatibles |

Reporte: [checker-tests.json](../../local-browser/reports/workflow-adjustments-2026-10-16/checker-tests.json). El reporte acredita esos tests y sus fixtures, no eficacia del contraste de Jev, competencia jurídica ni validación productiva de fuentes. Los validadores del piloto local se inspeccionaron en código; su suite no se volvió a ejecutar en esta revisión.

```text
node node_modules/vitest/vitest.mjs run junta-juridica/tests/adversarial/checker.test.ts junta-juridica/tests/adversarial/extraction.test.ts junta-juridica/tests/adversarial/provenance.test.ts junta-juridica/tests/unit/versions.test.ts
```

## Estados a mostrar en el workspace propuesto

| Eje | Qué debe informar |
|---|---|
| Ejecución | Completa, parcial, fallida o cancelada; pasos no ejecutados |
| Referencias | Identidad, procedencia, literalidad, alcance y objeciones de cada referencia |
| Respaldo semántico | No evaluado, completo, parcial, incompatible o no concluyente, solo con mecanismo realmente ejecutado y evaluado |
| Auditoría de fondo | Hallazgos, alcance y pendientes; sin heredar un PASS bibliográfico |
| Dependencias | Snapshot examinado y estado actual/histórico/pendiente |
| Revisión humana | Pendiente, cambios solicitados o aprobación explícita de versión exacta |

Si no se ejecuta contraste semántico, se mostrará NO EVALUADO. Si una referencia coincide literalmente pero la interpretación no se revisó, ambos estados permanecerán separados. Los labels internos existentes no se cambiarán en esta revisión documental.

## Fuentes de código

[Checker](../../junta-juridica/src/citation-checker/index.ts), [gramática](../../junta-juridica/src/citation-checker/extraction-core.ts), [resolver/índice](../../junta-juridica/src/retrieval/index.ts), [registro de procedencia](../../junta-juridica/src/ingestion/provenance.ts), [guardas](../../junta-juridica/src/domain/guards.ts), [orquestador](../../junta-juridica/src/orchestration/index.ts), [piloto de equipo](../../apps/web/src/specialist-engine.ts) y [piloto contractual](../../apps/web/src/contractual-pilot.ts).
