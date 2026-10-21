# HANDOFF — Director jurídico, especialistas reales y Equipo jurídico

Fecha de referencia: 14/10/2026, America/Asuncion.
Proyecto: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS`.
Estado de continuación: diseño de capacidades y reconciliación del ADR antes de implementación funcional.

## 1. Qué pidió el propietario y qué NO está autorizado

El propietario pide trasladar el contexto a otro chat. Este archivo resume decisiones, propuestas y evidencia; no concede autorización nueva de gasto, despliegue o cambios productivos. Distinguir las instrucciones directas del propietario de propuestas del asistente y antecedentes documentales.

Límites vigentes:

- NO reconstruir LAW & ORDER OS, Core, Junta existente, Biblioteca ni registro de fuentes.
- NO modificar orquestación productiva ni desplegar antes de aprobación expresa del ADR reconciliado con código real.
- NO iniciar inferencias jurídicas pagas, pruebas live, migraciones, instalación de servicios o cambios de credenciales por leer este handoff.
- Preservar clientes, asuntos, documentos/versiones, borradores/revisiones, tareas, permisos, respaldos e historial.
- No detener o reiniciar innecesariamente la carga de Biblioteca/OCR ni interferir con otros procesos del propietario.
- El modo local sin autenticación sigue reservado a datos sintéticos. No presentarlo como entorno apto para expedientes confidenciales.
- No crear ramas, commits ni hacer `git reset`/`git clean` para resolver el estado. El repositorio no tiene un primer commit y todos los archivos están untracked.

La aprobación del propietario «Esta ok... antes de proceder...» aceptó la dirección general del plan de UX, pero abrió otra discusión ANTES de ejecutar: qué skills harán especialistas reales y dónde entra la Junta completa con adversario. La respuesta sobre skills/escalamiento es una propuesta del asistente, todavía no una aprobación funcional del ADR.

## 2. Lectura inicial obligatoria y autoridad documental

1. Leer íntegramente el documento original solicitado por el propietario:
   `C:/Users/User/Downloads/LAW_ORDER_OS_HANDOFF_HEAD_CHIEF_ESPECIALISTAS_V2_2026-10-14.md`.
   Ya fue leído íntegramente en este chat; tamaño observado 31.935 bytes. Reemplaza propuestas anteriores de especialistas y exige auditor antes del checker FINAL de todos.
2. Leer este handoff completo y contrastarlo con el código actual, no solo con informes históricos.
3. Leer Blueprint/Roadmap y ADRs existentes desde la raíz del proyecto:
   - `docs/LAW_ORDER_OS_BLUEPRINT_v2.0.md`
   - `docs/LAW_ORDER_OS_ROADMAP_v2.0.md`
   - `docs/ADR_RECONCILIACION_V2.md`
   - `docs/ADR_OS_001_ACCEPTED.md`
   - `docs/ADR_OS_001_LOCAL_BROWSER_ADDENDUM.md`
4. Leer el paquete de ampliación preparado:
   - [ADR propuesto](ADR_SPECIALIST_STUDIO_002.md)
   - [Foto de auditoría anterior](CURRENT_RUNTIME_MAP_2026-10-14.md)
   - [Contrato Chief/asignación/convocatoria/potencia](HEAD_CHIEF_DISPATCH_CONTRACT.md)
   - [Perfiles y recuperación](SPECIALIST_PROFILES_AND_RAG.md)
   - [Debate y checker terminal](ADVERSARIAL_DEBATE_AND_FINAL_CHECKER.md)
   - [Especificación UI anterior](SPECIALISTS_COMPACT_UI_SPEC.md)
   - [Gates G0–G6](IMPLEMENTATION_GATES_G0_G6.md)
   - [Bloqueos y aprobaciones](BLOCKERS_AND_APPROVALS.md)
   - [Catálogo estructurado de seis áreas](contracts/SIX_AREA_SPECIALIST_CATALOG.v1.json)

ATENCIÓN: esos documentos contienen cortes históricos que dicen «frontend sin cambios», «solo maquetas» o «ninguna opción seleccionada». Son correctos para su momento, NO para el estado presente. Posteriormente se implementó UI local; el propietario rechazó su arquitectura/jerarquía y aprobó replantearla. Tampoco las propuestas viejas de stack/Supabase anulan el addendum aceptado de prototipo local sintético.

## 3. Estado real al dejar el chat

### Runtime y repositorio

- OS local: `http://127.0.0.1:4313/`. Se comprobó HTTP 200 al preparar este handoff; el HTML servido coincide con los nombres de assets indicados abajo. Revalidar al retomar.
- `scripts/local-browser.mjs` sirve `dist/web` en loopback y supervisa Biblioteca/OCR. La gestión del Core local se resuelve en navegador mediante `local-api.ts`/BrowserPersistence/localStorage; no confundirla con un Core HTTP activo en `/api/`.
- Existe además un camino servidor Fastify/Postgres/Supabase, distinto del modo actualmente usado. Su existencia no acredita seguridad/E2E productivo.
- Git: rama nominal `feat/os-core-local`, sin commits, sin HEAD recuperable. Los manifiestos de hashes previos NO son un backup completo.
- Biblioteca: hay ingesta digital/OCR que fue observada en marcha. No reutilizar cantidades antiguas como cifras actuales ni como prueba de cobertura/vigencia jurídica.

