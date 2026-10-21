# Seis áreas de especialistas y evidencia por subperfil

Actualización documental: 15/10/2026, America/Asuncion. Referencia de decisiones/handoff: 14/10/2026; propuestas aún sin aprobación funcional.

Estado: CATÁLOGO DE SEIS ÁREAS ACEPTADO POR EL PROPIETARIO, 14/10/2026. Aceptación expresa de la propuesta inmediatamente anterior: «esta bien... hacelo». Contratos de ejecución y activación pendientes del [ADR P03-R1/P04/P15](ADR_SPECIALIST_STUDIO_002.md). Ningún perfil queda habilitado o certificado en el OS por esta decisión de catálogo.

## Reconciliación de capacidades

Actualización de implementación: el propietario aprobó el ADR y el [piloto contractual local offline](ELENA_LOCAL_PILOT_2026-10-15.md). Solo existe ejercicio determinístico EXPERIMENTAL_OFFLINE de Elena; no habilita un perfil generativo ni cambia a ENABLED las fichas de capacidades o sus fuentes.

[22 fichas por subperfil](SPECIALIST_CAPABILITY_PACKS.md) y [catálogo de paquetes v1](contracts/SPECIALIST_CAPABILITY_PACKS.v1.json) concretan fuentes a curar, entradas, procedimientos, herramientas propuestas, entregables, abstención, escalamiento y controles positivos/negativos. Conservan IDs/agrupación de SIX_AREA_SPECIALIST_CATALOG.v1.json; ningún paquete habilitado. [Piloto contractual y evaluación](CONTRACTUAL_PILOT_EVALUATION.md).

Distinguir catálogo de presentación, paquete de capacidad, disponibilidad de herramientas y release evaluado. Una ficha no instala una skill de Codex ni concede acceso del host. Gabriel/Santiago siguen fuera de las seis áreas. Su existencia como nombres de diseño no acredita Director o adversario funcionales.

## Lo que existe

Luna actual es Context Builder (`PacketSchema`) y explícitamente no redacta dictamen. Sol es el análisis principal (`AnalysisSchema`). El adaptador genérico `OpenAIProvider<I,O>` puede reutilizarse para una opinión Luna con otro schema/prompt, pero `createLiveProviders` hoy exige la Junta fija; cambiar el nombre de Luna en UI no crea un especialista.

La Biblioteca usa `CorpusStore` SQLite/FTS5, originales/derivados versionados y `researchCase` con ranking textual/BM25. `LocalEvidenceIndex` atiende documentos del asunto con filtros, snapshots y un puerto semántico; no se acreditó un adaptador embeddings activo. RAG híbrido completo sigue siendo diseño de destino.

El payload `LibraryResearchSchema` permite hasta seis fuentes y dos fragmentos por fuente, texto de hasta 1.300 caracteres por fragmento, con estado REQUIRES_LEGAL_REVIEW. Jev recibe candidatos documentales del asunto; hoy `library_research` se añade después a principal/auditor. No afirmar que Jev ya clasifica toda la Biblioteca ni que todos esos originales pertenecen a `citationScope`.

Corte histórico inicial: 136.267 referencias, 3.773 documentos con texto y 80.277 pasajes. No son cifras actuales. La [revalidación local](reports/design-reconciliation-2026-10-14.json) contiene un snapshot nuevo del progreso; El pipeline sigue activo; las cantidades no acreditan número de normas únicas, vigencia ni cobertura por especialidad. Sus fallos/lecturas parciales y OCR pendiente se preservan. El manifiesto de tres originales históricos sigue sin autenticación para checker, aunque otras extracciones recientes tengan OCR.

## SpecialistProfile v1

| Campo requerido | Contrato |
|---|---|
| Identidad | `profile_id`, `version`, `display_name`, `discipline`, `jurisdiction`, `status` |
| Agrupación | `practice_area_id` identifica una de las seis áreas; `subprofile_id` delimita el encargo, fuentes, prompt, herramientas y evaluación dentro del área |
| Subperfiles | `subprofiles[]` con `subprofile_id`, `version`, alcance, prompt/RAG/tools/limits/evaluation y habilitación propios; ejecución congela `subprofile_id` y `subprofile_version` |
| Persona pública | `persona_id`, `persona_version`, `persona_name`, `avatar_asset_ref`, `public_role_label`; personaje humano 3D tipo emoji, medio caricaturesco y de acabado hiperrealista, estable e identificado como IA |
| Modelo | `model_policy.default_model_id=gpt-6-luna`; upgrade permitido solo mediante ManualPowerOverride; sin fallback |
| Instrucciones/capacidad | `prompt_version`, `prompt_hash`, `capability_pack_id`, `capability_pack_version`, `capability_pack_hash`, límites/procedimiento/entregable y solicitudes faltantes |
| Recuperación | `rag_collections[]` como vistas/filtros del registro existente; `retrieval_policy_version`, fuentes permitidas, temporalidad y cobertura |
| Herramientas | `tools[]` allowlist, tipo de lectura, scopes y límites; ninguna escritura/entrega externa por defecto |
| Límites | `limits` de tokens, costo, tiempo, pasajes/recuperaciones y participación; presupuesto del encargo prevalece |
| Gobierno | `disclaimer_policy`, `evaluation_id`, `corpus_manifest_id`, `enabled_by`, `enabled_at` |

