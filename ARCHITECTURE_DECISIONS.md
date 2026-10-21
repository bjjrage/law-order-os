# Decisiones de arquitectura

Se conserva el motor jurídico V2, TypeScript/Node/Zod/Vitest y las interfaces separadas de evidencia, modelos y persistencia. No se incorporan infraestructura cloud, nuevos proveedores ni OS multiusuario.

| Decisión tras auditoría | Motivo |
|---|---|
| Registro de evidencia oficial con Ed25519 | Campos de documentos y consenso de modelos no conceden autenticidad. |
| Claves públicas de confianza fuera del bundle | Un documento no puede elegir quién lo autentica. No se distribuye clave privada ni firmador productivo. |
| Firma sobre documento completo y claims | Vincula bytes, extracción, metadatos, ámbito, URL, verificador, derechos y fechas. |
| Simulación explícita | Un fixture solo obtiene SIMULATED_VERIFIED en modo de simulación; su flag no concede VERIFIED. |
| Detector, extractor y resolver separados | Permite ampliar familias y conservar como objeción referencias no extraíbles. |
| Gate de conjunto cerrado | Cualquier referencia pendiente/no comprobada bloquea todas las etiquetas y deja PARTIAL. |
| Publicación explícita de versión vigente | Nombres y orden de inserción no establecen autoridad temporal. Una única versión es inequívoca; varias sin publicación bloquean. |
| Contexto de Gemini parametrizado | Límites verificados por metadatos; entrada íntegra o bloqueo con manifiesto. Sin recortes ni fragmentación oculta. |
| Revalidación sin replay | Vencimiento de procedencia invalida resultados guardados sin volver a facturar modelos. |
| Históricos y presupuesto conservados | Originales/snapshots inmutables, reserva previa, sin reintento de resultado incierto. |

La configuración de claves y publicación de versiones son capacidades del host confiable. La CLI local es de operador; no sustituye autenticación ni gestión de permisos de producción. ADR original y directiva se conservan como antecedentes; estos cambios se detallan en AUDIT_REMEDIATION.md.

