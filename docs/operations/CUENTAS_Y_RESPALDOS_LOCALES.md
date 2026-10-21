# Cuentas, centralización y respaldos locales

## Arranque local

Abrir **Iniciar LAW ORDER OS.bat**. El lanzador reutiliza el servidor existente
cuando su API está disponible; en un inicio nuevo abre el navegador después de
que PostgreSQL y la plataforma estén listos.

La disponibilidad de la base se comprueba con una conexión autenticada y una
consulta SQL. El puerto TCP puede estar abierto durante la recuperación de
PostgreSQL. Un error transitorio de inicialización libera los recursos de ese
intento y permite reintentar en el mismo servidor. La interfaz ofrece
**Reintentar conexión** para recuperar una pestaña que hubiera mostrado el error.

Corrección del 19 de octubre de 2026: espera de SQL real, recuperación del primer
rechazo `57P03`, comprobación de API en el lanzador y apertura diferida del
navegador. Se verificó la pantalla de ingreso y la conservación por hash de los
datos existentes. Las pruebas usan una base aislada y no detienen PostgreSQL
de la instalación activa.

## Primera activación

1. Abrir `http://127.0.0.1:4313` en el navegador que contiene la cartera actual.
2. Ir a **Administración → Configurar mi cuenta y centralizar**.
3. Indicar nombre, correo y una contraseña propia de al menos 12 caracteres.
4. Activar e ingresar con esa cuenta. La contraseña se ingresa únicamente en el OS.

El servidor verifica originales y manifiestos antes de aceptar la migración. Se
guarda una copia del estado anterior en `.local-dev/backups/activation-…/browser-original.json`.
El almacenamiento anterior del navegador queda intacto. La migración conserva
IDs, originales, autores, revisiones y encargos; añade una cuenta titular con
administración y acceso a los asuntos importados. Las asignaciones históricas a
perfiles de prueba pueden reasignarse desde el asunto, sin alterar su historia.

Hasta activar, el modo anterior sigue disponible. La cartera del navegador entra
en los respaldos PostgreSQL **después de la activación**. Antes, el respaldo de
base incluye el editor compartido y sus trabajos ya guardados en el servidor.

## Incorporar personas

En Administración, desplegar **Personas e invitaciones**, elegir el estudio,
correo y rol, y crear el enlace. No se envían correos automáticamente. La invitación
vence en 48 horas y es de un solo uso. La persona crea su contraseña al aceptarla;
si ya tiene cuenta, demuestra su titularidad con su contraseña actual.

La pertenencia al estudio no concede acceso automático a los asuntos. Usar
**Personas y permisos** dentro del asunto para conceder o retirar permisos. El
servidor los comprueba en cada operación y en la conexión del editor; una retirada
bloquea también una sesión que estaba abierta. Compartir un enlace de solo lectura
limita ese enlace; no elimina permisos previos de la persona sobre el asunto.
Retirar enlaces del editor revoca sus tokens; retirar el acceso al asunto se hace
en Personas y permisos.

Las cuentas sin permiso para consultar la cartera no reciben esa cartera en la
caché del navegador. Si pueden leer un asunto, sus referencias de cliente y
contacto aparecen reservadas cuando corresponde. Quien sólo tiene lectura puede
abrir un documento compartido existente sin recibir edición.

Las cookies de sesión son HttpOnly y duran ocho horas, con actualización durante
el uso. Se puede cambiar la contraseña desde Administración y cerrar las demás
sesiones. Los perfiles de prueba quedan como referencias históricas, no como
cuentas que permitan iniciar sesión después de activar.

Esta entrega escucha únicamente en `127.0.0.1`: distintos navegadores de la misma
computadora comparten la base. Acceso desde otras computadoras requiere una etapa
posterior de red local, HTTPS y configuración explícita.

## Respaldo y prueba de recuperación

En Administración, desplegar **Respaldos y recuperación**:

- **Respaldar ahora** crea un volcado PostgreSQL consistente, copia los objetos
  inmutables del editor y la configuración de base/autenticación, y verifica SHA-256.
- **Comprobar** restaura en una base temporal nueva y compara todas las tablas
  privadas y de autenticación, sus cantidades y contenido. Comprueba los archivos
  y la secuencia del registro de accesos. No sustituye la base activa.
- El servidor crea un respaldo al activar y comprueba cada hora si corresponde
  otro por haber transcurrido 24 horas. Requiere que el servidor esté encendido.
  Un error se muestra en Administración. No se borran respaldos automáticamente.

Las carpetas completas quedan en `.local-dev/backups/platform-…`. Incluyen datos
confidenciales, credenciales de la base y el secreto de sesión: mantenerlas privadas.
Para cubrir una falla del disco, copiar la carpeta completa a otro dispositivo.
Los cambios aún no confirmados por el servidor no forman parte del volcado.
La configuración de proveedores IA en `.env`, el corpus descargado y los archivos
históricos de la junta en `.board-data` tienen su propio respaldo de archivos;
este paquete respalda la base central, objetos del editor y su configuración.

