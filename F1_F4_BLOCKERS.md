# Bloqueos después de la implementación local

**Actualización 2026-10-13:** el propietario solicitó quitar autenticación y usar localStorage en el prototipo. Docker/Supabase ya no bloquean el modo local de navegador; sí quedan pendientes para la migración futura. Ver [estado vigente](LOCAL_BROWSER_IMPLEMENTATION.md). La matriz siguiente conserva los gates del modo servidor.

2026-10-13. Stack B/São Paulo **ya aprobados**; no volver a pedir aprobación del ADR. Solo sintéticos locales, cero gasto/deploy.

| ID | Límite factual | Siguiente acción |
|---|---|---|
| LOCAL-RUNTIME | Docker ausente; supabase start exit1 | Operador instala/inicia runtime compatible, luego seed y E2E Auth/Storage locales reales. No se instaló software de sistema. |
| AUTH-REAL | Adapter listo; IdP no ejecutado, MFA/refresh/auth.sessions faltan | Implementar/verificar en stack local. BFF expira y requiere re-login; no prometer refresh automático ni revocación instantánea del JWT remoto. |
| STORAGE-REAL | Supabase privado sin probar; originales solo UTF-8 | Scanner/staging/quarantine/reconciliación antes de PDF/Office/binarios. |
| SCALE | Listas sin cursor SQL/ETag universal, lock global/N+1/export materializado | Query acotada/locks por alcance/límites antes de carga/piloto. |
| OPS | Restore completo NOT_RUN; portátil sin pg_dump | Backup SQL+objetos+IdP/config, simulacro aislado y hashes/RLS. RPO/RTO no certificados. |
| UI-QA | Desktop100%/focus/320 comprobados;85%/200% reales/contraste integral no | QA adicional sin CSS zoom. |
| POLICY | Cinco roles/directorio por estudio provisionales | Propietario/responsable jurídico cierra clientes/roles antes de datos reales; portal/finanzas deshabilitados. |
| PILOT/GOV | Piloto/retención/privacidad/operación/costos pendientes | Designar responsables/políticas antes de piloto. |
| AI | Gates F5/F6 heredados siguen abiertos | No cambiar Junta, corpus/holdouts ni inferir permiso de gasto. |
| DEPLOY | Prohibido | Sin cloud, remoto/push, prod migrations o publicación. |

UI/HTTP/PostgreSQL PASS con identidad de test no cierra gates del producto. El siguiente bloqueo práctico es Docker local; no rediseñar stack ni repetir Junta para ocultarlo.
