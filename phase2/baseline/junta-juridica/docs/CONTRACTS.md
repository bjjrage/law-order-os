# Contratos del prototipo — revisión de auditoría V2

Definiciones ejecutables: src/domain/contracts.ts. La revisión cambia la confianza, la publicación de versiones y el gate; no migra históricos automáticamente.

AccessContext procede del host autenticado, nunca de documentos/modelos. Encargo mantiene ámbito, usuario, cuestión, jurisdicción, fecha, documentos, snapshots y techo de costo. La CLI es local de operador.

## Ingesta y confianza

ingestText acepta originales UTF-8, páginas separadas por form-feed, offsets UTF-16 y spans acotados. Rechaza AUTHORIZED_ORIGINAL o authority_record autodeclarados. Los campos se conservan en DocumentSchema para reconocer históricos, pero no conceden confianza al checker.

OfficialEvidenceRegistry recibe claves públicas Ed25519, key_id, verified_by y hosts permitidos desde configuración del host. OfficialAttestation contiene claims firmados: schema_version, key_id, verified_by, document_fingerprint (hash del documento completo), original_hash_sha256, source_url HTTPS exacta, verified_at, expires_at y rights_record. Rechaza claves desconocidas, cambios, origen no permitido, fixtures y fechas inválidas/vencidas.

importAttestedText valida original y atestación de un verificador externo. validateEvidenceBundle valida bytes/extracción, firmas y snapshots antes de red; el bundle no acepta claves de confianza. No hay firmador ni verificador gubernamental conectado en este prototipo.

## Versiones y snapshots

LocalEvidenceIndex almacena todas las versiones inmutables. publishVersion(document_id, document_version_id) establece el puntero vigente por decisión del host. El constructor admite current_document_versions explícito. Una única versión puede usarse sin puntero; varias sin publicación producen CURRENT_DOCUMENT_VERSION_REQUIRED. Insertar versiones no publica ni revierte ninguna. Los snapshots históricos siguen resolviendo originales.

## Checker y gate

Detector independiente con familias extensibles; extractor produce citas y marcadores pendientes; resolver encuentra candidatos por identidad. Comprueba metadatos, tipo, versión y procedencia vigente. Cita textual normaliza solo whitespace y conserva offsets originales.

CitationCheck incorpora provenance_status (TRUSTED_OFFICIAL / SIMULATION / UNTRUSTED) y resumen de atestación. VERIFIED requiere confianza oficial vigente e identidad/cita comprobadas; SIMULATED_VERIFIED requiere modo de simulación explícito. El flag de fixture por sí solo no autentica.

checkAnalysis inspecciona prosa, hechos y raw_text de referencias; devuelve verification_gate. Si cualquier marcador queda pendiente o una cita no verifica, el gate es REVIEW_REQUIRED. Orquestador deja PARTIAL; exportador suprime todas las etiquetas de verificación. HUMAN_REVIEW_PENDING sigue siendo borrador, nunca aprobación automática.

## Ejecución

Se conserva Jev → Luna → Sol Medium → Gemini → checker → humano, recuperación adicional acotada, permisos por ámbito, presupuesto por intento, cancelación y recuperación sin replay. JSON de modelos se valida con Zod estricto.

El hash de idempotencia incluye política de verificación V2 y fingerprint del registro de confianza. Entrada cambiada bajo el mismo request_id produce conflicto. Reutilizar un run pendiente de revisión revalida procedencia; si venció se vuelve PARTIAL sin repetir modelos.

Gemini recibe límite configurable y análisis íntegro. Se persiste audit-coverage con IDs, hash, cobertura previa, cota de tokens y omitted_by_auditor vacío; exceso bloquea antes de invocar. Ventanas ausentes o insuficientes bloquean disponibilidad. Sin fragmentación automática.

