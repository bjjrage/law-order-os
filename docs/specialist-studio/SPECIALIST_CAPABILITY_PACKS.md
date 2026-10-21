# Paquetes de capacidades por subperfil

Actualización documental: 15/10/2026, America/Asuncion. Diseño pendiente de aprobación.

Fecha: 14/10/2026, America/Asuncion. Estado: **PROPOSED — diseño evaluable; ningún paquete habilitado**.
Dependencias: [ADR reconciliado](ADR_SPECIALIST_STUDIO_002.md), [perfiles/RAG](SPECIALIST_PROFILES_AND_RAG.md) y [catálogo estructurado](contracts/SPECIALIST_CAPABILITY_PACKS.v1.json).

Una skill aquí es el contrato de trabajo del especialista de la aplicación: alcance, evidencia, procedimiento, herramientas y evaluación. No es una skill instalada en Codex ni un permiso del host. Se conservan las seis personas y los 22 IDs del catálogo aceptado. El piloto contractual es PILOT_DESIGN_ONLY; los otros 21 son DRAFT.

## Contrato común obligatorio

Actualización de implementación: [piloto de Elena disponible en local](ELENA_LOCAL_PILOT_2026-10-15.md), como ejercicio EXPERIMENTAL_OFFLINE determinístico. `runtime_activation=false` en el catálogo se refiere al especialista generativo; la disponibilidad del workflow offline se registra separadamente. No habilita pericia, fuentes oficiales, otros perfiles o llamadas externas.

Cada encargo carga la política común y solo el paquete/subperfil seleccionado. Congela IDs/versiones de persona, paquete, prompt, herramientas, política RAG, documentos/corpus y presupuesto. El cambio de paquete invalida planes pendientes que dependan de esa versión; no reescribe opiniones previas.

Entradas comunes: estudio/asunto autorizado, humano responsable, pregunta asignada, jurisdicción, fecha de corte, posición del cliente, snapshot e inventario de documentos. Distinguir contenido documental, alegación, inferencia y desconocido. Una remisión no recuperada queda pendiente. Todo hallazgo debe volver a documento/versión/cláusula o pasaje, incluso cuando no requiere una fuente jurídica externa.

Salida común: cuestión → hechos con naturaleza/procedencia → observaciones con localizador → respaldo y fuente candidata → argumento contrario → conclusión condicionada → alternativa/faltantes → límites de cobertura. Las columnas de cada ficha amplían este contrato; no lo sustituyen. No usar puntuación de certeza o acuerdo entre agentes como prueba.

Las fuentes listadas son **requisitos de curaduría**, sin validación de vigencia, cobertura ni disponibilidad en este corte. No se afirma ninguna regla jurídica concreta, tasa, plazo o fórmula. El curador debe ligar cada requisito al registro existente: source_id, versión/hash, fecha conocida, pasajes, procedencia, permisos y límites. Falta ese enlace hoy; no se crea otro registro bibliográfico.

Herramientas iniciales solo de lectura. La búsqueda y lectura de versiones se apoyan en primitivas existentes; matrices/comparadores/calculadores son especificaciones pendientes de implementación, revisión y tests. Un calculador exige regla y versión aprobadas, entradas, unidades, moneda, redondeo y límites; no inventa datos ni usa una fórmula recordada por el modelo. Ningún paquete envía, presenta, firma, paga, adquiere fuentes ni crea permisos.

Jev conserva la selección de evidencia; el especialista puede pedir un original omitido sin borrarlo del índice. Fuera de ámbito o sin prueba decisiva: pedir aclaración, delimitar la respuesta o abstenerse. Escalar propone un encargo adicional con motivo; no activa otro agente ni gasto. Toda opinión pasa al checker final junto con consultores, adversario, réplicas, integración y artefacto visible/exportado exacto. El humano juzga aplicabilidad y mérito.

## Fichas de los 22 subperfiles

### Elena · Contrato y obligaciones

ID: `civil_contractual@1`. Estado: **PILOT_DESIGN_ONLY**. Activación runtime: **false**.

