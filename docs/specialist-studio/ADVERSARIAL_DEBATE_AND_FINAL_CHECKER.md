# Debate adversarial y checker terminal de todos los participantes

Actualización documental: 15/10/2026, America/Asuncion. Referencia de decisiones/handoff: 14/10/2026; propuestas aún sin aprobación funcional.

Estado: PROPOSED, 14/10/2026. [ADR P05/P06/P09/P10](ADR_SPECIALIST_STUDIO_002.md). Protocolo diseñado, no conectado al runtime.

## Hallazgo que motiva el cambio

La Junta actual ejecuta `ADVERSARIAL_AUDIT` antes de `CHECKING_REFERENCES`; ese orden es correcto. `checkAnalysis` recibe solamente PrincipalAnalysis, también en revalidación de caché. AuditSchema conserva hallazgos, recomendaciones, citation_objections y flags en prosa, pero no un ciclo de preguntas/respuestas ni un conjunto de citas controlado por el checker.

El probe nuevo inyectó una sentencia inventada únicamente en hallazgos/objeciones Gemini. El run simulado terminó HUMAN_REVIEW_PENDING/PASS_IN_SCOPE y solo tenía chequeada `ref-fixture`. Extraer explícitamente el hallazgo detectó la referencia. Evidencia: [checker-coverage-probe.json](reports/checker-coverage-probe.json). No es una llamada real ni prueba de falsa etiqueta individual VERIFIED; reproduce la omisión del gate agregado.

`legalDocumentMarkdown/Html` compone pregunta, análisis transformado por `lawyerText`, hallazgos/recomendaciones y bibliografía después del chequeo. Por tanto, su texto visible/exportado no está completamente cubierto por el input anterior. La referencia de un documento privado o una cita reproducida para objetarla debe identificarse con ese contexto y no confundirse con fundamento adoptado.

## Revisión transversal y Junta completa

Santiago representa públicamente la función adversarial, fuera del conteo de seis. Puede revisar una consulta focal, equipo especializado o Junta completa. No depende de subir profundidad ni de activar seis especialistas. El humano ve y autoriza su participación antes de ejecutar; la selección de modalidad por sí sola no autoriza debate.

Junta completa requiere seis áreas habilitadas con pregunta propia, subperfil/versionado y evidencia; la falta de una se informa, sin personaje decorativo ni sustitución oculta. Gabriel prepara equipo/alcance; no produce conclusiones ni decide quién gana. El titular integra según P05, conservando disensos y preguntas abiertas.

## AdversarialDebate v1

Campos requeridos: `debate_id`, `schema_version`, `run_id`, `study_id`, `matter_id`, `plan_hash`, `authorization_id`, `participants[]`, `auditor_model_id=gemini-3.8-flash`, `issues[]`, `auditor_objections[]`, `responses[]`, `round_count`, `max_rounds`, `max_interventions`, `budget_usd`, `usage`, `final_edition_version`, `status`.

Cada participante identifica profile/version/model y función. Cada issue tiene ID, objetivo/pregunta, evidencia/snapshot y estado OPEN / ANSWERED / UNRESOLVED. Objeción y respuesta son artefactos inmutables: autor, destinatarios, ronda, texto, referencias candidatas, hash, timestamp, relación al issue y consumo.

| Paso | Comportamiento propuesto |
|---|---|
| 1. Consentimiento | Humano habilitado autoriza Gemini, equipo, límites y presupuesto ligados a plan/snapshot |
| 2. Opiniones | Titular e invitados aportan independientemente sobre la misma foto de hechos; preservan fuentes y diferencias |
| 3. Objeciones | Gemini recibe opiniones completas dentro del límite, evidencia/localizadores y cobertura; no solo resumen del titular |
| 4. Réplicas | Cada participante cuestionado responde a sus issues con originales autorizados; puede reconocer falta de evidencia o sostener disenso |
| 5. Cierre | Titular integra si P05 se aprueba. P06 propone una ronda Gemini + una réplica por destinatario + una integración |
| 6. Congelación | Se cierra generación, se conserva todo output y se compone la versión final/anexos que se mostrarán/exportarán |
| 7. Checker | Extracción y validación terminal sobre todos los artefactos y referencias de todos los autores |
| 8. Humano | Revisa resultado, disensos y fuentes; guardar/revisar/aprobar son actos separados |