### Cambios frontend que SÍ existen

- `apps/web/src/specialist-catalog.ts`: metadatos de seis personas/áreas y 22 subperfiles descriptivos.
- `apps/web/src/SpecialistStudio.tsx`: catálogo interactivo. Un clic solo abre/cierra detalles; NO asigna ni ejecuta especialistas.
- `apps/web/public/agents/{elena,valeria,lucia,martin,diego,camila}.png`: seis bustos humanos 3D con transparencia real. Conservar identidades/estilo.
- `apps/web/src/App.tsx`: tres tarjetas de conteo en Mi día y catálogo en Mi día/Trabajo jurídico. Esta ubicación fue expresamente rechazada por el propietario.
- `apps/web/src/MatterJunta.tsx`: rail de documentos, catálogo completo, responsable humano y espacio de consulta. El catálogo completo permanente también fue rechazado.
- `apps/web/src/styles.css`: jerarquía tipográfica/superficies y responsive de esa implementación; aún insuficientes según las capturas del propietario.
- `apps/web/src/JuntaPanel.tsx`: se retiraron etiquetas visibles deliberadas de modelos/proveedores en la tabla técnica. No asumir que eso certifica toda posible salida futura.
- `local-browser/tests/specialist-catalog.test.ts`: coherencia del catálogo y salida pública sin nombres de motores.
- Último build local: `dist/web/assets/index-FWglu0Dz.js` y `dist/web/assets/index-BqTf4qgQ.css`.

No hay Dashboard separado, Director conversacional, micrófono, asignación IA durable, convocatoria dinámica, override funcional ni debate con réplicas. Los rótulos actuales aún dicen «Junta».

### Orquestación que NO se cambió

- Sigue la cadena fija: documentalista → constructor de contexto → análisis principal → auditor adversarial → checker → revisión humana.
- Política técnica histórica interna: Jev documental; Luna contexto; Sol principal; Gemini auditor obligatorio. El destino propuesto es especialistas sobre Luna, Sol manual por perfil/encargo y Gemini opcional autorizado. No cambiar esta política silenciosamente.
- `MatterJunta.prepare/consult` todavía no envía perfiles seleccionados. Una selección visual no puede presentarse como equipo que ejecuta.
- El checker YA va después del auditor, pero `junta-juridica/src/orchestration/index.ts` le pasa solo `run.analysis`, también al revalidar caché. NO cubre todo el auditor, debate ni documento compuesto/exportado.
- Se reprodujo offline una cita falsa introducida solo por el auditor que escapa del gate agregado. Ver [probe de cobertura](reports/checker-coverage-probe.json).
- La Junta fija/historial debe preservarse. Una ampliación versionada no debe reetiquetar runs antiguos como especialistas.

## 4. Decisiones de producto y correcciones del propietario

### Representación y lenguaje

- Seis grandes áreas aceptadas, con subespecialidades internas, no decenas de avatares.
- Personajes HUMANOS 3D, moderadamente caricaturescos tipo emoji, con materiales/iluminación realistas. NO objetos abstractos, retratos fotográficos, emojis planos ni cajas con «Tributario» como sustituto del personaje.
- NUNCA nombres/versiones de modelos o proveedores en producto: DOM, ARIA, tooltips, errores, configuración jurídica, historial, costos y exports. Identificadores efectivos solo en trazabilidad técnica interna.
- La estética de personajes fue aceptada; la pantalla actual NO es una composición aprobada para reproducir sin cambios.

### Navegación y experiencia aprobadas como dirección general

