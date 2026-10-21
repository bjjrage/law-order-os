# ADR OS-001 — plataforma aceptada

Estado: **ACCEPTED**, 2026-10-13. Aprobador: propietario, mediante mensaje explícito en este chat: «Sí, apruebo la alternativa B del ADR OS-001, con región São Paulo. Avanzá con F1–F4 en desarrollo local con datos sintéticos, reutilizando el Core y respetando la UI compacta. Sin llamadas pagas ni despliegues.»

Se acepta la alternativa B detallada en `ADR_OS_001_DECISION_PROPOSAL.md`: React/Vite/TypeScript, API Node/Fastify, PostgreSQL/Supabase Auth/Storage, pg, outbox y worker Node, región futura específica sa-east-1. Este ADR reemplaza el estado pendiente de `os-core/docs/ADR_OS_001_PENDING.md`, que se conserva como histórico.

Alcance autorizado: desarrollo local F1–F4, datos sintéticos y evolución neutral del Core. No se autorizan recursos pagos, inferencia, despliegues, push, migraciones productivas ni datos reales. UI compacta según UI_COMPACT_DESIGN_SPEC.md; modelos y Junta permanecen sin cambios.

Política provisional del desarrollo sintético: conservar roles actuales y separación obligatoria autor/revisor. Roles técnicos, portal y finanzas jurídicamente privilegiadas permanecen deshabilitados. La política empresarial de clientes/roles, piloto, retención, operación y presupuesto sigue pendiente; no bloquea implementación local, sí uso real.

Limitación inicial observada: no Docker ni PostgreSQL instalados; CLI Supabase presente pero falla al escribir telemetría fuera del workspace. Investigar PostgreSQL portátil para pruebas reales SQL; no sustituir Supabase Auth/Storage por mocks en la aplicación. Las pruebas con dobles se etiquetan exclusivamente como contratos offline.