También hay una herramienta local para el operador:

```powershell
node scripts/platform-admin.mjs backup
node scripts/platform-admin.mjs verify ID_DEL_RESPALDO
node scripts/platform-admin.mjs restore-check ID_DEL_RESPALDO
```

Para una recuperación operativa: conservar primero la instalación dañada y una
copia de sus archivos, probar el respaldo en una base separada y sólo después
planificar el cambio de base y objetos con el servidor detenido. La herramienta
de comprobación elimina únicamente su base temporal generada. No hay un botón
que sobreescriba silenciosamente la base en uso.

## Alcance técnico de esta transición

Los comandos existentes del Core se ejecutan en el servidor bajo la cuenta de la
sesión. El estado íntegro se guarda como JSONB transaccional en PostgreSQL para
preservar pilotos y auditorías. El editor conserva sus tablas Yjs, versiones,
comentarios y trabajos. Los checkpoints se reflejan en el Core central. Las
lecturas con la misma revisión evitan volver a descargar todo el estado.

La cartera comparte un bloqueo transaccional durante cada comando; la escritura
en vivo del editor usa su almacenamiento independiente. Normalizar más tablas y
optimizar grandes carteras es trabajo posterior. Las conversaciones efímeras del
Gabriel flotante y las preferencias de pantalla mantienen su almacenamiento
actual. Los informes antiguos de junta, anteriores al control de pertenencia por
caso, quedan restringidos a la cuenta titular. Jev a la salida sigue desactivado.

## Dirección y Abogados — etapa 2.1

El rol de la cuenta se muestra junto a su nombre. Hay dos roles operativos por
estudio: **Director del despacho** y **Abogado**. Dirección supervisa los asuntos
de su estudio y distribuye el trabajo. El responsable de un asunto no adquiere
el rol de Director por esa asignación.

- **Dashboard → Organizar equipo** o **Agenda → Equipo**: asignar/reasignar,
  filtrar por abogado/asunto/estado/fecha y atender solicitudes. Los detalles de
  cada tarea muestran quién encargó el trabajo, su historial y avances/bloqueos.
- **Agenda → Mi trabajo** y **Mi día**: el abogado recibe sus encargos, registra
  avances y completa tareas propias. Puede organizar tareas para sí mismo; no
  puede delegar ni cancelar unilateralmente un encargo recibido de Dirección.
- **Solicitar a Dirección**: pedir apoyo. Desde una tarea recibida puede
  solicitar reprogramación; desde Borradores, **Solicitar revisión** registra una
  petición sobre esa versión. Dirección decide el revisor humano. Resolver una
  solicitud de reprogramación requiere cambiar antes la tarea o el plazo real.
- **Administración → Personas e invitaciones**: Dirección genera un enlace para
  copiar a un abogado o a otro Director. La invitación tiene un solo uso y vence;
  el nuevo usuario elige su contraseña. No se envían correos automáticamente.
- **Personas y permisos**, dentro del asunto: Dirección concede o revoca acceso.
  Un permiso de edición o colaboración no permite al abogado administrar colegas.

Gabriel puede gestionar el trabajo desde su conversación por texto, por voz y
desde el chat del documento. Ejemplos: «mostrame el trabajo de Ana», «asignale a
Ana la revisión de este contrato», «registrá que me falta el antecedente» o
«pedí apoyo a Dirección». Obtiene las personas, asuntos y versiones reales con
herramientas y ejecuta bajo la sesión conectada. Un abogado conserva sus permisos
al hablar con Gabriel; el nombre del asistente no concede permisos de Dirección.
Las revisiones humanas formales usan la herramienta de versión exacta. Las
fechas internas simples no sustituyen el registro y confirmación de un plazo
judicial con origen, calendario y motivo.

La actualización crea un respaldo antes de migrar `hierarchy_version=1` y
conserva IDs, responsables históricos, originales, versiones, autores y cuentas.
Agrega el asignante a tareas antiguas a partir de su actividad conservada o,
cuando falta, del responsable histórico; esto no convierte ese registro en una
prueba de identidad autenticada anterior. El código almacenado `ADMINISTRATOR`
continúa por compatibilidad y su nombre visible es Director del despacho.

La titularidad técnica de la instalación se conserva para respaldos y
recuperación; no constituye un tercer rol de trabajo. La instalación continúa
en `127.0.0.1:4313`. La entrega 2.2 incorpora respaldo integral de Biblioteca,
recuperación de cuentas, configuración HTTPS local y copia externa verificable.
El titular difirió la prueba física del disco externo y de otra computadora.
Ver [Gestión profesional local](GESTION_PROFESIONAL_LOCAL.md) para el uso y
alcance de estas funciones y de las etapas 3, 4 y 5.
