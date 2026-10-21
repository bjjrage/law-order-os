# Evaluación del workflow jurídico actual

Versión 0.5 — 21/10/2026, America/Asuncion. **Corpus íntegro, contexto, tarifas y reservas probados offline; pagos deshabilitados.**

Seis expedientes sintéticos, tres niveles y dos repeticiones: 36 ejecuciones completas. Cuatro turnos fijos por ejecución: 144 interacciones. Estos casos son desarrollo conocido; no prueban una mejora independiente. No se ejecutaron inferencias pagas.

- [Dossiers provisionales](dossiers/LEEME.md): seis referencias con hechos, cuestiones, fuentes, alternativas y errores materiales. Pendientes de aprobación humana y cierre de vigencia.
- [Casos públicos](publico/CASOS.json) y [fuentes oficiales archivadas](publico/fuentes/LEEME.md): 16 publicaciones institucionales; originales y derivados con hashes en INVENTARIO.json. Liberación por caso y turno.
- [Dossier N06](dossiers/N06.md): precedente real A. y S. 318 del 05/07/2010, CSJ, Sala Civil y Comercial. El alegato sintético del cliente está separado de lo que dice el fallo publicado.
- [Protocolo](PROTOCOLO.md), [rúbrica](REVISION.md) y [matriz de 36 ejecuciones](operacion/MATRIZ.csv).
- [Vigencia revisada](VIGENCIA.md) y [acta pendiente del abogado](VALIDACION_ABOGADO.md): Ley 7663 identificada; falta acreditar su condición de entrada en vigencia. Seis dossiers provisionales.
- [Presupuesto detallado](PRESUPUESTO.md): escenarios condicionales USD 8,85 / 25,16 / 90,38; 111 horas humanas propuestas, sin honorarios cotizados. USD 86,40 nominales no autorizados. Los 24 paquetes completos se admiten con la nueva codificación; el runtime aplica tarifas largas. Falta preflight de consumo real por proveedor y recorrido. Política OFFLINE_ONLY.
- [Corrección de corpus y tarifas](CORPUS_Y_TARIFAS.md): catálogo sin pérdida ni selección de artículos; ventanas por modelo y tokenizador local oficial DeepSeek. Texto completo de Ley 7663 regenerado desde el PDF; la ficha legislativa se conserva aparte.
- [Verificación técnica](VERIFICACION.md), [resultados](operacion/VERIFICACION_TECNICA.json) y [AppContainer probado](operacion/AISLAMIENTO_OFFLINE.json): workflow actual con proveedores sintéticos dentro de aislamiento de Windows; sin credenciales ni acceso a red/base de trabajo.

Configuración leída del código: Ágil deepseek-flash low; Medio deepseek-flash high; Profundo gpt-6.1-sol xhigh. Director Luna xhigh por defecto, auditor Gemini y fallback Luna. Antes de congelar, verificar variables efectivas y cambios locales sin exportar secretos. Se conserva la modificación previa de scripts/platform-bridge.mjs; su hash figura en el informe técnico.

La v0.2 corrige la codificación de textos de v0.1, añade dossiers/fuentes y sustituye la alusión indeterminada de N06 por el fallo identificado, disponible en el turno 2. Ningún caso se había ejecutado o congelado. Se preserva el manifiesto anterior como MANIFIESTO-v0.1.json. No modifica los ensayos A/B/C anteriores ni ejecuta sus runners.

La v0.3 corrige la sobreasignación tras el conteo asíncrono, añade registro financiero SQLite fuera del alcance del proceso evaluado y ejecuta la comprobación de AppContainer. No crea recorridos alternativos del producto ni cambia la interfaz. Se preservan la evidencia negativa de v0.2 y su manifiesto.

También se verificaron cuatro interacciones consecutivas con historial persistente y accesible solo por esa ejecución, conservando la liberación del precedente desde el segundo turno. Pendientes para inferencias reales: aprobación jurídica humana/vigencia, revisión del corpus y su tamaño, tarifas comerciales/cotas, cegamiento y autorización total. El ejecutor disponible solo tiene transporte sintético; no contiene una salida a proveedores reales ni un interruptor para habilitar pagos.

La v0.4 incorpora CPC-7663 y preserva MANIFIESTO-v0.3.json. Archiva revisión de vigencia y tarifas; agrega calculadora sin red, desglose por etapa/turno/nivel y prueba de rechazo por tamaño. La evidencia nativa AppContainer corresponde a v0.3: su código no cambió, pero no se repitió esa prueba con el nuevo corpus. La nueva verificación documental/snapshots se registra aparte en operacion/REVISION_DOCUMENTAL_OFFLINE.json. Los controles técnicos no sustituyen aprobación jurídica ni cotización efectiva.

La v0.5 preserva MANIFIESTO-v0.4.json, corrige el TXT de CPC-7663 que contenía la ficha en lugar del articulado, elimina repeticiones sin recortar texto y sustituye el corte de 60.000 bytes por comprobación de contexto. Agrega selector común de tarifas por longitud, con reserva/liquidación y concurrencia verificadas. Se repitió AppContainer con el código final: cuatro turnos N06, dos especialistas, integración y auditoría; nueve generaciones sintéticas por turno. Evidencia actual: operacion/CORPUS_TARIFAS_OFFLINE.json y operacion/VERIFICACION_TECNICA.json. Siguen pendientes aprobación jurídica, cegamiento, honorarios, preflight de consumo y autorización total.
