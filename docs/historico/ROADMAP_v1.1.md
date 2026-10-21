# LAW & ORDER OS — Roadmap de construcción

**Versión 1.0 · 11 de octubre de 2026 · Plan para el OS completo, no para un asistente aislado.**

## Estado de arranque

Blueprint y roadmap preparados. Investigación pública de fuentes parcialmente realizada: API legislativa localizada, respuesta JSON de metadatos observada, portales judiciales y documentos oficiales encontrados. **Ningún conector de producción implementado. Motor aún no clonado.**

La rama remota de Mussi sigue en `aff5e3897dac37560e0e0653bf9fbb0a09ccb64c`, anterior al handoff canónico del 12/09/2026. El corte local vigente es un bloqueo real de F2. Las pruebas HTTP del entorno de ejecución fallaron en DNS; la disponibilidad técnica de integración debe ensayarse desde una red funcional.

No se asignan fechas ni porcentajes de avance sin equipo, capacidad, fuentes habilitadas y definición del piloto. Las fases tienen entregables y criterios de salida; los estados muestran la evidencia actual, no progreso estimado.

## Orden de ejecución y paralelismo

Ruta del motor: **F0 → F1 → F2 → F3 → F4 → F6 → F9 → F10**.

Base del OS: **F0 → F5**, y después **F5 → F6 / F7 / F8**, con convergencia de F6, F7 y F8 en F9. F5 solo puede comenzar cuando sus decisiones de stack, destino y piloto estén resueltas. Ese paralelismo no adelanta la clonación de Mussi antes de la verificación de fuentes ni autoriza conectores no comprobados.

Una muestra documental habilitada puede servir para caracterizar el motor y construir RAG sin prometer un corpus completo. La cobertura final de cada fuente/sala/categoría se valida en F9. Una imposibilidad de fuente obliga a declarar el límite y pedir decisión: no a inventar contenido ni a eliminar del alcance una sala solicitada.

## Resumen de gates

| Fase | Hito | Estado inicial | Depende de |
|---|---|---|---|
| F0 | Base documental y decisiones de arranque | DOCUMENTADO · REVISIÓN PENDIENTE | — |
| F1 | Fuentes estatales: acceso, permisos y prueba de originales | INVESTIGACIÓN PARCIAL · INTEGRACIÓN PENDIENTE | F0 |
| F2 | Corte vigente de Mussi y extracción aislada | BLOQUEADO · CORTE LOCAL PENDIENTE | F0, F1 |
| F3 | Corpus, RAG y resolver bibliográfico | NO INICIADO | F1, F2 |
| F4 | Junta Jurídica adaptada y evidencia congelada | NO INICIADO | F2, F3 |
| F5 | Núcleo del OS: estudio, usuarios, clientes y asuntos | NO INICIADO | F0 |
| F6 | Trabajo jurídico E2E: expediente, Junta, escrito y revisión | NO INICIADO | F4, F5 |
| F7 | Workflow, agenda, comunicación y portal del cliente | NO INICIADO | F5 |
| F8 | Honorarios, gastos, cobros y dirección | NO INICIADO | F5 |
| F9 | Piloto integral y gate de preproducción | NO INICIADO | F6, F7, F8 |
| F10 | Release controlado, operación y expansión | NO INICIADO | F9 |

## Fases y criterios de cierre

### F0 — Base documental y decisiones de arranque

**Estado:** DOCUMENTADO · REVISIÓN PENDIENTE. **Dependencias:** Sin dependencia técnica previa.

**Objetivo.** Dejar el producto completo, la herencia de Mussi, el alcance de fuentes y las decisiones abiertas en una base única. No iniciar desarrollo por inferencia.

**Responsabilidad.** Producto + arquitectura + abogado referente; personas todavía por designar.

**Entregables.**

- Blueprint y roadmap v1.1 separados, legibles e interactivos.
- Registro de fuentes/APIs y evidencia con límites explícitos.
- Registro de decisiones, solicitudes institucionales no enviadas y handoff.

