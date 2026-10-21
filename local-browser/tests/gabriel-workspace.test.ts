import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  GabrielWorkspace,
  rememberGabrielDocument,
} from "../../apps/web/src/gabriel-workspace.js";
import type { Matter } from "../../os-core/src/contracts.js";

const matter = {
  id: "matter-a",
  law_firm_id: "firm-a",
  title: "Caso ficticio",
} as Matter;
const other = { ...matter, id: "matter-b", title: "Otro caso" };
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
  vi.stubGlobal("localStorage", { getItem: () => "MEDIO" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function fixture(readOnly = false) {
  const scope = {
    firm: "firm-a",
    actor: "local-administrator" as const,
    matters: [matter, other],
  };
  const open = vi.fn(),
    onResult = vi.fn();
  const list = vi.fn(async (m: Matter) => [
    {
      draft_id: m.id === matter.id ? "draft-a" : "draft-b",
      matter_id: m.id,
      matter_title: m.title,
      title: "Contrato ficticio",
      status: "DRAFT",
    },
  ]);
  const access = vi.fn(async () => ({
    room: {
      id: "room-a",
      matter_id: matter.id,
      law_firm_id: "firm-a",
      draft_id: "draft-a",
    },
    token: "private-grant",
    actor_id: scope.actor,
    read_only: readOnly,
  }));
  const request = vi.fn(async () => ({}) as any);
  const host = new GabrielWorkspace(
    () => scope,
    open,
    { list, access, request } as any,
    onResult,
  );
  return { host, scope, list, access, request, open, onResult };
}
const target = { matter_id: "matter-a", draft_id: "draft-a" };

it.each(["AGIL", "MEDIO", "PROFUNDO"])("voice delegates the human's %s preference and ignores model-supplied upgrades", async (level) => {
  vi.stubGlobal("localStorage", { getItem: () => level });
  const f = fixture();
  f.request.mockResolvedValueOnce({ state_hash: "saved-hash", document_size: 40 })
    .mockResolvedValueOnce({ jobs: [] }).mockResolvedValueOnce({ id: "job", status: "RUNNING" });
  await f.host.tool("delegate_workspace", { ...target, instruction: "Analizar el documento", analysis_level: level === "PROFUNDO" ? "AGIL" : "PROFUNDO", max_cost_usd: 10 }, []);
  expect((f.request.mock.calls as unknown[][])[2]?.[2]).toMatchObject({ analysis_level: level, max_cost_usd: 0.6, action: "PLAN", agent_id: "gabriel", workflow_version: 4 });
  f.host.dispose();
});

it("recovers the generated proposal from the exact room/job, preserves provenance and never exposes its grant", async () => {
  const f = fixture();
  f.request.mockResolvedValue({
    source: "PROPOSAL",
    job_id: "job-a",
    text: "Versión generada",
    next_offset: 8000,
    total_characters: 10000,
    application_status: "NOT_INFERRED_FROM_GENERATION",
  });
  const result = await f.host.tool(
    "read_workspace",
    { ...target, source: "PROPOSAL", job_id: "job-a", offset: 0 },
    [],
  );
  expect(result).toMatchObject({
    text: "Versión generada",
    next_offset: 8000,
    application_status: "NOT_INFERRED_FROM_GENERATION",
  });
  expect(f.request).toHaveBeenCalledWith(
    "rooms/room-a/director-read",
    "private-grant",
    { source: "PROPOSAL", job_id: "job-a", offset: 0, before: null },
  );
  expect(JSON.stringify(result)).not.toContain("private-grant");
  expect(f.open).not.toHaveBeenCalled();
  await f.host.tool(
    "read_workspace",
    {
      ...target,
      source: "PROPOSAL",
      job_id: "job-a",
      offset: 8000,
      open: true,
    },
    [],
  );
  expect(f.open).toHaveBeenCalledWith(matter, "draft-a");
  f.host.dispose();
});

it("finds the last opened document across screens without guessing another client or crossing matters", async () => {
  const f = fixture();
  rememberGabrielDocument(
    "firm-a",
    "local-administrator",
    matter.id,
    "draft-a",
  );
  expect(await f.host.documents()).toMatchObject({
    last_opened: { draft_id: "draft-a", matter_id: matter.id },
  });
  expect(
    await f.host.tool(
      "read_workspace",
      { ...target, matter_id: other.id, source: "DOCUMENT" },
      [],
    ),
  ).toHaveProperty("error");
  expect(
    await f.host.tool(
      "read_workspace",
      { ...target, matter_id: "foreign", source: "DOCUMENT" },
      [],
    ),
  ).toHaveProperty("error");
  expect(
    await f.host.tool("read_workspace", { source: "DOCUMENT" }, []),
  ).toHaveProperty("error");
  expect(f.access).not.toHaveBeenCalled();
  expect(f.request).not.toHaveBeenCalled();
});

it("delegates the natural request through the existing v4 director, acknowledges durable creation and reports completion without applying edits", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const job = { id: "saved-command", status: "RUNNING" };
  f.request
    .mockResolvedValueOnce({ state_hash: "saved-hash", document_size: 25000 })
    .mockResolvedValueOnce({ jobs: [] })
    .mockResolvedValueOnce(job)
    .mockResolvedValueOnce({
      jobs: [
        {
          ...job,
          status: "COMPLETED",
          result: {
            summary: "Propuesta revisada por especialistas",
            replacement_text: "Nueva versión",
            quality_control: { status: "REVIEW_REQUIRED" },
          },
        },
      ],
    });
  const instruction =
    "Revisá la propuesta job-original con los hallazgos y prepará otra versión sin exclusividad.";
  const result = await f.host.tool(
    "delegate_workspace",
    { ...target, instruction },
    [{ role: "user", content: "Defendemos al proveedor." }],
  );
  expect(result).toMatchObject({
    status: "RUNNING",
    job_id: "saved-command",
    document_changed: false,
  });
  expect(f.request.mock.calls[2]).toEqual([
    "rooms/room-a/director-task",
    "private-grant",
    expect.objectContaining({
      instruction,
      action: "PLAN",
      agent_id: "gabriel",
      workflow_version: 4,
      base_hash: "saved-hash",
      from: 0,
      to: 25000,
      conversation: [{ role: "user", text: "Defendemos al proveedor." }],
      execution_mode: "LIVE",
      max_cost_usd: 0.6,
      analysis_level: "MEDIO",
    }),
  ]);
  await vi.advanceTimersByTimeAsync(1500);
  expect(f.onResult).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "COMPLETED",
      has_proposal: true,
      quality_control: { status: "REVIEW_REQUIRED" },
      document_changed: false,
    }),
  );
  expect(f.open).not.toHaveBeenCalled();
  f.host.dispose();
});

