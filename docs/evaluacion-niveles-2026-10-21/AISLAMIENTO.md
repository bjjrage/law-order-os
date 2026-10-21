# Aislamiento verificado offline — v0.3

El ejecutor de prueba usa **AppContainer de Windows con cero capacidades** y un proceso Node en modo de permisos de solo lectura. La identidad restringida no es la del proceso preparador. Se verifican TokenIsAppContainer y TokenCapabilities del proceso real antes de reanudarlo. No hay excepción de loopback ni permiso de red. El Job Object limita a un proceso y lo termina al cerrar el lanzador. Solo se heredan los dos handles de entrada/salida del protocolo; se retiran la ACL temporal y el perfil al terminar.

La cápsula contiene copias del código/dependencias necesarios y claves ficticias. Su manifiesto registra hashes de todos los archivos. Se rechazan enlaces y archivos alterados antes de lanzar. No se monta el workspace completo. El host entrega por stdin un snapshot de un solo caso con los documentos ya liberados. La fuente N06 aparece desde el turno 2; su publicación completa seleccionada se entrega como texto y el volumen PDF queda como procedencia. Los dossiers, otros casos, documentos futuros, configuración real y registro global quedan fuera de los permisos de la cápsula.

Las herramientas de gestión/biblioteca están deshabilitadas por validación del runtime en este modo. No se conecta un repositorio de producción. El historial persistente del host solo permite listar/leer trabajos de la misma ejecución; IDs ajenos se rechazan. La secuencia de turnos y sus claims durables impiden repetir un turno iniciado tras un reinicio. No hay PostgreSQL, servidor HTTP, shell o conexión externa en el proceso evaluado. Los resultados y el registro financiero permanecen en el host; este último solo admite el ID de interacción y los tickets emitidos a esa ejecución. El proceso no puede inicializar, reiniciar o aumentar la política financiera por ese protocolo.

## Pruebas y alcance

[AISLAMIENTO_OFFLINE.json](operacion/AISLAMIENTO_OFFLINE.json) conserva:

- Token AppContainer real con cero capacidades.
- Denegación de lectura absoluta/relativa de `.env`, dossier, documento futuro, registro global y canario.
- Denegación por Windows de abrir un canario SQLite válido que sí lee el host. Esta comprobación no depende del control de archivos de Node, que por sí solo no cubre todas las APIs nativas.
- Escritura sobre código y creación de procesos rechazadas.
- Entorno sin credenciales ni NODE_OPTIONS; cero conexiones a un listener de loopback con control positivo desde el host. El intento del contenedor terminó en timeout, que no se usa como prueba aislada: se combina con el token sin capacidades y el listener accesible.
- Cuatro interacciones consecutivas del workflow actual con especialista y auditoría, usando respuestas de protocolo sintéticas. Cada turno recibió el historial propio acumulado (0, 1, 2 y 3 trabajos), con denegación de IDs ajenos. Las 20 generaciones de protocolo sintéticas no son resultados jurídicos ni solicitudes a modelos reales.

Esto acredita las cápsulas y las cuatro interacciones offline documentadas. No acredita un benchmark jurídico ejecutado, revisión humana, exportación ciega final ni una matriz real de 36 conversaciones. Antes de cualquier ejecución futura deberán conservarse estas restricciones y completar tarifas/cotas, corpus y aprobación jurídica. El ejecutor disponible no tiene transporte real ni un modo para habilitarlo.

Windows AppContainer puede acceder a recursos públicos del sistema concedidos a aplicaciones; no se afirma que solo exista un directorio legible en toda la máquina. La protección de los materiales reservados del piloto se verifica con los controles descritos. El código ejecutado es una copia confiable congelada; los documentos son datos, nunca código ejecutable.

## Repetición

`node scripts/benchmark-offline-check.mjs` prepara una cápsula nueva dentro de `.local-dev`, reutiliza el mismo registro OFFLINE_ONLY del piloto y conserva un informe. Requiere el contexto de usuario Windows capaz de crear perfiles AppContainer temporales; dentro de un sandbox sin perfil puede fallar. **No hay fallback a ejecución sin aislamiento.** No modifica la base de trabajo, servicios, firewall, permisos del workspace completo ni configuración de gasto de la aplicación.

La referencia negativa anterior se conserva en AISLAMIENTO-v0.2.md. El proceso preparador todavía puede leer dossiers: esa capacidad del operador no se confunde con la del proceso aislado.
