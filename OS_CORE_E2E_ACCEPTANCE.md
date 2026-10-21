# Aceptación del vertical slice persistente

2026-10-13. **SPECIFIED / NOT_RUN / BLOCKED por ADR e infraestructura**. Las 42 pruebas sintéticas de `os-core/tests` son regresiones reutilizables y ya PASS; no satisfacen los casos HTTP/IdP/SQL/browser de este documento. Raíz: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/`.

## Entorno y reglas comunes

Objetivo posterior: browser Playwright→API real local→Supabase Auth local/PostgreSQL/Storage privados. Fixtures: estudio A/B; admin A/B, abogado A, revisor A, abogado sin participación A y usuario B. Son identidades efectivas en IdP de desarrollo con datos sintéticos, no mocks de Authenticator. Dos browsers/contextos aislados; tres sesiones para autor/revisor/intruso; pruebas SQL usando rol runtime. No proveedor LLM ni correo externo. Seed por harness de test, sin API de bootstrap abierta productiva.

En cada paso comprobar UI, HTTP status/body, filas SQL, objeto cuando corresponde y auditoría. Los eventos nombrados nuevos son propuestas, no funciones existentes. `F=/api/v1/firms/{firmId}`, `M=F/matters/{matterId}`. Idempotency-Key obligatorio en creación/mutación; CAS/If-Match cuando aplica. Nunca enviar actor/tenant como autoridad en body. Conservar IDs/revisiones para verificar en proceso nuevo; no comprobar solo DOM optimista.

## S01–S14: contrato por paso

### S01 — Crear estudio (formulario pendiente)

UI: wizard «Crear estudio», nombre y confirmación; API: todavía ninguna escritura empresarial hasta identidad verificada, guardar únicamente formulario temporal. Entidad: intención de onboarding en cliente, no LawFirm durable. Validación nombre1–240 trim; autorización: enrollment permitido, sin grants jurídicos. Pre: sin tenant; post: formulario pendiente, no estudio sin administrador. Persistencia: no filas law_firm/membership; no datos reales en localStorage. Auditoría: onboarding iniciado sin nombre privado si servidor emite enrollment. Error: nombre vacío/cancelación no crean filas. Test: completar formulario y cancelar deja cero tenants. Delta: Core actual crea firm+membership conjuntamente; se conserva esa invariancia.

### S02 — Crear identidad de administrador

UI: registro/verificación e inicio de sesión; API IdP por BFF `/api/v1/auth/*` y GET session; entidad Identity/app_session. Validación: issuer/audience/firma/vencimiento, contraseña/política IdP, identidad activa y email verificado cuando se usa; enrollment consumible no autoriza autodesignar rol en body. Pre: intención S01; post: identidad autenticada sin membresía todavía. Persistencia IdP + mirror y sesión opaca; no contraseña en SQL del dominio. Auditoría AUTH_IDENTITY_CREATED/LOGIN sin secreto. Errores: duplicado/credencial incorrecta/IdP no disponible, mensaje no enumera cuentas. Test: token inventado/expirado401; usuario registrado sin membership no puede leer estudio. Usar proveedor local real, no directorio de pruebas.

### S03 — Establecer membresía y rol con el estudio

UI: finalizar wizard; API POST /api/v1/firms `{name,enrollment_token}`→201 firm+membership (rol asignado servidor); entidad LawFirm/Membership/Activity/idempotency. Validación: enrollment vigente, identidad verificada, nombre; autorización bootstrap acotada. Pre: S02 identidad sin firm; post: estudio y admin activos juntos. Persistencia: una tx SQL inserta firm/member/FIRM_CREATED; error rollback sin tenant huérfano; enrollment/idempotencia no permite duplicar. Auditoría FIRM_CREATED con actor/ID/fecha. Errores: enrollment consumido409, sesión401, error SQL503 sin inserciones parciales. Test: doble click mismo key mismo ID; inyectar fallo al crear membership deja cero firms; recarga muestra estudio. S01–S03 resuelven orden UI sin romper atomicidad.

### S04 — Incorporar segundo abogado

UI: seleccionar identidad de prueba ya creada/verificada, rol LAWYER; API POST F/memberships `{identity_id,role}`→201. Entidad Membership; validación identidad activa/misma referencia issuer/subject y no duplicado. Autorización admin A activo. Pre: abogado sin membership; post: member A, sin acceso universal a asuntos. Persistencia membership+MEMBER_ADDED misma tx. Errores: ID no disponible422, rol inválido400, no admin403, duplicado409. Test: abogado puede autenticar pero no crear membresías; admin B no puede operar F; no invitar por email externo en slice.

### S05 — Crear cliente

UI: formulario compacto PERSON/ORGANIZATION/nombre/identificación opcional; API POST F/clients→201 y GET F/clients/{id}. Entidad Client/grant directorio según política aprobada. Validación schema estricto y tenant servidor; autorización escritor con permiso de intake. Pre: firma activa; post: cliente A, distinto de contacto/usuario/parte contraria. Persistencia Client+CLIENT_CREATED, sin filas B. Errores: payload tenant inyectado400, sin permiso403/404, duplicación de reintento devuelve mismo cliente. Test: consulta desde B404 sin título/nombre; decisión de directorio global pendiente debe cerrarse antes de ejecutar test de muro de clientes.

### S06 — Abrir asunto

UI: nuevo asunto consultivo con cliente/título/materia/fecha; API POST F/matters MatterInput→201; entidad Matter/participants. Validación client pertenece A, closed_on null, responsable jurídico activo. Autorización rol jurídico creador; grants directorio para cliente. Pre: cliente A y members; post: asunto OPEN con creador+responsable participantes explícitos. Persistencia Matter+participaciones+MATTER_CREATED en tx. Errores: client B o responsable B404/422, fecha inválida400, nuevo cerrado422. Test: consultivo sin número judicial funciona; litigioso separado puede tener0..N procedimientos, no forzar expediente inexistente.

### S07 — Asignar abogado responsable

UI: selector de responsable en alta S06, y reasignación explícita en detalle; API alta incluye responsible_identity_id, posterior PUT M/responsible con If-Match→200. Entidad Matter/MatterParticipant. Validación miembro jurídico activo y versión; autorización MANAGE. Pre: asunto con responsable inicial (invariante); post: abogado seleccionado responsable con participación suficiente. Persistencia cambio+grant+RESPONSIBLE_CHANGED juntos (evento nuevo). Errores: CAS409, revocado422, sin MANAGE403; nunca quitar participación de responsable activo. Test: carrera reasignación/revocación no deja responsable inactivo; API nueva todavía no implementada en Core actual.

### S08 — Incorporar documento

UI: «Incorporar original», progreso/validación y publicación explícita; APIs POST M/documents, POST uploads, PUT content, POST finalization, POST publication. Entidades Document/intent/blob/DocumentVersion. Validar bytes≤20MiB propuestos, MIME detectado, checksum calculado servidor, estado limpio y pertenencia. Autorización DOCUMENT_WRITE en cada etapa. Pre: sin versión vigente; post: original disponible y versión elegida publicada, bytes intactos. Persistencia etapas privadas y tx catálogo/publicación CAS según OS_CORE_DATA_API_CONTRACTS. Auditoría DOCUMENT_CREATED/VERSION_INCORPORATED/VERSION_PUBLISHED, sin contenido. Errores413/415/422, fallo blob/SQL503 sin publicación parcial. Test: descargar y cotejar SHA contra fixture tras reiniciar API; intent de B404; no overwrite ni publicación por orden de carga.

### S09 — Crear tarea

UI: tarea compacta con responsable y fecha interna opcional; API POST M/tasks→201. Entidad Task INTERNAL; validar título/fecha UTC y responsable activo con participación. Autorización TASK_WRITE; pre asunto abierto, post tarea PENDING. Persistencia Task+TASK_CREATED+outbox si aplica misma tx. Error: responsable ajeno404/422, doble click mismo key no duplica. Test: Mi día del responsable la muestra desde SQL, no en lista de B; fecha se etiqueta interna, no plazo procesal confirmado.

### S10 — Consultar desde usuario autorizado

UI: segundo abogado inicia sesión en browser nuevo y abre asunto; API GET M, docs/tasks/activity→200. Entidades leídas Matter y recursos autorizados. Validación sesión vigente y grants actuales; autorización membership+capacidad+participación READ+scope exacto. Pre sesión nueva, post datos reales visibles. Persistencia sin mutación dominio; ACCESS_GRANTED en auditoría de lectura con IDs mínimos. Error: sesión revocada401, grant revocado404. Test: cerrar proceso API/reabrir, nuevo contexto y login conserva cliente/asunto/tarea/bytes; sin depender de caché de navegador ni memoria del proceso anterior.

### S11 — Denegar usuario no autorizado

UI: intruso de B y miembro A sin participación pegan URL/IDs conocidos; API GET M/content/search/export→404; operación global prohibida403 si recurso ya conocido legítimamente. Entidad objetivo no se devuelve ni muta; validar sesión legítima para probar autorización, no solo login. Pre intruso autenticado, post no contenido/conteos/snippets/links. Persistencia cero escrituras dominio, ACCESS_DENIED en canal audit separado del rollback. Error público genérico sin existencia/nombre del recurso. Test: HTTP directo y SQL runtime rechazan ambos intrusos; UUID aleatoria misma forma de respuesta; auditar denegación sin cuerpo privado.

### S12 — Preparar borrador

UI: editor texto plano con asunto/título, guardar; API POST M/drafts→201. Entidades Document DRAFT/Version/Draft; validación contenido1..1M caracteres, encoding, display escapado. Autorización DRAFT_WRITE; pre no borrador, post DRAFT con autor/versión/SHA exactos. Persistencia bytes privados disponibles+catálogo/draft+actividad atómicos en catálogo, etapas según blob. Auditoría DRAFT_CREATED. Errores400/413/503; no sanitizar destruyendo original sin conservarlo, no ejecutar HTML. Test: autor y versión sobreviven nueva sesión, autosave/reintento no aprueban, IA apagada.

### S13 — Enviar a revisión

UI: elegir revisor habilitado y versión, confirmar «Solicitar revisión»; API POST M/drafts/{id}/reviews `{reviewer_identity_id,internal_due_at,expected_version_id}`→201. Entidades DraftReview/Task/Draft. Validación revisor distinto autor, activo con DRAFT_REVIEW, versión vigente y estado DRAFT/CHANGES_REQUESTED. Autorización autor con DRAFT_WRITE o MANAGE según caso. Pre DRAFT; post IN_REVIEW, review/task PENDING de versión exacta. Persistencia todas filas+REVIEW_REQUESTED una tx. Errores SELF_REVIEW_FORBIDDEN422, VERSION_CONFLICT409, revocado404/422. Test: revisor ve tarea en Mi día nuevo browser; autor no puede revisar por editar body; no notificación externa requerida.

### S14 — Aprobar versión exacta

UI: revisor abre versión, ve ID/hash, acción «Aprobar esta versión» y confirmación explícita; API POST M/reviews/{id}/decisions `{decision:'APPROVE',expected_version_id,explicitly_confirmed:true}`→200. Entidades Review/Draft/Task/DocumentApproval/Activity. Validación pending, revisor designado distinto autor, versión coincide review y draft, sesión/grant siguen activos; autorización DRAFT_REVIEW. Pre IN_REVIEW; post APPROVED solo esa versión, task DONE, approval append-only. Persistencia una tx con CAS/locks, actor/fecha/hash exactos y DRAFT_APPROVED. Errores409 versión/estado,422 confirmación ausente/false,404 revisor ajeno. Test: nueva sesión/restart preserva aprobación; descargar/completar tarea no aprueban; editar aV2 no hereda aprobación deV1; dos decisiones concurrentes producen una sola aprobación.

## Regresiones empresariales adicionales obligatorias

| ID | Escenario / resultado esperado | Capa y evidencia |
|---|---|---|
| SEC01 | JWT inventado/issuer-audience erróneos/expirado →401 | HTTP+IdP, no stub |
| SEC02 | Cookie sin CSRF/Origin válido en mutación →rechazo, cero cambios | Browser/HTTP |
| SEC03 | Membership o participante revocado entre carga y comando →rechazo; carrera serializada | Dos conexiones SQL+HTTP |
| SEC04 | Reutilizar conexión pool A→B sin contaminación de SET LOCAL | SQL rol runtime |
| SEC05 | Roles técnica/finanzas/portal no leen original legal por privilegio global | API/RLS/storage; mientras no implementados, endpoints deshabilitados |
| SEC06 | Listados/búsqueda/facetas/descargas/export/jobs no filtran datos B | API+SQL+worker, cache y nuevos contextos |
| DOC01 | CargarV2 antes/después deV1 no cambia publicación sin CAS explícito | SQL+UI; preservar originals |
| DOC02 | Editar durante review supersede review y cancela tarea; aprobación vieja409 | HTTP concurrente+SQL |
| DOC03 | Aprobar y después editar deja approvalV1 histórica, V2 DRAFT | SQL+browser |
| DOC04 | Hash/blob alterado →bloqueo de descarga/IA, alarma sin publicar | Storage+API |
| DOC05 | Falla upload/finalización/commit deja staging privado, reconciliación idempotente | Fault injection de infraestructura local |
| DOC06 | Intent/versión ajena/copiar key no permite leer/escribir | HTTP/storage policies |
| DOC07 | Descargar o task DONE no equivale aprobación/entrega/presentación | API+SQL+UI |
| DOC08 | Manifest anexos orden/hash reproducible, original intacto | Export privado; entrega con recibo separado |
| TX01 | Fallo actividad/outbox revierte dominio; denegación sí auditada aparte | SQL fault injection |
| TX02 | Mismo idempotency key/cuerpo →mismo ID; cuerpo distinto409 | HTTP doble click y dos conexiones |
| TX03 | Reinicio API/worker/DB y nueva sesión conservan bytes/estados/grants | Proceso nuevo; no mocks |
| OPS01 | Restore aislado DB+objetos+config conserva slice/hash/permiso | Runbook con duración y RPO medidos |
| UI01 | Densidad/rangos/foco/teclado/zoom/reflow cumplen spec | Screens1440/1366 a100%, referencia85%, mediciones |
| AI01 | Caída/ausencia de todos proveedores IA no afecta S01–S14 | Red modelos bloqueada, ningún gasto |

Criterio PASS del slice: todos S01–S14 y SEC/TX/DOC pertinentes pasan con backend/BD/IdP reales del ambiente, evidencia nueva fechada, cero críticos abiertos. Los módulos futuros SEC05/SEC06 se prueban deshabilitados hasta implementarse; no marcar su funcionalidad futura DONE. F4 completo agrega entrega/presentación/annex, F9 agrega piloto real aprobado. No afirmar producción a partir de localhost. No ejecutar ni fabricar estas pruebas hasta contar con app e infraestructura aprobadas.
