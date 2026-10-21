# ADR 001 — Motor propio de Junta Jurídica V2

Fecha: 2026-10-12. Estado: ACEPTADO por directiva explícita del usuario, limitado a la Junta.

## Contexto y decisión

La directiva adjunta informa que el Blueprint v1.1 proponía clonar la Junta Clínica 3→2→1 de Mussi. Esa decisión fue expresamente reemplazada por:

`Jev 1.13 → GPT-6 Luna → GPT-6.1 Sol (medium) → Gemini 3.8 Flash → checker determinístico → abogado humano`.

Se construye un motor propio, modular y verificable. Jev clasifica evidencia; Luna estructura contexto; Sol analiza una cuestión; Gemini objeta; el checker coteja identidad y citas literales contra registros autorizados. Ninguna coincidencia entre modelos autentica una referencia. El abogado conserva la evaluación jurídica final.

## Alcance de esta implementación

Node/TypeScript/Vitest son el stack **experimental** indicado para una carpeta vacía. Módulos en un proceso, persistencia local intercambiable, contratos Zod versionados. No se selecciona infraestructura definitiva, servicios externos adicionales ni un framework de agentes productivo.

BLOCKED: no estaban disponibles Blueprint/Roadmap v1.1, handoff ni fuentes oficiales del proyecto. Este ADR registra la directiva recibida; no afirma haber inspeccionado ese Blueprint. No se sobrescribió documentación histórica ni se cambiaron otras decisiones del OS. Antes de integrar, contrastar interfaces y almacenamiento con esos documentos.

## Consecuencias

Se acotan candidatos y llamadas, se congelan evidencias y se conserva trazabilidad. Los proveedores reales requieren configuración y validación de cuenta. Offline se utilizan simuladores explícitos. Fallas e interrupciones preservan evidencia y costos inciertos, sin aprobación ficticia ni repetición de llamadas de resultado desconocido.

No se clona ni se modifica Mussi Online. La existencia de citas no certifica la corrección de una tesis jurídica. La cobertura de recuperación y extracción requiere validación sobre un corpus autorizado.