**Trabajo verificable.**

- [ ] **F0-T01** — Revisar la definición de OS completo y sus módulos, sin convertir el primer hito IA en producto final.
- [ ] **F0-T02** — Confirmar invariantes de Junta 3→2→1 y checker bibliográfico separado.
- [ ] **F0-T03** — Designar estudio piloto y responsables de decisiones técnicas/jurídicas.
- [ ] **F0-T04** — Definir repositorio destino, stack y ambientes antes de emitir un prompt de implementación.
- [ ] **F0-T05** — Fijar política de datos, presupuesto de pruebas y autorización de acciones externas.

**DONE del gate.**

- Artefactos versionados y aprobaciones/observaciones registradas.
- Ninguna decisión pendiente se presenta como requisito ya congelado.
- Solo se habilitan las acciones cuyas dependencias estén cerradas.

**Bloqueos actuales o condiciones pendientes.** DEC-01, DEC-03, DEC-04, DEC-07 y DEC-11 para iniciar código o usar datos reales.

**Paralelismo y límites.** La investigación de fuentes F1 ya puede continuar en lectura pública. No habilita envíos ni recolección masiva.

**Trazabilidad.** INV-01 a INV-12, OS-01 a OS-14.

### F1 — Fuentes estatales: acceso, permisos y prueba de originales

**Estado:** INVESTIGACIÓN PARCIAL · INTEGRACIÓN PENDIENTE. **Dependencias:** F0.

**Objetivo.** Conseguir una vía reproducible y habilitada para jurisprudencia de las tres salas y corpus normativo. Separar documentación, muestra web y smoke del adaptador.

**Responsabilidad.** Integraciones + curaduría documental + revisión jurídica de reutilización.

**Entregables.**

- Dossier por fuente con API/exportación/portal, permisos, cobertura y límites.
- Contrato observado y una muestra íntegra con original, metadatos y hash desde red de desarrollo.
- Manifiesto inicial por Constitucional/Civil/Penal y por categorías normativas.

**Trabajo verificable.**

- [ ] **F1-T01** — Recuperar y validar OpenAPI v2 del Congreso; confirmar base URL, credenciales, cuotas y semántica de paginación.
- [ ] **F1-T02** — Probar la cadena ley → idProyecto → adjunto y distinguir proyecto, sanción, promulgación y publicación; no confundir metadatos con texto.
- [ ] **F1-T03** — Solicitar al IIJ API/exportación con textos de Constitucional, Civil y Penal, IDs estables y mecanismos de actualización; usar borrador tras aprobación.
- [ ] **F1-T04** — Validar legislación CSJ y Gaceta como fuentes de originales/versiones, no solo formularios.
- [ ] **F1-T05** — Cerrar texto/edición de Constitución, Código Civil, Procesal Civil, Penal y Procesal Penal; registrar modificatorias conocidas y lagunas sin inventar consolidación.
- [ ] **F1-T06** — Resolver permisos sobre compilaciones; no ingerir por defecto la edición IIJ con aviso restrictivo.
- [ ] **F1-T07** — Ejecutar smoke de lectura finito desde entorno con DNS/red; guardar status, tipo, original, hash, fecha y aserciones.
- [ ] **F1-T08** — Registrar qué no se obtuvo por fuente y qué universo se pretende cubrir; definir muestra estratificada antes del barrido.

**DONE del gate.**

- Existe al menos una vía autorizada y reproducible por categoría que se vaya a habilitar; fuentes aún no resueltas permanecen bloqueadas.
- Las tres salas están contempladas en el manifiesto, con pendientes explícitos; ninguna se elimina del alcance por silencio.
- Cada muestra de texto corresponde a su identidad, no a un índice/login; paginación y correcciones tienen prueba o limitación registrada.
- Curaduría aprueba el corpus finito de prueba y su uso antes de integrarlo; cobertura productiva se valida después.

