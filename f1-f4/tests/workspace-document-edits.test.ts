import { expect, it } from "vitest";
// @ts-expect-error Native ESM drafting capability.
// prettier-ignore
import {documentBlocks, applyDocumentEdits, prepareDocumentEdits} from "../../scripts/workspace-document-edits.mjs";

it("reconstructs long text losslessly and changes only the identified paragraph", () => {
  const text =
    "PREAMBULO INTACTO\n" +
    "Condicion inalterada, negacion e importe 100.\n".repeat(600) +
    "ULTIMA CLAUSULA INTACTA";
  const blocks = documentBlocks(text);
  expect(applyDocumentEdits(blocks, [])).toBe(text);
  expect(
    applyDocumentEdits(blocks, [
      {
        block_id: blocks[2].id,
        replacement_text: "Propuesta pendiente de acuerdo.",
      },
    ]),
  ).toBe(
    blocks
      .map(
        (b: any, i: number) =>
          (i === 2 ? "Propuesta pendiente de acuerdo." : b.text) + b.separator,
      )
      .join(""),
  );
  expect(() =>
    applyDocumentEdits(blocks, [
      { block_id: "inventado", replacement_text: "x" },
    ]),
  ).toThrow("WORKSPACE_INVALID_EDIT_BLOCK");
  expect(() =>
    applyDocumentEdits(blocks, [
      { block_id: "B1", replacement_text: "x" },
      { block_id: "B1", replacement_text: "y" },
    ]),
  ).toThrow("WORKSPACE_INVALID_EDIT_BLOCK");
  const unicode = "a".repeat(5999) + "🙂" + "b".repeat(9000);
  const split = documentBlocks(unicode);
  expect(split.some((b: any) => /[\uD800-\uDBFF]$/.test(b.text))).toBe(false);
  expect(applyDocumentEdits(split, [])).toBe(unicode);
});

it("reduces only a known output-token exhaustion into bounded blocks; never repeats unknown outcomes", async () => {
  const source = Array.from(
    { length: 6 },
    (_, i) =>
      `Apartado ${i}: ` + "Conservar los datos del cliente. ".repeat(140),
  ).join("\n");
  const payload = {
    context: { text: source },
    question: "Revisar la redaccion.",
  };
  let calls = 0;
  const progress: any[] = [];
  const result = await prepareDocumentEdits(payload, {
    invoke: async (p: any) => {
      calls++;
      if (calls === 1)
        throw Error("INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS");
      expect(p.context.text).toBeUndefined();
      expect(p.context.document_blocks.map((b: any) => b.text).join("\n")).toBe(
        source,
      );
      return {
        summary: "Bloque revisado.",
        edits: [],
        references: [],
        limitations: [],
      };
    },
    progress: async (p: any) => {
      progress.push(p);
    },
  });
  expect(calls).toBeGreaterThan(2);
  expect(calls).toBeLessThanOrEqual(11);
  expect(result.replacement_text).toBe(source);
  expect(progress.at(-1).completed_blocks).toBe(progress.at(-1).total_blocks);
  let unknownCalls = 0;
  await expect(
    prepareDocumentEdits(payload, {
      invoke: async () => {
        unknownCalls++;
        throw Error("TRANSPORT_OUTCOME_UNKNOWN");
      },
      progress: async () => {},
    }),
  ).rejects.toThrow("TRANSPORT_OUTCOME_UNKNOWN");
  expect(unknownCalls).toBe(1);
});
