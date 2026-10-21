import { expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { workspaceExtensions } from "../../packages/workspace/src/extensions.js";
import {
  locateQuote,
  reviewKey,
  ReviewMarks,
} from "../../packages/workspace/src/review-marks.js";

it("anchors only unique exact passages across rich text and clears a changed quotation", () => {
  const schema = getSchema(workspaceExtensions());
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Precio " },
          { type: "text", text: "sujeto", marks: [{ type: "bold" }] },
          { type: "text", text: " a confirmación." },
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Otra cláusula." }],
      },
    ],
  });
  expect(locateQuote(doc, "sujeto a confirmación.")).toEqual({
    from: 8,
    to: 30,
  });
  expect(locateQuote(doc, "confirmación.\nOtra cláusula.")).not.toBe(null);
  expect(locateQuote(doc, "un texto inventado")).toBe(null);
  const repeated = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Precio Precio" }] },
    ],
  });
  expect(locateQuote(repeated, "Precio")).toBe(null);
  // The review marks live in plugin state, not in persisted/shared document marks.
  const extension = ReviewMarks.config.addProseMirrorPlugins!;
  const plugins = extension.call({} as never);
  let state = EditorState.create({ schema, doc, plugins });
  const quote = "sujeto a confirmación.",
    range = locateQuote(doc, quote)!;
  state = state.apply(
    state.tr.setMeta(reviewKey, [
      { id: "f1", ...range, quote, severity: "HIGH" },
    ]),
  );
  expect(reviewKey.getState(state)).toHaveLength(1);
  state = state.apply(state.tr.insertText("Nuevo ", 1));
  expect(reviewKey.getState(state)?.[0]?.from).toBe(range.from + 6);
  state = state.apply(
    state.tr.insertText("distinto", range.from + 6, range.from + 12),
  );
  expect(reviewKey.getState(state)).toHaveLength(0);
  expect(JSON.stringify(state.doc.toJSON())).not.toContain("workspaceReview");
});

it("maps formatting differences, rejects repeated normalized quotes and never drops substantive differences", () => {
  const schema = getSchema(workspaceExtensions());
  const paragraph = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      paragraph("Las órdenes\u00a0 de Compra emitidas"),
      paragraph("por LA EMPRESA, ‘aceptadas’. Precio: 55%."),
    ],
  });
  const range = locateQuote(
    doc,
    "Las órdenes de Compra emitidas por LA EMPRESA, 'aceptadas'.",
  );
  expect(range).not.toBeNull();
  expect(doc.textBetween(range!.from, range!.to, "\n")).toBe(
    "Las órdenes\u00a0 de Compra emitidas\npor LA EMPRESA, ‘aceptadas’.",
  );
  expect(locateQuote(doc, "Precio: 51%.")).toBeNull();
  expect(locateQuote(doc, "por LA EMPRESA, no 'aceptadas'.")).toBeNull();
  expect(locateQuote(doc, "Las órdenes emitidas")).toBeNull();
  const repeated = schema.nodeFromJSON({
    type: "doc",
    content: [paragraph("Precio fijo"), paragraph("Precio\u00a0fijo")],
  });
  expect(locateQuote(repeated, "Precio fijo")).toBeNull();
});
