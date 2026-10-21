# ADR SPECIALIST-STUDIO-002 — Director jurídico, capacidades y Equipo jurídico

Actualización: 15/10/2026, America/Asuncion. Diseño reconciliado aprobado por el propietario; alcance ampliado expresamente al Director, Dashboard y Equipo jurídico local sintético/offline.

Fecha de propuesta: 14/10/2026. Estado: **ACCEPTED — DISEÑO RECONCILIADO; IMPLEMENTACIÓN LOCAL OFFLINE**.
Este identificador pertenece al espacio SPECIALIST-STUDIO; no reemplaza `ADR-LO-002` de reconciliación ni OS-001. Aprobador: propietario, 15/10/2026.

Autorización expresa: «Apruebo el ADR reconciliado. Metele con el piloto contractual de Elena en local, con datos sintéticos y pruebas offline, sin llamadas pagas ni despliegues.» La pausa posterior detuvo el trabajo; «ah, bueno segui con la implementacion» autorizó retomarlo con los mismos límites.

Ampliación posterior expresa: tras reclamar Dashboard y Director, el propietario aportó el plan de especialización y debate completo e indicó «esto fue el plan de trabajo […] implementa esto». Se implementa el [recorrido local conectado](EQUIPO_JURIDICO_LOCAL_2026-10-15.md): Dashboard, Gabriel por reglas locales, equipo dinámico, herramientas documentales experimentales por seis áreas, objeciones/réplicas, integración del titular y control terminal. No autoriza inferencia externa, migraciones productivas, despliegues ni gasto. La evaluación jurídica habilitante continúa NOT_RUN; ningún paquete se presenta como competencia acreditada.

## Reconciliación vigente del 14/10/2026

Esta revisión incorpora el [handoff completo de continuación](HANDOFF_NEXT_CHAT_2026-10-14.md), que prevalece sobre propuestas previas de composición y coordinación. La indicación «metele» de esta continuación permite avanzar las fichas y reconciliación documental anunciadas; no se interpreta como aceptación del ADR ni autorización de inferencia, nueva orquestación o deploy.

Estado observado antes de las implementaciones locales: catálogo descriptivo de seis personajes/22 subáreas, PNG y exploración de detalles. Su presencia permanente en Mi día/Trabajo jurídico y el asunto fue rechazada. La [revalidación del 14/10](reports/design-reconciliation-2026-10-14.json) es histórica; el [informe del 15/10](EQUIPO_JURIDICO_LOCAL_2026-10-15.md) documenta el runtime nuevo y sus límites.

Entregables evaluables: [22 paquetes por subperfil](SPECIALIST_CAPABILITY_PACKS.md), [contrato estructurado](contracts/SPECIALIST_CAPABILITY_PACKS.v1.json) y [protocolo contractual](CONTRACTUAL_PILOT_EVALUATION.md). Son especificaciones DRAFT/PILOT_DESIGN_ONLY, sin herramientas nuevas conectadas ni habilitación jurídica.

## Decisión solicitada

Agregar un Estudio de Especialistas IA sobre Core, Biblioteca y primitivas de Junta existentes, empezando por Civil/Contractual en un asunto sintético. Mantener la ruta de Junta V2 actual identificable y reversible. Aprobar este documento autorizaría el diseño reconciliado; no autoriza por sí mismo inferencias, migraciones productivas o despliegues.

Base real y discrepancias: [auditoría](CURRENT_RUNTIME_MAP_2026-10-14.md). Este ADR todavía no declara cerrado G0 empresarial ni habilitados los contratos siguientes en runtime.

## Qué cambia y qué se reutiliza

