# Limitaciones conocidas tras la remediación

El motor sigue siendo experimental offline; estos cambios no habilitan un piloto pago ni validación jurídica productiva.

| Área | Estado | Límite |
|---|---|---|
| J-002, autodeclaración de autoridad | Corregido y probado localmente | Un bundle no aporta claves de confianza. Sin atestación válida no hay VERIFIED. |
| Procedencia oficial real | BLOCKED | No se conectó un importador gubernamental ni un emisor real de atestaciones. El host debe verificar origen, metadatos, extracción y derechos antes de firmar; no se incluye firmador productivo. |
| J-001, omisiones silenciosas conocidas | Corregidas y probadas | Gramática extensible finita. Ningún parser garantiza detectar toda referencia arbitraria. Palabras genéricas pueden bloquear por precaución. |
| Evaluación bibliográfica independiente | BLOCKED | V1 ya era conocido; V2 se congeló antes de evaluar y reveló un defecto corregido. V2 también queda como regresión conocida. |
| J-003, vigencia por orden de carga | Corregido y probado | publishVersion es una decisión del host confiable. No infiere vigencia jurídica de una norma. |
| J-004, contexto del auditor | Configurable y probado offline | Conserva 100K por defecto, configurable hasta 1M local; debe caber en la ventana comprobada del modelo. Sin fragmentación automática; exceso bloquea sin omitir material. |
| J-005, APIs y facturación | BLOCKED / NOT_RUN | Ninguna consulta externa ni generación real en esta remediación. |
| Corpus oficial y exactitud jurídica | BLOCKED / NOT_RUN | Solo fixtures y verificadores desechables de tests; ninguna sentencia estatal auténtica validada. |
| Blueprint/Roadmap/handoff/auth del OS | BLOCKED | AccessContext proviene del host; CLI de operador no autentica clientes remotos. |
| PDF/OCR, embeddings, escala >1M tokens | NOT_RUN | Ingesta UTF-8 y RAG local; interfaces externas pendientes. |
| Persistencia productiva | NOT_RUN | JSON local sin cifrado, migraciones, backups ni HA; publicación inmutable requiere hardlinks. |
| Tokenización previa y factura | NOT_RUN | Cota por bytes + margen, no tokenizer exacto. Costos reales desconocidos permanecen null. |

Una firma Ed25519 prueba correspondencia con un verificador configurado; no demuestra independencia del verificador, corrección jurídica ni derechos efectivos por sí sola. La administración segura de claves, revocación y autorizaciones corresponde al host. Quitar una clave impide nuevas verificaciones; expiración se reevalúa en cada consulta al registro y exportación.

El snapshot local sigue siendo compuesto: expediente/corpus comparten ID. Recuperación filtra jurisdicción y fecha; una norma aplicable y un dictamen correcto requieren juicio profesional.

Siempre se conserva borrador y revisión humana. Referencias sin resolver detienen el cierre del run, aunque el borrador parcial siga disponible para revisión.

