# Especificación de interfaz compacta

> Antecedente histórico. La revisión visual solicitada el 15/10/2026 reemplaza estos tamaños y tratamientos. Ver [sistema de diseño vigente](docs/UX_DESIGN_SYSTEM.md) y el [recorrido visual completo](local-browser/reports/os-design/index.html).

2026-10-13. **SPECIFIED / UI NOT_IMPLEMENTED / VISUAL_QA NOT_RUN**. Requisito del propietario: apariencia contenida semejante a85% pero usable a100%, sin CSS zoom ni transform scale del layout. Raíz: `C:/Users/User/Desktop/PORYECTOS/LAW & ORDER OS/`; objetivo futuro `apps/web`. Ningún screenshot ni app navegable se acredita mediante esta especificación.

## Tokens de implementación

| Token | Valor inicial | Rango permitido / aceptación |
|---|---:|---|
| font.body | 13px | 12.5–13.5; rem equivalente y respeta preferencias usuario |
| font.secondary | 12px | 11–12; no usar11 para contenido jurídico principal |
| font.h1 / h2 / h3 | 20 /16 /14px | 19–22 /15–17 /13–14 |
| line-height.body | 1.4 | 1.35–1.45; documento/editor puede requerir mayor legibilidad |
| shell.topbar | 44px | 42–48 |
| shell.sidebar | 212px | 200–224; colapsada52px con nombres accesibles/tooltips |
| table.row | 34px | 30–36 a100% con contenido de una línea; multilínea/reflow crece |
| control.height | 32px | 30–34 desktop; táctil44px |
| card.padding | 12px | 10–14 |
| space | 4,8,12,16px | Sin márgenes24–32 indiscriminados |
| border / radius | 1px /4px | Contención visual; sombras solo overlays |
| color.canvas / surface | #F5F7FA /#FFFFFF | Revisar contraste medido al implementar |
| color.text / muted | #172B4D /#4B5563 | No aclarar secondary para simular jerarquía |
| color.primary | #174EA6 | Estado foco visible independiente de hover |
| hover | overlay de tinta≈3% | Sin escala, elevación teatral ni animación distractora |
| focus | outline2px +offset2px | Visible, no recortado por overflow/sticky bars |

En CSS usar variables `--font-body`, `--row-height`, `--control-height`, `--space-1..4`; densidad inicial única, no agregar un switch que oculte requisito. Texto escalable y contenido no truncado definitivamente por fixed height. No usar width en píxeles para formularios que impida reflow; tablas pueden scroll horizontal cuando la relación bidimensional lo exige.

## Composición desktop

Topbar44: selector de estudio, búsqueda contextual autorizada, crear contextual y perfil. Sidebar212: Mi día, Asuntos, Clientes, Agenda, Trabajo jurídico y Administración; Dirección visible solo por capacidad. Dentro de Trabajo jurídico, documentos/revisiones/investigaciones como vistas filtradas, sin duplicar navegación interminable. Estado Junta bloqueada se explica en su vista; no contamina todas las pantallas ni impide tareas normales.

Contenido con padding12, encabezado36–40, filtros32 y separación8. Panel principal ocupa ancho restante; drawer contextual360–420 solo al seleccionar recurso, cerrable Escape y con retorno de foco. En1366, área después de sidebar/padding es1130px; en1440 es1204px. Sin drawer, la tabla usa todo el ancho. Mostrar asunto/cliente/estado/responsable/próxima acción/fecha con columnas redimensionables; acciones secundarias menú accesible, primaria visible. Títulos largos con ellipsis solo si detalle/copia y nombre accesible disponibles.

Presupuesto vertical a1366×768: topbar44 + márgenes24 + título36 + filtros32 + gaps16 + cabecera32 + footer32 =216; quedan≈552px, hasta16 filas34 antes de contenido adicional. Criterio mínimo propuesto para fixture de aceptación:12 filas completas en lista de asuntos a1366×768 y14 a1440×900, sin bajar fuente de13px ni reducir controles32. Mi día con secciones debe mostrar al menos8 acciones útiles antes de scroll. Estos números son criterios de diseño para fixture, no exigencia de mostrar filas vacías ni ocultar texto. No forzar altura de filas tras zoom/reflow.

## Vistas y acciones

