# Especialistas conectados al workspace

Implementación local experimental del 18/10/2026, autorizada por el propietario. No acredita calidad jurídica ni superioridad frente a un generalista.

El flujo LIVE del workspace conserva Gabriel como interlocutor. Los nuevos trabajos se normalizan al runtime conversacional v4. El host impide asignar análisis/redacción a Gabriel; Santiago revisa y no redacta contratos. Los trabajos históricos se conservan sin regeneración ni etiquetas nuevas.

## Paquetes y herramientas efectivos

`scripts/workspace-specialists.mjs` carga los 22 paquetes existentes, valida su correspondencia con las seis personas y entrega requisitos, procedimiento, fuentes requeridas, columnas de trabajo, límites y escalaciones al modelo. Gabriel recibe el catálogo de subperfiles y puede elegir `pack_id`; null conserva el paquete base para compatibilidad. Un paquete de otra persona es rechazado como feedback, sin ejecutar ese encargo. Cada intervención guarda persona, paquete, versión, hash canónico, modelo, herramientas ejecutadas e inventario de evidencia.

Herramientas implementadas: inventario con hashes/versiones, índice de pasajes con offsets exactos y sin recortar el texto original, extracción literal de menciones de fechas/importes y comparación textual de dos documentos elegidos dentro del snapshot. Los demás `tool_specs` siguen siendo especificaciones; no se habilitaron calculadoras jurídicas, impuestos, indemnizaciones ni escrituras externas. Las instrucciones prohíben simular su ejecución.

Las nuevas consultas de especialistas pueden recuperar Biblioteca por la cuestión y el perfil, incluso cuando ya existe un análisis previo. Redactar sobre hallazgos puede reutilizar sus fuentes. La unión de fuentes conserva pasajes y rechaza conflictos de versiones. Recuperar una fuente no acredita identidad, vigencia ni pertinencia.

## Controles y continuidad

Cada aporte nuevo del runtime LIVE pasa por una llamada independiente de Luna como Santiago. También se revisan integración, propuesta y respuesta final de Gabriel. Un error material permite una corrección acotada y nueva revisión dentro del mismo presupuesto; no se reintenta una llamada cuyo resultado de transporte sea desconocido. Si el error permanece, el estado es CHANGES_REQUIRED y la interfaz bloquea aplicar esa propuesta. El texto queda revisable y editable manualmente; no se cambia el original automáticamente.

El control terminal reúne análisis, aportes, pasos de integración, texto propuesto, respuesta final y salida del auditor. Comprueba citas estructuradas, anclajes documentales y referencias bibliográficas detectables por la gramática existente, con sus límites. Un manifiesto de hashes canónicos vincula el control con los outputs exactos y se valida antes de completar el trabajo. Una falla de auditoría conserva avances sin presentarlos como controlados.

Las referencias al propio documento se cotejan contra el párrafo exacto generado por el índice documental; no requieren figurar en Biblioteca. Las objeciones cuyo localizador no coincide se conservan como pendientes sin interrumpir toda la conversación. Una narración final sin objeciones nuevas no elimina los controles materiales pendientes de los aportes que entrega.

CONTROLLED_DRAFT significa revisión IA realizada sin problemas materiales detectados en ese alcance. REVIEW_REQUIRED conserva faltantes/referencias pendientes. Ninguno equivale a fuentes autenticadas, vigencia acreditada ni ausencia de alucinaciones. Esos estados se muestran junto al documento y en la conversación.

## Modelos y alcance

Gabriel, los seis especialistas y Santiago usan `gpt-6-luna` en este runtime. No hay escalamiento a Sol, cambio de credenciales ni aumento del techo compartido de USD 0,60 por mensaje. El motor de Junta legal completa separado conserva Sol 6.1 en su etapa central. Jev de salida permanece desactivado. Esta entrega no convierte el asistente flotante en operador de todas las funciones administrativas del OS ni reemplaza el motor histórico de investigación.

## Evidencia de evaluación

Las pruebas automatizadas comprueban carga de los 22 paquetes, separación de roles, herramientas documentales, selección/errores de alcance, preservación de fuentes, controles sobre texto del auditor, reparación acotada, hashes resistentes al orden de JSONB, límite compartido y preservación de resultados. El recorrido de navegador/HTTP/PostgreSQL verifica persistencia y bloqueo de aplicación cuando quedan errores materiales, además de edición compartida y deshacer.

Estas son pruebas funcionales y controles de regresión. La comparación jurídica ciega con un generalista, sobre casos reservados y revisión de abogados competentes, sigue NOT_ACCREDITED. No se alteró ese estado para presentar la integración técnica como validación jurídica.

## Corrección de persistencia Unicode

La prueba completa detectó que la base local heredaba WIN1252 de Windows. PostgreSQL rechazaba texto Unicode de una fuente con 22P05, aunque el JSON fuera válido. Las bases nuevas y las de pruebas ahora se crean con template0/UTF8 explícitos.

`scripts/local-database-utf8.mjs` es una operación explícita de mantenimiento, no una migración automática al arrancar. Requiere el servidor local detenido, cero trabajos RUNNING y clientes oficiales `pg_dump`/`pg_restore` en `.local-dev/postgres-client/pgsql/bin` (o directorio pasado como argumento). Exporta en UTF-8, crea otra base, restaura roles/permisos del dump, compara hashes canónicos de todos los registros por tabla y estados de secuencias, prueba escritura Unicode y solo entonces cambia ambas URL de la configuración. Conserva la base anterior, el dump, el inventario de cotejo y la configuración previa en `.local-dev/backups/`. No modifica originales ni borra bases. Para revertir, detener la aplicación y restaurar la configuración respaldada; las escrituras posteriores en la copia requieren conciliación antes de volver a la base anterior.

En esta instalación se cotejaron 28 tablas y 116 registros antes de cambiar la conexión. El respaldo quedó en `.local-dev/backups/utf8-20261018224440805_1de31c`. No se suben datos ni credenciales a GitHub. La prueba aislada comprueba preservación, secuencias, Unicode y rechazo de clientes activos.

Referencias de mantenimiento: [pg_dump y codificación de exportación](https://www.postgresql.org/docs/18/app-pgdump.html), [binarios oficiales para Windows](https://www.postgresql.org/download/windows/).
