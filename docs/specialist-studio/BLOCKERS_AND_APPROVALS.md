# Bloqueos, límites y decisiones de aprobación

Actualización documental: 15/10/2026, America/Asuncion. Referencia de decisiones/handoff: 14/10/2026; propuestas aún sin aprobación funcional.

Fecha: 14/10/2026. Estado: entrega G0/G1 preparada, sin autorización de implementación productiva. [ADR propuesto](ADR_SPECIALIST_STUDIO_002.md).

## Estado vigente de esta continuación

Actualización posterior: ADR aceptado por el propietario el 15/10 y piloto contractual local sintético/offline autorizado. [Entrega del piloto](ELENA_LOCAL_PILOT_2026-10-15.md). Se implementaron asignación, plan, ejecución determinística, auditoría conservadora y vínculo a borradores/versiones; los bloqueos de proveedores, fuentes oficiales, seguridad empresarial y evaluación jurídica continúan. Las menciones de aprobación pendiente siguientes describen el corte documental anterior.

La dirección de personajes y agrupación ya está aceptada. El catálogo/PNG/frontend local sí existe; la composición fue rechazada. El diseño funcional se reconcilió y siguen pendientes el ADR, implementación especializada y evaluación jurídica. El informe nuevo [design-reconciliation-2026-10-14.json](reports/design-reconciliation-2026-10-14.json) separa observaciones actuales de validaciones históricas.

Las secciones finales que narran «ninguna opción seleccionada», «frontend sin cambios» o maquetas corresponden a etapas anteriores; no describen el runtime actual. No se repite selección de estilo ni se considera la UI rechazada como aceptación.

## Bloqueos con evidencia

| ID | Estado y evidencia | Qué impide / salida necesaria |
|---|---|---|
| B01 | Repo unborn, branch nominal feat/os-core-local, cero archivos tracked, SHA null | Baseline Git/worktree fiable. Aprobar una estrategia recuperable de versionado antes de implementación; no se hizo commit/branch/push |
| B02 | Proceso actual no expone SHA/build manifest; cinco módulos críticos y assets sí cotejados | Acreditar versión completa en memoria. Incorporar identificación de build en un cambio posterior aprobado; no afirmar despliegue/versionado completo hoy |
| B03 | Hay catálogo visual; titular durable/Director/selección ejecutada/override/debate por réplicas siguen sin implementar | Implementar diseño aprobado G2–G5, no confundir control visual con función |
| B04 | Checker solo recibe PrincipalAnalysis, incl. recheck de caché; probe GAP_REPRODUCED | Afirmar referencias verificadas de todos los agentes o del export. Gate de manifiesto/versionado nuevo obligatorio |
| B05 | `library_research` separado de documentos checker; atestaciones oficiales no acreditadas; tres originales UNVERIFIED_FOR_CHECKER | Autenticar fuentes reales. Política/curaduría/registry autorizados y resolver sobre mismo registro; nunca autofirmar para hacer PASS |
| B06 | Número civil en palabras no extraído; benchmark histórico 11/12 | Certificar cobertura completa. Nuevos casos/corpus externo y parser evaluado; preservar medición conocida |
| B07 | Índice/OCR activo; cifras nuevas en informe de revalidación, no usar contadores históricos; fallos/lecturas parciales/pendientes | Declarar corpus universal o perfiles tributario/comercial validados. QA/cobertura por materia, no número global |
| B08 | LocalStorage y perfiles sintéticos, puente sin identidad empresarial | Uso con datos reales/confidenciales y seguridad multiestudio. Auth/permisos servidor, SQL/RLS/storage/jobs/cachés, revocación y E2E real antes de ese uso |
| B09 | Model IDs configurados; run LIVE previo conservado; acceso actual no consultado | Afirmar disponibilidad vigente o ejecutar nuevas llamadas. Preflight y gasto/datos autorizados por encargo; fallas honestas |
| B10 | Precios fechados en archivo histórico, techo Junta fija y expiry de preparación | Costear nueva arquitectura. Estimaciones/validez/límites por perfil+ronda y reserva central; no extrapolar USD 0,60 por agente |
| B11 | Handoff V1 no encontrado en repo/Downloads | Matriz literal V1→V2. Puede aportarse luego; no bloquea contrastar la propuesta con código/ADRs reales |
| B12 | Orquestación actual no contempla réplica y nueva integración, ni enlace auditoría→documento | Aceptación E2E de debate y edición/export. Adaptar schemas/versiones y medir con pruebas negativas |
| B13 | Dirección/personajes aceptados e incorporados; composición local rechazada | Replantear Dashboard/Mi día/Equipo jurídico después del ADR funcional; conservar seis identidades, hover/foco, sin catálogo permanente |

