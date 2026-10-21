# Elena — piloto contractual local offline

Informe de la entrega inicial, conservado como historial. La ampliación posterior implementa [Dashboard, Director y Equipo jurídico local](EQUIPO_JURIDICO_LOCAL_2026-10-15.md); el piloto descrito aquí sigue accesible desde «Historial y herramientas anteriores». Sus exclusiones de alcance ya no describen toda la aplicación actual.

15/10/2026, America/Asuncion. Autorización: [ADR reconciliado aceptado](ADR_SPECIALIST_STUDIO_002.md), datos sintéticos, pruebas offline, cero inferencia paga y cero despliegues.

## Qué quedó implementado

Dentro del asunto, «Equipo jurídico» abre a Elena para Contratos y obligaciones. El catálogo de seis ya no domina Mi día/Trabajo jurídico ni se repite permanentemente en la consulta. Las seis identidades/assets se conservan. El Dashboard y el Director conversacional completo son trabajo posterior; no se presentan como implementados.

1. Confirmación humana de titular con versión esperada e idempotencia por comando. El responsable humano sigue siendo el canónico de Matter; Elena no es un Identity/Membership.
2. Selección de hasta cuatro textos UTF-8/24 KB y pregunta. Preparar congela versiones, hashes, asignación e inventario de originales; no ejecuta análisis. Vence a los 30 minutos.
3. Ejecución autorizada separadamente, exclusivamente OFFLINE_SIMULATION y USD 0. Etapas documentales de selección, organización de contexto, reglas contractuales y control final; ninguna llamada a proveedor. Todas las líneas seleccionadas se conservan, también excepciones/contradicciones.
4. Observaciones con documento, versión, posición y texto exacto: prestaciones, condiciones, excepciones, importes, remisiones a anexos, representación y revisión de versiones. Texto ilegible, ausencia de patrones o anexos faltantes dejan NEEDS_MORE_EVIDENCE.
5. Historial persistente y exportación del Markdown exacto controlado. Repetir el mismo plan no crea otro run ni trabajo oculto.
6. Guardado idempotente como Draft mediante Core, con auditoría ligada a DocumentVersion. Editar no hereda el control de la nueva versión; comprobación explícita crea otro vínculo/auditoría, sin modificar la histórica. DraftReview y aprobación humana siguen separados.

Un cambio de responsable, asignación, original añadido o versión seleccionada marca el trabajo histórico OUTDATED. No borra salidas ni lanza otra ejecución. Otro actor/asunto/estudio se somete a la autorización existente; el modo local con perfiles editables sigue siendo exclusivamente sintético, sin seguridad empresarial.

## Cómo usarlo

Abrir http://127.0.0.1:4313/ y recargar para tomar el build local. Elegir un asunto sintético → Equipo jurídico → confirmar datos sintéticos → Confirmar a Elena como titular. Incorporar TXT en Documentos o cargar el contrato sintético de ejemplo, seleccionar los textos, preparar y ejecutar el piloto offline. El ejemplo incluye precios diferentes, una condición, una excepción, representación no respaldada y Anexo B ausente.

El resultado permite ver localizadores, descargar el texto controlado y guardar un borrador. La edición/revisión se realiza en Borradores/Revisiones. Al volver a Equipo jurídico, cualquier versión de borrador nueva aparece con control pendiente y ofrece comprobarla explícitamente.

«Consultas anteriores del asunto» conserva la ruta fija anterior y su historial, cargada solo al abrirla. No se ejecutó esa consulta ni se reutilizó su autorización paga para el piloto.

## Control de fuentes y límites

Se reutilizó la gramática del extractor bibliográfico existente, separándola de Node sin cambiar IDs ni comportamiento de su wrapper legacy. El piloto recopila pregunta, selección documental, contexto, opinión y artefacto final con hashes/autoría. Falta un output o cambia el artefacto después del control → rechazo; en lectura/importación se verifican auditoría, evidencia y localizadores.

Este piloto **no dispone de ámbito oficial autenticado** ni llama al RAG de Biblioteca. Una mención jurídica extraída o ambigua queda REVIEW_REQUIRED / NO_TRUSTED_OFFICIAL_SCOPE; no recibe VERIFIED. Cero menciones produce NO_REFERENCES, nunca «todo verificado». La gramática conserva límites conocidos; reunir todas las salidas no implica detectar universalmente cualquier cita natural.

La Biblioteca y sus jobs/OCR no fueron modificados ni reiniciados. No hay otro registro de fuentes. La ruta fija conserva su checker y limitaciones históricas; el piloto no la reetiqueta ni afirma haber corregido retrospectivamente sus runs.

Es un ejercicio documental **determinístico**, no una opinión jurídica generativa de Luna ni una demostración de que Elena supera al generalista. No interpreta cumplimiento, exigibilidad, validez, normas, plazos o tasas. Corpus por subperfil, modelos, curaduría, evaluación jurídica/holdout, multidisciplina, adversario, potencia y voz siguen sin habilitar.

## Persistencia y reversión

Extensión opcional `specialist_pilot` del respaldo local v1: assignments, plans, runs, draft_links y fixture_commands. Se conserva el resto del Core y sus IDs. Backups anteriores sin extensión se importan; backups nuevos incluyen el piloto y se validan antes del reemplazo. Las mutaciones participan de la misma transacción local: conflicto/quota/fallo conserva el estado previo.

Rutas de navegador: `/firms/:firm/matters/:matter/contractual-pilot` y acciones assign/fixture/prepare/run/draft/recheck mediante localRequest. No son nuevos endpoints HTTP productivos; el modo servidor conserva la consulta previa y no recibió migraciones. Auditoría de actividad suma cuatro códigos sin incluir texto privado.

Respaldo de los archivos iniciales editados: `local-browser/reports/elena-pilot-baseline/`. No constituye backup completo del workspace ni de datos de usuario. Git sigue sin primer commit: no se crearon ramas, commits, reset, clean o push.

## Verificación reproducible

`npm.cmd run typecheck`; `npm.cmd run os:typecheck`; `npm.cmd run board:test`; `npm.cmd run os:build:web`; `npm.cmd run os:test:local`.

Evidencia del recorrido de navegador: `local-browser/reports/elena-pilot/browser.json`, capturas 1366×768 y 1440×900. Pruebas nuevas: `contractual-pilot.test.ts` y `contractual-pilot-browser.test.ts`. Informe final de checks/alcance: `local-browser/reports/elena-pilot/delivery.json`.

Los ejemplos de desarrollo y pruebas de workflow no se convierten en holdout ni evaluación jurídica. G2_OFFLINE es el alcance de esta entrega; G2 generativo completo y G3–G6 no se marcan DONE.