- Dashboard separado de Mi día. Dashboard orienta decisiones y permite iniciar un encargo; Mi día contiene trabajo personal, no catálogo de agentes.
- Gabriel, «Director jurídico IA», fue propuesto como interlocutor nativo principal. Es coordinación IA, no CEO humano ni profesional matriculado.
- Entrada principal desde Dashboard: avatar 3D flotante contenido + texto y, cuando esté realmente implementada/aprobada, voz.
- El humano plantea el problema; Gabriel aclara alcance y propone titular/equipo con motivos; el humano agrega/quita/confirma; luego vincula/crea un asunto mediante Core y abre el espacio de trabajo.
- El nombre público «Junta» pasa a «Equipo jurídico». Dentro de ese espacio sigue existiendo el escalamiento a Junta completa.
- Mostrar en un asunto solo participantes propuestos/designados. Catálogo de seis bajo «Agregar especialista», no seis retratos permanentes por todo el OS.
- Distinguir participantes humanos/accesos de equipo IA; se propuso «Personas y permisos» para la pestaña actual de integrantes humanos.
- No reemplazar la fricción por un chat decorativo que siga ejecutando otro equipo detrás.

### Jerarquía, KPI, iconos y hover

El propietario describió el estado actual como whitewall: tarjetas planas equivalentes, falta de jerarquía, KPI vacíos de utilidad, navegación con glifos ilegibles y acciones enterradas por formularios/catálogos.

- Conservar sobriedad/compacidad, pero diferenciar acción principal, señales operativas y contenido. No convertir cada bloque en la misma card.
- Azul tinta/fondo mineral/acento latón fueron propuestos; no neón, glassmorphism, blobs, gradientes decorativos ni tarjetas gigantes.
- Reemplazar glifos Unicode de navbar por iconos de una sola biblioteca, tamaño/trazo consistentes y etiquetas de texto. Phosphor fue propuesto, todavía no instalado.
- TODOS los KPI y cards accionables deben tener hover visible y foco de teclado equivalente. Elevación/borde/fondo contenidos, no halos indiscriminados ni apariencia clickeable para texto estático.
- Formularios generales de asunto no deben quedar dominando la pantalla por defecto. El equipo tampoco debe desplazar documentos/pregunta/resultado fuera del área útil.

Cronología importante del hover: hubo un pedido anterior de restaurar iluminación global; se añadió un bloque CSS y luego el propietario pidió DESCARTAR SOLO ESE PEDIDO. Se eliminó ese bloque y se reconstruyó el mismo build previo; NO se deshicieron los seis personajes ni el resto de UI. DESPUÉS, el nuevo pedido explícito «TODOS LOS CARDS KPIS DEBEN TENER HOOVER» estableció el requisito actual. No interpretar el rollback viejo como prohibición permanente de hover.

### KPI propuestos y datos reales

Máximo cuatro indicadores protagonistas: tareas internas atrasadas, pendientes con fecha interna para el resto de hoy, revisiones humanas pendientes y borradores con cambios solicitados. Cada uno abre exactamente los registros que cuenta y declara alcance/período/actualización.

- `Task`: `status`, `kind`, `internal_due_at`, `responsible_identity_id`, `matter_id`.
- `Draft`: `status=CHANGES_REQUESTED`, autor, asunto/versiones.
- `/my-day` devuelve SOLO pendientes personales del actor. No sirve para afirmar carga global del estudio.
- Para KPI del estudio y borradores devueltos hace falta un agregado de lectura con los permisos existentes; no sumar almacenamiento bruto ni ampliar acceso.
- Fecha interna NO es plazo legal. Usar zona del estudio. Carga = «—»; error/incompleto = «No disponible» o cobertura parcial; cero solo con consulta completa exitosa.
- No inventar ingresos, rentabilidad, ahorro, productividad, probabilidad de éxito, agentes activos ni tendencias sin datos.
- «Asuntos sin próxima acción» no se deriva de Matter. El campo servidor histórico `without_next_action` mira tareas personales y no existe igual en el modo local; no usarlo como KPI global sin resolver el agregado correcto.

## 5. Última discusión: especialistas realmente mejores que el generalista

Pregunta del propietario: si todos usan el mismo modelo, ¿qué skills los hacen especialistas de verdad?

Respuesta propuesta: un prompt «sos experto» y un avatar NO bastan. La capacidad está en el paquete que rodea al motor y debe demostrarse, no presumirse.

