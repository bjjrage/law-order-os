# Presupuesto detallado propuesto — 21/10/2026

**Sin autorización de gasto. Inferencias pagas ejecutadas: cero.** Piloto: 6 casos × 3 niveles × 2 repeticiones = 36 ejecuciones, cada una con 4 turnos humanos: 144 interacciones. El techo propuesto de USD 0,60 por interacción da **USD 86,40 nominales**, USD 2,40 por ejecución y USD 28,80 por nivel. Es una envolvente presupuestaria, no una previsión ni garantía de terminar.

La v0.5 corrige el corte artificial por bytes y las tarifas de contexto largo. Los escenarios de USD 8,85 / 25,16 / 90,38 siguen siendo sensibilidad con entradas hipotéticas, no previsiones del corpus completo: falta medir tokens de cada proveedor y recorridos efectivos. Las fuentes se conservan completas; solo se eliminan copias repetidas en el transporte. Un paquete que cabe en contexto puede exceder USD 0,60 de presupuesto.

## Tarifas consultadas

USD por millón de tokens; texto, Standard, sin descuento de caché. [Tarifas en JSON](operacion/TARIFAS_PROPUESTAS.json); originales, fechas y SHA256 en [archivo de investigación](revision-vigencia-2026-10-21/DESCARGAS.json). Se actualizaron los tramos OpenAI del inventario activo y su fecha de revisión. Pagos y transporte real del benchmark siguen deshabilitados.

