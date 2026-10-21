# Progreso de Junta e informe jurídico

Trabajo completado: 2026-10-14, America/Asuncion; corrida revisada del 13/10. Se agregó un panel de deliberación interactivo con cinco etapas reales, cronómetro, costo estimado y detalle por etapa. Se reemplazó el bloque plano del resultado por un informe con jerarquía y exportación HTML imprimible.

## Corrida revisada

Preparación `950f72e3-0b40-408b-8d80-9122ae804c24`; run `run:f9c96b91990c1863ff1115f8cc968ed5`. Estado HUMAN_REVIEW_PENDING. El revisor Gemini conservó REVIEW_REQUIRED y sus advertencias; completar el pipeline no equivale a aprobar el análisis.

Inicio local: 13/10/2026 23:37:50.790. Guardado final: 23:39:48.883 (America/Asuncion). Tiempo total reconstruido mediante timestamps de persistencia: **118,094 segundos, 01:58**. Suma de latencias de las etapas: **114,277 segundos, 01:54**. La diferencia incluye comprobaciones previas y procesamiento/persistencia local. Los tiempos se recuperaron sin repetir llamadas ni modificar la corrida histórica.

| Etapa | Tiempo de procesamiento | Costo estimado USD |
|---|---:|---:|
| Jev · evidencia | 0,490 s | 0.000075852 |
| Luna · contexto | 33,715 s | 0.002592300 |
| Sol · análisis | 41,062 s | 0.035496000 |
| Gemini · revisión crítica | 39,005 s | 0.012573000 |
| Checker · referencias | 0,005 s | 0 |

Total estimado: **USD 0.050737152**; visualización redondeada USD 0.05074. Factura real no disponible. Uso informado por proveedores: 21.916 tokens de entrada y 8.168 de salida. Datos íntegros en reports/mock-run-timing.json.

## Comportamiento

La UI consulta el estado guardado mediante GET cada 1,2 segundos durante la ejecución y también recupera una corrida activa después de recargar. Estos GET no invocan proveedores ni conceden autorizaciones. El cronómetro avanza mientras existe una consulta activa y queda fijo al terminar; se muestran timestamps del servidor cuando están disponibles. Para registros sin timestamps se identifica expresamente la suma de latencias como tiempo de procesamiento, sin llamarla tiempo total. Los runs reanudados indican que el tiempo total incluye la interrupción.

La barra mide etapas completadas, no porcentaje de tiempo ni ETA. Cada etapa puede desplegar actor, modelo, latencia, costo y error guardados. El contenido no expone cadenas de razonamiento privadas ni simula actividad del modelo. Respeta movimiento reducido, incluye estados accesibles y adapta el panel a pantallas pequeñas. Durante la deliberación se repliega el formulario para mantener el progreso visible.

El informe conserva el texto original: separa introducción, secciones numeradas y conclusión; destaca observaciones según la severidad ya emitida por Gemini. No añade hechos, citas ni conclusiones. Alternativas, pendientes y limitaciones siguen disponibles. La exportación HTML escapa contenido y es imprimible; guardar en el asunto conserva encabezados en el borrador textual. La ruta GET /local/junta/case/report?id=… presenta el análisis existente sin ejecutar nuevamente la Junta.

## Verificación

Build Junta/web y typecheck OS PASS. **271/271 Core/Junta y 17/17 locales PASS** en reports/deliberation-core-tests.json y reports/deliberation-document-tests.json. Las pruebas cubren recuperación de tiempos, renderización segura, conservación de negaciones/limitaciones, progreso 2/5 durante una respuesta controlada y 5/5 al finalizar, exportación del informe y ausencia de solicitudes externas. Los screenshots progress-test-simulation.png y document-test-simulation.png corresponden a HTTP simulado en un navegador aislado y se identifican como prueba; no prueban una ejecución real adicional.

El informe real existente se abrió y verificó visualmente con tiempo 01:58 y costo USD 0.05074. Artefactos: reports/INFORME_JURIDICO_CONTRATO_DEMO.html, reports/INFORME_JURIDICO_CONTRATO_DEMO.md y reports/informe-juridico-estructurado.png.

Se reinició únicamente el servidor propio del OS para actualizar la ruta de lectura. No se tocaron otros procesos, no hubo llamadas pagas nuevas ni despliegues.
