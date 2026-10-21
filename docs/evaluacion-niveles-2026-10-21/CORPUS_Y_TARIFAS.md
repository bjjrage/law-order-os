# Corrección de corpus y tarifas — v0.5, 21/10/2026

**Offline; cero inferencias pagas.** Se conservan fuentes íntegras, anclajes, hechos, aportes, contradicciones y decisiones humanas. Se corrigieron la repetición de fuentes y el corte de integración de 60.000 aplicado a una cota de bytes; no se redujo el corpus a un conjunto de artículos elegido automáticamente.

## Transporte de fuentes sin pérdida

`workspace-source-packet.mjs` construye un catálogo por solicitud con el texto completo de cada fuente/pasaje. Cada aparición repetida lleva referencia al catálogo y SHA256. Conserva metadatos de cada aparición y todos los campos que no son texto de fuente. Una instrucción de codificación exige resolver referencias antes de razonar/citar y devolver citas literales. Versiones incompatibles de un mismo pasaje se rechazan. `expandSourceEvidence` comprueba hashes y permite recuperar exactamente el paquete original: se verifica igualdad profunda y que el objeto original no cambió.

El catálogo completo está **dentro de la solicitud**, también para el auditor, el redactor y las correcciones. El host y el checker conservan originales literales. En la conversación de Gabriel se comparte un catálogo entre resultados de herramientas sin alterar orden, IDs ni estado opaco de razonamiento. No se incorporan dossiers reservados ni casos/turnos futuros: se procesan exclusivamente fuentes del snapshot autorizado y su historial propio.

La medición de N06, turno 2, con contexto y dos aportes sintéticos pasa de unos 5,24 MB a 1,06 MB. La ganancia elimina copias repetidas; no acredita calidad jurídica. La matriz exacta y hashes están en [PRESUPUESTO_DETALLADO.json](operacion/PRESUPUESTO_DETALLADO.json) y [MEDICION_CORPUS.csv](operacion/MEDICION_CORPUS.csv).

Durante la prueba de contenido se descubrió que CPC-7663.txt contenía la ficha SILpy. Se regeneró desde los cuatro folios del PDF oficial, conservando su capa OCR sin inventar correcciones. La ficha se conserva como documento auxiliar y la extracción del PDF se distingue como LEY7663-PDF.txt. El manifiesto v0.4 queda preservado. Ningún caso tenía aprobación jurídica ni ejecución paga; el nuevo derivado requiere cotejo humano.

## Ventanas de contexto

`workspace-context.mjs` separa capacidad de modelo, conteo y costo. Primero usa la cota conservadora de bytes; si no permite afirmar que cabe, utiliza el conteo del proveedor OpenAI/Gemini o la envolvente local DeepSeek. Reserva espacio de salida. Un modelo desconocido, conteo inválido o bloque realmente excesivo se rechaza. La integración espera la comprobación asíncrona antes de aceptar o particionar aportes; nunca trata una promesa como un `true`.