- **Entradas específicas:** partes y rol del cliente; versión firmada y anexos; objetivo y fecha de corte.
- **Documentos:** contrato íntegro; anexos y modificaciones; comunicaciones relevantes.
- **Fuentes a curar:** normativa contractual aplicable por fecha; jurisprudencia pertinente del registro existente.
- **Procedimiento:** 1) enumerar documentos y versiones; 2) extraer prestaciones, condiciones, excepciones y remisiones; 3) relacionar cláusulas y anexos, mostrando incompatibilidades; 4) separar cumplimiento alegado de evidencia documental; 5) recuperar respaldo de cada cuestión, buscar contraargumento y pedir faltantes.
- **Entregable:** matriz de cláusula / obligación/condición / evidencia / problema / alternativa / faltante; más el contrato común.
- **Herramientas propuestas:** comparación textual de versiones; matriz de obligaciones y referencias cruzadas.
- **Abstención/límites:** Falta anexo decisivo o no se sabe qué versión rige; No inferir validez, nulidad o incumplimiento desde un resumen.
- **Escalamiento propuesto:** Facultades societarias → Valeria; Carga fiscal de operación → Martín.
- **Evaluación positiva:** Detectar importe incompatible entre cuerpo y anexo; Conservar excepción a una obligación aunque aparezca en otro documento.
- **Controles negativos:** No convertir una obligación condicionada en incondicional; Cita contractual a un fallo inventado sigue pendiente.

### Elena · Responsabilidad y daños

ID: `civil_responsabilidad@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** hecho controvertido; sujetos y pretensión; fechas y rubros alegados.
- **Documentos:** cronología documentada; informes y comprobantes; alegaciones de ambas partes.
- **Fuentes a curar:** fuentes sobre responsabilidad y reparación seleccionadas por supuesto y fecha; antecedentes comparables.
- **Procedimiento:** 1) separar hechos, causalidad alegada y prueba; 2) construir hipótesis favorable y contraria; 3) vincular cada rubro con respaldo, monto y objeciones; 4) identificar causas alternativas y duplicaciones; 5) exponer condiciones pendientes sin atribuir responsabilidad.
- **Entregable:** matriz de hipótesis / hecho / evidencia favorable/contraria / rubro / incertidumbre; más el contrato común.
- **Herramientas propuestas:** cronología con localizadores; conciliación aritmética de rubros documentados.
- **Abstención/límites:** Faltan bases del monto o conexión causal; No estimar indemnización por intuición.
- **Escalamiento propuesto:** Relación de trabajo → Lucía; Hipótesis penal → Diego.
- **Evaluación positiva:** Detectar un comprobante duplicado; Mantener causa alternativa respaldada.
- **Controles negativos:** No tratar relato de parte como causalidad probada; No sumar monedas sin regla aprobada.

### Elena · Familia, niñez y adolescencia

ID: `civil_familia@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** vínculos y representación alegados; objetivo; resoluciones y fechas.
- **Documentos:** documentación de vínculos autorizada; resoluciones y acuerdos; antecedentes pertinentes minimizados.
- **Fuentes a curar:** fuentes de familia y protección de niñez por cuestión; resoluciones comparables autorizadas.
- **Procedimiento:** 1) minimizar datos sensibles; 2) diferenciar vínculos alegados y documentados; 3) ordenar decisiones previas y situación actual; 4) identificar documentos y cuestiones de representación pendientes; 5) presentar alternativas para revisión especializada.
- **Entregable:** matriz de cuestión / vínculo/rol / documento / decisión previa / faltante / revisión humana; más el contrato común.
- **Herramientas propuestas:** cronología documental; matriz de decisiones y requisitos.
- **Abstención/límites:** No resolver interés de persona menor desde datos incompletos; No asumir representación ni revelar datos innecesarios.
- **Escalamiento propuesto:** Garantías/competencia → Camila; Posible violencia o cuestión penal → Diego y responsable humano.
- **Evaluación positiva:** Detectar resolución posterior incompatible con acuerdo anterior; Identificar falta de documentación de representación.
- **Controles negativos:** No divulgar identidad de menor en registro técnico; No recomendar medida automática.

### Elena · Sucesiones

