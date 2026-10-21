# CODEX — LAW & ORDER OS
## FASE 2 — VALIDACIÓN REAL DE JUNTA + INICIO DEL OS CORE

**Modo:** Implementación continua, auditoría factual y QA E2E.

**Directorio del proyecto:**

`C:\Users\User\Desktop\PORYECTOS\LAW & ORDER OS`

**Regla fundamental: continuar desde el estado REAL existente. No reconstruir el motor, no reiniciar el proyecto y no reemplazar decisiones anteriores silenciosamente.**

---

# 0. CONTEXTO Y FUENTES DE VERDAD

Estamos construyendo LAW & ORDER OS, un sistema operativo integral para estudios jurídicos de Paraguay.

El producto debe manejar clientes, abogados, asuntos, expedientes, documentos, tareas, agenda, escritos, revisiones, comunicaciones, honorarios, gastos y cobros.

La Junta Jurídica es una capacidad central dentro del OS, pero no constituye el producto completo.

## Arquitectura de Junta aprobada

**JEV → LUNA → SOL 6.1 MEDIUM → GEMINI → CHECKER DETERMINÍSTICO → ABOGADO HUMANO**

Funciones:

- **Jev:** selección y clasificación de evidencia.
- **Luna:** estructuración del contexto jurídico.
- **Sol 6.1 Medium:** análisis jurídico principal de una cuestión delimitada.
- **Gemini:** auditoría adversarial del análisis y de las referencias.
- **Checker determinístico:** autenticidad bibliográfica de las referencias y comprobación de citas textuales.
- **Abogado humano:** evaluación y decisión jurídica final.

NO utilizaremos Haiku en esta fase.

NO clonaremos Mussi Online.

NO volveremos a la topología clínica 3→2→1.

El Blueprint V1.1 contiene esa arquitectura histórica, pero fue reemplazada mediante la decisión posterior y el ADR-001 de la Junta Jurídica V2.

## Fuente de verdad y precedencia

1. Decisiones expresas posteriores aprobadas para LAW & ORDER OS.
2. ADR-001 y contratos efectivos de Junta V2, reconciliados con esas decisiones.
3. Código local actual: evidencia de lo implementado.
4. Blueprint y Roadmap V1.1: autoridad para el objetivo y módulos del OS que no hayan sido reemplazados.
5. Informes de implementación, auditoría y remediación: evidencia histórica, no sustitutos del código.

No confundir decisiones aprobadas con implementaciones verificadas.

Antes de modificar código, leer:

- `IMPLEMENTATION_REPORT.md`
- `AUDIT_REMEDIATION.md`
- `TEST_RESULTS.md`
- `KNOWN_LIMITATIONS.md`
- `MODEL_CONNECTIVITY.md`
- `NEXT_STEPS.md`
- `junta-juridica/docs/ADR_JUNTA_JURIDICA_V2.md`, o el ADR existente equivalente
- Blueprint, Roadmap y handoff vigentes, donde estén disponibles.

Si alguno falta, buscar en el proyecto y documentar la ausencia. No asumir que existe ni inventar su contenido.

---

# 1. ESTADO REPORTADO DE LA IMPLEMENTACIÓN

Fase 1 construyó un prototipo modular offline.

Posteriormente se realizó una auditoría independiente con los siguientes hallazgos:

- J-001: extracción incompleta de referencias.
- J-002: confianza indebida en procedencia autodeclarada.
- J-003: elección incorrecta de versiones por orden de carga.
- J-004: límite fijo de 100K tokens para Gemini.
- J-005: integración real todavía no ejecutada.

Codex reportó las siguientes remediaciones:

**J-001:** extractor ampliado y bloqueo cuando hay referencias pendientes.

**J-002:** atestaciones Ed25519, con registro de confianza externo.

**J-003:** publicación explícita de versión vigente.

**J-004:** límites configurables sin truncamiento silencioso.

**J-005:** permanece bloqueado por dependencias reales.

Resultados reportados:

- 173/173 tests PASS.
- Typecheck PASS.
- Build PASS.
- Smoke offline PASS.
- Benchmark bibliográfico V2: primera evaluación 23/24.
- Regresión posterior: 24/24.
- USD 0 de inferencia consumida.