**Bloqueos actuales o condiciones pendientes.** DEC-05 y DEC-06; respuestas institucionales, originales civiles pendientes y entorno de red para smoke.

**Paralelismo y límites.** Puede avanzar revisión del corte local de Mussi en solo lectura y diseño del OS. La extracción de código queda en F2. La cobertura masiva no debe bloquear prototipos con muestras autorizadas, pero éstos no se anuncian como cobertura total.

**Trazabilidad.** INV-06 a INV-09, QA-01 a QA-10.

### F2 — Corte vigente de Mussi y extracción aislada

**Estado:** BLOQUEADO · CORTE LOCAL PENDIENTE. **Dependencias:** F0, F1.

**Objetivo.** Clonar el motor correcto, no el remoto histórico, preservando mecánica de deliberación y límites de dominio.

**Responsabilidad.** Dueño técnico de Mussi + ingeniería del nuevo OS.

**Entregables.**

- Manifest de origen: repo/rama/SHA/working-tree/archivos y decisiones.
- Informe de discrepancias local/remoto/handoff.
- Motor aislado en destino aprobado con tests de caracterización y sin datos clínicos.

**Trabajo verificable.**

- [ ] **F2-T01** — Obtener el corte local vigente y cambios no publicados sin reset, checkout destructivo ni push de trabajo ajeno.
- [ ] **F2-T02** — Contrastar con aff 5e3897dac37560e0e0653bf9fbb0a09ccb64c remoto y handoff del 12/09/2026; registrar qué es canónico y qué es legacy.
- [ ] **F2-T03** — Inventariar exactamente Junta, planner, evidencia, checker, persistencia y pruebas; resolver si alguna capa histórica todavía pertenece al corte aprobado.
- [ ] **F2-T04** — Crear destino separado solo después de DEC-03/DEC-04; no usar producción de Mussi para ensayos.
- [ ] **F2-T05** — Extraer orquestación y contratos; excluir pacientes, diagnósticos, secretos y configuraciones reales.
- [ ] **F2-T06** — Ejecutar caracterización con fixtures etiquetadas: tres iniciales independientes, dos revisiones y el mismo Orquestador final.
- [ ] **F2-T07** — Definir interfaz de adaptador de dominio y correspondencia de entradas/salidas jurídicas sin cambiar de forma oculta la topología.

**DONE del gate.**

- Origen exacto acreditado; cambios canónicos no publicados preservados.
- Se demuestra orden/independencia/continuidad con payloads y tests, no solo lectura de nombres de funciones.
- No se modificó producción ni se transfirieron secretos/datos médicos.
- Las diferencias necesarias para dominio jurídico están documentadas y aprobadas.

**Bloqueos actuales o condiciones pendientes.** DEC-02, DEC-03, DEC-04; no se inspeccionó el working tree local en esta sesión.

**Paralelismo y límites.** F5 de núcleo operativo puede desarrollarse una vez aprobado stack/repositorio. El componente médico no debe arrastrarse al modelo legal.

**Trazabilidad.** INV-03 a INV-05, INV-09, INV-12, QA-12 y QA-13.

### F3 — Corpus, RAG y resolver bibliográfico

**Estado:** NO INICIADO. **Dependencias:** F1, F2.

**Objetivo.** Implementar la recuperación jurídica y el control documental que sustituirán PubMed, con originales y cobertura visibles.

**Responsabilidad.** Ingeniería de datos + integraciones + curaduría + QA.

**Entregables.**

- Pipeline de ingesta, versionado y manifiestos por fuente/sala/año.
- Búsqueda híbrida con filtros, resolver exacto y Evidence Pack congelable.
- Checker de identidad y citas textuales con reporte por referencia.

**Trabajo verificable.**

