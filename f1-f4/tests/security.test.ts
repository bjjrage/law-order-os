import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { ConfigSchema, localUrl } from "../../apps/api/src/config.js";
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
it("rejects any cloud URL before creating connections", () => {
  expect(() => localUrl("https://example.supabase.co")).toThrow(
    "LOCAL_DEVELOPMENT_ONLY",
  );
  expect(() =>
    localUrl("postgresql://user:pass@db.example.com/database"),
  ).toThrow("LOCAL_DEVELOPMENT_ONLY");
  expect(localUrl("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
});
it("approves with READ and DRAFT_REVIEW only, without granting draft write", async () => {
  const f = await fixture(db);
  await db.core.grantParticipant(
    admin.token,
    f.firm.id,
    f.matter.id,
    reviewer.id,
    ["READ", "DRAFT_REVIEW"],
  );
  const d = await db.core.prepareDraft(
    lawyer.token,
    f.firm.id,
    f.matter.id,
    "Least privilege",
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
    (await db.core.getDraft(reviewer.token, f.firm.id, f.matter.id, d.id))
      .status,
  ).toBe("APPROVED");
  await db.core.grantParticipant(
    admin.token,
    f.firm.id,
    f.matter.id,
    outsider.id,
    ["READ", "DRAFT_WRITE"],
  );
  const narrow = await db.core.prepareDraft(
    outsider.token,
    f.firm.id,
    f.matter.id,
    "Narrow writer",
    "v1",
  );
  await db.core.requestDraftReview(
    outsider.token,
    f.firm.id,
    f.matter.id,
    narrow.id,
    reviewer.id,
    null,
  );
  await db.core.reviseDraft(
    outsider.token,
    f.firm.id,
    f.matter.id,
    narrow.id,
    narrow.document_version_id,
    "v2",
  );
  expect(
    (await db.core.getDraft(outsider.token, f.firm.id, f.matter.id, narrow.id))
      .status,
  ).toBe("DRAFT");
  await expect(
    db.core.reviseDraft(
      reviewer.token,
      f.firm.id,
      f.matter.id,
      d.id,
      d.document_version_id,
      "Unauthorized",
    ),
  ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
});
it("rechecks matter authorization before returning an idempotent replay", async () => {
  const f = await fixture(db);
  const app = buildServer({
    persistence: db.persistence,
    auth: db.auth,
    sessionPool: db.pool,
    origin: "http://127.0.0.1:4310",
  });
  await app.ready();
  const headers = {
    cookie: `os_session=${reviewer.token}`,
    origin: "http://127.0.0.1:4310",
    "x-csrf-token": "harness-csrf",
    "idempotency-key": randomUUID(),
  };
  const request = {
    method: "POST" as const,
    url: "/api/v1/firms/" + f.firm.id + "/matters/" + f.matter.id + "/drafts",
    headers,
    payload: { title: "Private replay", content: "Private synthetic content" },
  };
  expect((await app.inject(request)).statusCode).toBe(201);
  await db.core.revokeParticipant(
    admin.token,
    f.firm.id,
    f.matter.id,
    reviewer.id,
  );
  const response = await app.inject(request);
  expect(response.statusCode).toBe(404);
  expect(response.body).not.toContain("Private replay");
  await app.close();
});
it("keeps private versions immutable even through SQL runtime credentials", async () => {
  const f = await fixture(db);
  const doc = await db.core.createDocument(
    admin.token,
    f.firm.id,
    f.matter.id,
    { title: "Original" },
  );
  const v = await db.core.addDocumentVersion(
    admin.token,
    f.firm.id,
    f.matter.id,
    doc.id,
    Buffer.from("intacto"),
    { mime_type: "text/plain", original_filename: "original.txt" },
  );
  const actor = (await db.auth.authenticate(admin.token))!;
  await expect(
    db.persistence.transaction(async () => {
      await db.runtime.query(
        'UPDATE os_private."documentVersions" SET data=data WHERE id=$1',
        [v.id],
      );
    }, actor),
  ).rejects.toMatchObject({ code: "42501" });
});
it("blocks publication of a version from another document and two concurrent approvals", async () => {
  const f = await fixture(db);
  const d = await db.core.prepareDraft(
    lawyer.token,
    f.firm.id,
    f.matter.id,
    "Borrador",
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
  const input = {
    decision: "APPROVE" as const,
    expected_version_id: d.document_version_id,
    explicitly_confirmed: true as const,
  };
  const results = await Promise.allSettled([
    db.core.decideDraftReview(
      reviewer.token,
      f.firm.id,
      f.matter.id,
      review.id,
      input,
    ),
    db.core.decideDraftReview(
      reviewer.token,
      f.firm.id,
      f.matter.id,
      review.id,
      input,
    ),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await db.pool.query(
        "SELECT count(*)::int n FROM os_private.approvals WHERE review_id=$1",
        [review.id],
      )
    ).rows[0].n,
  ).toBe(1);
  const original = await db.core.createDocument(
    admin.token,
    f.firm.id,
    f.matter.id,
    { title: "Otro original" },
  );
  await expect(
    db.core.publishDocumentVersion(
      admin.token,
      f.firm.id,
      f.matter.id,
      original.id,
      d.document_version_id,
      null,
    ),
  ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
});
it("retains the assigned reviewer at the SQL boundary", async () => {
  const f = await fixture(db);
  await db.core.grantParticipant(
    admin.token,
    f.firm.id,
    f.matter.id,
    outsider.id,
    ["READ", "DRAFT_WRITE", "DRAFT_REVIEW"],
  );
  const draft = await db.core.prepareDraft(
    lawyer.token,
    f.firm.id,
    f.matter.id,
    "Texto",
    "v1",
  );
  const { review } = await db.core.requestDraftReview(
    lawyer.token,
    f.firm.id,
    f.matter.id,
    draft.id,
    reviewer.id,
    null,
  );
  const connection = await db.runtime.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL ROLE os_runtime");
    await connection.query("SELECT set_config('os.actor',$1,true)", [
      outsider.id,
    ]);
    await expect(
      connection.query("UPDATE os_private.reviews SET data=$1 WHERE id=$2", [
        { ...review, reviewer_identity_id: outsider.id, status: "APPROVED" },
        review.id,
      ]),
    ).rejects.toThrow("INVALID_APPROVAL");
    await connection.query("ROLLBACK");
  } finally {
    connection.release();
  }
});
it("does not publish catalog data on blob failure, and audits denied HTTP outside rollback", async () => {
  const f = await fixture(db);
  const { PostgresPersistence } =
    await import("../../packages/persistence-postgres/src/index.js");
  const failure = new PostgresPersistence(db.runtime, {
    writeOnce: async () => {
      throw Error("STORAGE_FAULT");
    },
    read: async () => {
      throw Error("STORAGE_FAULT");
    },
  });
  const app = buildServer({
    persistence: failure,
    auth: db.auth,
    sessionPool: db.pool,
    origin: "http://127.0.0.1:4310",
  });
  await app.ready();
  const path = "/api/v1/firms/" + f.firm.id + "/matters/" + f.matter.id;
  const headers = {
    cookie: `os_session=${admin.token}`,
    origin: "http://127.0.0.1:4310",
    "x-csrf-token": "harness-csrf",
    "idempotency-key": randomUUID(),
  };
  const result = await app.inject({
    method: "POST",
    url: path + "/originals",
    headers,
    payload: {
      title: "Must rollback",
      original_base64: Buffer.from("text").toString("base64"),
      original_filename: "file.txt",
      mime_type: "text/plain",
    },
  });
  expect(result.statusCode).toBe(503);
  expect(
    (
      await db.pool.query(
        "SELECT FROM os_private.documents WHERE data->>'title'=$1",
        ["Must rollback"],
      )
    ).rowCount,
  ).toBe(0);
  const denied = await app.inject({
    url: path,
    headers: { cookie: `os_session=${other.token}` },
  });
  expect(denied.statusCode).toBe(404);
  expect(
    (
      await db.pool.query(
        "SELECT FROM os_private.access_audit WHERE actor=$1 AND outcome='ACCESS_DENIED'",
        [other.id],
      )
    ).rowCount,
  ).toBeGreaterThan(0);
  await app.close();
});
it("refuses arbitrary identity/tenant injection and unscanned binary upload", async () => {
  const f = await fixture(db);
  const app = buildServer({
    persistence: db.persistence,
    auth: db.auth,
    sessionPool: db.pool,
    origin: "http://127.0.0.1:4310",
  });
  await app.ready();
  const F = "/api/v1/firms/" + f.firm.id;
  const headers = {
    cookie: `os_session=${admin.token}`,
    origin: "http://127.0.0.1:4310",
    "x-csrf-token": "harness-csrf",
    "idempotency-key": randomUUID(),
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: F + "/clients",
        headers,
        payload: {
          kind: "PERSON",
          display_name: "Injection",
          identification: null,
          law_firm_id: f.foreign.id,
          actor: other.id,
        },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        url: F + "/matters/" + f.matter.id + "/originals",
        headers,
        payload: {
          title: "PDF",
          original_base64: Buffer.from("%PDF fake").toString("base64"),
          original_filename: "test.pdf",
          mime_type: "application/pdf",
        },
      })
    ).statusCode,
  ).toBe(400);
  expect((await app.inject({ url: F + "/clients" })).statusCode).toBe(401);
  await app.close();
});
