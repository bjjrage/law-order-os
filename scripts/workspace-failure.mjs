/** Persist technical evidence only. Exception messages can contain document text,
 * provider bodies or secrets and must never be copied into the job or the UI. */
export function workspaceFailureContext(error, stage = "REQUEST") {
  const name = /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(error?.name ?? "")
    ? error.name
    : "Error";
  const nativeCode = /^[A-Z0-9_]{2,64}$/.test(error?.code ?? "")
    ? error.code
    : null;
  const category =
    /^(EACCES|EPERM|ENOENT|EIO|ENOSPC|ERR_MODULE_NOT_FOUND)$/.test(
      nativeCode ?? "",
    )
      ? "FILESYSTEM"
      : /^[0-9A-Z]{5}$/.test(nativeCode ?? "")
        ? "DATABASE"
        : name === "ZodError"
          ? "VALIDATION"
          : name === "BoardError"
            ? "PROVIDER"
            : "RUNTIME";
  const frame =
    String(error?.stack ?? "")
      .split("\n")
      .slice(1)
      .map(
        (line) =>
          line
            .replaceAll("\\", "/")
            .match(
              /\b((?:scripts|apps|packages|junta-juridica|dist)\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts|tsx):\d+:\d+)\)?$/,
            )?.[1],
      )
      .find(Boolean) ?? null;
  return {
    category,
    error_name: name,
    native_code: nativeCode,
    source: frame,
    stage,
  };
}
export function workspaceErrorCode(error) {
  const code = typeof error?.message === "string" ? error.message : "";
  const metadata = workspaceFailureContext(error);
  if (metadata.category === "DATABASE") return "WORKSPACE_STORAGE_ERROR";
  if (metadata.category === "FILESYSTEM") return "WORKSPACE_FILE_ACCESS_FAILED";
  if (
    /^(WORKSPACE_[A-Z0-9_]+|PROVIDER_[A-Z0-9_]+|MODEL_[A-Z0-9_]+|INCOMPLETE_[A-Z0-9_]+|INVALID_MODEL_OUTPUT|INVALID_INPUT_TOKEN_COUNT|TRANSPORT_OUTCOME_UNKNOWN|UNEXPECTED_MODEL_ID|BUDGET_EXHAUSTED|BROWSER_APPROVAL_NOT_ENABLED|EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED|CURRENT_PRICE_REQUIRED|PRICE_REVALIDATION_REQUIRED|MISSING_CREDENTIAL|VERSION_CONFLICT|ACCESS_DENIED|UNAUTHENTICATED|TRANSACTION_REQUIRED)$/.test(
      code,
    )
  )
    return code;
  return (
    {
      ZodError: "WORKSPACE_INVALID_RESULT",
      TypeError: "WORKSPACE_ENGINE_TYPE_ERROR",
      SyntaxError: "WORKSPACE_INVALID_JSON",
      AbortError: "PROVIDER_ABORTED",
    }[error?.name] ?? "WORKSPACE_OPERATION_FAILED"
  );
}
