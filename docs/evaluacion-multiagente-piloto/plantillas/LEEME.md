# Uso de las plantillas

Los CSV están en UTF-8 y separados por comas. Sus campos textuales con comas, comillas o saltos de línea deben entrecomillarse según CSV; no pegar filas delimitadas por punto y coma sin convertirlas. Están vacíos deliberadamente: todavía no hay revisiones, mediciones ni resultados.

## Qué completa cada persona

- Operador: `operacion/EJECUCIONES.csv`, `operacion/CEGAMIENTO.csv` y TELEMETRIA. Estos archivos revelan la modalidad y no llegan al revisor ciego.
- Cada abogado revisor: copia de REVISION_CIEGA y filas de HALLAZGOS identificadas con el código ciego. No ve costos ni trazas.
- Corrector: CORRECCION_Y_TIEMPOS y diff del documento, conservando el código ciego.
- Analista: COMPARACION después del cierre y descegamiento.

## Valores del registro de hallazgos

`pasada`: INDEPENDIENTE o COMPLETITUD. `categoria`: OMISION, ERROR, FALSO_PROBLEMA, CONTRADICCION, RESPALDO, HALLAZGO_VALIDO o LIMITACION. `severidad`: CRITICA, MATERIAL o MENOR. `tratamiento`: SUFICIENTE, PARCIAL, OMITIDO, NO_APLICABLE o DISCUTIDO. `respaldo`: COMPLETO, PARCIAL, INCOMPATIBLE, SIN_FUENTE o NO_CONCLUYENTE. Son etiquetas de trabajo sujetas a adjudicación, no resultados automáticos.

La columna de relación vincula observaciones que describen la misma causa. No aumentar el conteo de hallazgos dividiendo una cuestión ni sumar sin explicación un error y una omisión sobre la misma cuestión. No todo riesgo planteado como pregunta es un falso problema; examinar la proporcionalidad y la evidencia disponible.

## Tiempos y costos

`minutos_activos_totales` suma lectura, comprobación, edición sustantiva y estilo de la sesión de corrección. Las interrupciones se registran aparte y no se incluyen en ese total. Si el corrector ya leyó el caso, registrar esa exposición. La revisión independiente de calidad tiene su tiempo propio y no se vuelve a sumar como parte de una sesión que no la realizó.

Si se interrumpe por el límite previsto, registrar el tiempo efectivamente invertido y `dato_censurado=SI`; no equipararlo a tiempo hasta utilidad. `estado_final` puede ser UTILIZABLE, NO_UTILIZABLE o INTERRUMPIDO. Explicar las limitaciones de material cuando impiden terminar.

Los tokens de razonamiento solo se rellenan si el proveedor los observa. `cost_unknown=SI` identifica costos todavía no determinables; no rellenar cero para hacer cuadrar totales. `usage_status` puede ser OBSERVED, ESTIMATED, MIXED o UNKNOWN. Si el costo de una llamada es estimado, no presentarlo además como observado y sumarlo dos veces.

Los intervalos de etapas paralelas se superponen: su suma no es la latencia total del workflow. El costo agregado sí suma los eventos únicos facturables. No sumar un evento padre de resumen y sus eventos hijos como si todos fueran cargos adicionales.

## Resultados y cegamiento

Los códigos ciegos se generan con aleatoriedad después de producir documentos, sin incluir caso, modalidad o repetición en su texto. El revisor recibe el caso en un campo aparte para consultar el expediente correcto. El orden de revisión se aleatoriza y se contrabalancea; no es el orden de ejecución.

Guardar las copias cerradas y hashes antes de descegar. Los campos de referencia esperada se completan en la segunda pasada, sin borrar la primera. La copia inicial de esta preparación se mantiene sin resultados para que una plantilla vacía no se convierta accidentalmente en una evaluación aprobada.
