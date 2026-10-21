import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { ensureWorkspaceDatabase } from "./workspace-runtime.mjs";
import {
  operationsStatus,
  saveOperations,
  validateExternalDestination,
  copyExternalBackup,
} from "./platform-operations.mjs";
import { hashPassword } from "better-auth/crypto";
import { runSessionAI, sessionFingerprint } from "./session-ai.mjs";
import {
  createPlatformBackup,
  restorePlatformBackup,
} from "./platform-backup.mjs";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const installationAccess = new Map();
const person = (u) => ({
  id: u.id,
  subject: u.id,
  display_name: u.name,
  active: true,
});
const legacy = [
  {
    id: "local-administrator",
    subject: "local-administrator",
    display_name: "Administrador local",
    active: true,
  },
  {
    id: "local-lawyer",
    subject: "local-lawyer",
    display_name: "Abogado local",
    active: true,
  },
];
export function createPlatformBridge(root, origin, options = {}) {
  let ready,
    backup,
    timer,
    deadlineTimer,
    deadlineTick,
    deadlineError = null,
    backupError = null,
    lastBackupFailure = 0;
  const accessListeners = installationAccess.get(resolve(root)) ?? new Set();
  installationAccess.set(resolve(root), accessListeners);
  const portalRates = new Map();
  const accessChanged = () =>
    Promise.allSettled([...accessListeners].map((fn) => fn()));
  const send = (res, code, data) => {
    res.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Law-Order-OS": "local-accounts-v1",
    });
    res.end(JSON.stringify(data));
  };
  const initialize = () =>
    (ready ??= (async () => {
      let ownedPool, ownedAuthPool;
      try {
        if (!options.pool) await ensureWorkspaceDatabase(root);
        const config =
          options.config ??
          JSON.parse(
            await readFile(resolve(root, ".local-dev/app-config.json"), "utf8"),
          );
        const u = new URL(config.auth_database_url);
        if (u.hostname !== "127.0.0.1" || u.port !== "55432")
          throw Error("LOCAL_DATABASE_REQUIRED");
        const pool =
          options.pool ?? new Pool({ connectionString: u.href, max: 5 });
        if (!options.pool) ownedPool = pool;
        const { LocalPlatform } =
          await import("../dist/os-app/apps/api/src/local-platform.js");
        const platform = options.platform ?? new LocalPlatform(pool);
        await platform.initialize();
        await pool.query(
          `CREATE TABLE IF NOT EXISTS os_private.platform_recovery(token_hash text PRIMARY KEY,user_id text NOT NULL,created_by text NOT NULL,firm_id text,expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())`,
        );
        await pool.query(
          `CREATE TABLE IF NOT EXISTS os_private.session_ai_jobs(id uuid PRIMARY KEY,firm_id text NOT NULL,matter_id text NOT NULL,actor_id text NOT NULL,fingerprint text NOT NULL,status text NOT NULL,result jsonb,cost_usd numeric NOT NULL DEFAULT 0,cost_kind text NOT NULL DEFAULT 'RESERVED_USAGE_UNKNOWN',created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz)`,
        );
        await pool.query(
          "CREATE SCHEMA IF NOT EXISTS os_auth; REVOKE ALL ON SCHEMA os_auth FROM PUBLIC",
        );
        const authPool = new Pool({
          connectionString: u.href,
          max: 3,
          options: "-c search_path=os_auth",
        });
        ownedAuthPool = authPool;
        await mkdir(resolve(root, ".local-dev"), { recursive: true });
        const secretFile = resolve(root, ".local-dev/platform-auth-secret");
        await writeFile(secretFile, randomBytes(48).toString("base64"), {
          flag: "wx",
          mode: 0o600,
        }).catch((e) => {
          if (e.code !== "EEXIST") throw e;
        });
        const authOptions = {
          database: authPool,
          baseURL: origin,
          basePath: "/local/auth",
          secret: (await readFile(secretFile, "utf8")).trim(),
          trustedOrigins: [origin],
          emailAndPassword: {
            enabled: true,
            minPasswordLength: 12,
            maxPasswordLength: 128,
          },
          advanced: {
            cookiePrefix: "law-order-os-local",
            database: { generateId: "uuid" },
          },
          rateLimit: {
            enabled: true,
            storage: "database",
            window: 60,
            max: 30,
          },
          session: { expiresIn: 8 * 60 * 60, updateAge: 3600 },
          telemetry: { enabled: false },
        };
        await (await getMigrations(authOptions)).runMigrations();
        const auth = betterAuth(authOptions);
        const directory = async () =>
          (await pool.query('SELECT id,name FROM os_auth."user"')).rows.map(
            person,
          );
        if (!(await platform.hierarchyReady())) {
          await createPlatformBackup(root, pool, config);
          await platform.migrateHierarchy(await directory());
        }
        return {
          pool,
          authPool,
          platform,
          auth,
          directory,
          config,
          nodeAuth: toNodeHandler(auth),
        };
      } catch (error) {
        await Promise.allSettled([ownedAuthPool?.end(), ownedPool?.end()]);
        throw error;
      }
    })().catch((error) => {
      ready = undefined;
      throw error;
    }));
  async function session(headers) {
    const s = await initialize();
    const value = await s.auth.api.getSession({
      headers: headers instanceof Headers ? headers : fromNodeHeaders(headers),
    });
    if (!value)
      throw Object.assign(Error("Iniciá sesión para continuar."), {
        status: 401,
      });
    return { ...s, actor: person(value.user), sessionId: value.session.id };
  }
  async function isEnabled() {
    return (await initialize()).platform.configured();
  }
  async function ensureOwner(s) {
    if (!(await s.platform.owner(s.actor.id)))
      throw Error("Solo el titular puede administrar cuentas y respaldos.");
  }
  async function recentBackups() {
    const items = [];
    for (const id of (
      await readdir(resolve(root, ".local-dev/backups")).catch(() => [])
    )
      .filter((id) => /^platform-[a-zA-Z0-9-]+$/.test(id))
      .sort()
      .reverse()) {
      const m = await readFile(
        resolve(root, ".local-dev/backups", id, "manifest.json"),
        "utf8",
      )
        .then(JSON.parse)
        .catch(() => null);
      if (m)
        items.push({
          id,
          created_at: m.created_at,
          restoration: await readFile(
            resolve(root, ".local-dev/backups", id, "restoration.json"),
            "utf8",
          )
            .then(JSON.parse)
            .catch(() => null),
        });
    }
    return items;
  }
  // A backup folder without manifest.json never finished and is not usable.
  // Remove it so failed attempts do not pile up on disk.
  async function pruneIncompleteBackups(force = false) {
    if (backup && !force) return;
    const base = resolve(root, ".local-dev/backups");
    for (const id of (await readdir(base).catch(() => [])).filter((id) =>
      /^platform-[a-zA-Z0-9-]+$/.test(id),
    )) {
      const done = await readFile(resolve(base, id, "manifest.json")).then(
        () => true,
        () => false,
      );
      if (!done && !(backup && !force))
        await rm(resolve(base, id), { recursive: true, force: true }).catch(
          () => {},
        );
    }
  }
  async function makeBackup(s) {
    if (!backup)
      backup = createPlatformBackup(root, s.pool, s.config)
        .then((r) => {
          backupError = null;
          return operationsStatus(root).then(async (config) => {
            if (config.external_backup) await copyExternalBackup(root, r.id);
            return r;
          });
        })
        .catch(async (e) => {
          backupError =
            "No se pudo completar el respaldo. Revisá el almacenamiento e intentá nuevamente.";
          lastBackupFailure = Date.now();
          await pruneIncompleteBackups(true);
          throw e;
        })
        .finally(() => {
          backup = undefined;
        });
    return backup;
  }
  async function prepareSessionAI(headers, body) {
    const s = await session(headers),
      a = s,
      directory = await s.directory();
    const { z } = await import("zod"),
      input = z
        .object({
          firm: z.uuid(),
          record_id: z.uuid(),
          request_id: z.uuid(),
          action: z.enum(["TRANSCRIBE", "MINUTES"]),
          budget_usd: z.number().positive().max(50),
          wav_base64: z
            .string()
            .max(34 * 1024 * 1024)
            .nullable(),
        })
        .strict()
        .parse(body);
    const view = await s.platform.command(
        a.actor,
        directory,
        `/firms/${input.firm}/practice`,
        undefined,
        undefined,
      ),
      source = view.data.records.find((r) => r.id === input.record_id);
    if (!source?.matter_id) throw Error("ACCESS_DENIED");
    await s.platform.grant(
      a.actor,
      { law_firm_id: input.firm, matter_id: source.matter_id },
      true,
    );
    if (input.action === "TRANSCRIBE" && !input.wav_base64) {
      if (source.payload.type !== "RECORDING" || source.payload.withdrawn_at)
        throw Error("SESSION_RECORDING_REQUIRED");
      if (source.payload.mime !== "audio/wav")
        throw Error("SESSION_BROWSER_AUDIO_CONVERSION_REQUIRED");
      const bytes = await readFile(
        resolve(
          root,
          ".local-dev/session-recordings",
          source.payload.object_key,
        ),
      );
      if (hash(bytes) !== source.payload.sha256)
        throw Error("RECORDING_INTEGRITY_FAILED");
      input.wav_base64 = bytes.toString("base64");
    }
    const fingerprint = sessionFingerprint(a.actor.id, source, input),
      insert = await s.pool.query(
        "INSERT INTO os_private.session_ai_jobs(id,firm_id,matter_id,actor_id,fingerprint,status,cost_usd,cost_kind,result) VALUES($1,$2,$3,$4,$5,'RUNNING',0,'NOT_STARTED',$6) ON CONFLICT DO NOTHING RETURNING id",
        [
          input.request_id,
          input.firm,
          source.matter_id,
          a.actor.id,
          fingerprint,
          { source: { id: source.id, revision: source.revision } },
        ],
      );
    if (!insert.rowCount) {
      const previous = (
        await s.pool.query(
          "SELECT * FROM os_private.session_ai_jobs WHERE id=$1",
          [input.request_id],
        )
      ).rows[0];
      if (
        previous.actor_id !== a.actor.id ||
        previous.fingerprint !== fingerprint
      )
        throw Error("SESSION_AI_REQUEST_CONFLICT");
      if (previous.status !== "COMPLETED")
        throw Error("SESSION_AI_PREVIOUS_OUTCOME_REQUIRES_REVIEW");
      return previous.result;
    }
    try {
      const generated = await runSessionAI(root, source, input, {
        transport: options.aiTransport ?? fetch,
        configuration: options.aiConfiguration,
        onProgress: async (progress) => {
          await s.pool.query(
            "UPDATE os_private.session_ai_jobs SET cost_usd=$2,cost_kind=$3,result=coalesce(result,'{}'::jsonb)||$4::jsonb WHERE id=$1",
            [
              input.request_id,
              progress.cost_usd,
              progress.cost_kind,
              progress.partial ? { partial: progress.partial } : {},
            ],
          );
        },
      });
      // Persist provider output before the final authorized save, so a changed
      // permission or source revision cannot destroy paid work.
      await s.pool.query(
        "UPDATE os_private.session_ai_jobs SET result=$2,cost_usd=$3,cost_kind=$4 WHERE id=$1",
        [
          input.request_id,
          { generated, source: { id: source.id, revision: source.revision } },
          generated.cost_usd,
          generated.cost_kind,
        ],
      );
      const current = await session(headers),
        record = await s.platform.saveSessionAI(
          current.actor,
          await s.directory(),
          input.firm,
          source.id,
          source.revision,
          generated.payload,
          input.request_id,
        ),
        result = {
          record,
          cost_usd: generated.cost_usd,
          cost_kind: generated.cost_kind,
        };
      await s.pool.query(
        "UPDATE os_private.session_ai_jobs SET status='COMPLETED',result=$2,finished_at=now() WHERE id=$1",
        [input.request_id, result],
      );
      return result;
    } catch (e) {
      await s.pool.query(
        "UPDATE os_private.session_ai_jobs SET status='INTERRUPTED',finished_at=now() WHERE id=$1",
        [input.request_id],
      );
      throw e;
    }
  }
  return {
    initialize,
    session,
    isEnabled,
    async authorizeFirm(headers, firm) {
      const s = await session(headers);
      await s.platform.command(
        s.actor,
        await s.directory(),
        `/firms/${firm}`,
        undefined,
        undefined,
      );
      return firm;
    },
    async recordingEvent(headers, room, event, data) {
      if (event === "STOP")
        return (await initialize()).platform.stopRecording(
          room,
          data.session_id,
        );
      const s = await session(headers);
      return s.platform.sessionRecord(s.actor, await s.directory(), {
        firm: room.law_firm_id,
        matter: room.matter_id,
        event,
        session_id: data.session_id,
        data,
      });
    },
    async managementTool(headers, firm, name, args, commandId) {
      const s = await session(headers);
      if (["transcribe_session", "session_minutes"].includes(name)) {
        const { managementSchemas } =
          await import("../dist/os-app/packages/workspace/src/management-tools.js");
        const input = managementSchemas[name].parse(args),
          directory = await s.directory();
        const view = await s.platform.command(
            s.actor,
            directory,
            `/firms/${firm}/practice`,
            undefined,
            undefined,
          ),
          record = view.data.records.find(
            (r) => r.id === input.session_id && r.payload.type === "SESSION",
          );
        if (!record) throw Error("ACCESS_DENIED");
        if (name === "session_minutes") {
          const combined = await s.platform.command(
            s.actor,
            directory,
            `/firms/${firm}/practice/combine_transcripts`,
            { session_id: record.id },
            commandId,
          );
          return prepareSessionAI(headers, {
            firm,
            record_id: combined.data.id,
            request_id: commandId,
            action: "MINUTES",
            budget_usd: input.budget_usd,
            wav_base64: null,
          });
        }
        const recordings = view.data.records
            .filter(
              (r) =>
                r.payload.type === "RECORDING" &&
                r.payload.session_id === record.id &&
                !r.payload.withdrawn_at,
            )
            .sort((a, b) => a.payload.sequence - b.payload.sequence),
          created = [],
          reused = [];
        if (!recordings.length) throw Error("SESSION_RECORDING_REQUIRED");
        let spent = 0;
        const childId = (id) => {
          const h = hash(commandId + ":" + id);
          return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
        };
        const previous = (
          await s.pool.query(
            "SELECT id,status,cost_usd FROM os_private.session_ai_jobs WHERE id=ANY($1::uuid[])",
            [recordings.map((r) => childId(r.id))],
          )
        ).rows;
        spent = previous.reduce((n, r) => n + Number(r.cost_usd), 0);
        for (const recording of recordings) {
          const existing = view.data.records.find(
            (t) =>
              t.payload.type === "TRANSCRIPT" &&
              t.payload.recording_ids.includes(recording.id),
          );
          if (existing) {
            reused.push(existing.id);
            continue;
          }
          const prior = previous.find((j) => j.id === childId(recording.id));
          if (prior && prior.status !== "COMPLETED")
            throw Error("SESSION_AI_PREVIOUS_OUTCOME_REQUIRES_REVIEW");
          const result = await prepareSessionAI(headers, {
            firm,
            record_id: recording.id,
            request_id: childId(recording.id),
            action: "TRANSCRIBE",
            budget_usd: input.budget_usd - spent,
            wav_base64: null,
          });
          spent += result.cost_usd;
          created.push(result.record.id);
        }
        return {
          session_id: record.id,
          created_transcripts: created,
          reused_transcripts: reused,
          cost_usd: spent,
          cost_kind: "ESTIMATED_FROM_DURATION",
          requires_human_review: true,
        };
      }
      const { managementRoute, managementResult } =
        await import("../dist/os-app/packages/workspace/src/management-tools.js");
      const route = managementRoute(firm, name, args);
      const result = await s.platform.command(
        s.actor,
        await s.directory(),
        route.path,
        route.body,
        commandId,
      );
      return managementResult(name, args, result.data);
    },
    onAccessChange(fn) {
      accessListeners.add(fn);
      return () => accessListeners.delete(fn);
    },
    async mergeCheckpoint(headers, result, roomId) {
      if (!(await isEnabled())) return;
      const s = await session(headers);
      await s.platform.mergeCheckpoint(
        s.actor,
        await s.directory(),
        result,
        roomId,
      );
    },
    async share(headers, access, target, readOnly) {
      if (!(await isEnabled())) return;
      const s = await session(headers),
        directory = await s.directory();
      if (!directory.some((p) => p.id === target))
        throw Error("WORKSPACE_ACCESS_DENIED");
      const current = (
        await s.platform.view(s.actor, directory)
      ).snapshot.tables.participants.find(
        (p) =>
          p.matter_id === access.room.matter_id &&
          p.identity_id === target &&
          p.active,
      );
      const permissions = [
        ...new Set([
          ...(current?.permissions ?? []),
          "READ",
          ...(!readOnly ? ["DRAFT_WRITE"] : []),
        ]),
      ];
      await s.platform.command(
        s.actor,
        directory,
        `/firms/${access.room.law_firm_id}/matters/${access.room.matter_id}/participants`,
        {
          identity_id: target,
          permissions,
        },
        randomUUID(),
      );
      await accessChanged();
    },
    authenticator: {
      async authenticate(id) {
        const s = await initialize(),
          p =
            (await s.directory()).find((p) => p.id === id) ??
            (!(await s.platform.configured())
              ? legacy.find((p) => p.id === id)
              : null);
        return p
          ? {
              identity_id: p.id,
              subject: p.id,
              session_id: "local-platform-internal",
              expires_at: "2999-01-01T00:00:00.000Z",
            }
          : null;
      },
      async identity(id) {
        const s = await initialize();
        return (
          (await s.directory()).find((p) => p.id === id) ??
          legacy.find((p) => p.id === id) ??
          ((await s.platform.configured())
            ? (await s.platform.raw()).identities?.find((p) => p.id === id)
            : null) ??
          null
        );
      },
    },
    async authorizeWorkspace(
      headers,
      token,
      roomId,
      repository,
      write = false,
    ) {
      if (!(await isEnabled())) return null;
      const s = await session(headers),
        access = await repository.access(token, roomId, write);
      if (access.grant.actor_id !== s.actor.id)
        throw Error("WORKSPACE_ACCESS_DENIED");
      await s.platform.grant(s.actor, access.room, write);
      return s.actor;
    },
    async workspaceSeed(headers, body) {
      if (!(await isEnabled())) return body;
      const s = await session(headers);
      return s.platform.seed(s.actor, await s.directory(), body);
    },
    async gate(req, res) {
      if (
        !req.url.startsWith("/local/") ||
        req.url.startsWith("/local/platform/") ||
        req.url.startsWith("/local/auth/")
      )
        return false;
      if (!(await isEnabled())) return false;
      try {
        const s = await session(req.headers);
        req.platformActor = s.actor.id;
        // Legacy full-board files predate per-case ownership. Keep them available to the installation owner.
        if (
          req.url.startsWith("/local/junta/case/") &&
          !(await s.platform.owner(s.actor.id))
        ) {
          send(res, 403, {
            error:
              "Los informes de la junta anterior requieren la cuenta titular. El trabajo por asunto está disponible desde el workspace.",
          });
          return true;
        }
        return false;
      } catch {
        send(res, 401, { error: "Iniciá sesión para continuar." });
        return true;
      }
    },
    async handle(req, res) {
      const path = new URL(req.url, origin).pathname;
      if (
        !path.startsWith("/local/platform/") &&
        !path.startsWith("/local/auth/") &&
        path !== "/local/portal"
      )
        return false;
      if (
        req.headers.host !== new URL(origin).host ||
        (req.headers.origin && req.headers.origin !== origin) ||
        (req.method !== "GET" && req.headers.origin !== origin)
      ) {
        send(res, 403, { error: "Origen local requerido." });
        return true;
      }
      try {
        // A surviving HTTP process may have lost its database after startup.
        // Readiness must recover the saved cluster, not reuse a stale ready flag.
        if (path === "/local/platform/status" && req.method === "GET" && !options.pool)
          await ensureWorkspaceDatabase(root);
        const s = await initialize();
        if (path.startsWith("/local/auth/")) {
          const permitted = [
            "sign-in/email",
            "sign-out",
            "get-session",
            "change-password",
          ];
          if (!permitted.some((p) => path === "/local/auth/" + p))
            throw Error("Registro público deshabilitado. Usá una invitación.");
          await s.nodeAuth(req, res);
          if (
            ["/local/auth/sign-out", "/local/auth/change-password"].includes(
              path,
            )
          )
            await accessChanged();
          return true;
        }
        let body = {};
        if (req.method !== "GET") {
          if (req.headers["x-platform"] !== "1")
            throw Error("Encabezado de operación requerido.");
          const chunks = [];
          let size = 0;
          for await (const b of req) {
            size += b.length;
            const limit =
              path === "/local/portal"
                ? 1024 * 1024
                : /\/(recording-upload|session-ai)$/.test(path)
                  ? 40 * 1024 * 1024
                  : /\/(core|activate)$/.test(path)
                    ? 256 * 1024 * 1024
                    : 128 * 1024;
            if (size > limit) throw Error("Solicitud demasiado grande.");
            chunks.push(b);
          }
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        }
        if (path === "/local/portal") {
          if (req.method !== "POST") throw Error("PORTAL_ACCESS_DENIED");
          const key = req.socket.remoteAddress ?? "unknown",
            now = Date.now(),
            rate = portalRates.get(key);
          if (rate && rate.until > now && rate.count >= 120)
            throw Error("PORTAL_RATE_LIMIT");
          portalRates.set(
            key,
            rate && rate.until > now
              ? { ...rate, count: rate.count + 1 }
              : { until: now + 60000, count: 1 },
          );
          for (const [address, value] of portalRates)
            if (value.until < now) portalRates.delete(address);
          const token = String(req.headers.authorization ?? "").replace(
            /^Bearer /,
            "",
          );
          send(res, 200, { data: await s.platform.portal(token, body) });
          return true;
        }
        const action = path.slice("/local/platform/".length);
        if (action === "status" && req.method === "GET") {
          send(res, 200, {
            enabled: await s.platform.configured(),
            storage: "POSTGRESQL_LOCAL",
            deadline_scheduler_running: !!deadlineTimer,
            registration: "INVITATION_ONLY",
          });
          return true;
        }
        if (action === "activate" && req.method === "POST") {
          const lock = await s.pool.connect();
          await lock.query("SELECT pg_advisory_lock(70614001)");
          try {
            if (await s.platform.configured())
              throw Error("La instalación ya está activada. Iniciá sesión.");
            if (typeof body.snapshot !== "string" && body.snapshot !== null)
              throw Error("Falta el estado original del navegador.");
            // Validate before touching the identity database. The original is retained separately.
            await s.platform.validateMigration(body.snapshot);
            const dir = resolve(
              root,
              ".local-dev/backups",
              "activation-" + randomUUID(),
            );
            await mkdir(dir, { recursive: true });
            if (body.snapshot)
              await writeFile(
                resolve(dir, "browser-original.json"),
                body.snapshot,
                { flag: "wx", mode: 0o600 },
              );
            let account;
            try {
              account = await s.auth.api.signUpEmail({
                body: {
                  email: body.email,
                  password: body.password,
                  name: body.name,
                },
              });
            } catch (e) {
              // Retry a setup interrupted after account creation only with its real password.
              if (e?.body?.code !== "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
                throw e;
              account = await s.auth.api.signInEmail({
                body: { email: body.email, password: body.password },
              });
            }
            const migration = await s.platform.activate(
              body.snapshot,
              person(account.user),
            );
            if (timer) void makeBackup(s).catch(() => {});
            send(res, 200, {
              activated: true,
              migration,
              requires_login: true,
            });
          } finally {
            await lock.query("SELECT pg_advisory_unlock(70614001)");
            lock.release();
          }
          return true;
        }
        if (action === "recover-account" && req.method === "POST") {
          if (
            typeof body.password !== "string" ||
            body.password.length < 12 ||
            body.password.length > 128 ||
            !/^[a-f0-9]{64}$/.test(body.token ?? "")
          )
            throw Error("RECOVERY_INVALID_OR_EXPIRED");
          const key = "recovery:" + (req.socket.remoteAddress ?? "unknown"),
            now = Date.now(),
            rate = portalRates.get(key);
          if (rate && rate.until > now && rate.count >= 10)
            throw Error("RECOVERY_RATE_LIMIT");
          portalRates.set(
            key,
            rate && rate.until > now
              ? { ...rate, count: rate.count + 1 }
              : { until: now + 60000, count: 1 },
          );
          const lock = await s.pool.connect();
          try {
            await lock.query("BEGIN");
            const recovery = (
              await lock.query(
                "SELECT * FROM os_private.platform_recovery WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL FOR UPDATE",
                [hash(body.token)],
              )
            ).rows[0];
            if (!recovery) throw Error("RECOVERY_INVALID_OR_EXPIRED");
            if (recovery.firm_id) {
              const creator = (await s.directory()).find(
                (p) => p.id === recovery.created_by,
              );
              if (!creator) throw Error("RECOVERY_INVALID_OR_EXPIRED");
              await s.platform.director(
                creator,
                await s.directory(),
                recovery.firm_id,
              );
            } else if (!(await s.platform.owner(recovery.user_id)))
              throw Error("RECOVERY_INVALID_OR_EXPIRED");
            const changed = await lock.query(
              'UPDATE os_auth.account SET password=$1,"updatedAt"=now() WHERE "userId"=$2 AND "providerId"=\'credential\'',
              [await hashPassword(body.password), recovery.user_id],
            );
            if (changed.rowCount !== 1)
              throw Error("RECOVERY_INVALID_OR_EXPIRED");
            await lock.query('DELETE FROM os_auth.session WHERE "userId"=$1', [
              recovery.user_id,
            ]);
            await lock.query(
              "UPDATE os_private.platform_recovery SET used_at=now() WHERE token_hash=$1",
              [hash(body.token)],
            );
            await lock.query("COMMIT");
            await accessChanged();
            send(res, 200, { recovered: true });
          } catch (e) {
            await lock.query("ROLLBACK");
            throw e;
          } finally {
            lock.release();
          }
          return true;
        }
        if (action === "accept-invitation" && req.method === "POST") {
          const lock = await s.pool.connect();
          try {
            await lock.query("BEGIN");
            const invite = (
              await lock.query(
                "SELECT * FROM os_private.platform_invitations WHERE token_hash=$1 AND expires_at>now() AND accepted_by IS NULL FOR UPDATE",
                [hash(String(body.token))],
              )
            ).rows[0];
            if (!invite)
              throw Error("La invitación venció o ya fue utilizada.");
            const actor = (await s.directory()).find(
              (p) => p.id === invite.created_by,
            );
            if (!actor) throw Error("La invitación fue retirada.");
            await s.platform.director(
              actor,
              await s.directory(),
              invite.firm_id,
            );
            let account;
            try {
              account = await s.auth.api.signUpEmail({
                body: {
                  email: invite.email,
                  password: body.password,
                  name: body.name,
                },
              });
            } catch (e) {
              if (e?.body?.code !== "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
                throw e;
              account = await s.auth.api.signInEmail({
                body: { email: invite.email, password: body.password },
              });
            }
            const h = hash(String(body.token));
            const command = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
            await s.platform.command(
              actor,
              await s.directory(),
              `/firms/${invite.firm_id}/memberships`,
              { identity_id: account.user.id, role: invite.role },
              command,
            );
            await lock.query(
              "UPDATE os_private.platform_invitations SET accepted_by=$2 WHERE token_hash=$1",
              [hash(String(body.token)), account.user.id],
            );
            await lock.query("COMMIT");
            send(res, 200, { accepted: true });
          } catch (e) {
            await lock.query("ROLLBACK");
            throw e;
          } finally {
            lock.release();
          }
          return true;
        }
        const a = await session(req.headers),
          directory = await s.directory();
        if (action === "state" && req.method === "GET")
          send(res, 200, await s.platform.view(a.actor, directory));
        else if (action === "core" && req.method === "POST") {
          if (
            typeof body.path !== "string" ||
            !body.path.startsWith("/") ||
            body.path.length > 1000
          )
            throw Error("Operación inválida.");
          const result = await s.platform.command(
            a.actor,
            directory,
            body.path,
            body.body,
            body.command_id,
            Number.isSafeInteger(body.known_revision)
              ? body.known_revision
              : undefined,
          );
          if (
            /\/(participants|memberships)(\/|$)/.test(body.path) &&
            body.body !== undefined
          )
            await accessChanged();
          send(res, 200, result);
        } else if (action === "administration" && req.method === "GET") {
          const owner = await s.platform.owner(a.actor.id);
          const view = await s.platform.view(a.actor, directory);
          const directorFirms = view.snapshot.tables.memberships
            .filter(
              (m) =>
                m.active &&
                m.identity_id === a.actor.id &&
                m.role === "ADMINISTRATOR",
            )
            .map((m) => m.law_firm_id);
          send(res, 200, {
            owner,
            director_firms: directorFirms,
            accounts: directory.filter((p) =>
              view.snapshot.tables.memberships.some(
                (m) =>
                  m.active &&
                  m.identity_id === p.id &&
                  directorFirms.includes(m.law_firm_id),
              ),
            ),
            ...(owner
              ? {
                  accounts: directory,
                  backups: await recentBackups(),
                  daily_backup: true,
                  backup_error: backupError,
                  deadline_error: deadlineError,
                  operations: await operationsStatus(root),
                  backup_progress: await readFile(
                    resolve(root, ".local-dev/backup-progress.json"),
                    "utf8",
                  )
                    .then(JSON.parse)
                    .catch(() => null),
                }
              : {}),
          });
        } else if (action === "invite" && req.method === "POST") {
          const { z } = await import("zod");
          const input = z
            .object({
              email: z.email(),
              firm_id: z.string().min(1),
              role: z.enum(["LAWYER", "ADMINISTRATOR"]),
            })
            .strict()
            .parse(body);
          await s.platform.director(a.actor, directory, input.firm_id);
          const view = await s.platform.view(a.actor, directory);
          if (
            !view.snapshot.tables.lawFirms.some((f) => f.id === input.firm_id)
          )
            throw Error("Estudio no disponible.");
          const token = randomBytes(32).toString("hex");
          await s.pool.query(
            "INSERT INTO os_private.platform_invitations(token_hash,email,firm_id,role,expires_at,created_by) VALUES($1,$2,$3,$4,now()+interval '48 hours',$5)",
            [hash(token), input.email, input.firm_id, input.role, a.actor.id],
          );
          send(res, 200, {
            link: origin + "/#invitation=" + token,
            expires_in_hours: 48,
          });
        } else if (action === "management" && req.method === "POST") {
          const { z } = await import("zod"),
            input = z
              .object({
                firm: z.uuid(),
                name: z.enum(["transcribe_session", "session_minutes"]),
                args: z.record(z.string(), z.unknown()),
                command_id: z.uuid(),
              })
              .strict()
              .parse(body);
          send(res, 200, {
            data: await this.managementTool(
              req.headers,
              input.firm,
              input.name,
              input.args,
              input.command_id,
            ),
          });
        } else if (action === "session-ai-history" && req.method === "POST") {
          await s.platform.grant(
            a.actor,
            { law_firm_id: body.firm, matter_id: body.matter_id },
            false,
          );
          send(res, 200, {
            jobs: (
              await s.pool.query(
                "SELECT id,status,result,cost_usd,cost_kind,created_at FROM os_private.session_ai_jobs WHERE firm_id=$1 AND matter_id=$2 ORDER BY created_at DESC LIMIT 100",
                [body.firm, body.matter_id],
              )
            ).rows,
          });
        } else if (action === "session-ai-recover" && req.method === "POST") {
          if (!/^[a-f0-9-]{36}$/.test(body.job_id ?? ""))
            throw Error("INVALID_JOB_ID");
          const job = (
            await s.pool.query(
              "SELECT * FROM os_private.session_ai_jobs WHERE id=$1",
              [body.job_id],
            )
          ).rows[0];
          if (!job) throw Error("ACCESS_DENIED");
          await s.platform.grant(
            a.actor,
            { law_firm_id: job.firm_id, matter_id: job.matter_id },
            true,
          );
          if (job.status === "COMPLETED") {
            send(res, 200, job.result);
            return true;
          }
          if (!job.result?.generated || !job.result?.source)
            throw Error("SESSION_AI_RESULT_NOT_AVAILABLE_NO_AUTOMATIC_RETRY");
          const result = await s.platform.saveSessionAI(
              a.actor,
              directory,
              job.firm_id,
              job.result.source.id,
              job.result.source.revision,
              job.result.generated.payload,
              job.id,
            ),
            output = {
              record: result,
              cost_usd: Number(job.cost_usd),
              cost_kind: job.cost_kind,
            };
          await s.pool.query(
            "UPDATE os_private.session_ai_jobs SET status='COMPLETED',result=$2,finished_at=now() WHERE id=$1",
            [job.id, output],
          );
          send(res, 200, output);
        } else if (action === "cost-metrics" && req.method === "POST") {
          await s.platform.director(a.actor, directory, body.firm);
          const sessions = (
            await s.pool.query(
              "SELECT coalesce(sum(cost_usd) FILTER(WHERE status='COMPLETED'),0) estimated,coalesce(sum(cost_usd) FILTER(WHERE status<>'COMPLETED'),0) uncertain FROM os_private.session_ai_jobs WHERE firm_id=$1",
              [body.firm],
            )
          ).rows[0];
          const workspace = (
            await s.pool.query(
              "SELECT coalesce(sum(j.reserved_usd),0) reserved FROM os_private.workspace_jobs j JOIN os_private.workspace_documents d ON d.id=j.room_id WHERE d.law_firm_id=$1",
              [body.firm],
            )
          ).rows[0];
          let gabrielVoice = 0,
            gabrielText = 0,
            unattributed = 0;
          for (const name of await readdir(
            resolve(root, ".local-dev/gabriel"),
          ).catch(() => []))
            if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
              const ledger = await readFile(
                resolve(root, ".local-dev/gabriel", name),
                "utf8",
              )
                .then(JSON.parse)
                .catch(() => null);
              for (const r of Object.values(ledger?.requests ?? {})) {
                const cost = Number(r.retained_usd ?? r.reserve_usd ?? 0);
                if (Number.isFinite(cost)) {
                  if (r.firm_id === body.firm) gabrielText += cost;
                  else if (!r.firm_id) unattributed += cost;
                }
              }
            }
          for (const name of await readdir(
            resolve(root, ".local-dev/gabriel/realtime"),
          ).catch(() => []))
            if (/^[a-f0-9-]{36}\.json$/.test(name)) {
              const r = await readFile(
                  resolve(root, ".local-dev/gabriel/realtime", name),
                  "utf8",
                )
                  .then(JSON.parse)
                  .catch(() => null),
                cost = Number(r?.estimated_usd ?? 0);
              if (Number.isFinite(cost)) {
                if (r?.firm_id === body.firm) gabrielVoice += cost;
                else if (!r?.firm_id) unattributed += cost;
              }
            }
          send(res, 200, {
            session_estimated_usd: Number(sessions.estimated),
            session_uncertain_usd: Number(sessions.uncertain),
            workspace_reserved_usd: Number(workspace.reserved),
            gabriel_voice_estimated_usd: gabrielVoice,
            gabriel_text_retained_usd: gabrielText,
            ...((await s.platform.owner(a.actor.id))
              ? { unattributed_historical_usd: unattributed }
              : {}),
            refreshed_at: new Date().toISOString(),
          });
        } else if (action === "session-ai" && req.method === "POST") {
          send(res, 200, await prepareSessionAI(req.headers, body));
        } else if (action === "recording-upload" && req.method === "POST") {
          const { z } = await import("zod"),
            input = z
              .object({
                firm: z.uuid(),
                session_id: z.uuid(),
                capture_id: z.uuid(),
                sequence: z.number().int().nonnegative(),
                mime: z.enum(["audio/webm", "audio/ogg", "audio/wav"]),
                base64: z.string().max(34 * 1024 * 1024),
              })
              .strict()
              .parse(body);
          const view = await s.platform.command(
              a.actor,
              directory,
              `/firms/${input.firm}/practice`,
              undefined,
              undefined,
            ),
            record = view.data.records.find(
              (r) => r.id === input.session_id && r.payload.type === "SESSION",
            );
          if (
            !record ||
            record.payload.recorder_id !== a.actor.id ||
            record.payload.capture_id !== input.capture_id
          )
            throw Error("ACCESS_DENIED");
          const bytes = Buffer.from(input.base64, "base64"),
            magic = bytes.subarray(0, 4).toString("hex");
          if (
            !bytes.length ||
            bytes.length > 24 * 1024 * 1024 ||
            !(
              {
                "audio/webm": "1a45dfa3",
                "audio/ogg": "4f676753",
                "audio/wav": "52494646",
              }[input.mime] === magic
            )
          )
            throw Error("INVALID_AUDIO_RECORDING");
          const digest = hash(bytes),
            object_key = `${input.firm}/${input.session_id}/${input.capture_id}/${input.sequence}-${digest}.audio`,
            file = resolve(root, ".local-dev/session-recordings", object_key);
          await mkdir(resolve(file, ".."), { recursive: true });
          await writeFile(file, bytes, { flag: "wx", mode: 0o600 }).catch(
            (e) => {
              if (e.code !== "EEXIST") throw e;
            },
          );
          const result = await s.platform.sessionRecord(a.actor, directory, {
            firm: input.firm,
            matter: record.matter_id,
            event: "UPLOAD",
            session_id: input.session_id,
            data: { ...input, sha256: digest, bytes: bytes.length, object_key },
          });
          send(res, 200, { id: result.id });
        } else if (action === "recording-download" && req.method === "POST") {
          const view = await s.platform.command(
              a.actor,
              directory,
              `/firms/${String(body.firm)}/practice`,
              undefined,
              undefined,
            ),
            record = view.data.records.find(
              (r) =>
                r.id === body.recording_id &&
                r.payload.type === "RECORDING" &&
                !r.payload.withdrawn_at,
            );
          if (!record) throw Error("ACCESS_DENIED");
          const bytes = await readFile(
            resolve(
              root,
              ".local-dev/session-recordings",
              record.payload.object_key,
            ),
          );
          if (hash(bytes) !== record.payload.sha256)
            throw Error("RECORDING_INTEGRITY_FAILED");
          send(res, 200, {
            mime: record.payload.mime,
            base64: bytes.toString("base64"),
          });
        } else if (action === "recovery-link" && req.method === "POST") {
          await s.platform.director(a.actor, directory, body.firm_id);
          const view = await s.platform.view(a.actor, directory);
          if (
            !view.snapshot.tables.memberships.some(
              (m) =>
                m.law_firm_id === body.firm_id &&
                m.identity_id === body.user_id &&
                m.active,
            ) ||
            !directory.some((p) => p.id === body.user_id)
          )
            throw Error("ACCESS_DENIED");
          const token = randomBytes(32).toString("hex");
          await s.pool.query(
            "INSERT INTO os_private.platform_recovery(token_hash,user_id,created_by,firm_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 minutes')",
            [hash(token), body.user_id, a.actor.id, body.firm_id],
          );
          send(res, 200, {
            link: origin + "/#recovery=" + token,
            expires_in_minutes: 30,
          });
        } else if (action === "operations" && req.method === "POST") {
          await ensureOwner(a);
          if (body.action === "external-backup") {
            await saveOperations(root, {
              external_backup: body.destination
                ? await validateExternalDestination(root, body.destination)
                : null,
            });
            send(res, 200, { configured: true });
          } else if (body.action === "copy-backup")
            send(res, 200, await copyExternalBackup(root, body.id));
          else if (body.action === "network" && options.configureNetwork) {
            send(res, 200, await options.configureNetwork(body));
          } else throw Error("OPERATIONS_ACTION_UNAVAILABLE");
        } else if (action === "ca-certificate" && req.method === "GET") {
          await ensureOwner(a);
          res.writeHead(200, {
            "Content-Type": "application/x-x509-ca-cert",
            "Content-Disposition":
              "attachment; filename=law-order-study-ca.crt",
            "Cache-Control": "no-store",
          });
          res.end(await readFile(resolve(root, ".local-dev/tls/study-ca.crt")));
        } else if (action === "backup" && req.method === "POST") {
          await ensureOwner(a);
          send(res, 200, await makeBackup(s));
        } else if (action === "restore-check" && req.method === "POST") {
          await ensureOwner(a);
          if (!/^platform-[a-zA-Z0-9-]+$/.test(body.id ?? ""))
            throw Error("Respaldo inválido.");
          send(
            res,
            200,
            await restorePlatformBackup(
              root,
              resolve(root, ".local-dev/backups", body.id),
              s.pool,
              s.config,
            ),
          );
        } else throw Error("Operación no disponible.");
      } catch (error) {
        options.onError?.(error);
        send(
          res,
          error?.status === 401
            ? 401
            : error?.status === 503 || ["57P03", "ECONNREFUSED", "ECONNRESET", "57P01"].includes(error?.code)
              ? 503
              : 400,
          {
            error:
              error?.code === "23505"
                ? "La cuenta o instalación ya existe."
                : (error?.body?.message ??
                  (error instanceof Error &&
                  !/^\d|password|postgres|SELECT |INSERT |UPDATE |relation |column |ECONN/i.test(
                    error.message,
                  )
                    ? error.message
                    : "No se pudo completar la operación local.")),
          },
        );
      }
      return true;
    },
    startBackups() {
      const deadlines = () => {
        if (deadlineTick) return;
        deadlineTick = initialize()
          .then(async (s) => {
            await s.platform.tickDeadlines();
            deadlineError = null;
          })
          .catch((error) => {
            deadlineError =
              "El programador de avisos requiere revisión. Los avisos se recuperarán al restablecer el servidor.";
            options.onError?.(error);
          })
          .finally(() => {
            deadlineTick = null;
          });
      };
      deadlineTimer = setInterval(deadlines, 60000);
      deadlineTimer.unref();
      deadlines();
      const check = async () => {
        try {
          const s = await initialize();
          if (!(await s.platform.configured())) return;
          // After a failed attempt wait 6 hours before the automatic retry.
          if (Date.now() - lastBackupFailure < 6 * 3600000) return;
          await pruneIncompleteBackups();
          const latest = (await recentBackups())[0];
          if (!latest || Date.now() - Date.parse(latest.created_at) > 86400000)
            await makeBackup(s);
        } catch {
          backupError =
            "El respaldo automático requiere revisión. Podés reintentarlo desde Administración.";
        }
      };
      timer = setInterval(() => void check(), 3600000);
      timer.unref();
      void check();
    },
    async close() {
      clearInterval(timer);
      clearInterval(deadlineTimer);
      if (deadlineTick) await deadlineTick;
      if (backup) await backup.catch(() => {});
      if (ready) {
        const s = await ready;
        await s.authPool.end();
        if (!options.pool) await s.pool.end();
      }
    },
  };
}
