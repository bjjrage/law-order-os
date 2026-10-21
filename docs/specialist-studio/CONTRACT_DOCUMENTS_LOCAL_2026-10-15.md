# Contratos completos: carga y extracción local

15/10/2026 · America/Asuncion. Corrección del bloqueo real por el límite de 24 KB del ensayo inicial. Sustituye las restricciones del flujo actual descritas en la entrega del atajo; el piloto contractual anterior conserva sus límites históricos.

El panel del equipo y el formulario Documentos aceptan PDF, Word DOCX y TXT. Cada original conserva sus bytes, nombre, tipo, hash y versión; se puede descargar desde la lista de evidencia. No se convierte el PDF/Word en un TXT presentado como original.

La política compartida admite 20 MB por archivo, 50 MB por carga y hasta 12 documentos. La preparación admite hasta 4 MB de texto extraído en el encargo. Superar una capacidad de extracción deja el original guardado y una observación visible: nunca se recorta ni se declara completo un texto parcial.

PDF se procesa en un worker local con la dependencia PDF.js ya disponible en el proyecto, incluyendo fuentes y mapas de caracteres locales. DOCX se descomprime localmente con fflate y se leen cuerpo, tablas, encabezados, pies y notas XML. Se conservan los textos eliminados en documentos con cambios controlados; cambios e imágenes requieren revisión expresa. No se ejecutan instrucciones, objetos Office ni JavaScript del PDF. Los archivos DOC antiguos deben guardarse como DOCX.

Una página PDF sin texto queda identificada y bloquea la preparación del documento hasta contar con texto/OCR. Un PDF protegido o ilegible también queda guardado con su observación. No se inventó OCR ni se presenta extracción incompleta como evidencia completa.

`legal_team.document_extractions` conserva el texto separado del original, su hash, método, unidades, advertencias y versión del extractor. Evidence mantiene tanto hash del texto como hash del archivo original. Preparación, ejecución, comprobación e importación del respaldo validan estos enlaces. Una edición o incorporación invalida preparaciones anteriores, conservando los resultados históricos.

Los asuntos pequeños conservan su almacenamiento anterior. Cuando crecen, el adaptador guarda el snapshot completo en IndexedDB y publica un puntero pequeño de forma atómica. Un fallo de escritura no sustituye el estado anterior. Se mantienen el formato portátil de respaldo v1, todos los originales, clientes, asuntos e historial; la importación admite respaldos de hasta 256 MB. No se lee ni reemplaza el navegador del propietario durante las pruebas.

La prueba de navegador usa un contexto aislado y documentos sintéticos generados localmente: PDF de dos páginas y más de 90 KB, DOCX de más de 100 KB, TXT de más de 24 KB, y un original adicional de más de 2 MB. Comprueba cláusulas finales en la ejecución, descarga exacta del PDF, migración a IndexedDB, recarga y respaldo/importación en otro contexto. Se bloquean solicitudes externas, `/api` y `/local`; los parsers/worker/fuentes se sirven en el mismo origen. [Prueba del navegador](../../local-browser/reports/contract-documents/browser.json), [suite local](../../local-browser/reports/contract-documents/local-tests.json).

No hubo llamadas pagas, despliegues, migraciones SQL, reinicios del servidor o de los trabajos de Biblioteca. El runtime jurídico sigue siendo documental determinístico offline, con evaluación jurídica humana pendiente.

## Continuación: confirmar y preparar desde el contrato

Se corrigió el bloqueo al editar la pregunta o el equipo después de adjuntar un contrato. El panel ofrece **Confirmar cambios y preparar consulta** junto a la evidencia; el clic confirma la configuración y prepara esos mismos documentos, conservando su selección y la revisión expresa de las advertencias. La ejecución sigue requiriendo el botón **Ejecutar encargo local · USD 0**.

La comparación de configuraciones valida y normaliza sus campos antes de compararlas, sin depender del orden de las propiedades. Ambas formas de confirmar adoptan la configuración guardada; los espacios iniciales/finales ya no producen una confirmación pendiente permanente. Cada bloqueo muestra el dato que falta, y el texto de progreso corresponde a confirmar, preparar o ejecutar.

La regresión de navegador reproduce un Word sintético con cambios controlados, una pregunta inválida, edición de pregunta/cuestionario/profundidad/Santiago, confirmación junto al contrato y confirmación desde el editor. Comprueba dos ejecuciones explícitas, la cláusula final, el original idéntico y la selección conservada, sin solicitudes externas. Evidencia: [recorrido verificado](../../local-browser/reports/team-preparation/browser.json), [suite local](../../local-browser/reports/team-preparation/local-tests.json), [panel de confirmación](../../local-browser/reports/team-preparation/01-confirmar-junto-al-contrato.png).

Después del apagado de la computadora se volvió a iniciar el servidor local en el mismo origen `http://127.0.0.1:4313/`. Las pruebas se realizaron en contextos aislados; no se sustituyeron los datos del navegador del propietario.

Verificación de esta corrección: tipos y compilación web correctos; 73 casos locales verificados. La primera pasada tuvo 72 aprobados y un timeout de 10 segundos al buscar fuentes en el flujo anterior; esa prueba pasó al repetirla sin modificar su código. Se conservan ambos informes: [primera pasada](../../local-browser/reports/team-preparation/local-tests.json) y [repetición del flujo anterior](../../local-browser/reports/team-preparation/legacy-browser-recheck.json).

