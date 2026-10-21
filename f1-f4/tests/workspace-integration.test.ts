import { expect, it } from "vitest";
// @ts-expect-error Native ESM host helper.
import * as integration from "../../scripts/workspace-integration.mjs";
const { integrationPacket, integrateContributions } = integration;
const answer = {
  summary: "Integración sintética.",
  findings: [],
  references: [],
  replacement_text: null,
  limitations: [],
};

it("encodes repeated quotes without losing any document or source text", () => {
  const text = "Contrato. Obligación íntegra de pago. Excepción final.",
    source = "Pasaje oficial de prueba. Texto completo.";
  const payload = {
    question: "Revisar",
    context: { text, attached_documents: [] },
    sources: [
      { source_id: "s1", excerpts: [{ passage_id: "p1", text: source }] },
    ],
    conversation: [
      { role: "assistant", text: "History is unnecessary during integration." },
    ],
  };
  const outputs = [
    {
      ...answer,
      agent_id: "elena",
      findings: [
        {
          title: "Pago",
          detail: "Revisar condición",
          quote: "Obligación íntegra de pago.",
          source_id: "EDITOR",
          severity: "MEDIUM",
          proposal: "Alternativa íntegra.",
        },
      ],
      references: [
        { source_id: "s1", passage_id: "p1", quote: "Texto completo." },
      ],
    },
  ];
  const packet = integrationPacket(payload, outputs);
  expect(packet.context.text).toBe(text);
  expect(packet.sources[0].excerpts[0].text).toBe(source);
  const quote = packet.contributions[0].findings[0].quote;
  expect(text.slice(quote.from_utf16, quote.to_utf16)).toBe(
    outputs[0]!.findings[0]!.quote,
  );
  const citation = packet.contributions[0].references[0].quote;
  expect(source.slice(citation.from_utf16, citation.to_utf16)).toBe(
    "Texto completo.",
  );
  expect(packet.contributions[0].findings[0].proposal).toBe(
    "Alternativa íntegra.",
  );
  expect(packet.conversation).toBeUndefined();
  expect(outputs[0]!.findings[0]!.quote).toBe("Obligación íntegra de pago.");
});

it("integrates a contract-sized packet in bounded blocks, retaining every original finding", async () => {
  const payload = {
    question: "Revisar riesgos",
    context: {
      text: "Documento completo. " + "a".repeat(21342),
      attached_documents: [],
    },
    sources: [
      {
        source_id: "s1",
        excerpts: [
          { passage_id: "p1", text: "Fuente completa " + "b".repeat(10672) },
        ],
      },
    ],
  };
  const contributions = ["elena", "valeria", "santiago"].map((agent_id) => ({
    ...answer,
    agent_id,
    summary: "Aporte de " + agent_id,
    findings: Array.from({ length: 12 }, (_, i) => ({
      title: `${agent_id}-${i}`,
      detail: "d".repeat(700),
      quote: "Cita por comprobar " + "q".repeat(100),
      source_id: "EDITOR",
      severity: "MEDIUM",
      proposal: null,
    })),
  }));
  const frozen = JSON.stringify(contributions),
    calls: any[] = [],
    progress: any[] = [];
  const fits = (packet: unknown) =>
    Buffer.byteLength(JSON.stringify(packet)) + 6000 <= 60000;
  expect(fits(integrationPacket(payload, contributions))).toBe(false);
  const result = await integrateContributions(payload, contributions, {
    fits,
    invoke: async (packet: any) => {
      expect(fits(packet)).toBe(true);
      expect(packet.context.text).toBe(payload.context.text);
      expect(packet.sources).toEqual(payload.sources);
      calls.push(packet);
      return answer;
    },
    progress: async (value: unknown) => {
      progress.push(value);
    },
  });
  expect(result).toEqual(answer);
  expect(calls.length).toBeGreaterThanOrEqual(3);
  expect(calls.length).toBeLessThanOrEqual(4);
  const received = calls.flatMap((p) =>
    p.contributions
      .filter((c: any) => ["elena", "valeria", "santiago"].includes(c.agent_id))
      .flatMap((c: any) => c.findings.map((f: any) => f.title)),
  );
  expect(new Set(received)).toEqual(
    new Set(contributions.flatMap((c) => c.findings.map((f) => f.title))),
  );
  expect(JSON.stringify(contributions)).toBe(frozen);
  expect(progress.at(-1).reductions).toHaveLength(calls.length - 1);
  let attempts = 0;
  await expect(
    integrateContributions(payload, contributions, {
      fits,
      invoke: async () => {
        attempts++;
        throw Error("TRANSPORT_OUTCOME_UNKNOWN");
      },
      progress: async () => {},
    }),
  ).rejects.toThrow("TRANSPORT_OUTCOME_UNKNOWN");
  expect(attempts).toBe(1);
});
