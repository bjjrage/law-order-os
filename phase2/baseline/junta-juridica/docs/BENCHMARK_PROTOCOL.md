# Protocolo de evaluación offline después de auditoría

Development: fixtures de tests y demo sintético. Diez repeticiones del mismo caso miden operación y latencia local; no generalización ni calidad de proveedores.

V1: tests/fixtures/holdout.json. SHA-256 f68295e548c863f69a6eb280dee1776a9e9735bd4f5cce0b8b26fc22ecc29399. Se conserva sin cambios como regresión conocida. Su primera evaluación detectó 2/3 referencias; la versión corregida se vuelve a medir sin llamarla independiente.

V2: tests/fixtures/bibliography-holdout-v2.json. SHA-256 1a5d1a1ee10849e79a986163e71a1cafdc32ace6f7d5611b504685b66cf73735. Veinticuatro casos sintéticos de variantes, referencias no soportadas y prosa sin citas. Se congeló después de implementar las reglas y antes de la primera evaluación. Autoría local, sin curaduría externa independiente.

Primera evaluación V2: 23/24, conservada en reports/benchmark-bibliography-v2-first-evaluation.json. Detectó un defecto de asignación de familias con lookahead; la referencia quedó pendiente, sin bypass. Se corrigió la clasificación usando el contexto original y se agregó regresión. Por ello V2 es también conjunto conocido; el reporte declara implementation_corrected_after_first_evaluation y external_independent_validation=false. Nunca alterar los hashes o expectativas para convertir un fallo en PASS.

El runner exige hashes intactos, estados de runs, identidades, conteos de extracción y objeciones esperadas. Un fallo hace status=FAIL y la CLI retorna error. El reporte final está en reports/benchmark-offline.json. Métricas de tokens y costos son SIMULATED/artificiales, con gasto real cero.

Cobertura se cuenta como referencias extraídas más marcadores pendientes. Marcadores pendientes o identidades/citas textuales no comprobadas bloquean verificación. COVERED_IN_GRAMMAR solo significa cobertura de las reglas observadas; no exhaustividad sobre texto jurídico arbitrario.

Pendientes: un holdout nuevo con curaduría independiente, originales auténticos, evaluación por abogados, proveedores reales y escala. Los tests y benchmark ordinarios no hacen red ni llamadas pagas.

