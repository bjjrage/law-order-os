import { expect, it } from "vitest";
import { workspaceFileEntries } from "../../packages/workspace/src/file-inventory.js";
import type { Document, Draft } from "../../os-core/src/contracts.js";
const original: Document = {
  id: "original",
  law_firm_id: "firm",
  matter_id: "matter",
  title: "Contrato",
  purpose: "ORIGINAL",
  current_version_id: "v1",
  created_at: "2026-10-17T00:00:00Z",
};
const working: Document = {
  ...original,
  id: "working",
  purpose: "DRAFT",
  current_version_id: "work-v1",
};
const draft: Draft = {
  id: "draft",
  law_firm_id: "firm",
  matter_id: "matter",
  document_id: "working",
  document_version_id: "work-v1",
  author_identity_id: "human",
  status: "DRAFT",
  created_at: original.created_at,
};
const link = { document_id: original.id, version_id: "v1", draft_id: draft.id };
it("shows a working copy and its original once using explicit provenance, while preserving unrelated files", () => {
  const annex = {
    ...original,
    id: "annex",
    title: "Anexo",
    current_version_id: "v2",
  };
  const entries = workspaceFileEntries(
    [original, working, annex],
    [draft],
    [link],
  );
  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({ draft, original });
  expect(entries[1]!.original).toEqual(annex);
});
it("never merges matching names without a link, stale links, cross-matter links or ambiguous provenance", () => {
  expect(workspaceFileEntries([original, working], [draft], [])).toHaveLength(
    2,
  );
  expect(
    workspaceFileEntries(
      [original, working],
      [draft],
      [{ ...link, version_id: "old" }],
    ),
  ).toHaveLength(2);
  expect(
    workspaceFileEntries(
      [original, working],
      [{ ...draft, matter_id: "other" }],
      [link],
    ),
  ).toHaveLength(2);
  expect(workspaceFileEntries([original, working], [], [link])).toHaveLength(1);
  const other = { ...original, id: "other-original" };
  const entries = workspaceFileEntries(
    [original, working, other],
    [draft],
    [link, { ...link, document_id: other.id }],
  );
  expect(entries).toHaveLength(3);
  expect(entries.filter((e) => e.original)).toHaveLength(2);
});
