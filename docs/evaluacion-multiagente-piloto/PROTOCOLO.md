# Protocolo del piloto de investigación jurídica

Versión 0.1 · 19/10/2026 · America/Asuncion. Estado: PREPARADO PARA REVISIÓN; NOT_RUN.

## Pregunta y alcance

¿Las investigaciones enfocadas en contextos separados producen un memo más completo y utilizable que un generalista por etapas, con acceso y presupuesto total comparables?

La comparación principal es C frente a B. A frente a B permite examinar el efecto de organizar el trabajo por etapas; C frente a A es una comparación secundaria. La concurrencia, el aislamiento contextual y la distribución de responsabilidades forman un tratamiento conjunto en este piloto. Una eventual ventaja no se atribuirá automáticamente a cada mecanismo por separado.

El piloto utiliza tres asuntos sintéticos paraguayos de adquisición de negocios. No mide competencia profesional general, exactitud en todas las ramas ni desempeño de una junta profunda. La población evaluada queda limitada a los escenarios y configuraciones examinados.

Hipótesis favorable: C encuentra cuestiones materiales que B omite, conserva esas cuestiones correctamente en el memo y reduce el trabajo humano necesario, dentro de los recursos acordados. Resultados admisibles: ventaja de calidad, ventaja exclusiva de latencia, ventaja de eficiencia con calidad dentro del margen acordado, pérdida de calidad o resultado inconcluso.

## Modalidades

| Código interno | Organización |
|---|---|
| A | Un generalista dispone del brief, expediente, fuentes y herramientas. Decide su secuencia y puede tomar notas; no delega en otros investigadores. |
| B | El mismo modelo investiga sucesivamente lo contractual, lo tributario y lo laboral, conservando continuidad y notas. Puede volver a una etapa, recuperar originales y reasignar esfuerzo. No es una respuesta única ni una secuencia rígida de preguntas. |
| C | Tres ejecuciones del mismo modelo reciben responsabilidad contractual, tributaria y laboral. Cada una accede a todo el expediente y al mismo corpus. El titular del mismo modelo integra, puede consultar originales y pedir aclaraciones. |

No se usan paquetes profesionales extensos de especialidad en ninguna modalidad. La biblioteca consultable y el brief son comunes. Los encargos breves están en `operacion/MODALIDADES.md`; se versionan junto con el resto del material. Este ensayo examina división de investigación, no el valor de los paquetes de procedimiento existentes.

En B se fija antes de ejecutar el orden contractual → tributario → laboral, con libertad para revisitar. Las dos repeticiones mantienen ese orden y la misma configuración. El resultado corresponde a esa política concreta; un ensayo posterior podrá comparar órdenes sin reutilizar estos casos como prueba reservada.

En C los trabajadores comienzan con el mismo núcleo factual y sin las conclusiones de los demás. Pueden enviar un hallazgo transversal con su fuente y condición; el contenido, destinatarios, momento y costo se registran. No hay conversación permanente obligatoria ni consenso por votación. Integrar no exige inventar una posición única cuando siguen abiertas alternativas.

El titular conserva el mérito jurídico y la recomendación. Gabriel puede organizar el envío si el futuro ensayo lo necesita; no redacta ni decide el fondo. Su costo se incluye cuando participa. No se añaden agentes permanentes ni se cambia el OS para este paquete.

## Diseño y casos

P01, P02 y P03 tienen los mismos requisitos de salida y fuentes comunes. La clasificación por dependencias y los hallazgos previstos permanecen en `reservado/`, fuera de los materiales de investigación.

Se prevén dos repeticiones por asunto y modalidad: 18 documentos finales. Una repetición es una ejecución completa nueva, con estado limpio; no es una reparación del primer intento. No se elige la mejor respuesta de las dos. Se conserva todo intento, incluidos fallos y salidas incompletas.

La unidad de comparación es el asunto. Dos repeticiones miden sensibilidad de ejecución dentro del mismo asunto; no convierten tres expedientes en dieciocho casos independientes. Este tamaño permite depurar el protocolo y encontrar mecanismos de fallo. No justifica significancia estadística ni afirmaciones de superioridad general.

## Condiciones previas a las inferencias

Completar y versionar `operacion/FICHA_PREVIA.json` antes de cualquier futura llamada. Los valores nulos no significan cero ni ausencia de límite. Se requieren:

1. Identidad efectiva y versión del modelo, proveedor, parámetros de generación y de razonamiento, política de contexto y semilla si está disponible. Una sustitución autorizada de modelo no se presume implementada.
2. Techo monetario por ejecución completa, límite global del piloto, límite de llamadas y plazo máximo. Registrar la forma de imputar cómputo cuando el proveedor no expone razonamiento o costo final.
3. Revisión de hechos y referencias por abogado competente; revisión de extracción y selección normativa, modificaciones y fecha de aplicabilidad. Si falta cobertura jurídica, ampliar una sola vez el corpus común antes de congelar, con acceso igual para A/B/C.
4. Operador, dos revisores independientes y responsable de desempate. Quien diseñó las referencias no constituye revisión jurídica externa.
5. Diferencia mínima útil en tiempo humano, margen de no inferioridad de calidad, tolerancia de costo y criterio sobre errores críticos. Se justifican por el trabajo del despacho, no se escogen después de ver resultados.
6. Separación de datos públicos, referencias y clave de cegamiento; preparación de un área aislada de resultados fuera de las carpetas de entrada.
7. Autorización futura expresa de llamadas pagas y datos. La instrucción vigente autoriza esta preparación documental y prohíbe dichas llamadas.

