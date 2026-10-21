# Plan de trabajo del OS jurídico con Dirección y Abogados

El despacho tendrá dos roles humanos: **Director del despacho** y **Abogado**.
Dirección distribuye y supervisa el trabajo; cada abogado ejecuta sus tareas y
puede organizar tareas propias. Un abogado no puede asignar ni reasignar trabajo
a otro humano. Gabriel opera con los permisos de la persona que conversa con él.

Se conservan los asuntos, documentos, edición compartida, especialistas, plazos,
historial y autenticación existentes. La infraestructura continúa en local y la
navegación principal se mantiene compacta.

La entrega **2.1: Dirección y Abogados** integra los dos roles operativos, la
supervisión del equipo y las herramientas de Gabriel. La activación local se
realiza con respaldo previo, conservando las cuentas y los datos existentes.

| Etapa | Estado | Entrega | Criterio de salida |
| --- | --- | --- | --- |
| 1 | Base implementada y activada | Cuentas, permisos, datos centrales y respaldo PostgreSQL/editor | Dos usuarios autenticados colaboran; denegaciones y restauración aislada verificadas |
| 2 | Integrada con la jerarquía 2.1 | Plazos, responsables y avisos | Origen/cálculo revisable, confirmación y registro de avisos/escalamiento |
| 2.1 | Implementada y activada en local | Dos roles, asignación por Dirección, vista de equipo y Gabriel con los mismos permisos | Director asigna; abogado recibe y ejecuta; intentos de delegación no autorizada se rechazan en todas las rutas |
| 2.2 | Implementada; pruebas físicas de disco externo y segunda computadora diferidas por el titular | Respaldo integral, recuperación de cuentas, HTTPS local y copia externa configurable | Restauración aislada y prueba TLS automatizada; falta el ensayo físico autorizado para después |
| 3 | Implementada | Admisión, conflictos, honorarios, gastos y cobros | Aceptación, presupuesto, comprobantes internos, registro fiscal externo, pagos y permisos |
| 4 | Implementada | Plantillas y portal del cliente | Plantilla aprobada al editor; cliente limitado a versiones publicadas y enlace revocable |
| 5 | Implementada | Comunicaciones, actas e indicadores | Audio con consentimiento, transcripción y acta propuestas, revisión y asignación por Dirección |

## Decisiones de la etapa 1

- Conservar el Core y sus reglas: ejecutar los comandos existentes en el servidor,
  identificando al actor por sesión, nunca por un selector enviado por el navegador.
- Better Auth con PostgreSQL local para cuentas y sesiones. Sin registro público ni
  envío de correo; invitaciones por enlace de un solo uso, con vencimiento.
- Conservar el formato íntegro del estado existente en PostgreSQL para evitar
  perder los pilotos, encargos y auditorías históricas durante esta transición.
  El servidor es la autoridad; el navegador conserva una caché de lectura de lo
  autorizado. El editor continúa usando sus documentos compartidos en PostgreSQL.
- Los dos perfiles de prueba se conservan como autores históricos. La cuenta que
  activa la instalación recibe administración de los estudios migrados; no se
  reescriben los autores, aprobaciones, IDs, hashes ni originales anteriores.
- Activación dentro de Administración: cuenta del titular y migración del estado
  del navegador. No inventar contraseñas ni activar una instalación sin titular.
  La copia anterior del navegador permanece disponible para recuperación.
- Mantener todo en loopback. Esta entrega no publica el servidor en Internet ni
  configura acceso desde otras computadoras.
- Respaldar la base completa, objetos inmutables y configuración necesaria,
  mediante manifiesto SHA-256. Restaurar primero en una base nueva; nunca reemplazar
  la base activa como parte de una verificación.
- Incorporar las acciones de cuentas y respaldos en Administración. No agregar
  módulos al menú. Conservar Gabriel, especialistas, editor y revisiones.

## Compatibilidad y límites

Los cambios de voz existentes antes de esta tarea son trabajo independiente y no
se reemplazan. La autenticación previa de Supabase queda disponible para su modo
original; esta etapa usa identidad local autocontenida. El historial antiguo no
se transforma retroactivamente en evidencia de identidad autenticada.

La evaluación jurídica de los agentes y la determinación automática de reglas
procesales no se amplían en esta entrega. La emisión fiscal electrónica y la
publicación en Internet requieren entregas específicas. El portal local se
incorpora en la etapa 4. Jev a la salida permanece desactivado.

