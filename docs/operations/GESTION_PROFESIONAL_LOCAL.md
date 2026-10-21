# Gestión profesional del estudio — etapas 2.2 a 5

La instalación sigue en PostgreSQL y archivos locales. No requiere Supabase ni
publicar el servidor en Internet. Se conservan asuntos, originales, versiones,
editor compartido, Gabriel y la jerarquía Director/Abogados.

El host requiere Node.js 24 o posterior para el respaldo SQLite nativo. La
instalación comprobada usa Node.js 24.20.0; las dependencias no se modifican.

## Dónde está cada función

El expediente se concentra en **Workspace, Documentos, Consulta jurídica,
Tareas y plazos y Actividad**. **Más opciones** reúne borradores, revisiones,
procedimientos, permisos, entregas y sesiones/portal. La presentación del equipo
IA queda solamente en el menú lateral. Los datos y versiones se conservan.

La administración económica está separada: **Finanzas** es un panel del Director
con cuentas por cobrar, cuentas por pagar y presupuestos/honorarios. Cada
liquidación mantiene el vínculo con su cliente y asunto, sin ocupar una pestaña
del expediente. **Clientes → Admisión y conflictos** registra el encargo.

| Acceso | Circuito |
| --- | --- |
| Clientes → Admisión y conflictos | Registrar partes, alcance, exclusiones y jurisdicción; buscar coincidencias; decisión de Dirección con fundamento |
| Finanzas → Por cobrar | Saldos y vencimientos de liquidaciones de todo el estudio; acceso al asunto económico para registrar cobros |
| Finanzas → Por pagar | Facturas de proveedores, moneda, fecha y vencimiento, pagos parciales e historial; anulación solo sin pagos |
| Finanzas → Presupuestos y honorarios | Presupuesto, aprobación, aceptación del cliente, horas/gastos, comprobantes internos, pagos, créditos y devoluciones |
| Agenda | Calendario de mes/semana/día con reuniones, tareas fechadas y plazos; un clic en una franja reserva su horario. Las citas pendientes se arrastran para reprogramar; en semana/día se estiran sus bordes para ajustar inicio o fin, en pasos de 15 minutos. Se guarda al soltar, se conservan duración y datos al mover y se rechazan superposiciones y revisiones desactualizadas. Esc cancela el gesto. Los plazos mantienen su confirmación profesional. |
| Dashboard | KPI de avisos personales sin reconocer, plazos confirmados vencidos/próximos, plazos por confirmar, trabajo atrasado y revisiones; prioridades con acceso al asunto, agenda de hoy, carga humana y próximos pasos de asuntos abiertos. Sin resumen de honorarios ni consumo IA. |
| Plazos y tareas | Dos vistas: vencimientos y trabajo del equipo; prioridades, carga por profesional, solicitudes y avisos |
| Asunto → Más opciones → Sesiones y portal | Entregas al cliente y sesiones, grabaciones, transcripciones y actas |

En el editor, **Archivos → Usar modelo del estudio** abre modelos documentales
reutilizables aprobados por el estudio; no es un trámite obligatorio del asunto.
El botón **Sesiones y portal** guarda primero un documento nuevo con contenido;
si el guardado falla, mantiene abierto el editor. El Dashboard concentra plazos,
prioridades, agenda y trabajo asignado. Admisión y Finanzas mantienen sus accesos
en Clientes y en el menú lateral.

Las citas permiten al Director organizar la agenda de los profesionales. Los
abogados crean y gestionan solo sus propias citas; no ven las citas ajenas.
Se comprueba que el profesional esté activo y no tenga otra cita superpuesta.
Una reunión interna no requiere inventar un cliente. Los horarios de creación y
visualización usan America/Asuncion. El calendario muestra tareas fechadas y
plazos autorizados, mantiene separadas las actividades coincidentes y distingue
con borde discontinuo los plazos pendientes de confirmación. Seleccionar una
actividad abre su detalle; los plazos y tareas se gestionan desde su asunto.
La agenda se guarda localmente y no envía invitaciones ni recordatorios externos.
Los avisos procesales siguen su circuito de plazos confirmados dentro del OS.

Las facturas de proveedores son obligaciones administrativas independientes de
las horas/gastos de abogados. Solo el Director puede consultarlas y modificarlas.
No se mezclan monedas ni se permiten pagos superiores al saldo, referencias de
pago repetidas ni anular una obligación con movimientos. Registrar un pago no
ejecuta una transferencia bancaria. Los movimientos integran el respaldo local.

### Indicadores y control administrativo

**Finanzas → Resumen** muestra seis indicadores incluso cuando están en cero:
por cobrar, cobros vencidos, cobrado neto del mes, por pagar, pagos vencidos y
flujo neto del mes. Los saldos son actuales; el selector mensual solo cambia los
movimientos. Se separan monedas y no se aplican conversiones implícitas. Las
devoluciones restan al cobrado y cuentan como egresos en el flujo; los créditos
ajustan el saldo y no se presentan como movimientos de dinero. Los movimientos
con fecha futura no se cuentan como cobros/pagos ya realizados.

