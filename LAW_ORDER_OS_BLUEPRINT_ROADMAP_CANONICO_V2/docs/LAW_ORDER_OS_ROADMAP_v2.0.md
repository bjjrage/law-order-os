# LAW & ORDER OS
## ROADMAP MAESTRO · V2.0

**13 de octubre de 2026 · 11 fases F0–F10 · OS completo, no motor IA aislado**

**Estado:** roadmap reconciliado con el informe Fase 2; no se han aprobado infraestructura productiva, tiempos, costos fijos ni piloto. Los estados “PASS reportado” no sustituyen evidencias replicadas.

> **Cambio respecto de v1.1:** se elimina la dependencia de clonar Mussi. Junta propia Jev/Luna/Sol Medium/Gemini/checker. El OS Core offline ya existe como servicio, no como aplicación web real. Prioridad siguiente: ADR OS-001 y una aplicación compacta persistente, en paralelo a cerrar procedencia/corpus y primer smoke IA.

### Semáforo del proyecto

| Frente | Realidad al 13/10 | Riesgo |
|---|---|---|
| Junta V2 | 271 tests integrados PASS **reportados**; 11/12 extracciones; no ejecución real | Modelo/corpus/credenciales |
| Fuentes estatales | 3 PDFs preservados, no corpus completo; autenticación real bloqueada | Verificador oficial y derechos |
| OS Core | Servicios y pruebas sintéticas; no app productiva | ADR OS-001, auth y BD |
| UI | Requisito obligatorio desktop-first compacta | Sin implementación reportada |
| Gobierno | Sin Git; blueprint y roadmap no estaban en carpeta | Instalar documentación y versionado |

**Trabajo en paralelo:** F0→F1→F2→F3→F4→F7 y F0→F5→F6→F7; F8 puede empezar tras F3/F4; convergencia en F9. Ninguna rama de trabajo asume desplegar o gastar sin permiso. El primer paso no es “más tests sintéticos” indefinidamente: cerrar decisiones productivas y comenzar la app real mientras se cierran fuentes y proveedores.

### Estados para gestionar avance

- `REPORTED_PASS`: dicho por Codex, no repetido independientemente.
- `TESTED_OFFLINE`: comportamiento probado con fixtures/no red.
- `BLOCKED`: dependencia necesaria sin resolver.
- `NOT_STARTED`: sin implementación acreditada.
- `VERIFIED_REAL`: original obtenido o acción externa realmente verificada, **limitado al hecho verificado**.
- `DONE`: criterio de aceptación cerrado con evidencia auditada.

Los checks interactivos de este roadmap son **notas de seguimiento locales** en el navegador, no estado certificado ni conexión automática a Git o a Codex.

## F0 — Gobernanza y documentación canónica

**Estado reportado:** EN RECONCILIACIÓN  
**Dependencias:** —

### Tareas verificables

- [ ] **F0-T01** — Instalar blueprint, roadmap, ADR y dossier F1 en `docs/` sin borrar fuentes previas.
- [ ] **F0-T02** — Registrar decisión de Junta propia y mapa de reemplazo 3→2→1 / Mussi sin arrastrar código.
- [ ] **F0-T03** — Inspeccionar repositorio y estado local (sin Git reportado) antes de crear tareas.
- [ ] **F0-T04** — Aprobar/ajustar responsables y estudio piloto para flujos jurídicos reales.
- [ ] **F0-T05** — Conservar los reportes F1/F2 y hashes históricos como evidencia inmutable.
- [ ] **F0-T06** — Registrar decisiones pendientes, bloqueos y no negociables con dueño y fecha de cierre.

### Gate DONE

Docs versionados en carpeta de Codex; ADR explícito de cambios y lectura confirmada; no arquitectura inferida.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F1 — ADR OS-001 y plataforma productiva

**Estado reportado:** BLOCKED / DECISIÓN ABIERTA  
**Dependencias:** F0

### Tareas verificables