## Entrega y activación

La etapa 1 queda implementada como una transición explícita, con su operación
descrita en [Cuentas y respaldos locales](CUENTAS_Y_RESPALDOS_LOCALES.md). Para
activar los datos reales el titular ingresa su nombre, correo y
contraseña en Administración. Al comprobar la instalación el 18 de octubre de
2026, la centralización ya estaba activada. No se inventó una cuenta ni se modificó el estado
del navegador del titular desde las pruebas.

Se probó con datos sintéticos la activación desde la interfaz, dos cuentas Better
Auth distintas, edición simultánea, checkpoint central, permisos y su retirada,
preservación de originales, reinicio de autenticación y restauración aislada del
respaldo. También se creó y restauró aisladamente un respaldo de la base local
actual. Las pruebas de esta entrega no llaman a proveedores de IA.

La comprobación principal está en `f1-f4/tests/local-platform.test.ts`; el recorrido
previo del editor y audio humano está en `f1-f4/tests/workspace.test.ts`. La
compilación de API/web y el chequeo TypeScript forman parte del cierre. Las suites
generales antiguas contienen recorridos de interfaz que ya no coinciden con el
producto: campo de encargo sintético retirado, botones duplicados de alta y una
guía que antes era desplegable. El ensayo de navegador del modo Supabase requiere
su propia compilación de servidor. No se consideran aprobadas esas suites
completas por el hecho de pasar la nueva integración local.

Antes de habilitar trabajo fuera de esta computadora, completar el trabajo de
infraestructura originalmente llamado etapa 1.1, incorporado ahora a la etapa 2.2:
acceso por HTTPS, política de recuperación de cuentas, respaldo fuera del disco
y prueba operativa de recuperación. El menú puede mantenerse sin cambios: estas
opciones continúan dentro de Administración.

## Etapa 2: plazos, responsables y avisos

Implementación aditiva dentro de Tareas, Agenda y Mi día, sin nuevos módulos en
el menú. Detalle operativo en [Plazos y avisos locales](PLAZOS_Y_AVISOS_LOCALES.md).

- Origen y versión documental vinculada; fecha expresa o cómputo por calendario
  declarado, con vista previa, fundamento y exclusiones explícitas.
- Separación de plazos por confirmar y confirmados. Un profesional con permisos
  revisa el cálculo antes de activar avisos. No se presumen reglas procesales.
- Reasignación y recálculo con motivo, revisión esperada e historial preservado;
  una nueva revisión requiere confirmación nueva.
- Bandeja personal, reconocimiento, vencimiento y escalamiento configurable.
  Registros persistentes de generación/entrega y bloqueos de acceso; recuperación
  después de reinicios y deduplicación.
- Programador cada minuto en el servidor central activado. El modo de prueba
  anterior evalúa al abrir la bandeja; no simula vigilancia del servidor sobre
  datos que continúan exclusivamente en el navegador.

La entrega inicial de la etapa 2 no incluía las etapas 3, 4 y 5 ni el respaldo
integral de Biblioteca. Se incorporan ahora como se detalla al final de este plan
y en [Gestión profesional local](GESTION_PROFESIONAL_LOCAL.md).

Validación de la etapa 2: siete pruebas de cómputo, confirmación, permisos,
historial, origen documental y persistencia del programador; dos pruebas de la
plataforma (incluido el recorrido con dos cuentas reales, creación/confirmación,
descarga de respaldo, reconocimiento y escalamiento, editor y restauración);
trece pruebas de almacenamiento y agenda previas. Compilación API/web y chequeo
TypeScript aprobados. Las suites completas antiguas mantienen las limitaciones
de interfaz documentadas arriba; no se declaran aprobadas por estas comprobaciones.

## Etapa 2.1 Dirección del despacho y equipo de abogados

### Reglas de trabajo

El rol pertenece al estudio. El responsable de un asunto y el responsable de una
tarea son asignaciones de trabajo: no crean otra jerarquía ni habilitan a un
abogado a dirigir a sus colegas.