## Gestión de documentos del asunto

El panel se llama **Documentos del asunto** y explica la diferencia entre seleccionar para una consulta y eliminar. Muestra el nombre original, el origen (archivo adjunto, ejemplo de prueba o borrador), la fecha de incorporación, el tamaño, una vista previa explícita y las observaciones de extracción. Los ejemplos se agrupan aparte y su carga está dentro de una opción de prueba desplegable.

Cada original tiene **Eliminar**. Se retira de las listas activas del asunto y de la selección; queda en **Documentos eliminados**, con **Restaurar**. Restaurar lo devuelve al asunto sin seleccionarlo automáticamente. Los originales, versiones y resultados anteriores permanecen íntegros en el respaldo; los resultados cuya evidencia activa cambió se identifican como históricos. Los borradores conservan su flujo de revisión propio.

`legal_team.document_changes` registra acciones locales de eliminación/restauración con actor, versión y enlace a la acción anterior. Se validan el permiso DOCUMENT_WRITE, el ámbito del asunto y las versiones para evitar sobrescribir cambios de otra pestaña. La persistencia atómica y la validación del respaldo incluyen ese registro, con compatibilidad para respaldos anteriores que no lo tienen.

Las cargas de PDF, DOCX y TXT reutilizan el original cuando sus bytes y tipo coinciden dentro del mismo asunto, incluso en una carga con archivos repetidos. Un contenido distinto con igual nombre se conserva como otro archivo. Un original en papelera no se recrea al volver a cargarlo: la interfaz indica que puede restaurarse. Volver a cargar ejemplos, incluido después de recargar la página, tampoco agrega copias. Las copias que ya existían se señalan por contenido idéntico para que el usuario decida cuáles eliminar; no se hizo una limpieza automática de sus datos.

Pruebas: deduplicación, origen, eliminación/restauración, conservación de originales e historial, ámbito/permisos, conflictos de versiones, rollback de cuota y respaldo. El recorrido de navegador conserva la pregunta, ejecuta solo el archivo seleccionado, comprueba papelera tras recargar y bloquea solicitudes externas. [Evidencia del navegador](../../local-browser/reports/document-management/browser.json), [documentos identificados](../../local-browser/reports/document-management/01-documentos-identificados.png), [papelera e historial](../../local-browser/reports/document-management/02-papelera-e-historial.png).

Verificación: tipos y compilación correctos. La [primera suite de 79 casos](../../local-browser/reports/document-management/local-tests.json) tuvo 78 aprobados y un fallo del selector de texto del contrato extenso durante la recarga: el título se repetía temporalmente como nombre de archivo mientras llegaban los metadatos. Se corrigió ese rótulo y se limpian los avisos de carga después de eliminar/restaurar. Los [tres recorridos finales de navegador](../../local-browser/reports/document-management/final-browser-tests.json) pasaron: documentos completos y respaldo grande, gestión de archivos con papelera y confirmación/preparación del equipo. El servidor local entrega los [assets finales verificados](../../local-browser/reports/document-management/live-assets.json), sin reiniciarlo ni reemplazar datos del propietario.

## Documento de trabajo y responsabilidad del titular

El resultado principal dejó de mostrar la concatenación de matrices y objeciones. Presenta el titular del documento, el responsable humano de revisar/aprobar, el editor del entregable y las decisiones para completar el encargo. **Ver revisión interna y respaldo** conserva el registro íntegro, cerrado por defecto, con exportación, opiniones, debate y control original.

Para encargos de elaboración/redacción contractual, el modo local identifica un texto contractual original entre los documentos seleccionados y conserva su extracción íntegra como base editable. Prioriza documentos del cliente frente a ejemplos identificados. No cambia partes, precios, condiciones ni cambios controlados por su cuenta. La interfaz declara expresamente que esa base todavía debe adaptarse y aprobarse; no la presenta como redacción jurídica automática terminada. Si no hay contrato base, muestra un esquema con campos COMPLETAR en lugar de inventar un contrato. Las revisiones documentales tienen una síntesis limitada a seis cuestiones y mantienen el detalle íntegro en el respaldo.

**Guardar documento en Borradores** crea un borrador Core con el texto exacto del editor y un control terminal de todas las salidas que incorpora ese documento como integración humana. Nuevas ediciones usan la versión esperada, conservan las anteriores y controlan la nueva versión. La lista Borradores se actualiza sin remontar el encargo, perder la selección ni reiniciar su confirmación. Recargar recupera el documento guardado. Un borrador antiguo idéntico al registro de discusión permite proponer el documento de trabajo como nueva versión, conservando el anterior; las ediciones humanas distintas se recuperan intactas.

Los resultados históricos y sus hashes originales no se reescribieron. Siguen vigentes las restricciones locales, sin gasto ni despliegue. La redacción sustantiva autónoma por un modelo sigue pendiente; esta entrega agrega una superficie de trabajo real, persistencia y responsabilidad visible, no una acreditación ni un generador jurídico habilitado.

Pruebas específicas: [suite final del documento de trabajo](../../local-browser/reports/document-management/work-product-final-tests.json) y [editor con versión humana guardada](../../local-browser/reports/document-management/03-documento-de-trabajo.png).
