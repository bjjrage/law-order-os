# LAW & ORDER OS — Junta Jurídica V2

## Modo local actual — sin login ni Docker

**Consultas generales:** siempre con **Gabriel**, el avatar 3D flotante disponible por voz y texto. Se arrastra directamente desde su cuerpo; un clic abre la conversación. Responde preguntas breves, ayuda a navegar y prepara un equipo cuando pedís un análisis. [Uso y conexión](docs/operations/GABRIEL_ASISTENTE_VOZ.md).

**Equipo jurídico:** presentación del estudio IA en el menú y en una pestaña del asunto: Gabriel, los seis especialistas, Santiago, especialidades, aportes y deliberación de la Junta. Dentro del asunto aparece antes de **Consulta jurídica**, donde se trabaja el encargo del equipo. No hay un formulario general ni un selector de modos generales en ese panel.

**Biblioteca jurídica:** el menú incluye las 15 fuentes del catálogo paraguayo: Constitución, leyes/decretos, códigos, jurisprudencia, Gaceta y datos legislativos, con buscador y filtros. Se abre sin estudio y permite consultar los sitios externos. Es un directorio de fuentes; no implica descarga completa ni habilitación del corpus para la Junta. [Informe](docs/operations/BIBLIOTECA_JURIDICA.md).

**Junta Jurídica:** el proceso se explica en **Equipo jurídico**; el encargo y entregable se trabajan en **Consulta jurídica** del asunto. Las consultas rápidas de Gabriel y su voz usan IA real por autorización del propietario; las herramientas documentales de los especialistas conservan su piloto local y sus controles. Las claves permanecen únicamente en `.env`; [campos e instrucciones](junta-local/LEEME.md). Comandos de configuración: `npm.cmd run junta:preparar` y `npm.cmd run junta:estado`. La [activación del motor anterior](docs/operations/CONSULTA_GENERAL_IA_REAL.md) y sus registros se preservan como antecedente, sin volver a montar su formulario general en el asunto.

Por decisión del propietario del 2026-10-13, el modo predeterminado usa el Core real con `localStorage` del navegador y perfiles sintéticos sin autenticación. No requiere PostgreSQL, Supabase ni claves de IA. Ejecutar `npm.cmd run os:build:web` y luego `npm.cmd run os:local`; abrir http://127.0.0.1:4313. Crear el estudio y empezar a trabajar. Exportar respaldos desde el menú antes de borrar datos del navegador. [Informe actual](LOCAL_BROWSER_IMPLEMENTATION.md).

## Aplicación local F1–F4 — antecedente del ADR aprobado

React/Vite compacto, API Fastify y PostgreSQL real reutilizando Core. [Arranque local](docs/operations/LOCAL_DEVELOPMENT.md), [implementación](F1_F4_IMPLEMENTATION_REPORT.md), [pruebas](F1_F4_TEST_RESULTS.md) y [handoff](F1_F4_HANDOFF.md). App: http://127.0.0.1:4310. En este Windows falta Docker: Supabase Auth/Storage reales siguen bloqueados. Capturas operativas usan identidad exclusiva de harness con PostgreSQL real; main no tiene login ficticio. Sin gasto ni deploy.

## Motor y antecedentes preservados

Motor experimental TypeScript/Node: Jev → Luna → Sol Medium → Gemini → checker determinístico → revisión humana.

La remediación de auditoría incorpora procedencia firmada desde verificadores externos configurados, detección bibliográfica con gate cerrado y publicación explícita de versiones. La simulación solo etiqueta SIMULATED_VERIFIED. No hay corpus estatal real ni integración de cuenta validada.

    npm.cmd ci --ignore-scripts --cache .npm-cache
    npm.cmd run typecheck
    npm.cmd run board:test
    npm.cmd run board:smoke:offline
    npm.cmd run board:benchmark:offline

En otros sistemas, instalar dependencias allí; no compartir node_modules nativo de Windows. Los tests ordinarios bloquean red; smoke/benchmark usan fixtures y proveedores simulados. No generan inferencias pagas ni despliegues.

Consultar [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md), [TEST_RESULTS.md](TEST_RESULTS.md), [AUDIT_REMEDIATION.md](AUDIT_REMEDIATION.md) y [Runbook](junta-juridica/docs/RUNBOOK.md). Definiciones públicas: junta-juridica/src/index.ts.

El smoke usa request_id demo-offline-v2 para conservar históricos V1. Repetir una entrada idéntica no repite modelos. Cambiar política/datos bajo el mismo request_id produce conflicto; usar un ID nuevo.

Toda salida sigue siendo borrador. Sin atestación confiable vigente no hay VERIFIED; citas pendientes/no comprobadas dejan PARTIAL. La gramática no promete exhaustividad ni corrección jurídica. Las dependencias de producción siguen BLOCKED / NOT_RUN.



## Addendum Fase 2 - 2026-10-13

Estado actual y comandos: [PHASE2_IMPLEMENTATION_REPORT.md](PHASE2_IMPLEMENTATION_REPORT.md) y [PHASE2_TEST_RESULTS.md](PHASE2_TEST_RESULTS.md). La politica de verificacion es 3; el smoke por defecto usa demo-offline-v3. Para preservar informes anteriores usar --report-dir phase2/reports y un request ID nuevo. OS Core es un servicio aislado TESTED_OFFLINE; persistencia y autenticacion productivas siguen BLOCKED. No hubo inferencias pagas ni despliegues.
