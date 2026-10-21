# CODEX — LAW & ORDER OS
## IMPLEMENTACIÓN FASE 1 — JUNTA JURÍDICA MULTIAGÉNTICA V2

**Directiva:** Construcción real de código, arquitectura modular, contratos verificables y pruebas automatizadas. No entregar solamente un diseño o pseudocódigo.

**Carpeta de trabajo:** `PROYECTOS/law & order`

**Producto:** LAW & ORDER OS — Sistema operativo integral para estudios jurídicos de Paraguay.

---

## 0. INSTRUCCIONES INICIALES OBLIGATORIAS

Antes de modificar cualquier archivo:

1. Localizar la carpeta existente `PROYECTOS/law & order`. No crear un proyecto duplicado en otra ubicación.
2. Inspeccionar el árbol real, archivos, dependencias, configuración, estado de Git y documentación existente.
3. Buscar el Blueprint y Roadmap v1.1, así como el handoff de continuidad y las fuentes oficiales investigadas.
4. Registrar el estado REAL: qué existe, qué está vacío, qué está implementado y qué no.
5. Si existe un repositorio Git, crear una rama de trabajo aislada. No desarrollar directamente sobre `main`.
6. Si la carpeta está vacía, preparar un prototipo modular independiente. No inventar un repositorio remoto ni desplegar.
7. No tocar Mussi Online, otros proyectos, producción ni datos de clientes.

**IMPORTANTE — CAMBIO ARQUITECTÓNICO EXPLÍCITAMENTE APROBADO**

El Blueprint V1.1 contiene el plan anterior de clonar la Junta Clínica 3→2→1 de Mussi.

ESA DECISIÓN FUE REEMPLAZADA.

La nueva Junta Jurídica será un motor propio, construido para documentos legales extensos, con:

`JEV → LUNA → SOL 6.1 MEDIUM → GEMINI 3.8 FLASH → FACT CHECKER DETERMINÍSTICO → ABOGADO HUMANO`

Registrar esta modificación mediante un ADR y una actualización de la documentación. No sobrescribir el blueprint histórico ni modificar las decisiones del producto ajenas a la Junta.

Si faltan documentos autoritativos que puedan cambiar contratos o infraestructura, reportar la dependencia antes de fijar decisiones definitivas. Continuar con componentes aislados que no dependan de ella.

---

## 1. OBJETIVO DEL MOTOR

Construir una Junta Jurídica capaz de:

- Trabajar con expedientes que pueden superar 1.000.000 de tokens en total.
- Analizar una cuestión jurídica delimitada por ejecución.
- Seleccionar evidencia pertinente sin reenviar todo el expediente a cada modelo.
- Conservar el vínculo entre cada dato utilizado y su documento original.
- Generar un análisis jurídico con GPT-6.1 Sol Medium.
- Someter ese análisis a auditoría adversarial con Gemini.
- Comprobar determinísticamente las referencias jurisprudenciales y normativas.
- Medir costo, tokens y latencia por etapa y por ejecución.
- Dejar la evaluación y aprobación jurídica final al abogado humano.

**PROBLEMA CENTRAL QUE DEBEMOS CONTROLAR:**

Una LLM puede producir un análisis aparentemente fundamentado en una sentencia que nunca existió.

El sistema debe distinguir una conclusión jurídica discutible de una referencia jurisprudencial inventada o no verificable.

No diseñar el checker para decidir si una tesis jurídica es correcta.

No considerar auténtica una sentencia porque dos modelos coinciden en citarla.

---

## 2. ARQUITECTURA DE MÓDULOS

Implementar los siguientes componentes con interfaces tipadas y responsabilidades separadas:

```text
law-order-os/
  [estructura existente, si la hay]
  junta-juridica/
    src/
      domain/
      ingestion/
      retrieval/
      evidence-router/
      context-builder/
      principal-analysis/
      adversarial-audit/
      citation-checker/
      orchestration/
      providers/
      persistence/
      telemetry/
      cli/
    tests/
      fixtures/
      unit/
      integration/
      adversarial/
    docs/
      ADR_JUNTA_JURIDICA_V2.md
      CONTRACTS.md
      BENCHMARK_PROTOCOL.md
      RUNBOOK.md
```

