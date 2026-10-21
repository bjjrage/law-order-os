# Contratos de datos y API del primer OS

2026-10-13. **SPECIFICATION / NOT_IMPLEMENTED / sujeto a ADR OS-001**. Base de rutas: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/`. Reutilizar `os-core/src/contracts.ts`, `authorization.ts`, `service.ts`; los endpoints y tablas SQL de este documento todavía no existen.

## Versionado y compatibilidad

API `/api/v1`; JSON UTF-8, UUID emitido servidor (el Core actual admite IDs string de1–128), timestamps UTC ISO8601, fechas civiles YYYY-MM-DD con zona operativa America/Asuncion. No convertir fecha interna en plazo legal. `law_firm_id` es nombre canónico del Core y SQL; `study_id` de Blueprint se traduce en frontera, sin duplicar tenants. Parámetros de URL seleccionan contexto pero no conceden autorización. Rechazar body con actor/tenant/role no previstos y campos extra; schemas estrictos, límites y normalización explícita.

Cambios neutrales propuestos: CoreTransaction get/list/insert/replace retornan Promise; todo consumidor await; consultas paginadas con predicados SQL y sin cargar tenants completos. CorePersistence mantiene callback único/rollback y assurance veraz. DocumentVersion V2 separa blob_ref de original_base64; originales existentes se preservan, sin conversión silenciosa. Contratos antiguos y migración necesitan fixtures de compatibilidad y ADR aceptado; nuevas aprobaciones continúan ligadas al mismo ID/hash exacto. No se cambian contratos Junta en esta fase.

## Datos durables propuestos

Todas las tablas de tenant tienen `law_firm_id NOT NULL`; recursos de asunto también matter_id. PK id + UNIQUE(law_firm_id,id) y FKs compuestas impiden referencias entre estudios aun con acceso SQL directo. Recursos de documento/version incluyen pertenencia al mismo asunto/documento mediante FKs compuestas; nombres privados no van en claves de objetos. Mutables tienen `row_revision bigint >=1` para CAS. UNIQUE de membresía por firm/identity y participante por firm/matter/identity; el historial de revocación se conserva.

| Entidad | Campos/relaciones esenciales y restricciones | Estado actual / delta |
|---|---|---|
| identity | id, issuer, subject UNIQUE(issuer,subject), active, display_name; sin contraseña | Interfaz actual; espejo mínimo del IdP propuesto. No relacionar por email igual. |
| app_session | hash de ID opaco, identity, vencimiento, revoked_at, refresh cifrado, rotación | Nueva; token plano no se guarda en logs ni navegador JS. |
| law_firm / membership | nombre/fecha; identity, rol, active, revision | Existen contratos; estudio y primer admin atómicos, nunca cero administradores activos. |
| client / contact | PERSON/ORGANIZATION, identificación opcional; contacto separado del cliente | Existen; permisos de directorio pendientes, no deducir contacto=usuario. |
| matter / related_party | client_id, título/tipo/materia, responsable, fechas/estado; partes con rol | Existen; responsable activo participante, cierre/reasignación son casos nuevos. |
| matter_participant | identity, permisos, active, revision | Existe; concesión dentro del máximo de rol, READ obligatorio; no autoascenso. |
| proceeding | matter_id, jurisdicción, órgano, número nullable, estado, fuente de registro | Nueva, 0..N por asunto; no exige número/tribunal a consultivo. |
| document / document_version | propósito, current_version_id explícito; versión immutable SHA/MIME/tamaño/blob_ref/actor | Contrato actual bytes base64; V2 propone catálogo. FK current_version exige pertenencia exacta. |
| upload_intent / blob_object | firm/matter/doc/version, estado, bytes/hash, expiración, key servidor | Nuevas; staging→quarantine→available; objetos sin upsert. |
| task | asunto, responsable activo, título, INTERNAL/DRAFT_REVIEW, estado, internal_due_at | Existe; prioridad/consultas paginadas nuevos. Review task no admite completar por endpoint general. |
| draft / draft_review | autor, document/version, estado; revisor/version/decisión/fecha | Existen; autor≠revisor, revisión pendiente se supersede tras edición. |
| document_approval | version_id, review_id UNIQUE, actor, fecha, content_sha256 | Nueva materialización append-only; decisión actual vive en review+actividad. |
| delivery / filing_receipt | approved_version_id, tipo de acto, destinatario/órgano, fecha, receipt_blob/version | Nuevas F4; descarga no es entrega/presentación; no integración judicial automática. |
| activity / access_audit | códigos+IDs+fecha, actor; access_audit outcome/request_id | Activity existe sin contenido; auditoría de lectura/denegación nueva y separada. |
| idempotency / outbox | actor/firm/operation/key/hashrequest UNIQUE, resultado; evento/lease/intentos | Nuevas; mutación, actividad y outbox misma tx. No efectos externos dentro de callback SQL. |

No inventar relaciones N:M de clientes ya implementadas: hoy Matter tiene un client_id. Si piloto requiere varios clientes, introducir matter_party con roles/constraints en ADR adicional; RelatedParty actual no reemplaza representación de clientes.

## Seguridad verificable por capa

Sesión validada servidor → identidad activa → membresía actual → capacidad de rol → participación actual con permiso → pertenencia exacta del recurso/versión. Reevaluar en cada comando, download, búsqueda, export y comienzo de job. Revocación no espera refresco de JWT para grants en BD. Aislar caches por tenant+actor+versión de permisos o no cachear privados; nunca cache pública de Mi día.

SQL usa rol runtime no dueño/no BYPASSRLS, políticas tenant/matter en SELECT/INSERT/UPDATE/DELETE con USING/WITH CHECK; tablas inmutables rechazan UPDATE/DELETE al runtime. Tablas de negocio en schema privado no expuesto al Data API; grants mínimos. RLS evalúa identidad/membresía con helpers privados auditados que no causen recursión de políticas de membership/participants. No resolver recursión concediendo BYPASSRLS global: implementar y probar helper acotado con search_path fijo y EXECUTE restringido si excepcionalmente necesita SECURITY DEFINER. Vistas security_invoker o sin exposición. Tests directos SQL con rol runtime deben fallar aunque el servidor omita un filtro. [Guía RLS oficial](https://supabase.com/docs/guides/database/postgres/row-level-security).

| Actor / superficie | Política propuesta y diferencia actual |
|---|---|
| ADMINISTRATOR / director | Gestiona membresías; contenido requiere participación; conservar muro actual. Director de Blueprint no equivale a superusuario. |
| COORDINATOR / responsable | Responsable es relación de asunto, no sustitución de membership; poderes efectivos acotados. |
| LAWYER / colaborador | Puede crear asunto si política lo permite; acceso solo a asuntos participantes. |
| ASSISTANT | READ/DOCUMENT_WRITE/TASK_WRITE/DRAFT_WRITE según concesión, nunca revisión/aprobación ni MANAGE. |
| ADMINISTRATION / finanzas | Propuesta: capacidad financiera específica, sin documento/cuerpo legal implícito. Core permite READ máximo si participante: revisar antes de habilitar rol productivo. |
| technical_admin | Rol operativo independiente sin grants jurídicos; soporte excepcional temporal con autorización/auditoría pendiente. No existe en Core. |
| external_client | Identidad portal y permiso exclusivamente sobre versiones compartidas explícitas; no listar asuntos/documentos por ser contacto. No existe en Core. |

Conservar cinco roles actuales en slice local mientras se aprueba matriz; deshabilitar portal/roles nuevos y acceso financiero a contenido. Política propuesta del directorio de clientes: jurídico/asistente ve solo clientes con asunto autorizado o concesión explícita de intake; creador recibe concesión para terminar intake. Directorio global de conflictos necesita permiso distinto y resultado mínimo, no exposición de todos los asuntos. Este delta debe aprobarse y probarse; el acceso actual es por estudio y no se disfraza de muro implementado.

Búsqueda aplica permisos antes de producir resultados/snippets/facetas/conteos; paginación no filtra después de enviar. Contexto IA se arma exclusivamente por host desde snapshot autorizado y grants vigentes, usando acceso de Junta derivado; ningún actor/body frontend autoriza un run. IA permanece deshabilitada en F2–F4. Jobs con identidad técnica no reciben acceso universal: llevan alcance+actor solicitante y revalidan antes de leer/exportar. Finanzas no consume textos legales. Audit denegado se escribe en canal separado del rollback de dominio, sin incluir título, email, original ni cuerpo.

## Transporte, errores y concurrencia

`GET /api/v1/session` → `{identity:{id,display_name},memberships:[{law_firm_id,role}],expires_at}`; no tokens. Login/refresh/logout: `POST /api/v1/auth/{login,refresh,logout}`, cookie opaca HttpOnly; CSRF y Origin para mutaciones. Credenciales nunca dentro de comandos de dominio JSON. Alta de identidad es operación IdP, no `createLawFirm`.

Para siguientes rutas, prefijo `F=/api/v1/firms/{firmId}`, `M=F/matters/{matterId}`. Respuesta `{data,request_id}`; listas `{data,next_cursor}` con cursor opaco y límite inicial25/max100, orden estable created_at,id. Listas vacías son reales, sin datos simulados. Mutaciones POST llevan Idempotency-Key (UUID), hash de cuerpo y actor/tenant/operación en índice único; repetición idéntica conserva IDs/resultado, payload distinto409. Cambios de mutable `If-Match` con row_revision (falta428, conflicto409). La aprobación agrega expected_version_id y confirmación true; revisión exacta no depende solo del ETag.

| Método / ruta | Input → output y validación / autorización | Servicio actual que se reutiliza |
|---|---|---|
| POST /api/v1/firms | name1..240, enrollment token → firm+admin membership,201; identidad verificada, bootstrap permitido una vez por enrollment | createLawFirm, más control bootstrap nuevo |
| GET F | → estudio mínimo; miembro activo | getLawFirm |
| POST F/memberships | identity_id,role → membership,201; admin, target IdP activo, no duplicado | addMember; invitación externa fuera del slice |
| POST F/memberships/{id}/deactivation | revision →204; admin, no último admin | deactivateMember |
| POST/GET F/clients | kind/display_name/identification → cliente,201; lista cursor →200; grant directorio aprobado | createClient; listado nuevo |
| GET/PATCH F/clients/{id} | → cliente / cambios permitidos con revision; muro directorio | getClient; edición nueva |
| POST F/clients/{id}/contacts | display_name,email/phone nullable → contacto; cliente mismo tenant | createContact |
| POST/GET F/matters | input MatterInput; closed_on null, responsable activo →201/lista200 | createMatter / listado nuevo |
| GET M | → asunto200; READ y pertenencia | getMatter |
| PUT M/responsible | identity_id+revision →200; MANAGE, jurídico activo, garantizar participación | Nuevo caso; no escribir campo directo desde UI |
| PUT/DELETE M/participants/{identityId} | permissions/revision →200/204; MANAGE y máximo rol; no revocar responsable activo | grantParticipant/revokeParticipant |
| POST/GET M/proceedings | órgano/número nullable →201/lista200; MANAGE/READ | Nuevo; FK asunto, nunca asunto=expediente |
| POST M/documents | title → documento ORIGINAL sin versión vigente,201; DOCUMENT_WRITE | createDocument |
| POST M/documents/{id}/uploads | filename,mime,size,sha256 declarado → intent201; validar límite propuesto20MiB y permiso | Nuevo staging, hash cliente solo preliminar |
| PUT /api/v1/uploads/{intentId}/content | bytes limitados →204; sesión/intent+asunto, MIME detectado servidor, no ejecutar contenido | Nuevo proxy de upload privado |
| POST /api/v1/uploads/{intentId}/finalization | → versión201 AVAILABLE o202 QUARANTINED; checksum servidor/scan, mismo scope | addDocumentVersion adaptado blob V2 |
| POST M/documents/{id}/publication | version_id,expected_current_version_id →200; pertenencia/CAS | publishDocumentVersion |
| GET M/documents/{id}/versions/{v}/content | → stream privado; READ, versión exacta AVAILABLE, integridad; Cache-Control:no-store | getDocumentVersion adaptado blob |
| POST/GET M/tasks | title,responsible_identity_id,internal_due_at →201/lista200; TASK_WRITE/READ | createTask / listado nuevo |
| PATCH M/tasks/{id} | status+revision →200; responsable o MANAGE; no DRAFT_REVIEW | setTaskStatus |
| POST M/drafts | title,content texto plano≤1M caracteres →201; DRAFT_WRITE | prepareDraft |
| POST M/drafts/{id}/versions | content,expected_version_id →201; autor o MANAGE, DRAFT_WRITE | reviseDraft; limpiar rendering, no HTML ejecutable |
| POST M/drafts/{id}/reviews | reviewer_identity_id,due nullable,expected_version_id →201; revisor activo distinto autor con DRAFT_REVIEW | requestDraftReview + CAS exacto nuevo |
| POST M/reviews/{id}/decisions | decision,expected_version_id,explicitly_confirmed:true →200; revisor designado | decideDraftReview + approval append-only |
| GET M/activity | cursor → eventos mínimos200; READ, sin texto documental | matterActivity + paginación |
| GET F/my-day | fecha/zona/filtros → tareas/revisiones/próximas acciones200 | Query nueva SQL autorizada, sin LLM |

Error público `{error:{code,message_key,request_id}}`, nunca stack o cuerpo remoto. 400 INVALID_INPUT;401 UNAUTHENTICATED;403 para acción prohibida en recurso ya autorizado;404 RESOURCE_NOT_FOUND para recurso desconocido o no autorizado (evitar enumeración);409 VERSION_CONFLICT/REVIEW_STATE_CONFLICT/IDEMPOTENCY_CONFLICT;413 FILE_TOO_LARGE;415 UNSUPPORTED_MEDIA;422 INVALID_DOCUMENT_BYTES/INTEGRITY_FAILURE;429 límite;503 dependencia temporal. ACCESS_DENIED del Core se traduce según contexto, conservando causa solo en auditoría restringida. Error de almacenamiento no publica documento incompleto; UI permite reintento idempotente. No mostrar tenant ajeno en errores ni contar sus resultados.

## Documento: consistencia SQL/objetos

No existe transacción distribuida implícita entre SQL y Storage. Crear intent con object key única; subir a staging privado; worker/proxy verifica tamaño/hash/tipo y malware; solo entonces tx SQL registra versión+actividad/outbox y marca AVAILABLE. Publicación es otra CAS explícita. Fallo antes de commit deja objeto huérfano privado, nunca versión visible; reconciliador lo limpia tras TTL propuesto24h con política/retención. Fallo después de commit se reconcilia por intent/idempotency; no duplicar versiones. Bytes se escriben una vez, corrección crea nueva versión; documentos escaneados muestran TEXT_UNAVAILABLE hasta extracción revisada, no VERIFIED.

Por defecto se recomienda proxy de descarga con reautorización; si se habilitan links firmados, TTL propuesto60s y advertencia operacional: revocar membresía no invalida un bearer URL ya emitido antes de expirar. No prometer revocación instantánea de esos links. Archivo sospechoso QUARANTINED no se descarga ni entra a editor/IA. Backup de objetos separado de SQL, prueba de hashes tras restore.

## Contratos del OS completo posteriores al slice

Agenda: event con actor/responsable/fecha/zona/origen; deadline incluye tipo INTERNAL/SUGGESTED_LEGAL/CONFIRMED_LEGAL, regla/calendario/version aprobador. Prohibido confirmar por LLM. Portal: explicit_share sobre document_version_id y destinatario verificado, expiración/revocación; nunca share de current_version genérico. Entrega/presentación: approved_version_id + evidencia + actor; recibo faltante mantiene estado pendiente.

Finanzas (solo diseño): engagement/fee_agreement versionado, time_entry, expense, invoice, payment, payment_allocation, ledger_entry reversable. Importe decimal string + currency ISO, escala por moneda configurada, sin float ni suma multimoneda. Acordado/devengado/facturado/cobrado/anticipado separados. Aplicación de pago valida suma de allocations≤saldo disponible en una tx con locks; reintento idempotente; reverso con referencia al movimiento, no borrado. PYG soportado, política tributaria/IVA/localización fiscal sin definir; invoice interna no se denomina factura fiscal. Finanzas tiene permisos específicos y no acceso a documentos legales. APIs futuras `/fee-agreements`, `/expenses`, `/invoices`, `/payments`, `/allocations` requieren ADR financiero y E2E de duplicación/concurrencia/reversos; no implementarlas en F1.

Integración Junta futura: request/snapshot/evidence_pack referenciados por IDs, versiones, permiso y presupuesto; adapter AccessContext solo servidor. Diferencias del EvidencePack V2 se resuelven con mapping versionado, sin modificar fixtures históricos ni autorizar inferencia. Aprobación documental, autenticidad bibliográfica y revisión jurídica permanecen estados separados.
