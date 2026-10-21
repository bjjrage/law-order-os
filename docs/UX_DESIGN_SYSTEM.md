# LAW & ORDER OS · sistema de interfaz

Revisión implementada el 15/10/2026, por pedido del propietario de revisar todo el OS. Reemplaza los valores visuales de `UI_COMPACT_DESIGN_SPEC.md`. No cambia contratos del Core, autorizaciones ni almacenamiento.

## Identidad y jerarquía

- Tinta azul, papel cálido y acento latón; superficies mate con grano sutil. Sin elevación, biseles ni escala en hover.
- Densidad compacta corregida por pedido del propietario: rellenos y separaciones reducidos un 35%; títulos grandes y alturas fijas al menos un 30% frente a la revisión inicial.
- Base legible de 12 px, títulos de página serif de 25 px y controles de 26–28 px. Las etiquetas pequeñas conservan su tamaño; el texto de trabajo mantiene altura de línea de lectura.
- Topbar de 44 px; menú de 170 px en escritorio y 48 px contraído. Navegación horizontal en móvil.
- El control junto al logo permite contraer o expandir el menú de escritorio. La preferencia se conserva en el navegador; los íconos mantienen sus nombres accesibles y tooltips.
- Acciones primarias con tinta sólida; secundarias con superficie mineral suave y hover de tinta con texto claro. Acciones de texto con lavado mineral; foco visible separado. La textura común es sutil y mate.
- Espaciado interno habitual de 12–18 px, filas de clientes con metadatos en línea, bordes de 1 px y radios de 6–10 px. No usar zoom ni transformaciones para ajustar densidad.

## Función de cada sección

| Sección | Trabajo principal |
|---|---|
| Dashboard | Indicadores personales y delimitación del encargo con Gabriel; atajo para vincular cliente y asunto. |
| Mi día | Elegir la próxima acción pendiente y continuar en el asunto. |
| Clientes | Encontrar una persona u organización y abrir su cartera de asuntos. |
| Asuntos | Organizar documentos, equipo, borradores, revisiones y actividad por caso. |
| Agenda | Tareas y revisiones personales ordenadas por su fecha y hora interna; sin fecha en grupo separado. |
| Equipo jurídico | Presentación del estudio IA: participantes, especialidades, aportes y deliberación de la Junta. También tiene una pestaña propia dentro del asunto. |
| Trabajo jurídico | Producción real de asuntos autorizados: borradores, revisiones, cambios solicitados y responsable humano. |
| Biblioteca | Buscar documentos y referencias; consultar fuentes y avance de carga. |
| Administración | Organización, profesionales y explicación de respaldo/recuperación. |

Agenda usa el mismo corte temporal que Dashboard: una fecha y hora interna anterior al instante actual queda atrasada. Los días se interpretan en America/Asuncion. No calcula plazos judiciales.

En Clientes, los tres contadores son accesos accionables: **Todos los clientes** limpia búsqueda y filtros; **Clientes con asuntos abiertos** muestra solo clientes con al menos un asunto abierto autorizado; **Asuntos abiertos** abre la cartera global con el estado Abiertos. Cada bloque explica qué cuenta y muestra la acción. El filtro de asuntos abiertos se combina con tipo y búsqueda, se anuncia con el total visible y puede quitarse desde su etiqueta. Los totales superiores representan el estudio y los asuntos autorizados, no el subconjunto de una búsqueda. Un cliente puede tener varios asuntos.

Estos accesos se verificaron con cuatro clientes sintéticos: tres con asuntos abiertos y uno sin asuntos; los cuatro asuntos abiertos se abren desde el tercer contador. Se probaron búsqueda vacía, combinación con Personas, restablecimiento, teclado y móvil. Evidencia en `local-browser/reports/client-kpis/`.

## Implementación y verificación

`apps/web/src/os-theme.css` concentra la composición y densidad. `apps/web/src/buttons.css`, importada al final, es la fuente común de apariencia y estados para botones nativos, enlaces `.button` y labels de archivo. Las hojas anteriores conservan geometría y contenido; se retiraron de ellas las recetas de color, hover y elevación de botones. `WorkspaceViews.tsx` implementa los directorios y bandejas; `workspace-model.ts` concentra búsqueda y orden temporal. Las rutas de producción reutilizan las lecturas autorizadas existentes.

Se recorrieron las ocho secciones, las nueve pestañas del asunto, formularios y propuesta de equipo. Capturas y notas están en `local-browser/reports/os-design/`. Se probaron filtros, una tarea sintética fechada y su finalización, y ventanas de 1366, 800 y 390 px. Las tablas conservan columnas legibles con desplazamiento dentro del panel.

Typecheck y compilación pasan. Pasan 58 pruebas locales en seis archivos. La revisión del navegador se realizó con CUA; las suites históricas de Playwright se actualizaron en sus textos y medidas, pero no se ejecutaron en esta revisión. No se certifica accesibilidad integral ni se probaron autenticación remota o despliegues.

## Corrección de densidad

La revisión compacta se comprobó con un estudio sintético en las ocho secciones y en Equipo jurídico, a 1366 × 768 px, más el equipo a 800 y 390 px. Medidas efectivas: menú 170 px, topbar 44 px, título principal 25 px, navegación 30 px, botones principales 26 px, campos 28 px y avatar del Director 78 px. Todos esos elementos bajan al menos un 30% frente a la revisión inicial; los rellenos y separaciones bajan un 35%. El texto pequeño conserva legibilidad.

Capturas y mediciones: `local-browser/reports/compact-density/verification.json`. Compilación y typecheck pasaron. Se actualizó la expectativa de medidas del test histórico de navegador; no se ejecutó esa suite en esta corrección de CSS.