Estados propuestos: DRAFT / EXPERIMENTAL / ENABLED / SUSPENDED. `ENABLED` acredita aceptación del perfil para un alcance, no garantiza corrección jurídica ni autentica cada fuente. Una versión nueva de prompt/RAG requiere evaluación y no modifica trabajos históricos.

La persona pública es presentación del perfil, nunca Identity/Membership ni credencial profesional. Los campos de modelo/proveedor permanecen internos y no se proyectan a UI, tooltips, accesibilidad, errores, costos o exports. Cambiar profundidad conserva persona/nombre/perfil; no crea otro especialista ni revela el motor subyacente. Las maquetas con objetos abstractos y nombres técnicos quedaron reemplazadas por personajes humanos.

Core Legal compartido es una biblioteca de reglas: jurisdicción PY, permisos, procedencia, snapshots, evidencia, errores y estados. No es otro agente ni llamada facturable.

## Catálogo de seis áreas aceptado

| Área / personaje | Subperfiles del área | Fuentes candidatas y gate |
|---|---|---|
| Civil y patrimonial — Elena | Contratos/obligaciones; responsabilidad/daños; familia/niñez; sucesiones; inmuebles/patrimonio | Piloto únicamente contractual propuesto. Código Civil y fuentes pertinentes con originales/pasajes; familia, sucesiones y demás subperfiles requieren corpus/evaluación propios |
| Comercial y empresarial — Valeria | Sociedades; negocios/operaciones comerciales; banca/financiación; insolvencia/reestructuración | Legislación especial y jurisprudencia según subperfil; aún sin evaluación habilitante. No basta reutilizar el prompt Civil |
| Laboral — Lucía | Relaciones individuales; relaciones colectivas; seguridad social | Normativa y fuentes laborales/previsionales pertinentes por versión. Referencias en catálogo no habilitan automáticamente el perfil |
| Tributario y aduanero — Martín | Impuestos/obligaciones formales; fiscalizaciones/controversias; aduanas/comercio exterior | Fuentes tributarias/aduaneras oficiales registradas, temporalidad y relaciones normativas comprobables. Evaluación fiscal/aduanera específica pendiente |
| Penal — Diego | Defensa; querellas/representación de víctimas; delitos económicos | Fuentes penales/procesales con identidad y texto revisados; evaluación y límites propios, sin piloto activo |
| Derecho público — Camila | Constitucional/garantías; administrativo; contratación pública; regulación sectorial | Constitución, normativa administrativa/sectorial y fallos pertinentes según subperfil. OCR automático no cierra identidad, vigencia o aplicabilidad |

Seis es la cantidad de áreas/personajes base del producto, no una afirmación de que existan solo seis especialidades jurídicas. Agrupar no equivale a certificar conocimiento universal: cada subperfil conserva alcance, fuentes, instrucciones, herramientas, evaluación y habilitación propios. El perfil base identifica el área/persona persistente del titular; el encargo congela el subperfil técnico y su versión. Cambiar de subperfil dentro de esa área mantiene al titular/personaje, pero cambia la versión del encargo/contrato cuando corresponda; cambiar de área/titular requiere la reasignación controlada existente en el diseño.

Coordinación IA — Gabriel y revisión adversarial — Santiago son funciones adicionales, fuera del conteo de seis. Control de fuentes es una etapa determinística, no otra especialidad ni personaje abogado. Un asunto muestra titular e invitados; el directorio/selector explícito permite ver las seis áreas sin convocarlas ni ejecutarlas.

Catálogo estructurado de diseño: [SIX_AREA_SPECIALIST_CATALOG.v1.json](contracts/SIX_AREA_SPECIALIST_CATALOG.v1.json). Describe agrupación/personas y subperfiles en DRAFT o PILOT_DESIGN_ONLY; no contiene endpoints ni un registro de fuentes nuevo y no está conectado a runtime. Los nombres de persona son identificadores visuales ficticios, sin matrícula o atribución de identidad humana real.

