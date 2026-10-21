# Protocolo operativo v0.3

Pregunta: con iguales materiales y controles, ¿qué diferencias de calidad, finalización y costo presentan los tres niveles? No se presupone ganador.

Cada ejecución empieza con conversación, asunto y documentos nuevos, sin memoria de otras ejecuciones. Se recorre el workflow real de Gabriel: selección libre de especialistas, análisis, auditoría independiente, corrección/checker e integración cuando corresponda. No fijar especialistas desde el benchmark ni reemplazarlo por llamadas directas al modelo. Registrar las decisiones reales.

Entregar los cuatro turnos de CASOS.json en orden, esperando terminación. Las fuentes de cada caso se liberan según el JSON; N06 recibe el precedente en el turno 2. No montar toda la carpeta pública desde el inicio: permitiría anticipar documentos y otros casos.

Si el sistema pregunta algo, usar solo hechos ya liberados. Si falta el dato, la respuesta prevista es “No cuento con ese dato; dejalo pendiente”. Sin embargo, la propuesta inicial admite cero interacciones pagadas adicionales: guardar la pregunta y continuar con el siguiente turno fijo, incorporando esa respuesta allí si cabe. No enviar automáticamente una quinta interacción. Registrar el límite de este guion; ampliarlo exige nueva versión y presupuesto.

Fase 1: fuentes controladas idénticas por caso/nivel/repetición. Fase 2 futura: recuperación en biblioteca real con matriz y presupuesto propios. No mezclar resultados. Las referencias evaluativas nunca se entregan como fuentes. Comprobar suficiencia del corpus público: no puntuar conocimientos solo disponibles en el dossier.

Antes de inferencias, congelar: textos/hashes, fuentes y revisiones, fecha jurídica de corte, validación humana, configuración efectiva, commit y cambios locales, herramientas, límites por llamada, presupuesto, revisores e informe de aislamiento. MANIFIESTO.json comprueba integridad documental; no acredita calidad jurídica ni controles operativos.

Incluir todas las filas, también fallos, cortes de presupuesto e interrupciones. No escoger la mejor repetición. Un resultado incierto conserva su reserva y no se reintenta automáticamente. Reintentos autorizados usan ID nuevo sin reemplazar el fallo. Registrar inicio/fin, turnos, especialistas, auditor efectivo/fallback, tokens y costos conocidos, reservas inciertas y motivos de corte. Guardar borradores existentes; no generar variantes para medir auditoría.

Se probaron offline aislamiento por AppContainer, liberación de snapshots, continuidad de cuatro interacciones con historial propio y reserva global persistente/atómica. Gestión/biblioteca quedan bloqueadas y el transporte es exclusivamente sintético. Siguen pendientes para una ejecución real: aprobación humana/vigencia, exportación ciega, tamaño del corpus/cotas, tarifas vigentes y autorización explícita del total. El permiso de USD 0,60 de la aplicación no abre esas puertas. El ejecutor disponible no tiene modo de pago.

Después del piloto, ajustar y congelar. La confirmación requiere 18 expedientes nuevos de curaduría independiente, reservados al sistema y a quienes ajustan. Su matriz, repeticiones y presupuesto se fijan por separado.