Estos datos son reportes anteriores y deben comprobarse contra el código local vigente.

No interpretar 24/24 después del ajuste como un nuevo holdout independiente.

---

# 2. GOBERNANZA DEL DESARROLLO

Antes de cualquier modificación:

1. Inspeccionar árbol, Git, dependencias, código y tests.
2. Registrar el SHA actual si existe repositorio.
3. Si existe Git, crear una rama de trabajo aislada desde el estado correcto.
4. No modificar `main` directamente.
5. No ejecutar migraciones de producción.
6. No hacer push ni deploy.
7. No modificar Mussi Online ni otros proyectos.
8. No sobrescribir documentos históricos.

Si todavía no existe un repositorio Git, documentarlo. Se permite inicializar control de versiones local después de preservar el baseline; no crear un remoto arbitrario.

**Mantener separados dos frentes de trabajo:**

- Frente A: Junta, corpus, checker e integración IA.
- Frente B: núcleo operativo del OS.

Si existen agentes o worktrees adecuados, pueden ejecutarse en paralelo. Si no, trabajar secuencialmente manteniendo cambios y reportes separados.

No ejecutar dos procesos modificando simultáneamente los mismos archivos.

---

# 3. FRENTE A — AUDITORÍA DE LA REMEDIACIÓN

## Objetivo

Confirmar que las correcciones J-001 a J-004 funcionan realmente.

No basta con leer el informe.

### Verificar J-001

Ejecutar tests nuevos y pruebas adversariales adicionales de extracción de referencias.

Incluir abreviaturas, números de resolución, salas, tribunal, fecha, citas dentro de texto libre y variantes de redacción.

La extracción debe conservar:

- Texto original.
- Posición de la referencia.
- Tipo de fuente probable.
- Campos identificables.
- Estado de extracción.
- Marcadores no resueltos.

Una cita no identificada no puede pasar silenciosamente como comprobada.

No modificar el holdout ya evaluado para mejorar su puntuación.

### Verificar J-002

Auditar:

- Firmas Ed25519.
- Trust registry.
- Procedencia del original.
- Verificador autorizado.
- Hash documental.
- Revalidación de caché.
- Rechazo de datos autodeclarados.
- Separación de fixtures y originales auténticos.

Comprobar que una firma válida de un emisor no autorizado NO permite etiquetar un documento como oficial.

Una atestación local no equivale automáticamente a una firma emitida por el Poder Judicial.

El host deberá mantener y proteger la política de confianza.

### Verificar J-003

Probar:

- Versiones ingresadas fuera de orden.
- Dos versiones candidatas sin publicación.
- Versión vigente publicada.
- Referencias históricas.
- Cambios posteriores.
- Aislamiento entre estudios.

No inferir versión actual por orden de inserción.

### Verificar J-004

Confirmar que Gemini:

- Tiene límites configurables.
- Respeta el modelo y su ventana real.
- No trunca silenciosamente evidencia.
- Informa cuándo una entrada excede el presupuesto.
- Conserva manifiesto de cobertura.
- No continúa con auditoría parcial marcada como completa.

**GATE A1:** typecheck, build, pruebas y smoke offline aprobados; hallazgos documentados individualmente con PASS/FAIL/BLOCKED.

No declarar cierre de seguridad únicamente por el número total de tests.

---

# 4. FRENTE A — CORPUS JURÍDICO PARAGUAYO INICIAL

## Objetivo

Construir un corpus pequeño, auténtico y reproducible para probar el checker con jurisprudencia real.

### Alcance inicial

Obtener al menos una resolución auténtica de cada categoría:

1. Sala Constitucional.
2. Sala Civil y Comercial.
3. Sala Penal.

Priorizar los documentos previamente identificados en la investigación F1, siempre que su fuente, identidad y condiciones de acceso puedan comprobarse.

Repositorios estatales candidatos ya identificados:

- Corte Suprema de Justicia.
- Instituto de Investigaciones Jurídicas.
- Digesto Legislativo.
- Congreso Nacional.
- Gaceta Oficial.

No inventar endpoints.

No asumir que un portal público dispone de API.

No evadir bloqueos, autenticación, CAPTCHA ni restricciones de acceso.

