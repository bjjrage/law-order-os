# Plazos, responsables y avisos locales

## Uso

1. Abrir un asunto. Si se abre el editor, usar **Volver al asunto**.
2. Abrir **Tareas → Nueva tarea o plazo**. Para una tarea sin fecha ni avisos,
   desmarcar **Registrar plazo con avisos**.
3. Elegir responsable, categoría (judicial, contractual o interna) y origen.
   Se puede vincular una versión de un documento del mismo asunto. La versión
   queda fija aunque después se publique otra; se descarga desde el detalle.
4. Indicar una fecha expresa, o contar días desde una fecha inicial. Para el
   cómputo indicar cantidad, inclusión/exclusión del día inicial, días corridos
   o lunes a viernes, fechas excluidas y fundamento del calendario.
5. Revisar la vista previa. Indicar recordatorios en horas y, opcionalmente, otra
   persona que recibirá el escalamiento si la tarea continúa pendiente después
   del vencimiento y del margen indicado.
6. Guardar. El plazo aparece en **Plazos por confirmar**, no como un vencimiento
   confirmado. Desplegar su detalle, revisar origen/calendario/vencimiento y
   marcar la revisión para **Confirmar plazo y activar avisos**.

La confirmación requiere rol de abogado, coordinador o administrador y permiso
TASK_WRITE sobre el asunto. Un asistente puede proponer el plazo pero no confirmar.
El responsable debe poder gestionar tareas; el destinatario de escalamiento debe
poder leer ese asunto. No se conceden permisos por asignar un plazo.
En la instalación central, los perfiles de prueba históricos se conservan como
autores, pero no se ofrecen como responsables ni destinatarios de plazos nuevos.

## Avisos y entrega

- **Mi día** y **Agenda** tienen una bandeja compacta de avisos. Muestra
  recordatorios, vencimientos y escalamientos dirigidos a la persona conectada.
- Los recordatorios se configuran como horas antes de vencer. Si se retoma la
  operación tarde, se genera el recordatorio pertinente más cercano; después de
  vencer se genera el aviso de vencimiento, sin una avalancha de avisos antiguos.
- **Reconocer aviso** registra su recepción, no completa la tarea ni evita el
  escalamiento. **Completar** usa el estado de tarea existente.
- El detalle del plazo conserva generación, entrega en bandeja, reconocimiento,
  bloqueo por falta de acceso y versiones anteriores. “Entregado en bandeja”
  significa que la consulta de la bandeja autenticada devolvió ese aviso, no que
  el humano lo haya leído. El reconocimiento es una acción separada.
- Se revalidan membresía y acceso antes de entregar. Si se retiró acceso, no se
  muestra el caso al destinatario; el programador registra el bloqueo. Si se
  restituye el acceso mientras el aviso corresponde, se registra su liberación.
- Las alertas de una revisión anterior no se presentan como avisos del plazo
  vigente. Completar o cancelar deja de generar avisos y conserva el registro.

Con **cuentas y centralización activadas**, el servidor revisa cada minuto y
guarda los avisos en PostgreSQL aunque no haya navegador abierto. La bandeja se
actualiza cada treinta segundos mientras está visible y al volver a la ventana.
Después de reiniciar se recuperan avisos pendientes y escalamientos vencidos, sin
duplicar registros de una misma revisión/destinatario/umbral.

En el modo anterior de prueba, con datos del navegador, los avisos se evalúan al
abrir Mi día o Agenda. El servidor no puede vigilar una cartera que aún no se
migró. Activar la etapa 1 desde Administración para el funcionamiento central.

Esta entrega usa avisos dentro del OS. No envía correo, SMS, WhatsApp ni
notificaciones del sistema operativo. El servidor local debe estar encendido;
no se promete entrega a una hora exacta si la computadora está apagada.

## Cambios y preservación

**Modificar plazo / responsable** conserva la versión anterior y exige motivo.
La nueva revisión queda sin confirmar; sus avisos requieren otra confirmación.
Las operaciones comprueban la revisión esperada para rechazar una pantalla vieja.
Las tareas y revisiones humanas anteriores conservan su comportamiento y sus IDs.
No se convierten automáticamente fechas internas antiguas en plazos legales.

Las revisiones del plazo y los avisos se guardan junto a la tarea en el Core
central, con actividades de creación, modificación, confirmación y reconocimiento.
Por estar en PostgreSQL, entran en el respaldo central y su restauración aislada.
Los archivos de respaldo referenciados siguen conservando su versión original.

## Calendario

El cálculo es aritmética sobre el calendario declarado, no interpretación de
derecho procesal. No se presume jurisdicción, feria, feriados, suspensión,
prórroga, hora de cierre ni regla legal aplicable. Esos datos deben declararse y
ser revisados por el profesional. El sistema no descarga un calendario judicial
ni certifica un vencimiento por contar días. La zona horaria guardada es
America/Asuncion; el navegador puede estar en otra zona sin cambiar el resultado.

No se modificaron Gabriel, los modelos de especialistas ni Jev a la salida.
