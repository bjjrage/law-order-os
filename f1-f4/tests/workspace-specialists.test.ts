import { expect, it, vi } from "vitest";
// @ts-expect-error Native host module.
import * as specialists from "../../scripts/workspace-specialists.mjs";
// @ts-expect-error Native host module.
import * as quality from "../../scripts/workspace-quality.mjs";
import { WorkspaceAgentToolSchemas } from "../../packages/workspace/src/tasks.js";

const context = {
  title: "Contrato ficticio",
  text: "Pago USD 100 el 2026-10-18.\nPlazo de 20 días.",
  quote: "Pago USD 100 el 2026-10-18.\nPlazo de 20 días.",
  attached_documents: [
    {
      document_id: "annex",
      version_id: "v1",
      title: "Anexo ficticio",
      text: "Pago USD 150 el 2026-10-18.\nPlazo de 20 días.",
    },
  ],
};
const cleanAudit = {
  outcome: "NO_MATERIAL_ISSUES_FOUND",
  summary: "Sin problemas materiales detectados en esta prueba.",
  issues: [],
  references: [],
  limitations: [],
};
const result = {
  summary: "Plazo de 20 días.",
  findings: [],
  replacement_text: null,
  sources: [],
  references: [],
  limitations: [],
  team_outputs: [
    {
      agent_id: "elena",
      summary: "Plazo de 20 días.",
      findings: [],
      references: [],
    },
  ],
};

