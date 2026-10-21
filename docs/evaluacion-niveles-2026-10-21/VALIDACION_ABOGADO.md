# Acta pendiente de validación jurídica del piloto

Estado al 21/10/2026: **sin abogado designado, sin firma, sin aprobación**. Este formulario es una propuesta operativa. La validación jurídica no autoriza gasto ni acredita los controles de red, aislamiento o contabilidad; esas decisiones tienen responsables y evidencia propios.

## Revisión común a los seis dossiers

- [ ] Identificar abogado paraguayo habilitado, especialidades cubiertas, conflictos de interés y quién realiza la segunda revisión independiente.
- [ ] Cotejar cada cita con su texto oficial: artículo, versión, reforma, derogación, publicación y entrada en vigencia. Registrar fecha de corte, URL, archivo y SHA256; distinguir fecha del sitio de fecha legal.
- [ ] Determinar aplicabilidad temporal/material/territorial al caso sintético, régimen especial, competencia y presupuestos de cada vía. Documentar qué no puede resolverse con los datos aportados.
- [ ] Separar hechos documentados, alegaciones, contradicciones, inferencias y faltantes. No completar artificialmente los casos indeterminados.
- [ ] Validar alternativas jurídicamente defendibles y errores materiales de la rúbrica; admitir soluciones fundadas distintas. Cerrar las notas de referencia antes de producir las salidas.
- [ ] Validar corpus de consulta suficiente y equilibrado para los tres niveles: selección trazable de artículos con contexto/remisiones, originales accesibles bajo un mecanismo controlado si se implementa. No entregar al modelo dossier, clave, rúbrica o respuesta esperada. Aprobar los extractos antes de reducir contexto para ahorrar.
- [ ] Confirmar que estos seis casos son calibración conocida y que la confirmación independiente usará casos nuevos reservados.

## Cierre concreto por expediente

| Caso | Debe resolver y dejar por escrito el abogado |
|---|---|
| N01 | Alcance del contrato sin anexo; plazo convenido frente a fecha pedida por correo; mora y remedios condicionados; recepción física frente a conformidad técnica; efecto de reformas procesales si se incluye una vía judicial. |
| N02 | Dependencia frente a autonomía; contradicción despido/abandono; art. 81 reformado y art. 91 de Ley 496; rubros, bases, antigüedad, vacaciones y prescripción pertinentes. No convertir el proyecto de vacaciones en ley ni exigir liquidación definitiva sin datos. |
| N03 | Municipio/ordenanza, acto íntegro, órgano, notificación y régimen especial faltantes; qué recurso y plazo solo pueden formularse condicionalmente; tratamiento de la cita ficticia. No exigir plazo cierto de una jurisdicción no identificada. |
| N04 | Ley 1680 junto a 6083; acuerdo privado frente a resolución judicial; escucha y seguridad; privacidad/imagen y alcance del art. 29. No presumir obstrucción, violencia ni consulta médica acreditada. |
| N05 | Calidad del citado, autoridad y causa; alcance de CPP 4/6/74–75/84–86 y reformas posteriores a la edición 2024; preservación de evidencia y defensa; abstenerse de tipificación definitiva sin atribución concreta. Verificar que propuesta 7102 archivada no figure como reforma aplicable. |
| N06 | **Ley 7663 arts. 6–8: acordada, publicación y fecha efectiva**, régimen temporal, depósito/custodia de títulos; requisitos actuales de CPC 439/443/444/448 y Ley 6542; saldo/pago y aceptación/firma. Fallo 318/2010: identidad, integridad, votos, ratio frente a sumario, tratamiento posterior, autoridad y analogía. Validar que el alegato del cliente confunde prueba de daños con ejecutividad comercial. |

No es necesario inventar jurisprudencia para N01–N05. Si un criterio depende de un fallo, incorporar su texto completo y validarlo antes de puntuarlo. Para N06, obtener número de expediente/firmeza si se los pretende afirmar; mientras no se acrediten, la referencia debe reconocer ese límite.

## Registro por caso, todavía vacío

Completar seis registros (N01 a N06) con: nombre/matrícula/especialidad; curador; segundo validador; fecha y zona horaria; versión/hash de dossier, CASOS.json e inventario; lista artículo por artículo; reformas y entrada en vigencia respaldadas; cuestión abierta y tratamiento de puntuación; alternativas aceptadas; errores graves; estado APROBADO / REQUIERE CAMBIOS / NO APROBADO; observaciones y firma. La constancia debe identificar la versión exacta: editar las fuentes después de firmar exige nueva revisión del cambio.

El [CSV de pendientes](REFERENCIAS_PENDIENTES.csv) permanece con aprobación NO. El generador documental lo reconstruye como pendiente; no ejecutar ese generador sobre firmas reales sin implementar antes su preservación. No llenar nombres, firmas o decisiones con IA ni interpretar silencio como aprobación.

## Condiciones posteriores para decidir una ejecución paga

1. Abogado: cerrar/aceptar documentalmente los pendientes de cada caso y aprobar la rúbrica y el corpus definitivo. Esta acta no certifica éxito del sistema.
2. Responsable técnico: revisar evidencia v0.5 de corrección de tamaño/contexto y tarifas, conservando liberación temporal N06 e igualdad de material. Verificar el preflight con tokens efectivos, precios vigentes y presupuesto autorizado; las pruebas locales no fijan consumo real. Revalidar cualquier transporte real futuro: la prueba AppContainer actual solo permite transporte sintético sin red.
3. Responsable de evaluación: designar revisores, separar operadores y revisores, generar clave aleatoria fuera del alcance del modelo, mezclar salidas, ocultar nivel/modelo/costo/latencia y cerrar notas antes de revelar identidades. Prever discrepancias y tiempo de corrección.
4. Titular del presupuesto: acordar honorarios y condiciones de facturación, aprobar monto global, USD 0,60 por interacción o su revisión expresa, alcance/fecha/modelos y criterio de corte. El cálculo nominal de USD 86,40 no es autorización. No liberar reservas inciertas sin conciliación ni reintentar con otra identidad.

**Hasta entonces: OFFLINE_ONLY.** La autorización financiera, si llega, deberá registrarse aparte y vincularse al manifiesto y configuración aprobados; no habilitar pagos mediante edición de esta acta o del presupuesto.