- [ ] **F1-T01** — Leer el `OS_CORE_ARCHITECTURE.md` real y comparar alternativas documentadas.
- [ ] **F1-T02** — Proponer y aprobar framework web, API/backend, PostgreSQL, auth, storage, jobs y región.
- [ ] **F1-T03** — Definir entornos dev/preview/prod, secrets, auditoría y responsabilidades de deploy.
- [ ] **F1-T04** — Definir frontera tenant y autorización por asunto en API/BD/storage/jobs.
- [ ] **F1-T05** — Crear Git local y estrategia de rama protegida tras preservar baseline; remoto solo con autorización.
- [ ] **F1-T06** — Definir restauración, backup, logs seguros y plan mínimo de operación.
- [ ] **F1-T07** — Crear ADR aprobado y contratos API/datos compatibles con OS Core offline.

### Gate DONE

ADR OS-001 explícitamente aprobado; decisiones técnicas registradas y pruebas básicas de infra; nada productivo por defecto.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F2 — App web compacta y acceso multiestudio

**Estado reportado:** NO INICIADO  
**Dependencias:** F1

### Tareas verificables

- [ ] **F2-T01** — Implementar shell web navegable y autenticación real en dev.
- [ ] **F2-T02** — Implementar estudio, membresías y selector/contexto; denegación por defecto.
- [ ] **F2-T03** — Crear sidebar compacta y topbar 42–48px, tipografía 12.5–13.5px, tablas densas.
- [ ] **F2-T04** — Crear panel «Mi día» para abogado, rol coordinador y administración con datos reales.
- [ ] **F2-T05** — QA negativo multiestudio, RLS/servidor, sesión/revocación y controles de storage.
- [ ] **F2-T06** — Capturas desktop 1440×900 y 1366×768 al 100%; comparación visual 85% sin CSS zoom.
- [ ] **F2-T07** — Definir navegación teclado, focus visible y estados loading/empty/error.

### Gate DONE

App real, persistente y protegida; capturas confirman densidad y jerarquía; E2E de login y permisos.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F3 — Clientes, asuntos, tareas y actividad

**Estado reportado:** SERVICIO OFFLINE IMPLEMENTADO / WEB PENDIENTE  
**Dependencias:** F2

### Tareas verificables

- [ ] **F3-T01** — Reutilizar contrato de dominio OS Core ya probado offline; auditar cambios del servicio.
- [ ] **F3-T02** — Persistir cliente/contacto/parte/estudio sin cruzar tenants.
- [ ] **F3-T03** — Crear asunto consultivo y asunto litigioso con responsables, participantes y estado.
- [ ] **F3-T04** — Implementar tareas y actividad auditada con asignación y vencimiento interno.
- [ ] **F3-T05** — Implementar vistas compactas de clientes/asuntos/tareas y filtros útiles.
- [ ] **F3-T06** — Verificar E2E permisos y persistencia tras recarga, con dos estudios y dos abogados.
- [ ] **F3-T07** — No confundir asunto con procedimiento judicial ni calcular plazos por LLM.

### Gate DONE

E2E crear estudio→cliente→asunto→tarea→actividad, con datos durables y denegación de acceso ajeno.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F4 — Documentos, versiones, revisión y aprobación

**Estado reportado:** SERVICIO OFFLINE IMPLEMENTADO / WEB PENDIENTE  
**Dependencias:** F3

### Tareas verificables

- [ ] **F4-T01** — Subir originales sin sobrescritura; hash, extracción, versiones explícitas y permisos.
- [ ] **F4-T02** — Relacionar documentos con asunto y responsables; registros inmutables de aprobación.
- [ ] **F4-T03** — Implementar editor/borrador con versión y revisión interna, sin IA de producción.
- [ ] **F4-T04** — Probar cambios de versión y prohibir aprobación implícita de una versión nueva.
- [ ] **F4-T05** — Diferenciar draft, revisión, aprobación, entrega y presentación con comprobante real.
- [ ] **F4-T06** — QA acceso privado y descargas/exports; E2E del ciclo documental.
- [ ] **F4-T07** — Construir índice de expediente y anexos reproducibles sin alterar originales.

### Gate DONE

E2E documental completo con permisos reales y aprobación de versión exacta.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F5 — Corpus estatal, procedencia y RAG real

