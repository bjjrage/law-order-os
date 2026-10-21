# Contratos de dirección, asignación, convocatoria y gasto

Actualización de implementación: [recorrido local del 15/10/2026](EQUIPO_JURIDICO_LOCAL_2026-10-15.md). Ya existen comandos locales de enlace atómico/idempotente, asignación CAS, preparación y ejecución experimental. Las secciones generativas y de gasto siguientes continúan como diseño; no se activaron proveedores.

Actualización documental: 15/10/2026, America/Asuncion. Referencia de decisiones/handoff: 14/10/2026; propuestas aún sin aprobación funcional.

Estado: PROPOSED. Dependencia: [ADR](ADR_SPECIALIST_STUDIO_002.md), decisiones P01/P02-R1/P07–P14. Son contratos lógicos a implementar después de aprobación, no APIs disponibles.

## Correspondencia con el sistema real

| Concepto | Reutilización / diferencia |
|---|---|
| `study_id` | Corresponde exactamente a `Matter.law_firm_id`; traducción explícita al Scope de Junta, nunca buscar por nombre |
| `human_owner_id` | `Matter.responsible_identity_id`, validado por Core; capturado en versión/ejecución, no segunda autoridad mutable |
| `actor_id` | Identidad humana del host. Actualmente perfil sintético sin autenticación; producción exige sesión validada |
| Asunto | `Matter.id`; no crear un Matter por especialista ni convertir consultivo en expediente judicial |
| Asignación IA | Extensión versionada que hoy falta en CoreTables/BrowserPersistence/SQL; no un Membership/Identity |
| Plan | Reusar delimitación y presupuesto de `prepareIssuePlan`; ese contrato actual no tiene selección de perfil |
| Ejecución/evidencia | Reusar RequestSchema, EvidenceSnapshot, EvidencePack, LegalCasePacket y BoardStore/artifacts mediante adaptadores versionados |
| Consentimiento | Extender la semántica existente de prepared_id/hash/techo/vencimiento; la aprobación vieja USD 0,60 no autoriza plan nuevo |

## Director conversacional e ingreso previo al asunto — propuesta R1

Gabriel identifica tipo de encargo, pregunta, jurisdicción, fecha, evidencia faltante y especialistas pertinentes; devuelve preguntas de delimitación y propuesta estructurada. No analiza mérito, redacta dictamen, decide controversias, valida fuentes ni integra opiniones. No se presenta como profesional humano.

P02-R1 sustituye el destino solo-reglas por conversación generativa acotada. Si se usa formulario/reglas en el piloto, indicarlo y no fingir respuesta generativa. Una consulta operativa resoluble con Core se deriva a lectura autorizada sin LLM.

### IntakeDraft v1, sin registro paralelo de expedientes

Contrato lógico todavía inexistente: `intake_draft_id`, `schema_version`, `study_id`, `actor_id`, `session_id`, `question_draft`, `scope_inputs`, `jurisdiction`, `as_of_date`, `proposed_team[]`, `existing_matter_id?`, `coordination_grant_id?`, `draft_version`, `content_hash`, `created_at`, `expires_at`, `status`.

Estados propuestos: DRAFT / CLARIFYING / READY_TO_LINK / LINKED / CANCELLED / EXPIRED. Antes del enlace no existe MatterAiAssignment ni autorización de acceso por asunto. Mantener el borrador en sesión; no introducir una tabla de expedientes ni almacenamiento documental alternativo. Cualquier retención durable futura requiere contrato explícito y política de borrado. Inicialmente solo descripción sintética mínima; no cargas privadas preasunto.

El humano elige asunto accesible o completa la creación existente mediante Core. El host valida estudio/permisos; conocer/mencionar ID no autoriza lectura. Registrar el Matter retornado y evitar duplicarlo ante un fallo de respuesta. api.ts tiene Idempotency-Key en el camino servidor, pero localRequest/createMatter no acreditan idempotencia de alta: el adaptador local necesita un contrato probado de comando/enlace antes de permitir reintentos de resultado incierto. No asumir que Core ya deduplica esos intentos. Un fallo de enlace conserva el borrador y no ejecuta especialistas. Cambiar asunto invalida planes, snapshots y consentimientos dependientes; no transfiere documentos ni historial a otro asunto.

Después del enlace, resolver responsable humano canónico y evidencia autorizada, congelar versión del borrador, crear propuesta de assignment/ChiefDispatchPlan del asunto. Gabriel no llama autónomamente createMatter ni persiste asignaciones.

