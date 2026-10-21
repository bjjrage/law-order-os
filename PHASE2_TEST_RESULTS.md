# Fase 2 — resultados de pruebas

Fecha: 2026-10-13, America/Asuncion. PASS de contratos locales no acredita validación jurídica real.

| Verificación | Resultado | Evidencia |
|---|---|---|
| Baseline existente | 173/173 PASS | phase2/reports/baseline-vitest.json |
| Suite integrada final | 271/271 PASS, 17 archivos | phase2/reports/final-vitest.json |
| Typecheck raíz, incluyendo OS Core | PASS, exit 0 | npm.cmd run typecheck |
| Build Junta | PASS, exit 0 | npm.cmd run build |
| Build servicio OS Core | PASS, exit 0 | npm.cmd run build:os-core |
| J-001..J-004 focalizados | 102/102 PASS, 30 nuevas pruebas | phase2/reports/junta-a1-regressions-final.json |
| Proveedores/auditor/preflight focalizados | 43/43 PASS, 19 nuevas pruebas | phase2/reports/model-connectivity-tests.json |
| OS Core aislado | 42/42 PASS, 3 archivos | os-core/test-results.json |
| Archivo de originales | 7 tests de integridad/estado PASS | phase2/tests/corpus-integrity.test.ts |
| CLI offline y gates | 7 comprobaciones PASS | phase2/reports/cli-verification.json |
| Preflight real actual | BLOCKED esperado, sin red | phase2/reports/live-preflight-cli.json |
| Metadatos de cuenta Google | BLOCKED HTTP 401 | phase2/reports/model-connectivity-metadata.json |
| Inferencia real / E2E empresarial persistente | NOT_RUN / BLOCKED | Falta cuenta/corpus confiable y decisión de infraestructura |

Los conteos focalizados se solapan con la suite integrada: no sumarlos. La suite creció de 173 a 271 tests. El servicio OS Core se prueba solo con adaptadores de testing; las pruebas ordinarias bloquean fetch global.

## Fallos encontrados y resultados conservados

A1 primera evaluación: 16/25 PASS, nueve fallos de extracción/citas. Ocho revelaron omisión de cotejo literal; uno, abreviatura espaciada. Se corrigió código y agregaron regresiones; el JSON inicial permanece en junta-a1-first-evaluation.json.

La integración inicial encontró TS2345 en el tipado de un test dinámico del corpus. Se corrigió la declaración del test; typecheck final aprobado. No se cambió su criterio de integridad.

Benchmark nuevo sobre originales reales: detección 12/12, extracción 11/12. FAIL de extracción del número en palabras del encabezado civil; marcador pendiente conserva fail-closed. Autenticación, ambigüedad real y cotejo textual permanecen BLOCKED, con métricas null. No se ajustó el parser después de evaluar ese conjunto. La primera evaluación y dos repeticiones coinciden y mantienen hashes.

Los holdouts V1/V2 siguen intactos; 24/24 V2 es regresión conocida, no nuevo holdout independiente. Las 12 identidades/casos de Fase 2 son nuevos respecto de aquellos ejemplos, pero no tienen curaduría jurídica externa.

## Reproducción

    npm.cmd run typecheck
    npm.cmd run build
    npm.cmd run build:os-core
    npm.cmd run board:test -- --reporter=json --outputFile=phase2/reports/final-vitest.json
    node phase2/tooling/download-official-corpus.mjs
    node phase2/tooling/verify-cli.mjs

verify-cli usa guardia de red, nuevo request ID y --report-dir phase2/reports. Comprueba smoke, idempotencia, consulta, benchmark conocido, preflight bloqueado y rechazo de live/live-smoke sin flag. No ejecuta --authorize-paid-calls.

Para repetir el benchmark real sin sobrescribir mediciones, seguir BIBLIOGRAPHIC_BENCHMARK_REPORT.md y elegir una salida nueva; el runner valida hashes de entradas y motor congelado.

Para reproducir revisión PDF sin Python:

    npm.cmd ci --prefix phase2/tooling --ignore-scripts --cache .npm-cache --no-audit --no-fund
    node phase2/tooling/review-pdfs.mjs

El tooling es local y separado del stack del OS. Los originales no se sobrescriben. No se ejecutó OCR ni se trataron extracciones como originales perfectos.

