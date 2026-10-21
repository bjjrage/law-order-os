# Remediación de auditoría técnica — Fase 1

Autorización: implementar correcciones, priorizar J-002/J-001/J-003, agregar regresiones e informes, sin llamadas pagas ni despliegues. Referencia: AUDITORIA_TECNICA_FASE_1_2026-10-12.md del usuario.

## Resultado

| Hallazgo | Cambios y regresiones | Estado |
|---|---|---|
| J-002 | Rechazo de claims autodeclarados; registry Ed25519 con configuración externa al bundle; firma del documento completo y claims; verificador/URL/hash/fechas/derechos trazables; rechazo de cambios, hosts impostores, claves desconocidas y firmas vencidas; preflight offline; revalidación de caché/exportación sin replay. | Vulnerabilidad local corregida. Canal/verificador oficial real pendiente. |
| J-001 | Familias extensibles para sentencias, acuerdos, autos, resoluciones, acordadas, leyes y decretos; detector separado con referencias desconocidas numeradas; fechas/offsets; revisión de raw_text/prosa; gate cerrado, PARTIAL y supresión de etiquetas. citationLabel sin gate explícito devuelve REVIEW_REQUIRED. | Reproducciones y regresiones PASS. Exhaustividad y curaduría independiente no acreditadas. |
| J-003 | publishVersion y mapa explícito de versiones; múltiples revisiones sin publicación bloquean; pruebas en ambos órdenes, nombres arbitrarios, carga vieja posterior, referencias históricas y aislamiento. | Corregido localmente. Host responsable de autorizar publicación. |
| J-004 | Presupuestos configurables; modelo debe informar ventanas suficientes; fallo de revalidación revoca permiso de generar; manifiesto completo antes del bloqueo; prueba de entrada de 150000 caracteres sin truncamiento. | Implementado y probado offline. No equivale a 150K tokens ni a validación de calidad/costo real. |
| J-005 | Conservados bloqueos de gasto y dependencias, comprobación local sin red. | BLOCKED / NOT_RUN. No se ejecutó integración real. |

Pruebas nuevas: tests/adversarial/provenance.test.ts, tests/adversarial/extraction.test.ts, tests/unit/versions.test.ts y tests/unit/auditor-budget.test.ts. Se adaptaron fixtures y expectativas de versiones al contrato seguro. Resultado: 173/173 tests, 11 archivos, typecheck/build PASS.

CLI: smoke por defecto y de remediación PASS, consulta e idempotencia PASS, benchmark PASS, intento sin habilitación de gasto BLOCKED antes de leer bundle. Evidencia: reports/cli-remediation-verification.json.

## Evaluación bibliográfica sin ocultar iteraciones

V1 conservado intacto: 3/3 referencias detectadas en esta regresión, frente a 2/3 antes de corregir. No es holdout independiente nuevo.

V2 congelado por SHA-256 antes de evaluar: 24 casos, primera evaluación 23/24. La abreviatura condicionada por contexto quedó pendiente; no hubo bypass silencioso. Se corrigió la asignación de familia usando el contexto original y se agregó prueba general de lookahead. Resultado posterior 24/24, explícitamente regresión conocida.

La primera evaluación permanece en reports/benchmark-bibliography-v2-first-evaluation.json; no se cambió el dataset ni su hash. Un conjunto externo independiente sigue pendiente. Ningún porcentaje acredita calidad jurídica o capacidad de proveedores reales.

## Compatibilidad y operación

Los originales y resultados históricos no se borraron. El hash de ejecución incluye política V2 y registro de confianza; reutilizar IDs antiguos con entradas distintas bloquea. El smoke por defecto usa demo-offline-v2. Runbook explica el directorio separado usado para comprobar la remediación.

La importación es UTF-8 con atestaciones externas, no un scraper gubernamental. No se distribuyen claves privadas productivas. La configuración de verificadores y publicación de versiones requiere un host confiable. Todo resultado mantiene draft=true y human_approval=PENDING.

Costo pagado USD 0. Sin solicitudes externas ni despliegues. La aprobación productiva permanece pendiente por corpus real, curaduría independiente, permisos, documentación del OS y conectividad/costos de cuenta.