La ubicación concreta debe respetar las convenciones del proyecto existente. Si no existe stack, utilizar Node.js + TypeScript + Vitest para el motor experimental, dejando explícito que no constituye una selección definitiva del stack del OS.

No construir microservicios innecesarios. Priorizar módulos independientes y testeables dentro de un mismo proyecto.

No crear todavía un sistema completo de autenticación, CRM, contabilidad ni frontend empresarial.

---

## 3. CONTRATO GENERAL: LEGAL RESEARCH REQUEST

Cada ejecución comienza con una solicitud estructurada.

Campos mínimos:

```text
request_id
study_id
matter_id
requested_by
jurisdiction
legal_question
scope
as_of_date
matter_snapshot_id
corpus_snapshot_id
selected_document_ids[]
max_cost_usd
```

Reglas:

- `legal_question` debe identificar un encargo concreto.
- Un expediente puede producir múltiples encargos jurídicos.
- El ámbito temporal y jurisdiccional debe permanecer explícito.
- Los identificadores deben conservar las relaciones con el estudio y asunto.
- Nunca permitir que un usuario obtenga información privada de otro asunto mediante IDs.
- Un cambio en el expediente no altera retrospectivamente una ejecución anterior.
- Conservar snapshots e identificadores de versión.

No transformar una petición general como «analizá todo este expediente» en diez Juntas automáticas.

Primero debe poder prepararse un plan de cuestiones y presupuesto para aprobación.

---

## 4. CAPA DOCUMENTAL Y RAG

Antes de ejecutar modelos, establecer un pipeline de evidencia.

### Ingestión

Soportar documentos autorizados con:

```text
document_id
document_version_id
study_id
matter_id
source_type
origin_uri
original_hash_sha256
ingestion_status
verification_status
extraction_quality
text_spans[]
page_locations[]
```

Separar estrictamente:

1. Documentos privados del expediente.
2. Jurisprudencia oficial.
3. Legislación y normas.
4. Material editorial o de terceros autorizado.

Una sentencia mencionada en un escrito privado NO queda automáticamente autenticada como fuente judicial.

Conservar originales sin sobrescribirlos.

### Recuperación

Implementar contratos para:

- Búsqueda textual.
- Búsqueda por metadatos e identificadores.
- Recuperación semántica mediante adaptador.
- Recuperación de fragmentos originales por `document_id` y localizador.
- Resolución exacta de referencias bibliográficas.

La búsqueda por similitud no equivale a comprobar la identidad de una sentencia.

Para el prototipo se admite un índice local funcional y un corpus pequeño de documentos autorizados.

No declarar que hay un RAG paraguayo completo si solamente existen fixtures.

No implementar scraping masivo ni extracción que evada restricciones de los organismos estatales.

---

## 5. AGENTE 1 — JEV EVIDENCE ROUTER

**Modelo elegido:** Jev 1.13.

### Responsabilidad

Recibe:

- Cuestión jurídica.
- Metadatos del encargo.
- Fragmentos candidatos recuperados.
- Identificadores y localizadores originales.

Devuelve exclusivamente datos estructurados.

Cada candidato debe incluir:

```text
document_id
passage_id
classification
relevance_score
selection_reason
```

Clasificaciones:

```text
ESSENTIAL
RELEVANT
CONTEXTUAL
POTENTIALLY_CONTRADICTORY
UNCERTAIN
NOT_RELATED_TO_THIS_QUESTION
```

### Reglas obligatorias

Jev NO redacta el análisis.

Jev NO determina la autenticidad de la jurisprudencia.

Jev NO elimina documentos del expediente.

Jev NO impide que Sol o Gemini recuperen documentos inicialmente no seleccionados.

Procesar candidatos por lotes dentro de los límites reales del proveedor; no enviar el expediente entero en una sola solicitud.

Registrar el costo, número de candidatos, seleccionados, rechazados e inciertos.

Implementar un control de cobertura: un candidato marcado `UNCERTAIN` no debe perderse silenciosamente.

---

## 6. AGENTE 2 — LUNA CONTEXT BUILDER

**Modelo elegido:** GPT-6 Luna.

### Responsabilidad

Transformar la evidencia seleccionada en un `LegalCasePacket` estructurado.

Salida requerida:

```text
packet_id
packet_version
request_id
documentary_facts[]
party_allegations[]
chronology[]
contested_facts[]
contradictions[]
relevant_documents[]
missing_information[]
unresolved_questions[]
coverage_limitations[]
```