ID: `civil_sucesorio@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** personas y vínculos alegados; objetivo; documentos patrimoniales y fechas.
- **Documentos:** documentación de vínculos; instrumentos sucesorios aportados; inventario y pasivos.
- **Fuentes a curar:** fuentes sucesorias aplicables por fecha y cuestión; antecedentes registrables pertinentes.
- **Procedimiento:** 1) inventariar documentos y alegaciones; 2) construir mapa de vínculos sin declarar calidad hereditaria; 3) conciliar activos, pasivos y títulos aportados; 4) detectar instrumentos incompatibles o faltantes; 5) plantear cuestiones de participación y distribución para el abogado.
- **Entregable:** matriz de persona/vínculo / documento / activo/pasivo / conflicto / faltante; más el contrato común.
- **Herramientas propuestas:** mapa de relaciones documentadas; inventario conciliado.
- **Abstención/límites:** No asignar calidad o cuota hereditaria sin validación; No asumir exhaustividad del patrimonio.
- **Escalamiento propuesto:** Empresa o participaciones → Valeria; Efectos tributarios → Martín.
- **Evaluación positiva:** Detectar activo repetido bajo dos descripciones; Conservar conflicto entre instrumentos.
- **Controles negativos:** No repartir con porcentajes inventados; No confundir tenedor y titular.

### Elena · Inmuebles y patrimonio

ID: `civil_inmobiliario@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** bien e identificadores; posición del cliente; operación y fecha de corte.
- **Documentos:** títulos y certificados aportados; contratos y planos; gravámenes documentados.
- **Fuentes a curar:** fuentes patrimoniales/registrales pertinentes; antecedentes por cuestión.
- **Procedimiento:** 1) resolver correspondencia entre identificadores documentales; 2) reconstruir cadena de instrumentos aportados; 3) separar dominio, posesión y alegaciones; 4) comparar gravámenes, superficies y fechas; 5) señalar verificaciones registrales pendientes.
- **Entregable:** matriz de bien/identificador / instrumento / fecha / discrepancia / limitación; más el contrato común.
- **Herramientas propuestas:** comparación de identificadores y superficies; cadena documental.
- **Abstención/límites:** No certificar dominio ni libertad de gravámenes; No presumir certificado actualizado.
- **Escalamiento propuesto:** Operación societaria → Valeria; Acto administrativo/territorial → Camila.
- **Evaluación positiva:** Detectar número registral diferente en anexo; Señalar certificado anterior al corte requerido.
- **Controles negativos:** No usar similitud de dirección como identidad del inmueble; No anunciar estudio de títulos completo.

### Valeria · Sociedades

ID: `comercial_societario@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** tipo de entidad alegado; operación; personas y facultades invocadas.
- **Documentos:** estatuto y modificaciones; actas; poderes y constancias aportadas.
- **Fuentes a curar:** fuentes societarias por tipo/fecha; antecedentes de representación y gobierno pertinentes.
- **Procedimiento:** 1) inventariar instrumentos y versiones; 2) relacionar órganos, actos y facultades documentadas; 3) comparar poder, autorización y operación; 4) detectar contradicciones y aprobaciones faltantes; 5) delimitar efecto pendiente de validación humana.
- **Entregable:** matriz de acto / órgano/persona / facultad documentada / respaldo / requisito pendiente; más el contrato común.
- **Herramientas propuestas:** matriz de facultades y aprobaciones; comparación de estatutos/actas.
- **Abstención/límites:** No validar representación por cargo o firma aislada; No asumir inscripción actual.
- **Escalamiento propuesto:** Cláusulas contractuales → Elena; Efectos fiscales → Martín.
- **Evaluación positiva:** Detectar poder con límite inferior a la operación; Distinguir proyecto de acta y acta aportada como definitiva.
- **Controles negativos:** No inferir facultades universales del título de director; No completar órgano ausente.

### Valeria · Negocios y operaciones comerciales

ID: `comercial_negocios@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** estructura y objetivo de operación; participantes; hitos y documentos.
- **Documentos:** contratos; anexos comerciales; autorizaciones y condiciones de cierre.
- **Fuentes a curar:** fuentes de operaciones comerciales por estructura y fecha; antecedentes pertinentes.
- **Procedimiento:** 1) descomponer operación y dependencias; 2) relacionar partes, documentos y prestaciones; 3) identificar condiciones de cierre y autorizaciones; 4) comparar riesgos y alternativas documentadas; 5) coordinar cuestiones asignadas a otras materias.
- **Entregable:** matriz de hito / dependencia / responsable alegado / respaldo / riesgo condicionado / faltante; más el contrato común.
- **Herramientas propuestas:** mapa de operación y dependencias; checklist de cierre con evidencia.
- **Abstención/límites:** No dar cierre por cumplido sin respaldo; No evaluar solvencia o rentabilidad desde narrativa.
- **Escalamiento propuesto:** Obligaciones contractuales → Elena; Fiscalidad → Martín; personal → Lucía.
- **Evaluación positiva:** Detectar condición de cierre omitida; Identificar dependencia entre dos contratos.
- **Controles negativos:** No duplicar el encargo contractual del titular; No registrar cierre automático.

