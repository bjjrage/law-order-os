# Biblioteca jurídica del OS

## Recuperación e integración del 19 de octubre de 2026

La vista Documentos abre por defecto los textos disponibles en el OS. El catálogo
completo, que incluye referencias pendientes, queda en una vista separada. Los
títulos con texto y las coincidencias de búsqueda abren un lector local paginado;
el original guardado se ofrece cuando existe y se verifica su SHA-256 al servirlo.
Los HTML originales se descargan como adjuntos, sin ejecutarlos en la app.

Los indicadores se consultan directamente en SQLite mediante la ruta autenticada
`/local/junta/library/coverage`, en lugar de depender de una copia JSON publicada.
La recuperación encontró 138.211 referencias, 33.240 publicaciones indexadas
(3.636 parciales) y 705.606 fragmentos. Son cantidades diferentes; no equivalen a
138.211 documentos completos ni a normas únicas o vigentes.

Se preservaron los archivos de catálogo y avance dañados en
`.local-dev/library-recovery-2026-10-20T02-22-16-332Z/`, con un manifiesto de hashes,
y se reconstruyeron las copias desde la base existente. La procedencia histórica
del catálogo se reconstruyó a partir de las nueve respuestas legislativas y el
índice judicial archivados, identificándola como recuperada. Los procesos de carga
retomaron la cola existente. Los candados comprueban la identidad del proceso,
para que un PID reutilizado por otro programa no bloquee la recuperación.

Las escrituras atómicas sincronizan el archivo antes de publicarlo. Se mantiene
la separación entre originales, extracciones, índice y referencias sin texto;
la lectura parcial y la vigencia pendiente siguen visibles.

## Estado actualizado al 14 de octubre de 2026

La Biblioteca ya consulta textos mediante un índice local persistente, conectado a la preparación de la Junta. Se inició una carga integral automática de BACN, Presidencia, MEF, legislación, jurisprudencia y acordadas de la Corte. Los PDFs escaneados se leen con OCR español en la computadora, sin servicios pagos. Dos procesos separados incorporan textos digitales y escaneos, con continuación automática desde el OS, sin ejecutar un .bat de actualización.

El catálogo contiene más de 135.000 referencias; la mayoría todavía está pendiente de lectura. La pantalla muestra contadores de textos realmente consultables, avance y reservas de lectura parcial. Los informes identifican las publicaciones y pasajes seleccionados. No se certifica cobertura universal, vigencia o autenticidad mediante la mera descarga o el OCR.

Informe y comprobaciones: [carga integral y OCR](../../junta-local/FULL_LIBRARY_OCR_REPORT.md). Lo que sigue documenta la versión inicial del directorio de enlaces del 13 de octubre, y no describe el alcance actual de la integración.

2026-10-13. Se agregó Biblioteca jurídica al menú principal de la app local. Accesible sin estudio y sin autenticación. Reutiliza las 15 fichas canónicas de `docs/fuentes/FUENTES_Y_APIS_PARAGUAY_v1.1.json`; no modifica ese catálogo histórico ni los manifiestos/corpus/holdouts de la Junta.

Incluye Constitución, legislación CSJ/Presidencia, Gaceta Oficial, BACN, Digesto, jurisprudencia de las salas Constitucional/Civil/Penal, resoluciones de apelación, códigos Civil/Procesal Civil/Penal/Procesal Penal y datos/APIs legislativos. Categorías y búsqueda local por nombre, institución, alcance o URL. La búsqueda ignora mayúsculas y tildes y filtra el directorio; no consulta automáticamente textos de los portales.

Los enlaces abren una pestaña externa con `noopener noreferrer`. No reciben datos del asunto, claves ni parámetros de búsquedas privadas. La app no descarga/indexa fuentes ni concede etiquetas VERIFIED. Las observaciones conservan límites de edición, modificatorias, derechos de compilaciones y documentos candidatos.

## Comprobación de portales

Se abrió mediante herramienta web el portal [jurisprudencial CSJ](https://www.csj.gov.py/app/jur/), la [legislación CSJ](https://www.csj.gov.py/legislacion), la [Constitución publicada por Cultura](https://cultura.gov.py/marcolegal/constitucion-nacional-1992/) y [datos legislativos v2](https://datosv2.congreso.gov.py/web/). Observación web al 2026-10-13, no certificación de vigencia, completitud ni integración.

La apertura automática de [BACN](https://www.bacn.gov.py/leyes-paraguayas) devolvió HTTP 403 y [Gaceta](https://www.gacetaoficial.gov.py/) agotó el tiempo. Se mantienen los accesos institucionales con ese estado explícito; no se declaran sitios caídos ni enlaces comprobados como funcionales desde el navegador del usuario. Las otras nueve fichas conservan fecha histórica 2026-10-11 y se muestran como no revalidadas en esta revisión.

## Verificación local

Typecheck y build web PASS. Navegador del usuario: menú visible, apertura sin estudio, quince enlaces presentes, categorías y búsqueda comprobadas. No se alteran datos de estudio ni credenciales. Sin llamadas pagas ni despliegues.