Un intercambio adicional excede P06 y necesita nuevo plan/reserva/consentimiento, no un bucle hasta unanimidad. Límite de tokens/tiempo/costo/intervenciones puede terminar antes: estado PARTIAL con issues abiertos. Si Gemini falla, no registrar «debate completado»; humano puede continuar sin adversario en una nueva edición explícita del plan. Cancelación conserva originales/costos y no reejecuta automáticamente.

Head Chief no integra argumentos. Jev no elige quién gana. Gemini no autentica fuentes. Auditoría de calidad jurídica y control bibliográfico permanecen independientes: fuentes cotejadas no cierran objeciones jurídicas HIGH/CRITICAL ni aprueban escritos.

## FinalCitationAudit v1

| Campo | Regla |
|---|---|
| Identidad | `audit_id`, `schema_version`, `study_id`, `matter_id`, `run_id`, `edition_id` |
| Versión final | `final_output_version_id`, `final_content_hash`, `render_version`, `artifact_hashes[]` |
| Manifiesto | `source_output_refs[]` con participant/role/stage/round/output_id/hash/visible_fields; incluyen contexto y cualquier output expuesto |
| Evidencia | Snapshots de asunto/corpus, versiones originales/extracción, `trust_registry_hash`, `provenance_policy_version` |
| Detección | `extracted_refs[]`, `unknown_markers[]`, `extraction_locations[]`, `extractor_version` |
| Resultados | `verified_refs[]`, `unresolved_refs[]`, `checks[]` con estados reales del checker y pruebas/razones |
| Cobertura | `collection_status`, `coverage_status`, `coverage_limitations[]`, `checker_version`, `audit_status` |
| Tiempo | `checked_at`, vencimiento de evidencia/atestaciones; revocación obliga a revalidar |

`collection_status` propuesto COMPLETE / INCOMPLETE se refiere a reunir los outputs esperados del plan; es diferente del `coverage_status` actual COVERED_IN_GRAMMAR / REVIEW_REQUIRED. `audit_status` propuesto PASS_IN_SCOPE / REVIEW_REQUIRED / FAILED no sustituye el resultado de mérito Gemini ni el estado del run.

## Qué entra al extractor

- Texto final integrado, opiniones originales de titular y consultores, objeciones/preguntas/recomendaciones Gemini y réplicas, incluida cita descartada o reproducida para refutación.
- Campos de hechos, alternativas, limitaciones, vacíos y citas estructuradas; anexos, bibliografía y fragmentos visibles del resultado.
- Texto de Chief/Jev/contexto si queda expuesto o incorporado al resultado. Que el contrato les prohíba citar no autoriza omitir una referencia efectivamente aparecida.
- Pregunta/contexto reproducido del usuario, con origen USER o DOCUMENT y relación QUOTED_INPUT, no atribución falsa a un agente ni validación implícita de ese contenido.
- HTML/Markdown/documento final después de transformaciones de presentación. Mantener offsets por campo/artefacto, autor/etapa y contexto de uso.

No escanear solo `citations[]`, ni concatenar todo perdiendo autorías/offsets. Unión de referencias declaradas y detectadas en prosa. Se puede resolver una identidad una sola vez por snapshot/política, pero se guardan todas sus ocurrencias, autores y citas literales distintas. Una nueva transcripción requiere cotejo propio aunque el documento sea el mismo.

## Identidad, literalidad y etiquetas

Reusar `ExactCitationResolver`, `OfficialEvidenceRegistry`, `CitationSchema`/adaptadores y estados actuales:

