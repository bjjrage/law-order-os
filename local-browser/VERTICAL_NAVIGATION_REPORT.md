# Navegación por cliente y asunto

2026-10-13, America/Asuncion. Se corrigió la mezcla de configuración del estudio con acciones operativas.

Recorrido: Clientes → cliente seleccionado → sus asuntos → asunto seleccionado → Documentos → Junta → Borradores → Revisiones. La navegación principal ubica Clientes antes de Asuntos; Asuntos mantiene la vista global para acceso directo a expedientes existentes.

Crear estudio solo aparece en Administración. La pantalla explica que el estudio es la organización que contiene clientes, asuntos y equipo. Sin estudio configurado, el usuario recibe un acceso a Administración. Mi día tiene accesos a Clientes y Asuntos; Agenda y Biblioteca no muestran botones de alta ajenos a su función.

Clientes muestra Nuevo cliente y cada nombre abre sus asuntos filtrados por client_id. Después de guardar un cliente se navega automáticamente a sus asuntos. Nuevo asunto preselecciona el cliente de contexto; al guardar abre el expediente en Documentos, con Incorporar original y Consultar Junta visibles. Si no hay clientes, la vista global de asuntos dirige primero a Clientes. Cambiar de estudio descarta el contexto anterior.

Se conservó el Core y la persistencia existente. No se migraron, borraron ni sembraron datos en el navegador del propietario. Se actualizó el build servido por el mismo proceso; no se detuvieron otros procesos, no hubo despliegues ni llamadas de inferencia.

Verificación: typecheck/build web PASS. 15/15 pruebas locales PASS en reports/vertical-navigation-tests.json. La regresión de navegador usa perfil aislado: verifica ausencia de Crear estudio/Nuevo asunto en Clientes, creación de cliente, preselección en asunto, apertura automática de Documentos, acceso a Junta y respaldo/restauración. El navegador interno confirmó cliente → asuntos y la captura reports/cliente-asuntos.png. El propietario debe recargar su propia pestaña para obtener la interfaz actualizada; los datos de cada navegador siguen siendo independientes.