| Operación | Director del despacho | Abogado |
| --- | --- | --- |
| Consultar la gestión del estudio | Cartera y equipo de su estudio | Asuntos autorizados y trabajo propio |
| Crear una tarea propia | Sí | Sí, dentro de sus asuntos |
| Asignar una tarea a otro humano | Sí | No |
| Reasignar trabajo entre humanos | Sí | No |
| Registrar avances y completar | Puede intervenir y supervisar | Sus propias tareas |
| Pedir intervención de otro abogado | Asigna al destinatario | Solicita intervención a Dirección |
| Confirmar un cálculo de plazo | Sí, con registro de revisión | En su trabajo autorizado, con registro de revisión |
| Trabajar con documentos y agentes IA | Sí | Dentro de sus asuntos y permisos |
| Administrar personas y accesos | Sí | No |

Los permisos documentales de lectura, edición y revisión siguen siendo controles
del asunto. La colaboración en un documento no concede autoridad para delegar
tareas. Dirección tiene supervisión de los asuntos de su propio estudio; esa
autoridad no se extiende a otros estudios ni a enlaces externos.

Para las tareas encargadas por Dirección, el abogado podrá informar bloqueos y
solicitar reprogramación. El ajuste del encargo o la reasignación quedará
registrado por Dirección. Las tareas propias podrán organizarse sin cambiar su
responsable a otra persona. La revisión jurídica de un plazo permanece explícita.

### Bloque A Roles y conservación de datos

1. Inventariar cuentas reales, roles activos, permisos, asuntos y tareas. Crear un
   respaldo recuperable antes de aplicar la migración al estudio en uso.
2. Establecer los dos roles operativos en servidor, invitaciones, sesiones e
   interfaz. La cuenta titular actual conserva Dirección. Las cuentas de abogados
   se mantienen como Abogado; cualquier otro rol activo anterior debe tener una
   correspondencia resuelta antes de activar el cambio, sin promociones implícitas.
3. Conservar IDs, documentos, autores, responsables anteriores, auditorías y
   versiones. Los perfiles de prueba siguen siendo referencias históricas.
4. Eliminar los roles anteriores de las nuevas altas. Impedir que un abogado
   cambie su propio rol, conceda acceso a otros o desactive al último director.

La titularidad técnica de la instalación se conserva para recuperación y
configuración; no se presenta como una tercera jerarquía del despacho.

**Aceptación:** cuentas y sesiones existentes conservadas, dos roles operativos
visibles y ausencia de elevaciones de permisos durante la migración.

### Bloque B Asignación y supervisión en el servidor

1. Aplicar una política común a tareas simples, plazos, reasignaciones, cambios
   de responsable del asunto y solicitudes de revisión documental.
2. Dirección puede asignar a abogados activos con acceso al asunto. El servidor
   rechaza que un Abogado envíe el ID de otro humano como responsable, incluso
   mediante una petición manual o una versión anterior del navegador.
3. Convertir la petición de revisión o ayuda del abogado en una solicitud a
   Dirección. Esa solicitud no crea por sí sola una tarea asignada a otro abogado.
4. Registrar quién encargó, quién ejecuta, qué cambió y cuándo. Conservar las
   revisiones de plazo existentes y requerir confirmación cuando cambia su cálculo.
5. Vincular las alertas de supervisión con Dirección. Los escalamientos de las
   tareas del equipo se muestran allí; reconocer un aviso sigue siendo distinto
   de completar el trabajo.

**Aceptación:** las restricciones se cumplen en interfaz, API, acciones de IA,
reintentos y sesiones anteriores. Ninguna ruta de revisión o automatización crea
una delegación humana que el solicitante no esté autorizado a realizar.

### Bloque C Vista del director y trabajo de cada abogado

1. Adaptar el Dashboard del Director para mostrar trabajo del equipo, vencimientos,
   solicitudes de intervención y revisiones pendientes.
2. Incorporar el selector **Mi trabajo / Equipo** en la gestión existente de
   tareas y Agenda. Dirección abre Equipo por defecto; el abogado dispone de su
   trabajo. Mi día conserva la agenda personal.
3. Permitir filtros por abogado, asunto, fecha y estado, con asignación y
   reasignación desde la misma vista. Mostrar quién encarga y quién es responsable.
4. Dentro del asunto se conserva el contexto del equipo; cada persona ve las
   acciones que puede ejecutar. El abogado responsable del asunto no recibe
   facultades de Dirección por esa asignación.
5. Mostrar el rol de la cuenta claramente. Reutilizar el menú actual y desplegar
   los detalles cuando se necesitan, sin agregar otra barra de navegación.

**Aceptación:** el Director identifica a quién asignar, qué está atrasado y qué
requiere su decisión desde una vista. El abogado identifica sus encargos y sus
próximas acciones sin recorrer la cartera completa.

