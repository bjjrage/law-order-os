# Inventario de botones y propuesta global

15/10/2026. Inventario histórico anterior a la migración. Sus conteos, líneas y descripción de estilos documentan la base analizada, no la cascada actual. El propietario aprobó luego el hover de tinta global; implementación al final de este documento.

## Alcance y método

Se analizaron todos los componentes TSX de `apps/web/src` y las dos hojas que importa `main.tsx`: primero `styles.css`, después `os-theme.css`. El inventario cuenta sitios JSX, no instancias en pantalla: un botón dentro de un `map` puede producir muchos controles.

- 122 sitios JSX en 18 componentes: 119 botones, 2 labels y 1 enlace con clase `.button`.
- 191 reglas CSS candidatas relacionadas con botones, su contenido, foco universal y movimiento reducido: 100 en `styles.css` y 91 en `os-theme.css`.
- 25 reglas de hover: 12 en la hoja histórica y 13 en el tema.
- 6 reglas que incluyen foco, 2 con `:active` y 18 declaraciones con `!important` dentro de esas candidatas; tres de estas últimas pertenecen a movimiento reducido.
- Las reglas se combinan por especificidad, orden y contexto. Una declaración histórica presente no implica que esté vigente en pantalla.

El detalle reproducible, con archivo, línea, condición, selector y cada declaración, está en `local-browser/reports/button-inventory/inventory.json` y `declarations.csv`. `scan.mjs` permite regenerarlo. No se inspeccionaron hojas de otros productos, archivos de build ni copias históricas como si fueran fuentes activas.

## Familias actuales

| Familia | Selectores y fuente principal | Estado actual / problema |
|---|---|---|
| Base / secundario | `styles.css:169`, `os-theme.css:32`, `os-theme.css:87` | Blanco cálido, borde gris de 1 px, radio 6 px, 26 px mínimo. Hover verde gris y borde oscuro. Es el tratamiento del botón señalado. |
| Primario | `.primary`; `os-theme.css:109` | Tinta sólida; hover más claro y aro dorado de 2 px. El aro compite con el foco de teclado. |
| Texto / navegación subordinada | `.text-button`, `.text-action`; `os-theme.css:150` | Dos recetas distintas: subrayado, fondo y colores diferentes. Algunas fuerzan prioridad con `!important`. |
| Menú lateral | `.nav-item`, `.sidebar-toggle`, `.local-tools`; `os-theme.css:209`, `:277`, `:322` | Fondo oscuro y hover propio. Selección persistente con latón; necesita conservarse como navegación. |
| Pestañas | `.tabs button[role=tab]`, `.result-tabs button`; `os-theme.css:1315`, `styles.css:1175` | Dos implementaciones y tokens distintos. El hover global de `role=tab` también alcanza las pestañas de resultados. |
| Filtros segmentados | `.segmented button`; `os-theme.css:716` | Reposo transparente, seleccionado blanco, hover verde. Usa varias declaraciones `!important`. |
| Filtros de Agenda | `.agenda-filters button`; `os-theme.css:962` | Otra receta de selección: tinta sólida. Debe unificarse con los segmentados. |
| Contadores de Clientes | `.summary-control`, `.client-filter-chip`; `os-theme.css:628` | Accionables, fondo suave, borde de selección y hover propio. Son superficies interactivas, no botones de acción compactos. |
| Indicadores y filas de Dashboard | `.dashboard-kpis > button`, `.dashboard-matters > button`; `os-theme.css:1512`, `:1611` | Otra receta de hover, heredada de varias etapas; los KPI y las filas necesitan estados coherentes. |
| Biblioteca | `.legal-library > .actions button`, `.library-counts button`; `os-theme.css:1811`, `:1867` | Selector de vista, filtros y favoritos se apoyan en reglas distintas y en el hover genérico. |
| Equipo / especialistas | `.specialist-selector button`, `.specialist-persona`, `.deliberation-steps button` | Reglas repartidas en la hoja histórica. Hay declaraciones de elevación y sombra residuales; verificar su efectividad antes de retirar. |
| Documentos / eliminación | `.document-remove`, `.document-file-actions .text-action`; `styles.css:1226` | Acción de eliminar en rojo, subrayado y hover cálido; falta una variante semántica central para acciones destructivas. |
| Adjuntar / importar | `.button`, `.document-upload`, `.document-upload-prompt button`; `styles.css:965` | Conviven botones y labels que activan inputs. La unificación debe conservar el foco del input y el selector de archivos. |
| Tablas y formularios | `td button`, `.form-footer .primary`, `.entry-action` | Variaciones locales de tamaño y relleno sobre el mismo hover base. No existe un componente Button compartido. |

## El botón de la captura

`App.tsx:1202` renderiza “Crear tarea en un asunto →” como un `<button>` sin variante. Por eso recibe el secundario genérico de `os-theme.css:87` y su hover de `:99`:

```css
/* Reposo */
background-color: #fffefa;
border: 1px solid #bac8c6;
color: #173744;
/* Hover */
background-color: #e0e9e5;
border-color: #40676b;
color: #102f39;
```

