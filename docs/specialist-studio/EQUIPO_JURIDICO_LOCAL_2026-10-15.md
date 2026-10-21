# Director jurídico y Equipo jurídico — implementación local

15/10/2026 · America/Asuncion.

La instrucción del propietario «esto fue el plan de trabajo […] implementa esto», junto con la corrección expresa sobre Dashboard y Director, amplía el piloto anterior al recorrido completo local. Se mantienen datos sintéticos, pruebas offline, cero llamadas pagas y cero despliegues. Este documento actualiza el estado del [ADR](ADR_SPECIALIST_STUDIO_002.md); el [informe de Elena](ELENA_LOCAL_PILOT_2026-10-15.md) describe la entrega anterior conservada.

## Correspondencia con el plan recibido

| Pedido | Implementación | Límite comprobable |
|---|---|---|
| Paquete = alcance + fuentes + método + herramientas + evaluación | Registro que carga las 22 fichas existentes, comprueba correspondencia persona/paquete, presenta requisitos, procedimiento, fuentes requeridas y abstención | Seis paquetes con herramientas documentales experimentales; los otros 16 no ejecutan. Ninguno tiene habilitación jurídica acreditada |
| Capacidades diferentes | Elena: obligaciones, condiciones, excepciones, remisiones e importes; Valeria: facultades/instrumentos/dependencias; Lucía: cronología/naturaleza probatoria; Martín: operación/período/comprobante; Diego: hipótesis/contraevidencia/límites; Camila: acto/competencia/notificación/procedimiento | No hay fórmulas jurídicas aprobadas ni cálculo de deuda, impuestos o indemnización |
| Recuperación y comparación | Pasajes de los originales/versiones seleccionados, localizadores exactos y comparación textual ampliada | No se llama al RAG oficial ni se atribuye vigencia o valor probatorio a una mención |
| Gabriel propone y humano confirma | Dashboard separado, delimitación local por reglas, equipo editable, pregunta/motivo por participante, titular, profundidad y adversario independientes | La interfaz declara ingreso local, no simula conversación generativa |
| Vinculación con asunto | Comando idempotente y atómico para elegir asunto autorizado o crearlo mediante Core y confirmar equipo | No hay registro paralelo de expedientes ni documentos privados antes del asunto |
| Consulta focal / equipo / Junta completa | Validador exige 1, 2–6 o exactamente 6 participantes únicos; titular incluido; preguntas y razones obligatorias | Seleccionar o confirmar no ejecuta; paquete sin herramienta local bloquea la preparación |
| Debate real como flujo | Evidencia común → aportes independientes → Santiago recibe aportes completos y evidencia → objeciones → réplicas enlazadas → integración atribuida al titular | Es un ejercicio documental determinístico, no inferencia ni debate jurídico acreditado. Una ronda, sin escalamiento silencioso |
| Checker final | Manifiesto con hashes de pregunta, coordinación, evidencia, cada aporte, objeciones, réplicas e integración/exportación exacta | Gramática limitada; todas las referencias detectadas quedan pendientes de cotejo oficial. No certifica mérito jurídico |
| Evaluación comparada | Exportación ZIP con pares A/B aleatorizados, protocolo, esquema de puntuación y clave separada para coordinador | Ensayo técnico offline; revisión humana y holdout jurídico NOT_RUN. No se afirma superioridad ni se habilitan paquetes automáticamente |
| Trabajo visible en el asunto | Equipo contextual, documentos, pregunta, aportes con matriz, objeciones/respuestas, integración, control y pendientes | Catálogo completo solo al abrir «Agregar especialista» o convocar Junta |

## Uso en la aplicación existente

Corrección posterior del bloqueo de contratos: [carga completa PDF/DOCX/TXT](CONTRACT_DOCUMENTS_LOCAL_2026-10-15.md). El flujo actual ya no usa 24 KB ni solo TXT: conserva originales de hasta 20 MB, extracción local, observaciones visibles y persistencia de asuntos grandes en IndexedDB. Los párrafos siguientes conservan la descripción de la entrega inicial del atajo.

Actualización del flujo corto solicitada por el propietario: se conserva preguntar primero a Gabriel. Antes de confirmar, el atajo exige elegir explícitamente cliente y asunto, o crear ambos en el mismo panel. No se preselecciona el primer cliente y solo se ofrecen asuntos del cliente elegido. El comando de contexto crea cliente/asunto y confirma equipo en una transacción idempotente; un error no deja altas a medias. No se ejecuta ni se incorporan documentos desde el ingreso sin asunto.

