# Runbook después de la auditoría

Requisitos: Node >=22 (probado con 24.20.0) y npm. En PowerShell usar npm.cmd. Ejecutar desde la raíz.

    npm.cmd ci --ignore-scripts --cache .npm-cache
    npm.cmd run typecheck
    npm.cmd run board:test
    npm.cmd run board:smoke:offline -- --request-id demo-remediation-v2 --data-dir .board-data/remediation-v2
    npm.cmd run board:benchmark:offline

Para compartir el proyecto entre Windows/Linux, excluir node_modules y ejecutar npm ci en el sistema destino. No copiar bindings nativos de Windows a Linux. Los scripts soportan rutas con &.

La CLI compila primero. El smoke por defecto usa ahora demo-offline-v2: los identificadores V1 se reservan para históricos. La política de verificación V2 altera el hash de idempotencia; no reutilizar request_id de la política anterior. No borrar históricos para forzar reutilización.

## Consultar y exportar

Obtener run_id de reports/smoke-offline.json. Para el smoke de remediación:

    npm.cmd run board:show -- --data-dir .board-data/remediation-v2 --run-id RUN_ID --study estudio-demo --matter asunto-demo --user abogado-demo

Repetir el smoke con iguales argumentos conserva run y costo. Stdout real muestra solo estado/costos/IDs. --output resultado-local.json crea un export local sin sobrescribir; contiene borrador/evidencia y requiere permisos del operador.

Las exportaciones recalculan el checker. Para verificar fuentes oficiales también al consultar, aportar --trust-file verificadores-aprobados.json. Sin configuración de confianza la exportación muestra REVIEW_REQUIRED, incluso si un histórico tenía VERIFIED. Firmas vencidas o claves retiradas dejan de conceder verificación.

## Procedencia y corpus

ingestText solo acepta verification_status=UNVERIFIED (o UNAVAILABLE) y authority_record=null. No usar esos campos para conceder oficialidad. Los fixtures son explícitamente sintéticos.

La configuración de confianza es un array externo al bundle con key_id, verified_by, public_key_pem Ed25519 y allowed_hosts. Debe administrarlo el operador/host autorizado, nunca copiarlo desde documentos, modelos ni bundles no confiables. No se incluye una clave privada ni servicio que emita atestaciones.

Un verificador externo debe contrastar canal oficial, bytes, extracción, metadatos y derechos antes de emitir OfficialAttestation. El esquema y attestationMessage están en src/ingestion/provenance.ts; importAttestedText valida texto y firma sin red. Las firmas de tests son desechables y no representan organismos estatales.

El bundle contiene actor confiable, request, documents, originals (versión/base64), attestations y current_document_versions. validateEvidenceBundle valida originales, extracción exacta, atestaciones y snapshots antes de cualquier red. No admite claves de confianza dentro del bundle. Varias versiones requieren una publicación vigente explícita; agregar una versión no cambia el puntero.

## Configuración de modelos y costo

.env.example enumera variables; no se carga .env implícitamente. La inspección local de presencia no usa red:

    npm.cmd run board:connectivity

Consultar metadatos solo cuando corresponda, con connectivity --verify explícito. No se ejecutó esa verificación en esta remediación. No se infiere acceso de cuenta desde documentación ni se sustituyen modelos/aliases.

BOARD_AUDITOR_MAX_INPUT_TOKENS conserva 100000 por defecto; BOARD_AUDITOR_MAX_OUTPUT_TOKENS, 16000. Los límites configurados deben caber en los límites afirmativos del modelo; ausencia/insuficiencia bloquean. Entradas excesivas guardan audit-coverage y dejan PARTIAL sin truncar ni fragmentar automáticamente.

Antes de cualquier llamada se reserva el menor techo entre request y configuración con tarifas por ID exacto, source y as_of_date, mode=STANDARD. Falta de tarifa bloquea. Cotas previas por bytes + 2048 son operativas, no tokenizer/factura. Sol conserva medium y max_output_tokens=25000.

## Ejecución real futura, no ejecutada

Requiere corpus con atestaciones confiables, claves/modelos/ventanas y tarifas validadas, más autorización futura expresa de gasto:

    node --env-file=.env scripts/board.mjs live --bundle evidencia-autorizada.json --trust-file verificadores-aprobados.json --price-file tarifas-validadas.json --authorize-paid-calls

Sin flag se bloquea antes de leer el bundle. Sin originales o atestaciones válidas se bloquea antes de consultar modelos. La biblioteca también exige authorize_paid_calls=true. La instrucción vigente del usuario prohíbe llamadas pagas y despliegues: no ejecutar el comando durante esta remediación.

## Fallas y recuperación

Citas pendientes, fuentes no comprobadas o citas textuales inválidas dejan PARTIAL y reference_verification=REVIEW_REQUIRED. Ninguna etiqueta de verificación se exporta mientras el gate esté abierto. El borrador parcial se conserva para revisión humana; no hay aprobación automática.

Solo se reintentan rechazos 429 acotados. Timeouts, HTTP 500 y transporte incierto conservan reserva y no se repiten automáticamente. SIGINT cancela.

    npm.cmd run board:recover -- --study ESTUDIO --matter ASUNTO --user USUARIO --run-id RUN_ID --ack-no-replay

Recuperar exige que el propietario del lock haya terminado y deja PARTIAL, sin replay. Revisar consumo externo antes de decidir una solicitud nueva. La persistencia local contiene evidencia y carece de cifrado/HA; no es almacenamiento productivo.