### Registro obligatorio por documento

Cada original incorporado debe conservar:

`source_document_id`

`source_institution`

`source_url`

`retrieved_at`

`original_sha256`

`file_mime_type`

`document_type`

`court`

`chamber`

`resolution_number`

`resolution_date`

`document_version`

`extraction_status`

`verification_status`

`provenance_evidence`

`reuse_rights_status`

`page_count`

### Reglas

Conservar los bytes originales.

No reemplazar PDFs originales con resúmenes de IA.

No tratar texto OCR como si fuese una copia perfecta.

Registrar metadatos discordantes en vez de corregirlos silenciosamente.

No usar compilaciones editoriales restringidas sin permisos.

Si una descarga falla, registrar la causa y continuar con otras fuentes autorizadas.

Si faltan permisos para persistir o indexar determinado contenido, no incorporarlo al corpus productivo.

### Entregables

- Manifiesto del corpus.
- Originales autorizados.
- Hashes.
- Metadatos normalizados.
- Estado de procedencia.
- Estado de extracción.
- Evidencia de restricciones y cobertura.
- Pruebas de identidad bibliográfica.

**GATE A2:** por lo menos una resolución de cada sala con identidad y original comprobados, o `BLOCKED` específico y documentado.

No sustituir documentos faltantes por PDFs ficticios presentados como oficiales.

---

# 5. FRENTE A — BENCHMARK ADVERSARIAL INDEPENDIENTE

Construir un nuevo conjunto de evaluación que NO reutilice como holdout independiente los casos ya observados durante la remediación.

Si no existen suficientes referencias auténticas, dejar el benchmark bloqueado; no fabricar una muestra supuestamente real.

### Casos obligatorios

- Sentencia auténtica con identidad correcta.
- Sentencia inexistente.
- Número verdadero atribuido a tribunal equivocado.
- Fecha incorrecta.
- Sala incorrecta.
- Resolución real con cita literal inventada.
- Referencia abreviada.
- Referencia ambigua.
- Documento con extracción defectuosa.
- Fuente temporalmente inaccesible.
- Referencia incluida solamente en texto libre.
- Documento privado que menciona jurisprudencia ficticia.

Medir separadamente:

`citation_detection_recall`

`citation_resolution_accuracy`

`false_verified_count`

`authentic_citations_unresolved`

`ambiguous_citations`

`unknown_citation_markers`

`source_provenance_failures`

`quote_mismatch_detection`

No convertir `NOT_FOUND_IN_SCOPE` en inexistencia universal.

**Condición crítica:** ninguna referencia falsa del conjunto evaluado debe recibir estado `VERIFIED`.

Registrar cobertura de extracción y errores, no solamente el resultado de citas que llegaron al checker.

Publicar el conjunto evaluado, sus hashes y resultados reproducibles.

---

# 6. FRENTE A — CONECTIVIDAD DE MODELOS

## Modelos

- Jev 1.13.
- GPT-6 Luna.
- GPT-6.1 Sol con `reasoning_effort=medium`.
- Gemini 3.8 Flash como auditor.

Usar los identificadores API realmente disponibles, no asumir que el nombre comercial coincide con el model ID.

### Paso 1: inspección local

Inspeccionar adapters existentes.

Comprobar contratos, gestión de errores, parámetros, límites de contexto, estructuras de respuesta y consumo reportado.

### Paso 2: credenciales

Leer configuración de forma segura desde variables de entorno.

No imprimir claves.

No copiar credenciales al repositorio.

No enviar claves al chat.

No incorporar secretos a fixtures, logs o artefactos.

Si faltan claves, registrar `BLOCKED` por proveedor y continuar.

### Paso 3: comprobación no generativa

Cuando exista autorización y configuración, utilizar endpoints oficiales de listado o metadatos que no generen inferencia ni impliquen consumo facturable.

Comprobar:

- Modelo disponible.
- Endpoint soportado.
- Formato de salida.
- Configuración de razonamiento.
- Ventana de contexto.
- Disponibilidad del proveedor.

No asumir que tener una API key confirma acceso a todos los modelos.

Si el endpoint genera costo o no está claramente documentado, no ejecutarlo sin autorización.