- [ ] **F3-T01** — Implementar adaptadores solo para fuentes habilitadas; staging, checkpoints y límites por proveedor.
- [ ] **F3-T02** — Guardar original/version/procedencia y permisos; separar normativa, jurisprudencia, material editorial y documentos privados.
- [ ] **F3-T03** — Extraer texto digital primero; registrar OCR solo cuando sea necesario y su calidad.
- [ ] **F3-T04** — Construir identidad, alias, reglas de colisión y deduplicación con evidencia; conservar ambigüedad.
- [ ] **F3-T05** — Implementar búsqueda textual/semántica, fusión y reordenamiento; fijar parámetros con dataset de desarrollo.
- [ ] **F3-T06** — Implementar resolución exacta independiente de top-K semántico y estados de no encontrado/falla/ambigüedad.
- [ ] **F3-T07** — Validar referencias libres y estructuradas, citas literales y versiones del documento.
- [ ] **F3-T08** — Congelar dataset/holdout y umbrales antes de correr aceptación; no usar resultados jurídicos como proxy de autenticidad.

**DONE del gate.**

- QA-01 a QA-10 ejecutados con originales autorizados y casos de prueba controlados.
- Se reportan falsos aprobados, referencias omitidas por extractor y auténticas no resueltas, con denominadores.
- Objetivo propuesto: cero falsos aprobados en batería cerrada de fabricaciones; no promesa de infalibilidad.
- No hay fuga de corpus privado ni resumen IA convertido en fuente; cobertura reportada coincide con registros.

**Bloqueos actuales o condiciones pendientes.** DEC-05, DEC-06 y DEC-08 para aceptación; disponibilidad real de originales.

**Paralelismo y límites.** Puede coexistir con F5. Un conjunto pequeño habilitado sirve al desarrollo, pero no cierra la cobertura de lanzamiento.

**Trazabilidad.** INV-06 a INV-08, OS-06, OS-07, QA-01 a QA-11.

### F4 — Junta Jurídica adaptada y evidencia congelada

**Estado:** NO INICIADO. **Dependencias:** F2, F3.

**Objetivo.** Conectar el motor extraído a RAG y checker jurídicos sin degradar la confrontación.

**Responsabilidad.** Ingeniería IA + QA + abogado referente.

**Entregables.**

- Adaptador jurídico y contratos de entrada/salida versionados.
- Runs durables, costos y fallas; resultados CURRENT/OUTDATED con snapshots.
- Validación de seis llamadas y referencias de versión final.

**Trabajo verificable.**

- [ ] **F4-T01** — Mapear Legal Request/Snapshot/Evidence Pack al motor caracterizado; no reescribirlo por gusto.
- [ ] **F4-T02** — Mantener A/B/Orquestador inicial independientes y dos cross-reviews obligatorios.
- [ ] **F4-T03** — Asegurar misma identidad del Orquestador en ambas llamadas y transferencia explícita de su opinión inicial.
- [ ] **F4-T04** — Ensamblar citas desde IDs del registro y comprobar también referencias introducidas en texto libre.
- [ ] **F4-T05** — Implementar estados parciales/fallidos y reintentos limitados sin fast path oculto.
- [ ] **F4-T06** — Implementar explicación de Junta histórica sobre su snapshot y reevaluación explícita si entra nueva evidencia.
- [ ] **F4-T07** — Ejecutar pruebas con proveedores reales solo con modelos y presupuesto aprobados; registrar diferencia frente a fixtures.

**DONE del gate.**

- QA-12 a QA-15 y controles bibliográficos pasan con evidencia por run.
- Reporte distingue referencias comprobadas, citas literales y revisión jurídica humana.
- Cambios de contexto o modelos no quedan ocultos dentro del mismo resultado.
- Costo/latencia se miden; no se anuncian SLA ni mejoras no demostradas.

**Bloqueos actuales o condiciones pendientes.** DEC-07, DEC-08; extracción y corpus habilitado.

**Paralelismo y límites.** La interfaz del abogado se integra en F6. Explicar resultados no modifica decisiones ni exige rerun por defecto.