### Valeria · Banca y financiación

ID: `comercial_bancario@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** instrumento; partes; moneda y fechas; objetivo del análisis.
- **Documentos:** contrato financiero; cronograma; garantías; modificaciones y comprobantes.
- **Fuentes a curar:** fuentes financieras por instrumento/régimen/fecha; antecedentes sobre garantías pertinentes.
- **Procedimiento:** 1) conciliar contrato y cronograma; 2) separar capital, interés, cargos y garantías; 3) localizar condiciones y eventos documentados; 4) revisar fórmulas solo bajo regla aprobada; 5) exponer escenarios y faltantes sin recomendar inversión.
- **Entregable:** matriz de componente / cláusula / entrada/fórmula aprobada / respaldo / discrepancia; más el contrato común.
- **Herramientas propuestas:** conciliación aritmética; comparación de cronogramas y garantías.
- **Abstención/límites:** Fórmula, tasa, moneda o base temporal no documentadas; No inventar saldo exigible o tasa legal.
- **Escalamiento propuesto:** Garantía patrimonial → Elena; Carga tributaria → Martín.
- **Evaluación positiva:** Detectar cuota inconsistente con el cronograma; Conservar modificación de tasa como cambio de versión.
- **Controles negativos:** No calcular con periodicidad presumida; No certificar exigibilidad de garantía.

### Valeria · Insolvencia y reestructuración

ID: `comercial_concursal@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** situación alegada; objetivo; fechas; acreedores/deudor.
- **Documentos:** pasivos y vencimientos; garantías; instrumentos y actuaciones aportados.
- **Fuentes a curar:** fuentes concursales/reestructuración por supuesto/fecha; antecedentes pertinentes.
- **Procedimiento:** 1) separar situación financiera alegada de actuaciones documentadas; 2) conciliar acreencias y duplicados; 3) relacionar garantías, vencimientos y controversias; 4) identificar dependencias laborales/fiscales; 5) presentar opciones y cuestiones pendientes sin fijar prelación.
- **Entregable:** matriz de acreencia / respaldo / monto/moneda / garantía alegada / controversia / faltante; más el contrato común.
- **Herramientas propuestas:** matriz de acreencias; conciliación sin conversión monetaria implícita.
- **Abstención/límites:** No declarar insolvencia jurídica ni prelación sin validación; No prometer viabilidad de reestructuración.
- **Escalamiento propuesto:** Créditos laborales → Lucía; Créditos fiscales → Martín.
- **Evaluación positiva:** Detectar misma deuda en dos planillas; Conservar disputa sobre monto de acreencia.
- **Controles negativos:** No confundir atraso y declaración formal; No sumar monedas diferentes.

### Lucía · Relaciones individuales de trabajo

