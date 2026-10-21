# Fase 2 — informe de implementación y handoff

Fecha: 2026-10-13, America/Asuncion. Alcance preparatorio completado con bloqueos explícitos. No hay certificación productiva de Junta ni OS persistente empresarial.

## Baseline y gobernanza

Se continuó desde el motor existente. Se leyeron los siete informes previos y ADR-001, y se inspeccionaron fuentes, dependencias, pruebas y árbol antes de editar. No existe Git: rama y SHA inicial/final son null; no se creó remoto ni se hizo push. Baseline de 76 archivos preservado en phase2/baseline, con hashes en phase2/baseline-manifest.json. Blueprint/Roadmap V1.1, handoff vigente e investigación F1 no estaban disponibles en el proyecto; no se inventó su contenido.

Los frentes se trabajaron con archivos separados. Se conservaron informes y holdouts históricos; los nuevos resultados están en phase2/reports. No hubo migraciones, despliegues ni cambios en Mussi u otros proyectos.

## Gates y estado real

| Gate | Resultado | Evidencia |
|---|---|---|
| A1: auditoría J-001..J-004 | PASS / TESTED_OFFLINE para regresiones, typecheck, build y smoke; límites reales documentados | PHASE2_TEST_RESULTS.md; phase2/docs/JUNTA_A1_AUDIT.md |
| A2: corpus inicial | VERIFIED_REAL de recuperación HTTPS de tres originales; integración/autenticación del checker BLOCKED | OFFICIAL_CORPUS_MANIFEST.json; originales, hashes y revisión local |
| Benchmark nuevo | Medición reproducible ejecutada; validación de autenticidad BLOCKED; extracción completa FAIL en un caso | BIBLIOGRAPHIC_BENCHMARK_REPORT.md |
| A3: conectividad/smoke | Adapters y preflight IMPLEMENTED / TESTED_OFFLINE; cuenta/evidencia congelada BLOCKED; inferencia NOT_RUN | MODEL_CONNECTIVITY_REPORT.md; LIVE_SMOKE_PLAN.md |
| B1: OS Core | Contratos y servicio IMPLEMENTED / TESTED_OFFLINE; persistencia/auth/E2E real BLOCKED | OS_CORE_ARCHITECTURE.md; OS_CORE_E2E_REPORT.md |

## Frente A implementado

La auditoría factual encontró un bypass de citas literales con delimitadores no reconocidos, incompletos o múltiples. Primera evaluación: 16/25 PASS, 9 FAIL, conservada. Se corrigió extracción y cierre del gate; 30 nuevas regresiones. Extractor es-bibliography-v3 y política de hash 3: usar IDs nuevos, sin alterar/repetir resultados históricos. La CLI por defecto usa demo-offline-v3; --report-dir permite preservar informes anteriores.

OpenAI/Jev no revocaban verified tras una revalidación fallida; se corrigió y probó con HTTP falso. Se implementó assessLiveSmokeReadiness y rutas live-preflight/live-smoke. El smoke futuro aplica plan.config exacto, un candidato, cero reintentos/recuperaciones, techo USD 0.60; no transmite autorización por aprobar un preflight.

Se recuperaron:
- Sala Constitucional: Acuerdo y Sentencia 1010, 2015-12-11, 13 páginas.
- Sala Civil y Comercial: Acuerdo y Sentencia 1184, 2013-09-19, 29 páginas.
- Sala Penal: publicación oficial identifica Acuerdo y Sentencia 162, 2023-05-24, 7 páginas; número/fecha no están impresos en su encabezado PDF.

Cada original conserva bytes, SHA-256, URL, fechas, MIME, páginas, metadatos y restricciones. PDF.js 6.4.299, instalado como tooling aislado, permitió extracción y render local sin Python. Se inspeccionaron primera/última página. El constitucional es escaneo sin texto; los otros dos tienen texto digital sin revisión integral. Firma visible no se presenta como firma criptográfica validada. No se emitieron atestaciones locales para conseguir VERIFIED.

El conjunto nuevo de 12 casos fue congelado antes de la primera medición. Detección 12/12; extracción 11/12. Encabezado civil con número escrito en palabras deja marcador pendiente. No se ajustó el parser a ese resultado; primera evaluación y repeticiones conservadas. Cero VERIFIED deriva de confianza cerrada, no prueba precisión real. Curaduría jurídica externa pendiente.

Única consulta autenticada de metadatos: Google Models GET devolvió HTTP 401. Jev/OpenAI sin claves; ningún modelo identificado como accesible en cuenta. No se cambió ningún modelo aprobado.

## Frente B implementado

Biblioteca de dominio y servicio: estudios, identidades, membresías/roles propuestos, clientes/contactos/partes, asuntos/participantes, documentos/versiones, tareas, borradores/revisiones y actividad. Denegación por defecto en el servicio, pertenencia y permisos de asunto explícitos, aprobación humana ligada a versión exacta. Adaptadores de memoria e identidad sintética solo en testing, excluidos del build del servicio.

Los 14 pasos se probaron con datos sintéticos; no se afirma supervivencia a recarga/sesión durable. ADR OS-001 queda PENDING_DECISION, con contratos de almacenamiento y alternativas sin adoptar infraestructura definitiva.

## Verificación y costo

271/271 tests integrados, 17 archivos; typecheck y ambos builds PASS. CLI smoke, consulta, idempotencia, regresiones conocidas y bloqueos de gasto PASS, bajo guardia de red. Integridad de tres originales PASS.

Inferencia pagada USD 0; generación real NOT_RUN; despliegues 0. Las tarifas del plan son públicas documentadas y no factura de cuenta. Hubo lecturas públicas, descargas oficiales y un GET de metadatos, sin inferencia.

Los archivos creados/modificados y sus hashes se enumeran en phase2/reports/final-file-inventory.json. Las decisiones pendientes y el siguiente paso exacto están en PHASE2_BLOCKERS.md y NEXT_STEPS.md.

