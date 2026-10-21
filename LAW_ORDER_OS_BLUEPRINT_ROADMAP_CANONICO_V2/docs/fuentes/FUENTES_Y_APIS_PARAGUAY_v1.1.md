# Fuentes y APIs de Paraguay — actualización v1.1

Corte de investigación:11/10/2026. 15 canales/fichas, no 15 APIs ni 15 conectores.

**Método:** lectura de sitios/documentos por herramienta web y revisión de imágenes de PDFs. Tres GET desde contenedor fallaron por DNS. No se incorporan PDF crudos ni hashes de originales inexistentes. Las fechas del catálogo no son una prueba de consulta en vivo al origen.

## PY-CONG-V2 — Congreso Nacional · Datos Abiertos Legislativos v2

Fuente: https://datosv2.congreso.gov.py/web/

**Observado:** Swagger y URL exacta del OpenAPI localizados. El cuerpo openapi.json no fue recuperado. El catálogo declara extracción 02/10/2026. No se certifica interfaz v2 ni sincronización diaria.

**Alcance:** Metadatos de leyes y de tramitación legislativa. No se presupone texto íntegro en cada registro.

**Cobertura:** La lista de datos incluye leyes; la integridad histórica y el universo exacto no se auditaron.

**Condiciones:** CC-BY 4.0 para documentos sometidos a los términos del portal; conservar atribución, fecha y metadatos. Revisar condiciones particulares de adjuntos.

**Prueba:** OPENAPI_UBICADO_CUERPO_NO_RECUPERADO

**Siguiente:** Descargar esquema en red funcional; validar contrato antes de escribir cliente. No heredar paginación v1 por suposición.

## PY-CONG-V1 — Congreso Nacional · API SILpy documentada (ruta histórica)

Fuente: https://datos.congreso.gov.py/opendata/api

**Observado:** Se observó JSON ley/134254 y adjuntos/detalle de otro proyecto,101629. Adjuntos distinguen iniciativa, antecedente, ley y sanción. No unir estos registros como una misma cadena. V1 documenta offset como página 1-based.

**Alcance:** Leyes, proyectos y adjuntos de proyectos mediante rutas documentadas.

**Cobertura:** Una respuesta observada; sin barrido, sin verificación de completitud y sin reconciliación v1/v2.

**Condiciones:** El sitio publica CC-BY 4.0. Aplicar términos del portal y revisar alcance de cada adjunto.

**Prueba:** METADATOS_ADJUNTOS_OBSERVADOS_WEB; ORIGINAL_PENDIENTE

**Siguiente:** Repetir GET desde red funcional; comprobar identidad ley→proyecto→adjunto de la MISMA ley y descargar candidato LEY. No asumir idAdjunto=idLey.

## PY-CSJ-JUR — CSJ · Jurisprudencia: Constitucional, Civil y Penal

Fuente: https://www.csj.gov.py/app/jur/

**Observado:** Formulario CSJ con las tres salas confirmado; no API pública de texto completo verificada. Se observaron muestras escaneadas de las tres salas en el Digesto Legislativo del Senado (fuente adicional separada).

**Alcance:** Resoluciones de las tres salas; metadatos, textos y relaciones según descripción oficial.

**Cobertura:** La CSJ declara resoluciones desde 1995. No se auditó cobertura por sala/año, ausencias, reservas ni completitud del texto.

**Condiciones:** Acceso público no equivale a autorización automática de ingesta masiva, almacenamiento o redistribución. Validación de condiciones y datos personales pendiente.

**Prueba:** FORMULARIO_OBSERVADO_SIN_API_VERIFICADA

**Siguiente:** Acordar acceso CSJ/IIJ y cotejo de muestra; conservar las tres salas en alcance. Digesto no reemplaza cobertura histórica CSJ.

## PY-CSJ-LEG — CSJ + Presidencia · Legislación de la República

Fuente: https://www.csj.gov.py/legislacion

**Observado:** Portal abierto con búsquedas por texto, número, año y estado. Describe relaciones normativas elaboradas por el IIJ.

**Alcance:** Leyes y decretos reglamentarios, fuentes y relaciones de modificación/derogación.

**Cobertura:** Cobertura desde 1869 declarada por el portal; no auditada. Los campos de vigencia deben conservar procedencia y fecha de revisión.

**Condiciones:** Revisar autorización para reutilizar textos, base y enriquecimientos editoriales por separado.

**Prueba:** PORTAL_OBSERVADO_SIN_DESCARGA_INTEGRAL

**Siguiente:** Pedir exportación/API, diccionario y modelo temporal. Comprobar Código Civil y Procesal Civil íntegros y sus modificaciones, además de normas generales.

## PY-GACETA — Presidencia · Gaceta Oficial

Fuente: https://www.gacetaoficial.gov.py/