| Tema | Código vigente | Ampliación propuesta |
|---|---|---|
| Dirección | Cuestión humana; sin Head Chief | Gabriel, Director jurídico IA conversacional acotado, delimita ingreso y propone plan; ninguna conclusión jurídica. Coordinación generativa requiere consentimiento/techo propio |
| Titular | `Matter.responsible_identity_id` solo humano | Extensión de asignación IA versionada ligada al mismo Matter; humano conserva su identidad |
| Luna | Context Builder con PacketSchema, instrucciones «No redactes dictamen» | Conservar ese rol; agregar adaptador de opinión jurídica Luna por perfil, sin reutilizar engañosamente PacketSchema |
| Sol | PrincipalInput → AnalysisSchema obligatorio | Mismo perfil con mayor potencia únicamente por override humano de un encargo |
| Gemini | AuditInput → AuditSchema siempre, sin réplica | Debate opcional: objeciones, respuestas y cierre; auditor nunca certifica fuentes |
| Checker | `checkAnalysis(analysis, citationScope)` después de auditor | Gate terminal por manifiesto de TODAS las salidas + documento final/render/anexos; sin generar texto IA después |
| Biblioteca | SQLite FTS5, hasta seis fuentes/dos fragmentos por fuente en payload actual | Reutilizar índice, originales y versiones; políticas por perfil y cobertura evaluada, sin catálogo privado duplicado |
| Revisión | DraftReview/DocumentVersion y revisor distinto del autor | Enlace entre resultado, auditoría y versión documental; mismo flujo de aprobación humana |
| UI | Catálogo en Mi día/Trabajo jurídico/asunto, composición rechazada; MatterJunta conserva motor fijo | Dashboard separado de Mi día; ingreso con Director; Equipo jurídico contextual; selector explícito de especialistas; conservar personajes aceptados y densidad. Nunca nombres técnicos en producto |

## Flujo propuesto

```text
Dashboard -> ingreso por texto -> [conversación Gabriel autorizada, techo propio]
  -> IntakeDraft sin expediente paralelo -> humano elige/crea asunto mediante Core
  -> encargo delimitado + responsable humano + snapshot
  -> ChiefDispatchPlan -> confirmación de titular/equipo
  -> autorización separada del análisis, evidencia y presupuesto
  -> RAG + Jev (sin bypass nuevo)
  -> contexto Luna validado -> titular Luna (+ consultores Luna cuando aprobados)
     [override humano Sol por perfil/encargo antes de su llamada]
  -> [Gemini objeta -> especialistas responden; rondas acotadas]
  -> integración del titular si hay varias opiniones/debate
  -> congelación de todas las salidas y artefacto final
  -> extractor/checker determinístico terminal
  -> revisión humana -> borrador/versiones -> aprobación exacta
```

La potenciación es una política de ejecución, no una etapa obligatoria posterior a Luna. Si se pide luego de una respuesta, crea una nueva edición/ejecución autorizada y no borra ni factura de nuevo pasos ya reutilizables. El checker valida esa edición nueva.

## Reglas fijadas por el pedido vigente

- Chief dirige; Jev prioriza evidencia. Ninguno suplanta al responsable humano.
- Cada perfil usa Luna por defecto, evidencia original localizable, jurisdicción y herramientas acotadas. No se habilitan especialidades por nombre sin evaluación.
- Sol manual, Gemini opcional autorizado, presupuesto agregado por encargo y límites por participante.
- Checker final incluye titular, consultores, Gemini, contexto/Chief/Jev si aportaron texto visible, integración, pregunta reproducida y anexos expuestos. No depender solo de `citations[]`.
- La verificación comprueba identidad/procedencia y literalidad. Aplicabilidad, suficiencia y mérito se revisan humanamente.
- Estado de ejecución, verificación de fuentes, vigencia de evidencia y aprobación humana son ejes distintos.
- Local sin auth sigue reservado a datos sintéticos. Multiestudio empresarial exige controles del lado servidor, incluidas búsquedas, cachés, jobs, exports y revocación.

## Decisiones concretas propuestas para aprobar juntas

