# Workspace: editor colaborativo y guardado local

17 de octubre de 2026. Primer incremento del plan ajustado aprobado. Entorno local, sin inferencias pagas ni despliegues. Jev a la salida sigue fuera del circuito.

**Actualización posterior:** el procesador de pantalla completa, agentes integrados, comentarios y exportación Word se documentan en [WORKSPACE_WORD_LOCAL.md](WORKSPACE_WORD_LOCAL.md). El detalle siguiente registra el primer incremento.

## Uso

Abrí el OS con `Iniciar LAW ORDER OS.bat` en el origen habitual `http://127.0.0.1:4313`. Dentro de Clientes → Asunto, Workspace es la primera pestaña y el destino de Abrir asunto.

Creá un documento con nombre o elegí un borrador existente. La primera apertura incorpora su texto al editor compartido conservando estudio, cliente, asunto, documento, borrador y versión original. Los adjuntos siguen en Documentos; las demás pestañas siguen disponibles durante la transición.

Corrección de acceso tras revisión del propietario: el workspace abre directamente una hoja editable, con documentos a la izquierda y accesos a consulta, archivos y revisión a la derecha. No exige pasar por un formulario para empezar a escribir. El primer guardado conserva también el formato escrito en esa hoja y habilita la colaboración. La recuperación del documento todavía no creado se conserva en la pestaña; el indicador distingue ese estado del guardado en servidor. Al volver a un asunto se abre su último documento, salvo que exista una redacción nueva pendiente. El botón principal Nuevo documento dirige a esta hoja, en lugar de al formulario antiguo. Los accesos del lateral abren las funciones existentes; no equivalen todavía a asistencia de especialistas dentro del editor.

El editor permite títulos, párrafos, negrita, cursiva, listas, tablas y deshacer/rehacer de la sesión. Su barra es compacta y reutiliza los botones de tinta del OS. No ofrece importación fiel de Word, plantillas, comentarios ni cambios propuestos todavía.

Los cambios se guardan automáticamente en PostgreSQL. **Guardado en servidor local** aparece después de confirmar la transacción, incluyendo inserciones y borrados. Sin conexión, el documento abierto sigue editable y mantiene una recuperación en IndexedDB. Al reconectar, recupera los cambios y espera una nueva confirmación. Registrar versión permanece deshabilitado mientras falte guardado, conexión o permiso.

**Registrar versión** crea un snapshot inmutable del documento estructurado y una versión de texto en el Core, dentro de una transacción idempotente. No aprueba el contenido. **Historial → Ver versión** abre el contenido registrado en modo de lectura. El texto del checkpoint se copia al borrador del mismo navegador si su versión base sigue vigente; una edición concurrente del formulario antiguo se conserva y se informa el conflicto.

**Compartir**, disponible a quien administra el asunto, emite un enlace de edición o solo lectura para el otro perfil local. Se abre en otra pestaña o navegador de la misma computadora; `127.0.0.1` no permite colaborar desde otra computadora. Vence en 12 horas. Retirar acceso revoca los enlaces de ese colaborador para el documento y corta sus conexiones activas. Los tokens no se imprimen en logs y se guardan con hash en la base.

## Persistencia y compatibilidad

Se reutiliza el PostgreSQL portátil existente en `127.0.0.1:55432`. El host local lo inicia al abrir el primer workspace si está detenido. No instala un servicio de Windows ni sustituye la API/Supabase del modo servidor.

La migración es aditiva en `os_private`: documento colaborativo, registro de escrituras, checkpoints y permisos de enlace. El estado Yjs y JSON es canónico en PostgreSQL; no depende de mantener abierta una pestaña. Los blobs del documento adoptado y los checkpoints usan `.local-dev/workspace-objects`. La base permanece en `.local-dev/postgres`. La recuperación del editor usa la base IndexedDB separada `law-order-os.workspace-recovery.v1`.

La gestión actual del OS permanece en su almacenamiento del navegador. Se incorpora explícitamente un borrador por apertura; no se migra silenciosamente todo el expediente. Las incorporaciones no reemplazan registros preexistentes del servidor y rechazan diferencias de ámbito o versiones incompatibles. Los originales PDF, DOCX y TXT del asunto no se reescriben. Una versión antigua del propio workspace se reconoce al reabrir; una bifurcación del editor antiguo se señala para revisión.

**Exportar respaldo** del menú actual conserva la gestión del navegador; no constituye un respaldo de PostgreSQL ni del documento estructurado. Para respaldo integral hay que conservar también la base local y sus objetos mediante un respaldo consistente de PostgreSQL. No borrar `.local-dev` para “limpiar” el OS. Antes del cambio se conservaron 102 archivos fuente/configuración en `.local-dev/workspace-baseline-2026-10-17T02-27-16-813Z`, con hashes y sin secretos.

## Identidad y revisión

Se mantienen los dos perfiles de prueba del prototipo. **No hay autenticación humana verificada** en este incremento; el nombre del cursor identifica un perfil sintético. Los enlaces locales no convierten esa selección en una identidad real. El modo servidor y Supabase no se reemplazan por una autenticación ficticia.

Cada acceso HTTP y socket comprueba permiso del enlace y ámbito de estudio/asunto/documento. PostgreSQL mantiene RLS y las reglas del Core. El guardado vuelve a comprobar la vigencia dentro de la transacción; revocación y escritura se ordenan con el bloqueo existente del Core.

Los checkpoints acumulan los perfiles que contribuyeron al documento. Autor y coautores no pueden revisar/aprobar su propio trabajo; el Core y un trigger local bloquean la operación. Las aprobaciones históricas de versiones anteriores se conservan. Con solo dos perfiles, si ambos escriben se necesita un revisor independiente para una aprobación posterior; habilitar identidades humanas y más colaboradores forma parte de la continuación del plan.

## Evidencia y pendientes

Prueba reproducible: `npm.cmd run os:test -- f1-f4/tests/workspace.test.ts`. Usa Edge headless en contextos aislados, la interfaz construida, HTTP/WebSocket reales y una base PostgreSQL temporal; no accede al perfil del navegador del propietario. Cubre creación desde cliente/asunto, edición simultánea, eliminación, formato, tablas, confirmación durable, historial, reinicio, recuperación offline, idempotencia, versiones originales y límites de acceso. Los artefactos están en `local-browser/reports/workspace-local/`.

También se ejecutaron las 42 pruebas del Core, 14 de PostgreSQL/seguridad y 13 de almacenamiento/modelo del navegador. Dos recorridos antiguos de adjuntos fallan antes de cargar archivos porque buscan `Describí tu encargo sintético` en el Dashboard, retirado previamente al trasladar la consulta a Gabriel. El Dashboard coincide con el respaldo anterior a esta implementación. El nuevo recorrido incorpora PDF/DOCX/TXT desde Documentos y compara sus bytes después de editar/reabrir el workspace. No se declara verde toda la suite histórica.

TypeScript y compilaciones web/API se verifican por separado. El editor se carga bajo demanda; su bundle todavía supera la advertencia de 500 kB sin comprimir de Vite. Las 70 dependencias incorporadas/cambiadas constan con versión fija y licencia MIT en `WORKSPACE_DEPENDENCIES.json`; sus avisos están en `THIRD_PARTY_WORKSPACE_NOTICES.txt`.

Continúan pendientes autenticación humana compartida, comentarios anclados, propuestas y comparación, fuentes/controles, especialistas dentro del editor, plantillas y formatos de intercambio. El incremento no acredita verificación jurídica ni contraste semántico. Las etapas del plan y la evaluación de Jev se conservan.