Una vez completos, registrar el hash de la ficha y del manifiesto en un acta previa. El manifiesto actual congela solo esta preparación; no declara que esas condiciones estén resueltas.

## Igualdad de acceso y recursos

Todos reciben el mismo brief, encargo, documentos, fuentes originales y extracciones. Se permite buscar, abrir y citar pasajes distintos: descubrir evidencia es parte del tratamiento. No se fuerza un paquete de fragmentos idéntico ni se usa la referencia esperada para formular búsquedas.

El primer piloto usa el corpus local congelado, sin web abierta durante las inferencias. Se conserva acceso directo a los originales archivados. Una fuente necesaria ausente se registra como limitación y diligencia pendiente; no se penaliza abstenerse justificadamente ni se considera suficiente abstenerse sobre todo. La investigación web abierta y la amplitud de jurisprudencia exigirán una evaluación posterior.

Las herramientas mínimas equivalentes son inventariar, buscar texto, abrir documentos y consultar pasajes contiguos u originales completos. Una herramienta disponible solo para C invalida la comparación arquitectónica salvo que se prepare una comparación nueva explícita. No se habilitan calculadoras jurídicas, validadores semánticos ni bases externas que no estén realmente disponibles.

El presupuesto incluye planificación, lectura repetida, búsquedas, trabajadores, comunicaciones, integración, revisiones IA comunes, reparaciones y documento final. No se concede a C un presupuesto completo por trabajador. No se obliga a A o B a consumir recursos sobrantes. La política común de checker, auditoría IA y reparación se fija antes y se incluye en todas las modalidades; la junta profunda queda fuera.

Los costos efectivos, estimados y desconocidos se guardan por separado. Un límite configurado no acredita que se haya gastado esa cantidad. En ausencia de uso o precio observado se conserva un campo vacío o estado desconocido; no se inventa un costo cero. El trabajo humano se informa aparte del presupuesto de inferencias y también puede monetizarse con una tarifa previamente acordada.

## Secuencia de ejecución futura

1. Validación técnica sin inferencias: integridad de archivos, aislamiento, herramientas equivalentes, registro de gasto agregado, preservación de intentos y etiquetas anónimas. Puede usarse un transporte simulado; sus resultados no miden calidad del modelo.
2. Preparar la cola de las 18 ejecuciones con orden balanceado. Por repetición, alternar la primera modalidad entre los tres asuntos; invertir el orden en la segunda. Conservar el orden predefinido, hora y condiciones del proveedor. No ejecutar modalidades distintas dentro del mismo contexto.
3. Ejecutar solo cuando existan autorización y ficha final. Cada ejecución guarda entradas exactas, eventos de herramientas, mensajes entre investigadores, salidas intermedias, controles y texto final. No sobrescribir intentos. Un fallo técnico queda visible; cualquier reemplazo autorizado se identifica como intento adicional con su costo.
4. Medir latencia desde la disponibilidad completa del encargo hasta la salida del workflow, incluyendo colas, integración y controles. Registrar por separado el tiempo activo humano y el tiempo calendario hasta documento utilizable.
5. Crear una copia ciega de cada salida, con identificador aleatorio no semántico y hash. Quitar únicamente metadatos de modalidad, modelo y nombres de agentes, mediante una transformación registrada. No corregir argumentos, citas, organización ni estilo. Conservar el original y el diff de anonimización.
6. Realizar la revisión humana descrita abajo. No alimentar sus observaciones a otro brazo ni regenerar un documento tras conocer su nota.
7. Descegar después de cerrar y versionar las revisiones. Completar la comparación por asunto y repetición. La clave se genera en ese momento operativo; no está rellenada en esta preparación.

## Revisión ciega y documento utilizable

Dos abogados examinan cada documento de forma independiente con el mismo expediente y corpus, sin conocer modalidad, costos, latencia ni resultados de otros revisores. Primero registran sus observaciones sin consultar las referencias esperadas. Luego reciben solo la referencia del caso y revisan completitud; esa segunda pasada y cualquier cambio se identifican. Desacuerdos materiales se adjudican con fundamento, conservando ambas opiniones originales.

Las referencias reservadas son listas iniciales de hipótesis, no una verdad jurídica cerrada. Un hallazgo nuevo válido se puede incorporar por decisión documentada, aplicando el criterio a todos los documentos del mismo caso antes del descegamiento. Se aceptan interpretaciones razonables y recomendaciones alternativas respaldadas. Contar dos veces la misma cuestión, o dividirla artificialmente en varias filas, no aumenta cobertura.

