# Fuentes comunes del piloto

Las tres modalidades tienen acceso a estas mismas publicaciones oficiales completas, archivadas en HTML y acompañadas de una extracción textual numerada. Consulta pública y archivo realizados durante esta preparación; no se ejecutaron inferencias pagas.

| ID | Publicación e institución | Original archivado | Texto auxiliar |
|---|---|---|---|
| F01 | Ley 1183, Código Civil, Libro III; Biblioteca y Archivo Central del Congreso Nacional | [HTML](originales/F01-codigo-civil-libro-iii.html) | [TXT](extracciones/F01-codigo-civil-libro-iii.txt) |
| F02 | Ley 213, Código del Trabajo; Biblioteca y Archivo Central del Congreso Nacional | [HTML](originales/F02-codigo-trabajo.html) | [TXT](extracciones/F02-codigo-trabajo.txt) |
| F03 | Ley 6380, modernización y simplificación del sistema tributario; Dirección Nacional de Ingresos Tributarios | [HTML](originales/F03-ley-6380.html) | [TXT](extracciones/F03-ley-6380.txt) |

Direcciones de publicación:

- [F01 en BACN](https://www.bacn.gov.py/leyes-paraguayas/522/codigo-civil-iii-parte-libro-tercero).
- [F02 en BACN](https://www.bacn.gov.py/leyes-paraguayas/2608/ley-n-213-establece-el-codigo-del-trabajo).
- [F03 en DNIT](https://www.dnit.gov.py/web/portal-institucional/w/ley-n-6380-19).

## Acceso y localizadores

Buscar por artículo o expresión en el TXT; consultar las líneas contiguas y el HTML para verificar contexto. Una cita puede usar `F02, art. 28, F02-L00118` e indicar el tramo adicional necesario. Los identificadores `Fxx-Lxxxxx` corresponden solo a esta extracción; no son números oficiales de párrafo. Las citas del derecho deben identificar también ley y artículo.

`FUENTES.json` registra URL solicitada, fecha de escritura del archivo descargado, estado HTTP observado, tamaño, hash y método de extracción. La fecha de escritura no es fecha de promulgación, vigencia ni una marca de tiempo emitida por la institución. Los hashes identifican los bytes que recibieron los participantes, no autentican jurídicamente la norma.

## Alcance

F01 contiene el Libro III publicado en esa página, no todo el Código Civil. F02 y F03 reproducen lo publicado en sus respectivas páginas; no se certifica que incorporen todas las reformas ni que el encabezado web refleje adecuadamente la fecha de la ley. No se incorporó jurisprudencia, reglamentación tributaria completa, normativa de seguridad social ni legislación societaria o marcaria complementaria.

Antes de inferencias comparativas, un abogado debe revisar extracción, cobertura y aplicabilidad temporal. Si requiere ampliar fuentes, se crea una nueva versión común a A/B/C antes de ejecutar. Las conclusiones que necesiten material ausente deben delimitarse como pendientes. El ensayo no puede demostrar desempeño en investigación jurisprudencial con un corpus que no contiene jurisprudencia.

La extracción elimina etiquetas, scripts y estilos, decodifica entidades y normaliza espacios. No fue cotejada íntegramente por un humano. Puede conservar errores tipográficos de la publicación o perder estructura tabular; consultar el original. El archivo HTML descargado permanece sin modificaciones. No se transforma una publicación accesible en una fuente con atestación del checker, una firma validada o una consolidación certificada.

Los bytes originales de F01 y F02 contienen algunas secuencias incompatibles con UTF-8 en metadatos de navegación, pese a la codificación anunciada por el sitio. La extracción conserva un carácter de reemplazo en cinco líneas de F01 y tres de F02 que muestran el nombre del día de publicación. `FUENTES.json` identifica esas líneas. No se corrigieron los originales ni se interpretaron esas fechas como vigencia normativa. El cotejo humano completo sigue pendiente.
