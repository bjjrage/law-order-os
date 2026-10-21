# Fase 2 — bloqueos y decisiones pendientes

Fecha: 2026-10-13, America/Asuncion. Se completaron los trabajos preparatorios sin fijar infraestructura ni confianza productivas por suposición.

| ID | Bloqueo factual | Trabajo realizado / condición para resolver |
|---|---|---|
| P2-DOC | Blueprint/Roadmap V1.1, handoff e investigación F1 ausentes en proyecto | Addendum de conciliación y baseline. Aportar versiones autoritativas y reconciliar. |
| P2-OS | Backend, persistencia y autenticación empresariales sin decisión autorizada | ADR OS-001 pendiente, contratos/servicio y 42 tests. Elegir infraestructura y adaptadores; luego E2E durable. |
| P2-TRUST | No hay política/emisor/clave de confianza aprobados para originales reales | Registro y rechazo de autodeclaración probados. El host debe autorizar verificador; no generar firmas locales para conseguir VERIFIED. |
| P2-PDF | Importador de bundle actual exige original UTF-8, no PDF binario con extracción separada | Tres PDFs preservados, PDF.js local. Diseñar/implementar adaptador aprobado preservando original y trazabilidad de extracción. |
| P2-OCR | Constitucional1010 es imagen sin texto | Original y 13 páginas conservados; OCR/transcripción y revisión humana pendientes. |
| P2-REVIEW | Extracción civil/penal sin revisión integral; número/fecha penal solo en publicación vinculante | Imágenes, texto y discordancias registrados. Verificador debe resolver antes de atestar. |
| P2-RIGHTS | Política productiva de privacidad/reutilización no aprobada | Fuente estatal de Ley1328 artículo8(2), integridad/atribución documentadas; production_indexing_permitted=false. |
| P2-GRAMMAR | FAIL de extracción numérica del encabezado civil en palabras | Referencia detectada y gate cerrado. No ajustar el conjunto medido; ampliar por development y congelar evaluación nueva. |
| P2-BENCH | No autenticación/cotejo real ni par auténtico para ambigüedad; curaduría externa ausente | 12 casos nuevos y primera medición preservada, métricas bloqueadas null. |
| P2-KEYS | Jev/OpenAI sin claves/configuración; Gemini GET401 y model var ausente | Sin claves impresas, ni modelos de cuenta identificados. Configurar en entorno seguro y consultar metadatos no generativos. |
| P2-PRICE | Tarifas públicas no confirman contrato/factura; plan expira 2026-10-20 | Cota pública USD0.520008 y techoUSD0.60, preflight implementado. Revalidar tarifas/cuenta antes de gasto. |
| P2-PACK | Bundle/EvidencePack real no congelados; hashes null | Plan único y wrapper preparados. Resolver confianza/extracción y congelar input completo. |
| P2-SPEND | Inferencia paga todavía no autorizada | NOT_RUN. No ejecutar live-smoke hasta resolver bloqueos y recibir autorización futura explícita. |
| P2-DEPLOY | Deploy/push/migraciones de producción fuera del alcance | NOT_RUN; no se hicieron. |

El error Google401 no se reintentó. No se envían claves por chat ni se incorporan al repositorio. La ausencia de un ID en un listado no se convierte en inexistencia universal ni autoriza sustituir el modelo.

Siguiente paso exacto: resolver ADR OS-001 y política de confianza del corpus con las fuentes autoritativas. Después revisar extracción/identidad/derechos, conectar el ingreso PDF y congelar el paquete; completar metadatos de cuenta sin generación. La autorización de gasto será un paso posterior, no una condición para leer estos informes.