El gráfico abarca seis meses hasta el mes elegido y ofrece una tabla accesible.
La antigüedad de cobranza separa saldo al día, 1–30, 31–60 y más de 60 días. Las
tarjetas de saldos y deuda vencida abren los listados con su filtro. Se conservan
la búsqueda, los pagos parciales y el acceso a los comprobantes. El flujo no
equivale al saldo bancario ni a la utilidad contable.

**Plazos y tareas** separa fechas con confirmación jurídica del trabajo interno.
Los indicadores permiten filtrar vencidos, próximos siete días y pendientes de
confirmación o bloqueados. El panel lateral reúne recordatorios, carga por
profesional y solicitudes. Los filtros secundarios no ocupan la vista inicial.
El historial completo sigue disponible en el asunto. Gabriel queda como acceso
compacto en estos tres paneles, con conversación y controles de voz disponibles.

## Responsabilidades

Dirección acepta encargos, aprueba presupuestos y gastos, registra cobros,
administra plantillas, publica entregas y aprueba actas. Solo Dirección asigna
acciones a otros abogados humanos. Un abogado registra su propio trabajo y
gastos, propone antecedentes, usa plantillas aprobadas y trabaja en las sesiones
de sus asuntos autorizados. Los controles se aplican en el servidor, también al
usar Gabriel por texto, voz o chat del documento.

Gabriel dispone de lectura de registros y esquemas de comandos, ejecución bajo
la sesión actual, transcripción de sesiones y preparación de actas. Interpreta
el pedido mediante el modelo; los botones no seleccionan intenciones por frases
clave. La redacción y evaluación jurídica sustantivas conservan especialistas y
controles existentes. No se activa Jev a la salida ni se cambia el modelo normal
de los especialistas por el modelo costoso reservado a la Junta completa.

## Admisión y dinero

La búsqueda de conflictos muestra coincidencias por nombres normalizados e
identificaciones de clientes, contactos y admisiones. No sustituye la decisión
profesional ni garantiza detectar relaciones ausentes del registro. Si cambian
los antecedentes mientras se decide, el servidor exige repetir la consulta.

Un encargo aceptado permite emitir presupuestos. La aprobación de Dirección y
la aceptación del cliente son registros distintos; esta última exige constancia.
Las horas y gastos aprobados pueden vincularse al comprobante, sin facturarlos
dos veces. Se conservan revisiones e historial y se calculan importes en unidades
monetarias enteras, sin mezclar monedas en los saldos.

El comprobante generado es **interno**. Una factura fiscal emitida por otro
sistema puede registrarse con su número, autorización, RUC y versión documental
adjunta. Esta entrega no emite facturas electrónicas DNIT ni simula validez fiscal
con un PDF. El conector fiscal externo requiere una entrega específica, tal como
establece el plan. Pagos, créditos y devoluciones son movimientos separados; no
reescriben el principal del comprobante. Hay límites de saldo, referencias de
pago e historial de cancelación.

## Plantillas y portal

No se incorpora un repertorio de contratos presentado como jurídicamente
aprobado. Dirección crea las plantillas del estudio, declara ámbito y campos,
revisa y aprueba cada versión. Los campos automáticos incluyen nombre e
identificación del cliente, título y área del asunto. La creación registra la
versión de plantilla utilizada y genera un borrador sujeto al circuito de revisión.

La última versión aprobada sigue disponible mientras Dirección prepara otra.
Retirar la plantilla impide nuevos usos; los documentos ya creados se conservan.

El portal entrega únicamente versiones publicadas explícitamente. Un borrador
de salida debe contar con aprobación de esa versión. Publicar un original o un
documento de entrada exige confirmación de Dirección. Cambiar después el borrador
interno no cambia lo entregado al cliente. El enlace concede acceso a ese asunto,
vence y puede revocarse; quien lo recibe puede abrirlo, por lo que debe compartirse
por un canal apropiado. El destinatario no adquiere una cuenta de abogado ni
acceso a la navegación o al estado interno del OS.

## Sesiones humanas, audio y actas

La llamada del documento permite conversar con los participantes del workspace;
es distinta de hablar con Gabriel. La grabación requiere solicitud explícita y
aceptación de todos los participantes presentes. Se muestra un indicador durante
la captura. Una negativa, entrada, salida, desconexión o revocación detiene la
grabación; no se hereda el consentimiento de otra composición de la llamada.

El navegador mezcla el audio local y remoto, genera segmentos y los guarda en
el servidor local vinculados al asunto y sesión. Se conserva el audio, no el
video de la cámara. Los segmentos convertidos a WAV permiten transcribir desde
la interfaz o pedirlo a Gabriel. Un fallo de carga permite descargar el segmento
que conserva ese navegador; no se anuncia como guardado hasta confirmarlo.

