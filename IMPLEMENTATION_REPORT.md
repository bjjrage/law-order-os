# Informe integral — Fase 1 y remediación de auditoría

Actualización: 2026-10-13 UTC (2026-10-12, America/Asuncion). Motor experimental offline. No aprobado para verificación jurídica productiva ni piloto pago.

Se implementaron las correcciones autorizadas de la auditoría técnica, priorizando J-002, J-001 y J-003. No se ejecutaron solicitudes externas, inferencias pagas, despliegues ni cambios en otros proyectos. La carpeta original carecía de Git, Blueprint, Roadmap, handoff y corpus; continúan pendientes.

| Hallazgo | Resultado local | Dependencia pendiente |
|---|---|---|
| J-002: autenticidad autodeclarada | Ingesta rechaza AUTHORIZED_ORIGINAL y authority_record del caller. Checker exige atestación Ed25519 vigente de claves configuradas fuera del bundle. Firma vinculada al documento completo, bytes, URL, verificador, fechas y derechos. | Incorporar un verificador confiable real y originales oficiales autorizados. La firma no prueba por sí sola verdad jurídica. |
| J-001: citas omitidas | Detección separada de extracción y resolución; familias extensibles, abreviaturas, referencias numeradas desconocidas y gate cerrado. Referencias pendientes o no verificadas dejan PARTIAL y bloquean etiquetas de verificación. | Gramática finita, falsos positivos conservadores y evaluación jurídica independiente pendiente. |
| J-003: versión por orden de carga | Publicación explícita de versión vigente. Varias versiones sin publicación bloquean snapshot; orden de carga y nombres no conceden vigencia. | El host debe autorizar las publicaciones. |
| J-004: límite fijo de Gemini | Presupuestos configurables, ventana del modelo exigida, manifiesto de cobertura y bloqueo de entradas excesivas sin truncamiento. | Sin fragmentación automática; costos, calidad y ventana reales no comprobados. |
| J-005: integración real | Continúa BLOCKED / NOT_RUN. Se conserva habilitación explícita de gasto. | Credenciales, tarifas, corpus, documentación y evaluación de cuenta. |

La secuencia Jev → Luna → Sol Medium → Gemini → checker → humano permanece. Todo resultado sigue siendo borrador con aprobación humana pendiente.

Evidencia ejecutable: [TEST_RESULTS.md](TEST_RESULTS.md), [AUDIT_REMEDIATION.md](AUDIT_REMEDIATION.md) y JSON bajo junta-juridica/reports. Los reportes anteriores se preservaron con sufijo before-remediation. El holdout V1 permanece intacto; V2 conserva hash y primera evaluación. Ambos son ahora regresiones conocidas, no evidencia independiente.

Los resultados guardados no se reutilizan bajo una política de verificación diferente: el hash de idempotencia incluye política y registro de confianza. Una atestación que vence invalida la verificación al recuperar el resultado sin repetir modelos. Las exportaciones vuelven a ejecutar el checker; sin confianza configurada no publican VERIFIED.

Costo pagado: USD 0. Tokens, tarifas y latencias offline son sintéticos/locales. Los límites de producción figuran en [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

