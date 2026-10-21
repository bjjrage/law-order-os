# ADR OS-001 — propuesta de plataforma empresarial

Estado: **PROPOSED / PENDING_OWNER_APPROVAL**, 2026-10-13. Sustituirá únicamente la decisión pendiente de `os-core/docs/ADR_OS_001_PENDING.md` cuando el propietario la acepte expresamente. Autor de propuesta: Codex; decisor: propietario. No constituye aprobación de V2 completo, gasto cloud, despliegue o inferencia.

## Decisión recomendada: alternativa B

React + Vite + TypeScript para web; API Node/TypeScript con Fastify; PostgreSQL administrado en Supabase, Supabase Auth y Storage privado; transacciones mediante `pg` en una conexión; outbox PostgreSQL y worker Node separado. Hosting propuesto: contenedores API (sirve también build estático web) y worker en AWS ECS Fargate, región específica São Paulo `sa-east-1`, al igual que el proyecto Supabase. Desarrollo local sin gasto, con Supabase local y usuarios de prueba. No se instaló ninguno de estos componentes.

La razón principal es mantener una frontera de servidor explícita para el dominio existente, documentos privados y ejecución de trabajos independiente del navegador. El OS interno no requiere SEO ni SSR para el slice. Servir web y API bajo el mismo origen simplifica cookies/CSRF. El worker podrá seguir operando fuera de las peticiones HTTP; F2–F4 funcionan con IA deshabilitada. Esta es una inferencia arquitectónica del código y alcance, no una exigencia de los proveedores. [Integración de Vite con backend](https://vite.dev/guide/backend-integration), [validación Fastify](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/).

## Alternativas y consecuencias

| Criterio | A: Next.js TS + PostgreSQL/Supabase | B: React/Vite + Node TS + PostgreSQL/Supabase |
|---|---|---|
| Reuso Core | Importable en handlers servidor; adaptación async igualmente necesaria | Importable en capa aplicación API; misma adaptación, aislada del framework UI |
| UI compacta | Igual capacidad; SSR no determina densidad | Igual capacidad; SPA apropiada a escritorio privado |
| Auth | Cookies servidor e integración de rendering; exige evitar cache de datos privados | BFF de sesión mismo origen; validación por petición, cache privado deshabilitado |
| Transacciones | Node runtime y una conexión por transacción; no varias llamadas REST | Pool pg explícito y una conexión por transacción |
| Jobs/Junta | Worker aparte o infraestructura jobs, aun con backend integrado | Worker separado desde el diseño, sin dependencia del render |
| Operación | Un proyecto web/API, pero worker adicional; self-host requiere atención a cache/replicas | Dos procesos de servidor (API/worker), build web estático; más contrato HTTP a mantener |
| Testing | Browser+handlers+SQL; límites Server/Client/caches adicionales | Browser+HTTP+dominio+SQL con transportes explícitos |
| Portabilidad | Self-host posible; no requiere Vercel | Contenedores Node y frontend estático, sin runtime propietario |

A es viable y queda descartada para este primer alcance por no aportar una necesidad demostrada de SSR frente al costo de coordinar límites/cache del framework con worker y SQL. No se afirma que Next sea incapaz de transacciones o jobs. [Self-host Next.js](https://nextjs.org/docs/app/guides/self-hosting).

C evaluada: PostgreSQL + Keycloak + almacenamiento S3 autogestionados, conservando web/API B. Su ventaja es control operativo y menor dependencia de Auth/Storage administrados; se descarta para el slice por añadir operación de identidad, actualizaciones y recuperación sin equipo operativo definido. No cambiar a C por intuición de residencia: requiere una decisión nueva con capacidad operativa acreditada.

## Componentes y fronteras

| Componente | Propuesta concreta / consecuencia |
|---|---|
| Web | `apps/web`, React/Vite TS, router y consultas tipadas, tokens de UI_COMPACT_DESIGN_SPEC; no secretos en variables VITE_. |
| API | `apps/api`, Fastify, `/api/v1`, schemas estáticos del desarrollador (nunca schemas enviados por usuario), mapeo errores seguro, límite body/rate. |
| Dominio | Mantener `os-core/src`; evolucionar puerto async y Authorization con await; preservar invariantes y 42 regresiones. |
| SQL | `packages/persistence-postgres`; pg, rol app_runtime no propietario/no BYPASSRLS; RLS y FKs compuestas, transacciones serializables/CAS con retry acotado solo de SQL seguro. |
| Identidad | Supabase Auth: email/contraseña y MFA para administradores; recuperación por canal autorizado. API mantiene sesión opaca HttpOnly y refresh token cifrado servidor; frontend no maneja token privilegiado. |
| Sesión | Cookie Secure/SameSite/Lax, comprobación Origin+CSRF para mutaciones, rotación login/refresh; validar issuer/audience/firma/expiración y sesión revocada. Membresías/permisos leídos de BD, nunca user_metadata. |
| Objetos | Bucket privado, sin upsert; key firm/matter/document/version aleatoria; catálogo SQL y finalización verificada. Proxy descarga reautoriza cada request; no URL permanente pública. |
| Jobs | Tabla outbox escrita con dominio/audit; worker reclama leases, idempotencia por evento, revalida permisos y cancelación. Sin Redis obligatorio para slice. IA apagada, sin emails externos automáticos. |
| Región | Supabase región específica sa-east-1 y ECS São Paulo; no elegir región general Americas. Residencia de logs/backups/soporte/subprocesadores debe revisarse aparte; región de cómputo no promete residencia total. |

Supabase y ECS documentan São Paulo. Su disponibilidad en una cuenta y la latencia desde Paraguay quedan NOT_RUN. [Regiones Supabase](https://supabase.com/docs/guides/platform/regions), [endpoints ECS](https://docs.aws.amazon.com/general/latest/gr/ecs-service.html).

La transacción SQL debe usar el mismo cliente de BEGIN a COMMIT/ROLLBACK. El estado de actor/tenant se establece con SET LOCAL por el servidor después de autenticar; parámetros nunca controlados por body. RLS también protege inserciones/updates, vistas y tablas relacionadas; ninguna combinación de UUID concede acceso. El puerto síncrono actual impide un adaptador pg directo: el primer cambio será neutral y probado, no una reescritura de Junta. [Transacciones pg](https://node-postgres.com/features/transactions), [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Entornos, operación y costos

Dev: Supabase local + API/web/worker locales, datos sintéticos, correo atrapado localmente. Preview: proyecto/credenciales/bucket separados, exclusivamente sintéticos, activación cloud posterior autorizada. Producción: proyecto separado y políticas aprobadas, dos réplicas API para disponibilidad propuesta; worker aislado. Secret manager/roles separados para runtime, migrador y operador; secretos no se copian por chat ni `.env` a Git. CI no despliega automáticamente al introducir un archivo.

Referencia de precio pública consultada: Supabase Pro desde USD25/mes, proyecto adicional desde USD10/mes; backups diarios con siete días en Pro; PITR es adicional desde USD100/mes. No incluye toda la plataforma, impuestos ni inferencia. Free se pausa por inactividad y no se propone como producción. [Precios Supabase](https://supabase.com/pricing).

Presupuesto **de planificación, no cotización ni gasto autorizado**, para piloto pequeño: USD25 Supabase + USD50–110 API/worker + USD20–40 balanceador/red + USD10–25 logs/backups/SMTP = USD105–200/mes, sin preview, dominio, PITR, soporte profesional, impuestos o IA. La banda AWS es una reserva de diseño; debe recalcularse con tamaño, réplicas, horas, tráfico y región en la calculadora antes de contratar. Fargate factura recursos/tiempo y puede sumar servicios de red; no presentar una tarifa de otra región como São Paulo. [Modelo de precios Fargate](https://aws.amazon.com/fargate/pricing/). Techo propuesto de evaluación: USD200/mes, necesita autorización independiente; hoy gasto nuevo USD0.

RPO propuesto piloto24h, RTO4h, sujetos a aprobación operativa. Backup SQL diario + copia cifrada diaria de objetos a cuenta/bucket separados, inventario por versión/SHA y retención propuesta30 días. Restaurar BD **y** objetos/identidad/config en entorno aislado, comprobar 14 pasos, hashes y permisos. Los backups SQL Supabase no contienen bytes Storage; no declarar recuperación completa con solo restore DB. [Backups](https://supabase.com/docs/guides/platform/backups). Para RPO menor se requiere diseño/costo PITR y copia de objetos correspondiente.

Logs estructurados request_id/actor pseudónimo/firm/matter permitidos/evento/status, sin cookies/credenciales/documentos/prompts; retención propuesta30 días; auditoría jurídica separada append-only con política pendiente. Alertas: errores/latencia API, pool agotado, outbox vencido, fallos auth, backup incompleto. Health/readiness sin datos privados. Runbook rollback por imagen previa y migraciones compatibles; nunca rollback destruyendo versiones aprobadas.

## Riesgos y criterio de aceptación

Proveedor administrado no resuelve muros automáticamente. Evitar tablas de negocio expuestas al Data API, service_role en runtime general, vistas que eluden RLS y políticas basadas solo en rol authenticated. El administrador técnico no obtiene contenido; sesiones revocadas deben comprobarse en operaciones sensibles, porque JWT puede seguir vigente. [Sesiones Supabase](https://supabase.com/docs/guides/auth/sessions), [Storage](https://supabase.com/docs/guides/storage/security/access-control).

Consulta del changelog: el índice `.md` no fue soportado por lector web; se revisó HTML. Aviso TLS del12/10 elimina CBC antiguos desde10/11; probar runtime/navegadores modernos. Adapters de @supabase/server deprecados desde5/10 no se proponen; elegir integración oficial vigente al fijar versiones. [TLS](https://supabase.com/changelog/cbc-tls-ciphers-deprecated), [adapters](https://supabase.com/changelog/supabase-server-adapters-deprecated). No se implementó SDK contra conocimiento no verificado.

Aprobación exacta solicitada: aceptar **B con React/Vite, Fastify Node TS, PostgreSQL/Supabase Auth/Storage, pg, outbox+worker Node, hosting futuro ECS Fargate y región específica sa-east-1**, habilitando el desarrollo local F1–F4 con datos sintéticos y adaptación neutral del Core. Mantener pendientes política de roles/cliente, piloto, retención y presupuesto cloud; su ausencia bloquea uso real, no diseño local. Aceptar stack no habilita cuentas pagas, deploy, migraciones productivas o inferencia. Registrar aprobador/fecha/texto y nuevo estado ACCEPTED solo tras respuesta humana.