ID: `laboral_individual@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** relación alegada; cuestión; fechas y componentes remunerativos.
- **Documentos:** contratos y comunicaciones; recibos; registros y actuaciones aportados.
- **Fuentes a curar:** fuentes laborales aplicables por régimen/fecha; antecedentes pertinentes.
- **Procedimiento:** 1) construir cronología con procedencia; 2) separar relación alegada y documentos; 3) conciliar pagos, conceptos y períodos; 4) localizar controversias y prueba contraria; 5) calcular solo con fórmula/requisitos aprobados y entradas completas.
- **Entregable:** matriz de período / hecho/alegación / documento / concepto / controversia / faltante; más el contrato común.
- **Herramientas propuestas:** cronología laboral; conciliación de recibos; calculador versionado pendiente de aprobación.
- **Abstención/límites:** No determinar vínculo por etiqueta contractual; No inventar antigüedad, salario base o fórmula.
- **Escalamiento propuesto:** Seguridad social → subperfil propio; Operación empresarial → Valeria.
- **Evaluación positiva:** Detectar períodos sin recibos; Mostrar documento que contradice fecha alegada.
- **Controles negativos:** No completar salario faltante con promedio inventado; No emitir liquidación sin regla aprobada.

### Lucía · Relaciones colectivas de trabajo

ID: `laboral_colectivo@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** actores y representación alegada; ámbito; instrumento y fechas.
- **Documentos:** acuerdos y versiones; documentación de representación; comunicaciones y actuaciones.
- **Fuentes a curar:** fuentes colectivas por ámbito/fecha; antecedentes pertinentes.
- **Procedimiento:** 1) delimitar ámbito personal, territorial y temporal documentado; 2) comparar acuerdos y modificaciones; 3) relacionar actores y representación acreditada; 4) registrar cuestiones disputadas y faltantes; 5) separar propuesta, negociación y acuerdo aportado.
- **Entregable:** matriz de instrumento / ámbito / actor/representación / cláusula / controversia / faltante; más el contrato común.
- **Herramientas propuestas:** comparación de instrumentos; matriz de ámbitos y representación.
- **Abstención/límites:** No presumir representatividad ni extensión universal; No dar propuesta negociadora por acuerdo vigente.
- **Escalamiento propuesto:** Gobierno empresarial → Valeria; Actuaciones administrativas → Camila.
- **Evaluación positiva:** Detectar diferencia de ámbito entre acuerdos; Identificar modificación posterior de cláusula.
- **Controles negativos:** No extender acuerdo a sujetos no documentados; No asumir firma autorizada.

### Lucía · Seguridad social

ID: `laboral_seguridad_social@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** régimen alegado; persona/rol; períodos; cuestión.
- **Documentos:** constancias aportadas; aportes y declaraciones; actos y comunicaciones.
- **Fuentes a curar:** fuentes de seguridad social por régimen/período; antecedentes pertinentes.
- **Procedimiento:** 1) delimitar régimen y períodos sin inventarlos; 2) conciliar constancias y pagos; 3) detectar vacíos y superposiciones; 4) relacionar acto, requisito y respaldo; 5) separar cobertura acreditada de cobertura alegada.
- **Entregable:** matriz de período / requisito / constancia/aporte / diferencia / pendiente; más el contrato común.
- **Herramientas propuestas:** conciliación por período; matriz documental de requisitos.
- **Abstención/límites:** No garantizar cobertura o prestación; No calcular aporte sin base y regla aprobada.
- **Escalamiento propuesto:** Relación individual → subperfil propio; Fiscalidad o acto público → Martín/Camila.
- **Evaluación positiva:** Detectar período sin constancia; Identificar pago con período distinto.
- **Controles negativos:** No convertir comprobante aislado en cobertura integral; No inferir afiliación actual.

### Martín · Impuestos y obligaciones formales

ID: `tributario_impuestos@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** operación; sujeto/régimen alegado; período; moneda y objetivo.
- **Documentos:** comprobantes; declaraciones; registros y comunicaciones aportadas.
- **Fuentes a curar:** fuentes tributarias por obligación/régimen/período y modificatorias; criterio administrativo identificado.
- **Procedimiento:** 1) construir matriz operación–sujeto–período; 2) separar norma publicada y temporalidad acreditada; 3) conciliar bases y comprobantes; 4) identificar régimen/documentación faltantes; 5) calcular solo bajo fórmula aprobada con entradas trazables.
- **Entregable:** matriz de obligación candidata / período / fuente/versionado / base documentada / diferencia / revisión; más el contrato común.
- **Herramientas propuestas:** conciliación documental; calculador fiscal versionado pendiente.
- **Abstención/límites:** No fijar obligación, tasa, exención o vencimiento por memoria; No extrapolar norma de otro período.
- **Escalamiento propuesto:** Operación societaria → Valeria; Relación laboral → Lucía.
- **Evaluación positiva:** Detectar documento de período incorrecto; Señalar base incompleta antes de calcular.
- **Controles negativos:** No usar tasa sin fuente/versionado; No confundir proyecto normativo y norma aplicable.

### Martín · Fiscalizaciones y controversias tributarias

