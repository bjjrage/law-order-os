# Biblioteca jurídica: catálogo incorporado

Fecha de trabajo 2026-10-13, America/Asuncion. Se sustituyó la vista inicial de 15 portales por un catálogo consultable de 5.290 referencias reales: 4.360 registros de leyes del Congreso, 925 referencias a PDFs judiciales del Digesto, una Constitución y cuatro códigos. El directorio original permanece en Fuentes y buscadores oficiales.

Origen: [OpenAPI Congreso v2](https://datosv2.congreso.gov.py/web/api/openapi.json), [leyes](https://datosv2.congreso.gov.py/web/api/ley), [jurisprudencia Digesto](https://digestolegislativo.gov.py/pagina&id=39). La paginación documentada usa offset como página desde 1 y límite máximo 500. Se recuperaron nueve páginas hasta la primera página corta, se validó el sobre real codigoEstado/datos y se deduplicó por idLey. El servidor devuelve registros duplicados entre páginas y algunas fechas incorrectas: se preservan los datos originales y no se reconstruye un año por suposición. Distintos IDs pueden corresponder al mismo número de ley; la cifra cuenta registros, no asegura normas únicas.

Se conservan respuestas originales por página y hashes en el manifiesto público. Los títulos descriptivos provienen del expediente vinculado y no equivalen necesariamente al título del texto sancionado. La jurisprudencia procede de los enlaces PDF de una página del Digesto; no representa toda la CSJ. Los PDF se enlazan, no se descargaron 925 documentos ni se extrajo su texto. Las cuatro publicaciones de códigos y Constitución conservan las limitaciones del registro anterior.

Funciones: búsqueda por palabras/número/título, filtros por tipo/año, paginación de 50, favoritos persistidos en navegador, enlace oficial y procedencia. Los favoritos no contienen claves ni información de asuntos y no están incluidos en el respaldo Core. No se modificaron datos de casos ni el corpus confiable de Junta.

Limitaciones visibles: no hay búsqueda dentro de artículos, vigencia consolidada certificada, cobertura jurídica universal ni incorporación automática a Junta. Los decretos siguen accesibles en el buscador CSJ, sin catálogo integrado. El intento acotado del formulario público CSJ respondió HTTP 500; se preservó en csj-results.html, sin inventar una API ni descargar masivamente otro portal.

Actualizar catálogo local: `node scripts/library-sync.mjs`, después `npm.cmd run os:build:web`. Son GET públicos sin IA ni costos de proveedores. No hay tarea recurrente ni despliegue. El script rechaza URLs externas, IDs inválidos, sobre de error y páginas repetidas; no modifica credenciales o procesos. La actualización es una captura, no una sincronización transaccional oficial.

Validación: typecheck y build web PASS. Pruebas locales 15/15 PASS en test-results.json, incluyendo normalización de fuente, rechazo de URLs maliciosas, conservación de fechas inválidas, deduplicación judicial, alcance explícito y catálogo con procedencia. Verificación en navegador: conteo 5.290 y búsqueda contrato con 145 resultados. No se cerró ni reinició ningún proceso del usuario; el servidor existente sirve el build actualizado.


## Actualizaci?n 2026-10-14: Biblioteca conectada a Junta

Las nuevas consultas buscan en los t?tulos del cat?logo y en siete publicaciones oficiales con texto (1.764 p?ginas). El abogado principal y el auditor reciben fragmentos con procedencia; los informes muestran fuentes encontradas, entregadas y citadas. Las referencias sin texto quedan separadas. No se certifican cobertura universal, vigencia ni identidad bibliogr?fica. Ver `junta-local/LIBRARY_JUNTA_CONNECTION_REPORT.md`. No hubo llamadas pagas ni despliegues.


## Actualizacion 2026-10-14: RAG ampliado

El indice persistente SQLite contiene 743 documentos con texto y 21.208 fragmentos: 205 decretos, 207 leyes, cuatro codigos, una Constitucion y 326 publicaciones jurisprudenciales. La Biblioteca y la preparacion de nuevas consultas usan ese indice. Ver junta-local/RAG_EXPANSION_REPORT.md para cobertura, faltantes y validacion. No hubo llamadas pagas ni despliegues.