| ID | Propuesta | Motivo / alternativa |
|---|---|---|
| P01 | Chief propone; humano con MANAGE confirma primera asignación y reasignaciones, mediante CAS | Evita reasignación por mensaje. Alternativa: automática al crear asunto, no recomendada para piloto |
| P02-R1 | Director conversacional generativo acotado a delimitación/convocatoria, con consentimiento, límite de turnos y techo; modo asistido por reglas identificado como tal | Reemplaza P02 solo-reglas como destino de producto. El piloto dentro del asunto puede usar reglas explícitas, sin fingir conversación generativa |
| P03-R1 | Preparar piloto contractual; ahora PILOT_DESIGN_ONLY. Pasar a EXPERIMENTAL solo tras aprobación de implementación del slice y paquete revisado; otros 21 DRAFT | Catálogo/personajes no habilitan competencias. Promoción ENABLED necesita evaluación específica y release humano; el piloto conserva fuentes pendientes |
| P04 | Conservar Jev activo. Reusar Context Builder Luna y añadir una llamada de opinión Luna | Preserva validación factual. Son dos tareas, visibles por función en costo sin mostrar el modelo; su fusión/bypass es decisión futura |
| P05 | Titular integra, preserva disensos y fuentes de autores, también después del debate | Chief no redacta mérito. Alternativa: humano integra manualmente |
| P06 | Debate piloto: una ronda de objeciones Gemini, una respuesta por participante cuestionado, una integración titular | Una segunda ronda requiere nueva aprobación y reserva. Número propuesto, todavía no aprobado |
| P07 | Solo responsable humano habilitado autoriza gasto, Gemini y Sol; delegación futura explícita | MANAGE/LAWYER por sí solos no se convierten en autorización de gasto. Modo local no prueba identidad |
| P08 | Override Sol limitado a un perfil y una consulta/encargo; sin efecto futuro | Un consultor no se potencia por herencia del titular; no hay upgrade global |
| P09 | Presupuesto total obligatorio sin valor implícito; datos/plan/modelos/precios/snapshot ligados al consentimiento | USD 0,60 es antecedente de Junta fija, no tarifa universal nueva. Sin precios validados bloquear live |
| P10 | Nueva política/versionado de ejecución, sin reetiquetar runs históricos | Mantener stores/IDs y lectura legacy; no introducir otro OS o registro bibliográfico |
| P11 | IntakeDraft previo al asunto; humano elige/crea mediante Core y confirma enlace | No crear un expediente paralelo ni conceder acceso por mencionar un asunto |
| P12 | Equipo confirmado y análisis autorizado son actos separados; autorización conversacional tampoco autoriza especialistas | Abrir, dictar, seleccionar o confirmar equipo no dispara inferencia |
| P13 | Tres modalidades: consulta focal, equipo especializado y Junta completa de seis áreas habilitadas con cuestión propia | Amplitud, profundidad y adversario son ejes independientes; no llamar seis para cada asunto |
| P14 | Revisión adversarial disponible transversalmente; Santiago opcional, visible, fuera del conteo de seis | Puede participar en consulta focal importante o Junta completa; no se oculta tras el checker |
| P15 | Paquetes por subperfil con evaluación pareada, curaduría y promoción humana explícitas | Un prompt/avatar y acuerdo de seis no prueban mejora. 22 fichas no equivalen a 22 especialistas operativos |
| P16 | Dashboard/Mi día/Equipo jurídico separados; voz aplazada hasta contrato de navegador/datos/costo | KPI accionables sobre lectura autorizada; sin agregado de estudio disponible mostrar alcance personal o no disponible |

Directiva visual posterior confirmada y corregida por el propietario: interfaz sobria y moderna, especialistas representados mediante personajes humanos 3D flotantes y NUNCA nombres de modelos/proveedores en la interfaz, conservando compacidad. La [especificación UI](SPECIALISTS_COMPACT_UI_SPEC.md) reemplaza badges cuadrados y objetos abstractos. Vocabulario público de profundidad/revisión/roles; identificadores de ejecución solo en configuración y auditoría técnica interna. El mismo personaje conserva su identidad al cambiar profundidad. La familia visual de personajes ya está aceptada; la composición implementada fue rechazada y debe replantearse según el handoff. Esto no habilita cambios de orquestación ni altera límites del Chief/checker.

Precisión visual más reciente: personajes humanos 3D medio caricaturescos tipo emoji, con geometría expresiva y materiales/iluminación hiperrealistas. Reemplaza también los retratos humanos fotográficos de la segunda serie. No cambia contratos de ejecución ni autoriza implementación en runtime.

Decisiones de producto aceptadas posteriormente: C01, seis áreas base —Civil y patrimonial; Comercial y empresarial; Laboral; Tributario y aduanero; Penal; Derecho público— con subperfiles internos y coordinación/revisión adversarial como funciones separadas. V01, referencia visual seleccionada de personajes 3D tipo emoji en la primera imagen v3, adjuntada por el propietario al indicar que ese estilo estaba bien. La instrucción «esta bien... hacelo» autoriza incorporar esta agrupación al diseño y actualizar personajes/perfiles. Detalle y catálogo estructurado en [perfiles](SPECIALIST_PROFILES_AND_RAG.md).

