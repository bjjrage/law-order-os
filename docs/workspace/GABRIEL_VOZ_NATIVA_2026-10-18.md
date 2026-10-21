# Gabriel: conversación de voz nativa

El usuario autorizó audio nativo en tiempo real el 18/10/2026. El botón «Conversar por voz» del avatar y del panel abre una conexión WebRTC con `gpt-realtime-2.1-mini`, disponible en la cuenta según una comprobación GET del modelo. Los especialistas conservan Luna; no se toca la Junta completa ni Jev de salida.

## Problema y solución

La voz anterior cerraba el micrófono después de cada grabación, esperaba una transcripción completa, luego un JSON de Luna y finalmente el MP3 completo del sintetizador. No capturaba lo dicho durante esas esperas o durante la lectura, salvo que el humano pulsara una interrupción. El bloqueo global de peticiones también rechazaba solicitudes concurrentes. El registro local no había alcanzado el tope diario antiguo: ese tope no explica por sí solo el intento reportado.

La voz nativa conserva un único micrófono y conexión durante la conversación. El modelo recibe audio y entrega audio progresivo; la transcripción es un registro visual asíncrono. Semantic VAD delimita turnos y permite interrupciones, con truncamiento del audio no escuchado administrado por Realtime/WebRTC. El historial se siembra al iniciar y se mantiene en la sesión; las actualizaciones visuales se identifican por item_id y se guardan al terminar turnos. La interfaz permite enviar texto en esa misma sesión mientras hay una respuesta en curso. Una cola conserva el texto enviado durante la conexión o una cancelación.

`apps/web/src/gabriel-realtime.ts` maneja la conexión, eventos, transcripción progresiva, interrupciones, herramientas, silencio y cierre. `scripts/gabriel-realtime.mjs` negocia el SDP mediante la interfaz unificada; la clave estándar no sale del servidor. La conexión lateral del servidor registra cantidad de turnos/respuestas, interrupciones, latencia, errores técnicos y estimación conservadora de consumo, sin guardar audio ni transcripciones. Además de navegar y preparar casos nuevos, la voz puede consultar documentos y delegar trabajo mediante el mismo runtime del editor. No puede modificar permisos, aplicar propuestas ni aprobar documentos.

## Acceso al documento y a las propuestas

La primera versión solo ofrecía navegación y preparación de consultas. Por eso Gabriel decía no tener acceso aunque el workspace hubiese generado el documento. Ahora `gabriel-workspace.ts` conecta tres herramientas reales:

- `workspace_documents`: inventario de borradores de los asuntos accesibles al perfil, con títulos e IDs. Recuerda el último documento abierto por estudio/perfil; una referencia ambigua exige aclaración.
- `read_workspace`: lee el editor duradero (`DOCUMENT`) o los trabajos guardados (`WORK_INDEX`, `PROPOSAL`, `ANALYSIS`, `CONVERSATION`). Una propuesta se puede leer aunque no esté aplicada. El endpoint `director-read` verifica el grant y el room del documento; no acepta jobs de otro documento. Devuelve procedencia, hash, estado y páginas con cursor, sin truncar el original. Leer no equivale a verificar fuentes. `open=true` abre el documento pedido sin cerrar la llamada.
- `delegate_workspace`: envía el objetivo y el hilo al director v4 del workspace, que elige especialistas con Luna y sus controles. `director-task` confirma permisos, instantánea y creación persistente antes de devolver un job en curso. El trabajo continúa sin bloquear la voz y el resultado vuelve a la misma conversación. No cambia la Junta completa ni activa Jev de salida; conserva propuestas y aplicación humana.

Los tokens de acceso al documento se quedan en el host del navegador, nunca en el resultado enviado al modelo. El texto solicitado sí se comparte con OpenAI; se explica en «Alcance y privacidad». Los encargos mantienen su presupuesto separado de hasta USD 0,60. El editor conserva el componente de voz al entrar/salir y ofrece «Gabriel · voz» en la cabecera, evitando otro avatar sobre los controles del documento. Este puente corresponde a la conversación nativa; el dictado manual anterior conserva su alcance propio.

Cerrar el panel, finalizar voz, cambiar de conversación, abandonar la página o desmontar el componente cierra tracks, peer y audio. Una cancelación durante el inicio deja registrada la solicitud y cierra el call si el proveedor ya lo creó. Un resultado incierto no se reintenta automáticamente. El dictado manual conserva su recorrido anterior y sus límites propios.

## Consumo y límites reales

La voz nativa tiene consumo por uso, separado de la reserva diaria del dictado/lectura anterior. No se aplica a una sesión de audio un cupo diario oculto de mensajes. El panel indica consumo por uso y muestra un estimado de la sesión. La estimación usa conservadoramente las tarifas de audio para todos los tokens: USD 10/20 por millón de tokens de entrada/salida, comprobadas en la página oficial del modelo el 18/10/2026; no es una factura ni incluye el ASR separado del registro visual. Se usa esfuerzo minimal, salida máxima 1024 tokens y ventana de conversación posinstrucciones de 24.000 tokens, con retención 0,8. Son parámetros de coste/contexto por respuesta, no un límite de caracteres o de duración de cada frase hablada. El servidor corta si observa una respuesta por encima de USD 0,60 estimados.

La ventana del proveedor sigue siendo finita: al llenarse se descartan mensajes antiguos del contexto activo, mientras el registro visual de la pestaña se conserva. El historial guardado permite volver a conectar. La disponibilidad depende del modelo, los permisos del micrófono, la red y la cuenta; ninguna latencia de una prueba garantiza una latencia uniforme.

## Verificación

- Pruebas del host: SDP y modelo, origen, clave en servidor, idempotencia, consumo sin duplicados y cancelación de un inicio pendiente sin call huérfano.
- Navegador con WebRTC real entre dos peers locales y audio sintético: un micrófono para dos turnos, interrupción durante audio, texto durante respuesta, navegación, silencio, cierre de todos los tracks, historial conservado y cero llamadas al recorrido antiguo.
- Herramientas de documentos: propuesta por room/job, páginas y procedencia, separación entre asuntos/perfiles, lectura sin edición, permisos de solo lectura, creación del encargo con runtime v4 y devolución de su resultado. El recorrido completo usa PostgreSQL aislado, un documento ficticio y dos peers WebRTC locales; no envía contratos privados a OpenAI.
- Prueba adicional del modelo de voz real por WebSocket: ante una pregunta escrita sobre una propuesta ficticia, eligió las herramientas de inventario/lectura y recuperó el monto y los pendientes de revisión. Cinco respuestas, estimación conservadora USD 0,11259, cero documentos privados. Verifica elección de herramientas y audio de respuesta; no verifica el micrófono físico ni un dictamen jurídico. La prueba completa de persistencia usa transportes de modelo inyectados.
- Prueba LIVE aislada con una frase sintetizada localmente: un saludo, sin micrófono humano, historial privado ni documentos. Resultado completado. Primer audio a los 507 ms desde el evento de fin de turno; estimación conservadora USD 0,01279. Esta prueba verifica un turno real de audio; los recorridos de interrupción/herramientas se verifican con eventos controlados en el navegador.

Referencias: [WebRTC e interfaz unificada](https://developers.openai.com/api/docs/guides/voice-webrtc), [conversaciones y eventos](https://developers.openai.com/api/docs/guides/realtime-conversations), [configuración y VAD](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create), [modelo y tarifas](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini).
