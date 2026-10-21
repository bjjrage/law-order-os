import fs from 'node:fs';
const original=JSON.parse(fs.readFileSync('f0-f1/reports/roadmap-matrix.json','utf8'));
const rows=original.filter(r=>['F1','F2','F3','F4'].includes(r.phase));
const states={
'F1-T01':['DONE','Comparación histórica preservada; ADR aceptado referencia propuesta.'],
'F1-T02':['DONE_DECISION','B/São Paulo aprobados por propietario, docs/ADR_OS_001_ACCEPTED.md; no autoriza cloud.'],
'F1-T03':['IMPLEMENTED_LOCAL_PARTIAL','Config/arranque/secretos/ignore local listos; preview/prod/operación no creados.'],
'F1-T04':['VERIFIED_LOCAL_SQL_PARTIAL','RLS/FKs/API negativos con PG real; IdP/Storage completos bloqueados.'],
'F1-T05':['PARTIAL','Git local feat/os-core-local, baseline preservado, sin commits/remoto/push; protección remota no existe.'],
'F1-T06':['SPECIFIED_NOT_RUN_RESTORE','Runbook y límites; restore completo pendiente, portátil sin pg_dump.'],
'F1-T07':['ACCEPTED_PARTIAL_CONTRACTS','ADR aprobado y APIs implementadas; POST/paginación/ETag/staging difieren del objetivo documentado.'],
'F2-T01':['IMPLEMENTED_BLOCKED_AUTH','Shell/API reales arrancados4310; Supabase Auth local falta Docker.'],
'F2-T02':['VERIFIED_LOCAL_SQL_PARTIAL','Firm/membership/selector/core durables; usuario efectivo IdP NOT_RUN.'],
'F2-T03':['PASS_BROWSER_LOCAL','Body13/topbar44/sidebar212;15 filas1366/16 filas1440 a100%.'],
'F2-T04':['PASS_BROWSER_SQL_HARNESS','Mi día consulta tareas autorizadas reales SQL; auth de pruebas explícita.'],
'F2-T05':['PARTIAL','RLS/HTTP/CSRF/denegaciones/revoke/replay PASS; sesión/Storage reales pendientes.'],
'F2-T06':['PARTIAL','Capturas1440/1366 a100% listas; comparación85% browser real pendiente.'],
'F2-T07':['PARTIAL','Foco visible/estado/reflow320 comprobados; auditoría integral teclado/contraste/zoom pendiente.'],
'F3-T01':['IMPLEMENTED','Core reutilizado async, invariantes271 regresiones PASS, sin reconstruir Junta.'],
'F3-T02':['PASS_LOCAL_SQL','Client/contact/parte/firm durables con FKs; política directorio provisional solo sintéticos.'],
'F3-T03':['PASS_LOCAL_SQL_PARTIAL_UI','Matter responsable/participants/proceedings0..N; API reassignment y UI gestión permisos.'],
'F3-T04':['PASS_LOCAL_SQL_HTTP','Tasks/activity/outbox/audit antes de respuesta; worker sin efectos externos.'],
'F3-T05':['PASS_BROWSER_PARTIAL','Clientes/asuntos/tareas filtros locales compactos; cursor SQL/edición CRUD completa pendientes.'],
'F3-T06':['PARTIAL_NOT_REAL_IDP','Cliente tras recarga/newadapter PG probado; auth real y reinicio integral pendientes.'],
'F3-T07':['PASS_LOCAL_SCOPE','Asunto consultivo y0..N procedimientos, sin cálculo plazos LLM.'],
'F4-T01':['PARTIAL','Text/plain privado/hash/inmutable; PDF/binarios/scan/staging/Supabase Storage real pendientes.'],
'F4-T02':['PASS_LOCAL_SQL','Document/matter y approvals append-only exactas SQL; permisos negativos comprobados.'],
'F4-T03':['PASS_BROWSER_SQL_HARNESS','Editor texto plano versionado/review real SQL, sin IA.'],
'F4-T04':['PASS_LOCAL_SQL_HTTP','No herencia/version-conflict/least privilege/concurrencia/SQL takeover PASS.'],
'F4-T05':['PASS_LOCAL_MANUAL_PARTIAL','Delivery/Filing con versión aprobada+receipt, manual sintético; ninguna actuación externa.'],
'F4-T06':['PARTIAL','Descarga/annex autorizados y negativos PASS con filesystem de test; Storage/IdP real pendientes.'],
'F4-T07':['PASS_LOCAL_EXPORT','ZIP por versiones/hash reproducible, acceso ajeno denegado; límites escala pendientes.']};
for(const r of rows){const [status,evidence]=states[r.id];r.status=status;r.evidence=evidence;r.missing_or_decision='Ver F1_F4_BLOCKERS.md y F1_F4_IMPLEMENTATION_REPORT.md; no DONE empresarial.';}
fs.writeFileSync('f1-f4/reports/roadmap-current.json',JSON.stringify(rows,null,2));
fs.writeFileSync('F1_F4_ROADMAP_STATUS.md','# Roadmap F1–F4 después de aprobación\n\n2026-10-13. Addendum a la matriz F0/F1 histórica preservada. Stack aprobado; F1–F4 permanecen PARCIALES/BLOCKED para sus gates empresariales. PASS local SQL/browser no acredita Supabase Auth/Storage ni producción.\n\n| ID / requisito | Estado | Evidencia / límite |\n|---|---|---|\n'+rows.map(r=>`| **${r.id}** ${r.requirement} | ${r.status} | ${r.evidence} |`).join('\n')+'\n\nF5–F10 no cambiaron: corpus/confianza/modelos/piloto/finanzas/deploy conservan sus gates. Gasto0, deploy0. Históricos anteriores siguen intactos con su fecha; la aprobación vigente está en docs/ADR_OS_001_ACCEPTED.md.\n');
console.log(JSON.stringify({tasks:rows.length}));
