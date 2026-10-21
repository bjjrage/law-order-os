# Junta conectada al asunto

2026-10-13. Se implementó el flujo Asuntos → Consultar Junta: pregunta delimitada, contexto, selección de versiones, preparación con originales/hashes y ejecución mediante la cadena existente Jev/Luna/Sol/Gemini/checker. La preparación es local, persistente y no hace llamadas de inferencia. El resultado se consulta desde la misma pantalla, se descarga y puede incorporarse como borrador pendiente de revisión humana.

## Correcciones de conectividad

Gemini no había sido comprobado con la clave nueva de `.env`: Node --env-file conserva una variable heredada de proceso si ya existe. Se encontró una variable heredada distinta de la guardada por el propietario, sin revelar ni registrar valores. La aplicación ahora carga las variables permitidas dando prioridad a los valores no vacíos de `.env`; una variable vacía conserva el fallback de proceso. Tanto el chequeo `junta:comprobar` como la ejecución de casos utilizan esa misma carga. `.env` permanece privado y no se traslada al frontend.

Jev lista alias aunque acepta IDs versionados omitidos del listado, según [documentación oficial](https://docs.typesafe.ai/models). El adaptador acepta el listado documentado con jev-latest para el ID aprobado jev-1.13.0, **mantiene ese ID exacto en el POST** y sigue verificando el ID retornado. No cambia la consulta a un alias ni sustituye el modelo. Una revalidación 401 continúa revocando el permiso. Se actualizó la regresión que exigía erróneamente presencia literal en el listado.

Nueva comprobación real exclusivamente de metadatos: **PASS Jev, Luna, Sol y Gemini**. Evidencia `reports/metadata-corrected-20261013.json`, cuatro GET, sin documentos ni inferencia. La presencia de metadatos no prueba todavía el comportamiento de generación.

## Caso preparado

En el navegador del propietario se preparó el asunto sintético DEMO — revisión documental de un contrato. Pregunta: «¿Qué documentación falta para revisar las obligaciones y las condiciones de terminación del contrato descrito, sin afirmar incumplimientos?». Un original seleccionado, con ID de versión y SHA-256 preservados; sin copia de documentos de otros asuntos. Evidencia para revisión `reports/owner-review-case.json`.

Los documentos de este primer flujo son **PRIVATE_MATTER**, no fuentes oficiales ni hechos judicialmente probados. El contenido original se etiqueta UNKNOWN y los borradores PARTY_ALLEGATION; nunca se eleva oficialidad por una casilla. La Biblioteca contiene enlaces y no se incorpora automáticamente al run. El checker conserva sus bloqueos de referencias no acreditadas. El resultado puede quedar PARTIAL y requiere abogado; ninguna salida se aprueba automáticamente.

El escenario se limita a cuatro documentos / 12 KB de texto UTF-8, presupuesto USD 0.60, cero reintentos y cero recuperación adicional. Se congela bundle/config/precios con hash, se comprueban integridad/scope/versiones y se prohíbe repetir un inicio incierto. El run persistido se devuelve sin repetir modelos; un marcador durable impide arrancar nuevamente cuando no hay resultado recuperable. Cambiar documentos exige preparar otra consulta. Las tarifas standard, sin cache/tools/batch, se reconsultaron: [Jev](https://docs.typesafe.ai/models), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Gemini](https://ai.google.dev/gemini-api/docs/pricing). Reserva máxima calculada USD 0.521520; no es factura. Validez del precio congelado hasta 2026-10-20.

## Autorización y ejecución real completada

El propietario autorizó expresamente una consulta real del caso sintético preparado con techo total USD 0,60. Tras el apagón se continuó esa misma consulta: una llamada a cada proveedor, sin repetir Jev ni Luna. Estado final **HUMAN_REVIEW_PENDING**; Sol, Gemini y checker PASS. Costo estimado total USD 0.033777218, factura real no disponible. No se realizaron despliegues ni se autorizó gasto general para otros casos.

La salida de Luna había quedado detenida por ALLEGATION_PROMOTED_TO_FACT. Se conservó su artefacto original y el FAIL histórico. Una reparación determinista local recuperó un ID redundante de documento/fuente exclusivamente por coincidencia única exacta de versión y fragmento inmutables, y convirtió las afirmaciones sobre UNKNOWN en inferencias no verificadas. No se inventaron fragmentos ni se modificó el bundle aprobado. La etapa CONTEXT_CLASSIFICATION_REPAIR registra la transformación y cuesta cero. Solo después de validar offline y pasar regresiones se continuó con los dos proveedores pendientes.

El resultado real se dejó abierto en Asuntos → DEMO — revisión documental de un contrato → Junta y se guardó como borrador del asunto (versión ad7700f6), sin aprobarlo. Evidencias: `reports/real-run-before-continuation.json`, `reports/real-run-result.json`, `reports/real-run-saved-draft.png`. El formulario recupera su consulta persistida; se agregó además recuperación manual por ID con GET sin gasto y validación de pertenencia al asunto/estudio.

Regresiones actualizadas: **271/271 Core/Junta y 12/12 locales PASS** (`reports/real-run-repair-core-tests.json`, `reports/real-run-repair-tests.json`), compilación Junta/web y typecheck OS PASS. La regresión HTTP falsa verifica corrección de IDs redundantes, clasificación de cronología UNKNOWN, conservación del fallo original y continuación sin nuevas llamadas a Jev/Luna. Las referencias a fragmentos inexistentes siguen siendo rechazadas por el validador.

## Verificación

Typecheck/build web PASS. Regresiones Core/Junta **271/271 PASS** en `reports/connected-case-core-tests.json`. Pruebas locales **12/12 PASS** en `reports/connected-case-tests.json`: incluye la cadena completa con adaptadores reales y HTTP falso, integridad del original, versión duplicada, rechazo de gasto antes de cualquier request, prioridad de `.env`, resultado persistido y ausencia de replay. Los tests crean una autorización sintética en un directorio temporal aislado y nunca usan credenciales reales. La autorización de tests no habilita el servidor del usuario.

El navegador del usuario confirmó el botón Consultar Junta, la selección del original y la preparación sin gasto. El caso se dejó abierto en esa pantalla. La UI muestra progreso de solicitud y resultados por etapa; el estado de ejecución puede recuperarse tras recargar mediante su ID persistido. El formulario y el ID de preparación se guardan en una clave separada de localStorage; el respaldo general del Core no incluye todavía ese formulario. El bundle y los runs se conservan aparte en `.board-data/case-junta/`.
