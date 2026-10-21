# Carga integral automática y lectura local de escaneos

14 de octubre de 2026. Estado: **carga en curso**, con dos procesos activos. No se declara terminada la incorporación de todos los textos.

Comprobación final a las **22:56:57 UTC**: **1.317 textos consultables**, **109 documentos con páginas recuperadas mediante OCR**, **30.718 fragmentos** y **135.969 referencias**. Ambos procesos seguían en ejecución; 34 pruebas locales y 271 del Core aprobadas. Las cantidades por tipo de la sección siguiente pertenecen a la captura anterior indicada allí.

## Resultado comprobado

La captura de las 22:47:44 UTC registra **135.906 referencias documentales**, **1.014 documentos con texto consultable** y **26.517 fragmentos buscables**. Son registros/ediciones por repositorio; puede haber varias publicaciones de una misma norma. No equivalen a 135.906 normas distintas, vigentes o ya leídas. Los contadores siguen aumentando y se consultan en Biblioteca jurídica.

El inventario incluye 22.694 referencias de leyes, 38.614 de decretos, 73.107 de jurisprudencia, 670 acordadas, 685 decretos ley, 131 resoluciones, cuatro códigos y una Constitución en esa captura. La clasificación corresponde al registro; por ejemplo, un tratado aprobado mediante ley puede aparecer entre las leyes.

Se recorrieron los listados accesibles de estos repositorios:

| Repositorio | Referencias relevadas | Alcance del relevamiento |
| --- | ---: | --- |
| BACN | 7.123 | 713 páginas del catálogo de leyes |
| Presidencia | 36.357 | 364 páginas del catálogo de decretos |
| MEF | 44 | Listado de decretos hasta agotar páginas |
| Corte, legislación | 14.205 | Años 1869–2026 del buscador oficial |
| Corte, jurisprudencia | 72.180 | Años ofrecidos por el formulario, 1993 y 1995–2026; también se consultó 1994 |
| Corte, acordadas | 670 | Listado de acordadas digitales |

Se conservan además el inventario anterior de SILpy, Digesto, las fuentes base y los adjuntos oficiales adicionales. Las cantidades por repositorio no deben sumarse como normas únicas. Que un listado se haya recorrido no significa que sus PDFs ya estén leídos.

## Operación automática

- `scripts/library-full-load.mjs` descubre referencias e incorpora textos digitales, sin el límite del lote anterior. Alterna tipos de documentos y guarda los pendientes en SQLite.
- `scripts/library-ocr-load.mjs` procesa escaneos y revisa los PDFs anteriores que no tenían auditoría por página. Trabaja separado para que un PDF largo no frene la incorporación digital.
- El servidor del OS inicia ambos trabajos automáticamente con la política local autorizada. Comprueba cada minuto si necesitan retomarse; los fallos repetidos tienen espera creciente hasta 30 minutos. Al volver a iniciar el OS se recuperan los avances guardados.
- Los procesos tienen bloqueos independientes, ventanas ocultas, caché de originales, resultados por página y cursores por repositorio. Las claves de proveedores de IA no se transmiten a estos procesos.
- La carga continúa mientras la computadora esté encendida. No se necesita ejecutar **Actualizar BIBLIOTECA.bat**. Apagar la computadora interrumpe el trabajo; el OS lo retoma cuando vuelve a estar en ejecución.
- Se conserva una reserva de 10 GB en disco, un máximo de 150 MB por descarga y 5.000 páginas por PDF. Superar un límite genera un pendiente/error explícito; no se registra como documento leído.

La política es `.local-dev/library-full-load.json`; el estado está en `local-browser/library/research/full-load-progress.json` y `ocr-load-progress.json`. Los registros de operación son `full-load.log` y `ocr-load.log`. Son datos locales, sin despliegues.

## PDFs escaneados y trazabilidad

Se instaló Tesseract.js 7.0.0 con el modelo español almacenado en la computadora. PDF.js renderiza las páginas con sus decodificadores locales, incluido JBIG2. No se envían documentos a servicios de OCR ni a proveedores de IA.

