# Consulta real completada — recuperación tras apagón

Fecha de trabajo: 2026-10-13, America/Asuncion. Caso exclusivamente sintético. Autorización del propietario: una consulta con techo total USD 0,60. Sin despliegues.

Preparación: `565ec866-bcd6-4c1a-8dbc-cc905950d3d9`.
Run: `run:6c068939d23695960768c605ddf8f3a4`.
Resultado: **HUMAN_REVIEW_PENDING**. Análisis real guardado como borrador en el Core del navegador, versión `ad7700f6`.

| Etapa | Resultado | Intentos de inferencia |
|---|---|---:|
| Jev: selección de evidencia | PASS | 1 |
| Luna: contexto | FAIL original conservado | 1 |
| Reparación local del contexto guardado | PASS | 0 |
| Sol: análisis principal | PASS | 1 |
| Gemini: revisión adversarial | PASS | 1 |
| Checker determinista | PASS_IN_SCOPE | 0 |

El FAIL inicial se debió a clasificación factual excesiva de un relato UNKNOWN. El contexto conservado también contenía un ID redundante incorrecto. Se reparó únicamente por coincidencia única exacta de versión y fragmento originales; afirmaciones y cronología se conservaron como inferencias no verificadas. Se retuvo la respuesta original inmutable y se registró la transformación separadamente. No se repitieron llamadas ni se cambió la consulta autorizada.

Costo estimado acumulado USD **0.033777218**, 12.241 tokens de entrada y 4.692 de salida según proveedores. Factura real no disponible. No hay autorización para nuevas consultas pagas.

El análisis identifica contrato íntegro, anexos, aceptación/firmas, adendas y, según corresponda, registros de ejecución y avisos. No acredita hechos reales ni concluye incumplimientos. Gemini señaló expresamente la ausencia del contrato íntegro y el carácter ficticio del relato. No se incorporó corpus normativo oficial; PASS_IN_SCOPE no implica aprobación jurídica.

Validación: build Junta, build web y typecheck OS PASS; 271 pruebas Core/Junta y 12 locales PASS. El navegador confirmó el resultado real, su costo y el borrador guardado. La recuperación de consultas usa GET y no vuelve a ejecutar proveedores. Credenciales permanecen privadas en el servidor local.

Evidencia: `reports/real-run-result.json`, `reports/real-run-before-continuation.json`, `reports/real-run-saved-draft.png`, `reports/real-run-repair-core-tests.json`, `reports/real-run-repair-tests.json`.