Para corregir, asignar preferentemente un abogado diferente a cada modalidad del mismo caso. Si los recursos obligan a reutilizar un corrector, contrabalancear el orden, registrar exposición previa y tratar la comparación temporal como exploratoria. Un corrector no recibe las demás versiones. La revisión de errores y la sesión de corrección son tareas distintas con tiempos separados; no se suman dos veces.

Un documento utilizable tiene destinatario y decisión claros, hechos y supuestos diferenciados, ninguna objeción crítica sin resolver o sin una limitación que impida usar la recomendación afectada, fuentes/localizadores comprobables y pendientes accionables. Puede recomendar no avanzar o avanzar condicionado; no requiere certeza imposible ni aprobar la operación. Si no puede hacerse utilizable con el material, registrar NO_UTILIZABLE, razón y tiempo invertido. Una eventual sesión interrumpida o limitada es un dato censurado, no tiempo de terminación exitoso.

## Métricas

| Dimensión | Definición operativa |
|---|---|
| Omisiones críticas/materiales | Hallazgos adjudicados ausentes o tratados de manera que no informan la decisión; separar crítica de material y reportar cada una. |
| Cobertura | Hallazgos válidos tratados / hallazgos adjudicados aplicables; numerador y denominador por caso. Mencionar una palabra no acredita tratamiento suficiente. |
| Errores materiales | Afirmaciones o recomendaciones incorrectas que cambian la decisión, diligencia, condición o exposición relevante. |
| Falsos problemas | Riesgos afirmados sin respaldo suficiente, incluyendo exageraciones pese a evidencia contraria. Una pregunta razonable identificada como pendiente no es un error por sí misma. |
| Respaldo | Por afirmación material: fuente correcta, pasaje suficiente, condición/excepción conservada, aplicación al supuesto y estado de vigencia justificado o limitado. |
| Contradicciones | Incompatibilidades internas o entre hallazgos y recomendación; separar alternativas explícitas de contradicciones no resueltas. |
| Pérdida en integración | Hallazgo válido presente en un resultado intermedio y ausente o deformado en el final. Solo se analizan artefactos efectivamente guardados, no razonamiento interno no observable. |
| Utilidad humana | Minutos activos de comprobación/corrección hasta criterio de utilidad, cambios sustantivos y estado final. Registrar estilo aparte. |
| Recursos | Consumo total observado/estimado/desconocido, llamadas, fallos, latencia total y desgloses por etapa. |

Un error crítico puede inducir a comprometer dinero o recomendar una operación sobre una premisa decisiva falsa, inventar respaldo jurídico decisivo o ignorar una condición esencial. Material cambia una actuación o exposición relevante sin alcanzar ese nivel. Menor no cambia la decisión. Las severidades de cada referencia son propuestas que revisa el abogado antes de ejecutar; no se suman en una nota que oculte errores críticos.

## Reglas de interpretación

En este piloto se publica una comparación descriptiva completa, con A/B/C por cada asunto y ambas repeticiones. Se muestra sensibilidad a resultados discordantes y no se selecciona solo la mejor ejecución. Con tres asuntos no se usarán percentiles extremos, significancia aparente ni recuentos de párrafos como muestras independientes para declarar superioridad.

C solo produce señal favorable si la ventaja es jurídicamente válida, llega al documento final y compensa el trabajo/costo de integración. Más texto, agentes o citas no cuentan como éxito. Un error crítico no queda compensado por ahorro de minutos; exige analizar el fallo y repetir sobre casos nuevos después de corregir, si se desea continuar.

Ausencia de diferencia observada no demuestra equivalencia. Si no se fijaron márgenes, la muestra es insuficiente o los revisores discrepan sobre lo decisivo, informar INCONCLUSO. Una preferencia descubierta solo en un subtipo se formula como hipótesis para asuntos nuevos, no como alcance ya validado.

## Confirmación y control de mecanismo

Si hay señal útil, congelar la configuración revisada y crear asuntos reservados nuevos, curados por abogados ajenos a su implementación. El tamaño de confirmación se determina con la variabilidad observada y la diferencia útil acordada; el análisis debe considerar agrupación por asunto y comparaciones múltiples. Este paquete no fija una cifra sin esos datos.

Para separar concurrencia de contextos, agregar un control C-secuencial: mismos trabajadores, entradas, herramientas, política de comunicación e integración, ejecutados uno detrás de otro. Si un trabajador recibe hallazgos que en C-paralelo no tenía en ese punto, cambió también el acceso informativo y deja de ser un control puro de calendario. La reproducción exacta de eventos externos puede no ser posible; esas diferencias se informan.

La preparación y cualquier resultado futuro no activan componentes ni modifican el blueprint. La decisión posterior puede ser mantener el generalista, usar investigaciones separadas solo en ciertos asuntos o ampliar el estudio.
