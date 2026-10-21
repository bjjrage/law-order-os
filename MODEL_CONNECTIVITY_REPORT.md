# Fase 2 — conectividad y contratos de proveedores

**Corrección posterior, 2026-10-13:** la comprobación con prioridad explícita de `.env` y el contrato documentado de listado de Jev ahora da **PASS en las cuatro etapas**. El 401 de Gemini anterior provenía de usar una variable heredada distinta; se dejó de priorizarla sobre la clave nueva guardada. Jev acepta el ID fijado aunque el listado solo contenga alias, sin cambiar el ID de las llamadas. Evidencia `junta-local/reports/metadata-corrected-20261013.json`; explicación y pruebas en `junta-local/CONNECTED_CASE_REPORT.md`. Inferencia real NOT_RUN, gasto no autorizado. Los resultados anteriores se preservan como antecedentes.

**Comprobación posterior del 2026-10-13, con las tres claves ya cargadas por el usuario:** GET de metadatos, sin inferencia ni envío de documentos. Luna y Sol PASS para los IDs configurados; Jev BLOCKED porque el listado no incluye el ID exacto requerido; Gemini BLOCKED por HTTP 401. Sin reintentos ni cuerpos remotos registrados. Evidencia: `junta-local/reports/provider-metadata-20261013.json`. Este resultado actualiza el estado de acceso observado; no habilita gasto, corpus ni generación. El informe siguiente conserva el antecedente de Fase 2.

Fecha local: 2026-10-13, America/Asuncion. Integración de inferencia: **NOT_RUN**. Gasto de inferencia: USD 0. Documentación pública, transporte HTTP falso y acceso real de cuenta se registran por separado.

| Etapa | ID aprobado/documentado | Contrato local | Comprobación de cuenta |
|---|---|---|---|
| Jev | `jev-1.13.0` | IMPLEMENTED / TESTED_OFFLINE | BLOCKED: JEV_API_KEY/JEV_MODEL ausentes. GET no ejecutado. |
| Luna | `gpt-6-luna` | IMPLEMENTED / TESTED_OFFLINE | BLOCKED: OPENAI_API_KEY/OPENAI_LUNA_MODEL ausentes. GET no ejecutado. |
| Sol | `gpt-6.1-sol`, medium | IMPLEMENTED / TESTED_OFFLINE | BLOCKED: OPENAI_API_KEY/OPENAI_SOL_MODEL/reasoning config ausentes. GET no ejecutado. |
| Gemini | `gemini-3.8-flash` | IMPLEMENTED / TESTED_OFFLINE | BLOCKED: GET oficial de listado devolvió HTTP 401; GEMINI_AUDITOR_MODEL ausente. |

Ningún modelo quedó identificado como accesible en esta cuenta. La presencia de GEMINI_API_KEY solo se registró como booleano; no se imprimió, copió ni persistió su valor. El único request autenticado real fue GET `https://generativelanguage.googleapis.com/v1beta/models`, body vacío, clave solo en header, timeout 15 s y redirects prohibidos. Es un endpoint de metadatos documentado, sin generación ni tokens de inferencia. Se conservó únicamente estado HTTP, presencia de configuración y alcance. No se guardó el body de error. No se repitió el 401.

Evidencia: `phase2/reports/model-connectivity-metadata.json`; pruebas: `phase2/reports/model-connectivity-tests.json`. El timestamp UTC del request se conserva; la fecha indicada aquí corresponde a la sesión del usuario. No se infiere facturación ni capacidad de generación a partir de GET.

## Auditoría del wire contract

