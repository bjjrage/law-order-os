/** Lossless quote references: the complete document/source remains in the packet once. */
export function integrationPacket(payload, contributions) {
  const documents = [
    { document_id: "EDITOR", text: payload.context.text },
    ...(payload.context.attached_documents ?? []),
  ];
  function documentQuote(quote, sourceId) {
    if (!quote) return quote;
    const document = documents.find((d) => d.document_id === sourceId);
    const start = document?.text.indexOf(quote) ?? -1;
    return start < 0
      ? quote
      : {
          document_id: sourceId,
          from_utf16: start,
          to_utf16: start + quote.length,
          starts_with: quote.slice(0, 60),
        };
  }
  function reference(ref) {
    const passage = payload.sources
      .find((s) => s.source_id === ref.source_id)
      ?.excerpts.find((p) => p.passage_id === ref.passage_id);
    const start = passage?.text.indexOf(ref.quote) ?? -1;
    return start < 0 || !ref.quote
      ? ref
      : {
          ...ref,
          quote: {
            from_utf16: start,
            to_utf16: start + ref.quote.length,
            starts_with: ref.quote.slice(0, 60),
          },
        };
  }
  return {
    task: "INTEGRATE",
    question: payload.question,
    context: payload.context,
    sources: payload.sources,
    integration_scope:
      "Integrate all supplied contributions for this step. Entries named integration-* summarize previous blocks and are not additional specialists. When contribution_part is present it is part of a complete saved contribution; preserve conflicts and pending decisions for subsequent integration steps.",
    quote_encoding:
      "Quote objects are lossless UTF-16 ranges into the complete document or referenced source passage. String quotes were not found exactly and must not be treated as verified. Output quotations must be literal text, never ranges.",
    contributions: contributions.map((c) => ({
      ...c,
      findings: c.findings.map((f) => ({
        ...f,
        quote: documentQuote(f.quote, f.source_id),
      })),
      references: (c.references ?? []).map(reference),
    })),
  };
}

/** Partition complete findings, never crop strings or omit a contribution. */
function contributionUnits(contributions) {
  return contributions.flatMap((c) =>
    c.findings.length
      ? c.findings.map((finding, index) => ({
          ...c,
          findings: [finding],
          contribution_part: index + 1,
          contribution_parts: c.findings.length,
        }))
      : [c],
  );
}

/** Distinct reduction steps, not retries. Provider failure immediately aborts the run. */
export async function integrateContributions(
  payload,
  originals,
  { fits, invoke, progress },
) {
  let inputs = originals,
    calls = 0;
  const reductions = [];
  for (let round = 0; round < 3; round++) {
    const all = integrationPacket(payload, inputs);
    if (await fits(all)) {
      if (++calls > 8) throw Error("WORKSPACE_INTEGRATION_SIZE_LIMIT");
      await progress({ phase: "final", calls, reductions: [...reductions] });
      return await invoke(all);
    }
    const batches = [];
    let batch = [];
    const units = [];
    for (const c of inputs) units.push(...(await fits(integrationPacket(payload, [c])) ? [c] : contributionUnits([c])));
    for (const unit of units) {
      if (!await fits(integrationPacket(payload, [unit])))
        throw Error("WORKSPACE_INTEGRATION_SIZE_LIMIT");
      if (batch.length && !await fits(integrationPacket(payload, [...batch, unit]))) {
        batches.push(batch);
        batch = [];
      }
      batch.push(unit);
    }
    if (batch.length) batches.push(batch);
    const reduced = [];
    if (calls + batches.length + 1 > 8)
      throw Error("WORKSPACE_INTEGRATION_SIZE_LIMIT");
    for (const [index, group] of batches.entries()) {
      if (++calls >= 8) throw Error("WORKSPACE_INTEGRATION_SIZE_LIMIT");
      await progress({
        phase: "block",
        calls,
        block: index + 1,
        blocks: batches.length,
        reductions: [...reductions],
      });
      const result = await invoke(integrationPacket(payload, group));
      const output = {
        agent_id: `integration-${round + 1}-${index + 1}`,
        ...result,
      };
      reduced.push(output);
      reductions.push(output);
      // Persist each completed step before attempting another provider call.
      await progress({ phase: "saved", calls, reductions: [...reductions] });
    }
    inputs = reduced;
  }
  throw Error("WORKSPACE_INTEGRATION_SIZE_LIMIT");
}
