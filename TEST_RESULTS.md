# Resultados de pruebas después de auditoría

Actualización: 2026-10-13 UTC / 2026-10-12 America/Asuncion.

| Verificación | Estado | Evidencia |
|---|---|---|
| TypeScript estricto | PASS | npm.cmd run typecheck |
| Compilación | PASS | npm.cmd run build |
| Suite unit/integration/adversarial | PASS | 173/173 tests, 11 archivos; reports/vitest-results.json |
| J-002 confianza/procedencia | PASS local | Autodeclaraciones, firmas, expiración, cambios, hosts, bundle, extracción, caché sin replay |
| J-001 extracción/gate | PASS local | Abreviaturas, familias extensibles, detección desconocida, prosa/raw_text, bloqueo y etiquetas |
| J-003 versiones | PASS local | Ambos órdenes, publicación explícita, nombres arbitrarios y snapshots históricos |
| J-004 auditor | PASS offline | 150K/300K presupuestos configurados, ventanas falsas insuficientes/ausentes, cobertura y no truncamiento |
| Smoke por defecto y remediación | PASS | HUMAN_REVIEW_PENDING, PASS_IN_SCOPE, etiquetas SIMULATED_VERIFIED |
| Consulta/idempotencia | PASS | Mismo run y costo; reports/cli-remediation-verification.json |
| Rechazo de generación no habilitada | PASS | Exit 2, EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED |
| Benchmark local final | PASS | V1: 3/3 referencias; V2: 24/24 casos; reports/benchmark-offline.json |
| Primera evaluación V2 | FAIL conservado | 23/24; reports/benchmark-bibliography-v2-first-evaluation.json |
| Corpus real/holdout externo independiente | BLOCKED | No evaluados |
| GET autenticados/inferencias/modelos reales | NOT_RUN | Inspección local network_used=false; ninguna llamada paga |
| Despliegue | NOT_RUN | Prohibido por la solicitud |

La suite pasó de 101 a 173 tests. Los 72 adicionales cubren la remediación; las pruebas originales de permisos, presupuesto, cancelación, reintentos, locks, persistencia y contratos de proveedores permanecen.

Los tests ordinarios bloquean fetch global. HTTP de proveedores solo usa transportes falsos. El firmador de pruebas genera claves desechables y usa official.example.test; su etiqueta VERIFIED comprueba el contrato criptográfico local, no un origen gubernamental real.

V1 y V2 ya son conocidos. V2 se congeló antes de evaluar, reveló un defecto corregido y conserva su primera medición. El PASS posterior acredita regresiones, no una evaluación independiente ni exhaustividad bibliográfica.

Los reportes previos están preservados con sufijo before-remediation. No se volvió a consultar npm audit ni documentación remota en esta remediación; resultados históricos de dependencias no se presentan como verificaciones nuevas.