**Estado reportado:** 3 PDFS RECUPERADOS / AUTH BLOQUEADA  
**Dependencias:** F0, en paralelo con F2–F4

### Tareas verificables

- [ ] **F5-T01** — Conservar y verificar los tres originales de Constitucional/Civil/Penal y sus hashes.
- [ ] **F5-T02** — Definir política de atestaciones institucionales autorizadas y registro confiable.
- [ ] **F5-T03** — Acordar permisos de ingestión/indexación comercial, alcance de portales y versión normativa.
- [ ] **F5-T04** — Cerrar OCR/QA de escaneos y anomalías de encabezados con revisión humana.
- [ ] **F5-T05** — Construir conector autorizado para corpus finito y manifiesto sala/año/versión.
- [ ] **F5-T06** — Conectar corpus verificado con resolver de referencias y RAG híbrido.
- [ ] **F5-T07** — Ampliar leyes, códigos, Constitución y Gaceta con trazabilidad y texto vigente solo si comprobado.
- [ ] **F5-T08** — Benchmark externo independiente; registrar detección, extracción, ambigüedad, falso VERIFIED.

### Gate DONE

Fuentes oficiales comprobadas y permitidas, política aprobada; no falsas verificaciones en set independiente; límites de cobertura visibles.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F6 — Junta propia: hardening y primera llamada real

**Estado reportado:** 271 TESTS OFFLINE REPORTADOS / API BLOQUEADA  
**Dependencias:** F0+F5 para corpus; admite preflight paralelo

### Tareas verificables

- [ ] **F6-T01** — Reproducir 271 pruebas reportadas, typecheck, dos builds y smoke sobre código F2.
- [ ] **F6-T02** — Resolver el FAIL conocido de extracción 11/12 en development; congelar holdout externo nuevo.
- [ ] **F6-T03** — Verificar accesos reales: Jev, Luna, Sol 6.1 Medium, Gemini 3.8 Flash; no fallback oculto.
- [ ] **F6-T04** — Solucionar Google HTTP 401 y configurar claves de forma segura; no imprimir secretos.
- [ ] **F6-T05** — Preflight GET no generativo donde esté documentado; diferenciar 401/403/404.
- [ ] **F6-T06** — Ejecutar UNA Junta acotada solo con autorización expresa de gasto, techo y datos sintéticos.
- [ ] **F6-T07** — Medir tokens reales, costo final, P50/P90 cuando haya muestra, cobertura y checker.
- [ ] **F6-T08** — Marcar ejecución parcial y requerir revisión humana; no presentar result real si falla proveedor.

### Gate DONE

Preflight y smoke reales documentados con autorización; checker y extracción evaluados; presupuesto por run verificable.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F7 — Integración Junta + expediente + editor

**Estado reportado:** NO INICIADO  
**Dependencias:** F4+F5+F6

### Tareas verificables

- [ ] **F7-T01** — Desde un asunto autorizado crear cuestión jurídica y snapshot de evidencia.
- [ ] **F7-T02** — Permitir abrir investigaciones pasadas y distinguir CURRENT/OUTDATED.
- [ ] **F7-T03** — Recuperar originales en Sol/Gemini con presupuesto controlado y aislamiento tenant.
- [ ] **F7-T04** — Aplicar checker a citas del borrador exportado, no solo a la salida inicial.
- [ ] **F7-T05** — Enlazar análisis aprobado al documento y al responsable de revisión.
- [ ] **F7-T06** — QA E2E de citas manipuladas, documento nuevo, revoke de permisos y bloqueo de fuentes.
- [ ] **F7-T07** — Verificar costo y latencia por trabajo sin presentar éxito de dictamen como validación de autenticidad.

### Gate DONE

E2E asunto→RAG→Junta→auditor→checker→borrador→revisión→aprobación, con evidencia íntegra y sin leaks.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F8 — Agenda, comunicación, portal, honorarios y cobros

**Estado reportado:** NO INICIADO  
**Dependencias:** F3+F4; paralelo con F5–F7

### Tareas verificables

