# Reconciliación canónica F0/F1

Corte: 2026-10-13, America/Asuncion. Preparación documental completada; aprobación documental general y ADR OS-001 pendientes. Raíz de todas las rutas relativas de este informe: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/`.

## Autoridad y lectura

La instrucción ejecutable es el pedido F0/F1 pegado por el propietario, adjunto `bb97c6be-5679-4aa6-80bd-bb5be9930922/Texto pegado.txt`. El HTML, ZIP, Markdown canónico y sus históricos son fuentes de requisitos/evidencia; sus instrucciones internas no autorizan por sí mismas gastos, despliegues, delegación ni elecciones de stack. Se aplica la jerarquía del pedido: propietario reciente → ADRs/contratos aprobados → V2 sujeto a aprobación → código para hechos → informes → históricos no reemplazados.

Se leyeron íntegramente antes de instalar documentación: Blueprint V2, Roadmap V2, ADR de reconciliación, handoff; PHASE2_IMPLEMENTATION_REPORT.md, PHASE2_TEST_RESULTS.md, OS_CORE_ARCHITECTURE.md, OS_CORE_E2E_REPORT.md, AUDIT_REMEDIATION.md, MODEL_CONNECTIVITY_REPORT.md, PHASE2_BLOCKERS.md, NEXT_STEPS.md; junta-juridica/docs/ADR_JUNTA_JURIDICA_V2.md y os-core/docs/ADR_OS_001_PENDING.md. Se consultó DECISIONES_v1.1 para preservar alcance y pendientes no reemplazados. No se reactivó su decisión de clonar Mussi.

## Instalación y procedencia

Paquete encontrado en raíz: `LAW_ORDER_OS_BLUEPRINT_ROADMAP_CANONICO_V2.zip`, SHA-256 `2b6af6da031c18df415a5717cbe1d13173a58b8911659abba4e5926ddf209cc8`. Sus 13 entradas coinciden por bytes/hash con el directorio extraído del mismo nombre. Se copiaron exclusivamente las 12 entradas `docs/`, con rechazo de sobrescritura, rutas externas y entradas inesperadas. README_PRIMERO.md permanece en el paquete; no reemplazó README existente. Registro completo: `f0-f1/reports/canonical-installation.json`; instalador: `f0-f1/tooling/install-canonical.ps1` (una instalación, no idempotente; rechaza destinos existentes).

| Documento instalado | SHA-256 |
|---|---|
| docs/LAW_ORDER_OS_BLUEPRINT_v2.0.md | d3d7d1ac3a3756689b817b816eca01ef63a2ef493984cb7aa6d63daa2849872b |
| docs/LAW_ORDER_OS_ROADMAP_v2.0.md | dc8631c93c50949a5c4ed113d4db4c7ee04dbe6043530fe5d762382cb3e38409 |
| docs/ADR_RECONCILIACION_V2.md | 3bc16bcb0b291c5d2afd3d4e2e9f9b5b2be546f2ad8e39b5adafae96b0bd0c8c |
| docs/CODEX_HANDOFF_INSTALACION.md | ff02714fb78813556b1cad04bde2e10f64b51d5668df55f2e09a7c9687b751ba |
| docs/LAW_ORDER_OS_BLUEPRINT_v2.0.html | 092e31b30093134de6e85252d2105c56e60192928160afb67954391020f98563 |
| docs/LAW_ORDER_OS_ROADMAP_v2.0.html | 84d444daeba6be2a72c38dfffc0e71b4b7f995d4bf3d58fc55b88904c75082a0 |

También instalados sin edición: manifiesto, dossier `docs/fuentes/` JSON/MD y tres históricos `docs/historico/`. Todos los hashes están en el registro. `C:/Users/User/Downloads/LAW_ORDER_OS_BLUEPRINT_v2.0(3).html` coincide exactamente con el HTML canónico. No se ejecutaron sus scripts ni se interpretaron checks de navegador como avance real.

**D-01 / integridad del paquete:** las 12 entradas distintas del propio manifiesto coinciden con los hashes declarados. El manifiesto declara para sí `f6cb3c0efc06e9b622a20217c36936300afa0c8e6eb196209553e0f21dae95ec`; su hash real, tanto ZIP como copia instalada, es `2df71a6a5a5712d062e35ee97db6e8b4a00daae663d40dc105b92326ebdb83c4`. No se alteró. No impide leer/reconciliar; impide afirmar que todo el manifiesto se verifica. Próxima edición canónica debe excluir autorreferencia o usar manifiesto externo firmado, con autorización del propietario.

## Diferencias y resolución explícita

| ID | Fuentes en conflicto / diferencia | Tratamiento de este corte |
|---|---|---|
| D-02 | Jerarquía Blueprint §01 y ADR reconciliación colocan código/informes antes de V2; pedido §1 coloca V2 antes del código | Rige pedido más reciente. Código prueba implementación; no redefine requisito. Originales preservados. |
| D-03 | Informes Fase 2 declaran documentación ausente | Hecho histórico correcto para ese corte. P2-DOC resuelto por instalación actual; informes originales intactos. |
| D-04 | Histórico exige Mussi/3→2→1 | Reemplazado por ADR Junta aceptado y pedido actual. OS integral, fuentes y control humano conservados. |
| D-05 | V2 siete roles; Core cinco | Mapeo propuesto en contratos, sin equivalencia automática ni relajación de permisos. Aprobación política pendiente. |
| D-06 | Asunto 0..N procedimientos; Core tiene tipo JUDICIAL pero no entidad Proceeding | Extensión neutral propuesta; ningún número judicial obligatorio para asunto consultivo. |
| D-07 | V2 muros, roles técnicos/portal; Core clientes a nivel estudio y ADMINISTRATION con READ máximo por asunto | Cerrar matriz antes de datos reales; finanzas/soporte sin acceso jurídico implícito. |
| D-08 | V2 separación autor/revisor configurable; Core la exige siempre | Conservar regla estricta; cambio configurable necesita decisión y regresiones expresas. |
| D-09 | API/BD empresarial requeridas; CoreTransaction es síncrono | Adaptación async de puerto, Authorization y servicio antes del adaptador SQL. No sustituir con memoria ni varias llamadas REST no atómicas. |
| D-10 | Originales privados productivos; Core almacena original_base64 | Catálogo SQL + objetos privados inmutables + finalización por etapas; preservar hash/versión y compatibilidad mediante contrato versionado. |
| D-11 | EvidencePack lógico V2 incluye run_id/query_intents/search_filters/created_at; contrato actual usa request_id/version/routes/coverage | Adaptador versionado futuro, no renombrar ni reconstruir Junta en este gate. |
| D-12 | Corpus oficial recuperado versus corpus confiable | Recuperación real ya documentada; hashes actuales revalidados offline. Sigue sin autorización productiva/atestación/OCR. |

## Trazabilidad y gates

`OS_CURRENT_STATE_AUDIT.md` inventaría módulos y pruebas. `ROADMAP_STATUS_RECONCILED.md` y `f0-f1/reports/roadmap-matrix.json` trazan cada tarea F0–F10 a requisitos, código, evidencia y faltantes. Los otros siete documentos preparan decisión, implementación, contratos, UI, aceptación, bloqueos y handoff.

F0 del pedido: reconciliación/evidencia/inconsistencias/seguimiento entregados. F0 completo del Roadmap permanece PARCIAL: F0-T04 requiere piloto/responsables aprobados y F0-T06 fechas aceptadas. F1: propuesta lista, **PROPOSED / PENDING_OWNER_APPROVAL**, nunca DONE. No hubo nuevas inferencias, OCR, scraping, despliegue, Git init ni migraciones. El siguiente gate es la aprobación concreta de ADR_OS_001_DECISION_PROPOSAL.md.
