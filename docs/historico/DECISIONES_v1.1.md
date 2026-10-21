# LAW & ORDER OS — Registro de decisiones y pendientes

**Corte: 11/10/2026.** Las decisiones acordadas provienen de la conversación. Las propuestas del blueprint no se convierten automáticamente en decisiones congeladas por aparecer en un archivo.

## Acordado por Marcelo

El producto será un OS para la operativa completa del estudio. Cada abogado tendrá panel propio; la información del asunto será compartida según permisos. La Junta Jurídica y el RAG no serán el único producto.

Se trasladará el mecanismo multiagéntico de Mussi: 3→2→1, confrontación entre modelos y checker bibliográfico determinístico. Se combate la jurisprudencia fabricada utilizada como fundamento; la calidad de la interpretación y decisión jurídica corresponde al abogado. No usar “mejor veredicto” como definición de ese objetivo.

Se investigarán primero fuentes estatales paraguayas para las salas Constitucional, Civil y Penal, Constitución, leyes y códigos. Después se clonará y adaptará el motor vigente, sin convertir código histórico de Junta Normal en arquitectura destino.

## Propuestas nuevas de la versión 1.0

Modelo lógico asunto/procedimiento, matriz de roles detallada, navegación, estados, criterios de exportación, entidades, operaciones de servicio, taxonomías de checker, manifiesto de cobertura y fases F0–F10. Todas deben revisarse antes de fijar su implementación.

La inclusión de Constitución y códigos no acredita su vigencia ni permiso. El inventario de fuentes no es una lista de conectores terminados.

## Pendientes de decisión

| ID | Decisión | Estado | Gate afectado |
|---|---|---|---|
| DEC-01 | Estudio piloto, roles, organización y especialidades | Pendiente de definir | F0/F5/F6/F7/F8 |
| DEC-02 | Snapshot local canónico de Mussi | Pendiente de obtener/verificar | F2 |
| DEC-03 | Repo destino, propietarios, ramas y ambientes | No definido | F2/F5 |
| DEC-04 | Stack, datos, auth, jobs, almacenamiento, región y operación | No definido | F2/F3/F5 |
| DEC-05 | Accesos/APIs/exportaciones y uso de CSJ/Gaceta/BACN | Investigación parcial; condiciones sin cerrar | F1/F3 |
| DEC-06 | Corpus normativo, versiones y permisos de compilaciones | Parcial; Civil/Procesal Civil íntegros pendientes | F1/F3/F9 |
| DEC-07 | Modelos, presupuesto y políticas de datos con proveedores | No definido | F4 |
| DEC-08 | Dataset, holdout, costos/latencia/recuperación y carga | Criterios cualitativos propuestos; umbrales por aprobar | F3/F4/F9 |
| DEC-09 | Honorarios, monedas, impuestos e integración fiscal | No definido | F8 |
| DEC-10 | Correo/calendario/firma/seguimiento judicial | No definido | F7 |
| DEC-11 | Retención, residencia, soporte y uso de datos reales | No definido | F5/F9/F10 |

## Discrepancia constatada

La rama remota consultada `recovery/canonical-from-229ffc9` apunta a `aff5e3897dac37560e0e0653bf9fbb0a09ccb64c`. Su commit fue fechado el 07/09/2026, mientras el handoff canónico es del 12/09/2026 y declara autoridad del working tree local para cambios no pusheados. No se audita ni se revierte ese árbol local desde aquí. Se requiere exportación o acceso al corte correcto antes de extraer.

## Protocolo para cerrar una decisión

Registrar alternativa elegida, motivo, impacto en blueprint/roadmap, fecha, aprobador, evidencia y requisitos afectados. Si cambia un invariante previo, describirlo como cambio y pedir aprobación explícita. Si una dependencia no se resuelve, la fase permanece bloqueada; una fecha de entrega no autoriza improvisar el dato.