Cada elemento factual debe conservar referencias a uno o varios fragmentos originales.

Separar explícitamente:

- Hecho contenido en un documento.
- Afirmación de una parte.
- Inferencia del modelo.
- Información no disponible.

### Reglas

No inventar fechas, nombres, importes ni hechos para completar campos.

No convertir el resumen generado en fuente original.

No reemplazar el acceso a documentos por el resumen.

Permitir reutilización y actualización incremental del contexto cuando ingresan documentos nuevos.

La nueva información marca los resultados afectados como `OUTDATED`; no dispara automáticamente una nueva Junta.

Luna no redacta el dictamen jurídico final.

---

## 7. AGENTE 3 — SOL 6.1 ABOGADO PRINCIPAL

**Modelo elegido:** GPT-6.1 Sol.

**Reasoning effort:** `medium`.

Validar el identificador API exacto disponible. No confundir el nombre comercial con un model ID supuesto.

### Entrada

Recibe:

- Cuestión jurídica delimitada.
- LegalCasePacket.
- Evidence Pack congelado.
- Fragmentos originales seleccionados.
- Legislación y jurisprudencia recuperada con identificación.
- Limitaciones de cobertura.

### Salida estructurada

```text
analysis_id
request_id
question_analyzed
factual_basis[]
legal_analysis
alternative_interpretations[]
supporting_references[]
unresolved_issues[]
additional_evidence_requests[]
limitations[]
completion_status
```

Sol debe referenciar `source_id` y `passage_id` cuando utiliza evidencia recuperada.

No citar jurisprudencia ficticia como si hubiese sido comprobada.

Puede mencionar referencias nuevas como candidatas, pero esas referencias no reciben automáticamente identidad verificada.

### Presupuesto inicial experimental

```text
reasoning_effort: medium
target_input_tokens: 50000
default_max_input_tokens: 60000
exceptional_max_input_tokens: 100000
max_output_tokens: 25000
max_additional_retrievals: 2
```

Los límites son valores de prueba configurables, no parámetros jurídicamente validados.

`max_output_tokens` incluye razonamiento facturable. No reducirlo silenciosamente de forma que el modelo termine sin respuesta.

Sol NO debe:

- Procesar otra vez la totalidad del expediente.
- Clasificar todos los documentos.
- Ejecutar búsquedas indefinidas.
- Redactar simultáneamente todos los escritos posibles.
- Ejecutar nuevas Juntas por iniciativa propia.
- Declarar que una sentencia está autenticada.

Si falta evidencia decisiva, devolver `NEEDS_MORE_EVIDENCE` o estado equivalente.

No fabricar una respuesta completa para cumplir artificialmente el presupuesto.

---

## 8. AGENTE 4 — GEMINI ADVERSARIAL AUDITOR

**Modelo elegido:** Gemini 3.8 Flash.

**NO usar Haiku.**

Tenemos decidido utilizar Gemini como auditor porque el proyecto contará con acceso mediante API de Gemini.

Validar el model ID realmente disponible en la cuenta antes de ejecutar llamadas reales. No seleccionar automáticamente otro modelo.

### Entrada

- LegalCasePacket.
- Resultado íntegro de Sol.
- Referencias estructuradas.
- Evidencia original recuperada.
- Manifiesto de cobertura.

### Función

Realizar una revisión adversarial.

Buscar:

- Afirmaciones que no aparecen en los documentos citados.
- Referencias jurisprudenciales sospechosas.
- Citas textuales inconsistentes.
- Contradicciones documentales no consideradas.
- Hechos agregados por el modelo sin soporte.
- Evidencia importante potencialmente omitida por el router o resumen.

NO actuar como juez ni asignar probabilidades inventadas de éxito judicial.

### Salida

```text
audit_id
analysis_id
findings[]
citation_objections[]
unsupported_fact_flags[]
missing_evidence_flags[]
requested_passages[]
audit_status
```

Cada hallazgo debe identificar:

```text
finding_id
type
severity
statement
related_source_ids[]
recommended_action
```

Gemini puede solicitar recuperación adicional acotada.

No ejecutar ciclos de auditoría ilimitados.

La auditoría no concede autenticidad bibliográfica; solo formula objeciones.

---

## 9. FACT CHECKER DETERMINÍSTICO