ID: `tributario_fiscalizaciones@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** acto/cuestionamiento; sujeto; períodos; comunicaciones y objetivo.
- **Documentos:** requerimientos y notificaciones; descargos; respaldos y actos posteriores.
- **Fuentes a curar:** fuentes de fiscalización/revisión por régimen/fecha; antecedentes y criterios identificados.
- **Procedimiento:** 1) ordenar actos y comunicaciones; 2) relacionar cada observación con evidencia favorable/contraria; 3) comparar períodos y montos; 4) identificar documentación solicitada y respuesta; 5) separar fecha observada y plazo pendiente de validación.
- **Entregable:** matriz de observación / acto / período/monto / prueba / respuesta / pendiente; más el contrato común.
- **Herramientas propuestas:** cronología de actuaciones; matriz cargo–respaldo–descargo.
- **Abstención/límites:** No confirmar plazo procesal desde lectura LLM; No presumir notificación válida.
- **Escalamiento propuesto:** Competencia/procedimiento público → Camila; Cuestión penal → Diego.
- **Evaluación positiva:** Detectar requerimiento respondido parcialmente; Conservar comprobante que contradice observación.
- **Controles negativos:** No tratar silencio documental como deuda probada; No marcar plazo confirmado automáticamente.

### Martín · Aduanas y comercio exterior

ID: `aduanero_comercio_exterior@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** operación; mercancía descrita; fechas; rol de participantes.
- **Documentos:** declaraciones; facturas y transporte; origen y actos aportados.
- **Fuentes a curar:** fuentes aduaneras por operación/fecha; instrumentos de origen y clasificación pertinentes.
- **Procedimiento:** 1) relacionar mercancía y documentos; 2) conciliar valor, cantidad, moneda y fechas; 3) identificar clasificación/origen alegados y respaldo; 4) registrar discrepancias y requisitos faltantes; 5) exponer cuestiones para especialista humano sin clasificar por intuición.
- **Entregable:** matriz de mercancía/operación / declaración / respaldo / diferencia / requisito / revisión; más el contrato común.
- **Herramientas propuestas:** conciliación documental; matriz de origen y clasificación alegados.
- **Abstención/límites:** No asignar clasificación/arancel sin fundamento validado; No presumir origen por proveedor o ruta.
- **Escalamiento propuesto:** Contrato comercial → Valeria; Actos/recursos → Camila.
- **Evaluación positiva:** Detectar cantidad inconsistente con transporte; Señalar certificado de origen ausente.
- **Controles negativos:** No inferir clasificación de descripción breve; No calcular tributo sin regla y base aprobadas.

### Diego · Defensa penal

ID: `penal_defensa@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** hipótesis imputada; rol del cliente; etapa alegada; fechas.
- **Documentos:** actos y elementos probatorios autorizados; versiones de partes; cadena documental disponible.
- **Fuentes a curar:** fuentes penales/procesales según hipótesis/fecha; antecedentes de garantías pertinentes.
- **Procedimiento:** 1) mapear hipótesis y elementos que deben revisar abogados; 2) separar imputación, prueba e inferencia; 3) registrar respaldo favorable y contrario; 4) detectar contradicciones y procedencia incierta; 5) presentar alternativas y diligencias pendientes sin completar hechos.
- **Entregable:** matriz de elemento/hipótesis / evidencia favorable/contraria / procedencia / inferencia / faltante; más el contrato común.
- **Herramientas propuestas:** matriz de hipótesis y evidencia; cronología de contradicciones.
- **Abstención/límites:** No afirmar culpabilidad ni resultado judicial; No fabricar explicación de evidencia faltante.
- **Escalamiento propuesto:** Garantías constitucionales → Camila; Operación económica → Valeria/Martín.
- **Evaluación positiva:** Conservar evidencia exculpatoria contradictoria; Identificar procedencia no documentada.
- **Controles negativos:** No promover imputación a hecho probado; No estimar probabilidad de condena.

### Diego · Querellas y representación de víctimas

ID: `penal_querella@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** hecho alegado; representación; objetivo; actuaciones y fechas.
- **Documentos:** relato identificado como alegación; respaldos; instrumentos de representación y actos.
- **Fuentes a curar:** fuentes penales/procesales por cuestión/fecha; antecedentes pertinentes autorizados.
- **Procedimiento:** 1) separar relato y respaldo; 2) delimitar representación documentada; 3) construir cronología y contradicciones; 4) relacionar pretensión y documentos faltantes; 5) proponer cuestiones de revisión sin redactar presentación aprobada.
- **Entregable:** matriz de hecho alegado / respaldo / contradicción / representación / revisión pendiente; más el contrato común.
- **Herramientas propuestas:** cronología con origen; matriz documental de pretensiones.
- **Abstención/límites:** No confirmar legitimación por relato; No exponer datos sensibles innecesarios.
- **Escalamiento propuesto:** Reparación civil → Elena; Garantías/competencia → Camila.
- **Evaluación positiva:** Detectar falta de poder o representación; Mostrar respaldo contrario a un hecho alegado.
- **Controles negativos:** No presentar denuncia automáticamente; No atribuir delito a persona como hecho probado.

