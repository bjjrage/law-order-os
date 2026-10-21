# Conectividad de modelos tras la remediación

No se ejecutaron GET autenticados, inferencias reales ni solicitudes externas. La inspección de presencia de variables figura en reports/connectivity-remediation.json, network_used=false.

| Etapa | ID exigido por el prototipo | Contrato con HTTP falso | Cuenta/generación |
|---|---|---|---|
| Jev | jev-1.13.0 | PASS | BLOCKED: falta JEV_API_KEY / generación NOT_RUN |
| Luna | gpt-6-luna | PASS | BLOCKED: falta OPENAI_API_KEY / generación NOT_RUN |
| Sol | gpt-6.1-sol, medium | PASS | BLOCKED: falta OPENAI_API_KEY / generación NOT_RUN |
| Gemini | gemini-3.8-flash | PASS | BLOCKED: falta GEMINI_AUDITOR_MODEL / generación NOT_RUN |

Estas comprobaciones no muestran ni copian claves. Documentación e IDs de configuración no acreditan acceso a cuenta. Se conserva bloqueo sin sustituciones o fallback a mocks.

Jev usa elección/puntuación nativas; no determina autenticidad. OpenAI usa Responses con esquema estricto, store=false y Sol medium/max_output_tokens=25000. Gemini recibe análisis íntegro y esquema estructurado.

J-004: auditor configurable mediante BOARD_AUDITOR_MAX_INPUT_TOKENS y BOARD_AUDITOR_MAX_OUTPUT_TOKENS. Metadatos deben afirmar límites suficientes; si faltan o una revalidación falla, no se permite generar. Los tests cubren presupuestos 150K/300K con transporte falso; no prueban ventanas reales, tokenización o calidad.

J-005 permanece abierto: credenciales, ID exacto accesible de Jev, corpus autorizado, tarifas efectivas y ventanas reales deben comprobarse antes de considerar gasto. Ningún gasto quedó autorizado por esta remediación.

Fuentes consultadas en la implementación original, no reconsultadas durante esta corrección: [TypeSafe API](https://docs.typesafe.ai/api), [modelos TypeSafe](https://docs.typesafe.ai/models), [OpenAI Responses/structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) y [Google Models API](https://ai.google.dev/api/models). No se presentan como validación actual de cuenta.