| Vista | Información mínima y acción principal | Comportamiento real / permisos |
|---|---|---|
| Mi día abogado | Vencidas, hoy, próximas7d, revisiones pendientes, asuntos sin próxima acción; fecha/responsable/origen | Completar tarea interna, abrir asunto, continuar borrador, revisar versión. SQL autorizado, no KPIs inventados. |
| Mi día coordinación | Mis tareas + carga equipo autorizado, reasignaciones pendientes | No ve asuntos privados por rol global; filtros no amplían autorización. |
| Mi día administración | Pendientes administrativos/cobros según permisos financieros futuros | Hasta F8 mostrar vacío explícito de módulo pendiente; no cifras simuladas ni documentos legales. |
| Asuntos | Tabla compacta con consultivo/litigioso, cliente, responsable, estado y próxima acción | Crear/asignar, filtrar por equipo/estado/tipo; detalle tabs Resumen/Documentos/Tareas/Actividad/Procedimientos. |
| Clientes | Tabla nombre/tipo/identificación parcial/contacto útil | Alta/edición según grant directorio; contactos separados; asunto ajeno nunca aparece por relación cliente. |
| Documentos | Título/propósito/versión/hash abreviado/estado/revisor | Incorporar original, versiones, publicar exacta, descargar autorizado; preview privado. |
| Editor/revisión | Documento central + panel de comentarios/referencias acotado | Guardar crea versión, diff/revisión exacta; aprobar requiere confirmación con versión visible. No aprobar por autosave. |
| Tareas/agenda | Lista por fecha/prioridad/responsable/asunto, calendario opcional | Fecha interna, sugerencia legal y plazo confirmado etiquetados distinto; nada de cálculo LLM automático. |
| Administración/Dirección | Acuerdos/gastos/facturado/cobrado separados; tabla que explica cada total | Solo contratos en F1, sin contabilidad ni integración fiscal implementadas. Monedas separadas. |

Mi día API devuelve solo acciones reales con IDs/estado/revisión/URL autorizada; orden vencidas→hoy→revisiones→próximas, desempate fecha/id. Filtros guardados por identidad+estudio, no globales. Tarea sin fecha entra en cola sin fecha, no desaparece. Fechas con zona visible cuando afecta interpretación. Contadores abren lista que los explica, respetan filtros y muros. Sin hero banners, grandes cards de KPI, gráficos decorativos ni dashboard vacío de próxima acción.

## Estados y accesibilidad

Carga: skeleton de la tabla manteniendo altura y anuncio aria-busy; no spinner a pantalla completa al cambiar filtro. Vacío real: una línea explicando filtro/sin elementos y acción autorizada; nunca insertar fixtures. Error: mensaje concreto con request_id y reintento idempotente; campos conservados. 401→reautenticación sin perder borrador local protegido;404 de recurso ajeno no expone su nombre;409→recargar/comparar, nunca overwrite automático;503→estado recuperable sin duplicar comando. Cambiar estudio limpia datos/caches/drawers del anterior antes de pintar el siguiente.

Navegación con landmarks, skip link, encabezados semánticos, tablas con th/scope y sort accesible; botones icon-only con nombre, no depender de tooltip para conocer acción. Tab orden lógico; Enter activa; Escape cierra overlay; foco vuelve al disparador. Modal de aprobación muestra título/versión/hash/revisor y botón explícito; ningún checkbox premarcado sustituye consentimiento. Editor preserva foco al guardar y anuncia versión creada. No comunicar APPROVED/BLOCKED/FAIL solo por color.

Objetivos de contraste: texto normal≥4.5:1, componentes/foco≥3:1. Targets de puntero≥24×24CSSpx o excepción de espaciado comprobada; controles32 permiten ese mínimo, iconos visibles16 dentro de botón32. Modo táctil44, sin imponer botones gigantes desktop. Zoom200% y reflow320CSSpx sin pérdida de funciones; listas pueden pasar a tarjetas compactas y sidebar a drawer. Densidad no justifica focus oculto ni truncamiento de mensajes. [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Contraste/teclado deben medirse: valores propuestos no certifican conformidad por sí solos.

## QA posterior obligatorio

En browser real, misma semilla sintética y fuente cargada: capturar Mi día/Asuntos/Cliente/Documento/Review a1440×900 y1366×768 a100%; comparación adicional85% solo referencia perceptiva. Registrar viewport, deviceScaleFactor, zoom y navegador. Inspeccionar computed styles para rangos, ausencia de zoom/scale global, conteo de filas completas, overflow y focos. Probar teclado completo, errores/vacío/carga/409, zoom200%, reflow, contraste automático y revisión manual. Capturas sin backend/usuarios efectivos prueban diseño parcial, nunca F2/F3 DONE. Resultados futuros en carpeta nueva, no fabricar evidencia en este gate.