Se aplican límites documentados, no aumentos arbitrarios: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) y [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), entrada hasta 922.000/contexto 1.050.000; [DeepSeek, metadata de modelos](https://api-docs.deepseek.com/api/list-models/), contexto total 1.048.576 incluyendo salida; [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), entrada 1.048.576 y salida 65.536. Para Gemini el control local reserva además salida dentro de 1.048.576 como criterio conservador; la consulta de disponibilidad debe acreditar al menos su entrada publicada. Los topes de salida del workflow siguen siendo menores.

DeepSeek no tiene un endpoint de conteo documentado equivalente al usado para OpenAI/Gemini. Se incorporó el [tokenizador V4 oficial](https://api-docs.deepseek.com/quick_start/token_usage/), datos locales con SHA256/procedencia, y `@huggingface/tokenizers` 0.2.0 fijado en lockfile. Se cuenta toda la solicitud serializada más 2048 de margen y se verifica que decodificar reproduce íntegramente esa solicitud. No se ejecuta el demo Python remoto. Este dato se etiqueta **LOCAL_DEEPSEEK_V4_ENVELOPE_NOT_PROVIDER_USAGE**: no se atribuye a facturación ni se usa como conteo OpenAI/Gemini. Si cambia el modelo/alias o protocolo, revalidar el tokenizador; un servidor todavía puede rechazar un tamaño que su protocolo contabilice de otra forma. La contabilidad financiera DeepSeek conserva la cota independiente de bytes, de modo que el cálculo local no rebaja reservas monetarias.

Las comprobaciones se aplican antes de invocar cualquier rol. Los paquetes de reducción conservan el documento y catálogo; si una unidad indivisible no cabe, se registra insuficiencia sin truncarla ni cambiar de modelo. Las hasta ocho llamadas de integración siguen sujetas al presupuesto global compartido.

## Precio por contexto largo

`workspace-pricing.mjs` es el selector compartido entre runtime y calculadora. Para los modelos OpenAI configurados exige tabla larga válida con umbral 272.000 y tarifas no decrecientes. Más de 272.000 aplica entrada **y salida** largas a toda la llamada, conforme a [precios oficiales](https://developers.openai.com/api/docs/pricing). Se actualizaron las filas OpenAI del inventario activo, preservando copia previa sin credenciales.

La reserva usa entrada máxima y salida máxima, con el tramo correspondiente. Si el conteo exacto permite una reserva menor, vuelve a seleccionar el tramo y revalida saldo después del `await`. La liquidación usa la entrada informada por el proveedor y su tramo; razonamiento ya incluido en salida no se suma de nuevo. Consumo superior a reserva detiene futuras reservas. Uso incierto mantiene responsabilidad, incluso tras reinicio; fallback comparte los mismos límites. No se amplió USD 0,60 ni se habilitó un techo total de gasto real.

Ejemplo Sol con 1000 tokens de salida: 272.000 de entrada cuestan USD 0,554; 272.001 cuestan USD 1,103004. El segundo no cabe en USD 0,60. Las pruebas comprueban que no se envía esa generación, y que dos reservas concurrentes del tramo largo no sobreasignan el total. Una llamada que cabe en la ventana puede ser inviable dentro del presupuesto: no se oculta ese corte.

## Evidencia offline y alcance

- Suite: [OFFLINE_TESTS.json](operacion/OFFLINE_TESTS.json), fuentes completas y reconstrucción exacta, mensajes de Gabriel, liberación N06, versiones incompatibles, límites asíncronos, fronteras de precio, liquidación/reembolso, incertidumbre/reinicio y concurrencia.
- Preparación: los 24 pares caso/turno se integran con callback sintético y catálogo completo. No se realizan solicitudes de conteo ni generación a proveedores reales.
- Sistema operativo: [AISLAMIENTO_OFFLINE.json](operacion/AISLAMIENTO_OFFLINE.json), cuatro turnos N06 con historial 0/1/2/3, dos especialistas, integración y auditorías del runtime actual; nueve generaciones sintéticas por turno. AppContainer sin capacidades, red bloqueada, canario SQLite externo inaccesible, código de solo lectura y estado global fuera del proceso. Se repitió tras cerrar el código final.
- Resultado resumido y hashes: [CORPUS_TARIFAS_OFFLINE.json](operacion/CORPUS_TARIFAS_OFFLINE.json). La verificación de preparación compara controles actuales con el código/activos de la última cápsula, rechazando evidencia obsoleta.

Reproducir: suite Vitest indicada en VERIFICACION.md; `node scripts/budget-evaluation-pilot.mjs`; `node scripts/benchmark-offline-check.mjs`; `node scripts/verify-evaluation-readiness.mjs`; regenerar manifiesto al final. La prueba nativa necesita capacidad de crear perfiles AppContainer; no necesita ni permite inferencias reales.

Quedan pendientes abogado/vigencia/aplicabilidad, cegamiento/honorarios, conteos efectivos por proveedor/recorrido y autorización financiera total. El benchmark permanece OFFLINE_ONLY y su worker mantiene transporte sintético sin salida de red. No se ejecutó la matriz paga ni se modificaron interfaz, workflow, datos o PostgreSQL.
