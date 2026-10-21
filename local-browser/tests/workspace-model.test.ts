import { describe, expect, it } from "vitest";
import type { Task } from "../../os-core/src/contracts.js";
import {
  displayDate,
  matchesSearch,
  orderTasks,
  taskGroup,
} from "../../apps/web/src/workspace-model.js";

const task = (
  id: string,
  due: string | null,
  status: Task["status"] = "PENDING",
): Task => ({
  id,
  title: id,
  internal_due_at: due,
  status,
  created_at: "2026-10-01T12:00:00Z",
  law_firm_id: "firm",
  matter_id: "matter",
  responsible_identity_id: "lawyer",
  kind: "INTERNAL",
  draft_review_id: null,
});
describe("workspace chronology and finding records", () => {
  it("groups due dates by Paraguay civil day at the UTC boundary", () => {
    const now = new Date("2026-10-16T01:00:00Z"); // Still October 15 in Paraguay.
    expect(taskGroup(task("today", "2026-10-16T02:30:00Z"), now)).toBe("today");
    expect(taskGroup(task("elapsed-today", "2026-10-16T00:30:00Z"), now)).toBe(
      "overdue",
    );
    expect(taskGroup(task("next", "2026-10-16T03:00:00Z"), now)).toBe(
      "upcoming",
    );
    expect(taskGroup(task("past", "2026-10-15T02:30:00Z"), now)).toBe(
      "overdue",
    );
  });
  it("keeps undated tasks apart and excludes completed tasks from urgency", () => {
    expect(taskGroup(task("undated", null))).toBe("undated");
    expect(taskGroup(task("finished", "2020-01-01T12:00:00Z", "DONE"))).toBe(
      "completed",
    );
    expect(taskGroup(task("cancelled", null, "CANCELLED"))).toBe("completed");
  });
  it("orders urgent work and preserves its input order and data", () => {
    const input = [
      task("undated", null),
      task("future", "2026-10-20T12:00:00Z"),
      task("later-past", "2026-10-14T12:00:00Z"),
      task("earlier-past", "2026-10-13T12:00:00Z"),
      task("done", "2026-10-01T12:00:00Z", "DONE"),
    ];
    expect(
      orderTasks(input, new Date("2026-10-15T12:00:00Z")).map((t) => t.id),
    ).toEqual(["earlier-past", "later-past", "future", "undated", "done"]);
    expect(input.map((t) => t.id)).toEqual([
      "undated",
      "future",
      "later-past",
      "earlier-past",
      "done",
    ]);
  });
  it("keeps a civil date on its original day", () => {
    expect(displayDate("2026-10-15")).toContain("15");
    expect(displayDate("2026-10-16T01:00:00Z")).toContain("15");
    expect(displayDate(null)).toBe("Sin fecha");
  });
  it("finds names, identifications and case context without requiring accents", () => {
    expect(matchesSearch("  peralta ", "Merló & Peralta", null)).toBe(true);
    expect(matchesSearch("revisión", "Revision contractual")).toBe(true);
    expect(matchesSearch("8001234", "Cliente", "RUC 8001234-5")).toBe(true);
    expect(
      matchesSearch("laboral", "Contrato de suministro", "Tributario"),
    ).toBe(false);
  });
});