### Bloque D Gabriel por texto y voz

1. Dar a Gabriel herramientas de lectura de tareas, equipo y avisos autorizados,
   y herramientas de creación/asignación, avance, solicitud y consulta de estado.
2. Usar los mismos comandos de servidor desde chat, voz y botones. El modelo
   interpreta el pedido y conserva el contexto; los permisos se comprueban fuera
   del prompt. No resolver la conversación con un catálogo de frases obligatorias.
3. Un Director podrá pedir «asignale a Ana la revisión de este contrato». Un
   abogado podrá organizar su trabajo o pedir ayuda a Dirección, sin encargar
   unilateralmente trabajo a otro humano.
4. Resolver nombres y asuntos con los datos autorizados. Si existen dos personas
   con el mismo nombre o falta información imprescindible, Gabriel pregunta lo
   mínimo necesario. No inventa destinatarios ni afirma una acción sin su resultado.
5. El trabajo jurídico sustantivo sigue delegado a especialistas y controles
   antialucinación. Asignar una tarea humana no convoca por defecto a la Junta.
   Se mantienen los modelos económicos habituales, el modelo costoso reservado
   a la Junta completa y Jev a la salida desactivado.

**Aceptación:** un pedido equivalente por texto o voz produce el mismo resultado
autorizado y registrado. Gabriel no puede usar la identidad del Director para
ejecutar instrucciones dadas por un abogado.

### Bloque E Prueba completa y puesta en uso

Probar con un Director y dos abogados autenticados: Dirección encarga un trabajo,
el destinatario lo recibe en Mi día, usa el editor y la IA, solicita revisión y
Dirección asigna esa revisión. El vencimiento y su escalamiento quedan registrados.

Comprobar también intentos de asignación por abogados, promoción de rol,
reintentos posteriores a una revocación, aislamiento entre estudios y lectura
mediante enlaces. Las pruebas automáticas usan datos sintéticos y herramientas
simuladas para no enviar expedientes reales ni generar gasto de IA por defecto.

Verificar que siguen funcionando el editor compartido, el historial, los
originales, la voz existente y los respaldos. Publicar el cambio local con una
correspondencia de roles documentada y una vía de recuperación comprobada.

**Cierre de la entrega:** se considera integrada la etapa 2 cuando funcionan
juntos los bloques A a E. Una pantalla nueva o un botón oculto no completan la
separación de responsabilidades.

### Implementación de la etapa 2.1

El código persistido `ADMINISTRATOR` se presenta como **Director del despacho**;
`LAWYER`, como **Abogado**. Se conserva el formato anterior de las membresías para
no reescribir autores ni auditorías. Los códigos históricos restantes no se
ofrecen en nuevas altas. La migración detecta cuentas reales activas con roles
pendientes de correspondencia y se detiene antes de asignarles otra autoridad.
Los alias de prueba no cuentan como directores reales al proteger al último
Director ni son destinatarios válidos de nuevas asignaciones centrales.

La cuenta titular mantiene Dirección. Agenda abre **Equipo** para Dirección y
**Mi trabajo** para abogados, con filtros por persona, asunto, estado y fecha de
Paraguay. Las tareas conservan asignante, responsable e historial; los avances y
bloqueos se registran aparte de la finalización. La ayuda, revisión documental y
reprogramación solicitadas por un abogado ingresan en la bandeja de Dirección.
Las revisiones pendientes pueden reasignarse sin perder su versión documental;
los autores y coautores continúan impedidos de revisar su propio texto.

Gabriel flotante por texto, audio nativo y chat del workspace comparten las
herramientas de gestión y la autorización del Core. Las herramientas no reciben
un actor elegido por el modelo. Las operaciones de voz y texto verifican la
sesión al ejecutar; el workspace también vuelve a verificar el acceso al
documento. Se registran comandos idempotentes, y sus reintentos comprueban los
permisos actuales. La interpretación continúa a cargo del modelo, sin un catálogo
de frases obligatorias. La ejecución jurídica sustantiva conserva especialistas,
controles y presupuesto existentes; Jev a la salida permanece desactivado.