En el panel de especialistas se agregó «Adjuntar documentos» y arrastrar/soltar junto a la pregunta. La carga múltiple incorpora originales/versiones del mismo asunto, selecciona los adjuntos, actualiza la lista de Documentos y deja sin efecto cualquier preparación anterior. El historial ya ejecutado conserva sus salidas y se marca desactualizado. Hasta cuatro TXT UTF-8 y 24 KB por carga/consulta; PDF y Word requieren extracción todavía pendiente. Reintentar el mismo comando no duplica archivos; falla un archivo o la cuota y se conserva el estado previo.

Los botones ahora tienen textura mate embebida y hover/foco más contrastados, sin relieve, desplazamiento ni sombra de elevación. No se descargan imágenes o texturas externas.

Recargar `http://127.0.0.1:4313/`. Dashboard → describir encargo sintético → Proponer equipo → editar cuestiones, titular y Santiago → elegir asunto/cliente → Confirmar equipo y abrir asunto. En Equipo jurídico, seleccionar textos o cargar el ejemplo, Preparar consulta y después Ejecutar encargo local · USD 0.

Los resultados tienen pestañas de Integración, Aportes, Objeciones y réplicas y Control y pendientes. Exportar descarga los mismos bytes de la integración auditada. Guardar crea un Draft del Core; editarlo invalida el control de la nueva versión y exige comprobación explícita. La aprobación humana continúa en Revisiones, sin aprobación automática.

En asuntos existentes sin equipo nuevo, se propone y confirma uno sin alterar los documentos ni el historial. «Historial y herramientas anteriores» conserva el piloto de Elena y la consulta fija anterior. El motor previo, Biblioteca, OCR, scripts de inicio y datos del navegador del propietario no se migraron ni reiniciaron.

## Persistencia, permisos e integridad

Extensión opcional `legal_team` del respaldo local v1: asignaciones con CAS, planes, ejecuciones, comandos de enlace y vínculos de borrador. El formato anterior y `specialist_pilot` siguen siendo válidos. Las escrituras usan la transacción existente; cuota insuficiente o conflicto no dejan comandos parcialmente guardados.

Cada acceso pasa por Core/Authorization. Documentos y versiones deben pertenecer al asunto autorizado. Ejecutar y guardar requieren responsable humano y permisos. Los planes congelan equipo, preguntas, profundidad, adversario, inventario, versiones, hashes, presupuesto cero y vencimiento de 30 minutos. Cambios conservan el resultado histórico y bloquean nuevas ejecuciones con planes obsoletos. Un comando ya concluido devuelve el mismo resultado histórico.

Los cuatro indicadores del Dashboard usan lecturas autorizadas del Core: tareas internas personales vencidas, pendientes en el resto del día, revisiones asignadas pendientes y borradores propios con cambios solicitados. El listado contiene exactamente los IDs contados. Alcance, período, hora de actualización y zona se muestran; carga y error no se convierten en cero. Mi día conserva su consulta personal independiente.

Los perfiles locales editables no constituyen autenticación de producción. No se tocaron migraciones SQL ni se afirma equivalencia con el camino servidor.

## Archivos y evidencia

- `apps/web/src/specialist-engine.ts`: contratos, catálogo, paquetes, orquestación y auditoría terminal.
- `apps/web/src/specialist-tools.ts`: herramientas documentales por área.
- `apps/web/src/local-team.ts`: comandos del host, autorización, enlace atómico y lecturas del Dashboard.
- `apps/web/src/DirectorDashboard.tsx`, `LegalTeam.tsx`, `TeamEditor.tsx`: recorrido visible conectado.
- `apps/web/src/specialist-evaluation.ts`: comparación y puntuación humana, sin promoción automática.
- `local-browser/tests/legal-team.test.ts`: permisos, invariantes, integridad, persistencia y comparación.
- `local-browser/tests/legal-team-browser.test.ts`: recorrido en navegador real con red externa bloqueada.
- [Evidencia del navegador](../../local-browser/reports/legal-team/browser.json) y [pruebas locales finales](../../local-browser/reports/legal-team/local-tests-final.json).

Los seis PNG originales se conservan. Gabriel y Santiago reutilizan por CSS sus retratos de la referencia visual ya aceptada, copiada sin transformación a `apps/web/public/agents/approved-team-reference.png`. No se generaron imágenes ni se efectuaron llamadas de imagen.

## Trabajo jurídico aún no acreditado

Faltan curaduría jurídica de fuentes/fecha por paquete, casos reservados revisados por abogados, evaluación ciega real, umbrales aceptados y decisión habilitante. La generación externa y su presupuesto siguen deshabilitados para este recorrido. Esa limitación se presenta en el producto y no se reemplaza con retratos o una declaración de especialización.