Este componente NO utiliza una LLM para decidir si una referencia existe.

Debe utilizar registros documentales y procedimientos determinísticos sobre datos de fuentes autorizadas.

### Estados de identidad

```text
VERIFIED_IDENTITY
METADATA_MISMATCH
AMBIGUOUS
NOT_FOUND_IN_SCOPE
SOURCE_UNAVAILABLE
INSUFFICIENT_IDENTITY
```

### Estados de cita textual

```text
QUOTE_MATCH
QUOTE_MISMATCH
TEXT_UNAVAILABLE
EXTRACTION_UNCERTAIN
NOT_APPLICABLE
```

### Comprobaciones

Verificar, según los campos realmente disponibles:

- Identificador de fuente.
- Tribunal u organismo.
- Sala.
- Tipo de resolución.
- Número.
- Fecha.
- Documento original.
- Versión.
- Existencia del fragmento utilizado.
- Coincidencia de citas textuales literales.

No declarar identidad comprobada solamente por coincidencia del número de resolución.

No declarar identidad comprobada por similitud vectorial.

No aceptar que una referencia exista porque dos LLMs coincidan en citarla.

No confundir `NOT_FOUND_IN_SCOPE` con inexistencia universal.

No considerar `HTTP 200` prueba de autenticidad.

Los documentos privados que mencionen sentencias no cuentan como fuente oficial de esas sentencias.

El checker debe inspeccionar referencias estructuradas y citas detectables en texto libre. La cobertura del extractor también debe evaluarse: no basta con comprobar correctamente las citas que alcanzó a detectar.

Las comprobaciones textuales pueden utilizar normalizaciones conservadoras y reproducibles, conservando texto original y offsets. No transformar una paráfrasis en cita literal válida.

Si la fuente está incompleta, ilegible o es ambigua, mantener estado pendiente.

### Gate de salida

Ninguna cita con identidad no comprobada puede aparecer en la interfaz o exportación con etiqueta `VERIFIED`.

Conservar el análisis como borrador y señalar las referencias problemáticas para revisión.

No declarar jurídicamente correcto un análisis porque sus citas existan.

---

## 10. ORQUESTADOR Y CONTROL DE EJECUCIÓN

Construir un orquestador independiente de los modelos.

Estados mínimos:

```text
CREATED
PREPARING_EVIDENCE
ROUTING_EVIDENCE
BUILDING_CONTEXT
PRINCIPAL_ANALYSIS
ADVERSARIAL_AUDIT
CHECKING_REFERENCES
HUMAN_REVIEW_PENDING
PARTIAL
FAILED
CANCELLED
```

Estado separado de vigencia:

```text
CURRENT
OUTDATED
```

Cada ejecución debe registrar:

```text
run_id
request_id
stage_name
stage_version
model_provider
model_id
input_snapshot_hash
output_snapshot_hash
input_tokens
output_tokens
reasoning_tokens_if_available
latency_ms
estimated_cost_usd
actual_cost_usd_if_available
status
error_code
```

Nunca inventar costos cuando el proveedor no devuelve el uso suficiente. Identificar claramente los importes estimados y la fuente de tarifas empleada.

### Restricciones económicas

Implementar:

- Presupuesto máximo configurable por ejecución.
- Comprobación presupuestaria antes de cada llamada.
- Conteo real de tokens cuando esté disponible.
- Control de recuperaciones adicionales.
- Límites de reintentos.
- Timeout por etapa.
- Registro del costo por modelo.
- Reporte del costo total por Junta.

No ejecutar otra llamada automáticamente para corregir una salida si el presupuesto ha sido agotado.

No usar fallbacks silenciosos a otros modelos.

No continuar con una aprobación ficticia cuando un proveedor falle.

Una ejecución parcial debe permanecer `PARTIAL` o `FAILED`, con su evidencia.

---

## 11. PROVEEDORES Y CONFIGURACIÓN

Crear adapters independientes:

```text
JevProvider
LunaProvider
SolProvider
GeminiProvider
LegalEvidenceProvider
CitationResolver
```

Variables configurables, sin claves hardcodeadas:

```text
JEV_API_KEY
JEV_MODEL

OPENAI_API_KEY
OPENAI_LUNA_MODEL
OPENAI_SOL_MODEL
OPENAI_SOL_REASONING_EFFORT=medium

GEMINI_API_KEY
GEMINI_AUDITOR_MODEL

BOARD_MAX_COST_USD
BOARD_TIMEOUT_MS
BOARD_MAX_RETRIES
BOARD_MAX_RETRIEVALS
```

Los identificadores efectivos de modelos deberán verificarse con sus APIs o SDKs oficiales.

Si una credencial no existe:

- Los tests offline deben seguir funcionando.
- La etapa real queda bloqueada con motivo explícito.
- No generar resultados ficticios y etiquetarlos como reales.

No ejecutar llamadas de pago durante tests automáticos ordinarios.

Una llamada real necesita comando y autorización explícitos.

No guardar credenciales ni contenido confidencial en logs.

---

## 12. PERSISTENCIA E IDEMPOTENCIA

Implementar almacenamiento de desarrollo para:

- Encargos jurídicos.
- Snapshots de contexto.
- Evidence Packs.
- Ejecuciones de Junta.
- Resultados por etapa.
- Auditorías.
- Comprobaciones bibliográficas.
- Consumo y costos.

Si no existe una base de datos del OS, utilizar persistencia local de desarrollo intercambiable; documentarla como temporal.

No introducir un esquema productivo definitivo para usuarios, estudios o expedientes sin validar el stack del OS.

Cada etapa debe estar vinculada a un `run_id` y a una versión de entrada.

Reintentar una operación no debe duplicar una Junta ni alterar un resultado ya aprobado.

No almacenar texto privado de otro estudio en un caché compartido.

---

## 13. TESTS OBLIGATORIOS

Implementar pruebas unitarias y de integración sobre fixtures controlados.

### Router

- Jev selecciona material claramente relacionado.
- Material contradictorio queda disponible.
- Material incierto no se elimina.
- Se conservan IDs y localizadores originales.
- Se respetan presupuestos y límites por lote.

### Context Builder

- No desaparecen las referencias al original.
- Alegaciones e inferencias no se transforman en hechos comprobados.
- Una actualización no reescribe un snapshot histórico.
- Un documento nuevo provoca `OUTDATED` cuando corresponde.

### Principal y Auditor

- Sol recibe la cuestión delimitada.
- Sol no inicia Juntas adicionales.
- Recuperaciones adicionales respetan límites.
- Gemini identifica una cita sospechosa en un resultado artificial.
- Error de Gemini no se convierte en auditoría aprobada.

### Checker

Casos adversariales mínimos:

1. Sentencia auténtica, metadatos coincidentes.
2. Sentencia completamente inventada.
3. Número real atribuido a tribunal incorrecto.
4. Número real atribuido a fecha incorrecta.
5. Referencia con información insuficiente.
6. Dos resoluciones candidatas ambiguas.
7. Fuente oficial inaccesible.
8. Sentencia real con cita literal inventada.
9. Referencia introducida únicamente en texto libre.
10. Documento privado que cita una sentencia inexistente.
11. Misma sentencia con extracción textual defectuosa.
12. Referencia modificada después de una verificación anterior.

En ningún caso una referencia falsa debe marcarse como `VERIFIED_IDENTITY`.

### Seguridad

Probar aislamiento entre estudios y asuntos.

No recuperar evidencia privada usando solamente un UUID conocido.

No permitir que instrucciones incrustadas en un PDF alteren la configuración de agentes o salteen el checker.

### Ejecución

Probar cancelación, timeouts, reintentos e interrupciones sin duplicar costos o estados aprobados.

---

## 14. BENCHMARK

Preparar dos conjuntos separados:

**Development Set:** permite corregir prompts y contratos.

**Holdout Set:** queda congelado antes de la evaluación final.

No utilizar los mismos casos repetidamente para ajustar y después presentar sus resultados como evaluación independiente.

El benchmark debe reportar separadamente:

```text
relevant_document_recall
critical_document_omission
citation_extraction_recall
false_verified_citations
genuine_citations_unresolved
audit_findings
input_tokens
output_tokens
cost_per_run
latency_p50
latency_p90
provider_errors
```

La exactitud del dictamen jurídico NO reemplaza estas métricas.

No anunciar reducción porcentual de alucinaciones sin comparación empírica reproducible.

---

## 15. ENTREGABLE DE LA PRIMERA IMPLEMENTACIÓN