Dueño de decisiones de producto/autoridad/gasto: propietario. Revisión de corpus/alcance jurídico: profesional designado por el propietario, aún sin identidad asignada. Responsable de implementación después de aprobación: equipo implementador. No se inventan personas ni plazos de cierre.

## Aprobación arquitectónica pendiente

P01 confirmación humana/CAS de titular; P02-R1 Director conversacional acotado, reglas explícitas para piloto; P03-R1 piloto contractual aún PILOT_DESIGN_ONLY; P04 Jev activo y contexto/opinión Luna separados; P05 integración por titular; P06 una ronda Gemini y réplicas acotadas; P07 quién autoriza costos; P08 Sol por perfil/encargo; P09 presupuesto explícito ligado a plan/precios/snapshots; P10 versión aditiva/legacy; P11 preasunto/enlace Core; P12 consentimientos separados; P13 modalidades incluida Junta completa; P14 adversario transversal; P15 paquetes/evaluación; P16 navegación/KPI y voz pendiente. Están descritos con alternativas en el ADR; no es necesario responder uno por uno si se aprueba el conjunto explícitamente. C01/V01 ya están aceptadas como catálogo/dirección visual, sin aprobar el resto del ADR.

El pedido posterior de UI y su corrección confirman estilo sobrio/moderno, agentes como personajes humanos 3D flotantes y prohibición absoluta de nombres de modelos/proveedores en la interfaz. La serie inicial con objetos quedó descartada y se conserva como antecedente; se genera otra serie para seleccionar. Seleccionar una imagen no aprueba automáticamente contratos, presupuesto, accesos, implementación productiva o despliegue. Aceptar ADR no aprueba por sí solo imagen ni gasto externo.

## Dependencias concretas pendientes

| ID | Dependencia | Estado |
|---|---|---|
| B14 | 22 paquetes tienen procedimientos/controles, pero falta curador y mapa source_id/versión/pasajes/temporalidad por paquete | DRAFT; no competencia habilitada |
| B15 | Herramientas de matrices/comparación/calculadores aún son especificaciones; fórmulas requieren revisión y tests propios | NOT_IMPLEMENTED; ninguna herramienta obtiene permisos por ficha |
| B16 | Holdout contractual independiente, revisión humana y umbrales previos | NOT_RUN; propuesta de 24 casos no creada ni congelada |
| B17 | Director generativo necesita IntakeDraft/CoordinationGrant, datos/límites y reserva central | PROPOSED; no asumir gratuito ni encender por abrir Dashboard |
| B18 | KPI de estudio/borradores devueltos no salen de /my-day personal | Agregado autorizado pendiente; no usar storage bruto |
| B19 | Voz: Firefox, procesamiento/terceros/retención/costo y controles de envío | APLAZADA; texto sigue siendo recorrido completo |
| B20 | createMatter genera ID nuevo por llamada; modo local no acredita idempotencia de alta | Definir y probar comando/enlace sin duplicados antes de reintentos de creación desde ingreso |

## Próximo alcance recomendado si se acepta el ADR

G2 local sintético: un especialista Civil/Contractual dentro de un asunto existente, responsable humano separado, asistencia por reglas rotulada como tal, RAG/Jev/contexto/opinión Luna, checker terminal y persistencia por versión. Director generativo es un lote adicional con grant/presupuesto de coordinación P02-R1. Probar con proveedores offline explícitos y costo cero de inferencia jurídica antes de pedir una consulta real acotada. No ampliar materias/debate/Sol en el mismo lote.

La autorización histórica de una Junta real y la política de botón hasta USD 0,60 existen como evidencia, pero esta auditoría no las utiliza para iniciar otra consulta. Tampoco continúa otra tarea agendada ni modifica el proceso de Biblioteca existente.

## Verificaciones históricas de la entrega inicial

- GET locales de home/status/progreso y de resultado histórico, sin POST de preparación/consulta/demo.
- Capturas actuales 1366×768 y 1440×900 y lectura de estilos/AX; ningún cambio de datos del asunto.
- Comparación de assets servidos/disco y emisión ESM de cinco módulos críticos; corrección del método inicial preservada.
- Integridad de tres PDFs y huella del handoff leído completo; 100 archivos de código/documentación previa protegidos por hashes.
- 271/271 Core/Junta y 10/10 tests locales focalizados; typecheck raíz exit 0. Probe simulado reproduce omisión del auditor y número en palabras pendiente.
- Generación posterior de tres conceptos visuales mediante ImageGen, separados de inferencia jurídica/OS. Maquetas, no implementación ni prueba de backend.