### Diego · Delitos económicos

ID: `penal_economico@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** hipótesis; sujetos/roles; operación y períodos; objetivo.
- **Documentos:** registros de operaciones; contratos; actos y evidencia autorizada.
- **Fuentes a curar:** fuentes penales económicas por supuesto/fecha; fuentes sectoriales aportadas por perfiles pertinentes.
- **Procedimiento:** 1) reconstruir trazas documentales de operación; 2) separar anomalía contable, incumplimiento e hipótesis penal; 3) relacionar roles y actos acreditados; 4) conciliar movimientos sin inferir intención; 5) registrar hipótesis alternativas y faltantes.
- **Entregable:** matriz de operación / rol/acto / movimiento / respaldo / hipótesis alternativa / faltante; más el contrato común.
- **Herramientas propuestas:** trazabilidad documental de movimientos; matriz de roles y evidencia.
- **Abstención/límites:** No inferir dolo de discrepancia aritmética; No asegurar delito por incumplimiento fiscal.
- **Escalamiento propuesto:** Fiscalidad → Martín; Facultades societarias → Valeria.
- **Evaluación positiva:** Detectar movimiento duplicado en extractos; Conservar explicación documental alternativa.
- **Controles negativos:** No convertir error de registro en intención; No rellenar beneficiario faltante.

### Camila · Constitucional y garantías

ID: `publico_constitucional@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** acto y afectación alegados; sujeto/rol; fechas; objetivo.
- **Documentos:** acto cuestionado; antecedentes y actuaciones; respaldo de afectación alegada.
- **Fuentes a curar:** fuentes constitucionales y de garantías por cuestión/fecha; jurisprudencia pertinente identificada.
- **Procedimiento:** 1) delimitar acto y afectación alegada; 2) vincular argumento con evidencia y texto fuente; 3) separar vía invocada y requisitos por verificar; 4) construir argumento contrario; 5) identificar revisión de competencia y temporalidad pendiente.
- **Entregable:** matriz de acto / afectación alegada / evidencia / fuente / contraargumento / requisito pendiente; más el contrato común.
- **Herramientas propuestas:** matriz acto–garantía–respaldo; comparación de argumentos.
- **Abstención/límites:** No afirmar procedencia de vía sin revisión; No presumir lesión por invocación de derecho.
- **Escalamiento propuesto:** Cuestión penal → Diego; Acto administrativo → subperfil propio.
- **Evaluación positiva:** Detectar falta del acto cuestionado; Preservar requisito sin respaldo.
- **Controles negativos:** No prometer resultado de garantía; No inventar jurisprudencia favorable.

### Camila · Administrativo

ID: `publico_administrativo@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** acto/autoridad; rol; procedimiento alegado; fechas y objetivo.
- **Documentos:** expediente aportado; acto y notificaciones; antecedentes y recursos.
- **Fuentes a curar:** fuentes administrativas de competencia/procedimiento por sector/fecha; antecedentes pertinentes.
- **Procedimiento:** 1) inventariar expediente y faltantes; 2) reconstruir competencia invocada y secuencia documental; 3) relacionar motivación con antecedentes; 4) detectar contradicciones y notificaciones pendientes; 5) delimitar vías/requisitos sujetos a validación humana.
- **Entregable:** matriz de acto / autoridad/competencia invocada / antecedente / fundamento / faltante; más el contrato común.
- **Herramientas propuestas:** índice de expediente; matriz competencia–acto–procedimiento.
- **Abstención/límites:** No certificar competencia o validez desde membrete; No calcular plazo legal sin reglas validadas.
- **Escalamiento propuesto:** Fiscalización → Martín; Garantías → subperfil constitucional.
- **Evaluación positiva:** Detectar fundamento que refiere a documento ausente; Identificar cambio de autoridad entre actos.
- **Controles negativos:** No validar notificación por fecha impresa; No afirmar expediente íntegro.

### Camila · Contratación pública

ID: `publico_contratacion@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** procedimiento/etapa; rol del cliente; objeto; documentos y fechas.
- **Documentos:** pliego y modificaciones; oferta; evaluaciones y actos aportados.
- **Fuentes a curar:** fuentes de contratación pública por régimen/fecha; instrumentos específicos del procedimiento.
- **Procedimiento:** 1) reconstruir versiones de pliego y aclaraciones; 2) relacionar cada requisito con respaldo ofertado; 3) separar criterio publicado y criterio aplicado; 4) detectar contradicciones y documentación faltante; 5) presentar cuestiones de revisión sin certificar elegibilidad.
- **Entregable:** matriz de requisito / versión del pliego / respaldo / criterio aplicado / diferencia / pendiente; más el contrato común.
- **Herramientas propuestas:** matriz de cumplimiento documental; comparación pliego–adenda–oferta.
- **Abstención/límites:** No garantizar adjudicación o elegibilidad; No presumir que última carga es versión aplicable.
- **Escalamiento propuesto:** Operación/representación → Valeria; Cuestión tributaria → Martín.
- **Evaluación positiva:** Detectar requisito modificado por adenda; Señalar documento ofrecido pero no aportado.
- **Controles negativos:** No dar oferta presentada por borrador completo; No ignorar versión del pliego.

