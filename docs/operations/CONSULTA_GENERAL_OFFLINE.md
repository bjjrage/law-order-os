# Consulta general — integración local y prueba offline

Implementado el 2026-10-15, bajo la instrucción del propietario: integrar el motor existente y probarlo offline, con datos sintéticos, sin llamadas pagas ni despliegues.

## Recorrido disponible

Asuntos → asunto → Equipo jurídico → **Consulta general**.

1. Escribir una pregunta delimitada y confirmar datos sintéticos.
2. **Preparar consulta** guarda la pregunta y el alcance, crea un snapshot vacío de documentos y busca bibliografía en la Biblioteca local. No incorpora la pregunta como un archivo.
3. **Probar circuito offline · USD 0** ejecuta la Junta existente con proveedores simulados: contexto, análisis, auditoría y checker de referencias. La clasificación documental no se invoca sin pasajes.
4. Se muestra un resumen de la prueba, con la pregunta probada y el detalle técnico cerrado. La preparación se pliega y la siguiente acción es **Preparar otra consulta**.

Los asuntos sin originales abren Consulta general por defecto; se puede cambiar de modo. La revisión documental conserva su selección, extracción, equipo, resultados y borradores previos. La prueba general no agrega documentos sintéticos al asunto ni guarda su salida como un borrador jurídico.

## Motor y controles

- `RequestSchema` acepta cero documentos únicamente con `consultation_mode=GENERAL`. La revisión documental conserva el mínimo de un original.
- `LegalBoard` permite contexto y análisis sin evidencia solo en modo general. No se crea evidencia ficticia ni se relajan los controles de procedencia.
- Las instrucciones de los adaptadores existentes distinguen orientación condicional, supuestos del consultante y hechos acreditados. Sin pasajes, no se admite una base factual inventada.
- Los adaptadores configurados se prueban con transporte HTTP inyectado que devuelve respuestas controladas. No se accede a cuentas ni a modelos reales.
- La preparación `execution_mode=OFFLINE_TEST` usa precios de simulación de cero, no lee credenciales y no necesita un archivo de precios del proveedor.
- `runCase` ejecuta exclusivamente proveedores offline para esa preparación; `consultCase` rechaza convertirla en una ejecución paga y no escribe una autorización.
- El resultado se identifica como `OFFLINE_SIMULATION`, `legal_answer_generated=false`, `network_used=false`, `paid_calls=0`. La autenticación de normativa, jurisprudencia y la evaluación real de alucinaciones siguen pendientes.

## Límite funcional explícito

La integración permite preparar la consulta y comprobar el circuito. **Todavía no entrega una respuesta jurídica generada por IA**, porque la ejecución externa sigue fuera del alcance autorizado. La salida controlada comprueba el funcionamiento técnico; no simula conocer la respuesta del modelo a una pregunta arbitraria.

## Validación

- 34 pruebas del puente de casos, consulta general y equipo documental.
- 222 pruebas del motor de Junta.
- Compilación del motor, typecheck del OS y build web.
- Navegador: pregunta hipotética sobre venta del 55%, cero documentos, preparación y prueba completadas; resultado recuperado al salir y volver; pestaña Documentos permanece vacía.
- Casos negativos: hecho inventado sin procedencia rechazado; cita ficticia pendiente de revisión; cero tráfico real con transporte global bloqueado; preparación offline rechazada en la vía de autorización paga.

El servidor existente y los trabajos de Biblioteca no se reiniciaron.