**Trazabilidad.** INV-03 a INV-10, OS-07, QA-12 a QA-15.

### F5 — Núcleo del OS: estudio, usuarios, clientes y asuntos

**Estado:** NO INICIADO. **Dependencias:** F0.

**Objetivo.** Construir la base operativa completa sobre la cual vive la Junta; no crear islas por abogado.

**Responsabilidad.** Ingeniería de producto + UX + QA.

**Entregables.**

- Estudios, usuarios, permisos, clientes, asuntos y procedimientos.
- Originales/versiones privadas con ACL, auditoría y exportación.
- Mi día por rol con tareas reales y navegación por asunto.

**Trabajo verificable.**

- [ ] **F5-T01** — Cerrar stack/repositorio y crear ambientes aislados con credenciales propias.
- [ ] **F5-T02** — Implementar tenancy y membresías por asunto desde backend y almacenamiento.
- [ ] **F5-T03** — Modelar asunto no judicial, asunto con múltiples procedimientos y múltiples partes sin cruzar datos.
- [ ] **F5-T04** — Implementar apertura desde consulta y encargo, revisión humana de conflictos y aceptación versionada.
- [ ] **F5-T05** — Crear documentos/versiones originales y un índice del asunto que no altere archivos.
- [ ] **F5-T06** — Construir paneles de abogado, coordinador, asistente y administración con listas accionables.
- [ ] **F5-T07** — Ensayar revocación, búsquedas, jobs y enlaces contra dos estudios y asuntos reservados.

**DONE del gate.**

- OS-01 a OS-06 funcionando con flujos de prueba, no solamente pantallas.
- QA-11 y QA-17 pasan; operar el estudio no requiere respuesta de una LLM.
- Cliente/abogado/administración no acceden por accidente al mismo contenido reservado.

**Bloqueos actuales o condiciones pendientes.** DEC-01, DEC-03, DEC-04 y DEC-11.

**Paralelismo y límites.** Rama paralela a F2–F4 una vez autorizadas sus decisiones; no habilita uso de corpus no aprobado. Esta fase no omite la Junta del producto final.

**Trazabilidad.** INV-01, INV-02, OS-01 a OS-06, QA-11, QA-17.

### F6 — Trabajo jurídico E2E: expediente, Junta, escrito y revisión

**Estado:** NO INICIADO. **Dependencias:** F4, F5.

**Objetivo.** Convertir análisis y documentos en un trabajo jurídico completo dentro del asunto.

**Responsabilidad.** Producto + ingeniería + abogado referente + QA.

**Entregables.**

- Editor, modelos del estudio, índice/anexos y exportación versionada.
- Junta integrada en asunto y revisión de documentos externos.
- Aprobación humana y controles de referencia asociados a versión exacta.

**Trabajo verificable.**

- [ ] **F6-T01** — Confirmar ficha de contexto/cronología y fuentes del asunto con datos faltantes visibles.
- [ ] **F6-T02** — Convocar Junta desde encargo y mostrar resultado con referencias, no seis chats como interfaz obligatoria.
- [ ] **F6-T03** — Crear escrito por plantilla/secciones; preservar párrafos aprobados y cambios comparables.
- [ ] **F6-T04** — Incorporar checker de documentos externos y referencias pegadas dentro del texto.
- [ ] **F6-T05** — Implementar review/changes requested/approved con permisos y control de concurrencia.
- [ ] **F6-T06** — Exportar Word/PDF y paquete de expediente manteniendo versión, índices y reportes de comprobación.
- [ ] **F6-T07** — Separar entrega/presentación del acto de descargar; registrar comprobante verificable.

**DONE del gate.**

- OS-07 y OS-08 completos; crear, revisar, modificar, comprobar y exportar la misma versión de manera verificable.
- QA-06, QA-14 y QA-15 pasan sin arrastre indebido de aprobaciones.
- Un escrito con jurisprudencia pendiente no recibe una etiqueta falsa de referencias comprobadas.

