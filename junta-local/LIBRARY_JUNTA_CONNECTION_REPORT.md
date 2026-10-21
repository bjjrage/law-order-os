# Biblioteca conectada a Junta — 14 de octubre de 2026

La preparación de una nueva consulta busca legislación y jurisprudencia usando la pregunta, el área del derecho y el texto de los documentos seleccionados. La búsqueda se realiza localmente: no envía el caso a un buscador externo ni usa inferencia paga. El abogado principal y el auditor reciben los fragmentos seleccionados como bibliografía separada de los hechos del expediente.

## Uso

1. Abrir el asunto y Consultar Junta.
2. Cargar o seleccionar el documento y escribir la pregunta.
3. «Buscar fuentes · sin gasto de IA» permite revisar los resultados antes del análisis.
4. «Consultar Junta · hasta USD 0,60» incorpora esas fuentes a la deliberación bajo la autorización existente del botón.

«Fuentes de la consulta» distingue las publicaciones encontradas, las entregadas para el análisis y las citadas mediante identificadores y versión coincidentes. Incluye enlace oficial, página del PDF, fragmento y cotejo literal de las citas cuando lo hay. Las referencias localizadas solo por título se muestran aparte y no se entregan como fundamento leído. El informe HTML y el borrador del asunto conservan las fuentes.

Las consultas históricas permanecen intactas: no se agregan retrospectivamente fuentes que no recibió la Junta. Para incorporar la Biblioteca se debe iniciar una nueva consulta.

## Cobertura comprobada

- 5.290 referencias del catálogo: búsqueda en títulos y metadatos.
- Siete publicaciones oficiales con texto digital extraído mediante Mozilla PDF.js: Constitución, Código Civil, Código Procesal Civil, Código Penal, Código Procesal Penal y Gacetas Judiciales 2/2014 y 4/2024. Total: 1.764 páginas.
- Originales PDF y sus hashes conservados en `local-browser/library/research/originals/`; índice en `local-browser/library/research/index.json`.
- No se declara cobertura universal, actualización normativa completa ni indexación del texto de las 5.290 referencias. Los compendios judiciales no se hacen pasar por originales individuales de sentencias.
- Si no se encuentra jurisprudencia con texto pertinente, se informa expresamente. La selección por palabras clave es candidata; corresponde al análisis y al abogado comprobar la pertinencia.

## Integridad y controles

La preparación congela fuentes, páginas, fragmentos y versiones dentro de su hash. El Core incluye la bibliografía en el hash de entrada y persiste una copia inmutable; las entradas del abogado y auditor quedan registradas. El relator sigue separando hechos y alegaciones de los documentos privados. Las referencias de Biblioteca no ingresan como hechos documentales.

No se modificó el registro de verificadores externos ni se emitieron atestaciones propias. Una cita bibliográfica sin identidad comprobada permanece pendiente de cotejo y puede dejar el resultado parcial, aunque se conserve el informe y el enlace. Un cotejo literal positivo solo demuestra coincidencia con el fragmento extraído; no certifica vigencia, autenticidad de un fallo ni aplicabilidad jurídica.

El sincronizador descarga exclusivamente desde dominios oficiales permitidos, controla los destinos de redirección y limita tamaño/páginas; no acepta URLs aportadas por el caso. Actualización manual gratuita: `npm.cmd run library:research:sync`. Reutiliza los originales descargados; no es un monitor periódico de reformas.

## Validación

- Compilación Core y web, y verificación de tipos satisfactorias.
- 271 pruebas Core aprobadas.
- 23 pruebas locales aprobadas: búsqueda, exclusión de fuentes futuras/inseguras, ausencia honesta de jurisprudencia, cotejo de citas, exportación segura, presupuesto/autorización y ausencia de repetición de llamadas.
- Integración con los cuatro adaptadores mediante HTTP exclusivamente simulado: abogado y auditor reciben los fragmentos; una cita no autenticada sigue requiriendo revisión.
- Navegador con backend real: carga del contrato sintético, búsqueda local y visualización de fragmentos de publicaciones oficiales, sin ejecutar Junta paga. Captura: `reports/library-real-retrieval-preview.png`.
- Investigación del contrato de la consulta histórica: `reports/library-contract-retrieval.json` y `reports/FUENTES_CONTRATO_BUSQUEDA_LOCAL.html`. Son resultados de búsqueda nuevos, no una deliberación nueva ni una modificación del informe histórico.

No se ejecutaron llamadas pagas ni despliegues.


## Actualizacion 2026-10-14: RAG ampliado

El indice persistente SQLite contiene 743 documentos con texto y 21.208 fragmentos: 205 decretos, 207 leyes, cuatro codigos, una Constitucion y 326 publicaciones jurisprudenciales. La Biblioteca y la preparacion de nuevas consultas usan ese indice. Ver junta-local/RAG_EXPANSION_REPORT.md para cobertura, faltantes y validacion. No hubo llamadas pagas ni despliegues.
