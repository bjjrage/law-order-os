# ADR OS-001 — aplicación, persistencia y autenticación del OS

Fecha: 2026-10-13, America/Asuncion. Estado: **PENDING_DECISION / BLOCKED**. Ninguna alternativa está aprobada mediante este documento.

## Contexto

El repositorio inspeccionado contiene un motor experimental Node/TypeScript de Junta. No contiene decisiones productivas de stack web, base de datos o autenticación; Blueprint/Roadmap/handoff vigentes no están disponibles. ADR de Junta acepta su motor y orden de modelos, no el stack empresarial del OS. La Fase 2 permite contratos y componentes TypeScript aislados sin inventar infraestructura.

## Alternativas a conciliar

| Decisión | Alternativas | Consecuencias que deberá resolver la decisión |
|---|---|---|
| Aplicación | Backend TypeScript separado con API; aplicación web TypeScript con backend integrado; integrar en un backend existente que aparezca en Blueprint | Límites de despliegue, sesiones, operaciones de documentos, jobs, pruebas y operación del equipo |
| Persistencia | Base relacional administrada; base relacional autogestionada; infraestructura ya aprobada por el estudio | Aislamiento de tenants/asuntos, transacciones, inmutabilidad, residencia, backups/restauración y costos |
| Autenticación | IdP administrado compatible con federación; IdP autogestionado; identidad empresarial existente | MFA, altas/bajas, issuer/audience, sesiones, revocación, responsabilidad de operación |
| Originales | Objetos inmutables con catálogo transaccional; blobs en base durable; almacén documental ya aprobado | Atomicidad catálogo/bytes, integridad, versionado, permisos, retención y recuperación |

Un archivo JSON local, tokens sintéticos o adaptador en memoria no constituyen una alternativa empresarial adoptada. Una base liviana local podría servir solo a desarrollo si se aprueba; no probaría seguridad multiusuario productiva por sí misma.

## Decisión actual limitada

Desarrollar biblioteca neutral en `os-core/src`, interfaces `Authenticator` y `CorePersistence` y pruebas exclusivamente offline. El build excluye `os-core/testing`. No crear servidor, cuenta cloud, base, migraciones ni autenticación aparente. No poner datos de clientes reales en pruebas.

## Información y aprobación faltantes

Recuperar Blueprint/Roadmap/handoff, decidir política de roles/muros por cliente/asunto, seleccionar backend/base/IdP/almacenamiento, definir residencia/retención/backups, y proporcionar ambiente de desarrollo autorizado con dos usuarios reales de prueba. Registrar luego un nuevo ADR aceptado que referencia éste y habilita adaptadores y migraciones **de desarrollo**. La Fase 2 no autoriza migraciones de producción ni despliegues.

## Gate posterior

Ejecutar los 14 pasos con identidades efectivas, permisos en servicio y datos durables. Reiniciar proceso/recargar navegador e iniciar nueva sesión; comprobar aprobación/versiones y rechazo con IDs conocidos entre dos estudios. Solo esa evidencia puede cambiar el E2E persistente de BLOCKED/NOT_RUN. Los 42 tests actuales del servicio son TESTED_OFFLINE.