P01, P02-R1, P03-R1 y P04–P16 se aceptan como diseño reconciliado. La autorización de implementación de este turno abarca únicamente el piloto contractual offline descrito arriba; C01/V01 y esta aceptación no autorizan inferencia paga ni despliegue. Director generativo, integración multiespecialista, rondas, fuentes oficiales y potencia siguen sin implementación/habilitación.

## Contratos y persistencia

Detalle: [Chief/asignación/gasto](HEAD_CHIEF_DISPATCH_CONTRACT.md), [perfiles/RAG](SPECIALIST_PROFILES_AND_RAG.md), [debate/checker](ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md).

Reusar `Matter`, `DocumentVersion`, `DraftReview`, `Activity`, `EvidencePack`, `LegalCasePacket`, `StageRecord`, `BoardStore`, `OfficialEvidenceRegistry` y los adaptadores HTTP de modelos. Los ocho contratos conceptuales requieren schemas versionados nuevos/adaptados; hoy no existen como endpoints ni tablas aprobadas.

No inyectar campos en schemas strict de Matter ni modelar perfiles IA como Membership. La asignación es una extensión relacionada, no otro asunto; `human_owner_id` es una foto del responsable de Matter al ejecutar. Un cambio del responsable invalida planes/consentimientos pendientes y exige nueva confirmación.

En Junta se conservarán eventos/stage-artifacts inmutables y estados existentes; el formato de lectura debe distinguir explícitamente policy/versión legacy frente a especialistas. Añadir contenedor de participantes/ediciones con adaptador retrocompatible requiere revisar también persistencia, UI, backup y migración de schema del prototipo. No se fija DDL ni URL nueva en este ADR.

## Gate de fuentes y versiones

`FinalCitationAudit` se liga al hash del contenido final y al manifiesto completo de salidas, snapshots, extractor, checker y política de confianza. Renderizar HTML/Markdown compone texto del auditor y fuentes; por eso también se controla el contenido visible/exportado exacto. Si una transformación altera texto, marcadores, citas o límites, su artefacto necesita nueva auditoría.

`COVERED_IN_GRAMMAR` no prueba detección universal del lenguaje natural. Mostrar conteos y cobertura delimitada por gramática/campos. Marcadores ambiguos, salidas faltantes, fuentes no autenticadas o cambios de versión impiden una etiqueta global de referencias comprobadas. Cero citas detectadas no significa «todo verificado».

El esquema actual requiere identidad suficiente con órgano/ID o tipo/número/fecha. La adaptación de normativa debe representar instrumento/artículo/edición y procedencia reales, sin inventar tribunal para una ley. Mientras no alcance el contrato real, queda pendiente; nunca un bypass del registry.

## Ampliación propuesta de Blueprint/Roadmap sin reemplazar V2.0

| Fuente | Addendum propuesto |
|---|---|
| Blueprint INV-04/05/07/08; §§10–12 | Distinguir ruta Junta fija de especialistas Luna, Sol manual, Gemini debate optativo y checker terminal ampliado |
| Blueprint §§04/06/17 | Asignación IA y capacidades separadas de identidad; salidas/consentimientos/auditorías versionadas |
| Blueprint §§03/07 | Ampliar navegación con Dashboard separado; conservar shell/tokens/componentes y Mi día personal; Equipo jurídico contextual con selector compacto |
| Blueprint §§01/19/20 | Referenciar OS-001 aceptado + addendum local y estado vivo, preservando cortes históricos |
| Roadmap F5/F6 | Mantener procedencia/holdout/proveedores como gates; no reiniciar Junta ni declarar cobertura por contadores |
| Roadmap F7 | Desglosar en G2–G5: especialista único, multidisciplina, debate y override; checklist exportado exacto |
| Roadmap F2/F3/F4/F8 | Conservar desarrollo del OS y límites local/empresarial; especialistas no absorben agenda/administración |

Esta tabla constituye el addendum propuesto: MD/HTML V2 originales permanecen intactos hasta aprobación. No se usan sus checkboxes de navegador como prueba de avance.

