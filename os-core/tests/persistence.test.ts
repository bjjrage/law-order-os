import { describe, expect, it } from "vitest";
import { CoreError } from "../src/index.js";
import { MemoryTestPersistence } from "../testing/memory.js";
describe("transaction adapter contract — volatile test double only", async () => {
  it("rolls back all writes when a transaction throws", async () => {
    const persistence = new MemoryTestPersistence();
    await expect(
      persistence.transaction(async (tx) => {
        await tx.insert("lawFirms", {
          id: "rollback",
          name: "Synthetic",
          created_at: "2026-10-13T00:00:00.000Z",
        });
        throw new CoreError("SIMULATED_FAILURE");
      }),
    ).rejects.toMatchObject({ code: "SIMULATED_FAILURE" });
    expect(
      await persistence.transaction(
        async (tx) => await tx.get("lawFirms", "rollback"),
      ),
    ).toBeUndefined();
  });
  it("does not leak mutable references or persist read mutations", async () => {
    const persistence = new MemoryTestPersistence();
    const original = {
      id: "copy",
      name: "Synthetic",
      created_at: "2026-10-13T00:00:00.000Z",
    };
    await persistence.transaction(
      async (tx) => await tx.insert("lawFirms", original),
    );
    original.name = "MUTATED";
    await persistence.transaction(async (tx) => {
      const record = (await tx.get("lawFirms", "copy"))!;
      record.name = "MUTATED AGAIN";
    });
    expect(
      (await persistence.transaction(
        async (tx) => await tx.get("lawFirms", "copy"),
      ))!.name,
    ).toBe("Synthetic");
  });
  it("refuses duplicate IDs atomically and keeps the original", async () => {
    const persistence = new MemoryTestPersistence();
    const record = {
      id: "same",
      name: "Original",
      created_at: "2026-10-13T00:00:00.000Z",
    };
    await persistence.transaction(
      async (tx) => await tx.insert("lawFirms", record),
    );
    await expect(
      persistence.transaction(
        async (tx) =>
          await tx.insert("lawFirms", { ...record, name: "Overwrite" }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_ID" });
    expect(
      (await persistence.transaction(
        async (tx) => await tx.get("lawFirms", "same"),
      ))!.name,
    ).toBe("Original");
  });
  it("rejects immutable table replacement even if JavaScript circumvents the TypeScript type", async () => {
    const persistence = new MemoryTestPersistence();
    await expect(
      persistence.transaction(
        async (tx) =>
          await tx.replace("documentVersions" as never, { id: "x" } as never),
      ),
    ).rejects.toMatchObject({ code: "IMMUTABLE_RECORD" });
    await expect(
      persistence.transaction(
        async (tx) =>
          await tx.replace("activities" as never, { id: "x" } as never),
      ),
    ).rejects.toMatchObject({ code: "IMMUTABLE_RECORD" });
  });
  it("is explicitly volatile across new adapters: not proof of a persistent E2E", async () => {
    const first = new MemoryTestPersistence();
    await first.transaction(
      async (tx) =>
        await tx.insert("lawFirms", {
          id: "not-persistent",
          name: "Synthetic",
          created_at: "2026-10-13T00:00:00.000Z",
        }),
    );
    const newSessionAdapter = new MemoryTestPersistence();
    expect(
      await newSessionAdapter.transaction(
        async (tx) => await tx.get("lawFirms", "not-persistent"),
      ),
    ).toBeUndefined();
    expect(first.assurance).toBe("TESTED_OFFLINE");
  });
});
