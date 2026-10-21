# Fase 2 — revisión de seguridad factual

Fecha: 2026-10-13. Alcance: código, regresiones locales, corpus observado y permisos del servicio aislado. No es una certificación productiva.

| Control | Evidencia comprobada | Límite pendiente |
|---|---|---|
| Citas literales y cierre del gate | Corrección de comillas no reconocidas/incompletas/múltiples; integración deja PARTIAL y QUOTE_MISMATCH | Referencias semánticas arbitrarias y números en palabras no tienen cobertura exhaustiva |
| Ed25519 y emisor | Firma válida de emisor no autorizado rechazada; hash/URL/fechas/derechos y mutaciones probados | Política, claves y emisor confiable del host no configurados para corpus real |
| Caché | Expiración/revalidación sin replay; política3 invalida reutilización bajo hash antiguo | Gestión operativa de revocación y sesiones a cargo del host |
| Versiones | Publicación explícita, múltiples candidatas bloqueadas, históricos e aislamiento probados | Autorizar quién publica en entorno empresarial |
| Auditor/contexto | Ventana afirmativa, límite/configuración, manifiesto, bloqueo sin truncamiento | Ventana y calidad de cuenta reales no confirmadas |
| Disponibilidad de proveedores | OpenAI/Jev revocan permiso tras fallo de revalidación; Gemini ya lo hacía | Google GET 401; otros sin claves, generación no ejecutada |
| Gasto | Flag previo a lectura, preflight puro, plan exacto, techo, máximo cuatro llamadas futuras y sin reintentos | No existe autorización de gasto ni confirmación de factura/cuenta |
| Multiestudio OS Core | Membresía, rol y participación efectivos en servicio; IDs ajenos rechazados | No hay auth real, servidor ni políticas de base de datos desplegadas |
| Documentos/aprobaciones | Originales/versiones inmutables, hash al leer, revisión explícita vinculada a versión | Persistencia durable, retención, cifrado y backups pendientes |
| Actividad/secretos | Eventos sin contenido documental, tokens solo en adaptador de prueba; no claves en artefactos | Observabilidad, auditoría durable de rechazos y redacción HTTP a implementar en host |

## Evidencia real de corpus, sin elevar confianza

Se observaron tres descargas HTTPS oficiales, preservadas con hashes y páginas renderizadas localmente. No se saltaron login, CAPTCHA ni controles de acceso. No se llamó a generación/OCR cloud.

El constitucional es escaneado; OCR/transcripción revisada pendiente. Civil/penal tienen texto digital aún sin revisión integral. El número/fecha penal se vincula mediante publicación oficial, sin imprimirse en el encabezado PDF. Es una limitación de identidad contextual explícita.

Los tres permanecen UNVERIFIED_FOR_CHECKER, con production_indexing_permitted=false y host_trusted_attestation=ABSENT. Firma visible, hash y HTTP 200 no se equiparan a validación criptográfica judicial ni a autorización empresarial. La base legal de textos judiciales oficiales se documenta con fuente estatal y requiere revisión del host para privacidad/uso productivo.

El benchmark nuevo no produce VERIFIED ni SIMULATED_VERIFIED; esa denegación no demuestra exactitud jurídica. Las métricas bloqueadas permanecen null.

## OS Core y política propuesta

Los permisos viven en el servicio confiable, no en botones. Identidad no concede membresía; membresía no concede todos los asuntos; administrador también necesita participación explícita. Roles/capacidades son una política de referencia aislada, pendiente de conciliación con Blueprint y decisiones empresariales.

El revisor es distinto del autor, se exige confirmación explícita y versión exacta; edición invalida revisiones previas. Ninguna descarga/tarea completada equivale a aprobación ni presentación judicial.

Los adaptadores de memoria e identidad sintética están excluidos del build del servicio. Persistencia y autenticación reales siguen BLOCKED; no se extrapolan tests de mocks a seguridad de una app multiusuario en producción.

## Dictamen

Regresiones locales y aislamiento de servicio: TESTED_OFFLINE. Origen de archivos públicos observado: VERIFIED_REAL en ese alcance específico. Validación jurídica/autenticidad operativa, E2E durable y producción: BLOCKED / NOT_RUN. Inferencias pagas y despliegues: cero.

