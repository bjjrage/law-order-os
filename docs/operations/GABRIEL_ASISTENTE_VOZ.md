# Gabriel flotante y por voz

> Registro histórico del recorrido por turnos. La conversación actual usa [voz nativa y acceso al workspace](../workspace/GABRIEL_VOZ_NATIVA_2026-10-18.md). Las restricciones de dictado y la ausencia de documentos descritas aquí corresponden al recorrido anterior, no a la sesión de voz nativa.

Implementado en el OS local, disponible en todas las secciones del estudio. Gabriel es un busto 3D modelado con geometría, iluminación y materiales de Three.js, con movimiento sutil y estados de escucha, espera y habla. Si WebGL no está disponible se muestra el retrato existente. El movimiento respeta la preferencia de animación reducida.

## Uso

- Clic en Gabriel: abrir o minimizar conversación. Arrastrar directamente el avatar con el cursor, o usar las flechas de teclado mientras tiene el foco, para moverlo. No hay un control de puntos separado. Su posición se conserva y el arrastre no abre la conversación. El busto tiene una flotación visible, que se pausa al tomarlo y respeta la preferencia de movimiento reducido.
- Micrófono: permitir acceso en el navegador, hablar y pulsar **Terminar**. Se envía automáticamente al cumplirse 30 segundos. **Cancelar** descarta la grabación; **Interrumpir** detiene la petición o la reproducción.
- Una consulta conceptual obtiene orientación breve con el modelo Luna configurado. La respuesta se lee con voz IA de OpenAI. También admite texto y silencio.
- “Abrí Clientes” navega. “¿Para qué sirve Agenda?” explica la sección. La navegación y ayuda textual no necesitan inferencia; leerlas en voz alta utiliza síntesis de voz.
- Las consultas generales pertenecen siempre a Gabriel. No se muestran en un formulario del asunto ni inician una Junta por sí solas.
- “Quiero analizar un contrato…” abre la propuesta revisable. Se conserva el flujo de especialistas, titular, preguntas, profundidad, revisión adversarial y cliente/asunto. Desde un asunto se preselecciona su contexto. Confirmar no ejecuta una Junta: abre **Consulta jurídica**, el espacio del equipo convocado.
- **Equipo jurídico** presenta al estudio IA: Gabriel, Elena, Valeria, Lucía, Martín, Diego, Camila y Santiago. Incluye funciones, aportes, áreas y disponibilidad de herramientas, seis etapas explorables de deliberación y el papel del profesional humano. Se puede abrir desde la navegación del estudio y desde una pestaña del asunto, anterior a **Consulta jurídica**. Los formularios y modos generales anteriores ya no se montan en ese espacio; los datos guardados no se borran.

## Conexión y límites

Rutas `/local/gabriel/status`, `/chat`, `/transcribe`, `/speech` en el servidor local. Clave OpenAI solo en servidor, misma configuración existente y aprobación de ejecución local. Origen local y encabezado específico obligatorios. No hay acceso arbitrario a archivos, eliminación, creación de datos por el modelo ni herramientas remotas.

Voz por turnos: PCM mono 16 kHz, máximo 30 segundos, transcripción `gpt-4o-mini-transcribe`; síntesis `tts-1`, voz `onyx`. Compatible con captura mediante AudioContext en Firefox y Chromium; no depende del reconocimiento Web Speech exclusivo de ciertos navegadores. No es una sesión de escucha permanente. La captura requiere permiso y dispositivo del usuario.

Consulta: máximo 2000 caracteres, últimas cuatro intervenciones acotadas, salida estructurada hasta 1400 tokens, una llamada sin reintento automático. No se adjuntan contratos ni documentos del asunto. La orientación rápida no recupera ni coteja jurisprudencia/RAG: la UI lo indica. El análisis formal conserva sus controles existentes.

Reservas previas por llamada: chat USD 0,01; transcripción USD 0,01; voz USD 0,04. Total máximo reservado de un turno completo USD 0,06; límite diario de Gabriel USD 0,60 (America/Asuncion), separado de la Junta. Los fallos de resultado desconocido conservan su reserva. Las síntesis correctas liberan la reserva excedente usando USD 15/millón de caracteres; el chat con uso completo aplica la tarifa estándar conocida de Luna. Son estimaciones, no comprobantes de facturación. Los identificadores persistidos impiden duplicar una misma petición; tras un apagado se conserva el consumo reservado y se recupera el bloqueo de un proceso que ya no existe.

Referencias oficiales revisadas el 16/10/2026: [transcripción](https://developers.openai.com/api/docs/guides/speech-to-text), [síntesis de voz](https://developers.openai.com/api/docs/guides/text-to-speech), [precios](https://developers.openai.com/api/docs/pricing), [renderizado 3D](https://threejs.org/docs/pages/WebGLRenderer).

## Verificación

48 pruebas offline aprobadas entre Gabriel, equipo jurídico, modelo del espacio de trabajo y consulta general. Incluyen intención/negación, audio acotado, silencio, permisos fallidos, liberación de micrófono, origen, acciones permitidas, presupuesto, concurrencia y deduplicación. Typecheck OS y build web aprobados. Se verificó además la recuperación de la misma respuesta tras reiniciar el servidor, sin otra petición ni reserva de dinero (`restart-proof.json`).

Prueba real en estudio propio sintético: consulta conceptual sobre venta del 55% versus fusión, generación y reproducción de audio; navegación a todas las secciones; propuesta Elena/Valeria/Martín y apertura de asunto sintético. Síntesis y transcripción de comando sintético verificadas con HTTP 200 en ambos servicios (resultado en `local-browser/reports/gabriel/voice-probe-result.json`). El nombre Gabriel se transcribió como Gabriela; se agregó contexto al transcriptor y tolerancia de ese prefijo para navegación. El dispositivo físico del usuario requiere su permiso y no se envió audio ambiente durante las pruebas.