**Bloqueos actuales o condiciones pendientes.** Plantillas y flujos piloto aprobados; F4/F5.

**Paralelismo y límites.** F7 y F8 pueden desarrollarse en paralelo tras F5; se unifican en F9.

**Trazabilidad.** OS-06 a OS-08, QA-06, QA-14, QA-15.

### F7 — Workflow, agenda, comunicación y portal del cliente

**Estado:** NO INICIADO. **Dependencias:** F5.

**Objetivo.** Coordinar responsables y seguimiento del estudio, sin confundir sugerencias IA con actos reales.

**Responsabilidad.** Ingeniería de producto + integraciones + abogado referente.

**Entregables.**

- Tareas, dependencias, escalamiento y sustituciones.
- Agenda con fechas confirmadas/sugeridas y origen.
- Solicitudes/documentos compartidos y comunicaciones autorizadas.

**Trabajo verificable.**

- [ ] **F7-T01** — Implementar tareas y dependencias sin ciclos, responsables y bloqueos con causa.
- [ ] **F7-T02** — Definir recordatorios/escalamiento y evitar duplicados por retries.
- [ ] **F7-T03** — Separar fecha extraída, fecha interna y plazo confirmado; calculador automático bloqueado sin reglas validadas.
- [ ] **F7-T04** — Integrar calendarios/correo solo con permisos y ámbito por asunto.
- [ ] **F7-T05** — Implementar portal de cliente sobre versiones compartidas explícitas.
- [ ] **F7-T06** — Registrar envíos, recepción y actuaciones con evidencia; no marcar enviado/presentado al generar borrador.
- [ ] **F7-T07** — Configurar seguimiento judicial únicamente con conector probado; origen manual claramente identificado.

**DONE del gate.**

- OS-09 a OS-11 cerrados en pruebas E2E con cliente y personal del estudio.
- QA-11 y QA-16 pasan; revocar un acceso impide recuperar material privado.
- Sin cálculo de plazo por LLM presentado como confirmado ni asesoramiento enviado sin política aprobada.

**Bloqueos actuales o condiciones pendientes.** DEC-01, DEC-10, DEC-11; reglas de plazos e integraciones cuando se habiliten.

**Paralelismo y límites.** No necesita esperar todo el RAG para construirse, pero los envíos de trabajo jurídico se integran con las aprobaciones de F6.

**Trazabilidad.** OS-09 a OS-11, QA-11, QA-16.

### F8 — Honorarios, gastos, cobros y dirección

**Estado:** NO INICIADO. **Dependencias:** F5.

**Objetivo.** Manejar la economía del asunto y del estudio con estados reconciliables.

**Responsabilidad.** Ingeniería + administración del piloto + revisión fiscal cuando corresponda.

**Entregables.**

- Acuerdos, tiempo opcional, gastos, anticipos, facturación y cobros.
- Libro de movimientos/aplicaciones y reversos.
- Reportes de trabajo pendiente, saldos y métricas de gestión.

**Trabajo verificable.**

- [ ] **F8-T01** — Definir modalidades y monedas del piloto sin asumir facturación por hora universal.
- [ ] **F8-T02** — Versionar acuerdos aceptados y registrar gastos/tiempo con estado facturable/no facturable.
- [ ] **F8-T03** — Implementar aplicaciones atómicas de pagos/anticipos y reversos autorizados.
- [ ] **F8-T04** — Separar recursos de clientes, gastos recuperables e ingresos propios conforme política revisada.
- [ ] **F8-T05** — Diferenciar documento económico interno de emisión fiscal oficial; conectar fiscalidad solo tras contrato y pruebas.
- [ ] **F8-T06** — Construir indicadores con drill-down y cobertura de costos; no inventar rentabilidad.
- [ ] **F8-T07** — Reconciliar cierres, exportaciones y moneda sin mezclar sumas incompatibles.

**DONE del gate.**