Cada SUBPERFIL debe tener un paquete versionado y revisado por abogados:

1. Alcance, jurisdicción, temporalidad, exclusiones y condiciones de escalamiento/abstención.
2. Mapa de fuentes autorizadas, política de recuperación, originales localizables y límites de cobertura. Muchas referencias indexadas no acreditan competencia ni vigencia.
3. Procedimiento: preguntas obligatorias, documentos faltantes, problemas típicos, excepciones y argumentos contrarios.
4. Herramientas delimitadas: búsqueda, comparación de versiones, matrices y cálculos determinísticos con reglas/fórmulas aprobadas; solo lectura inicialmente.
5. Contrato de salida: cuestión → hechos/alegaciones/inferencias → evidencia → fuente → conclusión condicionada → alternativa/faltantes.
6. Casos de evaluación, rúbrica jurídica humana, controles negativos, errores críticos y condiciones de habilitación.
7. Presupuesto, permisos, auditoría, versiones y manejo honesto de fallos. Una skill no obtiene permisos ni credenciales por existir.

La base compartida no es otro agente: permisos, confidencialidad, jurisdicción, evidencia, trazabilidad, fuentes pendientes y abstención. Cargar solo los módulos necesarios para el encargo, no todos los textos de todas las áreas en cada llamada.

| Persona / área | Capacidades propuestas |
|---|---|
| Elena / Civil y patrimonial | Matriz de obligaciones/cláusulas; revisión contractual y comparación de versiones; contradicciones, anexos y requisitos pendientes. Familia/sucesiones/etc. requieren paquetes distintos. |
| Valeria / Comercial y empresarial | Estructura de operaciones; facultades/representación; gobierno societario; diligencia documental; dependencias contractuales/societarias. |
| Lucía / Laboral | Cronología de relación; matriz de hechos/documentos/controversias; cálculos aprobados con entradas y faltantes explícitos. |
| Martín / Tributario y aduanero | Obligación–período–operación; temporalidad normativa; conciliación documental; calculadores validados por régimen. |
| Diego / Penal | Elementos/hipótesis/evidencia favorable y contraria; contradicciones; garantías y límites de inferencia. No completar hechos. |
| Camila / Derecho público | Competencia–acto–procedimiento–fundamentación; expediente administrativo; requisitos y vías de revisión sujetas a validación. |

Son capacidades de diseño, NO perfiles ya habilitados ni asesoramiento sobre un caso concreto. Crear seis fichas DRAFT no habilita seis abogados funcionales.

Piloto recomendado: Elena, subperfil contractual. Extraer prestaciones/obligaciones/condiciones/referencias cruzadas; asociar observaciones a cláusulas/documentos; detectar contradicciones y faltantes; recuperar fuentes; entregar matriz problema/respaldo/interpretación/alternativa/información pendiente.

Evaluación propuesta:

- Especialización: mismo motor, documentos, herramientas/evidencia disponibles y presupuesto total; cambia el paquete especializado.
- Sistema completo: comparar las experiencias operativas, declarando diferencias de recuperación, recursos y número de llamadas.
- Casos reservados, separados de desarrollo; revisión jurídica humana preferentemente ciega. Medir problemas detectados, omisiones críticas, fundamentación/citas, abstención, utilidad, costo/latencia.
- No basta que otro LLM puntúe al especialista ni reutilizar casos vistos como holdout nuevo.
- Si no demuestra mejora, corregir o no habilitar. Ningún resultado de test garantiza ausencia futura de errores.

## 6. Junta completa y adversario: no omitir el escalamiento

El propietario preguntó expresamente dónde queda la Junta completa con abogado adversario para casos complicados. No debe desaparecer del recorrido ni quedar escondida como una crítica al final.

Modalidades propuestas dentro de Equipo jurídico:

1. Consulta focal: un titular habilitado.
2. Equipo especializado: titular y áreas justificadas por cuestiones concretas.
3. Junta completa: seis especialistas habilitados cuando haya encargo para cada área; revisión adversarial ofrecida visiblemente y activada con autorización humana.

Amplitud del equipo, profundidad y revisión adversarial son ejes independientes. Complejo no significa automáticamente seis; una consulta focal importante también puede requerir adversario. Si faltan perfiles habilitados, informar la carencia, no convocar personajes decorativos ni sustituir motor silenciosamente.

Santiago es la persona propuesta para revisión adversarial, fuera del conteo de seis; Gabriel coordina, fuera de esas áreas. Checker es control determinístico, no otro abogado.

