// Only provider availability/response failures authorize the alternate auditor.
// Budget, policy, configuration and adverse audit findings never trigger it.
const fallbackErrors = new Set([
  "MISSING_GEMINI_AUDITOR_CREDENTIAL", "MODEL_ID_NOT_AVAILABLE",
  "MODEL_TOKEN_LIMITS_UNAVAILABLE", "MODEL_CONTEXT_LIMIT_TOO_SMALL",
  "MODEL_OUTPUT_LIMIT_TOO_SMALL", "PROVIDER_ABORTED",
  "TRANSPORT_OUTCOME_UNKNOWN", "PROVIDER_INVALID_JSON", "INVALID_MODEL_OUTPUT",
  "INVALID_INPUT_TOKEN_COUNT",
]);
export async function auditWithFallback(models, invoke) {
  try {
    return {
      audit: await invoke("auditor"),
      metadata: { model_id: models.auditor.model },
    };
  } catch (error) {
    const reason = error?.code ?? error?.message;
    if (!fallbackErrors.has(reason) &&
        !/^PROVIDER_HTTP_(401|403|404|408|429|5\d\d)$/.test(reason ?? ""))
      throw error;
    if (models.auditorFallback.model === models.analysis.model)
      throw Error("WORKSPACE_INDEPENDENT_AUDITOR_REQUIRED");
    // Same evidence, schema and shared ledger. No retry loop or budget reset;
    // the primary's uncertain charge remains reserved by perform().
    return {
      audit: await invoke("auditorFallback"),
      metadata: {
        model_id: models.auditorFallback.model,
        reasoning_effort: "xhigh",
        fallback_from: models.auditor.model,
        fallback_reason: reason,
      },
    };
  }
}
