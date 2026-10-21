# Piloto de investigaciones jurídicas enfocadas

Paquete documental preparado el 19 de octubre de 2026, America/Asuncion. Versión 0.1. Estado: **PREPARADO PARA REVISIÓN; INFERENCIAS NO EJECUTADAS**.

Compara un generalista autónomo, un generalista por etapas y tres investigaciones enfocadas con integración por el titular. Contiene tres expedientes íntegramente sintéticos, fuentes públicas archivadas, protocolo y formularios. No instala componentes, no modifica la arquitectura del OS y no contiene un ejecutor de inferencias.

## Qué abrir

- [Protocolo](PROTOCOLO.md): hipótesis, condiciones comparables, mediciones y decisiones.
- [Brief común](publico/BRIEF_COMUN.md): instrucciones y condiciones compartidas por todas las modalidades.
- [Expediente P01](publico/casos/P01/ENCARGO.md), [P02](publico/casos/P02/ENCARGO.md) y [P03](publico/casos/P03/ENCARGO.md): cada encargo enlaza sus documentos originales sintéticos.
- [Fuentes comunes](publico/fuentes/FUENTES.md): publicaciones oficiales archivadas y límites de la selección.
- [Preparación de las modalidades](operacion/MODALIDADES.md): encargos breves para A, B y C.
- [Ficha previa](operacion/FICHA_PREVIA.json): modelo, presupuesto, revisores y criterios todavía por completar.
- [Registro de las 18 ejecuciones previstas](operacion/EJECUCIONES.csv): no contiene resultados.
- [Plantilla de revisión ciega](plantillas/REVISION_CIEGA.md) y [registro de hallazgos](plantillas/HALLAZGOS.csv).
- [Corrección y tiempos](plantillas/CORRECCION_Y_TIEMPOS.csv), [telemetría](plantillas/TELEMETRIA.csv) y [comparación final](plantillas/COMPARACION.md).
- [Uso de las plantillas](plantillas/LEEME.md): campos, tiempos, costos y cegamiento.
- [Guía reservada](reservado/GUIA_REFERENCIAS.md): referencias iniciales y controles negativos para los revisores.
- [Manifiesto](MANIFIESTO.json): inventario y hashes de esta preparación.
- [Validación de preparación](VALIDACION_PREPARACION.json): comprobaciones de estructura; no resultados jurídicos.

## Cómo separar el material

Los investigadores reciben exclusivamente `publico/` y el encargo de modalidad que les corresponda. No deben tener acceso a la raíz completa del repositorio. `reservado/` contiene respuestas de referencia; `operacion/` contiene la modalidad y la correspondencia con etiquetas ciegas. Ninguna de esas dos carpetas se entrega al evaluador ciego como parte del documento que puntúa.

Los nombres de carpetas no son un control de permisos. El futuro operador debe aislar físicamente las copias o limitar las herramientas al conjunto autorizado. La revisión de completitud puede utilizar las referencias reservadas después de la lectura independiente descrita en el protocolo.

## Alcance de la preparación

Los tres asuntos pertenecen a negociaciones de adquisición de negocios en Paraguay y comparten tipo de entregable. Exploran distintas dependencias dentro de esa familia; no representan todas las especialidades jurídicas. Los hechos, personas, empresas, comunicaciones y documentos privados son ficticios. Las fuentes F01–F03 son publicaciones oficiales reales y están separadas de esos hechos.

Las referencias fueron elaboradas por IA y siguen pendientes de revisión jurídica humana. Son material de desarrollo conocido, no un holdout independiente. Los originales públicos archivados no se presentan como textos consolidados certificados al 19/10/2026. El paquete permite revisar y terminar de fijar el ensayo; todavía no autoriza gasto ni acredita superioridad jurídica.

El manifiesto conserva el estado de preparación. Una revisión humana que cambie hechos, fuentes o criterios requiere una versión nueva antes de congelar la ejecución. No se modifican benchmarks ni conjuntos reservados anteriores del proyecto.

El manifiesto no se incluye a sí mismo en su inventario. `MANIFIESTO.sha256` contiene su hash y también queda fuera de ese inventario para evitar una dependencia circular. La validación registra el ámbito exacto de sus comprobaciones; no ejecuta el OS ni los modelos.
