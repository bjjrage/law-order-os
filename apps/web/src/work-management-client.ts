export const workChanged = () =>
  window.dispatchEvent(new Event("law-order-work-changed"));
export const errorText = (cause: unknown) =>
  ({
    DIRECTOR_REQUIRED: "Esta acción corresponde al Director del despacho.",
    VERSION_CONFLICT:
      "El encargo cambió. Actualizá la vista antes de continuar.",
    REQUEST_ACTION_REQUIRED:
      "Primero registrá la reprogramación de la tarea o el plazo original.",
    SELF_REVIEW_FORBIDDEN: "Elegí un revisor que no haya escrito esta versión.",
    INACTIVE_ASSIGNEE: "La persona ya no tiene una cuenta activa.",
    REVIEW_ASSIGNMENT_REQUIRED:
      "La revisión requiere asignar un revisor habilitado.",
    USE_TASK_WORKFLOW:
      "Usá el flujo del plazo o de la revisión para modificar este encargo.",
    ACCESS_DENIED: "La cuenta no tiene acceso para realizar esta acción.",
  })[String((cause as Error).message)] ?? (cause as Error).message;