Transcribir usa la API de audio configurada y genera una **propuesta**. No se
inventan hablantes. Una persona revisa el texto antes del acta. Para una sesión
con varios segmentos, todos deben estar revisados; la preparación reúne todos
los segmentos y procesa por secciones las reuniones extensas. El acta propone
resumen, acuerdos, desacuerdos y acciones con citas de la transcripción. No hace
análisis jurídico, no aprueba decisiones y no asigna tareas automáticamente.

Dirección revisa y aprueba el acta y puede asignar sus acciones a abogados con
acceso al asunto. Cada asignación conserva autoría y vínculo y no se duplica al
reintentar. Si se modifica la transcripción, no se aprueba un acta pendiente basada
en una revisión anterior.

Las llamadas de IA requieren la configuración y aprobación de gasto existentes.
Se registran estimaciones, resultados y reservas inciertas por separado. Un fallo
con resultado conservado permite recuperarlo sin otra llamada paga. Un resultado
desconocido no se reenvía automáticamente. Las pruebas automáticas utilizan
proveedores simulados y no envían documentos reales ni generan gasto de IA.

## Respaldo integral y recuperación

En **Administración → Respaldos y recuperación** se crea el respaldo y se comprueba
su restauración en una base y carpeta nuevas. No se reemplaza la instalación
activa al verificar. El manifiesto incluye SHA-256 por archivo e inventario de
tablas PostgreSQL de una instantánea consistente.

Se incluyen objetos documentales, configuración privada, originales y
extracciones de Biblioteca, instantáneas SQLite con sus páginas WAL confirmadas,
corpus, históricos de Junta y Gabriel, grabaciones y certificados locales. Se
excluyen dependencias, compilaciones, archivos temporales y cachés de descarga
regenerables. La Biblioteca grande puede tardar bastante; la interfaz muestra
el progreso. Las nuevas copias también verifican la presencia de los hashes de
originales referidos por el catálogo SQLite.

SQLite se copia con su API de respaldo. La verificación comprueba estructura de
la tabla de fuentes y una consulta de búsqueda FTS; el archivo completo se
verifica por SHA-256. Esto no equivale a una auditoría exhaustiva de todas las
relaciones del índice FTS. La prueba de restauración materializa los archivos en
una carpeta aislada y vuelve a comprobar sus hashes y SQLite, además de restaurar
PostgreSQL e inventariar su contenido. La base temporal se elimina al terminar;
la carpeta de archivos recuperados queda identificada en el resultado.

En **Administración → Respaldos y recuperación** se puede configurar una carpeta externa
existente. El sistema copia allí el respaldo completo y vuelve a verificarlo.
No se elige una unidad por suposición. En esta entrega, por indicación del titular,
la selección y prueba del disco externo quedan para después. Una copia adicional
en el mismo disco no protege contra la pérdida de ese disco. Los respaldos
contienen datos y credenciales privadas: deben guardarse con acceso restringido.

La recuperación de una cuenta usa un enlace de un solo uso que vence en 30 minutos
y cierra las sesiones anteriores. Dirección lo genera para un integrante activo
de su estudio. El titular también dispone de
`node scripts/platform-recover-owner.mjs --issue-owner-link`, que genera un enlace mediante acceso
local a la instalación; no promueve roles ni cambia una contraseña por sí solo.

## Actualizaciones locales con sesiones abiertas

Compilar con `npm.cmd run os:build:web` o `node scripts/build-web.mjs`.
La compilación se prepara en una carpeta temporal y publica primero los archivos
de la aplicación; el HTML se reemplaza al final, de forma atómica. Si falla la
compilación o la publicación, la entrada anterior sigue disponible. No se purgan
automáticamente los módulos con hash de versiones anteriores: una pestaña abierta
puede necesitar cargarlos al volver a un panel. No borrar `dist/web` mientras haya
sesiones abiertas. Los datos del estudio y sus respaldos viven fuera de esa carpeta.

El servidor devuelve 404 para archivos ausentes y reserva el fallback HTML para
rutas de navegación. El HTML no se guarda en caché y los assets versionados son
inmutables. La recuperación de pantalla distingue fallos de carga y errores de
renderizado; incluye el detalle para diagnóstico y nunca recarga automáticamente
sobre un documento o formulario abierto.

## HTTPS en la red del estudio

**Administración → Conexión HTTPS en la red del estudio** permite elegir una dirección privada realmente presente en
esta computadora y un puerto HTTPS. Se genera una autoridad certificadora local
y un certificado para esa dirección. La interfaz permite descargar la CA y
comparar su huella. No se instala confianza automáticamente, no se cambia el
firewall ni se publica el servidor en Internet. El acceso loopback existente
permanece disponible.

En otra computadora del estudio habrá que confiar en esa CA tras verificar su
huella y habilitar el puerto solo en la red privada si el firewall lo requiere.
Invitaciones, sesión, editor y audio utilizan el mismo origen HTTPS. La prueba
automatizada verifica TLS, cookies, dos cuentas y recuperación en esta computadora;
la prueba física desde otra computadora y de micrófonos en esa red queda
expresamente pospuesta por el titular. No se presenta ese ensayo como realizado.