Un encargo multidisciplinario conserva convocatoria explícita. Falta de cobertura de un subperfil no se resuelve activando toda su área ni a los seis especialistas. Solapamientos de contratos/cuestiones societarias se delimitan en el plan; no se cambia arbitrariamente el titular por mensaje.

## SpecialistOpinion v1

Campos: `opinion_id`, `schema_version`, `run_id`, `request_id`, `study_id`, `matter_id`, `participant_id`, `profile_id`, `profile_version`, `practice_area_id`, `subprofile_id`, `subprofile_version`, `model_id`, `prompt_version`, `document_snapshot_id`, `corpus_snapshot_id`, `evidence_pack_id`, `input_hash`, `output_hash`, `facts_used[]`, `analysis`, `cited_references[]`, `uncertainties[]`, `evidence_requests[]`, `usage`, `status`.

`facts_used[]` enlaza source/document/version/passage y naturaleza del dato. `analysis` responde su cuestión asignada; `cited_references` usa/adapta CitationSchema sin eliminar prosa del control. Opiniones no tienen permiso para declarar VERIFIED. Estados propuestos COMPLETE_DRAFT / NEEDS_MORE_EVIDENCE / PARTIAL / FAILED; una opinión parcial permanece visible y atribuida.

La integración titular no oculta aportes descartados: conserva autoría, fuentes, desacuerdos y decisión/razón de síntesis. No usar número de agentes coincidentes como evidencia de autenticidad o certeza.

## Recuperación y snapshots

1. Congelar versiones privadas autorizadas; distinguir originales, relato de parte y borrador IA. Un borrador previo no se vuelve prueba por ser documento del asunto.
2. Resolver fuentes públicas desde registro existente con jurisdicción/fecha/perfil; conservar texto, versión original y hash de extracción, localizadores y calidad OCR. Público no significa vigente/autenticado.
3. Priorizar candidatos del asunto con Jev y preservar el inventario no seleccionado. P04 mantiene su llamada; bypass o caché de clasificación requiere política aprobada adicional.
4. Reusar contexto Luna validado. Opiniones Luna reciben contexto más evidencia crítica y bibliografía, con presupuestos explícitos; resumir no impide recuperar originales omitidos.
5. Registrar cobertura por consulta y perfil, texto realmente entregado, truncamientos y fuente no encontrada. Más texto indexado no elimina límites de selección de seis fuentes/dos fragmentos.
6. Suplementos de evidencia cambian edición/snapshot y plan si alteran costos/alcance. No consultar directamente una URL propuesta por documentos; solo fuentes/herramientas autorizadas.
7. Pasar referencias al resolver/checker con identidad y provenance del registro existente. No crear otro registro para hacer pasar textos Biblioteca por fuentes verificadas.

El snapshot compuesto actual iguala `matter_snapshot_id` y `corpus_snapshot_id`; la Biblioteca congela una selección separada en el hash de preparación. Registrar ambas realidades. Separar snapshots canónicos requiere adaptador explícito; el contrato nuevo no puede afirmar que esa separación ya existe.

## Evaluación y costo

Comparar la misma muestra de encargos/evidencias con Junta actual y piloto Luna: documento decisivo recuperado, omisión, fuentes pendientes/genuinas, citas falsas bloqueadas, utilidad revisada por humano, costo total y latencia por tarea. No inferir P50/P90 de una consulta ni usar el benchmark visto como holdout nuevo.

G2 propuesto incluye Jev + contexto Luna + opinión Luna + checker; Chief por reglas no consume modelo si se usa explícitamente en ese piloto; el Director generativo P02-R1 exige grant y presupuesto de coordinación adicionales, contabilizados en el mismo encargo. Listar ambas tareas Luna, llamadas y reservas, aun si el usuario ve un solo titular. G3 añade opiniones por invitado; G4 añade objeciones/respuestas/integración; G5 sustituye solo el perfil autorizado por Sol. No se fijan tarifas actuales por el archivo histórico de precios: validar antes de cualquier live.

DONE de un perfil: schema/prompt/RAG versionados, corpus/muestra y límites de cobertura explícitos, pruebas de campo y falsos positivos/negativos, permisos, falla honesta y presupuesto verificable; revisión humana del alcance. El piloto sintético puede responder con fuentes pendientes. Habilitar la etiqueta VERIFIED real exige además procedencia/identidad y literalidad comprobadas, no solamente el piloto funcional.
