export function workspaceFailure(code: string | null) {
  const messages: Record<string, string> = {
    WORKSPACE_CONTROL_REQUIRED: "La revisión obligatoria no se completó. El trabajo conservado no se considera controlado.",
    WORKSPACE_CONTROL_ARTIFACT_CHANGED: "La salida cambió después de su control. Debe revisarse la versión exacta antes de aplicarla.",
    WORKSPACE_SPECIALIST_REQUIRED:
      "Este trabajo jurídico debe realizarlo un especialista; Gabriel debe delegarlo.",
    WORKSPACE_SPECIALIST_PACK_MISMATCH:
      "El paquete seleccionado no corresponde al especialista. Gabriel debe corregir la asignación.",
    WORKSPACE_AUDIT_TARGET_INVALID:
      "La revisión no pudo vincular una observación con la salida revisada. No se considera controlada.",
    WORKSPACE_OPERATION_FAILED:
      "La ejecución se interrumpió. Este registro no permite confirmar que se haya preparado una propuesta completa.",
    WORKSPACE_STORAGE_ERROR:
      "El servidor no pudo guardar o recuperar el trabajo. El detalle técnico identifica el fallo de almacenamiento.",
    WORKSPACE_FILE_ACCESS_FAILED:
      "El servidor no pudo leer un archivo necesario para ejecutar el pedido. El detalle técnico identifica el fallo de acceso.",
    INCOMPLETE_MODEL_RESPONSE:
      "El proveedor interrumpió la respuesta. Ese registro no conservó el motivo detallado; no hay una propuesta completa para aplicar.",
    INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS:
      "La redacción agotó el límite de salida del modelo. No se aplicó texto incompleto; el contrato y los hallazgos se conservan.",
    WORKSPACE_INVALID_EDIT_BLOCK:
      "La propuesta señaló un pasaje que no coincide con el documento abierto. No se aplicó ningún cambio.",
    WORKSPACE_REVISION_SIZE_LIMIT:
      "La propuesta supera el tamaño permitido para este documento. No se aplicó ningún cambio.",
    INVALID_MODEL_OUTPUT:
      "La respuesta del modelo no tuvo el formato requerido. No se aplicó ningún cambio.",
    WORKSPACE_MODEL_CONTEXT_LIMIT:
      "Este intento fue bloqueado por el antiguo cálculo de contexto del sistema. Tu mensaje no era demasiado largo. Podés volver a enviarlo a Gabriel.",
    INVALID_INPUT_TOKEN_COUNT:
      "No se pudo comprobar el costo de la consulta con el proveedor. No se inició la generación ni se modificó el documento.",
    WORKSPACE_INTEGRATION_SIZE_LIMIT:
      "Los aportes excedieron el tamaño de la integración. No se redactó una versión. Si ya tenés hallazgos completos, podés preparar el contrato desde ese análisis sin volver a convocar al equipo.",
    WORKSPACE_DRAFT_RELOAD_REQUIRED:
      "Esta pestaña usa la interfaz anterior y mostraba el presupuesto de una consulta breve. Recargá y elegí Preparar versión con estos hallazgos para ver y autorizar el presupuesto de redacción. No se hizo la llamada de redacción.",
    WORKSPACE_DIRECTOR_BASIS_INVALID:
      "No se pudo vincular el análisis elegido por Gabriel con este documento. No se ejecutó la redacción ni se aplicaron cambios.",
    WORKSPACE_DIRECTOR_SCOPE_INVALID:
      "No hay una selección válida para el fragmento que Gabriel pidió modificar. Seleccioná el texto y volvé a indicar qué necesitás.",
    WORKSPACE_MODEL_NOT_CONFIGURED:
      "La configuración del modelo no está disponible en el servidor.",
    MISSING_DEEPSEEK_CREDENTIAL:
      "Falta configurar la clave de DeepSeek en el servidor local. El documento y los trabajos guardados se conservan.",
    MISSING_GEMINI_AUDITOR_CREDENTIAL:
      "Falta la clave de Gemini para la auditoría independiente. No se sustituye al auditor por el modelo del autor.",
    WORKSPACE_INDEPENDENT_AUDITOR_REQUIRED:
      "El auditor debe usar un modelo distinto del autor. Revisá la configuración de la revisión independiente.",
    DEEPSEEK_MODEL_NOT_CONFIGURED:
      "El modelo de DeepSeek configurado no coincide con el habilitado para análisis.",
    WORKSPACE_REVISION_RESULT_MISSING:
      "El modelo respondió sin redactar la versión del documento. No se aplicó ningún cambio.",
    WORKSPACE_REVISION_BASIS_INVALID:
      "No se encontró un análisis completo de este documento para preparar la versión.",
    BUDGET_EXHAUSTED:
      "La preparación supera el presupuesto autorizado. No se lanzó otra llamada.",
    TRANSPORT_OUTCOME_UNKNOWN:
      "Se perdió la conexión con el proveedor. El resultado es desconocido; no se reintenta automáticamente.",
    PROVIDER_ABORTED:
      "Se agotó el tiempo de espera del proveedor. No se reintenta automáticamente.",
  };
  return (
    messages[code ?? ""] ??
    "La preparación no terminó. El documento y los hallazgos existentes se conservan."
  );
}