### CoordinationGrant v1 y separación del gasto

Campos propuestos: `grant_id`, `study_id`, `actor_id`, `intake_draft_id`, `purpose=SCOPING_ONLY`, `authorized_data_scope`, `conversation_policy_version`, `internal_model_policy_hash`, `price_snapshot_hash`, `max_turns`, `max_tokens_per_turn`, `max_total_cost`, `engagement_budget_id`, `expires_at`, `status`.

Antes de la primera llamada, humano autoriza alcance/datos, límites y techo informados. Cada envío es acción explícita dentro del grant; abrir Dashboard/seleccionar personaje no llama. El host reserva antes de cada turno y detiene ante techo, expiración, cancelación o cambio de alcance/precios/política que invalide el grant. No exige reaprobar un turno idéntico dentro del alcance vigente, ni interpreta silencio como autorización.

El ledger de reserva central incorpora coordinación y análisis si forman el mismo encargo; ninguna fase reinicia el techo ni multiplica reservas por persona. Confirmar equipo no concede autorización de análisis. El análisis exige su consentimiento exacto de plan/evidencia/participantes/debate/profundidad y se enlaza al presupuesto central. Un grant conversacional nunca habilita especialistas, fuentes nuevas, Sol, adversario ni entregas.

## MatterAiAssignment v1

Campos requeridos: `assignment_id`, `schema_version`, `study_id`, `matter_id`, `human_owner_id`, `ai_lead_profile_id`, `profile_version`, `assignment_version`, `assigned_at`, `assigned_by`, `status`, `supersedes_assignment_id`, `routing_policy_version`.

`status`: propuesta ACTIVE / SUPERSEDED / REVOKED. Una única asignación activa por `(study_id,matter_id)`. Primera asignación exige confirmación humana P01; siguiente exige `expected_assignment_version`, permiso MANAGE y razón. Conflicto concurrente rechaza sin sobrescribir. Repetir mismo command_id/payload devuelve el resultado; cambiar payload con mismo ID produce conflicto. Conservar historial y evento con IDs, no texto privado en Activity.

Un asunto existente sin titular no se migra/reasigna automáticamente ni se bloquea para tareas convencionales: se propone titular cuando se abre el primer encargo IA. La obligación humano+titular rige al activar esa capacidad. Revocar participante o cambiar responsable invalida planes/consentimientos todavía no ejecutados; no altera autorías históricas ni lanza proveedores.

## ChiefDispatchPlan v1

| Campo | Tipo / regla |
|---|---|
| Identidad | `plan_id`, `schema_version`, `request_id`, `study_id`, `matter_id`, `requested_by` obligatorios |
| Encargo | `question`, `scope`, `jurisdiction`, `as_of_date`, `missing_scope_inputs[]`, `intake_draft_ref?`; una pregunta delimitada |
| Asignación | `assignment_id`, `assignment_version`, `selected_lead {profile_id,version,practice_area_id,subprofile_id,subprofile_version}`; respetar elección humana y el alcance del subperfil |
| Convocados | `invited_specialties[{profile_id,version,practice_area_id,subprofile_id,subprofile_version,assigned_question,reason_code}]`; áreas del catálogo aprobado, IDs únicos, no repetir titular como invitado |
| Motivos | `routing_reasons[{profile_id,reason_code,evidence_ids[]}]`; clasifican tipo/alcance, no conclusión jurídica |
| Evidencia | `matter_snapshot_id`, `corpus_snapshot_id`, `evidence_snapshot_id` y hashes; mapear snapshot compuesto actual sin fingir separación ya implementada |
| Uso previsto | `estimated_usage` por participante/modelo/tarea, precios con origen/fecha/validez, incertidumbre y techo total |
| Gobierno | `requires_human_approval`, `approval_status`, `execution_authorization_id?`, `engagement_budget_id`, `policy_version`, `plan_hash`, `created_at`, `expires_at` |
| Modalidades | `team_mode=FOCAL/SPECIALIZED/FULL_BOARD`, `depth_by_participant`, `adversarial_review`; ejes independientes, sin ejecutar por selección |

Estados propuestos del plan: DRAFT → NEEDS_CLARIFICATION / PENDING_APPROVAL → APPROVED → EXECUTING → CLOSED; alternativas REJECTED, EXPIRED, INVALIDATED. APPROVED en este plan significa equipo/alcance confirmados; EXECUTING exige además consentimiento de análisis vigente y reserva central. Aprobar un plan no ejecuta, no aprueba conclusiones ni documentos.