La forma se define sobre todo por el contorno fino; el hover sigue pareciendo un campo de formulario. La propuesta cambia la superficie y la jerarquía, además de ajustar el color.

## Propuesta recomendada: superficies mate y hover de tinta

Mantener la densidad compacta. Controles de 26–28 px, texto de 12 px, radios de 6–7 px. Textura mínima común, sin bisel, elevación, desplazamiento, escala ni sombra 3D.

| Variante | Reposo | Hover | Uso |
|---|---|---|---|
| Primario | Tinta sólida, texto claro | Tinta más luminosa; sin aro dorado | Guardar, confirmar, ejecutar |
| Secundario | Superficie mineral suave, sin contorno dominante | Tinta sólida y texto claro | Crear tarea, adjuntar, volver, ver asuntos |
| Discreto / texto | Transparente | Mancha de fondo suave; sin subrayado de botón | Acciones subordinadas y navegación contextual |
| Destructivo | Rojo sobrio sobre superficie cálida | Rojo más intenso, texto claro | Enviar a papelera, revocar o desactivar, según corresponda |
| Selección | Superficie suave | Contraste algo mayor | Filtros, pestañas y chips; el estado seleccionado persiste al salir el mouse |
| Superficie interactiva | Fondo del panel | Lavado mineral y acento discreto | KPI, filas y tarjetas que abren o filtran contenido |

Alternativa para secundarios: hover mineral más suave. Se muestra junto al hover de tinta en el laboratorio para comparar intensidad sin tocar el OS.

### Estados comunes

- Hover: cambia el relleno y el contraste; no aparece un anillo de foco ni cambia el tamaño.
- Presionado: un tono más profundo, sin mover el control.
- Foco de teclado: anillo visible y consistente de 2 px con separación; independiente del hover.
- Deshabilitado: superficie y texto específicos, sin hover; no usar “espera” para cualquier causa de deshabilitación.
- En proceso: estado aparte, con texto de progreso y `aria-busy`, conservando el ancho cuando sea posible.
- Seleccionado: `aria-pressed` o `aria-selected`; no confundirlo con el estado temporal del mouse.
- Movimiento reducido: transiciones desactivadas cuando corresponda. Colores con transición de 120–160 ms en el resto.

## Implementación global propuesta

1. Crear tokens semánticos únicos para relleno, texto, borde, hover, presionado, foco y deshabilitado.
2. Centralizar la receta de acciones en un componente `Button`, con variantes primario, secundario, discreto y destructivo; tamaños compacto, normal e ícono.
3. Usar los mismos tokens en pestañas, filtros, navegación, KPI y filas. Conservar sus geometrías y funciones propias.
4. Migrar también labels e inputs de adjuntar/importar y favoritos de Biblioteca; evitar normalizarlos como botones comunes sin revisar su interacción.
5. Retirar las reglas históricas redundantes después de verificar la cascada. Quitar los `!important` de color/hover; conservar excepciones de accesibilidad justificadas.
6. Verificar en las ocho secciones y las pestañas del asunto: clic, teclado, foco, hover, selección, carga y deshabilitado. Mantener las medidas compactas.

No alcanza con añadir otro `button:hover` al final: eso seguiría aumentando las superposiciones.

## Laboratorio local

`local-browser/reports/button-inventory/preview.html` muestra el botón actual y dos propuestas de hover, una matriz de estados y los usos de selección/superficie. Es una muestra interactiva aislada; sus controles no crean tareas ni modifican datos del OS. Se sirve también como `/button-lab.html` en el servidor local existente.

## Implementación aprobada y realizada

El hover de tinta se aplica globalmente desde `apps/web/src/buttons.css`, importada después de las hojas de estructura. Cubre botones nativos, labels y enlaces `.button`, incluidos navegación, pestañas, filtros, favoritos, documentos, formularios y piloto anterior. Se mantienen los 26–28 px habituales y las geometrías propias de tarjetas y navegación.

Se centralizó la receta CSS conservando los controles nativos existentes, en lugar de introducir una migración de componente React para un cambio de apariencia. Se retiró la pintura de botones de `styles.css` y `os-theme.css`, incluidos hovers y prioridades de color que competían con la receta común. Las hojas anteriores conservan la distribución, medidas y estilos del contenido.

Primarios y secundarios usan tinta; los discretos y las superficies interactivas usan lavados minerales, y los destructivos conservan rojo semántico. Textura sutil, sin elevación, bisel, sombra ni desplazamiento. Selección, presionado, deshabilitado, progreso y foco de teclado comparten tokens. La previsualización anterior queda como evidencia de la propuesta; la página `/ink-button-check.html` comprueba los selectores reales contra el CSS compilado.

Evidencia de la implementación: `local-browser/reports/ink-buttons/compiled-css-checks.json`, capturas del OS y `verification.json`. Typecheck y compilación local correctos. Sin despliegue ni llamadas pagas.
