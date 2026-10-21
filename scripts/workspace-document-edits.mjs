/** Stable paragraph IDs into the frozen text. Original separators never come from AI. */
export function documentBlocks(text, maxChars = 6000) {
  const blocks = [];
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) {
    let remaining = line;
    do {
      let end = Math.min(maxChars, remaining.length);
      if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1]))
        end--;
      const part = remaining.slice(0, end);
      remaining = remaining.slice(end);
      blocks.push({
        id: `B${blocks.length + 1}`,
        text: part,
        separator: !remaining && i < lines.length - 1 ? "\n" : "",
      });
    } while (remaining);
  }
  return blocks;
}

/** Pure reconstruction: unknown/duplicate targets fail before returning any text. */
export function applyDocumentEdits(blocks, edits) {
  const ids = new Set(blocks.map((b) => b.id)),
    replacements = new Map();
  for (const edit of edits) {
    if (!ids.has(edit.block_id) || replacements.has(edit.block_id))
      throw Error("WORKSPACE_INVALID_EDIT_BLOCK");
    replacements.set(edit.block_id, edit.replacement_text);
  }
  const text = blocks
    .map(
      (b) =>
        (replacements.has(b.id) ? replacements.get(b.id) : b.text) +
        b.separator,
    )
    .join("");
  if (text.length > 60000) throw Error("WORKSPACE_REVISION_SIZE_LIMIT");
  return text;
}

/** Known output exhaustion can be reduced into smaller, bounded work units.
 * Unknown transport outcomes, refusals and other failures never trigger new calls. */
export async function prepareDocumentEdits(payload, { invoke, progress }) {
  const blocks = documentBlocks(payload.context.text);
  const { text, ...context } = payload.context;
  const base = {
    ...payload,
    context: {
      ...context,
      document_blocks: blocks.map(({ id, text }) => ({ id, text })),
    },
  };
  const packet = (group) => ({
    ...base,
    editable_block_ids: group.map((b) => b.id),
  });
  const check = (group, result) => {
    applyDocumentEdits(group, result.edits);
    return result;
  };
  await progress({ completed_blocks: 0, total_blocks: blocks.length });
  let results;
  try {
    results = [check(blocks, await invoke(packet(blocks)))];
  } catch (error) {
    if (
      error?.code !== "INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS" &&
      error?.message !== "INCOMPLETE_MODEL_RESPONSE_MAX_OUTPUT_TOKENS"
    )
      throw error;
    const groups = [];
    let group = [],
      chars = 0;
    for (const block of blocks) {
      if (group.length && chars + block.text.length > 6000) {
        groups.push(group);
        group = [];
        chars = 0;
      }
      group.push(block);
      chars += block.text.length;
    }
    if (group.length) groups.push(group);
    if (groups.length < 2 || groups.length > 10) throw error;
    results = [];
    let completed = 0;
    for (const group of groups) {
      const result = check(group, await invoke(packet(group)));
      results.push(result);
      completed += group.length;
      await progress({
        completed_blocks: completed,
        total_blocks: blocks.length,
      });
    }
  }
  const edits = results.flatMap((r) => r.edits);
  const replacement_text = applyDocumentEdits(blocks, edits);
  await progress({
    completed_blocks: blocks.length,
    total_blocks: blocks.length,
  });
  return {
    summary:
      results.length === 1
        ? results[0].summary
        : `Propuesta reconstruida en ${results.length} bloques, con ${edits.length} pasajes modificados. Revisá el texto y los pendientes antes de aplicarla.`,
    findings: [],
    replacement_text,
    references: results.flatMap((r) => r.references).slice(0, 12),
    limitations: [...new Set(results.flatMap((r) => r.limitations))].slice(
      0,
      12,
    ),
  };
}
