import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";

export type ReviewAnchor = {
  id: string;
  from: number;
  to: number;
  quote: string;
  severity: string;
  number?: number;
  active?: boolean;
};
export const reviewKey = new PluginKey<ReviewAnchor[]>("workspaceReview");
/** Only typography/whitespace changes; never remove words, punctuation or numbers. */
export function reviewText(text: string) {
  return text
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
/** Unique verbatim passage, allowing formatting differences with position mapping. */
export function locateQuote(doc: Node, quote: string) {
  if (!quote.trim()) return null;
  let text = "";
  const positions: number[] = [];
  doc.descendants((block, pos) => {
    if (!block.isTextblock) return;
    if (text) {
      text += "\n";
      positions.push(-1);
    }
    block.descendants((node, offset) => {
      const value = node.isText
        ? (node.text ?? "")
        : node.type.name === "hardBreak"
          ? "\n"
          : "";
      for (let i = 0; i < value.length; i++) {
        text += value[i];
        positions.push(pos + 1 + offset + i);
      }
    });
    return false;
  });
  let normalized = "";
  const starts: number[] = [],
    ends: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = /\s/.test(text[i]!) ? " " : reviewText(text[i]!);
    if (char === " " && normalized.endsWith(" ")) {
      ends[ends.length - 1] = i;
      continue;
    }
    normalized += char;
    starts.push(i);
    ends.push(i);
  }
  const needle = reviewText(quote),
    start = normalized.indexOf(needle);
  if (start < 0 || normalized.indexOf(needle, start + 1) >= 0) return null;
  const from = positions[starts[start]!],
    last = positions[ends[start + needle.length - 1]!];
  if (from === undefined || last === undefined || from < 0 || last < 0)
    return null;
  const to = last + 1;
  return reviewText(doc.textBetween(from, to, "\n")) === needle
    ? { from, to }
    : null;
}
export const ReviewMarks = Extension.create({
  name: "workspaceReview",
  addProseMirrorPlugins() {
    return [
      new Plugin<ReviewAnchor[]>({
        key: reviewKey,
        state: {
          init: () => [],
          apply(tr, previous) {
            const next = tr.getMeta(reviewKey) as ReviewAnchor[] | undefined;
            if (next) return next;
            if (!tr.docChanged) return previous;
            return previous.flatMap((a) => {
              const from = tr.mapping.map(a.from, 1),
                to = tr.mapping.map(a.to, -1);
              return from < to && tr.doc.textBetween(from, to, "\n") === a.quote
                ? [{ ...a, from, to }]
                : [];
            });
          },
        },
        props: {
          decorations(state) {
            return DecorationSet.create(
              state.doc,
              (reviewKey.getState(state) ?? []).flatMap((a) => [
                Decoration.inline(a.from, a.to, {
                  class: `workspace-review-mark severity-${a.severity.toLowerCase()}${a.active ? " is-active" : ""}`,
                  "data-review-id": a.id,
                  title: "Abrir hallazgo del equipo",
                }),
                Decoration.widget(
                  a.to,
                  (view) => {
                    const button =
                      view.dom.ownerDocument.createElement("button");
                    button.type = "button";
                    button.className =
                      "workspace-review-pin" + (a.active ? " is-active" : "");
                    button.dataset.reviewId = a.id;
                    button.textContent = String(a.number ?? "!");
                    button.setAttribute(
                      "aria-label",
                      `Observación ${a.number ?? "del equipo"}`,
                    );
                    return button;
                  },
                  { side: -1, key: a.id + String(a.active) },
                ),
              ]),
            );
          },
          handleClick(view, _pos, event) {
            const target = (event.target as HTMLElement)?.closest<HTMLElement>(
              "[data-review-id]",
            );
            if (!target) return false;
            view.dom.dispatchEvent(
              new CustomEvent("workspace-review-open", {
                bubbles: true,
                detail: target.dataset.reviewId,
              }),
            );
            return true;
          },
        },
      }),
    ];
  },
});
