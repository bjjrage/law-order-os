import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { createHash } from "node:crypto";
import { Hocuspocus } from "@hocuspocus/server";
import { WebSocketServer } from "ws";
import { TiptapTransformer } from "@hocuspocus/transformer";
import * as Y from "yjs";
import { ensureWorkspaceDatabase } from "./workspace-runtime.mjs";
import { runWorkspaceAI } from "./workspace-ai.mjs";
import { assertQualityManifest } from "./workspace-quality.mjs";
import { createWorkspaceCall } from "./workspace-call.mjs";
import {
  workspaceErrorCode,
  workspaceFailureContext,
} from "./workspace-failure.mjs";

const uuid = (value) =>
  typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const tokenOf = (req) =>
  (req.headers.authorization ?? "").replace(/^Bearer /, "");
const safeMessage = workspaceErrorCode;
export function createWorkspaceBridge(root, origin, options = {}) {
  let ready;
  const queues = new Map();
  let hocus;
  let closing;
  let wsServer;
  const messages = new Set();
  const denyConnection = (connection) => {
    connection.sendStateless(JSON.stringify({ kind: "access_revoked" }));
    connection.webSocket.close(4403, "WORKSPACE_ACCESS_DENIED");
  };
  const stopAccessListener = options.platform?.onAccessChange(async () => {
    if (!hocus || closing) return;
    const repository = await initialize();
    for (const [id, document] of hocus.documents)
      for (const connection of [...document.connections.keys()]) {
        try {
          const c = connection.context;
          await options.platform.authorizeWorkspace(
            c.requestHeaders,
            c.token,
            id,
            repository,
            !c.grant.read_only,
          );
        } catch {
          denyConnection(connection);
        }
      }
  });
  const call = createWorkspaceCall(async (token, room, context) => {
    const repository = await initialize();
    const identity = await options.platform?.authorizeWorkspace(
      context?.requestHeaders,
      token,
      room,
      repository,
    );
    return { ...(await repository.access(token, room)), identity };
  },{recording:async (context,access,event,data)=>{
    if(!options.platform?.recordingEvent)throw Error("RECORDING_REQUIRES_CENTRAL_ACCOUNTS");
    return options.platform.recordingEvent(context.requestHeaders,access.room,event,data);
  }});
  const disconnectRoom = (id, actor) => {
    call.revoke(id, actor);
    const document = hocus?.documents.get(id);
    for (const connection of [...(document?.connections.keys() ?? [])]) {
      if (actor && connection.context?.grant?.actor_id !== actor) continue;
      if (actor)
        connection.sendStateless(JSON.stringify({ kind: "access_revoked" }));
      connection.webSocket.close(
        actor ? 4403 : 4205,
        actor ? "Access revoked" : "Workspace reconnect required",
      );
    }
  };
  const initialize = () =>
    (ready ??= (async () => {
      let repository = options.repository;
      if (!repository) {
        await ensureWorkspaceDatabase(root);
        const config = JSON.parse(
          await readFile(resolve(root, ".local-dev/app-config.json"), "utf8"),
        );
        for (const value of [config.database_url, config.auth_database_url]) {
          const url = new URL(value);
          if (url.hostname !== "127.0.0.1" || url.port !== "55432")
            throw Error("WORKSPACE_LOCAL_DATABASE_REQUIRED");
        }
        const { WorkspaceRepository, LocalWorkspaceBlobs } =
          await import("../dist/os-app/apps/api/src/workspace.js");
        const owner = new Pool({
          connectionString: config.auth_database_url,
          max: 5,
          connectionTimeoutMillis: 5000,
        });
        const runtime = new Pool({
          connectionString: config.database_url,
          max: 5,
          connectionTimeoutMillis: 5000,
        });
        repository = new WorkspaceRepository(
          owner,
          runtime,
          new LocalWorkspaceBlobs(
            resolve(root, ".local-dev/workspace-objects"),
          ),
          options.platform?.authenticator,
        );
      }
      await repository.initialize();
      hocus = new Hocuspocus({
        name: "law-order-local-workspace",
        maxPendingDocuments: 4,
        maxUnauthenticatedQueueSize: 2 * 1024 * 1024,
        async onAuthenticate({
          documentName,
          token,
          connectionConfig,
          requestHeaders,
        }) {
          if (!uuid(documentName)) throw Error("WORKSPACE_ACCESS_DENIED");
          const access = await repository.access(token, documentName);
          const identity = await options.platform?.authorizeWorkspace(
            requestHeaders,
            token,
            documentName,
            repository,
          );
          connectionConfig.readOnly = access.grant.read_only;
          return { ...access, token, requestHeaders, identity };
        },
        async onLoadDocument({ documentName, context }) {
          const state = await repository.load(context.token, documentName);
          const doc = new Y.Doc();
          Y.applyUpdate(doc, state.y_state);
          return doc;
        },
        async beforeHandleMessage({
          context,
          documentName,
          update,
          connection,
        }) {
          if (update.byteLength > 2 * 1024 * 1024)
            throw Error("WORKSPACE_SIZE_LIMIT");
          try {
            await repository.access(context.token, documentName);
            await options.platform?.authorizeWorkspace(
              context.requestHeaders,
              context.token,
              documentName,
              repository,
            );
          } catch (error) {
            denyConnection(connection);
            throw error;
          }
        },
        async beforeSync({ context, documentName, type, payload, connection }) {
          let write = type === 1 || type === 2;
          if (write && context.grant.read_only) {
            const update = Y.decodeUpdate(payload);
            write = update.structs.length > 0 || update.ds.clients.size > 0;
          }
          try {
            await repository.access(context.token, documentName, write);
            await options.platform?.authorizeWorkspace(
              context.requestHeaders,
              context.token,
              documentName,
              repository,
              write,
            );
          } catch (error) {
            denyConnection(connection);
            throw error;
          }
        },
        async beforeHandleAwareness({ context, states }) {
          // User identity is supplied by the local server grant, never by a cursor name.
          for (const state of states.values())
            state.user = {
              name:
                context.identity?.display_name ??
                (context.grant.actor_id === "local-administrator"
                  ? "Administrador local"
                  : "Abogado local"),
              color:
                context.grant.actor_id === "local-administrator"
                  ? "#245b70"
                  : "#96733a",
            };
        },
        async onChange({ document, documentName, context }) {
          if (!context?.grant || document.isLoading) return;
          const bytes = Y.encodeStateAsUpdate(document),
            vector = Y.encodeStateVector(document);
          const rich = TiptapTransformer.fromYdoc(document, "default");
          const pending = (queues.get(documentName) ?? Promise.resolve())
            .catch(() => {})
            .then(async () => {
              try {
                const receipt = await repository.save(
                  context.grant,
                  context.room,
                  bytes,
                  vector,
                  rich,
                );
                document.broadcastStateless(JSON.stringify(receipt));
              } catch (error) {
                document.broadcastStateless(
                  JSON.stringify({
                    kind: "save_error",
                    code: safeMessage(error),
                  }),
                );
                disconnectRoom(documentName);
                throw error;
              }
            });
          queues.set(documentName, pending);
          try {
            await pending;
          } catch {
            /* Client remains dirty; no durable acknowledgment. */
          } finally {
            if (queues.get(documentName) === pending)
              queues.delete(documentName);
          }
        },
        async onStateless({ connection, documentName, payload }) {
          await options.platform?.authorizeWorkspace(
            connection.context.requestHeaders,
            connection.context.token,
            documentName,
            repository,
          );
          if (payload !== "durable-status") {
            await call.handle(documentName, connection, payload);
            return;
          }
          const context = connection.context;
          connection.sendStateless(
            JSON.stringify(
              await repository.receipt(context.token, documentName),
            ),
          );
        },
      });
      return repository;
    })().catch((error) => {
      ready = undefined;
      throw error;
    }));
  const send = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  };
  return {
    async handle(req, res) {
      const url = new URL(req.url, origin);
      if (!url.pathname.startsWith("/local/workspace/")) return false;
      if (closing) {
        send(res, 503, { error: "WORKSPACE_RESTARTING" });
        return true;
      }
      if (
        req.headers.host !== new URL(origin).host ||
        (req.headers.origin && req.headers.origin !== origin) ||
        (req.method !== "GET" &&
          (req.headers.origin !== origin || req.headers["x-workspace"] !== "1"))
      ) {
        send(res, 403, { error: "WORKSPACE_LOCAL_ORIGIN_REQUIRED" });
        return true;
      }
      try {
        const repository = await initialize();
        let body = {};
        if (req.method === "POST") {
          const chunks = [];
          let length = 0;
          for await (const chunk of req) {
            length += chunk.length;
            if (length > 2 * 1024 * 1024) throw Error("WORKSPACE_SIZE_LIMIT");
            chunks.push(chunk);
          }
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        }
        if (req.method === "GET" && url.pathname.endsWith("/status")) {
          send(res, 200, {
            ready: true,
            storage: "POSTGRESQL_LOCAL",
            identity: (await options.platform?.isEnabled())
              ? "AUTHENTICATED_LOCAL_ACCOUNTS"
              : "LOCAL_UNAUTHENTICATED_PROFILES",
            jev_output: false,
          });
          return true;
        }
        if (req.method === "POST" && url.pathname.endsWith("/adopt")) {
          const seed = options.platform
            ? await options.platform.workspaceSeed(req.headers, body)
            : body;
          send(res, 200, await repository.adopt(seed));
          return true;
        }
        const parts = url.pathname.split("/"),
          id = parts[4],
          action = parts[5];
        if (!uuid(id) || parts[3] !== "rooms")
          throw Error("WORKSPACE_NOT_FOUND");
        const token = tokenOf(req);
        const identity = await options.platform?.authorizeWorkspace(
          req.headers,
          token,
          id,
          repository,
          req.method === "POST" && action !== "director-read",
        );
        if (req.method === "GET" && !action) {
          const access = await repository.access(token, id);
          send(res, 200, {
            room: access.room,
            token,
            actor_id: access.grant.actor_id,
            display_name:
              identity?.display_name ??
              (access.grant.actor_id === "local-administrator"
                ? "Administrador local"
                : "Abogado local"),
            read_only: access.grant.read_only,
            can_manage:
              !access.grant.read_only &&
              (await repository.canManage(access.grant.actor_id, access.room)),
          });
        } else if (req.method === "GET" && action === "receipt")
          send(res, 200, await repository.receipt(token, id));
        else if (req.method === "GET" && action === "notes")
          send(res, 200, await repository.notes(token, id));
        else if (req.method === "POST" && action === "director-read")
          send(res, 200, await repository.directorRead(token, id, body));
        else if (req.method === "POST" && action === "review-decision") {
          await (queues.get(id) ?? Promise.resolve());
          send(res, 200, await repository.reviewDecision(token, id, body));
        } else if (req.method === "POST" && action === "comment")
          send(res, 200, await repository.addComment(token, id, body));
        else if (
          req.method === "POST" &&
          action === "resolve-comment" &&
          uuid(body.comment_id)
        )
          send(
            res,
            200,
            await repository.resolveComment(token, id, body.comment_id),
          );
        else if (
          req.method === "POST" &&
          ["task", "director-task"].includes(action)
        ) {
          await (queues.get(id) ?? Promise.resolve());
          const { job, fresh } = await repository.beginTask(token, id, body);
          const execution = (async () => {
            if (fresh) {
              try {
                await repository.progressTask(job, {
                  summary: "Gabriel está leyendo tu pedido.",
                  findings: [],
                  replacement_text: null,
                  references: [],
                  limitations: [],
                  sources: [],
                  citation_check: [],
                  semantic_check: "NOT_PERFORMED",
                  simulated: job.request.execution_mode === "OFFLINE_TEST",
                  jev_output: false,
                });
                const result = await (options.runAI ?? runWorkspaceAI)(
                  root,
                  job,
                  undefined,
                  (partial) => repository.progressTask(job, partial),
                  job.request.max_cost_usd,
                  undefined,
                  {
                    ...(identity
                      ? {
                          manageTool: async (tool, args, callId) => {
                            try {
                              await options.platform.authorizeWorkspace(
                                req.headers,
                                token,
                                id,
                                repository,
                                true,
                              );
                              const { room } = await repository.access(
                                token,
                                id,
                              );
                              const hex = createHash("sha256")
                                .update(`${job.id}:${callId}`)
                                .digest("hex")
                                .slice(0, 32);
                              const commandId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
                              return {
                                ok: true,
                                data: await options.platform.managementTool(
                                  req.headers,
                                  room.law_firm_id,
                                  tool,
                                  args,
                                  commandId,
                                ),
                              };
                            } catch (error) {
                              return {
                                ok: false,
                                error: error.code ?? error.message,
                              };
                            }
                          },
                        }
                      : {}),
                    readSavedWork: (tool, args) =>
                      repository.savedWork(token, id, tool, args),
                  },
                );
                assertQualityManifest(result);
                await repository.finishTask(job, result);
              } catch (error) {
                await repository.finishTask(
                  job,
                  null,
                  safeMessage(error),
                  error?.diagnostics,
                  workspaceFailureContext(error, "EXECUTION"),
                );
              }
            }
          })();
          if (action === "director-task") {
            // Acknowledge only after permission, snapshot, budget reservation and
            // durable job creation. The existing runtime records every outcome.
            void execution.catch(() => {});
            send(res, 202, job);
            return true;
          }
          await execution;
          send(
            res,
            200,
            (await repository.notes(token, id)).jobs.find(
              (j) => j.id === job.id,
            ),
          );
        } else if (req.method === "GET" && action === "history")
          send(res, 200, await repository.history(token, id));
        else if (
          req.method === "GET" &&
          action === "versions" &&
          uuid(parts[6])
        )
          send(res, 200, await repository.version(token, id, parts[6]));
        else if (
          req.method === "POST" &&
          action === "checkpoint" &&
          uuid(body.command_id) &&
          /^[a-f0-9]{64}$/.test(body.state_hash ?? "")
        ) {
          await (queues.get(id) ?? Promise.resolve());
          const checkpoint = await repository.checkpoint(
            token,
            id,
            body.command_id,
            body.state_hash,
          );
          await options.platform?.mergeCheckpoint(req.headers, checkpoint, id);
          send(res, 200, checkpoint);
        } else if (
          req.method === "POST" &&
          action === "share" &&
          (["local-administrator", "local-lawyer"].includes(body.actor_id) ||
            uuid(body.actor_id)) &&
          typeof body.read_only === "boolean"
        ) {
          await options.platform?.share(
            req.headers,
            await repository.access(token, id),
            body.actor_id,
            body.read_only,
          );
          send(
            res,
            200,
            await repository.share(token, id, body.actor_id, body.read_only),
          );
        } else if (
          req.method === "POST" &&
          action === "revoke" &&
          (["local-administrator", "local-lawyer"].includes(body.actor_id) ||
            uuid(body.actor_id))
        ) {
          await repository.revoke(token, id, body.actor_id);
          disconnectRoom(id, body.actor_id);
          send(res, 200, { revoked: true });
        } else send(res, 404, { error: "WORKSPACE_NOT_FOUND" });
      } catch (error) {
        const code = safeMessage(error);
        const status = /DENIED|UNAUTHENTICATED|FORBIDDEN/.test(code)
          ? 403
          : /CONFLICT/.test(code)
            ? 409
            : /NOT_FOUND/.test(code)
              ? 404
              : /SIZE_LIMIT/.test(code)
                ? 413
                : /Zod|Syntax/.test(error?.name ?? "")
                  ? 422
                  : 503;
        send(res, status, { error: code });
      }
      return true;
    },
    attach(server) {
      wsServer = new WebSocketServer({
        noServer: true,
        maxPayload: 2 * 1024 * 1024,
      });
      server.on("upgrade", async (req, socket, head) => {
        if (closing) {
          socket.destroy();
          return;
        }
        if (
          new URL(req.url, origin).pathname !== "/local/workspace/socket" ||
          req.headers.host !== new URL(origin).host ||
          req.headers.origin !== origin
        ) {
          socket.destroy();
          return;
        }
        try {
          await initialize();
          if (await options.platform?.isEnabled())
            await options.platform.session(req.headers);
          wsServer.handleUpgrade(req, socket, head, (ws) => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers))
              if (value)
                headers.set(
                  key,
                  Array.isArray(value) ? value.join(",") : value,
                );
            const client = hocus.handleConnection(
              ws,
              new Request(new URL(req.url, origin), { headers }),
            );
            ws.on("message", (data) => {
              const pending = Promise.resolve(
                client.handleMessage(new Uint8Array(data)),
              );
              messages.add(pending);
              void pending
                .catch(() => {})
                .finally(() => messages.delete(pending));
            });
            ws.on("close", (code, reason) =>
              client.handleClose({ code, reason: reason.toString() }),
            );
            ws.on("pong", () => client.touch());
            ws.on("error", () => client.handleClose());
          });
        } catch {
          socket.destroy();
        }
      });
    },
    close() {
      return (closing ??= (async () => {
        stopAccessListener?.();
        await call.close();
        if (hocus) {
          hocus.closeConnections();
          for (const ws of wsServer?.clients ?? []) ws.terminate();
          await Promise.allSettled([...messages]);
          await Promise.allSettled([...queues.values()]);
          hocus.flushPendingStores();
          await Promise.allSettled(
            [...hocus.documents.values()].map((document) =>
              hocus.unloadDocument(document),
            ),
          );
          await hocus.hooks("onDestroy", { instance: hocus });
        }
        if (wsServer) await new Promise((done) => wsServer.close(() => done()));
        if (ready) await (await ready).close();
      })());
    },
  };
}