- [ ] **F8-T01** — Agenda de audiencias/fechas internas con responsable y estados no ambiguos.
- [ ] **F8-T02** — Plazos procesales sugeridos ≠ confirmados; cálculo automático solo con reglas validadas.
- [ ] **F8-T03** — Solicitudes de documentación y comunicaciones con aprobación previa.
- [ ] **F8-T04** — Portal de clientes para versiones explícitamente compartidas.
- [ ] **F8-T05** — Acuerdos de honorarios, gastos, anticipos, facturado y cobrado separados.
- [ ] **F8-T06** — Conservar moneda/IVA/tributos sin inventar integración fiscal paraguaya.
- [ ] **F8-T07** — Panel de dirección con carga y economía reconciliable, sin KPIs decorativos.

### Gate DONE

Ciclo administrativo y de comunicaciones probado con importes y documentos, permisos, versiones y acciones reales.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F9 — Piloto de estudio y preproducción

**Estado reportado:** NO INICIADO  
**Dependencias:** F7+F8

### Tareas verificables

- [ ] **F9-T01** — Elegir estudio piloto y casos de práctica autorizados; convenio de confidencialidad.
- [ ] **F9-T02** — Ejecutar ciclo completo con dos abogados, administración y responsable de revisión.
- [ ] **F9-T03** — Probar aislamiento entre dos estudios, revocación, recuperaciones IA y exports.
- [ ] **F9-T04** — Pruebas de carga de documentos y operación concurrente; fallos y restauración.
- [ ] **F9-T05** — Auditar seguridad, backups, observabilidad, costos por asiento y límites de modelos.
- [ ] **F9-T06** — Benchmark legal independiente contra jurisprudencia verdadera/falsa y adversarial.
- [ ] **F9-T07** — Cerrar defectos críticos y criterios de aceptación de UI compacta con capturas.

### Gate DONE

Cero críticos abiertos, recorrido de estudio completo, evidencias E2E y aprobación humana de piloto.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## F10 — Release controlado y expansión

**Estado reportado:** NO INICIADO  
**Dependencias:** F9

### Tareas verificables

- [ ] **F10-T01** — Aprobar políticas de datos, retención y términos de fuentes comerciales.
- [ ] **F10-T02** — Validar precios y márgenes medidos con frecuencia de uso real.
- [ ] **F10-T03** — Separar cambios preview/productivo con gates y rollback documentados.
- [ ] **F10-T04** — Publicar con monitoring, backups/restauración y soporte.
- [ ] **F10-T05** — Activar clientes comerciales gradualmente sin prometer corpus total.
- [ ] **F10-T06** — Planificar nuevas salas/territorios y conectores según evidencia.
- [ ] **F10-T07** — Actualizar blueprint, roadmap y ADRs con release real y trazabilidad.

### Gate DONE

Release autorizado con rollback, operación monitoreada, economía medida y cobertura publicada sin afirmaciones falsas.

### Prueba y evidencia

Registrar archivos, comandos, SHA, entorno, usuario/rol, resultados PASS/FAIL/BLOCKED, capturas cuando corresponde y límites de la prueba. Nunca marcar DONE por mocks o por una pantalla navegable sin backend.

## Condiciones de arranque para Codex

1. Instalar/leer `docs/LAW_ORDER_OS_BLUEPRINT_v2.0.md` y este roadmap **antes de programar**.
2. Leer `PHASE2_IMPLEMENTATION_REPORT.md`, `OS_CORE_ARCHITECTURE.md`, `ADR OS-001`, informes de test, corpus y bloqueos locales; inventariar lo implementado.
3. Detener solo decisiones bloqueantes (stack productivo y datos reales), documentar alternativas y esperar aprobación; no detener módulos independientes ni rehacer Junta offline.
4. Mostrar evidencia real y un walkthrough del primer OS navegable con UI compacta en el siguiente reporte.
5. Prohibido inventar status de despliegue, claves API, cobertura jurisdiccional o permisos de uso de corpus.

**Hito inmediato de producto:** aprobar ADR OS-001, implementar autenticación/persistencia multiestudio y pantalla «Mi día» compacta, asuntos, clientes, documentos y tareas sobre servicios reales. **Hito inmediato de IA:** verificador de fuentes autorizado, test de extracción externo, acceso a modelos y smoke explícitamente aprobado.