Comprobaciones de esta entrega: siete pruebas de jerarquía/migración y permisos,
siete de plazos, ocho del agente del workspace y dos de plataforma. El recorrido
de plataforma utiliza tres cuentas Better Auth aisladas e incluye asignación,
bloqueo, solicitud de apoyo y revisión, recepción en Mi día, editor compartido,
versiones y restauración. Otras 32 pruebas cubren almacenamiento/agenda,
conversación, herramientas de gestión y voz con transporte de proveedor
simulado. No se enviaron expedientes reales ni se generaron llamadas de IA
pagas para estas pruebas. TypeScript y compilaciones API/web forman parte del
cierre operativo. Las limitaciones de suites antiguas se mantienen documentadas.

Activación comprobada el 19 de octubre de 2026: una cuenta real con Dirección,
nueve asuntos, una tarea y 19 versiones documentales conservadas. La comparación
de hashes de las tablas originales y de la tarea sin sus nuevos metadatos fue
coincidente. Respaldo previo:
`platform-2026-10-19T03-50-22-988Z-04b10648-5539-4c3e-bce8-0d8994870b5d`.
Su restauración aislada verificó 37 tablas sin modificar la base activa. El
servidor actualizado respondió correctamente con centralización y programador de
plazos activos en `127.0.0.1:4313`.

Uso y alcance operativo: [Cuentas y respaldos locales](CUENTAS_Y_RESPALDOS_LOCALES.md).
La entrega 2.1 no habilitaba todavía la red del estudio. La etapa 2.2 incorpora
ahora esa configuración; el ensayo físico con otra computadora queda diferido
por el titular y no se da por realizado mediante la prueba automatizada local.

## Etapa 2.2 Respaldo integral y trabajo en red local

Completar el respaldo con los originales de Biblioteca, extracciones, una copia
consistente de SQLite y los demás archivos persistentes necesarios, incluyendo
configuraciones privadas e históricos de la Junta. Identificar las cachés
regenerables para evitar copias innecesarias. Verificar integridad y restaurar
en un destino separado, con copia adicional fuera del disco de trabajo.

El respaldo previo a la migración de roles forma parte del bloque A; la
incorporación completa de Biblioteca cierra aquí la omisión de la etapa 1.

Para que los abogados trabajen desde computadoras diferentes, configurar un
servidor del estudio accesible mediante HTTPS en su red local. Adaptar enlaces de
invitación, sesiones, edición compartida y audio a esa dirección; probar también
recuperación de cuentas y reconexión. La instalación actual en loopback continúa
disponible hasta completar ese recorrido. No requiere Supabase ni publicación
en Internet.

**Aceptación:** dos equipos del estudio colaboran con cuentas propias; una
restauración aislada recupera documentos, gestión y Biblioteca. No dar por
resuelta la operación entre computadoras por probar dos navegadores en una sola.

## Etapa 3 Admisión y gestión económica

Dirección registra y acepta el encargo, revisa posibles conflictos y fija su
alcance. Los abogados aportan antecedentes dentro de sus asuntos autorizados.
El resultado de una búsqueda de conflictos no equivale por sí solo a una decisión
profesional de aceptación.

Incorporar presupuesto y acuerdo de honorarios, registro de trabajo y gastos,
pagos, saldos y seguimiento de cobro vinculados al asunto. Dirección aprueba los
compromisos económicos; el abogado registra su trabajo y presenta gastos. Integrar
las vistas en los asuntos y reservar el resumen económico a Dirección.

Definir el circuito de comprobantes y validar los requisitos fiscales vigentes
antes de presentar una salida como factura fiscal. Una integración fiscal externa
se trata como una entrega explícita, sin simularla con un PDF.

**Aceptación:** un encargo aceptado puede presupuestarse, registrar trabajo/gastos,
facturarse mediante el circuito habilitado y conciliar pagos, con responsables,
permisos e historial de ajustes.

## Etapa 4 Plantillas y entregas al cliente

Dirección administra las plantillas aprobadas del estudio. Los abogados las usan
dentro del editor, completan los datos del asunto y trabajan con especialistas
IA sobre el documento abierto. Versionar las plantillas y sus ámbitos de uso;
no presumir un formato jurídico universal ni enviar borradores sin revisión.

El portal del cliente muestra únicamente entregas publicadas y comunicaciones
habilitadas. El cliente es un destinatario externo con permisos acotados, no un
tercer rol dentro de la jerarquía del despacho. Validar el recorrido local antes
de considerar acceso externo al estudio.

**Aceptación:** crear un documento desde plantilla, revisarlo, registrar la
versión entregada y comprobar que el cliente solo accede a lo publicado.

## Etapa 5 Sesiones y seguimiento del despacho

