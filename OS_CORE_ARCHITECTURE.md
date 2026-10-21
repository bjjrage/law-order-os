# OS Core — contratos del primer alcance

Fecha: 2026-10-13, America/Asuncion. Frente B separado de Junta Jurídica. Estado: **IMPLEMENTED / TESTED_OFFLINE** para la biblioteca de servicio; **BLOCKED** para aplicación persistente y autenticación real. No se afirma VERIFIED_REAL.

Se leyeron los informes de implementación/remediación/pruebas/limitaciones/conectividad/siguientes pasos y ADR de Junta V2 antes de escribir código. No aparecieron Blueprint V1.1, Roadmap vigente ni handoff en el árbol inspeccionado; no se inventó su contenido. Node/TypeScript/Vitest son el stack experimental existente, no una elección empresarial aprobada. No había backend web, base de datos ni proveedor de identidad aprobados. La directiva autoriza componentes TypeScript aislados y exige dejar esa decisión pendiente.

## Entregables y alcance real

| Entregable | Estado | Evidencia |
|---|---|---|
| Entidades, contratos de persistencia y autenticación | IMPLEMENTED | `os-core/src/contracts.ts` |
| Autorización en servicio confiable | IMPLEMENTED / TESTED_OFFLINE | `os-core/src/authorization.ts`, `service.ts` y pruebas multiestudio |
| Clientes, contactos, partes, asuntos, documentos/versiones y tareas | IMPLEMENTED / TESTED_OFFLINE | Biblioteca TypeScript; sin frontend ni endpoint público |
| Borrador → tarea de revisión → decisión humana explícita | IMPLEMENTED / TESTED_OFFLINE | Revisión vinculada a versión exacta y actividad |
| Adaptador volátil e identidad sintética | TESTED_OFFLINE | Solo `os-core/testing`; excluidos del build del servicio |
| Aplicación, persistencia durable, sesiones reales, políticas de base de datos | BLOCKED | ADR pendiente; no se instaló infraestructura |
| Recarga/nueva sesión de aplicación persistente | BLOCKED / NOT_RUN | El adaptador de prueba pierde datos deliberadamente |

## Fronteras y entidades

`Identity` pertenece al proveedor de identidad: no implica membresía. `Membership` liga explícitamente una identidad activa a un estudio y rol. `MatterParticipant` liga esa identidad al asunto y a un conjunto de permisos. Ninguna igualdad de correo, nombre ni conocimiento de un ID concede acceso.

| Entidad | Campos y relaciones centrales |
|---|---|
| LawFirm | ID, nombre, fecha; frontera de tenant |
| Identity / AuthenticatedPrincipal | ID/subject/estado; sesión verificada por host con vencimiento |
| Membership | Estudio, identidad, rol propuesto, estado activo, fecha |
| Client | Estudio, PERSON u ORGANIZATION, nombre, identificación opcional |
| Contact | Estudio, cliente, persona de contacto, correo/teléfono opcionales |
| RelatedParty | Estudio/asunto, parte contraria/testigo/perito/otra, contacto opcional |
| Matter | Estudio/cliente, título, tipo judicial/asesoría/contractual/otro, materia, responsable, estado, fechas |
| MatterParticipant | Estudio/asunto/identidad, permisos explícitos, estado activo |
| Document | Estudio/asunto, título, propósito original o borrador, versión vigente explícita |
| DocumentVersion | Bytes incorporados inmutables, SHA-256, documento, estudio/asunto, MIME/nombre, actor/fecha |
| Task | Estudio/asunto, responsable, estado, vencimiento **interno**, tipo y revisión relacionada |
| Draft / DraftReview | Autor, versión exacta, estado; revisor designado y decisión explícita fechada |
| Activity | Estudio/asunto, actor, código de evento, ID del recurso/versión, fecha |

Documentos, tareas, participantes y actividad se relacionan con asunto mediante claves explícitas; no hay arrays de contenido duplicado en `Matter`. No todo asunto es expediente judicial. El cierre de asuntos, agenda, comunicaciones, honorarios y cobros quedan fuera de la implementación de este primer alcance, aunque pertenezcan al objetivo del OS.

## Política propuesta, pendiente de conciliación

Permisos de asunto: READ, MANAGE, DOCUMENT_WRITE, TASK_WRITE, DRAFT_WRITE y DRAFT_REVIEW. Se requiere simultáneamente membresía activa, capacidad del rol y participación activa con ese permiso. Toda ruta de servicio deniega por defecto. El administrador del estudio **también necesita participación explícita** para leer contenido de un asunto.