Al terminar, debe existir:

1. Código modular de la Junta Jurídica.
2. Contratos tipados de todas las etapas.
3. Adapters de proveedores con configuración real.
4. Router Jev conectado a la interfaz de recuperación.
5. Context Builder Luna.
6. Principal Sol configurado en Medium.
7. Auditor Gemini.
8. Checker bibliográfico determinístico.
9. Orquestador con estados, límites y manejo de fallas.
10. Persistencia de desarrollo.
11. Fixtures legales y tests adversariales.
12. CLI para ejecutar un caso de prueba y consultar el resultado.
13. Reporte de tokens, latencia y costos.
14. Documentación técnica y ADR del cambio respecto del Blueprint V1.1.

### CLI requerida

Proporcionar comandos reproducibles equivalentes a:

```bash
npm run board:test
npm run board:smoke:offline
npm run board:benchmark:offline
```

Para pruebas reales, implementar un comando separado y explícitamente habilitado. No incorporarlo al test normal ni dispararlo durante la instalación.

### Evidencia de cierre

Entregar:

```text
IMPLEMENTATION_REPORT.md
ARCHITECTURE_DECISIONS.md
TEST_RESULTS.md
MODEL_CONNECTIVITY.md
COST_REPORT.md
KNOWN_LIMITATIONS.md
NEXT_STEPS.md
```

Cada resultado debe distinguir:

```text
PASS
FAIL
BLOCKED
NOT_RUN
```

No marcar como PASS una integración que solamente funciona con mocks.

---

## 16. FUERA DE ALCANCE DE ESTA IMPLEMENTACIÓN

No desarrollar todavía:

- Dashboard completo del estudio.
- CRM.
- Gestión de honorarios.
- Portal del cliente.
- Presentaciones judiciales automáticas.
- Predicción de sentencias.
- Un sistema de facturación.
- Integración productiva con organismos estatales todavía no habilitados.
- Procesamiento masivo de jurisprudencia sin permisos resueltos.
- Clonación de Mussi Online.

La visión del OS completo permanece intacta. Esto es solamente el motor de inteligencia jurídica.

---

## 17. REGLAS DE EJECUCIÓN PARA CODEX

Trabajar de forma continua, sin detenerse tras cada archivo o módulo para pedir autorización ordinaria.

No improvisar decisiones críticas que contradigan el blueprint o este prompt.

No introducir servicios externos nuevos como arquitectura definitiva sin justificación.

No realizar deploy, push remoto ni modificaciones productivas.

No fabricar evidencias, resultados de proveedores, cobertura de fuentes ni pruebas ejecutadas.

No introducir fallback silencioso de modelos.

Si existe un bloqueo por credenciales, integración externa o fuente documental, registrar `BLOCKED` y continuar con las partes independientes que puedan construirse correctamente.

No confundir un prototipo de RAG con una base jurídica paraguaya completa.

El resultado debe permitir que posteriormente integremos el motor en el OS sin reescribirlo.

---

## 18. DEFINICIÓN DE DONE

La primera Junta Jurídica estará técnicamente preparada para validación cuando:

- Se puedan ejecutar offline todas las etapas sobre evidencia controlada.
- Los contratos entre Jev, Luna, Sol, Gemini y checker sean compatibles y validados.
- Los proveedores reales tengan adapters funcionales y estado de conectividad explícito.
- El checker rechace referencias ficticias del conjunto adversarial.
- Los presupuestos y límites detengan llamadas excesivas.
- Existan métricas reproducibles de tokens, latencia y costos.
- Los resultados parciales o fallidos no se presenten como aprobados.
- Los documentos originales y las referencias de procedencia se conserven.
- El código quede dentro del proyecto LAW & ORDER OS.
- Ningún archivo de Mussi Online haya sido modificado.

**No declarar DONE de integración real si faltan credenciales, permisos, corpus auténtico o pruebas en vivo.**

Al finalizar, entregar un informe integral de lo implementado, lo probado, los bloqueos y el siguiente paso exacto.

**COMENZAR POR AUDITAR LA CARPETA LOCAL Y LOS DOCUMENTOS DEL PROYECTO. DESPUÉS IMPLEMENTAR EL MOTOR AISLADO HASTA COMPLETAR TODOS LOS GATES QUE NO DEPENDAN DE BLOQUEOS EXTERNOS.**