### Camila · Regulación sectorial

ID: `publico_regulatorio@1`. Estado: **DRAFT**. Activación runtime: **false**.

- **Entradas específicas:** sector y actividad; rol; territorio; acto/licencia y fecha.
- **Documentos:** instrumentos regulatorios; licencias y actos; documentación operativa autorizada.
- **Fuentes a curar:** fuentes del regulador competente por actividad/fecha; régimen sectorial y modificatorias pertinentes.
- **Procedimiento:** 1) delimitar actividad y régimen alegado; 2) relacionar obligación candidata con instrumento y fecha; 3) comparar licencia y operación documentada; 4) detectar condiciones, exclusiones y cambios; 5) escalar cuestiones fuera del sector evaluado.
- **Entregable:** matriz de actividad / instrumento/versionado / condición / respaldo / diferencia / revisión; más el contrato común.
- **Herramientas propuestas:** matriz de requisitos sectoriales; comparación licencia–actividad.
- **Abstención/límites:** No extender habilitación entre sectores; No presumir licencia vigente por copia sin control.
- **Escalamiento propuesto:** Operación comercial → Valeria; Fiscalidad/relaciones de trabajo → Martín/Lucía.
- **Evaluación positiva:** Detectar actividad fuera del alcance de licencia aportada; Señalar modificatoria no recuperada.
- **Controles negativos:** No presentar registro localizado como licencia válida; No asumir competencia regulatoria universal.

## Habilitación y prueba de mejora

No basta aprobar este documento para habilitar paquetes. Por subperfil se necesita: curador identificado, manifest de fuentes/localizadores/cobertura, procedimientos revisados, herramientas efectivamente disponibles, permisos del host, presupuesto, conjunto de desarrollo y holdout independiente, rúbrica y umbrales congelados, evaluación humana y decisión de release trazable.

La comparación de **especialización** mantiene el mismo modelo efectivo, pregunta, documentos y evidencia entregada, herramientas disponibles y presupuesto total; cambia el paquete. La comparación del **sistema completo** mide además recuperación, llamadas y organización, declarando esas diferencias. Medir problemas decisivos detectados, omisiones, hallazgos sin respaldo, contraargumentos, abstención, fuentes pendientes, utilidad, llamadas, costo y latencia. Informar tamaño/método de muestra; no presentar victoria de una consulta como mejora general.

La evaluación humana debe ser pareada y preferentemente ciega. Otro LLM puede auxiliar, pero no habilitar el perfil por su propia nota. No usar ejemplos de desarrollo ni el benchmark ya visto como holdout nuevo. Cualquier error crítico —dato privado fuera de ámbito, hecho inventado, falso VERIFIED, llamada no autorizada o cálculo jurídico no aprobado— impide habilitar esa versión. Los umbrales de calidad restantes se aprueban antes de ejecutar y no se ajustan para obtener PASS.

El [piloto contractual](CONTRACTUAL_PILOT_EVALUATION.md) concreta el primer protocolo. No se ejecutó evaluación de estos paquetes ni se acreditó superioridad sobre un generalista. Ninguna ficha habilita una especialidad completa ni garantiza resultados futuros.

