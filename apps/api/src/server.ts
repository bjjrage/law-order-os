import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { zipSync, strToU8 } from "fflate";
import type { Pool } from "pg";
import { OsCoreService } from "../../../os-core/src/service.js";
import {
  CoreError,
  type AuthenticatedPrincipal,
  type Task,
} from "../../../os-core/src/contracts.js";
import type { PostgresPersistence } from "../../../packages/persistence-postgres/src/index.js";
import type { SessionIdentity } from "./auth.js";
type Request = FastifyRequest<{ Params: Record<string, string> }>;
const authBody = z
  .object({
    email: z.email().endsWith(".invalid"),
    password: z.string().min(12).max(200),
  })
  .strict();
const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const text = z.string().min(1).max(240);
const id = z.string().min(1).max(128);
export function buildServer(options: {
  persistence: PostgresPersistence;
  auth: SessionIdentity;
  sessionPool: Pool;
  origin: string;
  staticRoot?: string;
}) {
  const { persistence, auth, sessionPool, origin } = options;
  const app = Fastify({ logger: false, bodyLimit: 29 * 1024 * 1024 });
  const core = new OsCoreService(persistence, auth);
  const principals = new WeakMap<FastifyRequest, AuthenticatedPrincipal>();
  app.register(cookie);
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
    if (
      !req.url.startsWith("/api/v1/") ||
      req.url.startsWith("/api/v1/auth/login")
    )
      return;
    const token = req.cookies.os_session ?? "";
    const principal = await auth.authenticate(token);
    if (!principal) throw new CoreError("UNAUTHENTICATED");
    principals.set(req, principal);
    if (!["GET", "HEAD"].includes(req.method)) {
      if (
        req.headers.origin !== origin ||
        req.headers["x-csrf-token"] !== (await auth.csrf(token))
      )
        throw new CoreError("CSRF_REJECTED");
    }
  });
  app.addHook("onSend", async (req, reply, payload) => {
    if (!req.url.startsWith("/api/")) return payload;
    try {
      await sessionPool.query(
        "INSERT INTO os_private.access_audit(actor,request_id,outcome) VALUES($1,$2,$3)",
        [
          principals.get(req)?.identity_id ?? null,
          req.id,
          reply.statusCode < 400 ? "ACCESS_GRANTED" : "ACCESS_DENIED",
        ],
      );
    } catch {
      // A domain commit may already exist; the retained idempotency key makes a retry safe.
      reply.status(503).type("application/json");
      return JSON.stringify({
        error: { code: "ACCESS_AUDIT_UNAVAILABLE", request_id: req.id },
      });
    }
    return payload;
  });
  app.setErrorHandler((error, req, reply) => {
    const code =
      error instanceof CoreError
        ? error.code
        : error instanceof z.ZodError
          ? "INVALID_INPUT"
          : (error as { code?: string }).code === "23505"
            ? "CONFLICT"
            : "DEPENDENCY_UNAVAILABLE";
    const status =
      code === "UNAUTHENTICATED"
        ? 401
        : code === "ACCESS_DENIED"
          ? 404
          : code === "CSRF_REJECTED"
            ? 403
            : code === "INVALID_INPUT"
              ? 400
              : code.includes("CONFLICT") || code.includes("ALREADY_EXISTS")
                ? 409
                : code.includes("UNAVAILABLE")
                  ? 503
                  : 422;
    reply.status(status).send({
      error: {
        code: status === 404 ? "RESOURCE_NOT_FOUND" : code,
        message_key: code,
        request_id: req.id,
      },
    });
  });
  const credential = (req: FastifyRequest) => req.cookies.os_session ?? "";
  const envelope = (req: FastifyRequest, data: unknown) => ({
    data,
    request_id: req.id,
  });
  function post(path: string, operation: (r: Request) => Promise<unknown>) {
    app.post(path, async (req: Request, reply) => {
      const key = z.uuid().parse(req.headers["idempotency-key"]);
      const fingerprint = digest(
        JSON.stringify([req.method, req.url, req.body]),
      );
      const result = await persistence.idempotent(
        principals.get(req)!,
        key,
        fingerprint,
        () => operation(req),
        async () => {
          if (req.params.matterId)
            await core.getMatter(
              credential(req),
              req.params.firmId!,
              req.params.matterId,
            );
          else if (req.params.firmId)
            await core.getLawFirm(credential(req), req.params.firmId);
        },
      );
      return reply.status(201).send(envelope(req, result));
    });
  }
  function get(path: string, operation: (r: Request) => Promise<unknown>) {
    app.get(path, async (req: Request) => envelope(req, await operation(req)));
  }
  app.get("/health", async () => ({
    status: "LOCAL_ONLY",
    ai_enabled: false,
    planned_region: "sa-east-1",
    auth: "SUPABASE_REQUIRED",
  }));
  app.get("/ready", async (_req, reply) => {
    try {
      await persistence.pool.query("SELECT 1");
      return reply.status(503).send({
        database: "READY",
        auth: "REQUIRES_LOCAL_SUPABASE_VERIFICATION",
        storage: "REQUIRES_LOCAL_SUPABASE_VERIFICATION",
      });
    } catch {
      return reply.status(503).send({ database: "BLOCKED" });
    }
  });
  app.post("/api/v1/auth/login", async (req, reply) => {
    if (req.headers.origin !== origin) throw new CoreError("CSRF_REJECTED");
    const body = authBody.parse(req.body);
    let result;
    try {
      result = await auth.login(body.email, body.password);
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError("IDENTITY_PROVIDER_UNAVAILABLE");
    }
    reply.setCookie("os_session", result.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(origin).protocol === "https:",
      path: "/",
      maxAge: 3600,
    });
    return envelope(req, { csrf: result.csrf });
  });
  app.post("/api/v1/auth/logout", async (req, reply) => {
    await auth.logout(credential(req));
    reply.clearCookie("os_session", { path: "/" });
    return envelope(req, { logged_out: true });
  });
  get("/api/v1/session", async (req) => {
    const actor = principals.get(req)!;
    const firms = await sessionPool.query(
      "SELECT f.data FROM os_private.\"lawFirms\" f JOIN os_private.memberships m ON m.law_firm_id=f.id WHERE m.data->>'identity_id'=$1 AND (m.data->>'active')::boolean ORDER BY f.id",
      [actor.identity_id],
    );
    return {
      identity: await auth.identity(actor.identity_id),
      firms: firms.rows.map((r) => r.data),
      csrf: await auth.csrf(credential(req)),
    };
  });
  post("/api/v1/firms", async (req) =>
    core.createLawFirm(
      credential(req),
      z.object({ name: text }).strict().parse(req.body).name,
    ),
  );
  const F = "/api/v1/firms/:firmId",
    M = F + "/matters/:matterId";
  get(F, (req) => core.getLawFirm(credential(req), req.params.firmId!));
  get(F + "/memberships", (req) =>
    core.listMembers(credential(req), req.params.firmId!),
  );
  post(F + "/memberships", (req) => {
    const b = z
      .object({
        identity_id: id,
        role: z.enum(["LAWYER", "ASSISTANT", "COORDINATOR", "ADMINISTRATOR"]),
      })
      .strict()
      .parse(req.body);
    return core.addMember(
      credential(req),
      req.params.firmId!,
      b.identity_id,
      b.role,
    );
  });
  post(F + "/memberships/:identityId/deactivation", (req) =>
    core.deactivateMember(
      credential(req),
      req.params.firmId!,
      req.params.identityId!,
    ),
  );
  get(F + "/clients", (req) =>
    core.listClients(credential(req), req.params.firmId!),
  );
  post(F + "/clients", (req) =>
    core.createClient(credential(req), req.params.firmId!, req.body as never),
  );
  get(F + "/clients/:clientId", (req) =>
    core.getClient(credential(req), req.params.firmId!, req.params.clientId!),
  );
  post(F + "/contacts", (req) =>
    core.createContact(credential(req), req.params.firmId!, req.body as never),
  );
  get(F + "/matters", (req) =>
    core.listMatters(credential(req), req.params.firmId!),
  );
  post(F + "/matters", (req) =>
    core.createMatter(credential(req), req.params.firmId!, req.body as never),
  );
  get(M, (req) =>
    core.getMatter(credential(req), req.params.firmId!, req.params.matterId!),
  );
  post(M + "/responsible", (req) => {
    const b = z
      .object({ identity_id: id, expected_responsible_id: id })
      .strict()
      .parse(req.body);
    return core.reassignMatter(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      b.identity_id,
      b.expected_responsible_id,
    );
  });
  post(M + "/participants", (req) => {
    const b = z
      .object({
        identity_id: id,
        permissions: z.array(
          z.enum([
            "READ",
            "MANAGE",
            "DOCUMENT_WRITE",
            "TASK_WRITE",
            "DRAFT_WRITE",
            "DRAFT_REVIEW",
          ]),
        ),
      })
      .strict()
      .parse(req.body);
    return core.grantParticipant(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      b.identity_id,
      b.permissions,
    );
  });
  post(M + "/participants/:identityId/revocation", (req) =>
    core.revokeParticipant(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.identityId!,
    ),
  );
  for (const table of [
    "documents",
    "tasks",
    "drafts",
    "reviews",
    "participants",
    "proceedings",
    "deliveries",
  ] as const)
    get(M + "/" + table, (req) =>
      core.listMatterResources(
        credential(req),
        req.params.firmId!,
        req.params.matterId!,
        table,
      ),
    );
  post(M + "/proceedings", (req) =>
    core.createProceeding(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.body as never,
    ),
  );
  post(M + "/documents", (req) =>
    core.createDocument(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.body as never,
    ),
  );
  post(M + "/documents/:documentId/versions", (req) => {
    const b = z
      .object({
        original_base64: z.string().min(4).max(28_000_000),
        original_filename: text,
        mime_type: z.literal("text/plain"),
      })
      .strict()
      .parse(req.body);
    const bytes = Buffer.from(b.original_base64, "base64");
    if (
      bytes.toString("base64") !== b.original_base64 ||
      !bytes.length ||
      bytes.length > 20 * 1024 * 1024
    )
      throw new CoreError("INVALID_DOCUMENT_BYTES");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new CoreError("INVALID_DOCUMENT_BYTES");
    }
    // This local slice accepts plain UTF-8 only. PDF/binary requires an approved scanner; never mark unchecked binary clean.
    return core
      .addDocumentVersion(
        credential(req),
        req.params.firmId!,
        req.params.matterId!,
        req.params.documentId!,
        bytes,
        { mime_type: b.mime_type, original_filename: b.original_filename },
      )
      .then(({ original_base64, ...metadata }) => metadata);
  });
  post(M + "/originals", async (req) => {
    const b = z
      .object({
        title: text,
        original_base64: z.string().min(4).max(28_000_000),
        original_filename: text,
        mime_type: z.literal("text/plain"),
      })
      .strict()
      .parse(req.body);
    const bytes = Buffer.from(b.original_base64, "base64");
    if (
      bytes.toString("base64") !== b.original_base64 ||
      !bytes.length ||
      bytes.length > 20 * 1024 * 1024
    )
      throw new CoreError("INVALID_DOCUMENT_BYTES");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new CoreError("INVALID_DOCUMENT_BYTES");
    }
    const document = await core.createDocument(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      { title: b.title },
    );
    const version = await core.addDocumentVersion(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      document.id,
      bytes,
      { mime_type: b.mime_type, original_filename: b.original_filename },
    );
    const published = await core.publishDocumentVersion(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      document.id,
      version.id,
      null,
    );
    return {
      document: published,
      version_id: version.id,
      sha256: version.sha256,
    };
  });
  post(M + "/documents/:documentId/publication", (req) => {
    const b = z
      .object({ version_id: id, expected_current_version_id: id.nullable() })
      .strict()
      .parse(req.body);
    return core.publishDocumentVersion(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.documentId!,
      b.version_id,
      b.expected_current_version_id,
    );
  });
  app.get(
    M + "/documents/:documentId/versions/:versionId/content",
    async (req: Request, reply) => {
      const v = await core.getDocumentVersion(
        credential(req),
        req.params.firmId!,
        req.params.matterId!,
        req.params.documentId!,
        req.params.versionId!,
      );
      return reply
        .type("application/octet-stream")
        .header("Content-Disposition", `attachment; filename="${v.id}.txt"`)
        .send(Buffer.from(v.original_base64, "base64"));
    },
  );
  post(M + "/tasks", (req) =>
    core.createTask(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.body as never,
    ),
  );
  get(F + "/work", (req) =>
    core.workBoard(credential(req), req.params.firmId!),
  );
  get(F + "/work/team", (req) =>
    core.workBoard(credential(req), req.params.firmId!, true),
  );
  post(M + "/tasks/:taskId/assignment", (req) => {
    const b = req.body as {
      input: Parameters<typeof core.reviseTask>[4];
      expected_revision: number;
    };
    return core.reviseTask(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.taskId!,
      b.input,
      b.expected_revision,
    );
  });
  post(M + "/tasks/:taskId/progress", (req) => {
    const b = req.body as { note: string; state: "UPDATE" | "BLOCKED" };
    return core.recordTaskProgress(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.taskId!,
      b.note,
      b.state,
    );
  });
  post(M + "/direction-requests", (req) =>
    core.requestDirection(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.body as never,
    ),
  );
  post(M + "/direction-requests/:requestId/resolution", (req) =>
    core.resolveDirection(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.requestId!,
      req.body as never,
    ),
  );
  post(M + "/tasks/:taskId/status", (req) => {
    const b = z
      .object({
        status: z.enum(["PENDING", "DONE", "CANCELLED"]),
        expected_deadline_revision: z.number().int().positive().optional(),
      })
      .strict()
      .parse(req.body);
    return core.updateTaskStatus(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.taskId!,
      b.status,
      b.expected_deadline_revision,
    );
  });
  post(M + "/deadlines", (req) =>
    core.createDeadline(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.body as never,
    ),
  );
  app.get(M + "/tasks/:taskId/deadline-source", async (req: Request, reply) => {
    const version = await core.getDeadlineSource(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.taskId!,
    );
    return reply
      .type(version.mime_type)
      .header("Content-Disposition", `attachment; filename="${version.id}"`)
      .send(Buffer.from(version.original_base64, "base64"));
  });
  post(M + "/deadlines/:taskId/revision", (req) => {
    const b = req.body as {
      input: never;
      expected_revision: number;
      reason: string;
    };
    return core.reviseDeadline(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.taskId!,
      b.input,
      b.expected_revision,
      b.reason,
    );
  });
  post(M + "/deadlines/:taskId/confirmation", (req) =>
    core.confirmDeadline(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.taskId!,
      (req.body as { expected_revision: number }).expected_revision,
    ),
  );
  post(M + "/deadlines/:taskId/acknowledgement", (req) =>
    core.acknowledgeDeadlineAlert(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.taskId!,
      (req.body as { alert_id: string }).alert_id,
    ),
  );
  post(F + "/deadline-inbox", (req) =>
    core.deadlineInbox(credential(req), req.params.firmId!),
  );
  post(M + "/drafts", (req) => {
    const b = z
      .object({ title: text, content: z.string().min(1).max(1_000_000) })
      .strict()
      .parse(req.body);
    return core.prepareDraft(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      b.title,
      b.content,
    );
  });
  post(M + "/drafts/:draftId/versions", (req) => {
    const b = z
      .object({
        content: z.string().min(1).max(1_000_000),
        expected_version_id: id,
      })
      .strict()
      .parse(req.body);
    return core.reviseDraft(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.draftId!,
      b.expected_version_id,
      b.content,
    );
  });
  post(M + "/drafts/:draftId/reviews", async (req) => {
    const b = z
      .object({
        reviewer_identity_id: id,
        internal_due_at: z.iso.datetime().nullable(),
        expected_version_id: id,
      })
      .strict()
      .parse(req.body);
    const d = await core.getDraft(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.draftId!,
    );
    if (d.document_version_id !== b.expected_version_id)
      throw new CoreError("VERSION_CONFLICT");
    return core.requestDraftReview(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      d.id,
      b.reviewer_identity_id,
      b.internal_due_at,
    );
  });
  post(M + "/reviews/:reviewId/decisions", (req) =>
    core.decideDraftReview(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.params.reviewId!,
      req.body as never,
    ),
  );
  post(M + "/deliveries", (req) =>
    core.recordDelivery(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      req.body as never,
    ),
  );
  get(M + "/activity", (req) =>
    core.matterActivity(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
    ),
  );
  get(F + "/my-day", async (req) => {
    const actor = principals.get(req)!;
    const matters = await core.listMatters(credential(req), req.params.firmId!);
    const tasks: Array<Task & { matter_title: string }> = [];
    for (const m of matters)
      for (const t of await core.listMatterResources(
        credential(req),
        m.law_firm_id,
        m.id,
        "tasks",
      ))
        if (
          t.status === "PENDING" &&
          !t.direction_request &&
          t.responsible_identity_id === actor.identity_id
        )
          tasks.push({ ...t, matter_title: m.title });
    tasks.sort(
      (a, b) =>
        (a.internal_due_at ?? "9999").localeCompare(
          b.internal_due_at ?? "9999",
        ) || a.id.localeCompare(b.id),
    );
    return {
      tasks,
      without_next_action: matters.filter(
        (m) => !tasks.some((t) => t.matter_id === m.id),
      ),
    };
  });
  app.get(M + "/annexes", async (req: Request, reply) => {
    const versions = await core.listMatterResources(
      credential(req),
      req.params.firmId!,
      req.params.matterId!,
      "documentVersions",
    );
    const manifest = versions
      .map((v) => ({
        version_id: v.id,
        document_id: v.document_id,
        sha256: v.sha256,
        filename: v.original_filename,
      }))
      .sort((a, b) => a.version_id.localeCompare(b.version_id));
    const entries: Record<string, Uint8Array> = {
      "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    };
    for (const v of versions)
      entries[`${v.id}.txt`] = Buffer.from(v.original_base64, "base64");
    const zip = zipSync(entries, { level: 0, mtime: new Date(1980, 0, 2) });
    return reply
      .type("application/zip")
      .header("Content-Disposition", 'attachment; filename="anexos.zip"')
      .send(Buffer.from(zip));
  });
  const root = options.staticRoot ?? resolve("dist/web");
  if (existsSync(root)) {
    app.register(staticFiles, {
      root,
      setHeaders(res, path) {
        res.header(
          "Cache-Control",
          extname(path) === ".html" ? "no-store" : "no-cache",
        );
      },
    });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") ||
      req.url.startsWith("/assets/") ||
      !!extname(req.url.split("?")[0]!)
        ? reply.status(404).send({ error: { code: "RESOURCE_NOT_FOUND" } })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
