# LAW & ORDER OS — Junta Jurídica V2

Motor experimental TypeScript/Node: Jev → Luna → Sol Medium → Gemini → checker determinístico → revisión humana.

La remediación de auditoría incorpora procedencia firmada desde verificadores externos configurados, detección bibliográfica con gate cerrado y publicación explícita de versiones. La simulación solo etiqueta SIMULATED_VERIFIED. No hay corpus estatal real ni integración de cuenta validada.

    npm.cmd ci --ignore-scripts --cache .npm-cache
    npm.cmd run typecheck
    npm.cmd run board:test
    npm.cmd run board:smoke:offline
    npm.cmd run board:benchmark:offline

En otros sistemas, instalar dependencias allí; no compartir node_modules nativo de Windows. Los tests ordinarios bloquean red; smoke/benchmark usan fixtures y proveedores simulados. No generan inferencias pagas ni despliegues.

Consultar [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md), [TEST_RESULTS.md](TEST_RESULTS.md), [AUDIT_REMEDIATION.md](AUDIT_REMEDIATION.md) y [Runbook](junta-juridica/docs/RUNBOOK.md). Definiciones públicas: junta-juridica/src/index.ts.

El smoke usa request_id demo-offline-v2 para conservar históricos V1. Repetir una entrada idéntica no repite modelos. Cambiar política/datos bajo el mismo request_id produce conflicto; usar un ID nuevo.

Toda salida sigue siendo borrador. Sin atestación confiable vigente no hay VERIFIED; citas pendientes/no comprobadas dejan PARTIAL. La gramática no promete exhaustividad ni corrección jurídica. Las dependencias de producción siguen BLOCKED / NOT_RUN.