- OS-12 a OS-14 cumplen acuerdos→facturado→cobrado→saldo con evidencia.
- QA-16 pasa con doble webhook/clic; no duplicación ni sobreaplicación.
- Reportes por período y permisos reconcilian contra movimientos.

**Bloqueos actuales o condiciones pendientes.** DEC-09; monedas, reglas y proveedor fiscal por definir.

**Paralelismo y límites.** Puede coexistir con F6/F7. Sin emisión fiscal habilitada solo se permite modo interno claramente identificado, no factura válida simulada.

**Trazabilidad.** OS-12 a OS-14, QA-16.

### F9 — Piloto integral y gate de preproducción

**Estado:** NO INICIADO. **Dependencias:** F6, F7, F8.

**Objetivo.** Demostrar que un estudio puede operar el ciclo completo con personas, datos de prueba y fuentes habilitadas.

**Responsabilidad.** QA + equipo piloto + arquitectura + curaduría.

**Entregables.**

- Expediente de evidencia E2E por requisito y SHA.
- Holdout bibliográfico, reporte de cobertura y prueba de restauración.
- Informe PASS/FAIL/BLOCKED y aceptación del piloto.

**Trabajo verificable.**

- [ ] **F9-T01** — Preparar escenarios consentidos o sintéticos claramente marcados: ingreso→asunto→Junta→escrito→revisión→entrega→seguimiento→cobro.
- [ ] **F9-T02** — Ejecutar todos los roles y casos negativos, incluyendo asuntos reservados y usuarios removidos.
- [ ] **F9-T03** — Ejecutar holdout congelado sin contaminarlo con ajustes; reportar todos los casos y bloqueos.
- [ ] **F9-T04** — Confirmar cobertura por sala y normas prometidas, exclusiones, fecha de actualización y condiciones de reutilización.
- [ ] **F9-T05** — Probar fuente caída, modelo caído, versión modificada, duplicados y restauración de backups.
- [ ] **F9-T06** — Validar comportamiento del editor y exportaciones en escritorio y uso móvil operativo.
- [ ] **F9-T07** — Cerrar hallazgos bloqueantes con evidencia de retest; no aprobar por SUCCESS del deploy o por un conteo global de tests.

**DONE del gate.**

- Ciclo completo manual del estudio y suite automatizada aprobados en el SHA de release.
- Ninguna afirmación comercial supera cobertura y validación reales.
- QA-01 a QA-18 cerrados o excluidos explícitamente del release con autorización; un bloqueo crítico impide salida.
- El abogado valida usabilidad y operación; la autenticidad se evalúa por separado del mérito jurídico.

**Bloqueos actuales o condiciones pendientes.** DEC-08 y todos los gates de funciones incluidas; datos autorizados del piloto.

**Paralelismo y límites.** Preparación de soporte/documentación puede ser paralela. No se vende el prototipo de Junta como el OS final.

**Trazabilidad.** INV-01 a INV-12, OS-01 a OS-14, QA-01 a QA-18.

### F10 — Release controlado, operación y expansión

**Estado:** NO INICIADO. **Dependencias:** F9.

**Objetivo.** Publicar un OS respaldado por evidencia y mantener fuentes, acceso y datos bajo control.

**Responsabilidad.** Producto + operaciones + soporte + curaduría.

**Entregables.**

- Release firmado por responsables, runbook, rollback y soporte.
- Panel de frescura/cobertura de fuentes y salud de integraciones.
- Backlog de expansión aprobado, separado de fixes.

**Trabajo verificable.**

- [ ] **F10-T01** — Aprobar región/proveedores, contratos, términos y políticas antes de datos reales.
- [ ] **F10-T02** — Ejecutar despliegue con ambientes, backups y rollback probados; no migración destructiva no ensayada.
- [ ] **F10-T03** — Activar alertas sobre actualización de fuentes, colas, costo IA y fallas operativas.
- [ ] **F10-T04** — Habilitar exportación/salida de clientes y procedimientos de acceso/retención.
- [ ] **F10-T05** — Registrar cambios de prompts, modelos, fuentes y reglas como versiones con regresión.
- [ ] **F10-T06** — Revisar expansión a apelaciones, nuevas especialidades o integraciones solo con evidencia de cobertura.

