import { expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { prepareCase, loadCase, runCase, statusCase } from "../../scripts/junta-case.mjs";
import { bytesHash } from "../../dist/domain/guards.js";

it("keeps legacy document snapshots and offline reports readable while retiring live execution", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "law-order-junta-case-"));
  const network = vi.fn(() => { throw Error("NETWORK_FORBIDDEN"); });
  vi.stubGlobal("fetch", network);
  try {
    const bytes = Buffer.from("CONTRATO SINTETICO. Se requieren anexos para revisar obligaciones.");
    const input = { study_id: "synthetic-study", matter_id: "synthetic-matter", actor_id: "local-administrator",
      question: "¿Qué documentos faltan para revisar el contrato sintético?", scope: "Documentación faltante sin concluir incumplimientos.",
      as_of_date: "2026-10-20", synthetic_data: true, include_library: false, execution_mode: "OFFLINE_TEST",
      documents: [{ id: "contract", version_id: "v1", sha256: bytesHash(bytes), title: "Contrato de prueba", base64: bytes.toString("base64"), nature: "UNKNOWN" }] };
    await expect(prepareCase({ ...input, execution_mode: "LIVE" }, root)).rejects.toThrow("LEGAL_WORKFLOW_UNIFIED");
    await expect(prepareCase({ ...input, documents: [{ ...input.documents[0], sha256: "0".repeat(64) }] }, root)).rejects.toThrow("DOCUMENT_BYTES_OR_HASH_INVALID");
    const prepared = await prepareCase(input, root);
    const run = await runCase(prepared.prepared_id, root);
    expect(run.mode).toBe("OFFLINE_SIMULATION");
    expect((await statusCase(prepared.prepared_id, root)).run.run_id).toBe(run.run_id);
    expect(network).not.toHaveBeenCalled();
    const path = resolve(root, ".board-data/case-junta", prepared.prepared_id + ".json");
    const saved = JSON.parse(await readFile(path, "utf8"));
    saved.prepared_hash = "0".repeat(64);
    await writeFile(path, JSON.stringify(saved));
    await expect(loadCase(prepared.prepared_id, root)).rejects.toThrow("PREPARED_HASH_MISMATCH");
  } finally {
    vi.unstubAllGlobals();
    const allowed=resolve(tmpdir())+sep;
    if (!root.startsWith(allowed) || !root.slice(allowed.length).startsWith("law-order-junta-case-")) throw Error("UNSAFE_TEST_CLEANUP");
    await rm(root, { recursive: true, force: true });
  }
});
