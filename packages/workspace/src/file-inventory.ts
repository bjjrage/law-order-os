import type { Document, Draft } from "../../../os-core/src/contracts.js";

export type WorkspaceFileLink = {
  document_id: string;
  version_id: string;
  draft_id: string;
};
export type WorkspaceFileEntry = {
  id: string;
  title: string;
  draft?: Draft;
  original?: Document;
};

/** Presentation only: merge explicit provenance, never guess from matching titles. */
export function workspaceFileEntries(
  documents: Document[],
  drafts: Draft[],
  links: WorkspaceFileLink[],
): WorkspaceFileEntry[] {
  const originals = documents.filter((d) => d.purpose === "ORIGINAL");
  const valid = links
    .filter((l) => {
      const original = originals.find(
        (d) => d.id === l.document_id && d.current_version_id === l.version_id,
      );
      const draft = drafts.find((d) => d.id === l.draft_id);
      return (
        original &&
        draft &&
        original.law_firm_id === draft.law_firm_id &&
        original.matter_id === draft.matter_id
      );
    })
    .filter(
      (l, _, all) =>
        all.filter(
          (other) =>
            other.draft_id === l.draft_id ||
            other.document_id === l.document_id,
        ).length === 1,
    );
  const merged = new Set(valid.map((l) => l.document_id));
  return [
    ...drafts.map((draft) => ({
      id: `draft:${draft.id}`,
      title:
        documents.find((d) => d.id === draft.document_id)?.title ??
        "Documento de trabajo",
      draft,
      original: originals.find(
        (d) => d.id === valid.find((l) => l.draft_id === draft.id)?.document_id,
      ),
    })),
    ...originals
      .filter((d) => !merged.has(d.id))
      .map((original) => ({
        id: `original:${original.id}`,
        title: original.title,
        original,
      })),
  ];
}
