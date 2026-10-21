import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { expect, it } from "vitest";
import SpecialistStudio from "../../apps/web/src/SpecialistStudio.js";
import { specialistCatalog } from "../../apps/web/src/specialist-catalog.js";

it("presents exactly the six approved identities and their subareas", () => {
  const approved = JSON.parse(readFileSync(resolve("docs/specialist-studio/contracts/SIX_AREA_SPECIALIST_CATALOG.v1.json"), "utf8"));
  expect(specialistCatalog.map(({ id, name, area, subareas }) => ({ id, name, area, subareas }))).toEqual(
    approved.specialists.map((specialist: { persona_id: string; persona_name: string; public_label: string; subprofiles: Array<{ label: string }> }) => ({
      id: specialist.persona_id,
      name: specialist.persona_name,
      area: specialist.public_label,
      subareas: specialist.subprofiles.map(({ label }) => label),
    })),
  );
  expect(specialistCatalog).toHaveLength(6);
  for (const specialist of specialistCatalog) {
    const bytes = readFileSync(resolve("apps/web/public/agents", specialist.id + ".png"));
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  }
});

it("exposes people and areas, never engines or pretend activation controls", () => {
  const html = renderToStaticMarkup(createElement(SpecialistStudio));
  expect(html.match(/class="specialist-persona"/g)).toHaveLength(6);
  expect(html).toContain("Convocatoria por asunto pendiente de habilitación.");
  expect(html).not.toMatch(/Gemini|OpenAI|gpt-|Luna|\bSol\b|model_id|api.key/i);
  expect(html).not.toMatch(/Convocar|Aumentar potencia|Ejecutar/i);
});
