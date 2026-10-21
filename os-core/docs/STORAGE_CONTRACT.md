# Contrato neutral de almacenamiento y de servicio

Estado: IMPLEMENTED como interfaces TypeScript; implementación durable BLOCKED. No es DDL, migración ni selección de producto.

## Esquema lógico y restricciones obligatorias del adaptador durable

Todos los IDs son opacos; el servicio genera IDs. Para cada tabla con estudio, las claves foráneas deben incluir la frontera `law_firm_id`, aunque los IDs sean globalmente únicos. Ningún adaptador puede resolver una relación por ID sin comprobar esa frontera. Índices de consulta deben comenzar por estudio y, para entidades de asunto, por asunto.

| Relación | Invariante |
|---|---|
| memberships | FK law_firm; UNIQUE(law_firm_id, identity_id); rol enumerado; activo explícito |
| clients | FK law_firm; PERSON/ORGANIZATION; identificación opcional no usada como permiso |
| contacts | FK(law_firm_id, client_id) a clients |
| matters | FK(law_firm_id, client_id); responsable apunta a membresía del mismo estudio con rol jurídico |
| participants | FK(law_firm_id, matter_id); FK(law_firm_id, identity_id) a memberships; UNIQUE(estudio, asunto, identidad) |
| relatedParties | FK(estudio, asunto); contacto opcional del mismo estudio |
| documents | FK(estudio, asunto); versión vigente nula o perteneciente al mismo documento/estudio/asunto |
| documentVersions | FK(estudio, asunto, documento); append-only; bytes inmutables/hash; nombres no deciden vigencia |
| tasks | FK(estudio, asunto); responsable con participación activa; revisión opcional del mismo asunto |
| drafts | FK(estudio, asunto, documento, versión); autor miembro/participante |
| reviews | FK(estudio, asunto, borrador, versión); revisor explícito diferente del autor |
| activities | append-only; FK(estudio, asunto si existe); actor y códigos/IDs sin contenido confidencial |

Los cambios de membresía, publicación de versión, revisión y evento correspondiente deben ser una única transacción. Una inserción fallida no puede dejar una aprobación sin actividad, o documento publicado sin versión durable. El almacenamiento de originales necesita un protocolo aprobado para atomicidad entre objetos y catálogo; no existe aún ese adaptador. Las transacciones deben evitar que dos aprobaciones/publicaciones con el mismo estado esperado prosperen simultáneamente.

`get` y `list` son primitivas internas, no APIs de usuario. El servicio comprueba tenant/asunto antes de devolver datos. El futuro backend no debe exportar el repositorio como endpoint. La base debe repetir las restricciones mediante políticas/constraints compatibles con la tecnología aprobada. La identidad validada por el host debe propagarse de forma confiable a esas políticas, no como campos arbitrarios de una petición.

## Comandos implementados de servicio

`createLawFirm`, `getLawFirm`, `addMember`, `deactivateMember`, `createClient`, `getClient`, `createContact`, `createMatter`, `getMatter`, `grantParticipant`, `revokeParticipant`, `createRelatedParty`, `createDocument`, `addDocumentVersion`, `publishDocumentVersion`, `getDocument`, `getDocumentVersion`, `createTask`, `getTask`, `updateTaskStatus`, `prepareDraft`, `getDraft`, `reviseDraft`, `requestDraftReview`, `decideDraftReview`, `matterActivity`.

No se implementaron borrado físico, presentación judicial, cálculo de plazo procesal ni inferencias. Las fechas de tareas son vencimientos internos enviados explícitamente. El bootstrap crea estudio/membresía administradora para una identidad ya autenticada; la política empresarial de provisión de estudios debe aprobarse en el host.

## Autenticación requerida

`Authenticator.authenticate` debe validar credencial real y devolver identidad/subject/sesión/vencimiento; `identity` debe consultar directorio autorizado. Validación de firma, issuer/audience, revocación, MFA y recuperación de cuenta no son responsabilidad de un payload del cliente. El servicio comprueba correspondencia activa y expiración pero no reemplaza al IdP. Se prohíbe usar `TestAuthenticator` fuera de pruebas.

## Contrato de errores y observabilidad

UNAUTHENTICATED identifica credencial ausente/inválida/expirada o identidad inactiva. ACCESS_DENIED cubre recursos inexistentes, de otro estudio/asunto o sin permisos, evitando distinciones de enumeración. INVALID_INPUT no devuelve el cuerpo recibido. Conflictos de versión/estado no repiten una decisión automáticamente. El futuro transporte debe mapear códigos estables sin stack, token ni texto privado en logs. No se incluye transporte HTTP en este alcance.

## Aceptación durable pendiente

Reutilizar suite contra adaptador real de desarrollo, probar rollback/carreras, claves foráneas multiestudio, almacenamiento inmutable, expiración/revocación real, recarga/nueva sesión y restauración de backup. Se requieren pruebas del host y políticas de datos además de los contratos de servicio; ningún mock acredita ese gate.