| Rol | Modelo exacto | Entrada | Salida facturable | Condición |
|---|---|---:|---:|---|
| Gabriel y auditor de reserva | [gpt-6-luna](https://developers.openai.com/api/docs/models/gpt-6-luna) | 0,10 | 0,50 | Hasta 272.000 tokens de entrada |
| Ágil / Medio | [deepseek-flash](https://api-docs.deepseek.com/quick_start/pricing/) | 0,30 | 1,20 | Tarifa pico; versión publicada DeepSeek-V4.1-Flash-1017 |
| Profundo | [gpt-6.1-sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | 2,00 | 10,00 | Hasta 272.000 tokens de entrada |
| Auditor principal | [gemini-3.8-flash](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash) | 0,75 | 3,75 | Precio publicado hasta 31/12/2026 |

OpenAI: superar 272.000 tokens de entrada cambia **toda la solicitud** a Luna 0,20/0,75 o Sol 4,00/15,00. Runtime y calculadora comparten ahora el selector de tarifas. La reserva usa la cota conservadora; si no cabe, el conteo del proveedor permite recalcular por el tramo correcto. La liquidación selecciona el tramo por entrada realmente informada, también para salida/razonamiento; solo libera excedentes conocidos. Modelos OpenAI sin tabla larga o con umbral inválido se rechazan. Se mantiene frescura menor a siete días. Véase [precio oficial OpenAI](https://developers.openai.com/api/docs/pricing).

Gemini anuncia 1,50/7,50 desde 01/01/2027: revalidar si se posterga. DeepSeek publica menor precio fuera de pico, pero no se descuenta. Low/high cambia tokens, no tarifa unitaria; Ágil y Medio cuestan igual bajo hipótesis iguales, sin afirmar que consumirán lo mismo. Razonamiento facturable está incluido en salida: no sumarlo dos veces. No se presupone caché, Batch/Flex/Fast, procesamiento regional ni herramientas externas facturables. Si se usan, recalcular. Impuestos, comisiones, recargas mínimas y conversión monetaria requieren términos reales; no se les asigna un cero definitivo.

## Tamaño real y corrección del contexto — v0.5

Se midieron los 24 snapshots públicos con dos aportes sintéticos y fuentes repetidas en contexto/aportes. Cada texto se conserva una vez en `source_catalog`; sus apariciones repetidas remiten a fuente, pasaje y SHA256. La reconstrucción recupera exactamente el objeto original, incluidos hallazgos, contradicciones, descartes y metadatos. Los originales del host y el checker siguen usando texto literal. El catálogo es el mismo para los tres niveles y conserva el fallo N06 desde el turno 2. No se eligieron artículos por palabras clave ni se resumieron leyes.

| Caso, turno 2 | Paquete original UTF-8 | Paquete con catálogo UTF-8 | Conteo local de envolvente DeepSeek |
|---|---:|---:|---:|
| N01 | 4.809.927 | 970.570 | 255.580 |
| N02 | 1.155.033 | 237.066 | 62.676 |
| N03 | 1.141.352 | 234.111 | 60.933 |
| N04 | 1.601.209 | 328.072 | 89.650 |
| N05 | 2.719.422 | 551.457 | 146.134 |
| N06 | 5.242.031 | 1.061.391 | 281.591 |

**24/24 integraciones de preparación aceptadas, reconstrucción exacta y cero solicitudes a proveedores.** El corte anterior de 60.000 bytes se conserva solo como contraste negativo en el informe. Ahora se espera la comprobación asíncrona de contexto por modelo, con espacio para salida; un bloque realmente indivisible que excede la ventana se rechaza sin invocarlo. El runtime aplica el control también a director, especialistas, correcciones y auditorías, no solo a integración.

Para OpenAI/Gemini se solicita conteo al proveedor cuando la cota de bytes no basta para decidir capacidad; esta preparación usa respuestas sintéticas, nunca sus endpoints reales. DeepSeek no ofrece ese conteo documentado: se usa el tokenizador V4 oficial local sobre la solicitud serializada completa, con margen de 2048 y comprobación de ida/vuelta de la tokenización. Es una **envolvente local**, no uso facturado ni un conteo OpenAI/Gemini. Las reservas monetarias DeepSeek conservan por separado la cota de bytes para evitar infrarreservar por esa aproximación. Revalidar tokenizador si cambia el alias/modelo o su protocolo. No se aplica bytes/4.

Se corrigió además CPC-7663.txt: el derivado anterior contenía la ficha SILpy; ahora contiene los cuatro folios del PDF oficial, con errores OCR señalados y cotejo jurídico pendiente. El abogado aún debe aprobar vigencia, aplicabilidad y suficiencia del material. Antes de pagos, faltan conteos efectivos por proveedor, historial/recorrido real y presupuesto compatible. La admisión de contexto offline no prueba corrección jurídica ni finalización dentro del techo.

## Escenarios condicionales y reproducibles

Una llamada es una generación; una interacción contiene varias. Estos patrones **no fijan el equipo de Gabriel**: calculan sensibilidad dentro del único workflow, con elección libre de especialistas y los mismos controles.

| Hipótesis | Entrada por llamada | Salida facturable por llamada: director / análisis / borrador / auditor | Llamadas por los cuatro turnos |
|---|---:|---|---|
| Acotado | 8.000 | 1.500 / 3.000 / 6.000 / 1.200 | 5 + 9 + 5 + 5 = 24 |
| Central | 16.000 | 2.500 / 6.000 / 10.000 / 2.000 | 9 + 9 + 9 + 5 = 32 |
| Tensión | 32.000 | 8.000 / 16.000 / 25.000 / 8.000 | 16 + 16 + 16 + 10 = 58 |

Cinco llamadas: director decide, especialista/redactor, auditor, director responde y auditor final. Nueve: director, dos especialistas con auditorías, integración con auditoría, director responde y auditor final. Tensión añade una corrección de análisis y auditoría por turno, más fallback Luna por cada intento de auditoría. Se conserva la exposición íntegra de la auditoría principal incierta, sin presumir devolución por timeout. El ledger distingue reserva incierta de consumo confirmado.

No se estimó distribución probabilística de razonamiento, longitud, equipos o correcciones. Tensión no es peor caso absoluto. La integración permite hasta ocho generaciones de reducción/integración por operación; los escenarios base suponen una. No hay reintentos ni turnos extra autorizados. Todo adicional debe caber en la misma cuenta o registrar corte.

Fórmula por llamada: `(entrada × tarifa_entrada + salida_facturable × tarifa_salida) / 1.000.000`. Reserva previa: cota de entrada y máximo de salida, actualmente director 8.000, análisis/integración 16.000, borrador fundamentado 25.000, auditor/fallback 8.000. Solo uso conocido libera excedentes. La exposición de la tabla suma máximos de salida al contexto hipotético: no significa que todas las reservas estén abiertas simultáneamente.

| Escenario | Llamadas en 36 ejecuciones | Consumo hipotético USD | Exposición con máximos de salida USD |
|---|---:|---:|---:|
| Acotado | 864 | 8,8488 | 31,4640 |
| Central | 1.152 | 25,1640 | 52,9200 |
| Tensión | 2.088 | 90,3792 | 90,3792 |

**Lo que excede un tope es exposición sin cortes, no gasto habilitado.** En tensión, Profundo necesitaría 1,2164 por turno de análisis y 0,7360 en el final: el tope 0,60 interrumpiría antes. En central, consumir los máximos de salida llevaría un turno de análisis Profundo a 0,7552, frente a 0,3597 bajo salidas hipotéticas centrales. Un total menor que 86,40 no garantiza finalización: cuentan saldo y reservas concurrentes por interacción. No trasladar saldo entre interacciones para eludir el límite.

### Por nivel, caso y función

| Escenario | Ágil: 12 ejecuciones USD | Medio: 12 ejecuciones USD | Profundo: 12 ejecuciones USD | Un caso: 6 ejecuciones USD |
|---|---:|---:|---:|---:|
| Acotado | 1,8840 | 1,8840 | 5,0808 | 1,4748 |
| Central | 5,0472 | 5,0472 | 15,0696 | 4,1940 |
| Tensión | 18,8784 | 18,8784 | 52,6224 | 15,0632 |

La misma asignación hipotética vale para cada caso N01–N06; seis veces la última columna da el total. No se atribuyen diferencias de tokens no medidas a los expedientes. Detalle en [JSON](operacion/PRESUPUESTO_DETALLADO.json), CSV [por etapa](operacion/PRESUPUESTO_ETAPAS.csv), [por turno](operacion/PRESUPUESTO_TURNOS.csv) y [medición del corpus](operacion/MEDICION_CORPUS.csv).

Central, por ejecución: 8 llamadas Gabriel, 9 análisis/integración, 1 borrador y 14 auditorías. Costos por función: Gabriel 0,0228; análisis 0,1080 Flash o 0,8280 Sol; borrador 0,0168 Flash o 0,1320 Sol; auditoría 0,2730. Total 0,4206 Ágil/Medio o 1,2558 Profundo. El piloto central suma 18.432.000 tokens de entrada y 4.032.000 de salida facturable, distribuidos en solicitudes cortas; no es una sola solicitud.

### Trabajo humano y costo completo

Horas propuestas de trabajo futuro, sujetas a acuerdo y medición. No hay honorarios cotizados ni abogado designado.

| Partida | Base | Horas | Importe pendiente |
|---|---|---:|---|
| Curaduría jurídica | 6 × 3 h | 18 | 18 × tarifa curador |
| Validación independiente inicial | 6 × 2 h | 12 | 12 × tarifa validador |
| Dos revisiones ciegas | 36 × 2 × 45 min, intermedios y final | 54 | 54 × tarifa revisor |
| Resolución de discrepancias | Bolsa inicial | 3 | 3 × tarifa adjudicador |
| Corrección humana cronometrada | 36 × 30 min | 18 | 18 × tarifa corrector |
| Preparación/operación técnica | Bolsa inicial | 6 | 6 × tarifa operador |
| **Total** | | **111 h** | **Sin cotización** |

Las 54 h incluyen salidas intermedias y finales ya producidas: no se generan rondas nuevas para medir al auditor. Las 18 h de corrección no son un resultado medido. Registrar tiempos reales, sin contratar ampliaciones automáticamente. Revisores independientes cierran notas antes de revelar modelos; quien conoce la clave no revisa con identidades visibles.

**Costo completo con reserva máxima API:** `86,40 + 18r_curador + 12r_validador + 54r_revisor + 3r_adjudicador + 18r_corrector + 6r_operador + impuestos/comisiones/infraestructura aplicables`. Para prever consumo, sustituir 86,40 por un escenario, sin sumar ambas cifras. No hay total cerrado sin tarifas y términos reales. Solo como sensibilidad matemática: 111 h a una tarifa uniforme hipotética de USD 50/h serían USD 5.550 antes de API y cargos; **no es cotización**.

Alcance: fase 1, fuentes controladas y casos sintéticos. Excluye biblioteca real, contratos de clientes, confirmación con 18 casos nuevos, turnos extra y repetición de fallas. Cálculos y pruebas locales no consumen proveedores; eso no vuelve gratuito el trabajo humano. No se contrata infraestructura nueva.

## Controles y decisión pendiente

Se conservan los controles probados offline: reserva global durable/atómica, concurrencia y aislamiento con transporte sintético. El ledger fuera de la cápsula retiene responsabilidad incierta y bloquea replay. La política sigue **OFFLINE_ONLY**; el ejecutor no tiene salida a proveedores reales. Sus cifras son sintéticas. No se cambió el presupuesto normal del producto ni se reutilizó una autorización antigua.

Faltan [validación del abogado](VALIDACION_ABOGADO.md), preflight financiero con conteos efectivos y fallbacks, cegamiento, honorarios y autorización expresa del monto total/alcance. El tamaño artificial y la selección de tramos quedaron corregidos y probados offline; eso no garantiza que USD 0,60 alcance con el corpus completo. Si no cabe una llamada, registrar insuficiencia sin omitir auditoría ni sustituir modelo. Una habilitación futura de red/transporte necesita verificar de nuevo el aislamiento aplicable.

Reproducción sin red ni credenciales: `node scripts/budget-evaluation-pilot.mjs`. Usa el mismo selector de precios del runtime, verifica 272.000/272.001, totales y 24 paquetes completos admitidos, con contraste del corte anterior. Conserva seis decimales y redondea solo al presentar. Ver [informe de la corrección](CORPUS_Y_TARIFAS.md).
