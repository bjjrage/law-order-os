# OS Core — flujo del primer alcance y evidencia

Fecha: 2026-10-13, America/Asuncion. Resultado de servicio: **PASS / TESTED_OFFLINE**. Resultado E2E persistente con usuarios reales: **BLOCKED / NOT_RUN**. No hay VERIFIED_REAL.

El alcance autorizado permite componentes aislados TypeScript cuando falta decisión empresarial. Se implementaron contratos, política de servicio y pruebas de seguridad, usando exclusivamente identidades sintéticas y persistencia volátil de pruebas. No se construyó una pantalla de login, servidor HTTP ni base ficticiamente productiva. El Gate B1 queda documentado por contrato completo y bloqueo de infraestructura, no por afirmar E2E real.

## Los 14 pasos

El test `executes all 14 requested service steps...` en `os-core/tests/core.test.ts` ejecuta el flujo con nombres/datos sintéticos:

| Paso | Evidencia ejecutada | Estado |
|---|---|---|
| 1. Administrador crea estudio | Credencial de prueba → estudio y membresía administradora atómicos | TESTED_OFFLINE |
| 2. Incorpora segundo abogado | Alta explícita de membresía LAWYER de identidad del directorio de prueba | TESTED_OFFLINE |
| 3. Abre cliente | Organización sintética, separada de contacto y parte relacionada | TESTED_OFFLINE |
| 4. Crea asunto | Asunto ADVISORY; no se presupone expediente judicial | TESTED_OFFLINE |
| 5. Asigna responsable | Responsable y participantes explícitos en la misma transacción de apertura | TESTED_OFFLINE |
| 6. Incorpora documento | Bytes originales, versión/hash, publicación explícita | TESTED_OFFLINE |
| 7. Crea tarea | Responsable autorizado; vencimiento interno opcional | TESTED_OFFLINE |
| 8. Abogado consulta asunto | Membresía + participación + READ efectivos en servicio | TESTED_OFFLINE |
| 9. Usuario sin permiso intenta acceder | Identidad sintética válida sin membresía | TESTED_OFFLINE |
| 10. Acceso rechazado | ACCESS_DENIED; suite adicional cubre otro estudio y mismo estudio sin participación | TESTED_OFFLINE |
| 11. Abogado prepara borrador | Original de borrador inmutable, autor y versión | TESTED_OFFLINE |
| 12. Revisor recibe tarea | Tarea PENDING consultable por el revisor; no se envía comunicación externa | TESTED_OFFLINE |
| 13. Acción explícita aprueba | Revisor designado, distinto del autor, confirmación true y versión exacta | TESTED_OFFLINE |
| 14. Aprobación registrada | Evento DRAFT_APPROVED con actor/borrador/versión/fecha en la misma transacción | TESTED_OFFLINE |

Un test separado prueba que un adaptador nuevo no conserva datos: demuestra el límite de la prueba, no persistencia. Recarga de navegador, nuevo proceso y sesión real siguen BLOCKED. No se presentó nada ante un juzgado.

## Pruebas y reproducción

Suite propia: **42/42 PASS**, 3 archivos de tests, sin red. Typecheck de servicio/tests PASS. Compilación aislada PASS. Evidencia JSON: `os-core/test-results.json`. El número de suites del JSON de Vitest puede incluir bloques `describe`; los archivos ejecutados son core.test.ts, review.test.ts y persistence.test.ts.

Desde la raíz del proyecto:

```powershell
node node_modules/typescript/bin/tsc -p os-core/tsconfig.test.json
node node_modules/typescript/bin/tsc -p os-core/tsconfig.build.json
node node_modules/vitest/vitest.mjs run --config os-core/vitest.config.ts --reporter=json --outputFile=os-core/test-results.json
```

El build escribe biblioteca en `dist/os-core`; excluye `testing` y no crea un servicio ejecutable. El runner usa el bloqueo de fetch existente de Junta. Ninguna prueba necesita credenciales, una API paga o un despliegue.

Cobertura: aislamiento de estudios/asuntos con IDs conocidos, identidad con varias membresías, administración sin acceso implícito a asuntos, membresía/revisor revocados, roles máximos, payload con tenant inyectado, sesión inválida/expirada, separación cliente/contacto/partes, versiones/hash originales, CAS concurrente, rollback, copia de datos, rechazo de reemplazo inmutable, tareas y revisiones, self-review, versión desactualizada, revisión superada, nueva versión posterior a aprobación, rechazo de aprobar por completar tarea/descargar y actividad sin texto privado.

Las regresiones no prueban políticas de una base ni un IdP real. El servicio confía en los adaptadores del host; los de pruebas están rotulados y separados. Tampoco acredita una política final de roles, conciliación con Blueprint o seguridad empresarial completa.

## Bloqueos y siguiente paso

1. Blueprint/Roadmap/handoff ausentes: conciliar entidades, roles y muros por cliente/asunto.
2. ADR OS-001 pendiente: seleccionar aplicación, base, IdP y almacenamiento con aprobación explícita.
3. Proveer ambiente de desarrollo, usuarios sintéticos reales del IdP y adaptador durable con políticas/constraints multiestudio.
4. Ejecutar el mismo flujo mediante transporte real, reiniciar/recargar e iniciar una nueva sesión, verificar bytes y aprobación conservados y accesos ajenos rechazados. Solo entonces evaluar VERIFIED_REAL del ambiente concreto.

No hubo inferencias ni gastos de proveedores en este frente. No se hicieron despliegues, migraciones, cambios de Junta ni cambios en otros proyectos.
