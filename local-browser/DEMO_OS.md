# Demostración del OS en el navegador del usuario

2026-10-13. Se creó desde la interfaz el estudio **Estudio Demo OS — datos sintéticos**, el cliente ficticio **Comercial Ejemplo S.A.** y el asunto **DEMO — revisión documental de un contrato**.

El asunto incluye un relato sintético en texto UTF-8 incorporado como original, una tarea interna pendiente y un borrador manual versionado. No se usó IA para redactar ese contenido. Una recarga confirmó que la tarea aparece en Mi día y que original/borrador conservan sus versiones en el asunto. Se dejó abierto Documentos. Evidencia: `reports/os-demo-20261013.json`, `reports/os-demo-mi-dia.png` y `reports/os-demo-asunto.png`.

Para recorrerlo: Mi día → tarea pendiente → asunto; o Asuntos → DEMO. Documentos permite consultar versiones, Tareas muestra la próxima acción y Borradores contiene la lista manual. Biblioteca jurídica ofrece las fuentes de consulta externas. Trabajo jurídico mantiene la demo aislada de la Junta; todavía no hay conexión que envíe este asunto a una Junta real.

Se comprobó acceso a modelos con GET de metadatos usando las claves ya cargadas: Luna/Sol PASS para IDs configurados; Jev bloqueado por ausencia del ID exacto en el listado; Gemini HTTP 401. No se imprimieron valores de claves ni cuerpos de error, no se enviaron documentos y no se generó contenido remoto. Reporte separado `../junta-local/reports/provider-metadata-20261013.json`. No se confunde disponibilidad de metadatos con compatibilidad de inferencia ni con verificación jurídica.

La restricción de no ejecutar llamadas pagas ni despliegues sigue vigente. Quedan pendientes la conexión asunto/Junta, compatibilidad de evidencia/corpus y los gates informados; cargar claves no completa esas tareas.