### Paso 4: preparación del smoke real

Preparar exactamente un escenario acotado con:

- Expediente de prueba sin datos confidenciales.
- Una cuestión jurídica.
- Evidence Pack congelado.
- Modelos configurados.
- Presupuesto por etapa.
- Presupuesto total.
- Timeout.
- Límite de reintentos.
- Registro de tokens y gastos.
- Checker conectado al corpus autorizado.

**IMPORTANTE: NO EJECUTAR INFERENCIAS PAGAS TODAVÍA.**

Dejar un comando explícito para ejecutarlas posteriormente con autorización del usuario.

No utilizar pruebas de conectividad simuladas como prueba de inferencia real.

**GATE A3:** adapters preparados, preflight documentado y presupuesto verificable. La ejecución paga permanece `NOT_RUN` hasta aprobación.

---

# 7. FRENTE B — INICIO DEL OS CORE

El objetivo es comenzar la aplicación real de gestión del estudio, independientemente de que la Junta todavía no esté operativa con modelos reales.

## Antes de escribir código del OS

Inspeccionar si el proyecto ya tiene stack de aplicación, backend, base de datos y autenticación.

Reconciliar con el Blueprint y Roadmap.

Si no existe una decisión de stack, persistencia o autenticación autorizada, NO fijar silenciosamente una arquitectura productiva definitiva.

Preparar ADR de la decisión pendiente, alternativas y contratos del primer vertical slice.

Se permite desarrollar componentes aislados reutilizables con el TypeScript existente. No presentar almacenamiento local, mocks de identidad ni permisos simulados como solución empresarial final.

## Primer alcance funcional

### Estudios jurídicos

Entidad `law_firms` o equivalente.

Cada estudio debe ser una frontera de acceso independiente.

### Usuarios y membresías

Un usuario puede pertenecer a uno o varios estudios únicamente mediante membresía explícita.

Distinguir:

- Identidad del usuario.
- Membresía del estudio.
- Rol en el estudio.
- Participación y permisos en un asunto.

### Roles iniciales propuestos

- Administrador del estudio.
- Socio/coordinador.
- Abogado.
- Asistente/procurador.
- Administración.

Los permisos definitivos deben conciliarse con el blueprint.

No implementar autorización únicamente ocultando botones.

### Clientes

Registrar personas físicas y jurídicas.

Separar cliente, contacto y partes relacionadas al asunto.

### Asuntos

Cada asunto debe contener:

- Estudio propietario.
- Cliente.
- Tipo y materia.
- Abogado responsable.
- Participantes autorizados.
- Estado.
- Fechas.
- Documentos.
- Tareas.
- Historial de actividad.

No asumir que todo asunto es un expediente judicial.

### Documentos

Originales inmutables.

Versiones explícitas.

Permisos por estudio y asunto.

Registro de incorporación y modificación.

No generar un nuevo documento sobrescribiendo el original.

### Tareas

Responsable, asunto, estado, vencimiento interno y actividad.

No calcular plazos procesales jurídicos mediante una LLM en esta fase.

---

# 8. PRIMER E2E DEL OS

Diseñar y, donde las decisiones de infraestructura estén resueltas, implementar un flujo persistente:

1. Administrador crea un estudio.
2. Incorpora un segundo abogado.
3. Abre un cliente.
4. Crea un asunto.
5. Asigna responsable.
6. Incorpora un documento.
7. Crea una tarea.
8. El abogado asignado consulta el asunto.
9. Otro usuario sin permiso intenta acceder.
10. El acceso no autorizado es rechazado.
11. El abogado prepara un borrador documental.
12. El revisor recibe una tarea de revisión.
13. El borrador cambia a aprobado mediante acción explícita.
14. La aprobación queda registrada.

No simular una presentación judicial real.

No afirmar que un archivo fue presentado por el hecho de descargarlo.

No usar datos productivos de clientes para el E2E.

### Criterios de seguridad

El usuario de otro estudio no debe poder leer documentos, tareas o asuntos ajenos aunque conozca el ID.

Los permisos deben aplicarse en la capa de datos o servicio confiable, no solo en el frontend.

Los logs no deben contener documentos confidenciales.

### Persistencia