Protocolo propuesto:

1. Gabriel delimita y propone modalidad, equipo, encargos, fuentes y presupuesto; humano confirma/modifica.
2. Preparar evidencia común autorizada y snapshots. Opiniones iniciales independientes, cada una con pregunta propia; no copiar conclusiones del compañero.
3. Santiago recibe opiniones y evidencia, no solo síntesis. Formula objeciones atribuidas sobre supuestos, respaldo, alternativas y contradicciones.
4. Especialistas cuestionados replican; pueden corregir o sostener disenso fundamentado.
5. El TITULAR integra, conserva autorías/disensos y cuestiones abiertas. Gabriel no dicta mérito ni decide quién gana.
6. Cerrar generación y congelar versión final/anexos/render que se mostrarán y exportarán.
7. Checker FINAL sobre todos los outputs y referencias: titular, consultores, adversario, réplicas, integración, anexos, texto visible/exportado; también coordinación/contexto/entrada reproducida si incorpora referencias visibles.
8. Abogado humano revisa y decide. Guardar, aprobar un escrito y presentar/entregar siguen siendo acciones distintas.

Inicio propuesto: una ronda de objeciones + una réplica por destinatario + integración. Más rondas requieren plan/reserva/autorización. No bucle hasta unanimidad ni consenso ficticio. Preservar parciales, fallos y costo conocido/incierto.

La misma base puede producir errores correlacionados; acuerdo de seis no equivale a evidencia. Otro proveedor/configuración del adversario tampoco garantiza independencia. Checker comprueba identidad/procedencia/literalidad dentro de cobertura declarada, no verdad jurídica, pertinencia o vigencia por el mero cotejo. Cualquier generación/edición posterior obliga a controlar la nueva versión.

Acciones de UX propuestas: «Confirmar equipo», «Modificar», «Convocar Junta completa». Mostrar encargos, aportes, objeciones, réplicas y pendientes, no solo retratos. Confirmar equipo no dispara análisis ni gasto ocultos.

## 7. Contradicciones a reconciliar en el ADR antes de tocar motor

- El contrato Chief anterior exige `matter_id` y prohíbe crear asuntos; el nuevo ingreso desde Dashboard ocurre antes de elegir uno. Proponer borrador de ingreso previo y elección/creación HUMANA mediante Core; luego formalizar plan/asignación ligados al asunto. No otro registro paralelo de expedientes.
- P02 anterior propone Chief por reglas sin llamada LLM. El nuevo Director conversacional generativo requiere ampliación explícita de alcance, límites, datos, herramientas y presupuesto. No simular conversación inteligente ni hacer llamadas ocultas.
- Si la conversación generativa cuesta, también debe tener autorización informada y techo. Seleccionar personajes, abrir Dashboard o dictar no autoriza una inferencia. La aprobación del equipo no equivale automáticamente a aprobar análisis.
- USD 0,60 es el techo de la Junta fija histórica, NO tarifa universal de N especialistas ni consentimiento reutilizable para un plan nuevo.
- Modificar participantes/evidencia/profundidad cambia plan/hash y estimación; consentimiento anterior no se hereda silenciosamente. Presupuesto central agregado, no límite multiplicado por persona.
- La mejora de potencia es manual por perfil y encargo; sin fallback ni upgrade global. El personaje público no cambia y no revela motor.
- Cada salida tiene autor/versión/snapshot. No escribir textos después del checker conservando estado «comprobado» anterior.
- Mantener lectura/historial legacy; definir reversión sin borrar datos ni volver a ejecutar automáticamente.

## 8. Voz

Todavía no implementada. Debe incluir acción explícita de micrófono, indicador de grabación, detener/cancelar, transcripción editable confirmada antes de enviar y alternativa completa por texto.

Definir compatibilidad con el navegador real del propietario (sus capturas son de Firefox), dónde se procesa audio, terceros, retención/borrado, límites y costos. No presumir reconocimiento local ni universal. Permiso de micrófono no autoriza transmitir datos confidenciales ni sustituye permisos del asunto.

## 9. Evidencia visual y validaciones disponibles

Capturas aportadas por el propietario, copiadas desde Temp a rutas persistentes para este handoff:

- [01 — Mi día dominado por catálogo](reports/user-review/01-mi-dia.png)
- [02 — Formulario/asunto/catálogo y falta de jerarquía](reports/user-review/02-asunto-equipo.png)
- [03 — Consulta y controles](reports/user-review/03-consulta.png)

