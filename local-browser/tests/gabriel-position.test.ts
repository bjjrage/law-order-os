import { expect, it } from "vitest";
import { clampGabrielPosition, defaultGabrielPosition } from "../../apps/web/src/gabriel-position.js";

it("places the compact launcher at the bottom right with room for all controls", () => {
  expect(defaultGabrielPosition({ width: 1366, height: 768 })).toEqual({ x: 1180, y: 710 });
});

it("keeps all of Gabriel reachable when dragged past any edge or after a smaller viewport", () => {
  expect(clampGabrielPosition({ x: -80, y: -80 }, { width: 1366, height: 768 })).toEqual({ x: 12, y: 12 });
  expect(clampGabrielPosition({ x: 2000, y: 1000 }, { width: 1366, height: 768 })).toEqual({ x: 1184, y: 710 });
  expect(clampGabrielPosition({ x: 1180, y: 710 }, { width: 375, height: 600 })).toEqual({ x: 193, y: 542 });
});