Consolidar la edición y el audio humano existentes dentro del workspace.
Incorporar grabación iniciada explícitamente, indicador para los participantes,
almacenamiento por asunto, transcripción y propuesta de acta con acuerdos,
desacuerdos y acciones pendientes.

Los compromisos detectados por IA quedan como propuestas: Dirección asigna las
tareas humanas resultantes. La IA no convierte una frase de la reunión en una
delegación que el hablante no puede realizar.

Incorporar al Dashboard del Director indicadores de carga, vencimientos,
revisiones, gastos de IA y cobranza. Mantener para el abogado una vista de su
trabajo, sin convertir los indicadores en otro módulo de navegación.

**Aceptación:** la sesión conserva sus registros y una minuta revisada; las
acciones aceptadas aparecen en el trabajo del equipo con autoría y asignación
correctas. Los indicadores se calculan desde registros persistidos.

## Entrega de las etapas 2.2 a 5 — 19 de octubre de 2026

Se implementan los circuitos descritos en las cuatro etapas dentro de la
navegación existente. La guía de uso y sus límites está en
[Gestión profesional local](GESTION_PROFESIONAL_LOCAL.md). **Gestión del asunto**
reúne admisión, honorarios/cobros, plantillas, portal y sesiones. Dirección
dispone del resumen económico y de actas; los abogados conservan su vista y
permisos. El editor abre borradores reales desde plantillas aprobadas.

El respaldo integral incluye Biblioteca y una instantánea SQLite consistente,
además del servidor central, objetos, grabaciones e históricos. HTTPS y destino
externo son configurables; recuperación de cuentas usa enlaces de un solo uso.
El titular indicó «seguí de largo, eso lo probamos después»: la elección y prueba
del disco externo y el ensayo desde otra computadora quedan diferidos. No se
activa un destino ni se instala confianza en certificados por suposición.

La gestión económica genera comprobantes internos y permite registrar una
factura fiscal emitida externamente con su constancia. No incluye emisión
electrónica DNIT; el conector fiscal externo sigue siendo una entrega explícita,
como se definió en la etapa 3. No se incorpora una colección de contratos con
aprobación jurídica ficticia: Dirección prepara y aprueba las plantillas reales.

Validación: 50 pruebas focalizadas aprobadas entre gestión, sesiones, permisos,
plazos, agente del workspace, plataforma y Gabriel por texto/voz; comprobación
adicional de cámara/audio WebRTC y conversión/grabación PCM en dos navegadores.
El recorrido de plataforma usa cuentas Better Auth reales en una base de prueba,
edición compartida, grabación consentida, descarga, transcripción/acta con
proveedor simulado, recuperación sin duplicar llamadas, portal revocado,
revisión de versiones y restauración aislada con WAL SQLite. TypeScript y las
compilaciones API/web pasaron. No hubo llamadas pagas ni envío de expedientes
reales como parte de estas pruebas. Las limitaciones de las suites antiguas
documentadas en etapas anteriores no se presentan como resueltas por esta entrega.

La actualización local conserva por comparación de hashes todas las tablas del
estado anterior y las cuentas: una cuenta, nueve asuntos, una tarea y 19
versiones. El servidor responde en `127.0.0.1:4313`, con autenticación por
invitación, almacenamiento PostgreSQL y programador de plazos activos. Jev a la
salida permanece desactivado.

Comprobación del respaldo integral: se restauró
`platform-2026-10-19T04-59-10-777Z-67e1c36e-fdb6-4cd1-9bcc-30f2d4214c42`
el 19 de octubre de 2026 a las 06:39 UTC. Coincidieron las 37 tablas de la
instantánea y se recuperaron 108.718 archivos con comprobación SHA-256, además
del catálogo SQLite. Sus 32.442 referencias de fuente corresponden a 31.047
originales distintos, todos presentes en el respaldo. El ensayo se reanudó en
su mismo destino temporal y reutilizó 45.787 archivos después de comprobar sus
hashes; los restantes se copiaron y verificaron. La base temporal PostgreSQL se
eliminó al terminar; los archivos recuperados permanecen en
`.local-dev/restore-checks/law_order_restore_d16dd49fd8fa4574ae76198276bcc9bb`.
El resultado está en `restoration.json` dentro del respaldo. La base activa
permaneció intacta. Se retiraron únicamente los cuatro intentos incompletos de
respaldo creados durante esta tarea; los respaldos anteriores completos se
conservaron.