**DONE del gate.**

- Se puede operar y recuperar el servicio según objetivos acordados; no se fijan SLA ficticios.
- Nuevas versiones no cambian silenciosamente el mecanismo de Junta ni los permisos.
- La mejora se mide sobre uso/operación y autenticidad, no sobre promesas de un abogado automático.

**Bloqueos actuales o condiciones pendientes.** Autorización de release, cierre F9 y contratos de producción.

**Paralelismo y límites.** Las mejoras no abren scope adicional por defecto. Cada nueva fuente tiene el mismo gate de habilitación.

**Trazabilidad.** OS-01 a OS-14, QA-18.

## Evidencia necesaria para marcar una fase como cerrada

La ficha de cierre registra SHA o versión, ambiente, responsable, casos ejecutados, resultados PASS/FAIL/BLOCKED, evidencia y riesgos/exclusiones autorizados. Terminar un comando, obtener un deploy READY o marcar una casilla no acredita por sí solo un gate.

El roadmap interactivo permite notas y marcas de seguimiento **locales y manuales**. No cambia este estado auditado, no certifica pruebas y no escribe en GitHub ni en el producto. Exportar ese seguimiento permite compartirlo; su importación no convierte una auto-declaración en evidencia independiente.

## Primera unidad de trabajo ejecutable

Continuar F1: documentación v2 y muestra ley→adjunto desde un entorno con red; revisión/envío autorizado de solicitudes CSJ y Gaceta; identificación de originales de los códigos pendientes. En paralelo, obtener un manifest del corte local vigente de Mussi para cerrar DEC-02, sin modificar el producto médico.

Antes de crear código nuevo deben cerrarse destino/stack/ambientes. No se entrega un prompt de coder que invente esas decisiones. El handoff del paquete permite recuperar exactamente objetivo, invariantes, fase, estado real, restricciones, DONE y fuera de alcance.


---

## ADDENDUM DE EJECUCIÓN v1.1 — no modifica la arquitectura

F1 continúa abierto. Se ampliaron fuentes de 11 a 15 fichas y se creó un manifiesto de 8 muestras/candidatos. Las tres salas están representadas mediante PDFs vistos por herramienta web, no mediante una integración operativa. Cero fases cerradas. F2 permanece bloqueado por el snapshot local vigente.

- F1-T01: **PARCIAL** — URL OpenAPI exacta localizada; cuerpo no recuperado. V1 offset=página documentado; no extrapolar.
- F1-T02: **PARCIAL** — Proyecto 101629→adjunto LEY observado. Original no descargado; ley 134254/proyecto 2431 es otra muestra.
- F1-T03: **PENDIENTE_ENVIO** — Solicitud no enviada. Muestras de tres salas encontradas en Digesto, sin cerrar acceso CSJ.
- F1-T04: **PARCIAL** — Gaceta índice→detalle→enlace; PDF pendiente. CPP escaneado proviene de Gaceta histórica.
- F1-T05: **PARCIAL** — Constitución/CP/CPP PDFs abiertos; Civil candidato 304 p abierto; CPC específico aún no abierto. Ediciones/modificatorias pendientes.
- F1-T06: **PENDIENTE** — Licencia Congreso revisada; no extendida a Digesto o compilaciones. Sin contactos enviados.
- F1-T07: **BLOQUEADO_ENTORNO** — 4 GET reales (3 preliminares y 1 del kit) fallan DNS. Kit diagnóstico con pruebas locales entregado; no smoke remoto exitoso.
- F1-T08: **PARCIAL** — Manifiesto de 8 muestras/candidatos finitos, no representativo; cobertura histórica pendiente.