- OpenAI: Responses, `store=false`, JSON Schema estricto, Sol `reasoning.effort=medium`, máximo 25000 tokens de salida. La salida de razonamiento ya está incluida en `output_tokens`: se registra sin sumarla por segunda vez. Metadatos por ID solo prueban disponibilidad del ID; no prueban por sí solos todos los parámetros ni la ventana.
- Gemini: JSON estructurado, análisis íntegro, chequeo de límites afirmativos del modelo antes de generar. Se suma `thoughtsTokenCount` a `candidatesTokenCount` para contabilidad de salida; ambos se conservan. Un exceso bloquea; no se recorta el análisis. Modelos y límites retornados se validan, sin sustituciones.
- Jev: elección y puntuación nativas, IDs versionados, validación de rango/confianza y conservación de inciertos. Cota conservadora por bytes+2048; no equivale a tokenización validada. Límites de state+pregunta y de llamada siguen acotados.
- Errores: cuerpos remotos/errores de transporte no se propagan a logs. 429 es rechazo con reintento permitido por política general; el smoke propuesto fija reintentos 0. 500, interrupciones y resultado incierto no justifican replay automático. Usage conocido se retiene ante schema inválido, incompletitud o rechazo del modelo.

Se detectó una regresión adicional: OpenAI/Jev conservaban `verified=true` después de una revalidación fallida. Se corrigió restableciendo el permiso antes de cada GET. Las regresiones prueban un GET válido, un GET 401 y rechazo local de cualquier generación posterior; solo usan transporte falso. Gemini ya tenía esta revocación.

El listado Jev documenta aliases y aclara que acepta IDs versionados aunque no aparezcan. El adapter conserva bloqueo conservador si no ve el ID exacto: no cambia a `jev-latest`, no afirma que la versión sea inexistente y requiere validación de cuenta/proveedor antes del primer gasto.

## Capacidades públicas consultadas

OpenAI Docs publica Luna/Sol con ventana 1050000 y salida 128000; los presupuestos locales son menores. [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

Google publica Gemini 3.8 Flash con entrada 1048576, salida 65536 y structured outputs; el adapter requiere metadatos afirmativos de la cuenta antes de usar sus límites configurados. [Modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [Models GET/list](https://ai.google.dev/api/models).

TypeSafe publica Jev 1.13.0, 64K totales y 32K state+pregunta máxima; el listado puede contener solo aliases. [Modelo y listado](https://docs.typesafe.ai/models), [contratos](https://docs.typesafe.ai/api).

## Gate A3

Adapters preparados y regresiones: TESTED_OFFLINE. Preflight puro y presupuesto estándar reproducible: IMPLEMENTED / TESTED_OFFLINE. CLI `live-preflight`/`live-smoke`: IMPLEMENTED; `live-smoke` exige habilitación explícita, aplica `plan.config` exacto a proveedores/motor, bloquea antes de GET si el preflight no está listo, revalida disponibilidad y conserva plan/assessment/pack. Cuenta, corpus confiable congelado y primer smoke: BLOCKED / NOT_RUN. El preflight no autentica al operador ni autoriza gasto; las pruebas ficticias nunca se exportan como prueba real. El host debe entregar comprobaciones frescas auténticas; el wrapper vuelve a verificar disponibilidad antes de ejecutar.

No se realizaron POST de inferencia, embeddings, conteo remoto de tokens, cambios de cuenta ni despliegues. Se recuperaron tres PDFs oficiales reales, uno por sala, registrados en `OFFICIAL_CORPUS_MANIFEST.json`; esto no habilita su uso por el engine. El importador actual exige originales UTF-8, no PDFs binarios con extracción separada, y el constitucional es imagen que requiere OCR. Faltan integración PDF/extracción revisada/atestación del host, configuraciones indicadas, bundle/EvidencePack congelados y confirmación de tarifas efectivas para completar el gate.

Preflight reproducible actual (BLOCKED esperado, sin red):

```powershell
node scripts/board.mjs live-preflight --plan phase2/reports/model-connectivity-smoke-plan.json --price-file phase2/reports/model-connectivity-standard-prices.json --metadata-file phase2/reports/model-connectivity-account-proofs.json
```

El comando futuro de inferencia controlada figura en `LIVE_SMOKE_PLAN.md`, usando `live-smoke`; permanece NOT_RUN. La inspección del wrapper confirmó la aplicación exacta de límites y la precedencia del gate de gasto antes de leer archivos. Las pruebas E2E/CLI del conjunto final son responsabilidad del reporte principal de Fase 2 y no se presentan aquí como inferencia real.