## Modalidades y criterios de escalamiento

| Modalidad pública | Equipo y propósito | Condición |
|---|---|---|
| Consulta focal | Titular habilitado para el subperfil; encargo delimitado | No activa invitados por defecto |
| Equipo especializado | Titular + áreas con pregunta/justificación propias | Compartir snapshot no significa copiar conclusiones |
| Junta completa | Seis áreas, cada una con subperfil habilitado y cuestión pertinente | Si falta ámbito, encargo o habilitación, informar carencia y proponer equipo viable; no fingir Junta completa |

Profundidad Estándar/Análisis profundo es manual por participante/encargo. Revisión adversarial puede acompañar cualquiera de las tres modalidades con autorización y presupuesto. Gabriel coordina; Santiago objeta; titular integra; el checker terminal verifica referencias de todos; el humano decide. Ni seis áreas ni otro proveedor garantizan independencia o corrección.

## Matriz de contradicciones resueltas en esta propuesta

| ID | Propuesta anterior | Reconciliación vigente, pendiente de aceptación |
|---|---|---|
| R01 | Plan exige asunto desde inicio; Chief no lo crea | IntakeDraft sin asunto; elección/creación por humano mediante Core; solo después plan/assignment ligados a Matter |
| R02 | Chief solo por reglas como diseño final | Director generativo acotado; coordinación con consentimiento/techo; modo reglas rotulado cuando se use |
| R03 | Confirmar plan puede leerse como ejecutar | Separar confirmación de equipo, autorización de coordinación, autorización de análisis y aprobación jurídica |
| R04 | Catálogo permanente y Mi día como dashboard | Dashboard propio; Mi día personal; participantes del asunto y selector bajo Agregar especialista |
| R05 | Catálogo de seis sin recorrido de Junta completa | Tres modalidades explícitas, preguntas por área, adversario transversal y criterios de indisponibilidad |
| R06 | Perfiles por rol con prompt general | 22 paquetes evaluables y pilotaje contractual; sin promoción automática por tener ficha |
| R07 | Checker posterior a auditor solo sobre análisis | Manifiesto completo + integración/render/export congelados; revalidación misma política también en caché |
| R08 | Techo histórico de Junta fija reutilizable | Reserva central del encargo, conversación contabilizada si existe; nuevos planes/consentimientos por cambios |
| R09 | Voz implícita en Director | Texto completo inicial; voz pendiente de contrato Firefox/procesamiento/retención/costo y autorización aplicable |

## Alternativas descartadas

Reconstruir OS/Junta; seis microservicios; Junta completa por consulta; Head Chief como abogado integrador; usar Jev para asignar equipo; cambiar a Sol/Gemini por defecto; checker anterior al debate; confiar en las bibliografías declaradas; firma local como autenticación estatal; exportar contenido nuevo bajo un chequeo viejo.

## Consecuencias, reversión y aceptación

Beneficios esperados: menor gasto habitual, responsabilidad de perfil visible, aportes disciplinarios y revisión adversarial enfocada. Son hipótesis a medir contra la ruta actual; roles con el mismo modelo no garantizan independencia ni mejor criterio. Prompts/RAG/evidencia distintos y revisión humana son necesarios.

Riesgos: fan-out y réplicas aumentan costo/latencia; el router puede omitir disciplina; el corpus puede carecer de texto pertinente; la extracción puede omitir citas. Mitigaciones contractuales: equipo mínimo, edición humana, límites globales, cobertura manifiesta y estados parciales honestos.

Reversión: selección explícita de modo/versionado, capacidad especialistas inicialmente deshabilitada, historial legacy legible, ninguna reasignación ni rerun automático. Deshabilitar capacidad nueva impide nuevos trabajos y conserva los existentes; no retira Junta V2. No esconder limitaciones antiguas bajo la etiqueta del checker nuevo.

DONE del diseño: ocho entregables, matriz de discrepancias, evidencia reproducible, contratos y plan revisables. Diseño aprobado; piloto offline autorizado. El estado de implementación y sus límites se documenta en [piloto local de Elena](ELENA_LOCAL_PILOT_2026-10-15.md). G2 generativo/evaluación jurídica y G3–G6 permanecen fuera de la entrega offline; despliegue e inferencia externa no autorizados.
