# ADR OS-001 — addendum del prototipo local

2026-10-13. Decisión del propietario en el chat: «sacale el auth y trabjamoes en local storage, luego migramos a supabase... tiene sentido?».

Este cambio reemplaza para el prototipo local la exigencia anterior de disponer de Supabase Auth/Storage antes de entrar en la aplicación. El modo predeterminado funciona sin autenticación, con dos perfiles sintéticos seleccionables y almacenamiento en `localStorage`. No requiere Docker, PostgreSQL ni credenciales. La selección de perfil es una herramienta para probar los flujos; no verifica quién hizo una operación. Las reglas del Core, incluida separación autor/revisor y aprobación de versión exacta, se conservan como reglas de trabajo, no como controles de seguridad ante un usuario del navegador.

Se conserva el Core, los IDs, las versiones originales y sus hashes. El adaptador de PostgreSQL, la API y Supabase quedan preparados como camino futuro, sin ejecutar migraciones, desplegar ni modificar sus límites de autenticación. El modo servidor puede compilarse explícitamente con `VITE_DATA_MODE=server`; sigue requiriendo su infraestructura y pruebas pendientes. Los informes anteriores describen ese antecedente.

Solo se usan datos sintéticos. No hay llamadas a IA, envío de datos ni claves de proveedores en el navegador. La región São Paulo sigue siendo la decisión para una futura plataforma remota. La migración productiva requiere mapear perfiles locales a identidades verificadas y trasladar metadata y objetos preservando IDs/hashes; importar JSON al navegador no constituye esa migración.

Los datos dependen de navegador, perfil y origen exacto (incluido puerto). Borrar el almacenamiento, usar una ventana privada o cambiar de origen puede dejarlos inaccesibles. Se agrega respaldo JSON con versión de esquema e importación validada, que solicita confirmación explícita antes de reemplazar el estado actual. Los documentos locales se limitan a texto UTF-8 de hasta 1 MiB; el límite agregado depende de la cuota real del navegador. Un fallo de cuota conserva el estado anterior y muestra el error.

## Ampliación local aprobada el 17 de octubre de 2026

El propietario aprobó iniciar el workspace con editor colaborativo y guardado real, preservando el OS y sin activar Jev a la salida. La gestión existente sigue en el navegador; el documento adoptado por el workspace incorpora estado compartido en el PostgreSQL portátil existente, ligado a los mismos IDs del Core. Su guardado requiere el host local y PostgreSQL; las vistas anteriores conservan su funcionamiento. No se activan servicios remotos ni se cambia la decisión de Auth/Storage para identidades humanas. Los detalles, pruebas y límites de la transición están en [Implementación del editor local](workspace/IMPLEMENTACION_EDITOR_LOCAL.md).