| Eje | Valores actuales relevantes |
|---|---|
| Identidad | VERIFIED_IDENTITY, METADATA_MISMATCH, AMBIGUOUS, NOT_FOUND_IN_SCOPE, SOURCE_UNAVAILABLE, INSUFFICIENT_IDENTITY |
| Literal | QUOTE_MATCH, QUOTE_MISMATCH, TEXT_UNAVAILABLE, EXTRACTION_UNCERTAIN, NOT_APPLICABLE |
| Procedencia | TRUSTED_OFFICIAL, SIMULATION, UNTRUSTED |
| Gate | PASS_IN_SCOPE / REVIEW_REQUIRED; NOT_CHECKED en run |
| Etiqueta por referencia | VERIFIED / SIMULATED_VERIFIED / REVIEW_REQUIRED |

Una firma de la propia app no crea procedencia estatal. Un link oficial u original con hash no resuelve identidad contextual de una sentencia. Normativa necesita instrumento/versión y artículos localizables; no se inventa un tribunal para satisfacer el schema actual. Identidad+literalidad no certifican vigencia consolidada ni aplicabilidad.

No prometer detectar todas las citas de cualquier texto natural con regex: el extractor actual tiene ocho familias y marcadores genéricos. Reunir todas las salidas sí se verifica contra el plan/manifiesto. La cobertura de detección se declara dentro de su gramática, con una evaluación independiente; nunca etiqueta universal sin límites. Una referencia posible no estructurada queda REVIEW_REQUIRED. El caso de número en palabras sigue siendo pendiente real.

Si no hay referencias detectadas, informar «Sin referencias identificadas para cotejar», no «Fuentes verificadas». Si una cita inventada está reproducida como objeto de refutación, conservar su fallo y su contexto de uso; no esconderla ni invalidar automáticamente el razonamiento de quien la refutó. La salida global conserva fuentes pendientes y exige revisión según política.

## Versionado, idempotencia y exportación

Clave lógica propuesta: hash de scope + final_output_version/content + manifiesto de outputs + snapshots + versiones de checker/extractor/render/política + registry fingerprint. Mismo input válido reutiliza auditoría; cambiar cualquier componente produce otra auditoría. Expiración/revocación de confianza se reevalúa antes de servir/exportar, aunque bytes no cambien.

El artefacto final se compone antes del gate terminal. Exportar otra representación debe probar equivalencia del texto/citas por un renderer versionado o auditar ese artefacto concreto; conservar su hash. Una operación puramente binaria que no modifica contenido puede compartir auditoría si esa equivalencia está comprobada, no presumida.

Cualquier generación posterior, nueva respuesta Sol, integración, cambio de cita humana o transformación textual invalida el vínculo de la nueva versión. No altera auditoría histórica; marca pendiente y vuelve a comprobar antes de mostrar comprobada/exportar con ese estado. Nuevo documento del asunto conserva snapshots históricos y marca OUTDATED según impacto, sin cobrar reruns automáticos.

Vincular auditoría con DocumentVersion/DraftReview. Hoy no existe tal vínculo ni hook que revalide referencias tras revisión del borrador. Agregarlo es trabajo G2/G6; no atribuir esa capacidad al checker actual por estar la revisión documental versionada.

## Pruebas mínimas del gate nuevo

Cita falsa introducida separadamente por titular, consultor, Gemini, réplica e integración; prosa y anexo sin references[]; tribunal/fecha erróneos; identidad ambigua; ley/artículo y versión; original sin confianza; literal alterado; número en palabras; cita descartada atribuida correctamente; manifiesto omite un participante; auditor falla; límite de ronda/gasto; nueva cita posterior; edición humana y export transformado; revocación; cache de otra policy; ID conocido de otro tenant; cero citas; salidas simuladas nunca VERIFIED.

La implementación termina solo cuando estos casos afectan el gate del documento que llega al humano, no únicamente una función aislada. Deben conservarse también positivos genuinos autorizados: cero falsos VERIFIED con un gate que no verifica nada no mide utilidad.
