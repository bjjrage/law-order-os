# RAG local ampliado — 14 de octubre de 2026

> Este informe conserva la primera ampliación como antecedente. El estado posterior está en [FULL_LIBRARY_OCR_REPORT.md](FULL_LIBRARY_OCR_REPORT.md): carga integral automática en curso, más de 135.000 referencias relevadas, lectura de escaneos local y recuperación efectiva del Decreto 4777/2025. Ya no es necesario correr el .bat de actualización. Las cifras y exclusiones de escaneos que siguen debajo corresponden a la intervención anterior.

El corpus consultable pasó de siete publicaciones a **743 documentos con texto**, divididos en 205 decretos, 207 textos de leyes, cuatro códigos, una Constitución y 326 publicaciones jurisprudenciales (324 resoluciones individuales y dos Gacetas). Son registros documentales/ediciones, no un recuento certificado de normas distintas y vigentes.

El índice contiene **21.208 fragmentos**, extraídos de 4.901 páginas PDF y 207 publicaciones HTML. El catálogo conserva 5.940 referencias; los títulos sin texto siguen diferenciados. No se afirma que toda la Biblioteca esté indexada.

## Conexión efectiva

La pregunta, el área y los documentos del asunto consultan el índice persistente SQLite FTS5/BM25. Se recupera un conjunto acotado de fragmentos, con versión y página o artículo, que se congela en la preparación y se entrega al abogado principal y al auditor adversarial. Es recuperación local por texto, sin embeddings pagos ni inferencia para buscar. La búsqueda no envía el caso a los sitios oficiales.

El Core incorpora la bibliografía en su hash de entrada y la persiste de forma inmutable. Los hechos del expediente permanecen separados de las fuentes de derecho. La interfaz y el informe distinguen fuentes encontradas, entregadas al análisis y citadas mediante identificadores y versiones coincidentes. Las citas se cotejan literalmente con los fragmentos, sin presentar ese cotejo como certificación de identidad, vigencia o aplicabilidad.

La Biblioteca también permite buscar dentro de los textos, además de filtrar los títulos. Los decretos tienen categoría propia. Los textos HTML se localizan por artículo/sección; no se les inventan páginas de PDF.

## Fuentes y ampliación

- Leyes: transcripciones de la Biblioteca y Archivo Central del Congreso Nacional (BACN), con original HTML conservado.
- Decretos: archivos de Presidencia y del Ministerio de Economía y Finanzas (MEF).
- Jurisprudencia individual: PDFs publicados en el Digesto Legislativo. Se mantienen además los compendios institucionales anteriores.
- Fuentes base: las siete publicaciones oficiales previas permanecen disponibles.

Los originales, extracciones y registros de ingesta se conservan en `local-browser/library/research/`. La ingesta valida destinos oficiales y redirecciones, limita bytes/páginas y descarga de forma serial. El lote predeterminado tiene un límite aproximado de 500 MB de nuevas descargas. Los documentos guardados se reutilizan; los pendientes continúan en otro lote. Los listados oficiales tienen caché de 24 horas.

Se dejó **Actualizar BIBLIOTECA.bat**, que ejecuta `npm.cmd run library:corpus:sync` sin proveedores de IA y sin modificar otros procesos. El comando anterior `library:research:sync` usa ahora el mismo flujo reanudable y no reduce la cobertura a siete publicaciones. El sincronizador de referencias preserva los registros incorporados por la ingesta de textos.

Para una ingesta integral explícita existe `node scripts/library-corpus-ingest.mjs --all`: recorre los listados paginados y la cola sin el límite del lote normal. Puede ser extensa; **no se ejecutó en esta intervención**. Los errores de fuentes no se reintentan indefinidamente; `--retry-failed` permite reintentarlos explícitamente.

## Límites observados

Al cierre: 15 documentos marcados como imagen sin texto, cuatro fallos de recuperación/extracción, 200 registros SILpy reconocidos como metadatos sin un lector de texto completo compatible y 85 entradas pendientes de lotes anteriores. Estas cifras son estados de las entradas intentadas, no el total de faltantes del catálogo.

Los registros de Presidencia sin archivo adjunto se conservan como referencias. Cuando el número del título de un decreto y el del archivo difieren, se excluye ese texto hasta cotejo. No se inventa el contenido de un escaneo ni se incluye la navegación de un portal como texto normativo.

El Decreto 4777/2025 aparece como referencia, pero su archivo recuperado carece de texto digital suficiente y quedó fuera del análisis. El Decreto 4770/2025 sí tiene texto consultable. Una búsqueda por número específico no sustituye silenciosamente una norma ausente por otras normas.

La cobertura inicial ampliada sigue siendo parcial: especialmente los fallos individuales están concentrados en el conjunto 2017 disponible en el índice de Digesto incorporado. No se certifican reformas, derogaciones, consolidación normativa ni cobertura de todas las salas y años. Se mantiene el registro de verificadores externos; no se emitieron atestaciones propias ni se debilitó el control de citas. Un informe puede conservarse con fuentes y, a la vez, requerir cotejo humano.

## Verificación

- 271 pruebas Core y 27 pruebas locales aprobadas; compilación y tipos satisfactorios.
- Pruebas del índice persistente real: búsqueda, vigencia temporal de publicación, reemplazo de versiones y conservación de historial, localizadores, escaneos y fallo explícito ante índice corrupto.
- Pruebas de ingesta: cuerpo de leyes separado de navegación, entidades HTML, decretos sin adjunto, discordancias de metadatos, redirecciones inseguras y tamaños máximos.
- Integración con los cuatro adaptadores por HTTP exclusivamente simulado: los fragmentos del índice llegan al abogado y auditor; las citas sin respaldo suficiente siguen pendientes de revisión. Se conserva autorización, presupuesto y protección contra repetición de llamadas.
- Navegador con backend real: documento sintético, preparación y vista de fuentes; captura `reports/library-real-retrieval-preview.png`.
- Servidor local actualizado: búsquedas reales del Decreto 4770, Ley 213 y jurisprudencia individual; preparación de consulta sintética con el corpus ampliado. Evidencia: `reports/rag-real-retrieval-checks.json` y script reproducible `reports/verify-expanded-rag.mjs`.

No se ejecutó una nueva deliberación paga ni se realizaron despliegues. Los resultados históricos no se reescriben con fuentes incorporadas después de su ejecución.