Modo asistido por reglas para el piloto, si se selecciona explícitamente: respetar perfil explícito; si falta, comparar materia/encargo contra catálogo habilitado; si hay ambigüedad, pedir aclaración. No ejecutar seis especialistas para compensar incertidumbre. Una selección fuera de alcance devuelve advertencia y propuesta, sin sustituirla silenciosamente. Una cuestión operativa resoluble por datos del Core se deriva a esa consulta sin LLM.

El Director y su modo asistido solo disponen de catálogo, metadatos necesarios y descripción autorizada del encargo. No puede persistir asignación, gastar, potenciar, adjudicar mérito, autenticar fuentes o abrir otro asunto. Ninguna orden encontrada en documentos cambia estos límites. La salida se valida mediante schema cerrado y códigos de motivos; texto jurídico/citas inesperados impiden tratarla como plan válido y se conservan para auditoría.

## Convocatoria

Cada invitación conserva área/subperfil, pregunta acotada, justificación, snapshot común, evidencia suplementaria autorizada, versión de perfil, límite de gasto/tiempo/tokens y condición de participación. El humano puede agregar/quitar antes de aprobar; cambia `plan_hash` y obliga a nueva estimación/consentimiento. Durante ejecución, modificar equipo crea otra edición del plan. No cancelar ocultamente trabajos que ya pudieron facturarse.

El catálogo de seis áreas no convoca una junta completa: el selector muestra áreas/personas disponibles y la vista del asunto solo titular/invitados. Si el subperfil requerido no está habilitado con fuentes/evaluación pertinentes, Chief informa la carencia y pide delimitar/revisar; no presupone que un área amplia ya domina todas sus subespecialidades. Coordinación y adversario no consumen uno de los seis lugares del catálogo.

El perfil recibe un subconjunto explícito sin borrar del índice los originales o contradicciones. La evidencia no seleccionada sigue recuperable según permiso. Requerir otra materia o evidencia crea una solicitud pendiente, no una nueva llamada automática. Cada opinión queda atribuida; invitado ausente/caído se muestra y puede producir resultado parcial, nunca consenso ficticio.

## Modalidades del equipo

Consulta focal: titular y pregunta propia. Equipo especializado: añadir solo subperfiles habilitados con encargo, razón y recursos acotados. Junta completa: seis áreas habilitadas, cada una con cuestión pertinente y subperfil/versionado; no significa cargar todos los 22 paquetes. Si falta una competencia o pregunta, informar y proponer equipo viable sin afirmar Junta completa ejecutada.

«Convocar Junta completa» prepara propuesta editable, no llamadas. Confirmar esa propuesta no activa adversario ni profundidad adicional. Santiago puede revisar cualquiera de las modalidades con autorización; Gabriel/Santiago no cuentan entre las seis áreas. Un usuario puede pedir mayor amplitud; el Director expone faltantes, costos y límites sin ocultar disciplinas ni sustituir perfiles silenciosamente.

Cambiar equipo, paquete, asunto, evidencia, profundidad o debate modifica versión/hash/estimación y exige consentimiento nuevo cuando afecta ejecución autorizada. No asumir que todos los especialistas tienen competencia por compartir motor. Fichas: [22 paquetes](SPECIALIST_CAPABILITY_PACKS.md).

## ManualPowerOverride v1

Campos: `override_id`, `schema_version`, `study_id`, `matter_id`, `request_id`, `plan_hash`, `requested_by`, `approved_by`, `scope=REQUEST_PROFILE`, `applies_to_profile {id,version}`, `from {model_id=gpt-6-luna}`, `to {model_id=gpt-6.1-sol,reasoning_effort=medium}`, `budget_approved`, `currency=USD`, `reason`, `approved_at`, `expires_at`, `status`.

Solo afecta tareas/opinión del perfil seleccionado dentro del encargo aprobado. El Context Builder conserva su contrato; un upgrade no transforma Jev, Chief, otros invitados ni Gemini en Sol. Si se solicita después de emitida la opinión, produce otra edición con vínculo a la anterior y auditoría final nueva. No existe fallback automático Luna→Sol ni reutilización del override en otra consulta/asunto.