it("honors read-only grants, existing work and failed creation instead of pretending work was executed", async () => {
  const locked = fixture(true);
  expect(
    await locked.host.tool(
      "delegate_workspace",
      { ...target, instruction: "Revisar" },
      [],
    ),
  ).toHaveProperty("error");
  expect(locked.request).not.toHaveBeenCalled();
  const f = fixture();
  f.request
    .mockResolvedValueOnce({ state_hash: "hash", document_size: 10 })
    .mockResolvedValueOnce({ jobs: [{ id: "active", status: "RUNNING" }] });
  expect(
    await f.host.tool(
      "delegate_workspace",
      { ...target, instruction: "Revisar" },
      [],
    ),
  ).toMatchObject({ status: "RUNNING", job_id: "active" });
  expect(f.request).toHaveBeenCalledTimes(2);
  f.request
    .mockResolvedValueOnce({ state_hash: "hash", document_size: 10 })
    .mockResolvedValueOnce({ jobs: [] })
    .mockRejectedValueOnce(Error("Sin permiso de ejecución"));
  expect(
    await f.host.tool(
      "delegate_workspace",
      { ...target, instruction: "Revisar" },
      [],
    ),
  ).toMatchObject({
    error: "Sin permiso de ejecución",
    document_changed: false,
  });
  expect(f.onResult).not.toHaveBeenCalled();
  f.host.dispose();
});
