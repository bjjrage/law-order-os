# ADR-LO-002 — Reconciliación del Blueprint y Roadmap V2

**Fecha:** 13/10/2026  
**Estado:** RECONCILIACIÓN DOCUMENTAL PENDIENTE DE APROBACIÓN DEL PROPIETARIO  
**Origen:** Conversación LAW & ORDER OS + `PHASE2_IMPLEMENTATION_REPORT.md` + artefactos históricos v1.1.

## Cambio 1 — Arquitectura de la Junta

- ANTES (Blueprint v1.1): clonar Mussi; topología 3→2→1 de Junta Clínica.
- AHORA (decisión expresa): Junta Jurídica propia con Jev → Luna → Sol 6.1 Medium → Gemini 3.8 Flash → checker determinístico → abogado.
- Estado: motor offline reportado implementado, proveedor real/corpus autenticado pendientes.
- Acción: prohibido volver a tareas de clonación, modificar Mussi o revivir arquitectura anterior salvo aprobación futura.

## Cambio 2 — OS Core y producto

- ANTES: roadmap asumía F5 no iniciado y sin base técnica.
- AHORA: existe servicio de dominio offline y E2E sintético de 14 pasos (42 pruebas reportadas), **no** UI empresarial ni persistencia/auth productivas.
- Requisito de UI aprobado: visual altamente compacto (~85% como referencia perceptiva, sin zoom forzado), tipografía y cards contenidas, tablas densas, hover sutil y jerarquía clara.
- Acción: ADR OS-001 para stack sigue abierto; no elegirlo silenciosamente. Una vez aprobado iniciar aplicación real.

## Cambio 3 — Fuentes y checker

- ANTES: investigación pública preliminar de CSJ/Digesto/Congreso y candidatas.
- AHORA: tres PDFs oficiales originales preservados y parcialmente revisados (no corpus completo). Checker con atestaciones locales y pruebas offline, autenticación oficial real pendiente.
- Limitación conocida: detección 12/12 y extracción 11/12 en benchmark congelado, resto FAIL honesto.

## Decisiones explícitamente NO resueltas

ADR OS-001; política de curaduría y atestadores institucionales; acceso y model IDs de proveedores; estudio piloto; residencias/privacidad; presupuesto de prueba real; política de precios. La redacción de este ADR no autoriza implementación irreversible.

## Fuente de autoridad

1. Decisiones recientes explícitas. 2. Informes/código local para implementación. 3. Blueprint/roadmap V2 una vez aprobado para alcance. 4. v1.1 preservado como histórico. Una discrepancia debe señalarse, no corregirse silenciosamente.
