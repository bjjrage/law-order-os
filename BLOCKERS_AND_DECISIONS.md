# Bloqueos, decisiones y dueños

2026-10-13. Raíz: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/`. Personas y fechas pendientes se indican expresamente; un rol propuesto no asigna responsabilidad a alguien sin aceptación. Prioridad inmediata: gate ADR, luego dev local y slice. Prohibiciones de gasto IA/deploy siguen vigentes aunque se acepte stack.

| ID / prioridad | Estado factual | Dueño de decisión propuesto / fecha | Trabajo listo y condición exacta de cierre |
|---|---|---|---|
| P2-DOC / cerrado local | RESOLVED en este corte | Codex ejecutó instalación,2026-10-13 | docs canónicos instalados y auditados; aprobación documental V2 aún separada. Informes Fase2 conservan su fecha/ausencia histórica. |
| DOC-INTEGRITY / P2 | OPEN | Propietario/editor canónico; fecha por acordar | Auto-hash manifiesto inconsistente D-01; resto12 entradas coincide. Corrección externa del manifiesto requiere nueva edición, no bloquear lectura. |
| ADR OS-001 / P0 | PROPOSED / BLOCKED para implementación | Propietario; antes de iniciar F1 infra/F2 | Aprobar texto exacto B de ADR_OS_001_DECISION_PROPOSAL.md con región/servicios y dev local; registrar fecha/aprobador/alcance. |
| PROD-01 / P1 | OPEN | Propietario + responsable jurídico del piloto por designar; antes de F9/datos reales | Nombrar estudio, tamaño/equipo/especialidades/proceso cobro y criterios de aceptación. F0-T04 no DONE. |
| AUTHZ-01 / P1 | OPEN | Propietario + responsable jurídico por designar; antes de habilitar roles/clientes reales | Aprobar política directorio clientes, mapeo cinco→siete roles, responsable≠rol global y finanzas/técnico/portal sin acceso implícito. Conservar autor≠revisor hasta aprobación de cambio. |
| CORE-ASYNC / P1 | SPECIFIED / NOT_IMPLEMENTED | Coder siguiente tras ADR; antes de adapter pg | Convertir puerto y consumidores await, preservar regresiones, consultas SQL acotadas. No envolver memoria como producción. |
| BLOB-01 / P1 | SPECIFIED / NOT_IMPLEMENTED | Coder siguiente tras ADR; antes de upload web | Versionar DocumentVersion y staging/finalización/scan; immutabilidad bytes y CAS; tests fault injection. |
| OPS-01 / P1 | OPEN | Propietario designa operador/sustituto; antes de preview/piloto | Git local/CI/entornos/runbook/backup restore y alertas. No remoto/deploy. Git actual ausente. |
| GOV-01 / P1 | OPEN | Propietario + profesional de privacidad por designar; antes de datos reales | Residencia contractual/subprocesadores, soporte, retención/borrado, copia objetos/logs y uso proveedores IA. São Paulo no certifica todo el tratamiento. |
| BUDGET-OS / P1 | NOT_AUTHORIZED | Propietario; antes de crear recursos pagos | Banda planificación105–200USD/mes sin IA; cotización regional/techo final y costos adicionales aprobados por separado. Dev local sintético no requiere contratar. |
| P2-TRUST / DATA-01 | BLOCKED | Responsable jurídico/curador por designar; antes de VERIFIED real | Política de emisores/authority/registry Ed25519 externos aprobada y originales contrastados; no firmar internamente para mejorar porcentaje. |
| P2-PDF/OCR/REVIEW | BLOCKED integración, no revisión técnica | Curador jurídico + coder tras contratos; fecha pendiente | PDF.js ya resolvió alternativa a Python. Falta adaptador binario/extracción versionada, OCR constitucional y QA integral civil/penal. No re-descargar ni hacer OCR pago aquí. |
| P2-RIGHTS | BLOCKED productivo | Propietario+responsable jurídico; antes de indexación | production_indexing_permitted=false; aprobar alcance/privacidad/derechos, no asumir uso ilimitado por URL pública. |
| P2-GRAMMAR / QA-01 | FAIL conocido | Coder Junta + curador externo por designar; siguiente fase IA autorizada | Corregir número en palabras en development nuevo, preservar dataset/primera medición; nuevo holdout independiente congelado. No cambiar engine en gate documental. |
| P2-BENCH | BLOCKED | Curador externo por designar; antes de certificar corpus | Ground truth auténtico, par de ambigüedad y cita literal revisada, métricas no null cuando corresponda.0 VERIFIED con gate cerrado no basta. |
| P2-KEYS / AI-01 | BLOCKED | Propietario/operador credenciales; antes de metadatos reales | Jev/OpenAI ausentes, Google401 histórico; corregir config sin imprimir secretos, no fallback/modelo nuevo. No repetir401 sin cambio. |
| P2-PRICE/PACK | BLOCKED | Operador + responsable jurídico; antes de smoke futuro | Tarifas/ventanas/cuenta frescas, confianza y extracción, bundle/EvidencePack congelados/hashes no null. Plan público previo expira20/10/2026. |
| P2-SPEND | NOT_AUTHORIZED / NOT_RUN | Propietario; aprobación futura específica | UNA ejecución con techo y datos aprobados solo tras todos gates; aprobar stack no autoriza gasto IA. |
| FIN-01 / LOCAL-01 | OPEN | Propietario+profesional fiscal/jurídico; antes de F8 funcional | Monedas/escala/tributos/fondos/reglas plazos/calendarios/firma/conectores. Solo contratos preparados, sin emisión fiscal ni plazos LLM. |
| COM-01 | OPEN | Propietario; antes de F10 | Modelo comercial sustentado en costos/uso medidos; sin IA ilimitada ni margen inventado. |
| P2-DEPLOY | NOT_AUTHORIZED / NOT_RUN | Propietario; después de piloto y permiso separado | Deploy/push/migración productiva continúan prohibidos; no bloqueo de lectura, auditoría o diseño. |

## Cierre del pedido frente a cierre del producto

Completados los diez entregables no bloqueados, instalación documental, inventario, matriz78 tareas, propuestas UI/API/datos/E2E/operación y comprobación offline. F0 del pedido documental satisfecho con inconsistencias registradas. F0 del Roadmap no completo por piloto/fechas; F1 listo para decisión, no DONE. F2–F4 pueden empezar localmente después del ADR y decisiones de permisos pertinentes; F5–F6 mantienen gates independientes. No declarar release ni backend empresarial funcionando.

La fecha de cierre de decisiones no se inventa. El próximo propietario debe ratificar personas/fechas al aceptar ADR/piloto; mientras tanto el hito relativo de la tabla fija cuándo bloquean. No se requiere autorización adicional para la documentación ya completada. La pausa siguiente proviene del pedido humano §15: «No declarar F1 DONE hasta contar con aprobación explícita del stack» y «DETENERSE ÚNICAMENTE EN EL GATE DE APROBACIÓN DEL ADR OS-001, ANTES DE FIJAR INFRAESTRUCTURA PRODUCTIVA».