it("loads all 22 actual packs with distinct procedures, rejects cross-persona packs and forbids Gabriel as writer", () => {
  expect(specialists.specialistCatalog).toHaveLength(6);
  expect(
    specialists.specialistCatalog.flatMap((s: any) => s.packs),
  ).toHaveLength(22);
  for (const specialist of specialists.specialistCatalog)
    for (const entry of specialist.packs) {
      const profile = specialists.specialistProfile(
        specialist.agent_id,
        entry.pack_id,
      );
      expect(profile.procedure.length).toBeGreaterThanOrEqual(4);
      expect(profile.source_requirements.length).toBeGreaterThan(0);
      const tools = specialists.specialistEvidence(profile, context);
      expect(tools.executed_tools).toEqual([
        "document_inventory_v1",
        "exact_passage_index_v1",
        "date_amount_mentions_v1",
      ]);
      const binding = specialists.specialistBinding(
        profile,
        tools,
        "gpt-6-luna",
      );
      expect(binding.pack_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(binding.legal_evaluation).toBe("NOT_ACCREDITED");
      expect(specialists.specialistInstructions(profile)).toContain(
        entry.pack_id,
      );
      for (const passage of tools.passages) {
        const text =
          passage.document_id === "EDITOR"
            ? context.text
            : context.attached_documents[0]!.text;
        expect(text.slice(passage.from, passage.to)).not.toContain("\n");
      }
    }
  expect(() => specialists.specialistProfile("elena", "penal_defensa")).toThrow(
    "WORKSPACE_SPECIALIST_PACK_MISMATCH",
  );
  expect(() => specialists.specialistProfile("gabriel")).toThrow(
    "WORKSPACE_SPECIALIST_REQUIRED",
  );
  expect(
    WorkspaceAgentToolSchemas.prepare_document.shape.agent_id.safeParse(
      "gabriel",
    ).success,
  ).toBe(false);
  expect(
    WorkspaceAgentToolSchemas.prepare_document.shape.agent_id.safeParse(
      "santiago",
    ).success,
  ).toBe(false);
});
it("compares only the requested frozen documents and retains the exact changed range", () => {
  const comparison = specialists.compareEvidenceVersions(
    context,
    "EDITOR",
    "annex",
  );
  expect(comparison.removed).toBe("0");
  expect(comparison.added).toBe("5");
  expect(comparison.left_sha256).not.toBe(comparison.right_sha256);
  expect(() =>
    specialists.compareEvidenceVersions(context, "EDITOR", "another-room"),
  ).toThrow("WORKSPACE_EVIDENCE_NOT_FOUND");
  const emoji = specialists.compareEvidenceVersions(
    {
      text: "Texto 😀 final",
      attached_documents: [{ document_id: "other", text: "Texto 😁 final" }],
    },
    "EDITOR",
    "other",
  );
  expect(emoji.removed).toBe("😀");
  expect(emoji.added).toBe("😁");
});
it("checks document passage references against the frozen exact paragraph, without treating them as library sources", () => {
  const reference = {
    source_id: "EDITOR",
    passage_id: "EDITOR:P2",
    quote: "Plazo de 20 días.",
  };
  expect(specialists.referenceQuoteMatches(reference, [], { context })).toBe(
    true,
  );
  expect(
    specialists.referenceQuoteMatches(
      { ...reference, passage_id: "EDITOR:P1" },
      [],
      { context },
    ),
  ).toBe(false);
  expect(
    specialists.referenceQuoteMatches(
      { ...reference, source_id: "other-room" },
      [],
      { context },
    ),
  ).toBe(false);
  expect(
    specialists.referenceQuoteMatches(
      { ...reference, quote: "Plazo de 30 días." },
      [],
      { context },
    ),
  ).toBe(false);
});
it("preserves source passages without conflating versions or mutating saved evidence", () => {
  const source = {
    source_id: "S1",
    version_id: "v1",
    excerpts: [{ passage_id: "P1", text: "Texto uno" }],
  };
  const merged = specialists.mergeWorkspaceSources(
    [source],
    [{ ...source, excerpts: [{ passage_id: "P2", text: "Texto dos" }] }],
  );
  expect(merged[0].excerpts).toHaveLength(2);
  expect(source.excerpts).toHaveLength(1);
  expect(() =>
    specialists.mergeWorkspaceSources(
      [source],
      [{ ...source, version_id: "v2" }],
    ),
  ).toThrow("WORKSPACE_SOURCE_VERSION_CONFLICT");
  expect(() =>
    specialists.mergeWorkspaceSources(
      [source],
      [{ ...source, excerpts: [{ passage_id: "P1", text: "Texto cambiado" }] }],
    ),
  ).toThrow("WORKSPACE_SOURCE_VERSION_CONFLICT");
});
it("collects the auditor and every specialist in the terminal manifest, including references invented only by the auditor", () => {
  const control = quality.checkQuality(
    result,
    {
      ...cleanAudit,
      summary: "Revisar Ley 99999 de 2026.",
      references: [
        { source_id: "invented", passage_id: "absent", quote: "Inventado" },
      ],
    },
    "gpt-6-luna",
    { context },
  );
  expect(control.checked_outputs.map((o: any) => o.id)).toEqual([
    "FINAL",
    "SPECIALIST:elena:0",
    "AUDITOR",
  ]);
  expect(control.status).toBe("CHANGES_REQUIRED");
  expect(control.reference_checks[0]).toMatchObject({
    output_id: "AUDITOR",
    quote_match: false,
  });
  expect(
    control.detected_references.some((r: any) => r.output_id === "AUDITOR"),
  ).toBe(true);
  expect(control.identity_verification).toBe("NOT_AUTHENTICATED");
});
it("requires a separate review, repairs a material error once, then checks the exact corrected artifact", async () => {
  const draft = { ...result, summary: "Plazo de 30 días." };
  const invokeAudit = vi
    .fn()
    .mockResolvedValueOnce({
      ...cleanAudit,
      outcome: "CHANGES_REQUIRED",
      issues: [
        {
          target_id: "FINAL",
          severity: "HIGH",
          quote: "Plazo de 30 días.",
          problem: "El documento dice 20.",
          requested_change: "Conservar 20 días.",
        },
      ],
    })
    .mockResolvedValueOnce(cleanAudit);
  const repair = vi.fn(async () => ({ summary: "Plazo de 20 días." }));
  const checked = await quality.reviewWorkspaceResult(
    draft,
    { instruction: "Conservar el plazo", evidence: { context } },
    { invokeAudit, repair, modelId: "gpt-6-luna" },
  );
  expect(invokeAudit).toHaveBeenCalledTimes(2);
  expect(repair).toHaveBeenCalledTimes(1);
  expect(checked.quality_control.status).toBe("CONTROLLED_DRAFT");
  const bound = {
    ...checked,
    simulated: false,
    specialist_bindings: [{ agent_id: "elena" }],
  };
  expect(() => quality.assertQualityManifest(bound)).not.toThrow();
  expect(() =>
    quality.assertQualityManifest({
      ...bound,
      summary: "Texto modificado después del control",
    }),
  ).toThrow("WORKSPACE_CONTROL_ARTIFACT_CHANGED");
  expect(checked.quality_control.checked_outputs[0].sha256).toBe(
    specialists.fingerprint(quality.qualityOutputs(checked)[0].value),
  );
  const failure = vi.fn(async () => {
    throw Error("TRANSPORT_OUTCOME_UNKNOWN");
  });
  await expect(
    quality.reviewWorkspaceResult(
      draft,
      { evidence: { context } },
      { invokeAudit: failure, repair, modelId: "gpt-6-luna" },
    ),
  ).rejects.toThrow("TRANSPORT_OUTCOME_UNKNOWN");
  expect(failure).toHaveBeenCalledTimes(1);
});
it("does not clear a pending specialist correction through a clean final narration", () => {
  const control = quality.checkQuality(
    {
      ...result,
      quality_control: { status: "CHANGES_REQUIRED" },
    },
    cleanAudit,
    "gpt-6-luna",
    { context },
  );
  expect(control.status).toBe("CHANGES_REQUIRED");
  expect(control.upstream_controls).toEqual([
    { target_id: "DELEGATED_RESULT", status: "CHANGES_REQUIRED" },
  ]);
});
it("keeps unlocated audit objections visible without certifying them and marks invented document anchors for correction", () => {
  const unlocated = quality.checkQuality(
    result,
    {
      ...cleanAudit,
      issues: [
        {
          target_id: "FINAL",
          quote: "No existe",
          severity: "HIGH",
          problem: "Error",
          requested_change: "Corregir",
        },
      ],
    },
    "gpt-6-luna",
    { context },
  );
  expect(unlocated.status).toBe("CHANGES_REQUIRED");
  expect(unlocated.audit_anchors[0].quote_match).toBe(false);
  const control = quality.checkQuality(
    {
      ...result,
      findings: [{ source_id: "EDITOR", quote: "Texto inventado" }],
    },
    cleanAudit,
    "gpt-6-luna",
    { context },
  );
  expect(control.status).toBe("CHANGES_REQUIRED");
  expect(control.document_checks[0].quote_match).toBe(false);
});
