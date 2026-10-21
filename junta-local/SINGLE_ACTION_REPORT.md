# Consulta de Junta en una sola acción

2026-10-13, America/Asuncion. Se simplificó el flujo por pedido del propietario: documento → pregunta → Consultar Junta. La pantalla permite cargar un TXT directamente, incorporándolo mediante el Core al mismo asunto y seleccionándolo para la consulta. No exige navegar a Documentos para cargarlo. Contexto, identificadores y recuperación quedan en Opciones.

El botón principal indica «Consultar Junta · hasta USD 0,60» y el texto contiguo explica que el clic autoriza esa consulta con APIs reales. No es una autorización recurrente ni general. Se mantiene la confirmación de datos sintéticos y el límite de tamaño del escenario local. Preparación y autorización ya no son acciones que el usuario deba coordinar por chat.

La ruta POST /local/junta/case/consult exige el mismo origen local, encabezado específico, cuerpo estricto, owner_approval=true, synthetic_data=true y límite exacto 0.6. El host debe habilitar explícitamente aprobaciones desde navegador en .local-dev/junta-browser-approval.json. La aprobación se conserva por prepared_id, hash congelado, importe, fecha y vencimiento; no se modifica la aprobación histórica de otros casos. El motor conserva precios, presupuesto, cero reintentos y marcador durable contra duplicaciones. Preparar, recuperar, abrir pantalla o cargar un archivo no invoca modelos.

La aprobación desde el navegador está habilitada para el propietario local según su pedido de operar directamente desde la UI. Es un entorno sin autenticación: debe permanecer en loopback y con datos ficticios. Credenciales, aprobación y llamadas permanecen del lado del servidor. No se concede una aprobación desde texto de documentos.

Se reemplazó Materia por Área del derecho con opciones. El servidor propio del OS fue reiniciado para cargar la ruta; no se cerró otro proceso del usuario.

Validación: typecheck y build web PASS. 15/15 pruebas locales PASS en reports/single-action-tests.json. Test de cadena con HTTP falso: rechazo sin política del host, sin consentimiento o con otro presupuesto; aprobación ligada al hash; ejecución única y devolución cacheada al repetir. Test de navegador aislado: TXT → pregunta → clic → respuesta explícitamente simulada, una preparación y una consulta, sin botón de preparación separado ni repetición habilitada. Verificación visual real: formulario con botón único, sin ejecutar inferencias. Captura reports/consulta-simple.png.

No hubo llamadas pagas ni despliegues durante este cambio. La próxima llamada real solo comenzará cuando el propietario toque el botón en su navegador. Los formularios, documentos y consultas preparados previamente se conservan.
