# Evaluación propuesta de Jev para contraste de afirmaciones

Fecha: 16 de octubre de 2026. Estado: **PLAN DE EVALUACIÓN; NO IMPLEMENTADO; NO EJECUTADO**. No hay resultados semánticos ni recomendación de activación. Jev de entrada se conserva como trabajo separado.

Se evaluará si Jev aporta valor al responder una pregunta acotada: dado un pasaje identificado y una afirmación de Luna, ¿existe respaldo, falta una condición, hay respaldo parcial o algo incompatible? Su salida no será una auditoría jurídica, una segunda opinión ni una certificación de estrategia. La confianza del modelo no sustituirá los resultados de referencia.

## 1 Hipótesis y comparación

Se compararán dos circuitos sobre las mismas salidas Luna, paquetes de evidencia e inventario de afirmaciones congelados:

- A: circuito habitual con controles determinísticos existentes y su alcance declarado.
- B: circuito A más el candidato de contraste Jev. No se vuelve a generar Luna ni se cambia la selección para favorecer B.

Se conservarán documentos originales, versiones, hashes, localizadores, clasificación de entrada, salida Luna, condiciones del encargo y versión de instrucciones/modelo. Se compararán documentos y conclusiones representativos en español, con distintas ramas y cruces, OCR/ruido y evidencia favorable/desfavorable. Se incluirán casos ordinarios; el conjunto no consistirá solo en errores artificiales fáciles.

La evaluación semántica se separará de la calidad del inventario de afirmaciones. En la comparación aislada ambos circuitos recibirán el mismo inventario, revisado por humanos, para medir Jev. En la evaluación del flujo completo se comprobará si el sistema omitió afirmaciones, agrupó mal una conclusión o perdió una afirmación sin cita. El costo de producir ese inventario y las llamadas auxiliares se medirá aparte y también en el total.

## 2 Contrato candidato

Entrada propuesta: afirmación y localizador en la salida Luna; naturaleza (hecho, inferencia, interpretación, recomendación o hipótesis); jurisdicción/corte; IDs/versiones/localizadores y texto original de fuentes; contexto pertinente, incluidas excepciones; instrucciones y modelo versionados. No se permitirá que un resumen reconstruido suplante el original.

Una afirmación compuesta se dividirá en unidades revisables conservando su vínculo con el texto. Si no tiene cita, seguirá en el inventario con fuentes candidatas autorizadas o ausencia explícita de respaldo; no se eliminará por no poder construir un par afirmación-cita.

Etiquetas candidatas, aún no conectadas a API ni UI: RESPALDO_COMPLETO_EN_PASAJE, RESPALDO_PARCIAL, CONDICION_O_EXCEPCION_OMITIDA, INCOMPATIBLE_CON_PASAJE y NO_CONCLUYENTE. INTERPRETACION_NO_RESOLUBLE_POR_COTEJO distinguirá argumentos nuevos que requieren revisión jurídica. Son resultados de una tarea acotada; RESPALDO_COMPLETO no equivaldrá a opinión jurídicamente correcta, fuente auténtica o estrategia aprobada.

Se ensayarán preguntas tipadas simples por dimensión para evitar una pregunta que mezcle autenticidad, vigencia, inferencia jurídica y estrategia. Ningún umbral se elegirá por la confianza declarada sin calibración en datos revisados.

## 3 Casos obligatorios

| Caso | Resultado que debe distinguirse |
|---|---|
| Fuente auténtica con conclusión incompatible | Contradicción, aunque identidad y cita literal pasen |
| Condición o excepción omitida | Ampliación indebida de lo que respalda el pasaje |
| Respaldo de una parte de la afirmación | Parcial, sin convertir toda la conclusión en respaldada |
| Evidencia insuficiente o contradictoria | Incertidumbre o incompatibilidad, sin fabricar aprobación |
| Afirmación relevante sin cita explícita | Inclusión en cobertura; ausencia de fuente visible |
| Argumento nuevo presentado como interpretación | Ausencia de precedente exacto no equivale automáticamente a falsedad |

Cada tipo tendrá controles positivos y negativos: conclusión correctamente condicionada, cita literal correcta con inferencia incorrecta, negaciones, anexos que cambian alcance, documentos discordantes, fragmento equivocado, referencias fuera de jurisdicción/fecha y ausencia de evidencia. Se distinguirá insuficiencia del paquete recibido de error del modelo; ampliar evidencia será otra intervención registrada, no una corrección oculta del conjunto final.

## 4 Referencia humana y separación de datos

Dos abogados competentes en la materia etiquetarán independientemente cada caso y su materialidad, sin conocer el resultado de Jev. Un tercero resolverá desacuerdos cuando sea necesario; si el caso admite varias interpretaciones razonables, se conservará esa condición. El ground truth del cotejo no se tratará como consenso jurídico universal.

Muestra propuesta: 300 unidades para desarrollo, 300 para calibración y al menos 1.200 para evaluación final reservada, con al menos 200 por familia obligatoria y representación adicional de conclusiones correctas. La etiqueta de referencia determinará la distribución final. Habrá al menos 600 unidades de afirmaciones sin respaldo completo, suficientes para analizar falsos respaldos; se informarán intervalos de confianza y tamaño efectivo.