Se comprueba cada página. Las páginas con texto digital suficiente se reutilizan; los escaneos se reconocen localmente. Las extracciones de baja confianza se excluyen del texto recuperado o se identifican como lectura parcial cuando queda texto digital utilizable. La interfaz y los informes descargados conservan esa reserva y las páginas no recuperadas. No se considera que OCR autentique una norma, una firma o una sentencia.

Prueba real: el **Decreto 4777/2025** del MEF, antes excluido por carecer de texto digital suficiente, tiene sus ocho páginas reconocidas, con confianza informada por el motor entre 90 y 94. Esas cifras no son una certificación de exactitud jurídica. Su búsqueda en el servidor local devuelve el documento, páginas y pasajes, con la indicación de cotejar citas, nombres y cifras con el original.

Los originales se conservan sin modificar. Las extracciones tienen hash propio, versión del original y caché por página. La Junta recibe una selección acotada de pasajes del índice completo; esa selección se congela en la preparación de cada consulta. Se mantienen las fuentes del derecho separadas de los hechos del expediente y los controles del Core. No se emitieron atestaciones de autenticidad propias ni se reescribieron resultados históricos.

## Interfaz para abogados

Biblioteca jurídica muestra el avance de referencias, textos consultables, fragmentos y documentos con páginas recuperadas de escaneos. El catálogo se busca y pagina en el servidor, con 50 filas por página; el navegador no carga el inventario completo. Cada fila distingue texto disponible, escaneo leído, lectura parcial y referencia pendiente. Los fragmentos incluyen enlace a la publicación original y página o artículo.

La consulta de un asunto ya busca automáticamente en este índice. La búsqueda de fuentes y la preparación son locales; esta intervención no ejecutó una nueva deliberación de IA.

## Pendientes y alcance real

Quedan por descargar y procesar la mayoría de las referencias. En la captura hay 239 registros sin original adjunto y una discordancia de metadatos excluida. También se registran enlaces oficiales que devuelven 404, documentos demasiado grandes, publicaciones sin cuerpo extraíble y lecturas que requieren revisión. Los registros SILpy sin un lector compatible siguen siendo referencias; no se confunden con textos normativos.

No se certifica que estos seis repositorios contengan absolutamente todo lo necesario para cualquier especialidad. Aún se necesita completar y cotejar repositorios sectoriales, resoluciones de organismos y entes reguladores, ordenanzas municipales, normativa internacional y tratados, además de reformas, derogaciones y textos consolidados. Tampoco se han incorporado colecciones privadas o doctrina con licencia. Esta carga amplía las publicaciones públicas accesibles; no constituye una declaración de cobertura universal o vigencia.

## Verificación y costo

- **34 pruebas locales y 271 pruebas Core aprobadas**, sin fallos. Compilación web, compilación del Core y comprobación de tipos satisfactorias.
- PDF sintético realmente escaneado: lectura española offline, caché, original intacto y recuperación mediante el índice real con advertencia de OCR.
- Catálogo paginado, búsqueda FTS, descubrimiento de registros, años históricos ofrecidos por el portal, cursores reanudables y política sin autorización deshabilitada.
- Estado conjunto: el trabajo no aparece terminado si todavía está procesando escaneos. Escrituras atómicas con reintentos frente a bloqueos de archivos en Windows.
- Informes descargados: advertencias de lectura parcial y localizadores HTML conservados, sin inventar páginas PDF.
- Navegador aislado con servidor real: Biblioteca, avance automático, búsqueda del Decreto 4777, original y aviso de escaneo. Sin errores JavaScript ni solicitudes a proveedores externos.
- Servidor del usuario en `http://127.0.0.1:4313/`: respuestas HTTP 200 en avance, catálogo y búsqueda del escaneo recuperado.

Evidencia: `reports/full-library-live-checks.json`, `reports/full-library-ocr-tests.json`, `reports/full-library-core-tests.json` y `reports/full-library-ocr-browser.png`.

**Llamadas pagas: 0. Despliegues: 0.** Se actualizaron únicamente el servidor del OS y sus procesos de carga conocidos; no se detuvieron otros procesos del usuario.