No se corrieron builds que sustituyeran dist, migraciones, tests con inferencia real, benchmarks que sobrescribieran primeras mediciones, deploy, reinicio del servidor ni scrapers nuevos. El pipeline Biblioteca existente sigue en marcha bajo su política previa; sus escrituras no provienen de esta auditoría.

## Verificaciones de esta continuación

GET locales de home/assets y progreso Biblioteca; 200 y paridad de bytes HTTP/dist; /api/v1/ devuelve 404 en este modo; Git sigue sin HEAD y cero tracked. Relectura de TSX/payloads y orquestación/checker confirma catálogo descriptivo y alcance limitado a análisis. Sin POST de consulta/preparación, build, reinicio o modificación de datos.

Validación documental nueva: correspondencia de 22 IDs/personas/estados con catálogo aceptado, integridad estructural y enlaces locales. No son tests de agentes, benchmark legal ni E2E. Comparación de hashes sobre 111 archivos protegidos para comprobar preservación en esta continuación.

## Entregables

1. [Foto runtime](CURRENT_RUNTIME_MAP_2026-10-14.md).
2. [ADR](ADR_SPECIALIST_STUDIO_002.md).
3. [Chief/asignación/convocatoria/override/disposición humana](HEAD_CHIEF_DISPATCH_CONTRACT.md).
4. [Perfiles y RAG](SPECIALIST_PROFILES_AND_RAG.md).
5. [Debate y checker final](ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md).
6. [UI compacta moderna y 3D](SPECIALISTS_COMPACT_UI_SPEC.md).
7. [Gates, plan y DONE](IMPLEMENTATION_GATES_G0_G6.md).
8. Este registro de bloqueos/aprobaciones.

Se agregan [22 fichas](SPECIALIST_CAPABILITY_PACKS.md), [catálogo de capacidades](contracts/SPECIALIST_CAPABILITY_PACKS.v1.json), [protocolo contractual](CONTRACTUAL_PILOT_EVALUATION.md) y validador documental reproducible en tooling/validate-design-contracts.mjs.

La dirección visual ya fue seleccionada. El ADR reconciliado queda a disposición del propietario; no se inicia G2 por silencio ni por haber terminado la documentación o aceptar catálogo/estilo.

Contexto de diseño: se inspeccionaron ambas referencias y se adjuntaron a cada generación. No había contexto Product Design guardado en la ruta local consultada. El script de preflight del plugin fue localizado, pero no pudo ejecutarse por falta de Python/runtime configurado; se continuó con el brief explícito y las capturas actuales, sin guardar preferencias fuera del proyecto. Las tres imágenes se conservaron en `concepts/` según su orden de aparición y están enlazadas desde la especificación UI.

Corrección de personajes/terminología: serie inicial descartada y preservada como antecedente. Nueva serie `concepts/human-option-01-v2.png` a `human-option-03-v2.png`, con personajes humanos y sin nombres de modelos visibles, revisada visualmente. Se actualizaron ADR, UI, perfiles, contrato de potencia, gates y este registro. No se modificó el frontend levantado ni la orquestación; la regla es requisito de la futura implementación. Los controles/formatos y tamaños de las maquetas siguen sujetos a QA funcional/visual, no son soporte de producto acreditado.

La corrección posterior «3d medio caricaturesco tipo emoji pero hyperrealista» supera la serie v2 de retratos. Serie vigente: `concepts/emoji-option-01-v3.png` a `emoji-option-03-v3.png`, en orden efectivo de aparición. Personajes con geometría caricaturesca y acabado 3D realista, sin nombres de modelos visibles; imágenes revisadas visualmente y enlazadas desde UI. Series previas permanecen como historial; ninguna opción está seleccionada. Solo documentación y maquetas, sin cambios de runtime.

Decisión posterior C01/V01: el propietario adjuntó la primera imagen v3 como referencia aceptada y aprobó la organización de seis áreas con «esta bien... hacelo». Se incorporó `contracts/SIX_AREA_SPECIALIST_CATALOG.v1.json`, con seis áreas/personas, subperfiles internos y dos roles de apoyo fuera del conteo. Adaptación visual única, sin otra ronda de alternativas: `concepts/six-area-selected-v4.png`, con selector abierto de seis y equipo del asunto separado. Se reconciliaron ADR, perfiles, contrato Chief, UI y gates. Agrupación/estilo aceptados; perfiles no activados ni certificados, orquestación/frontend/runtime sin cambios. El ADR de ejecución continúa pendiente.