El uso efectivo debe registrar `model_id` devuelto por proveedor exclusivamente en trazabilidad técnica interna. Diferencia con modelo autorizado bloquea salida y conserva uso/costo. La UI muestra «Profundidad: Estándar / Análisis profundo», sin nombres/versiones de modelos o proveedores, y conserva el mismo personaje humano 3D. El DTO público, estados, historial, errores, costos y exports excluyen identificadores técnicos; costos se atribuyen a persona/función. Cancelar/expirar antes de llamar evita esa llamada; cancelar después conserva costos conocidos/inciertos.

## Permisos, consentimiento y presupuesto

| Acción | Regla propuesta |
|---|---|
| Leer/asignar plan | READ para contenido; confirmar/reasignar titular requiere MANAGE y actor permitido |
| Ejecutar IA/autorizar gasto | Actor responsable habilitado por política explícita P07 + acceso actual; nunca inferido del rol IA ni solo de MANAGE |
| Invitar/quitar | MANAGE y consentimiento actualizado si cambia ejecución/costo |
| Persistir borrador | DRAFT_WRITE del actor humano; conservar autores IA como metadata |
| Aprobar documento | DRAFT_REVIEW, revisor distinto autor y versión exacta según Core actual |
| Entrega externa | Flujo de entregas existente, autorización separada; aprobar IA no presenta ni envía |

Estas capacidades IA son una propuesta adicional; MatterPermission hoy solo tiene READ/MANAGE/DOCUMENT_WRITE/TASK_WRITE/DRAFT_WRITE/DRAFT_REVIEW. No agregar permisos implícitos a roles existentes.

Consentimiento requerido: actor/alcance verificados, `plan_hash`, modelos, perfiles/versiones, snapshots, presupuesto total, precios válidos, debate/rondas, override, vencimiento y hash de payload. Ningún GET, seleccionar avatar, preparar evidencia ni abrir panel autoriza pago. Las claves siguen únicamente en host, fuera de bundles, localStorage, logs y contratos serializados.

Reserva central por encargo, atómica antes de cada llamada incluyendo workers concurrentes; límites por participante subordinados al total, no USD 0,60 multiplicado por N. Registrar entrada/salida/reasoning, latencia, intentos, costo estimado, factura real nullable, resultado incierto y reserva. Rondas/integración también cuestan. Error 401/429/timeout conserva parcial y no cambia modelo ni repite llamadas de resultado desconocido. Para G2 se propone cero retries pagos, como el escenario actual; revisar expresamente antes de cambiar.

## HumanDisposition v1

Campos: `disposition_id`, `schema_version`, `human_id`, `study_id`, `matter_id`, `run_id`, `final_version_id`, `final_content_hash`, `citation_audit_id`, `decision` (REVIEW/APPROVE/REJECT/REQUEST_CHANGES), `timestamp`, `outstanding_issues[]`, `document_version_id`, `draft_review_id`, `external_delivery_status` separado.

Reusar DraftReview para aprobación documental; disposición de análisis y aprobación de escrito no son intercambiables. `BoardRun.human_approval` hoy permanece PENDING: no basta cambiar ese string. Cambiar cita/texto crea versión nueva, invalida vínculo de comprobación y no arrastra aprobación. Una aceptación humana con fuentes pendientes registra excepciones, pero jamás convierte esas referencias en VERIFIED.

## Pruebas adicionales del ingreso y modalidades

Ingreso sin Matter no llama a ejecución jurídica; enlace a ID ajeno rechaza; creación idempotente no duplica asunto; cambio de asunto revoca plan; Director devuelve dictamen/cita inesperados → salida inválida con revisión; abrir Dashboard/grabar/confirmar equipo no cobra; grant agotado bloquea siguiente turno; coordinación+fan-out respetan un techo; FULL_BOARD con perfil faltante no simula seis; FOCAL puede autorizar adversario sin invitar otras áreas; asistencia por reglas no aparece como conversación generativa.

## Pruebas contractuales de aceptación

Plan no contiene dictamen; selección explícita se conserva; asignación concurrente conflictúa; tenant ajeno/ID conocido rechaza; cambio de responsable revoca plan pendiente; rol IA nunca autentica; invitación cambia hash; consentimiento expirado/modelo/snapshot/precio diferente bloquea; override solo perfil/encargo; fan-out no supera presupuesto central; clic de avatar no llama proveedores; reintento incierto no duplica gasto; guardar borrador no aprueba; nueva versión no hereda auditoría ni revisión.
