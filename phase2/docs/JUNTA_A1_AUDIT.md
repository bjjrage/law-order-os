# Frente A1 — revisión factual y regresiones adicionales

Fecha local: 2026-10-13, America/Asuncion. Estado: TESTED_OFFLINE. Sin red, inferencias pagas ni despliegues. No se acredita seguridad productiva por conteo de tests.

Se leyeron IMPLEMENTATION_REPORT, AUDIT_REMEDIATION, TEST_RESULTS, KNOWN_LIMITATIONS, MODEL_CONNECTIVITY, NEXT_STEPS y ADR_JUNTA_JURIDICA_V2 antes de modificar. El baseline preservado por el frente principal no contiene Blueprint/Roadmap/handoff ni repositorio Git; no se inventa su contenido. Este informe agrega evidencia y conserva los informes históricos y los dos holdouts evaluados.

| Hallazgo | Resultado individual | Evidencia y alcance |
|---|---|---|
| J-001 | PASS local después de FAIL reproducido | 30 nuevas regresiones incluyen notación abreviada, texto/offsets, metadatos y citas literales. Se encontró bypass de citas literales no reconocidas y se corrigió. Gramática finita, sin garantía de exhaustividad. |
| J-002 | PASS del contrato offline | Firmas desechables Ed25519, emisor autorizado, clave incorrecta, hosts exactos, expiración, hash, fixtures y mutaciones externas. Un emisor válido no autorizado es rechazado. |
| J-003 | PASS del contrato offline | Vigencia publicada, versiones fuera de orden, nueva candidata sin publicación, mapa externo mutado, snapshots históricos y aislamiento por estudio/asunto. |
| J-004 | PASS del contrato offline | Presupuestos 150K/300K existentes, ventanas mediante HTTP falso, manifiesto y auditoría completa. Entrada excesiva deja PARTIAL sin etapa de auditoría aprobada. |
| Aprobación real | BLOCKED | Verificador oficial, confianza del host, corpus y validación jurídica real no se prueban con fixtures. |

## Defecto adicional encontrado en J-001

Una identidad completa válida seguida por `«Texto inventado»`, `‘Texto inventado’` o `'Texto inventado'` producía quote=null. El gate podía retornar PASS_IN_SCOPE, aunque la cita literal no se cotejaba. También se omitían comillas incompletas y una segunda cita. La abreviatura `A . y . S .` no se extraía, pero ya quedaba cerrada por marcadores pendientes.

La primera ejecución de los 25 casos iniciales se conserva íntegra en `phase2/reports/junta-a1-first-evaluation.json`: 16 PASS, 9 FAIL. Ocho fallos corresponden a las comillas y uno a la abreviatura. No se reemplazó esa medición con la posterior.

`es-bibliography-v3` interpreta parejas de comillas rectas, dobles curvas, guillemets y simples curvas. Conserva el texto literal; el checker devuelve QUOTE_MISMATCH para texto inventado. Las comillas incompletas y las citas adicionales que no caben en el campo único quote aparecen como unresolved_markers con posición original y cierran el gate. Los apóstrofes internos de nombres no se confunden con delimitadores. Las citas adicionales pendientes no inflan detected_reference_count.

La prueba de integración verifica que una cita falsa entre guillemets produce PARTIAL y REFERENCE_VERIFICATION_REQUIRED. La lectura idempotente conserva ese resultado sin repetir modelos. La versión de política del hash sube a 3: un request ID almacenado bajo la política 2 genera IDEMPOTENCY_INPUT_CONFLICT y debe sustituirse por un ID nuevo; no se altera un resultado histórico ni se reejecuta automáticamente.

## Evidencia reproducible

Comando focalizado, ejecutado con exit 0 y 102/102 PASS en cinco archivos (30 casos nuevos):

```powershell
node node_modules/vitest/vitest.mjs run junta-juridica/tests/phase2/junta-audit.test.ts junta-juridica/tests/adversarial/extraction.test.ts junta-juridica/tests/adversarial/provenance.test.ts junta-juridica/tests/unit/versions.test.ts junta-juridica/tests/unit/auditor-budget.test.ts --reporter=json --outputFile=phase2/reports/junta-a1-regressions-final.json
node node_modules/typescript/bin/tsc --noEmit
```

Typecheck: PASS, exit 0. Build, suite total y smoke de integración se coordinan en el frente principal y se registran en PHASE2_TEST_RESULTS; este agente no ejecutó el smoke histórico ni sobrescribió sus resultados. El nuevo smoke usa un request ID de Fase 2.

Holdouts idénticos al baseline, comprobados por SHA-256:

- V1: `f68295e548c863f69a6eb280dee1776a9e9735bd4f5cce0b8b26fc22ecc29399`.
- V2: `1a5d1a1ee10849e79a986163e71a1cafdc32ace6f7d5611b504685b66cf73735`.

Las nuevas pruebas también son sintéticas y ahora conocidas; no constituyen el benchmark jurídico independiente real del Gate A2.

## Límites que permanecen

Una firma local prueba correspondencia con un verificador configurado, no una firma del Poder Judicial. El host debe proteger registro, autorizaciones, claves, derechos y publicaciones. Retirar la confianza impide que el checker revalide documentos; la expiración se comprueba al consultar el registro. No se implementó autenticación remota ni política empresarial de administración de confianza.

El parser requiere etiquetas explícitas para tribunal/sala y fechas ISO o españolas largas. Notaciones desconocidas y atribuciones semánticas arbitrarias requieren revisión; no se presenta una gramática finita como detección universal. Los modelos reales, ventanas de cuenta, calidad de auditoría y facturación siguen sin inferencia ejecutada. El manifiesto evita presentar una auditoría truncada como completa, pero no mejora por sí solo la calidad del proveedor.
