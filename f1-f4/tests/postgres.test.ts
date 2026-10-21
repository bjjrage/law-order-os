import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import {
  database,
  fixture,
  admin,
  lawyer,
  reviewer,
  outsider,
  other,
} from "./fixtures.js";
import { buildServer } from "../../apps/api/src/server.js";
let db: Awaited<ReturnType<typeof database>>;
beforeAll(async () => {
  db = await database();
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL real local / identidad HTTP sintética explícita", () => {
  it("executes the persistent vertical slice with private bytes and exact-version approval", async () => {
    const f = await fixture(db);
    const document = await db.core.createDocument(
      admin.token,
      f.firm.id,
      f.matter.id,
      { title: "Original sintético" },
    );
    const bytes = Buffer.from("Original sintético inmutable", "utf8");
    const version = await db.core.addDocumentVersion(
      admin.token,
      f.firm.id,
      f.matter.id,
      document.id,
      bytes,
      { mime_type: "text/plain", original_filename: "original.txt" },
    );
    await db.core.publishDocumentVersion(
      admin.token,
      f.firm.id,
      f.matter.id,
      document.id,
      version.id,
      null,
    );
    await db.core.createTask(admin.token, f.firm.id, f.matter.id, {
      title: "Revisar contrato",
      responsible_identity_id: lawyer.id,
      internal_due_at: null,
    });
    expect(
      (await db.core.getMatter(lawyer.token, f.firm.id, f.matter.id)).id,
    ).toBe(f.matter.id);
    for (const actor of [outsider, other])
      await expect(
        db.core.getMatter(actor.token, f.firm.id, f.matter.id),
      ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    const draft = await db.core.prepareDraft(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      "Borrador sintético",
      "Texto inicial",
    );
    const { review } = await db.core.requestDraftReview(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      draft.id,
      reviewer.id,
      null,
    );
    await db.core.decideDraftReview(
      reviewer.token,
      f.firm.id,
      f.matter.id,
      review.id,
      {
        decision: "APPROVE",
        expected_version_id: draft.document_version_id,
        explicitly_confirmed: true,
      },
    );
    expect(
      (
        await db.pool.query(
          "SELECT version_id,actor FROM os_private.approvals WHERE review_id=$1",
          [review.id],
        )
      ).rows[0],
    ).toEqual({ version_id: draft.document_version_id, actor: reviewer.id });
    const saved = (
      await db.pool.query(
        'SELECT data FROM os_private."documentVersions" WHERE id=$1',
        [version.id],
      )
    ).rows[0].data;
    expect(saved.original_base64).toBeUndefined();
    expect(saved.blob_key).toBeTruthy();
    expect(
      Buffer.from(
        (
          await db.core.getDocumentVersion(
            lawyer.token,
            f.firm.id,
            f.matter.id,
            document.id,
            version.id,
          )
        ).original_base64,
        "base64",
      ),
    ).toEqual(bytes);
    const secondAdapter = new (
      db.persistence
        .constructor as typeof import("../../packages/persistence-postgres/src/index.js").PostgresPersistence
    )(db.runtime, db.blobs);
    const { OsCoreService } = await import("../../os-core/src/service.js");
    const second = new OsCoreService(secondAdapter, db.auth);
    expect(
      (await second.getDraft(reviewer.token, f.firm.id, f.matter.id, draft.id))
        .status,
    ).toBe("APPROVED");
    await db.core.reviseDraft(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      draft.id,
      draft.document_version_id,
      "Texto nuevo",
    );
    expect(
      (await db.core.getDraft(lawyer.token, f.firm.id, f.matter.id, draft.id))
        .status,
    ).toBe("DRAFT");
    expect(
      (
        await db.pool.query(
          "SELECT count(*)::int AS n FROM os_private.approvals WHERE review_id=$1",
          [review.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("enforces RLS with a real non-owner connection and no service filters", async () => {
    const f = await fixture(db);
    const connection = await db.runtime.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SET LOCAL ROLE os_runtime");
      await connection.query("SELECT set_config('os.actor',$1,true)", [
        other.id,
      ]);
      expect(
        (
          await connection.query(
            "SELECT * FROM os_private.matters WHERE id=$1",
            [f.matter.id],
          )
        ).rowCount,
      ).toBe(0);
      await connection.query("SELECT set_config('os.actor',$1,true)", [
        outsider.id,
      ]);
      expect(
        (
          await connection.query(
            "SELECT * FROM os_private.matters WHERE id=$1",
            [f.matter.id],
          )
        ).rowCount,
      ).toBe(0);
      const role = await connection.query(
        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
      );
      expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
      await connection.query("ROLLBACK");
      const context = await connection.query(
        "SELECT nullif(current_setting('os.actor',true),'') AS actor",
      );
      expect(context.rows[0].actor).toBeNull();
    } finally {
      connection.release();
    }
  });
  it("rolls back domain writes and rejects cross-tenant foreign keys", async () => {
    const f = await fixture(db);
    const actor = (await db.auth.authenticate(admin.token))!;
    const identity = randomUUID();
    await expect(
      db.persistence.transaction(async (tx) => {
        await tx.insert("clients", {
          id: identity,
          law_firm_id: f.firm.id,
          kind: "PERSON",
          display_name: "Rollback",
          identification: null,
          created_at: new Date().toISOString(),
        });
        throw Error("FAULT");
      }, actor),
    ).rejects.toThrow("FAULT");
    expect(
      (
        await db.pool.query("SELECT FROM os_private.clients WHERE id=$1", [
          identity,
        ])
      ).rowCount,
    ).toBe(0);
    await expect(
      db.pool.query(
        "INSERT INTO os_private.contacts(data,created_by) VALUES($1,$2)",
        [
          {
            id: randomUUID(),
            law_firm_id: f.foreign.id,
            client_id: f.client.id,
            display_name: "Cross",
            email: null,
            phone: null,
            created_at: new Date().toISOString(),
          },
          admin.id,
        ],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("does not inherit or race approvals, and revocation blocks further reads", async () => {
    const f = await fixture(db);
    const d = await db.core.prepareDraft(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      "Draft",
      "v1",
    );
    const { review } = await db.core.requestDraftReview(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      d.id,
      reviewer.id,
      null,
    );
    await db.core.reviseDraft(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      d.id,
      d.document_version_id,
      "v2",
    );
    await expect(
      db.core.decideDraftReview(
        reviewer.token,
        f.firm.id,
        f.matter.id,
        review.id,
        {
          decision: "APPROVE",
          expected_version_id: d.document_version_id,
          explicitly_confirmed: true,
        },
      ),
    ).rejects.toMatchObject({ code: "REVIEW_STATE_CONFLICT" });
    await db.core.revokeParticipant(
      admin.token,
      f.firm.id,
      f.matter.id,
      reviewer.id,
    );
    await expect(
      db.core.getDraft(reviewer.token, f.firm.id, f.matter.id, d.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("supports independent procedures and evidenced delivery without calling a court", async () => {
    const f = await fixture(db);
    for (const title of ["Procedimiento1", "Procedimiento2"])
      await db.core.createProceeding(admin.token, f.firm.id, f.matter.id, {
        title,
        court: null,
        number: null,
      });
    expect(
      (
        await db.core.listMatterResources(
          admin.token,
          f.firm.id,
          f.matter.id,
          "proceedings",
        )
      ).length,
    ).toBe(2);
    const d = await db.core.prepareDraft(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      "Entrega",
      "Texto",
    );
    const { review } = await db.core.requestDraftReview(
      lawyer.token,
      f.firm.id,
      f.matter.id,
      d.id,
      reviewer.id,
      null,
    );
    const receipt = await db.core.createDocument(
      admin.token,
      f.firm.id,
      f.matter.id,
      { title: "Comprobante" },
    );
    const v = await db.core.addDocumentVersion(
      admin.token,
      f.firm.id,
      f.matter.id,
      receipt.id,
      Buffer.from("Recibo sintético"),
      { mime_type: "text/plain", original_filename: "receipt.txt" },
    );
    const input = {
      kind: "DELIVERY" as const,
      document_version_id: d.document_version_id,
      receipt_version_id: v.id,
      recipient: "Destinatario sintético",
      occurred_at: new Date().toISOString(),
    };
    await expect(
      db.core.recordDelivery(reviewer.token, f.firm.id, f.matter.id, input),
    ).rejects.toMatchObject({ code: "APPROVED_VERSION_REQUIRED" });
    await db.core.decideDraftReview(
      reviewer.token,
      f.firm.id,
      f.matter.id,
      review.id,
      {
        decision: "APPROVE",
        expected_version_id: d.document_version_id,
        explicitly_confirmed: true,
      },
    );
    expect(
      (
        await db.core.recordDelivery(
          reviewer.token,
          f.firm.id,
          f.matter.id,
          input,
        )
      ).document_version_id,
    ).toBe(d.document_version_id);
  });
  it("serves HTTP with CSRF, idempotency and deterministic authorized annexes", async () => {
    const f = await fixture(db),
      app = buildServer({
        persistence: db.persistence,
        auth: db.auth,
        sessionPool: db.pool,
        origin: "http://127.0.0.1:4310",
      });
    await app.ready();
    const F = "/api/v1/firms/" + f.firm.id,
      M = F + "/matters/" + f.matter.id;
    const headers = {
      cookie: `os_session=${admin.token}`,
      origin: "http://127.0.0.1:4310",
      "x-csrf-token": "harness-csrf",
      "idempotency-key": randomUUID(),
    };
    const payload = {
      kind: "PERSON",
      display_name: "HTTP sintético",
      identification: null,
    };
    const first = await app.inject({
      method: "POST",
      url: F + "/clients",
      headers,
      payload,
    });
    expect(first.statusCode, first.body).toBe(201);
    const repeat = await app.inject({
      method: "POST",
      url: F + "/clients",
      headers,
      payload,
    });
    expect(repeat.json().data.id).toBe(first.json().data.id);
    const conflict = await app.inject({
      method: "POST",
      url: F + "/clients",
      headers,
      payload: { ...payload, display_name: "Changed" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: F + "/clients",
          headers: { ...headers, "x-csrf-token": "forged" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: M,
          headers: { cookie: `os_session=${other.token}` },
        })
      ).statusCode,
    ).toBe(404);
    const doc = await db.core.createDocument(
      admin.token,
      f.firm.id,
      f.matter.id,
      { title: "Anexo" },
    );
    await db.core.addDocumentVersion(
      admin.token,
      f.firm.id,
      f.matter.id,
      doc.id,
      Buffer.from("Anexo"),
      { mime_type: "text/plain", original_filename: "original.txt" },
    );
    const a = await app.inject({ url: M + "/annexes", headers }),
      b = await app.inject({ url: M + "/annexes", headers });
    expect(a.statusCode, a.body).toBe(200);
    expect(createHash("sha256").update(a.rawPayload).digest("hex")).toBe(
      createHash("sha256").update(b.rawPayload).digest("hex"),
    );
    expect(
      (
        await app.inject({
          url: M + "/annexes",
          headers: { cookie: `os_session=${other.token}` },
        })
      ).statusCode,
    ).toBe(404);
    await app.close();
  });
});
