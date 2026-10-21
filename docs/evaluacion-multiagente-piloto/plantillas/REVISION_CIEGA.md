# Revisión jurídica ciega de un documento

Plantilla sin resultados. Duplicar por documento y revisor. No rellenar con la modalidad, el modelo, el número de agentes, el costo ni la latencia. El operador conserva la clave de correspondencia por separado.

## Identificación

| Campo | Valor a completar |
|---|---|
| Identificador ciego del documento | PENDIENTE |
| Hash del documento revisado | PENDIENTE |
| Caso y versión del corpus | PENDIENTE |
| Revisor y competencia en la materia | PENDIENTE |
| Fecha, inicio y fin de revisión | PENDIENTE |
| Exposición previa al asunto o a otra versión | PENDIENTE |
| Conflicto de interés o limitación del revisor | PENDIENTE |
| Estado | NO_INICIADA |

## Primera pasada independiente

Usar el expediente y fuentes públicas sin consultar la referencia reservada. Verificar afirmaciones materiales en originales; registrar el tiempo de esa comprobación. No puntuar persuasión o extensión como sustituto de exactitud.

1. ¿Qué decisión ayuda a tomar el memo y bajo qué supuestos?
2. ¿Qué hechos relevantes están acreditados, alegados o todavía abiertos? ¿Se conserva esa diferencia en la recomendación?
3. ¿Qué cuestiones materiales faltan o están tratadas de forma insuficiente?
4. ¿Qué riesgos se exageran o afirman sin respaldo? ¿Existe evidencia contraria ignorada?
5. ¿Hay contradicciones internas o conclusiones de escenarios distintos mezcladas sin explicación?
6. ¿Cada afirmación material tiene respaldo suficiente y aplicable, o delimita correctamente por qué falta?
7. ¿Las diligencias y condiciones propuestas permitirían resolver la incertidumbre que identifican?

Registrar cada observación en [HALLAZGOS.csv](HALLAZGOS.csv), con cita al pasaje evaluado y a los originales que justifican la nota. Si una afirmación es compuesta, separar solo las proposiciones que puedan evaluarse de modo distinto y vincularlas para no inflar el conteo.

| Cierre de primera pasada | Valor |
|---|---|
| Hora de cierre | PENDIENTE |
| Archivo de observaciones y hash | PENDIENTE |
| Minutos activos de lectura/comprobación | PENDIENTE |
| Errores críticos encontrados | PENDIENTE |
| Observaciones abiertas por falta de fuente | PENDIENTE |

PENDIENTE no equivale a cero. No se puede cerrar la pasada sin dejar constancia del documento exacto y sus observaciones.

## Segunda pasada de completitud

Después de cerrar la primera pasada, recibir la referencia del caso sin clasificación de dependencia ni clave de modalidad. Para cada hallazgo de referencia, registrar: tratado suficientemente, parcial, omitido, no aplicable o referencia discutida. Reconocer hallazgos nuevos válidos. Conservar la primera valoración aunque cambie.

| ID de referencia o NUEVO | Tratamiento en el memo y localizador | Acuerdo/discrepancia con la referencia | Evidencia y razón | Cambio respecto de primera pasada |
|---|---|---|---|---|
| PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

| Cierre de segunda pasada | Valor |
|---|---|
| Hora de recepción de la referencia | PENDIENTE |
| Hora de cierre y minutos adicionales | PENDIENTE |
| Omisiones críticas / materiales adjudicables | PENDIENTE |
| Falsos problemas críticos / materiales | PENDIENTE |
| Contradicciones críticas / materiales | PENDIENTE |
| Hallazgos nuevos propuestos | PENDIENTE |
| Discrepancias para adjudicar | PENDIENTE |

## Respaldo de afirmaciones materiales

Usar el CSV para el detalle. Clasificaciones sugeridas: COMPLETO, PARCIAL, INCOMPATIBLE, SIN_FUENTE y NO_CONCLUYENTE. La categoría describe respaldo en el material examinado; no certifica autenticidad, vigencia general ni acierto de toda la estrategia.

Revisar fuente, artículo/pasaje, condición o excepción, aplicación a los hechos y limitaciones temporales. Una cita literal correcta puede acompañar una inferencia incorrecta. Una interpretación nueva razonada no es falsa solo por no citar un precedente idéntico.

## Utilidad antes de corregir

| Campo | Valor |
|---|---|
| Estado | UTILIZABLE / UTILIZABLE_CON_CORRECCIONES / NO_UTILIZABLE / INCONCLUSO |
| Correcciones sustantivas necesarias | PENDIENTE |
| Información o fuente imprescindible que falta | PENDIENTE |
| Cambios solo de estilo | PENDIENTE |
| Razón principal del juicio | PENDIENTE |

Un documento puede ser utilizable recomendando no cerrar o avanzar condicionado. No debe dejar una recomendación operativa que dependa de una premisa crítica falsa. No se requiere eliminar todas las incertidumbres del asunto, sino tratarlas de forma que el cliente pueda decidir qué hacer.

## Adjudicación y cierre

El segundo revisor completa una copia independiente. El adjudicador conserva ambos dictámenes y resuelve diferencias materiales con evidencia, sin conocer A/B/C. Un hallazgo añadido o eliminado se aplica a todas las versiones del caso antes de descegar.

| Campo | Valor |
|---|---|
| Decisiones de adjudicación | PENDIENTE |
| Referencia final aplicada y hash | PENDIENTE |
| Revisión cerrada por / fecha | PENDIENTE |
| Hash de revisión cerrada | PENDIENTE |
| Descegamiento realizado | NO |

La sesión de corrección real utiliza [CORRECCION_Y_TIEMPOS.csv](CORRECCION_Y_TIEMPOS.csv) y conserva el diff. El tiempo de revisión ya registrado no se vuelve a imputar como corrección. No se deduce un tiempo real de una estimación de “cuánto llevaría”.