**Observado:** Gaceta 270 del 09/10/2026: índice→detalle 97604→documento 97606. Es sección Avisos; documento no abrió por timeout. No API confirmada.

**Alcance:** Publicaciones oficiales para respaldar texto y fecha de publicación.

**Cobertura:** Archivo histórico, asociación edición→norma y continuidad de entregas por auditar.

**Condiciones:** El sitio muestra aviso general de derechos. Obtener condiciones aplicables a documentos e ingesta; no extrapolar CC-BY del Congreso.

**Prueba:** CADENA_DE_ENLACES_WEB_OBSERVADA_DESCARGA_PENDIENTE

**Siguiente:** Repetir documento y distinguir Avisos/Registro Oficial; verificar asociación norma-publicación y paginación.

## PY-CONSTITUCION — Secretaría Nacional de Cultura · Constitución Nacional 1992

Fuente: https://cultura.gov.py/marcolegal/constitucion-nacional-1992/

**Observado:** La página oficial enlaza un PDF de 70 páginas que pudo abrirse en el navegador de investigación. No se creó aún un corpus a partir del documento. Nueva alternativa: Digesto 7437, PDF 149 páginas; portada escaneada revisada. Edición y enmiendas siguen pendientes.

**Alcance:** Texto de la Constitución como documento fuente, sujeto a revisión de edición y enmiendas.

**Cobertura:** Una edición accesible; no se certifica que sea una consolidación vigente a octubre de 2026.

**Condiciones:** Validar condiciones del documento y vía de reutilización; no incluir logos ni atribuir patrocinio oficial.

**Prueba:** PDF_LEIDO_VIA_WEB_SIN_ADAPTADOR

**Siguiente:** Comparar versiones oficiales y obtener originales; no asumir texto vigente consolidado. Ver muestra NORM-CN-1992.

## PY-CPP-IIJ — IIJ · Código Procesal Penal actualizado y concordado

Fuente: https://www.pj.gov.py/ebook/libros_files/codigo-procesal-penal.pdf

**Observado:** PDF de 292 páginas, cuarta edición digital de 2024. Se leyó y visualizó la página de créditos, que exige autorización escrita para reproducción/archivo del ejemplar.

**Alcance:** Compilación editorial de Ley 1286/1998 con concordancias. No confundir con el texto legislativo desnudo ni con una edición actualizada a 2026.

**Cobertura:** Edición 2024; cambios posteriores no verificados.

**Condiciones:** INGESTA DE LA COMPILACIÓN BLOQUEADA hasta autorización o revisión jurídica de la vía alternativa. Separar la situación del texto normativo de los aportes editoriales.

**Prueba:** PDF_Y_AVISO_LEIDOS_NO_INGESTA

**Siguiente:** Priorizar leyes originales y modificatorias desde fuentes habilitadas; pedir permiso específico si se quieren conservar concordancias editoriales.

## PY-CP-IIJ — IIJ · Código Penal actualizado y concordado

Fuente: https://www.pj.gov.py/ebook/libros_files/coleccion-derecho-penal.pdf

**Observado:** El navegador abrió una publicación oficial de 254 páginas referida al Código Penal. No se validaron integralmente su edición, licencias y cambios posteriores.

**Alcance:** Código Penal y material de compilación. Separar contenido normativo y editorial.

**Cobertura:** Vigencia y completitud pendientes de auditoría documental.

**Condiciones:** Revisión específica pendiente; no inferir permiso desde acceso gratuito.

**Prueba:** PDF_ABIERTO_SIN_VALIDACION_INTEGRAL

**Siguiente:** Localizar texto original y modificatorias por fuente habilitada y revisar condiciones de esta compilación antes de indexarla.

## PY-BACN — BACN · Leyes paraguayas

Fuente: https://www.bacn.gov.py/leyes-paraguayas

**Observado:** El acceso con la herramienta devolvió 403. Esto no prueba que el servicio esté caído para usuarios ni autoriza a eludir restricciones.

**Alcance:** Fuente candidata para leyes, Constitución y códigos.

**Cobertura:** No se comprobaron originales del Código Civil y Procesal Civil en esta sesión.

**Condiciones:** No verificada.

**Prueba:** HTTP_403_EN_HERRAMIENTA_WEB

**Siguiente:** Confirmar acceso institucional y eventual API/exportación; no sortear CAPTCHA, autenticación ni bloqueo. Mantener como fuente candidata, no operativa.

## PY-CSJ-RESWEB — CSJ · Resoluciones de tribunales de apelación

Fuente: https://www.csj.gov.py/resolucionesweb/

**Observado:** Portal declara resoluciones de Tribunales de Apelación de Capital e Itapúa desde 2000; filtros requeridos. No es el corpus de las tres salas CSJ.

**Alcance:** Tribunales de Apelación Capital/Itapúa; adicional y separado de las tres salas.

