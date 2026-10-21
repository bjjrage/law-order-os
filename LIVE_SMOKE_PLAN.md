# Fase 2 — un único smoke real propuesto

Estado: **BLOCKED / inferencia NOT_RUN / autorización de gasto pendiente**. Exactamente un escenario: `phase2-one-question-one-source`, request `phase2-live-smoke-001`. Su definición está en `phase2/reports/model-connectivity-smoke-plan.json`. No hay originales ficticios presentados como oficiales ni pack real inventado.

La cuestión propuesta es: «¿Qué requisito probatorio expresa la resolución seleccionada para la cuestión delimitada y qué límites declara para aplicarlo?». El expediente será exclusivamente de prueba y no contendrá datos confidenciales. Un abogado deberá elegir un único pasaje suficiente de una resolución auténtica y precisar el requisito a analizar antes de congelar el plan. Una variación de pregunta obliga a regenerar sus hashes y revisar el plan.

## Evidencia y revisión previa

El bundle debe conservar el original, extracción UTF-8 exacta compatible con el importador actual, metadatos contrastados, snapshot, versiones publicadas y atestación de un verificador autorizado por el host. El manifiesto `OFFICIAL_CORPUS_MANIFEST.json` registra tres PDFs oficiales realmente recuperados, uno por sala. Sin embargo, el importador del engine valida originales UTF-8 y no acepta un PDF binario con texto extraído independiente: **la incorporación de esos PDFs al checker permanece BLOCKED**. El constitucional requiere OCR, por ser imagen. Extracción y trust del host todavía no están aprobados. No sustituir los bytes originales por texto para simular compatibilidad ni generar una firma local para convertir una descarga en procedencia oficial aprobada.

El EvidencePack inicial conserva completo el único candidato como UNCERTAIN; su selección todavía no fue decidida por Jev. El preflight coteja su hash interno, hash de archivo canónico, scope, snapshot y pasaje exacto contra el bundle validado. Jev producirá su propio pack de routing trazado durante el smoke; el pack inicial congelado no es un resultado generado anticipadamente. Se limita la cobertura a ese pasaje y se informa esa limitación. No se evalúa exhaustividad de toda la jurisprudencia ni calidad jurídica general.

Hoy ambos hashes son null y el corpus/trust requerido falta: **no existe todavía un EvidencePack real congelado**. El plan se entrega como preparación bloqueada. Cuando exista, el preflight puro `assessLiveSmokeReadiness` debe aprobarlo sin red, sin escritura y sin inferencia. Las pruebas de esa función usan originales/verificadores desechables de tests y no acreditan corpus real.

## Presupuesto verificable, sin consumo

Tarifas públicas STANDARD de texto consultadas el 2026-10-13; sin caché, herramientas, búsqueda, imágenes, Batch ni Flex. Fuentes y tarifas: `phase2/reports/model-connectivity-standard-prices.json`.

| Etapa | Entrada máxima reservable | Salida máxima | USD entrada/salida por millón | Cota USD |
|---|---:|---:|---:|---:|
| Jev | 24000 | 4000 | 0.042 / 0 | 0.001008 |
| Luna | 60000 | 16000 | 0.10 / 0.50 | 0.014000 |
| Sol medium | 60000 | 25000 | 2 / 10 | 0.370000 |
| Gemini | 100000 | 16000 | 0.75 / 3.75 | 0.135000 |
| Total | | | | **0.520008** |

Presupuesto duro total: **USD 0.60**. Cota por etapa derivada de sus máximos de entrada/salida, una llamada máxima por etapa y reserva previa del engine. Candidate limit=1, router batch=1, max_retrievals=0, max_retries=0 evitan ciclos adicionales. Timeout por llamada 120000 ms; metadatos 15000 ms. Si no cabe, se bloquea sin truncar. No repetir un run de resultado incierto ni crear otro request para evadir idempotencia.

La fórmula es `(input_limit * rate_input + output_limit * rate_output)/1000000`; salida Sol incluye razonamiento, salida Gemini incluye thinking. Estimación, reserva y factura real permanecen separadas. Estas tarifas no confirman contrato, créditos, impuestos ni factura de la cuenta. Precios caducan para este plan el 2026-10-20: revalidar antes de autorizar. Google anuncia cambio el 2027-01-01; las tarifas actuales no se reutilizan entonces. [Google precios](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash), [TypeSafe](https://docs.typesafe.ai/models), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

## Preflight local y comando futuro

La CLI `live-preflight` evalúa sin red, inferencia ni escritura de runs. Con los artefactos actuales y sin bundle devuelve BLOCKED de forma esperada:

```powershell
node scripts/board.mjs live-preflight --plan phase2/reports/model-connectivity-smoke-plan.json --price-file phase2/reports/model-connectivity-standard-prices.json --metadata-file phase2/reports/model-connectivity-account-proofs.json
```

El wrapper `live-smoke` ya está IMPLEMENTED: exige `--authorize-paid-calls` antes de leer archivos, ejecuta el preflight puro antes de cualquier GET, crea proveedores y motor con `plan.config` exacto, revalida disponibilidad de cuenta y conserva plan, assessment y pack como evidencia del run. No se ejecutó inferencia por esa ruta.

Solo después de resolver todos los bloqueos y recibir autorización explícita de gasto, usar el siguiente comando. Las rutas `phase2/live-smoke/` son destinos previstos que todavía no existen; el plan necesita hashes reales en lugar de null y el archivo de metadatos necesita pruebas de cuenta auténticas y recientes:

```powershell
node scripts/board.mjs live-smoke --authorize-paid-calls --plan phase2/reports/model-connectivity-smoke-plan.json --price-file phase2/reports/model-connectivity-standard-prices.json --metadata-file phase2/reports/model-connectivity-account-proofs.json --bundle phase2/live-smoke/bundle.json --evidence-pack phase2/live-smoke/evidence-pack.json --trust-file phase2/live-smoke/trusted-verifiers.json --data-dir phase2/live-smoke/runs --output phase2/live-smoke/result.json
```

Este comando es una referencia operativa condicionada, no autorización. La configuración debe mantener los cuatro IDs aprobados y Sol medium; no colocar claves en el comando ni archivos del repositorio. El preflight no permite que un archivo de metadatos autodeclarado sustituya la revalidación real de cuenta realizada inmediatamente antes de inferir.

Registrar request/run ID, hashes de entradas/salidas, manifiestos de cobertura, tokens reportados/razonamiento, reservas/estimaciones/costos reales cuando existan, latencias y errores seguros. Checker conectado al mismo corpus/trust con revalidación; resultado siempre draft=true, human_approval=PENDING. Una respuesta del modelo no acredita autenticidad ni presentación judicial.

Bloqueos actuales: claves/model config Jev/OpenAI; Gemini HTTP401/config; metadata de cuenta fresca para los cuatro IDs; integración de originales PDF con extracción revisada y atestación confiable; bundle y pack congelados; confirmación de tarifas efectivas y autorización futura de gasto. USD consumidos: 0.
