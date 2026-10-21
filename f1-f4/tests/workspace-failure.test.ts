import { it, expect } from "vitest";
// @ts-expect-error Local native host module.
// prettier-ignore
import { workspaceFailureContext, workspaceErrorCode } from "../../scripts/workspace-failure.mjs";
it("keeps actionable technical evidence without copying private exception text or absolute user paths", () => {
  const error = Object.assign(
    new Error("PRIVATE_DOCUMENT_AND_SECRET_MUST_NOT_LEAK"),
    { code: "42P01" },
  );
  error.stack =
    "Error: PRIVATE_DOCUMENT_AND_SECRET_MUST_NOT_LEAK\n    at savedWork (file:///C:/Users/PrivateName/Workspace/apps/api/src/workspace.ts:701:21)";
  const diagnostic = workspaceFailureContext(error, "EXECUTION");
  expect(diagnostic).toEqual({
    category: "DATABASE",
    error_name: "Error",
    native_code: "42P01",
    source: "apps/api/src/workspace.ts:701:21",
    stage: "EXECUTION",
  });
  expect(workspaceErrorCode(error)).toBe("WORKSPACE_STORAGE_ERROR");
  expect(JSON.stringify(diagnostic)).not.toMatch(/PRIVATE|PrivateName|C:\//);
  expect(
    workspaceErrorCode(
      Object.assign(new Error("permission denied"), { code: "EPERM" }),
    ),
  ).toBe("WORKSPACE_FILE_ACCESS_FAILED");
  expect(
    workspaceErrorCode(Error("INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS")),
  ).toBe("INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS");
  expect(workspaceErrorCode(new TypeError("private contents"))).toBe(
    "WORKSPACE_ENGINE_TYPE_ERROR",
  );
  expect(
    workspaceErrorCode(Error("PRIVATE_DOCUMENT_AND_SECRET_MUST_NOT_LEAK")),
  ).toBe("WORKSPACE_OPERATION_FAILED");
});