Referencias de personajes:

- [Referencia v3 aceptada por el propietario](concepts/emoji-option-01-v3.png)
- [Adaptación conceptual a seis áreas](concepts/six-area-selected-v4.png)

La primera referencia también estaba en `C:/Users/User/.codex/generated_images/01a13ce7-2a11-7821-a262-8ffa3909d493/exec-f8de9126-bee1-44d4-87eb-db0d4094d8ee.png`. El prefijo `/C:/...` que apareció en adjuntos es inválido en Windows; usar la copia estable del proyecto.

Capturas del asistente en `reports/implemented-*` y `reports/hover-request-rollback.png` acreditan estados observados, no aprobación visual del usuario. No sustituir sus capturas/rechazo por un PASS inventado.

Últimas validaciones ejecutadas durante la implementación local: `npm.cmd run os:typecheck` exit 0; `npm.cmd run os:test:local` 36/36, 15 archivos; `npm.cmd run os:build:web` exit 0. Se comprobaron apertura/cierre de perfiles, acceso de teclado y lectura del resultado histórico, sin nueva consulta paga. No equivalen a pruebas de especialistas/Director/voz/Junta dinámica ni a E2E productivo.

No existe `design-qa.md` en raíz al preparar este handoff. No declarar finalizado/pasado un QA de rediseño que todavía no se hizo. Los reportes viejos `preservation.json`/`final-delivery.json` son anteriores a cambios TSX/CSS y no acreditan hoy que esos archivos sigan intactos.

## 10. Próxima tarea recomendada para el otro chat

NO empezar generando otra pantalla ni editando App por intuición.

1. Leer fuentes/handoff y verificar diferencias con código real. Resumir brevemente implementado vs propuesto, sin pedir al propietario que repita todo.
2. Preparar fichas concretas de capacidades/skills para los seis, por SUBPERFIL: fuentes, procedimientos, herramientas, contratos de salida, límites y evaluación. Priorizar piloto contractual; demás perfiles DRAFT.
3. Completar la propuesta de ADR con Director conversacional/preasunto, modalidades de equipo, Junta completa, revisión adversarial transversal y gate final completo. Registrar contradicciones y decisiones pendientes, sin improvisar habilitaciones.
4. Presentar esos contratos/criterios para aprobación. Después continuar el diseño aprobado de Dashboard/Mi día/Equipo jurídico con tres pantallas conectadas y sus estados; no más avatares sin función.
5. Solo tras aprobar ADR funcional: un especialista contractual real dentro de un asunto sintético; luego dos perfiles; luego debate/Junta ampliada y potencia manual. No activar seis porque tienen ficha o avatar.

DONE de diseño: contratos y fuentes evaluables, scopes/permisos/costo explícitos, etapas y roles comprensibles, estados de UI honestos y bloqueos registrados.

DONE funcional futuro: la selección modifica el plan ejecutado y persiste tras recarga; cada participante tiene encargo/aporte/estado; sin gasto oculto; disensos preservados; checker del artefacto exacto incluye al adversario; edición/exportación no hereda control inválido; revisión humana independiente; regresiones Core/Biblioteca/legacy conservadas.

## 11. Fuentes técnicas externas consultadas, no certificaciones jurídicas

- [Agent Skills: instrucciones, recursos y procedimientos](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).
- [Patrones de coordinación y evaluación](https://www.anthropic.com/engineering/building-effective-agents).
- [Scaling Agent Systems, revisión v3](https://arxiv.org/abs/2512.08296): más agentes no garantiza mejora; no es un benchmark jurídico de este OS.
- [Reconocimiento de voz: compatibilidad y procesamiento](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
- [Phosphor React](https://github.com/phosphor-icons/react), propuesta de iconografía, no dependencia instalada.

## Mensaje breve para iniciar el otro chat

Leé íntegramente `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/docs/specialist-studio/HANDOFF_NEXT_CHAT_2026-10-14.md` y el handoff original que referencia. Retomá primero la definición de skills evaluables para los especialistas y la reconciliación del ADR con Director jurídico, Junta completa y debate adversarial. No reconstruyas el OS ni cambies orquestación, ejecutes inferencias pagas o despliegues sin aprobación. Distinguí estado real, propuestas y decisiones aceptadas; el diseño de Dashboard/Mi día/Equipo jurídico debe conservar las restricciones y correcciones más recientes del propietario.