La separación será por documento/asunto, no solo por párrafo, para limitar filtraciones. Los intervalos de confianza considerarán esa agrupación; los fragmentos correlacionados no se tratarán como muestras independientes para afirmar que se cumplió un umbral. Se preservarán los holdouts existentes del proyecto. Se fijarán hashes y un manifiesto nuevo antes del conjunto final. Si hacen falta expedientes reales, se resolverán derechos, autorización y minimización antes de enviarlos; el desarrollo inicial usará sintéticos y materiales públicos autorizados.

## 5 Métricas y criterios previos

Los límites siguientes son **criterios propuestos de aceptación del experimento**, no resultados ni rendimientos atribuidos a Jev. Se registrarán con el responsable jurídico antes de ejecutar el conjunto final y no se relajarán tras ver sus resultados. Se permite ajustarlos con datos de desarrollo/calibración, dejando versión y razón; después se congela la regla de decisión.

| Métrica | Definición | Criterio propuesto |
|---|---|---|
| Falsos respaldos | Etiquetar completo algo que la referencia humana considera parcial, incompatible o insuficiente | Cero en errores críticos; límite superior unilateral de confianza del 95% ≤1% en el conjunto elegible |
| Detección de defectos materiales | Detectar contradicciones y condiciones/excepciones omitidas | ≥90% global y por familia material; reportar fallos críticos individualmente |
| Cobertura de afirmaciones | Unidades relevantes identificadas y con resultado o pendiente explícito, incluidas las no citadas | ≥95% global y 100% de las críticas del inventario humano; faltantes visibles |
| No concluyentes | Abstenciones en casos humanos considerados resolubles con el paquete entregado | ≤20%; informar por rama y no contar abstención como acierto |
| Falsos rechazos de interpretación | Tratar una interpretación razonable/nueva como falsa solo por no tener precedente exacto | ≤5% de esa familia |
| Aporte incremental | Defectos semánticos materiales detectados por B que A no detecta, sin empeorar falsos respaldos | Mejora pareada con intervalo de confianza por encima de cero; rendimiento absoluto también debe cumplir los criterios |
| Costo incremental | Costo de Jev y preparación auxiliar adicional por encargo completo | ≤20% del costo del circuito A para el alcance candidato; además debe respetar techo absoluto autorizado |
| Latencia incremental | Diferencia pareada en tiempo hasta resultado utilizable | P95 ≤3 segundos adicionales para el alcance candidato; registrar también P50, errores y colas |
| Tiempo humano completo | Desde la instrucción hasta propuesta utilizable revisada, incluidas falsas alarmas/correcciones | Mediana no peor que A, con incertidumbre reportada |

El límite de falsos respaldos se calculará sobre unidades humanas sin respaldo completo; se reportarán también denominadores, matriz de confusión y resultados de todas las clases. Un conjunto insuficiente para el criterio estadístico no habilitará una afirmación de eficacia.

La latencia comprenderá preparación, red, modelo, controles, correcciones y espera hasta una intervención utilizable. La evaluación humana usará orden aleatorio y contrabalanceado para reducir aprendizaje. No se presentará el tiempo del endpoint aislado como tiempo del workflow.

Se contabilizarán costo observado/estimado/reservado por separado, tokens, modelo exacto, llamadas, fallos y costos desconocidos. Reintentos o producción del inventario no desaparecerán del total. Los casos sin ejecución no recibirán un costo ficticio cero.

## 6 Ejecución futura y decisión

1. Implementar únicamente un harness de evaluación separado cuando esa etapa esté autorizada; mantener la ruta operativa sin Jev de salida.
2. Preparar y revisar datasets, contratos, etiquetas y presupuesto; usar primero transporte falso para validar el harness, sin presentarlo como eficacia del modelo.
3. Ejecutar desarrollo/calibración y congelar política, umbrales y manifiesto antes del conjunto final.
4. Ejecutar la comparación real autorizada sobre salidas Luna/evidencia idénticas. La medición final aislada no regenerará Luna.
5. Evaluar además el circuito completo, incluyendo detección de afirmaciones, invalidación, fallos, costo y utilidad humana.
6. Recomendar incorporación, uso limitado a ámbitos evaluados o descarte. Si se propone un subconjunto descubierto tras ver el holdout, deberá validarse en un conjunto reservado nuevo antes de activarlo.
7. Obtener decisión explícita antes de incorporar el componente a workspace o Junta. Cambiar modelo/prompt/criterios exige evaluar la versión nueva.

Sin activación o ante falla, el resultado indicará qué controles se ejecutaron y que el contraste semántico no se realizó o quedó no concluyente. No se heredará un estado de opinión verificada. Jev de entrada se conservará; los demás mecanismos de respaldo y la revisión humana mantendrán su alcance propio.

## 7 Evidencia a producir

Manifiesto/versiones del conjunto, guía de etiquetado, referencia humana y desacuerdos, salidas A/B por unidad, inventario de afirmaciones omitidas, matriz de confusión, intervalos, costos/latencias, medición humana y recomendación con límites. Hoy todos esos resultados son NOT_RUN. Las 83 pruebas determinísticas del [checker](CHECKER_ALCANCE_Y_EVIDENCIA.md) no cuentan como resultados de este experimento.