## Hover de tinta global

Implementado sobre los 122 sitios JSX del inventario, sin cambiar los handlers ni sustituir los controles nativos. Las medidas compactas y la navegación colapsable se conservan.

| Familia | Reposo → hover |
|---|---|
| Primario | Tinta `#173744` → tinta luminosa `#2d6674` |
| Secundario, filtros y favoritos | Mineral `#e8eeea` → tinta `#244f5c`, texto papel `#fffefa` |
| Discreto | Transparente → lavado `#e0eae3` |
| Destructivo | Cálido `#f5e9e3` → rojo `#9d4f42` |
| KPI, filas y especialistas | Superficie del panel → mineral `#dbe9dc` |
| Menú | Tinta del lateral → tinta luminosa; conserva el indicador de sección |

Pestañas con hover de tinta, selección persistente y subrayado. Los controles usan textura de grano compartida; sin sombras, transformaciones ni cambios de tamaño. Transición de color de 140 ms, desactivada con movimiento reducido. Foco de teclado de 2 px con separación de 3 px, también en labels de archivo. Deshabilitado y en proceso tienen colores y cursores propios; no reciben el hover activo. Guardar y adjuntar anuncian `aria-busy` durante su operación.

Verificación específica en `local-browser/reports/ink-buttons/`: estados computados de 22 muestras con el CSS compilado, recorrido visual del OS y capturas de formularios, pestañas y controles. La página aislada desactiva solamente sus transiciones para medir el color final de forma determinista; el OS mantiene 140 ms. Typecheck y build pasan. Esta corrección visual no volvió a ejecutar las 58 pruebas de la revisión funcional anterior.

## Flujo visual del documento

La secuencia del entregable guía acciones concretas: **encargo definido → revisar resultado → editar y guardar → revisión humana**. El paso depende de la vista de edición y de la versión realmente guardada; no es una etiqueta fija. Un indicador ámbar pulsa lentamente sobre el paso actual, junto a su número y `aria-current="step"`. El pulso cambia color, sin sombra, escala ni desplazamiento, y se desactiva con movimiento reducido.

Al terminar la consulta, **Encargo y documentos** queda plegado y el foco llega al resultado. Abrir ese panel explica que prepara una nueva consulta y no vuelve a ejecutarla. El resultado muestra la próxima acción, el entregable y temas agrupados con respaldo documental desplegable. Se conservan interpretaciones distintas aunque compartan pasaje. El editor y el registro técnico completo empiezan plegados; el debate se presenta como un resumen de objeciones, límites aceptados, desacuerdos y respuestas pendientes.

**Ver chequeo de fuentes** abre un informe legible: coincidencia de pasajes con la selección, menciones jurídicas localizadas, alcance de la versión, cotejo oficial y uso de RAG. El piloto local no recupera fuentes oficiales: existencia, vigencia, pertinencia y alucinaciones jurídicas quedan sin determinar. No encontrar menciones dentro de las reglas disponibles no se presenta como ausencia de alucinaciones. El control de la versión guardada usa su propio registro; las ediciones sin guardar quedan fuera.

**Continuar: editar documento** abre y enfoca el editor. **Guardar y continuar** crea o revisa la versión, actualiza el control local y lleva el foco a la siguiente acción. El paso 4 conecta con la revisión humana existente. Si falta otro profesional o su permiso de lectura y revisión en el asunto, explica el bloqueo y ofrece configurar ese requisito; no concede acceso automáticamente. La solicitud selecciona un revisor habilitado distinto del autor y conserva la versión exacta. No aprueba el contenido.

Verificación en `local-browser/reports/result-workspace/`: recorrido completo con datos sintéticos hasta una revisión humana pendiente; nuevo encargo con Elena, Valeria y Santiago; guardado, control de referencias ficticias como pendientes, cierre de paneles y foco. Las 30 pruebas locales de equipo jurídico pasan, incluidas la conservación de interpretaciones distintas, una cita documental sin coincidencia y desacuerdos sin respuesta. Typecheck y build correctos. Sin desbordamiento de página a 800 y 390 px, sin llamadas pagas ni despliegues. Las capturas de `work-flow/` documentan la revisión visual anterior, reemplazada por este flujo guiado.

## Gabriel, Equipo jurídico y Consulta jurídica

La consulta general pertenece siempre a **Gabriel**. Se conversa por voz o texto con el avatar flotante, sin abrir una Junta ni crear un asunto por una pregunta general. Una sugerencia del modelo no abre automáticamente la propuesta: se requiere un pedido explícito de análisis o la acción **Armar equipo**.

**Equipo jurídico** presenta a Gabriel, Elena, Valeria, Lucía, Martín, Diego, Camila y Santiago. Las tarjetas explican funciones y aportes; las especialidades y el método se despliegan a pedido, indicando disponibilidad. La deliberación tiene seis etapas interactivas: delimitar, analizar, contrastar, integrar, controlar y aprobar. Se explica el entregable del titular, los puntos conflictivos, el estado de las fuentes y la decisión humana.

Dentro del asunto, **Equipo jurídico** aparece antes de **Consulta jurídica**. Esta última conserva el trabajo del equipo convocado, sus documentos, entregable y controles. Ya no monta el selector Consulta general/Revisión de documentos ni el formulario general anterior. Los registros guardados no se eliminan.

Gabriel tiene flotación visible y se arrastra directamente por el avatar con captura de puntero; se distingue un arrastre de un clic para no abrir la conversación al moverlo. Las flechas del teclado permiten moverlo con el foco. La posición se conserva; el movimiento respeta la preferencia de animación reducida. Ver `docs/operations/GABRIEL_ASISTENTE_VOZ.md`.
