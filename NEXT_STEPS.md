# Fase 2 - siguientes pasos (2026-10-13, America/Asuncion)

Estado preparatorio: contratos/servicio y controles locales implementados; corpus real recuperado con integracion bloqueada; inferencia y despliegue NOT_RUN. Ver PHASE2_IMPLEMENTATION_REPORT.md y PHASE2_BLOCKERS.md.

1. Aportar Blueprint/Roadmap/handoff vigentes y resolver ADR OS-001 (backend, persistencia y autenticacion). Aplicar contratos de os-core/docs/STORAGE_CONTRACT.md sin convertir mocks en infraestructura.
2. Aprobar politica de confianza/verificador del corpus. Revisar extraccion civil/penal y su identidad contextual; obtener OCR/transcripcion revisada del constitucional. Resolver privacidad y reutilizacion antes de indexacion productiva.
3. Conectar un importador PDF que preserve original binario y extraccion trazable. Congelar bundle y EvidencePack del unico escenario de LIVE_SMOKE_PLAN.md; sus hashes actuales son null.
4. Configurar credenciales/modelos de forma segura y confirmar metadatos no generativos. Google dio401; no repetir sin corregir configuracion. No cambiar modelos ni copiar claves al chat.
5. Corregir cobertura de numeros en palabras usando development nuevo y medir un conjunto nuevo congelado, conservando la primera evaluacion Fase2. Obtener par autentico para ambiguedad y curaduria juridica externa.
6. Ejecutar live-preflight local. Solo con bloqueos resueltos y autorizacion futura expresa considerar live-smoke con plan.config exacto, techoUSD0.60 y tarifas revalidadas. Ninguna inferencia paga se ejecuto ni quedo autorizada en esta fase.
7. Implementar E2E durable sobre infraestructura aprobada y probar recarga, sesiones reales, aislamiento y aprobacion de version. El flujo actual de servicio es TESTED_OFFLINE.

El proximo paso concreto es resolver las decisiones del punto1 y la politica del punto2, no desplegar ni generar inferencias.

---
## Historico preservado de siguientes pasos Fase1

﻿# Siguientes pasos

1. Incorporar Blueprint/Roadmap/handoff y una política de quién puede configurar verificadores y publicar versiones. No elegir infraestructura del OS sobre supuestos.
2. Integrar un verificador real de originales oficiales: canal autorizado, extracción y metadatos contrastados, URL exacta, hash, fecha, derechos y firma. Configurar únicamente sus claves públicas aprobadas fuera de los bundles.
3. Curar un corpus pequeño con un abogado, publicar versiones vigentes explícitamente y validar importación offline. No marcar documentos sintéticos como estatales.
4. Encargar un nuevo conjunto bibliográfico a curaduría independiente, congelarlo antes de evaluar y conservar el primer resultado. V1 y V2 actuales quedan como regresiones.
5. Confirmar IDs, acceso y ventanas de modelos con consultas de metadatos cuando corresponda. Comprobar tarifas y contadores oficiales antes de cualquier gasto.
6. Evaluar si el auditor necesita fragmentación explícita con manifiestos completos. Actualmente una entrada que no cabe se bloquea sin omisiones.
7. Solo con autorización futura expresa de gasto, ejecutar un smoke real acotado y evaluar calidad jurídica, costos y omisiones. Esta remediación no autoriza ni ejecuta ese paso.

Trabajo local completado: correcciones y regresiones de J-002/J-001/J-003, límites y pruebas de J-004, informes actualizados. J-005 y la aprobación productiva siguen pendientes de evidencia externa. No hubo despliegue.