Los cambios deben sobrevivir a la recarga y a una nueva sesión en el ambiente de desarrollo.

Si no hay stack de persistencia aprobado, realizar primero especificación de esquema, políticas y contratos, dejando la implementación persistente como `BLOCKED`, en vez de inventar arquitectura.

**GATE B1:** primer flujo operativo real, probado con usuarios y permisos efectivos, o contrato completo documentado y bloqueo de infraestructura explícito.

---

# 9. DOCUMENTACIÓN Y ROADMAP

Actualizar documentación sin borrar archivos históricos.

Crear un nuevo addendum o versión de Blueprint/Roadmap que refleje:

- Junta Jurídica propia.
- Jev, Luna, Sol Medium y Gemini.
- Checker separado.
- Estado real offline.
- Remediaciones verificadas o pendientes.
- Corpus oficial.
- Integración real todavía pendiente.
- Inicio del OS Core.
- Gate comercial y técnico antes de producción.

No presentar Fase 1 como certificada solamente por una suite sintética.

No marcar como implementado lo que sea un diseño.

Distinguir permanentemente:

`IMPLEMENTED`

`TESTED_OFFLINE`

`VERIFIED_REAL`

`BLOCKED`

`NOT_RUN`

---

# 10. EJECUCIÓN CONTINUA — DO NOT STOP

Realizar los trabajos de forma continua hasta completar todos los que no dependan de autorizaciones o decisiones bloqueantes.

No detenerse después de cada archivo o test para pedir confirmación ordinaria.

Registrar fallas y seguir con módulos independientes.

No solucionar un FAIL alterando silenciosamente el criterio de aceptación.

No cambiar el modelo de IA sin autorización.

No convertir mocks en arquitectura definitiva.

No ejecutar gastos, despliegues o operaciones externas irreversibles sin aprobación.

Cuando una decisión de arquitectura productiva todavía no esté establecida, documentar el bloqueo y continuar con otras tareas verificables.

---

# 11. ENTREGABLES OBLIGATORIOS

Actualizar o crear:

`PHASE2_IMPLEMENTATION_REPORT.md`

`PHASE2_TEST_RESULTS.md`

`PHASE2_SECURITY_REVIEW.md`

`OFFICIAL_CORPUS_MANIFEST.json`

`BIBLIOGRAPHIC_BENCHMARK_REPORT.md`

`MODEL_CONNECTIVITY_REPORT.md`

`LIVE_SMOKE_PLAN.md`

`OS_CORE_ARCHITECTURE.md`

`OS_CORE_E2E_REPORT.md`

`BLUEPRINT_ROADMAP_RECONCILIATION.md`

`PHASE2_BLOCKERS.md`

`NEXT_STEPS.md`

Cada documento debe indicar estado real y evidencia reproducible.

Al finalizar informar:

- Rama y SHA inicial/final, si existe Git.
- Archivos creados y modificados.
- Tests ejecutados.
- PASS / FAIL / BLOCKED / NOT_RUN.
- Documentos estatales realmente recuperados.
- Modelos realmente identificados.
- Costos realmente incurridos.
- Bloqueos externos.
- Decisiones pendientes.
- Siguiente paso exacto.

## DEFINICIÓN DE DONE

Esta fase queda completada en su alcance preparatorio cuando:

1. J-001 a J-004 están verificados o sus regresiones quedan documentadas.
2. El corpus inicial tiene originales auténticos comprobados o bloqueos identificados.
3. Existe una evaluación bibliográfica independiente reproducible, o queda explícitamente bloqueada por falta de material.
4. Los proveedores están preparados para conectividad real y no se fabrican estados de conexión.
5. Existe un smoke real listo para autorización, pero no ejecutado.
6. El OS Core tiene contratos y primera implementación compatible con decisiones de infraestructura verificadas.
7. Los permisos multiestudio se prueban donde haya implementación real.
8. El roadmap refleja la realidad y los cambios arquitectónicos aprobados.
9. No se hicieron llamadas pagas ni deploys.
10. Se entregó un handoff completo, con todas las fallas y pendientes.

**Comenzar ahora auditando la carpeta y conciliando la documentación. Después avanzar por ambos frentes hasta los gates que no requieren nuevas autorizaciones.**