| Rol propuesto | Capacidad máxima de asunto, siempre sujeta a participación |
|---|---|
| Administrador / socio-coordinador / abogado | Los seis permisos |
| Asistente-procurador | READ, DOCUMENT_WRITE, TASK_WRITE, DRAFT_WRITE |
| Administración | READ |

Solo administrador incorpora/desactiva membresías. No puede desactivar al último administrador activo. Administrador/coordinador/abogado pueden abrir asuntos; creador y responsable quedan participantes explícitos en la misma transacción. El responsable debe tener membresía activa con rol jurídico. La política no otorga a asistentes revisión ni gestión por un campo enviado por el usuario. MANAGE autoriza conceder permisos dentro del máximo del rol. Debe existir READ en cada concesión; se rechazan duplicados y campos extra en los comandos estructurados.

Clientes y contactos tienen acceso a nivel del estudio para roles jurídicos/asistentes en esta política propuesta; no contienen documentos ni notas de asunto. Si el Blueprint exige muros adicionales por cliente, deberá ampliarse esa política antes de producción. Administración no tiene acceso al registro de clientes en esta primera implementación.

Credenciales solo se interpretan mediante `Authenticator`. El servicio comprueba identidad activa, correspondencia de subject y expiración; nunca acepta un principal incluido en el cuerpo del comando. Cada operación vuelve a evaluar membresía/participación dentro de su transacción. Los adaptadores de identidad de pruebas no son un login. MFA, issuer/audience, cookies/CSRF, revocación efectiva y ciclo de sesión deben implementarse en el host aprobado.

## Inmutabilidad y aprobación

Agregar una versión conserva bytes anteriores y crea ID/hash propios; no la publica por orden de carga. `publishDocumentVersion` exige versión exacta del documento y comparación con la versión vigente esperada. Un conflicto concurrente no sobrescribe silenciosamente. Al leer bytes se recalcula SHA-256. Los retornos están copiados y congelados; los bytes entrantes se copian antes del trabajo asíncrono. El límite local de un original es 20 MiB; no es una política empresarial de tamaño.

Borradores se editan únicamente mediante su workflow, no mediante el método de versiones originales. Solicitar revisión crea revisión/tarea PENDING ligada a la versión. Solo el revisor designado, autorizado en el asunto y distinto del autor puede decidir. Se exige `explicitly_confirmed: true` y `expected_version_id` exacto. Completar una tarea, descargar o leer no aprueba un borrador. Revisar contenido invalida revisiones pendientes, cancela sus tareas y devuelve el borrador a DRAFT; una aprobación histórica nunca cubre una versión nueva. La actividad de aprobación registra actor, borrador, versión y fecha. No existe estado ni acción de presentación judicial.

## Persistencia y contratos del host

`CorePersistence.transaction` exige commit/rollback atómico y aislamiento serializable o control equivalente de concurrencia. `CoreTransaction` expone lectura, consultas acotadas por estudio/asunto, inserción y reemplazo de tablas mutables. `documentVersions` y `activities` no admiten reemplazo. La interfaz no implica que exista base de datos: el único adaptador entregado está en `testing`, es volátil y declara TESTED_OFFLINE.

El adaptador empresarial deberá cumplir las restricciones neutrales de [contratos de almacenamiento](os-core/docs/STORAGE_CONTRACT.md), aplicar permisos en el servicio y políticas/constraints en la capa durable, además de backups/restauración, cifrado y retención aprobados. El constructor del servicio y repositorio son componentes del host confiable, nunca herramientas expuestas directamente al navegador. La actividad no contiene texto documental, nombres privados ni credenciales; logs técnicos tampoco deben registrar cuerpos de documentos. Auditoría durable de intentos rechazados, redacción de errores HTTP y protección de observabilidad quedan como requisitos del host, no se presentan implementados.

La Junta no se cambió ni se integró a este servicio. Una integración futura deberá traducir una sesión autenticada y participación efectiva al AccessContext de Junta en el host, sin aceptar study/matter/actor del frontend como autorización.

## Decisión pendiente

[ADR OS-001](os-core/docs/ADR_OS_001_PENDING.md): **PENDING_DECISION**. Alternativas de backend, persistencia y autenticación se comparan sin fijar una arquitectura definitiva. Gate B1 se satisface únicamente por contrato documentado y bloqueo explícito de infraestructura, conforme a la directiva; el flujo persistente real permanece BLOCKED.

Pruebas y pasos de reproducción: [OS_CORE_E2E_REPORT.md](OS_CORE_E2E_REPORT.md).
