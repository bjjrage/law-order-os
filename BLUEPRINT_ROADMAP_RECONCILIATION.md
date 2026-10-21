# Addendum de conciliación — Fase 2

Fecha: 2026-10-13, America/Asuncion. Este documento no sustituye ni reconstruye un Blueprint/Roadmap ausente. Los V1.1 y handoff se buscaron en el proyecto y no se encontraron. Baseline e inventario conservan evidencia de la ausencia.

Precedencia aplicada: decisiones expresas posteriores → ADR-001/contratos efectivos reconciliados → código como evidencia implementada → Blueprint/Roadmap en módulos no sustituidos cuando se aporten → informes históricos. No se presenta un diseño como implementación verificada.

| Área del producto | Decisión/estado actual | Próximo gate |
|---|---|---|
| Junta | Motor propio Jev → Luna → Sol6.1 medium → Gemini → checker → abogado; IMPLEMENTED / TESTED_OFFLINE | Cuenta, corpus confiable y evaluación real |
| Topología clínica/Mussi/Haiku | Reemplazo histórico registrado por directiva/ADR-001; no se clona ni se vuelve a 3→2→1 | Mantener decisión posterior al reconciliar V1.1 |
| Checker/procedencia | Separado de consenso de modelos, firmas de emisor confiable y gate cerrado | Política/emisor del host, extracción y corpus aprobados |
| Corpus | Tres PDFs oficiales recuperados y observados; no autenticados para checker productivo | OCR/revisión, identidad penal, derechos/privacidad y atestaciones |
| Benchmark | Nueva medición congelada, un FAIL de extracción y validación real BLOCKED | Curaduría independiente y evidencia confiable |
| Estudios, identidades, membresías, roles | Contratos/servicio aislado IMPLEMENTED / TESTED_OFFLINE | Conciliar política con V1.1 y resolver ADR OS-001 |
| Clientes, contactos y partes | Separados en contratos/servicio | Reglas empresariales y privacidad por cliente |
| Asuntos/participantes | Asunto puede ser judicial o extrajudicial; permisos explícitos | Persistencia/auth reales |
| Documentos/versiones | Original inmutable y publicación explícita, servicio probado offline | Almacenamiento durable autorizado |
| Tareas/escritos/revisiones | Vencimientos internos y borrador/revisión explícita, probados offline | UI, entrega y persistencia reales |
| Agenda/plazos procesales | NOT_RUN; no cálculo de plazos jurídicos por LLM | Requisitos/validación jurídica |
| Comunicaciones | NOT_RUN | Canales, permisos y decisión de envío |
| Honorarios/gastos/cobros | NOT_RUN | Contratos y controles financieros |
| App multiusuario | BLOCKED: backend/DB/auth no adoptados | Decisión empresarial explícita y E2E durable |
| Producción/comercial | BLOCKED | Seguridad, calidad jurídica, derechos, operación, costos y revisión humana |

## Roadmap propuesto, no marcado como implementado

1. Incorporar V1.1/handoff auténticos y conciliar módulos, roles y alcance sin reintroducir topología sustituida.
2. Resolver ADR OS-001: persistencia/backend/autenticación; aplicar contratos neutrales y políticas del servicio a infraestructura aprobada.
3. Resolver política de confianza y extracción de corpus; adaptar ingreso PDF preservando original/extracción distintos.
4. Validar cuenta/modelos/ventanas y congelar un único smoke con presupuestos, sin inferencia hasta autorización futura.
5. Implementar vertical slice persistente con usuarios/sesiones reales y probar recarga, aislamiento y aprobación de versión.
6. Evaluación jurídica independiente y gates comerciales/técnicos antes de cualquier producción.

Estado de cada artefacto se distingue entre IMPLEMENTED, TESTED_OFFLINE, VERIFIED_REAL, BLOCKED y NOT_RUN. Las firmas de prueba, mocks y porcentajes sintéticos no sustituyen aprobaciones.

