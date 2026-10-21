import { beforeEach, expect, it } from "vitest";
import {
  BrowserPersistence,
  STORAGE_KEY,
} from "../../apps/web/src/local-storage.js";
import {
  localRequest,
  selectLocalProfile,
} from "../../apps/web/src/local-api.js";
class Storage {
  values = new Map<string, string>();
  fail = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw Error("QuotaExceededError");
    this.values.set(key, value);
  }
}
let data: Storage;
beforeEach(() => {
  data = new Storage();
});
const firm = {
  id: "firm",
  name: "Sintético",
  created_at: "2026-10-13T12:00:00.000Z",
};
it("persists across adapter instances without credentials", async () => {
  await new BrowserPersistence(data).transaction((tx) =>
    tx.insert("lawFirms", firm),
  );
  expect(new BrowserPersistence(data).snapshot().tables.lawFirms).toEqual([
    firm,
  ]);
});
it("rolls back a failed multi-write operation", async () => {
  const adapter = new BrowserPersistence(data);
  await expect(
    adapter.transaction(async (tx) => {
      await tx.insert("lawFirms", firm);
      throw Error("failed");
    }),
  ).rejects.toThrow("failed");
  expect(data.getItem(STORAGE_KEY)).toBeNull();
});
it("keeps the previous snapshot when the storage quota is exhausted", async () => {
  const adapter = new BrowserPersistence(data);
  await adapter.transaction((tx) => tx.insert("lawFirms", firm));
  const before = data.getItem(STORAGE_KEY);
  data.fail = true;
  await expect(
    adapter.transaction((tx) =>
      tx.insert("lawFirms", { ...firm, id: "second" }),
    ),
  ).rejects.toThrow("No se pudo guardar");
  expect(data.getItem(STORAGE_KEY)).toBe(before);
});
it("serializes concurrent writes within a tab", async () => {
  const adapter = new BrowserPersistence(data);
  await Promise.all([
    adapter.transaction((tx) => tx.insert("lawFirms", firm)),
    adapter.transaction((tx) =>
      tx.insert("lawFirms", { ...firm, id: "second" }),
    ),
  ]);
  expect(adapter.snapshot().tables.lawFirms).toHaveLength(2);
});
it("detects another writer before committing and preserves its write", async () => {
  const adapter = new BrowserPersistence(data);
  await expect(
    adapter.transaction(async (tx) => {
      await tx.insert("lawFirms", firm);
      data.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...adapter.snapshot(), revision: 17 }),
      );
    }),
  ).rejects.toThrow("otra pestaña");
  expect(adapter.snapshot().revision).toBe(17);
});
it("rejects corrupt or unsupported snapshots without clearing data", async () => {
  data.setItem(STORAGE_KEY, "broken");
  const adapter = new BrowserPersistence(data);
  expect(() => adapter.snapshot()).toThrow("se conservaron");
  expect(data.getItem(STORAGE_KEY)).toBe("broken");
  await expect(adapter.importBackup('{"schema_version":2}')).rejects.toThrow();
  expect(data.getItem(STORAGE_KEY)).toBe("broken");
});
it("exports and restores the same IDs and prevents foreign scope references", async () => {
  const adapter = new BrowserPersistence(data);
  await adapter.transaction((tx) => tx.insert("lawFirms", firm));
  const imported = new BrowserPersistence(new Storage());
  await imported.importBackup(adapter.exportBackup());
  expect(imported.snapshot().tables).toEqual(adapter.snapshot().tables);
  const invalid = JSON.parse(adapter.exportBackup());
  invalid.tables.memberships.push({
    id: "m",
    law_firm_id: "missing",
    identity_id: "local-lawyer",
    role: "LAWYER",
    active: true,
    created_at: firm.created_at,
  });
  await expect(
    imported.importBackup(JSON.stringify(invalid)),
  ).rejects.toThrow();
  expect(imported.snapshot().tables).toEqual(adapter.snapshot().tables);
});
it("uses the actual Core for local drafts and rejects invalid document hashes on restore", async () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: data,
  });
  const f = (await localRequest("/firms", { name: "Estudio sintético" })) as {
    id: string;
  };
  const F = `/firms/${f.id}`;
  const c = (await localRequest(F + "/clients", {
    kind: "PERSON",
    display_name: "Cliente sintético",
    identification: null,
  })) as { id: string };
  const m = (await localRequest(F + "/matters", {
    client_id: c.id,
    title: "Asunto sintético",
    kind: "ADVISORY",
    subject_area: "Contratos",
    responsible_identity_id: "local-administrator",
    opened_on: "2026-10-13",
    closed_on: null,
  })) as { id: string };
  const M = F + "/matters/" + m.id;
  const draft = (await localRequest(M + "/drafts", {
    title: "Borrador sintético",
    content: "Texto original con ñ",
  })) as { id: string; document_id: string; document_version_id: string };
  const original = (await localRequest(M + "/originals", {
    title: "Original",
    original_base64: btoa("Original sintetico"),
    original_filename: "original.txt",
    mime_type: "text/plain",
  })) as { document: { id: string }; version_id: string };
  expect(
    await (
      (await localRequest(
        M +
          `/documents/${original.document.id}/versions/${original.version_id}/content`,
      )) as Blob
    ).text(),
  ).toBe("Original sintetico");
  const task = (await localRequest(M + "/tasks", {
    title: "Revisar original",
    responsible_identity_id: "local-administrator",
    internal_due_at: null,
  })) as { id: string };
  expect(
    ((await localRequest(F + "/my-day")) as { tasks: unknown[] }).tasks,
  ).toHaveLength(1);
  await localRequest(M + `/tasks/${task.id}/status`, { status: "DONE" });
  await expect(
    localRequest(M + `/drafts/${draft.id}/reviews`, {
      reviewer_identity_id: "local-administrator",
      internal_due_at: null,
      expected_version_id: draft.document_version_id,
    }),
  ).rejects.toThrow();
  await localRequest(M + "/participants", {
    identity_id: "local-lawyer",
    permissions: ["READ", "DRAFT_REVIEW"],
  });
  const review = (await localRequest(M + `/drafts/${draft.id}/reviews`, {
    reviewer_identity_id: "local-lawyer",
    internal_due_at: null,
    expected_version_id: draft.document_version_id,
  })) as { review: { id: string } };
  selectLocalProfile("local-lawyer");
  await expect(
    localRequest(M + `/reviews/${review.review.id}/decisions`, {
      decision: "APPROVE",
      expected_version_id: "stale-version",
      explicitly_confirmed: true,
    }),
  ).rejects.toThrow();
  await localRequest(M + `/reviews/${review.review.id}/decisions`, {
    decision: "APPROVE",
    expected_version_id: draft.document_version_id,
    explicitly_confirmed: true,
  });
  expect(
    ((await localRequest(M + "/drafts")) as Array<{ status: string }>)[0]
      ?.status,
  ).toBe("APPROVED");
  expect(((await localRequest(M + "/annexes")) as Blob).type).toBe(
    "application/zip",
  );
  const adapter = new BrowserPersistence(data),
    backup = JSON.parse(adapter.exportBackup());
  expect(backup.tables.documentVersions).toHaveLength(2);
  const restored = new BrowserPersistence(new Storage());
  await restored.importBackup(JSON.stringify(backup));
  expect(restored.snapshot().tables).toEqual(adapter.snapshot().tables);
  backup.tables.documentVersions[0].sha256 = "0".repeat(64);
  await expect(restored.importBackup(JSON.stringify(backup))).rejects.toThrow(
    "hash incorrecto",
  );
});