**Cobertura:** La descripción de primera versión menciona Capital e Itapúa desde 2000; no se comprobó expansión o integridad posterior.

**Condiciones:** Pendiente de condiciones de reutilización y privacidad.

**Prueba:** FORMULARIO_OBSERVADO

**Siguiente:** Solicitar contrato/exportación según alcance. No atribuir cobertura Constitucional/Civil/Penal CSJ a este portal.

## PY-CSJ-OPEN — CSJ · Datos abiertos institucionales

Fuente: https://datos.csj.gov.py/

**Observado:** El catálogo nacional enumera datos institucionales y consigna ausencia de API para ese portal. No sirve como prueba universal sobre todos los sistemas internos de la Corte. La ficha de datos.gov.py declara Tiene API:No para este portal; es declaración del directorio, no auditoría de todos los servicios CSJ.

**Alcance:** Datos institucionales; no se identificó aquí una API de textos completos de todas las sentencias.

**Cobertura:** Datasets y actualización por verificar individualmente.

**Condiciones:** Depende de cada dataset.

**Prueba:** CATALOGO_LEIDO_NO_API_JURISPRUDENCIAL

**Siguiente:** Verificar con organismo alcance y formatos vigentes; no atribuir cobertura de jurisprudencia a estadísticas institucionales.

## PY-DIGESTO-NORM — Senado · Digesto Legislativo — normas

Fuente: https://digestolegislativo.gov.py/

**Observado:** Fichas y enlaces a Constitución 7437, Código Civil 2609, Penal 10484 y Procesal Penal 9207. Tres PDFs abiertos con visor; Civil excedió límite. Ficha 7404 contiene fechas discordantes.

**Alcance:** Normas históricas, relaciones y textos ordenados diferenciados.

**Cobertura:** Muestras finitas; no cobertura completa ni consolidación 2026.

**Condiciones:** Condiciones de reutilización/automatización por verificar. No se hereda la licencia del portal Congreso a otro dominio.

**Prueba:** OBSERVACION_WEB_NO_SMOKE_RUNTIME

**Siguiente:** Obtener vía autorizada, verificar identidad/correcciones y versiones. No asumir API ni corpus libre por defecto.

## PY-DIGESTO-JUR — Senado · Digesto — jurisprudencia archivada

Fuente: https://digestolegislativo.gov.py/pagina&id=39

**Observado:** Índice 2017 enlaza PDFs A&S 24,28,46. Se comprobaron las salas Constitucional, Civil y Comercial, Penal en imágenes de los documentos.

**Alcance:** Muestras históricas de las tres salas; cantidad/continuidad de años no auditadas.

**Cobertura:** Muestras finitas; no cobertura completa ni consolidación 2026.

**Condiciones:** Condiciones de reutilización/automatización por verificar. No se hereda la licencia del portal Congreso a otro dominio.

**Prueba:** OBSERVACION_WEB_NO_SMOKE_RUNTIME

**Siguiente:** Cotejo CSJ, acceso y actualización. Resolver calidad de texto sin borrar manuscritos ni correcciones.

## PY-CC-CONATEL — CONATEL · publicación del Código Civil

Fuente: https://www.conatel.gov.py/conatel/wp-content/uploads/2019/10/ley-1183_1985-cdigo-civil-paraguayo.pdf

**Observado:** PDF 304 páginas abierto; notas de modificación visibles junto al texto.

**Alcance:** Candidato documental Código Civil 1183/1985; edición vigente no certificada.

**Cobertura:** Muestras finitas; no cobertura completa ni consolidación 2026.

**Condiciones:** Condiciones de reutilización/automatización por verificar. No se hereda la licencia del portal Congreso a otro dominio.

**Prueba:** OBSERVACION_WEB_NO_SMOKE_RUNTIME

**Siguiente:** Comparar original Digesto y normas modificatorias; revisar derechos y controlar segmentos.

## PY-CPC-CORREO — DINACOPA · candidato Código Procesal Civil

Fuente: https://correoparaguayo.gov.py/sitio/wp-content/uploads/2023/09/Codigo-Procesal-Civil-1988.pdf

**Observado:** URL estatal encontrada en índice; apertura no completada.

**Alcance:** Candidato Ley 1337/1988, NO documento validado.

**Cobertura:** Muestras finitas; no cobertura completa ni consolidación 2026.

**Condiciones:** Condiciones de reutilización/automatización por verificar. No se hereda la licencia del portal Congreso a otro dominio.

**Prueba:** OBSERVACION_WEB_NO_SMOKE_RUNTIME

**Siguiente:** Abrir original y comprobar título, extremos y modificatorias. No usar como fuente verificada aún.

## Registro de observaciones

Ver `evidencia/OBSERVACIONES_F1_v1.1.json`, con 20 observaciones y referencias. El historial de cada ficha original está en su campo `original_v1_0`.
