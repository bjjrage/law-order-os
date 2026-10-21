import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import * as Y from "yjs";
import { getSchema, type JSONContent } from "@tiptap/core";
import { TiptapTransformer } from "@hocuspocus/transformer";
import {
  PostgresPersistence,
  type BlobStore,
} from "../../../packages/persistence-postgres/src/index.js";
import { OsCoreService } from "../../../os-core/src/service.js";
import { Authorization } from "../../../os-core/src/authorization.js";
import {
  CoreError,
  type Authenticator,
  type AuthenticatedPrincipal,
  type TableName,
} from "../../../os-core/src/contracts.js";
import { workspaceExtensions } from "../../../packages/workspace/src/extensions.js";
import { reviewText } from "../../../packages/workspace/src/review-marks.js";
import { workspaceSql } from "../../../packages/workspace/src/schema.js";
import { z } from "zod";
import {
  WorkspaceTaskSchema,
  WorkspacePlanSchema,
  validTeamPlan,
  canResumeIntegration,
  WorkspaceAnalysisSchema,
  WorkspaceProviderFailureSchema,
  WorkspaceFailureContextSchema,
  WorkspaceAgentToolSchemas,
  hasWorkspaceAnalysis,
  type WorkspaceJob,
} from "../../../packages/workspace/src/tasks.js";
import {
  WorkspaceSeedSchema,
  localNames,
  MAX_WORKSPACE_BYTES,
  textDocument,
  documentText,
  toBase64,
  deletionRanges,
  type LocalProfile,
  type WorkspaceRoom,
  type WorkspaceAccess,
  type DurableReceipt,
} from "../../../packages/workspace/src/model.js";

const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const schema = getSchema(workspaceExtensions());
const principal = (id: LocalProfile): AuthenticatedPrincipal => ({
  identity_id: id,
  subject: id,
  session_id: "local-workspace-profile",
  expires_at: "2999-01-01T00:00:00.000Z",
});
/** Existing unauthenticated prototype profiles. Never used by Supabase/server mode. */
const localAuthenticator: Authenticator = {
  async authenticate(id) {
    return id in localNames ? principal(id as LocalProfile) : null;
  },
  async identity(id) {
    return id in localNames
      ? {
          id,
          subject: id,
          display_name: localNames[id as LocalProfile]!,
          active: true,
        }
      : null;
  },
};
export class LocalWorkspaceBlobs implements BlobStore {
  constructor(private readonly root: string) {}
  private file(key: string) {
    return resolve(this.root, digest(key));
  }
  async writeOnce(key: string, bytes: Uint8Array) {
    await mkdir(this.root, { recursive: true });
    try {
      await writeFile(this.file(key), bytes, { flag: "wx" });
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EEXIST" ||
        digest(await readFile(this.file(key))) !== digest(bytes)
      )
        throw error;
    }
  }
  async read(key: string) {
    return readFile(this.file(key));
  }
}
export interface WorkspaceGrant {
  token_hash: string;
  room_id: string;
  actor_id: LocalProfile;
  read_only: boolean;
}

export class WorkspaceRepository {
  private readonly hostId = randomUUID();
  readonly persistence: PostgresPersistence;
  readonly core: OsCoreService;
  private readonly authorization = new Authorization();
  constructor(
    readonly owner: Pool,
    readonly runtime: Pool,
    readonly blobs: BlobStore,
    private readonly identities: Authenticator = localAuthenticator,
  ) {
    this.persistence = new PostgresPersistence(runtime, blobs);
    this.core = new OsCoreService(this.persistence, identities);
  }
  async initialize() {
    await this.owner.query(workspaceSql);
  }
  private async authorize(
    actor: LocalProfile,
    room: WorkspaceRoom,
    write = false,
  ) {
    return this.persistence.transaction(
      (tx) =>
        this.authorization.matter(
          tx,
          principal(actor),
          room.law_firm_id,
          room.matter_id,
          write ? "DRAFT_WRITE" : "READ",
        ),
      principal(actor),
    );
  }
  async room(id: string): Promise<WorkspaceRoom> {
    const result = await this.owner.query(
      `SELECT w.id,w.law_firm_id,w.matter_id,w.document_id,w.draft_id,w.source_version_id,w.checkpoint_version_id,w.revision::int,w.updated_at,
      d.data->>'title' AS title,m.data->>'title' AS matter_title,c.data->>'display_name' AS client_name
      FROM os_private.workspace_documents w JOIN os_private.documents d ON d.id=w.document_id
      JOIN os_private.matters m ON m.id=w.matter_id JOIN os_private.clients c ON c.id=m.data->>'client_id' WHERE w.id=$1`,
      [id],
    );
    if (!result.rows[0]) throw Error("WORKSPACE_NOT_FOUND");
    return {
      ...result.rows[0],
      updated_at: new Date(result.rows[0].updated_at).toISOString(),
    };
  }
  async access(
    token: string,
    id?: string,
    write = false,
  ): Promise<{ grant: WorkspaceGrant; room: WorkspaceRoom }> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw Error("WORKSPACE_ACCESS_DENIED");
    const r = await this.owner.query(
      "SELECT token_hash,room_id,actor_id,read_only FROM os_private.workspace_grants WHERE token_hash=$1 AND NOT revoked AND expires_at>now()",
      [digest(token)],
    );
    const grant = r.rows[0] as WorkspaceGrant | undefined;
    if (!grant || (id && grant.room_id !== id) || (write && grant.read_only))
      throw Error("WORKSPACE_ACCESS_DENIED");
    const room = await this.room(grant.room_id);
    await this.authorize(grant.actor_id, room, write);
    return { grant, room };
  }
  private async issue(
    room: WorkspaceRoom,
    actor: LocalProfile,
    readOnly = false,
  ): Promise<WorkspaceAccess> {
    await this.authorize(actor, room, !readOnly);
    const token = randomBytes(32).toString("hex");
    await this.owner.query(
      `INSERT INTO os_private.workspace_grants(token_hash,room_id,actor_id,read_only,expires_at) VALUES($1,$2,$3,$4,now()+interval '12 hours')`,
      [digest(token), room.id, actor, readOnly],
    );
    return {
      room,
      token,
      actor_id: actor,
      display_name:
        (await this.identities.identity(actor))?.display_name ??
        localNames[actor] ??
        "Profesional",
      read_only: readOnly,
      can_manage: !readOnly && (await this.canManage(actor, room)),
    };
  }
  async canManage(actor: LocalProfile, room: WorkspaceRoom) {
    try {
      await this.persistence.transaction(async (tx) => {
        await this.authorization.director(
          tx,
          principal(actor),
          room.law_firm_id,
        );
        return this.authorization.matter(
          tx,
          principal(actor),
          room.law_firm_id,
          room.matter_id,
          "MANAGE",
        );
      }, principal(actor));
      return true;
    } catch (error) {
      if (
        error instanceof CoreError &&
        ["ACCESS_DENIED", "DIRECTOR_REQUIRED"].includes(error.code)
      )
        return false;
      throw error;
    }
  }
  /** Explicit adoption of one existing browser draft. Inserts preserve IDs and never overwrite originals. */
  async adopt(raw: unknown): Promise<WorkspaceAccess> {
    const seed = WorkspaceSeedSchema.parse(raw),
      actor = principal(seed.actor_id);
    const member = seed.memberships.find(
      (m) => m.identity_id === seed.actor_id && m.active,
    );
    const participant = seed.participants.find(
      (p) => p.identity_id === seed.actor_id && p.active,
    );
    const canWrite =
      !!member &&
      ["ADMINISTRATOR", "COORDINATOR", "LAWYER", "ASSISTANT"].includes(
        member.role,
      ) &&
      !!participant?.permissions.includes("DRAFT_WRITE");
    if (!member || !participant?.permissions.includes("READ"))
      throw Error("WORKSPACE_ACCESS_DENIED");
    const bytes = Buffer.from(seed.version.original_base64, "base64");
    const originalText = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes,
    );
    const rich = (seed.initial_rich ??
      textDocument(originalText)) as JSONContent;
    schema.nodeFromJSON(rich).check();
    if (seed.initial_rich && documentText(rich) !== originalText)
      throw Error("WORKSPACE_SOURCE_INVALID");
    if (
      digest(bytes) !== seed.version.sha256 ||
      !/^text\/plain/i.test(seed.version.mime_type)
    )
      throw Error("WORKSPACE_SOURCE_INVALID");
    const existing = await this.owner.query(
      "SELECT id FROM os_private.workspace_documents WHERE law_firm_id=$1 AND matter_id=$2 AND document_id=$3",
      [seed.firm.id, seed.matter.id, seed.document.id],
    );
    if (existing.rows[0]) {
      const room = await this.room(existing.rows[0].id);
      const result = await this.issue(room, seed.actor_id, !canWrite);
      const known = await this.owner.query(
        "SELECT 1 FROM os_private.workspace_checkpoints WHERE room_id=$1 AND version_id=$2",
        [room.id, seed.version.id],
      );
      result.source_changed =
        seed.version.id !== room.source_version_id &&
        seed.version.id !== room.checkpoint_version_id &&
        !known.rowCount;
      result.browser_version_id = seed.version.id;
      return result;
    }
    if (!canWrite) throw Error("WORKSPACE_ACCESS_DENIED");
    // Scope comes from explicitly adopted local prototype data, not a verified human identity.
    // Production Supabase mode does not expose this import endpoint.
    const client = await this.owner.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(70613001)");
      await client.query("SELECT set_config('os.actor',$1,true)", [
        actor.identity_id,
      ]);
      for (const id of Object.keys(localNames))
        await client.query(
          "INSERT INTO os_private.identities(id,subject,display_name) VALUES($1,$1,$2) ON CONFLICT(id) DO NOTHING",
          [id, localNames[id as LocalProfile]],
        );
      for (const id of new Set([
        seed.actor_id,
        ...seed.memberships.map((m) => m.identity_id),
        seed.draft.author_identity_id,
        ...(seed.draft.coauthor_identity_ids ?? []),
        seed.version.incorporated_by,
      ])) {
        const person = await this.identities.identity(id);
        if (!person) throw Error("WORKSPACE_ACCESS_DENIED");
        await client.query(
          "INSERT INTO os_private.identities(id,subject,display_name,active) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,active=EXCLUDED.active",
          [id, person.subject, person.display_name, person.active],
        );
      }
      const records: Array<[TableName, unknown]> = [
        ["lawFirms", seed.firm],
        ["memberships", seed.memberships],
        ["clients", seed.client],
        ["matters", seed.matter],
        ["participants", seed.participants],
        ["documents", seed.document],
      ];
      for (const [table, values] of records)
        for (const value of Array.isArray(values) ? values : [values]) {
          const record = value as Record<string, unknown>;
          const prior = await client.query(
            `SELECT data FROM os_private."${table}" WHERE id=$1`,
            [record.id],
          );
          if (prior.rows[0]) {
            const previous = prior.rows[0].data;
            if (
              (table === "lawFirms" ? previous.id : previous.law_firm_id) !==
                seed.firm.id ||
              (record.matter_id && previous.matter_id !== record.matter_id)
            )
              throw Error("WORKSPACE_SCOPE_MISMATCH");
            if (
              (table === "matters" &&
                previous.client_id !== record.client_id) ||
              (table === "documents" && previous.purpose !== "DRAFT")
            )
              throw Error("WORKSPACE_SOURCE_CONFLICT");
            continue;
          }
          await client.query(
            `INSERT INTO os_private."${table}"(data) VALUES($1)`,
            [record],
          );
        }
      const key = `${seed.firm.id}/${seed.matter.id}/${seed.document.id}/${seed.version.id}`;
      await this.blobs.writeOnce(key, bytes, seed.version.mime_type);
      const { original_base64: _bytes, ...version } = seed.version;
      const priorVersion = await client.query(
        'SELECT data FROM os_private."documentVersions" WHERE id=$1',
        [version.id],
      );
      if (
        priorVersion.rows[0] &&
        (priorVersion.rows[0].data.sha256 !== version.sha256 ||
          priorVersion.rows[0].data.document_id !== seed.document.id)
      )
        throw Error("WORKSPACE_SOURCE_CONFLICT");
      await client.query(
        'INSERT INTO os_private."documentVersions"(data) VALUES($1) ON CONFLICT(id) DO NOTHING',
        [{ ...version, blob_key: key }],
      );
      const priorDraft = await client.query(
        "SELECT data FROM os_private.drafts WHERE id=$1",
        [seed.draft.id],
      );
      if (
        priorDraft.rows[0] &&
        priorDraft.rows[0].data.document_version_id !== seed.version.id
      )
        throw Error("WORKSPACE_SOURCE_CONFLICT");
      await client.query(
        "INSERT INTO os_private.drafts(data) VALUES($1) ON CONFLICT(id) DO NOTHING",
        [seed.draft],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const doc = TiptapTransformer.toYdoc(
      rich,
      "default",
      workspaceExtensions(),
    );
    const state = Buffer.from(Y.encodeStateAsUpdate(doc)),
      vector = Buffer.from(Y.encodeStateVector(doc));
    doc.destroy();
    if (state.byteLength > MAX_WORKSPACE_BYTES)
      throw Error("WORKSPACE_SIZE_LIMIT");
    const roomId = randomUUID();
    await this.persistence.transaction(async () => {
      await this.core.getMatter(seed.actor_id, seed.firm.id, seed.matter.id);
      await this.persistence.extensionQuery(
        `INSERT INTO os_private.workspace_documents(id,law_firm_id,matter_id,document_id,draft_id,source_version_id,checkpoint_version_id,y_state,y_vector,rich_json,state_hash,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11) ON CONFLICT(law_firm_id,matter_id,document_id) DO NOTHING`,
        [
          roomId,
          seed.firm.id,
          seed.matter.id,
          seed.document.id,
          seed.draft.id,
          seed.version.id,
          state,
          vector,
          rich,
          digest(state),
          seed.actor_id,
        ],
      );
    }, actor);
    const row = await this.owner.query(
      "SELECT id FROM os_private.workspace_documents WHERE law_firm_id=$1 AND matter_id=$2 AND document_id=$3",
      [seed.firm.id, seed.matter.id, seed.document.id],
    );
    return {
      ...(await this.issue(await this.room(row.rows[0].id), seed.actor_id)),
      browser_version_id: seed.version.id,
    };
  }
  async load(token: string, id: string) {
    await this.access(token, id);
    const result = await this.owner.query(
      "SELECT y_state,y_vector,state_hash,revision::int,updated_at FROM os_private.workspace_documents WHERE id=$1",
      [id],
    );
    return result.rows[0] as {
      y_state: Buffer;
      y_vector: Buffer;
      state_hash: string;
      revision: number;
      updated_at: Date;
    };
  }
  async save(
    grant: WorkspaceGrant,
    room: WorkspaceRoom,
    bytes: Uint8Array,
    vector: Uint8Array,
    rich: JSONContent,
  ): Promise<DurableReceipt> {
    if (bytes.byteLength > MAX_WORKSPACE_BYTES)
      throw Error("WORKSPACE_SIZE_LIMIT");
    schema.nodeFromJSON(rich).check();
    return this.persistence.transaction(async () => {
      await this.authorize(grant.actor_id, room, true);
      const valid = await this.persistence.extensionQuery(
        "SELECT 1 FROM os_private.workspace_grants WHERE token_hash=$1 AND room_id=$2 AND NOT revoked AND expires_at>now() AND NOT read_only",
        [grant.token_hash, room.id],
      );
      if (!valid.rowCount) throw Error("WORKSPACE_ACCESS_DENIED");
      const q = await this.persistence.extensionQuery(
        "SELECT state_hash,revision::int,updated_at FROM os_private.workspace_documents WHERE id=$1 FOR UPDATE",
        [room.id],
      );
      if (!q.rows[0]) throw Error("WORKSPACE_ACCESS_DENIED");
      const stateHash = digest(bytes);
      if (q.rows[0].state_hash === stateHash)
        return {
          kind: "durable",
          room_id: room.id,
          revision: q.rows[0].revision,
          vector: toBase64(vector),
          deletions: deletionRanges(bytes),
          state_hash: stateHash,
          saved_at: new Date(q.rows[0].updated_at).toISOString(),
        };
      const row = await this.persistence.extensionQuery(
        `UPDATE os_private.workspace_documents SET y_state=$2,y_vector=$3,rich_json=$4,state_hash=$5,revision=revision+1,updated_by=$6,updated_at=now() WHERE id=$1 RETURNING revision::int,updated_at`,
        [
          room.id,
          Buffer.from(bytes),
          Buffer.from(vector),
          rich,
          stateHash,
          grant.actor_id,
        ],
      );
      await this.persistence.extensionQuery(
        "INSERT INTO os_private.workspace_updates(room_id,revision,actor_id,update_hash,state_hash) VALUES($1,$2,$3,$4,$4)",
        [room.id, row.rows[0].revision, grant.actor_id, stateHash],
      );
      return {
        kind: "durable",
        room_id: room.id,
        revision: row.rows[0].revision,
        vector: toBase64(vector),
        deletions: deletionRanges(bytes),
        state_hash: stateHash,
        saved_at: new Date(row.rows[0].updated_at).toISOString(),
      };
    }, principal(grant.actor_id));
  }
  async receipt(token: string, id: string): Promise<DurableReceipt> {
    const state = await this.load(token, id);
    return {
      kind: "durable",
      room_id: id,
      revision: state.revision,
      vector: toBase64(state.y_vector),
      deletions: deletionRanges(state.y_state),
      state_hash: state.state_hash,
      saved_at: new Date(state.updated_at).toISOString(),
    };
  }
  async history(token: string, id: string) {
    await this.access(token, id);
    const result = await this.owner.query(
      "SELECT version_id,actor_id,created_at,state_hash FROM os_private.workspace_checkpoints WHERE room_id=$1 ORDER BY created_at DESC LIMIT 50",
      [id],
    );
    return Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        display_name:
          (await this.identities.identity(row.actor_id))?.display_name ??
          "Profesional",
        created_at: new Date(row.created_at).toISOString(),
      })),
    );
  }
  async version(token: string, id: string, versionId: string) {
    await this.access(token, id);
    const result = await this.owner.query(
      "SELECT version_id,rich_json,state_hash,created_at FROM os_private.workspace_checkpoints WHERE room_id=$1 AND version_id=$2",
      [id, versionId],
    );
    if (!result.rows[0]) throw Error("WORKSPACE_NOT_FOUND");
    return {
      ...result.rows[0],
      created_at: new Date(result.rows[0].created_at).toISOString(),
    };
  }
  async checkpoint(
    token: string,
    id: string,
    command: string,
    expectedHash: string,
  ) {
    const { grant, room } = await this.access(token, id, true),
      actor = principal(grant.actor_id);
    return this.persistence.idempotent(
      actor,
      command,
      digest(
        JSON.stringify({ id, expectedHash, action: "workspace-checkpoint" }),
      ),
      async () => {
        const state = await this.persistence.extensionQuery(
          "SELECT * FROM os_private.workspace_documents WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!state.rows[0] || state.rows[0].state_hash !== expectedHash)
          throw Error("WORKSPACE_VERSION_CONFLICT");
        const rich = state.rows[0].rich_json as JSONContent;
        const text = documentText(rich);
        const contributions = await this.persistence.extensionQuery(
          "SELECT DISTINCT actor_id FROM os_private.workspace_updates WHERE room_id=$1",
          [id],
        );
        const draft = await this.core.reviseCollaborativeDraft(
          grant.actor_id,
          room.law_firm_id,
          room.matter_id,
          room.draft_id,
          state.rows[0].checkpoint_version_id,
          text.trim() ? text : "\n",
          contributions.rows.map((row) => row.actor_id),
        );
        const version = await this.core.getDocumentVersion(
          grant.actor_id,
          room.law_firm_id,
          room.matter_id,
          room.document_id,
          draft.document_version_id,
        );
        const document = await this.core.getDocument(
          grant.actor_id,
          room.law_firm_id,
          room.matter_id,
          room.document_id,
        );
        await this.persistence.extensionQuery(
          "INSERT INTO os_private.workspace_checkpoints(room_id,version_id,command_id,y_state,rich_json,state_hash,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            version.id,
            command,
            state.rows[0].y_state,
            rich,
            expectedHash,
            grant.actor_id,
          ],
        );
        await this.persistence.extensionQuery(
          "UPDATE os_private.workspace_documents SET checkpoint_version_id=$2 WHERE id=$1",
          [id, version.id],
        );
        return {
          document,
          draft,
          version,
          rich_hash: expectedHash,
          human_review: "PENDING",
        };
      },
      async () => {
        await this.authorize(grant.actor_id, room, true);
        const valid = await this.persistence.extensionQuery(
          "SELECT 1 FROM os_private.workspace_grants WHERE token_hash=$1 AND room_id=$2 AND NOT revoked AND expires_at>now() AND NOT read_only",
          [grant.token_hash, id],
        );
        if (!valid.rowCount) throw Error("WORKSPACE_ACCESS_DENIED");
      },
    );
  }
  async share(
    token: string,
    id: string,
    actor: LocalProfile,
    readOnly: boolean,
  ) {
    const { grant, room } = await this.access(token, id);
    await this.persistence.transaction(async (tx) => {
      await this.authorization.matter(
        tx,
        principal(grant.actor_id),
        room.law_firm_id,
        room.matter_id,
        "MANAGE",
      );
    }, principal(grant.actor_id));
    const participants = await this.core.listMatterResources(
      grant.actor_id,
      room.law_firm_id,
      room.matter_id,
      "participants",
    );
    const existing = participants.find(
      (p) => p.identity_id === actor && p.active,
    );
    const permissions = [
      ...new Set([
        ...(existing?.permissions ?? []),
        "READ" as const,
        ...(!readOnly ? ["DRAFT_WRITE" as const] : []),
      ]),
    ];
    await this.core.grantParticipant(
      grant.actor_id,
      room.law_firm_id,
      room.matter_id,
      actor,
      permissions,
    );
    return this.issue(await this.room(id), actor, readOnly);
  }
  async revoke(token: string, id: string, actor: LocalProfile) {
    const { grant, room } = await this.access(token, id);
    await this.persistence.transaction(
      (tx) =>
        this.authorization.matter(
          tx,
          principal(grant.actor_id),
          room.law_firm_id,
          room.matter_id,
          "MANAGE",
        ),
      principal(grant.actor_id),
    );
    const client = await this.owner.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(70613001)");
      await client.query(
        "UPDATE os_private.workspace_grants SET revoked=true WHERE room_id=$1 AND actor_id=$2",
        [id, actor],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async notes(token: string, id: string) {
    await this.access(token, id);
    const jobs = await this.owner.query(
      "SELECT * FROM os_private.workspace_jobs WHERE room_id=$1 ORDER BY created_at DESC LIMIT 50",
      [id],
    );
    const comments = await this.owner.query(
      'SELECT id,actor_id,base_hash,quote,body,range_from AS "from",range_to AS "to",resolved,created_at FROM os_private.workspace_comments WHERE room_id=$1 ORDER BY created_at',
      [id],
    );
    const decisions = await this.owner.query(
      'SELECT job_id,finding_index,actor_id,status,quote,range_from AS "from",range_to AS "to",state_hash,anchor_hash,updated_at FROM os_private.workspace_review_decisions WHERE room_id=$1 ORDER BY updated_at',
      [id],
    );
    return {
      decisions: decisions.rows,
      jobs: jobs.rows.map((r) => ({
        ...r,
        ...(r.status === "RUNNING" && r.context.host_id !== this.hostId
          ? {
              status: "OUTCOME_UNKNOWN",
              error_code: "WORKSPACE_SERVER_RESTARTED",
            }
          : {}),
        reserved_usd: Number(r.reserved_usd),
        created_at: new Date(r.created_at).toISOString(),
      })),
      comments: comments.rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
      })),
    };
  }
  async savedWork(token: string, id: string, tool: string, raw: unknown) {
    await this.access(token, id);
    if (tool === "list_saved_work") {
      const args = WorkspaceAgentToolSchemas.list_saved_work.parse(raw);
      const page = await this.owner.query(
        `SELECT id,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') created_at,status,request->>'action' action,request->>'instruction' instruction,
         result->>'summary' summary,(result->>'replacement_text' IS NOT NULL) has_proposal
         FROM os_private.workspace_jobs WHERE room_id=$1 AND ($2::timestamptz IS NULL OR created_at < $2)
         ORDER BY created_at DESC LIMIT 25`,
        [id, args.before],
      );
      return {
        jobs: page.rows,
        next_before:
          page.rows.length === 25 ? page.rows.at(-1).created_at : null,
      };
    }
    if (tool !== "read_saved_work") throw Error("WORKSPACE_UNKNOWN_TOOL");
    const args = WorkspaceAgentToolSchemas.read_saved_work.parse(raw);
    const source = (
      await this.owner.query(
        "SELECT * FROM os_private.workspace_jobs WHERE id=$1 AND room_id=$2",
        [args.job_id, id],
      )
    ).rows[0] as WorkspaceJob | undefined;
    if (!source) throw Error("WORKSPACE_HISTORY_NOT_FOUND");
    if (args.part === "CONVERSATION")
      return {
        job_id: source.id,
        instruction: source.request.instruction,
        summary: source.result?.summary ?? null,
        status: source.status,
        error_code: source.error_code,
        agent_trace: source.result?.agent_trace ?? [],
        quality_control: source.result?.quality_control ?? null,
        specialist_bindings: source.result?.specialist_bindings ?? [],
      };
    if (args.part === "PROPOSAL") {
      if (!source.result?.replacement_text)
        throw Error("WORKSPACE_REVISION_RESULT_MISSING");
      return {
        job_id: source.id,
        summary: source.result.summary,
        replacement_text: source.result.replacement_text,
        scope: source.result.execution?.scope ?? "DOCUMENT",
        limitations: source.result.limitations,
        based_on_hash: source.request.base_hash,
        application_status: "NOT_INFERRED_FROM_GENERATION",
        quality_control: source.result.quality_control ?? null,
      };
    }
    if (!hasWorkspaceAnalysis(source))
      throw Error("WORKSPACE_REVISION_BASIS_INVALID");
    const decisions = await this.owner.query(
      "SELECT finding_index,status FROM os_private.workspace_review_decisions WHERE room_id=$1 AND job_id=$2",
      [id, source.id],
    );
    const states = new Map(
      decisions.rows.map((d) => [d.finding_index, d.status]),
    );
    return {
      analysis: {
        job_id: source.id,
        instruction: source.request.instruction,
        summary: source.result!.summary,
        findings: WorkspaceAnalysisSchema.shape.findings.element
          .array()
          .parse(source.result!.findings)
          .map((f, i) => ({ ...f, decision: states.get(i) ?? "OPEN" })),
        sources: source.result!.sources,
        quality_control: source.result!.quality_control,
      },
    };
  }
  /** Read the durable editor or a particular saved output, under the same grant
   * as the editor. Paging bounds a tool response without truncating the source. */
  async directorRead(token: string, id: string, raw: unknown) {
    const input = z
      .object({
        source: z.enum([
          "DOCUMENT",
          "WORK_INDEX",
          "PROPOSAL",
          "ANALYSIS",
          "CONVERSATION",
        ]),
        job_id: z.uuid().nullable(),
        offset: z.number().int().min(0),
        before: z.string().datetime({ offset: true }).nullable(),
      })
      .strict()
      .parse(raw);
    const { room } = await this.access(token, id);
    if (input.source === "WORK_INDEX") {
      const index = await this.savedWork(token, id, "list_saved_work", {
        before: input.before,
      });
      return {
        room_id: id,
        title: room.title,
        source: input.source,
        ...index,
        jobs: index.jobs!.map((j: Record<string, unknown>) => ({
          ...j,
          instruction:
            typeof j.instruction === "string"
              ? j.instruction.slice(0, 600)
              : null,
          instruction_truncated:
            typeof j.instruction === "string" && j.instruction.length > 600,
          summary:
            typeof j.summary === "string" ? j.summary.slice(0, 400) : null,
        })),
      };
    }
    let text: string, provenance: Record<string, unknown>;
    if (input.source === "DOCUMENT") {
      const row = (
        await this.owner.query(
          "SELECT rich_json,state_hash,revision::int,updated_at FROM os_private.workspace_documents WHERE id=$1",
          [id],
        )
      ).rows[0];
      const doc = schema.nodeFromJSON(row.rich_json);
      text = doc.textBetween(0, doc.content.size, "\n");
      provenance = {
        state_hash: row.state_hash,
        revision: row.revision,
        saved_at: new Date(row.updated_at).toISOString(),
        document_size: doc.content.size,
        content_status: "DURABLE_EDITOR_SNAPSHOT",
      };
    } else {
      if (!input.job_id) throw Error("WORKSPACE_HISTORY_NOT_FOUND");
      const work = await this.savedWork(token, id, "read_saved_work", {
        job_id: input.job_id,
        part: input.source,
      });
      text = JSON.stringify(work);
      provenance = {
        job_id: input.job_id,
        content_status: "SAVED_WORK",
        application_status: "NOT_INFERRED_FROM_GENERATION",
      };
    }
    // The original is never changed, including when a proposal has not been applied.
    const end = Math.min(text.length, input.offset + 8000);
    return {
      room_id: id,
      title: room.title,
      matter_id: room.matter_id,
      draft_id: room.draft_id,
      source: input.source,
      ...provenance,
      content_sha256: digest(text),
      offset: input.offset,
      total_characters: text.length,
      text: text.slice(input.offset, end),
      next_offset: end < text.length ? end : null,
      legal_validity: "NOT_VERIFIED_BY_READING",
    };
  }
  async beginTask(
    token: string,
    id: string,
    raw: unknown,
  ): Promise<{ job: WorkspaceJob; fresh: boolean }> {
    const request = WorkspaceTaskSchema.parse(raw),
      { grant, room } = await this.access(token, id, true);
    // Every newly executed live task uses the controlled runtime. Stored older
    // jobs remain readable; they are never silently regenerated or relabeled.
    if (request.execution_mode === "LIVE") request.workflow_version = 4;
    request.analysis_level ??= "MEDIO";
    if (request.execution_mode === "LIVE" && request.agent_id === "gabriel" && request.action === "CONSULT") request.action = "PLAN";
    if (
      ["ANALYZE", "REWRITE", "DRAFT"].includes(request.action) &&
      request.agent_id === "gabriel"
    )
      throw Error("WORKSPACE_SPECIALIST_REQUIRED");
    if (
      ["REWRITE", "DRAFT"].includes(request.action) &&
      request.agent_id === "santiago"
    )
      throw Error("WORKSPACE_SPECIALIST_REQUIRED");
    if (request.execution_mode === "LIVE" && !request.authorize_paid_calls)
      throw Error("EXPLICIT_PAID_CALL_AUTHORIZATION_REQUIRED");
    if (request.plan_id && request.action !== "ANALYZE")
      throw Error("WORKSPACE_TEAM_CONFIRMATION_REQUIRED");
    if (
      request.analysis_job_id &&
      (!["REWRITE", "DRAFT"].includes(request.action) ||
        request.plan_id ||
        request.resume_job_id)
    )
      throw Error("WORKSPACE_REVISION_BASIS_INVALID");
    if (request.action === "PLAN" && request.agent_id !== "gabriel")
      throw Error("WORKSPACE_TEAM_CONFIRMATION_REQUIRED");
    if ((request.action === "INTEGRATE") !== !!request.resume_job_id)
      throw Error("WORKSPACE_INTEGRATION_NOT_RESUMABLE");
    return this.persistence.transaction(async () => {
      await this.access(token, id, true);
      const fingerprint = digest(JSON.stringify({ id, request }));
      const prior = await this.persistence.extensionQuery(
        "SELECT * FROM os_private.workspace_jobs WHERE id=$1 AND room_id=$2",
        [request.command_id, id],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].fingerprint !== fingerprint)
          throw Error("WORKSPACE_VERSION_CONFLICT");
        return { job: prior.rows[0] as WorkspaceJob, fresh: false };
      }
      const state = await this.persistence.extensionQuery(
        "SELECT rich_json,state_hash FROM os_private.workspace_documents WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!state.rows[0] || state.rows[0].state_hash !== request.base_hash)
        throw Error("WORKSPACE_VERSION_CONFLICT");
      const doc = schema.nodeFromJSON(state.rows[0].rich_json);
      if (request.to < request.from || request.to > doc.content.size)
        throw Error("WORKSPACE_SELECTION_INVALID");
      const text = doc.textBetween(request.from, request.to, "\n");
      const attached_documents = request.attachments ?? [];
      let team_plan, integration_resume, review_basis;
      let director_state: WorkspaceJob["context"]["director_state"];
      // Load complete findings and decisions only from this authorized room.
      const loadReviewBasis = async (sourceId: string) => {
        const prior = await this.persistence.extensionQuery(
          "SELECT * FROM os_private.workspace_jobs WHERE id=$1 AND room_id=$2",
          [sourceId, id],
        );
        const source = prior.rows[0] as WorkspaceJob | undefined;
        if (!source || !hasWorkspaceAnalysis(source))
          throw Error("WORKSPACE_REVISION_BASIS_INVALID");
        const findings = WorkspaceAnalysisSchema.shape.findings.element
          .array()
          .parse(source.result!.findings);
        const decisions = await this.persistence.extensionQuery(
          "SELECT finding_index,status FROM os_private.workspace_review_decisions WHERE room_id=$1 AND job_id=$2 ORDER BY updated_at",
          [id, source.id],
        );
        const latest = new Map<number, string>(
          decisions.rows.map((d: { finding_index: number; status: string }) => [
            d.finding_index,
            d.status,
          ]),
        );
        review_basis = {
          job_id: source.id,
          summary: source.result!.summary,
          instruction: source.request.instruction,
          findings: findings.map((f, i) => ({
            ...f,
            decision: latest.get(i) ?? "OPEN",
          })),
          sources: source.result!.sources ?? [],
          quality_control: source.result!.quality_control,
        };
      };
      if (
        request.workflow_version &&
        request.action === "ANALYZE" &&
        !request.plan_id
      )
        throw Error("WORKSPACE_TEAM_CONFIRMATION_REQUIRED");
      if (request.plan_id) {
        const selected = await this.persistence.extensionQuery(
          "SELECT * FROM os_private.workspace_jobs WHERE id=$1 AND room_id=$2",
          [request.plan_id, id],
        );
        const planJob = selected.rows[0];
        const parsedPlan = WorkspacePlanSchema.safeParse(
          planJob?.result?.team_plan,
        );
        if (!parsedPlan.success)
          throw Error("WORKSPACE_TEAM_CONFIRMATION_REQUIRED");
        team_plan = parsedPlan.data;
        if (
          !planJob ||
          planJob.status !== "COMPLETED" ||
          planJob.request.action !== "PLAN" ||
          team_plan.kind !== "TEAM" ||
          !validTeamPlan(team_plan)
        )
          throw Error("WORKSPACE_TEAM_CONFIRMATION_REQUIRED");
        if (
          planJob.request.base_hash !== request.base_hash ||
          planJob.request.instruction !== request.instruction ||
          planJob.request.from !== request.from ||
          planJob.request.to !== request.to ||
          planJob.request.execution_mode !== request.execution_mode ||
          planJob.request.include_library !== request.include_library ||
          (planJob.request.analysis_level ?? "MEDIO") !== request.analysis_level ||
          team_plan.lead_id !== request.agent_id ||
          // PostgreSQL JSONB reorders object keys. Compare the validated shape,
          // not the storage serialization of an otherwise identical attachment.
          digest(
            JSON.stringify(
              WorkspaceTaskSchema.shape.attachments.parse(
                planJob.request.attachments ?? [],
              ),
            ),
          ) !== digest(JSON.stringify(attached_documents))
        )
          throw Error("WORKSPACE_PLAN_STALE");
        const used = await this.persistence.extensionQuery(
          "SELECT id FROM os_private.workspace_jobs WHERE room_id=$1 AND (request->>'plan_id'=$2 OR context->>'draft_origin_plan_id'=$2) LIMIT 1",
          [id, request.plan_id],
        );
        if (used.rows.length) throw Error("WORKSPACE_PLAN_ALREADY_EXECUTED");
      }
      // Gabriel receives server-derived state for EVERY conversational message.
      // No keyword matching, action guessing or automatic specialist assignment.
      if (request.action === "PLAN") {
        const priorAnalysis = await this.persistence.extensionQuery(
          `SELECT id,request FROM os_private.workspace_jobs
           WHERE room_id=$1 AND (status='COMPLETED'
             OR result->'agent_trace' @> '[{"tool":"analyze_with_specialists","status":"COMPLETED"}]'::jsonb
             OR result->'agent_trace' @> '[{"tool":"consult_specialist","status":"COMPLETED"}]'::jsonb)
           AND (request->>'action' IN ('ANALYZE','INTEGRATE') OR (request->>'workflow_version'='4' AND result->'team_outputs' IS NOT NULL))
           AND result->'findings' IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [id],
        );
        const source = priorAnalysis.rows[0];
        if (source) await loadReviewBasis(source.id);
        const recent = await this.persistence.extensionQuery(
          `SELECT id, request->>'action' action, status,
           request->>'instruction' instruction, result->>'summary' summary, error_code, created_at,
           (result->>'replacement_text' IS NOT NULL) has_proposal,
           length(result->>'replacement_text') proposal_chars, result->'limitations' limitations,
           result->'quality_control'->>'status' quality_status
           FROM os_private.workspace_jobs WHERE room_id=$1 ORDER BY created_at DESC LIMIT 8`,
          [id],
        );
        director_state = {
          analysis: review_basis ?? null,
          recent_jobs: recent.rows,
          analysis_matches_current_document:
            source?.request.base_hash === request.base_hash,
        };
        review_basis = undefined;
      }
      if (request.analysis_job_id) {
        if (request.from !== 0 || request.to !== doc.content.size)
          throw Error("WORKSPACE_REVISION_BASIS_INVALID");
        await loadReviewBasis(request.analysis_job_id);
      }
      const selected = request.selection;
      if (
        selected &&
        (selected.to <= selected.from || selected.to > doc.content.size)
      )
        throw Error("WORKSPACE_SELECTION_INVALID");
      if (request.resume_job_id) {
        const prior = await this.persistence.extensionQuery(
          "SELECT * FROM os_private.workspace_jobs WHERE id=$1 AND room_id=$2",
          [request.resume_job_id, id],
        );
        const source = prior.rows[0] as WorkspaceJob | undefined;
        if (!source || !canResumeIntegration(source))
          throw Error("WORKSPACE_INTEGRATION_NOT_RESUMABLE");
        if (
          source.request.base_hash !== request.base_hash ||
          source.request.instruction !== request.instruction ||
          source.request.from !== request.from ||
          source.request.to !== request.to ||
          source.request.execution_mode !== request.execution_mode ||
          source.request.include_library !== request.include_library ||
          (source.request.analysis_level ?? "MEDIO") !== request.analysis_level ||
          source.context.team_plan!.lead_id !== request.agent_id ||
          digest(
            JSON.stringify(
              WorkspaceTaskSchema.shape.attachments.parse(
                source.request.attachments ?? [],
              ),
            ),
          ) !== digest(JSON.stringify(attached_documents))
        )
          throw Error("WORKSPACE_PLAN_STALE");
        const used = await this.persistence.extensionQuery(
          "SELECT id FROM os_private.workspace_jobs WHERE room_id=$1 AND request->>'resume_job_id'=$2 LIMIT 1",
          [id, source.id],
        );
        if (used.rows.length)
          throw Error("WORKSPACE_INTEGRATION_ALREADY_RESUMED");
        team_plan = source.context.team_plan!;
        const outputs = source.result!.team_outputs!.map((o) => ({
          agent_id: o.agent_id,
          ...WorkspaceAnalysisSchema.parse({
            summary: o.summary,
            findings: o.findings,
            replacement_text: null,
            references: (o as Record<string, unknown>).references ?? [],
            limitations: (o as Record<string, unknown>).limitations ?? [],
          }),
        }));
        integration_resume = {
          outputs,
          sources: source.result!.sources,
          limitations: source.result!.limitations,
        };
        // Transfer only the unused integration allowance; do not reserve it twice.
        if (request.execution_mode === "LIVE")
          await this.persistence.extensionQuery(
            "UPDATE os_private.workspace_jobs SET reserved_usd=reserved_usd-$2 WHERE id=$1 AND room_id=$3",
            [source.id, 0.52 / (team_plan.participants.length + 1), id],
          );
      }
      if (attached_documents.some((d) => digest(d.text) !== d.text_sha256))
        throw Error("WORKSPACE_ATTACHMENT_INVALID");
      // Freeze authorized evidence in full. Serialized bytes do not measure the
      // model context window; the runner reserves provider cost before generation.
      const context = {
        host_id: this.hostId,
        ...(team_plan ? { team_plan } : {}),
        ...(integration_resume ? { integration_resume } : {}),
        ...(review_basis ? { review_basis } : {}),
        ...(director_state
          ? {
              director_state,
              document: {
                text: doc.textBetween(0, doc.content.size, "\n"),
                from: 0,
                to: doc.content.size,
              },
              ...(selected
                ? {
                    selection: {
                      ...selected,
                      quote: doc.textBetween(selected.from, selected.to, "\n"),
                    },
                  }
                : {}),
            }
          : {}),
        attached_documents,
        text,
        quote: doc.textBetween(request.from, request.to, "\n"),
        from: request.from,
        to: request.to,
        title: room.title,
        matter_title: room.matter_title,
      };
      const row = await this.persistence.extensionQuery(
        `INSERT INTO os_private.workspace_jobs(id,room_id,actor_id,fingerprint,request,context,status,reserved_usd) VALUES($1,$2,$3,$4,$5,$6,'RUNNING',$7) RETURNING *`,
        [
          request.command_id,
          id,
          grant.actor_id,
          fingerprint,
          request,
          context,
          request.execution_mode === "LIVE"
            ? integration_resume
              ? 0.52 / (team_plan!.participants.length + 1)
              : request.action === "PLAN"
                ? [3, 4].includes(request.workflow_version ?? 0)
                  ? 0.6
                  : 0.08
                : request.plan_id
                  ? 0.52
                  : 0.6
            : 0,
        ],
      );
      return { job: row.rows[0] as WorkspaceJob, fresh: true };
    }, principal(grant.actor_id));
  }
  async progressTask(job: WorkspaceJob, result: WorkspaceJob["result"]) {
    await this.persistence.transaction(
      async () => {
        await this.persistence.extensionQuery(
          "UPDATE os_private.workspace_jobs SET result=$3 WHERE id=$1 AND room_id=$2 AND status='RUNNING'",
          [job.id, job.room_id, result],
        );
      },
      principal(job.actor_id as LocalProfile),
    );
  }
  async finishTask(
    job: WorkspaceJob,
    result: WorkspaceJob["result"],
    errorCode?: string,
    diagnostics?: unknown,
    technicalFailure?: unknown,
  ) {
    const parsed = WorkspaceProviderFailureSchema.safeParse(diagnostics);
    const diagnostic = parsed.success ? parsed.data : null;
    const technical = WorkspaceFailureContextSchema.safeParse(technicalFailure);
    const context = technical.success ? technical.data : null;
    const failureEnvelope = {
      summary: "La operación no se completó.",
      findings: [],
      replacement_text: null,
      references: [],
      limitations: [],
      sources: [],
      citation_check: [],
      semantic_check: "NOT_PERFORMED",
      simulated: job.request.execution_mode === "OFFLINE_TEST",
      jev_output: false,
    };
    await this.persistence.transaction(
      async () => {
        await this.persistence.extensionQuery(
          "UPDATE os_private.workspace_jobs SET status=$2,result=(CASE WHEN $4::text IS NULL THEN COALESCE($3,result) ELSE COALESCE($3,result,$7::jsonb) END)||CASE WHEN $6::jsonb IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('failure_details',$6::jsonb) END||CASE WHEN $8::jsonb IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('failure_context',$8::jsonb) END,error_code=$4 WHERE id=$1 AND room_id=$5 AND status='RUNNING'",
          [
            job.id,
            errorCode
              ? /UNKNOWN|ABORTED/.test(errorCode)
                ? "OUTCOME_UNKNOWN"
                : "FAILED"
              : "COMPLETED",
            result,
            errorCode ?? null,
            job.room_id,
            diagnostic,
            failureEnvelope,
            context,
          ],
        );
      },
      principal(job.actor_id as LocalProfile),
    );
  }
  async addComment(token: string, id: string, raw: unknown) {
    const input = z
      .object({
        command_id: z.uuid(),
        base_hash: z.string().regex(/^[a-f0-9]{64}$/),
        from: z.number().int().min(0),
        to: z.number().int().min(0),
        body: z.string().trim().min(1).max(4000),
      })
      .strict()
      .parse(raw);
    const { grant } = await this.access(token, id, true);
    return this.persistence.transaction(async () => {
      await this.access(token, id, true);
      const prior = await this.persistence.extensionQuery(
        "SELECT * FROM os_private.workspace_comments WHERE id=$1",
        [input.command_id],
      );
      if (prior.rows[0]) {
        const r = prior.rows[0];
        if (
          r.room_id !== id ||
          r.actor_id !== grant.actor_id ||
          r.base_hash !== input.base_hash ||
          r.range_from !== input.from ||
          r.range_to !== input.to ||
          r.body !== input.body
        )
          throw Error("WORKSPACE_VERSION_CONFLICT");
        return { saved: true };
      }
      const state = await this.persistence.extensionQuery(
        "SELECT rich_json,state_hash FROM os_private.workspace_documents WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!state.rows[0] || state.rows[0].state_hash !== input.base_hash)
        throw Error("WORKSPACE_VERSION_CONFLICT");
      const doc = schema.nodeFromJSON(state.rows[0].rich_json);
      if (input.to < input.from || input.to > doc.content.size)
        throw Error("WORKSPACE_SELECTION_INVALID");
      await this.persistence.extensionQuery(
        "INSERT INTO os_private.workspace_comments(id,room_id,actor_id,base_hash,quote,body,range_from,range_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING",
        [
          input.command_id,
          id,
          grant.actor_id,
          input.base_hash,
          doc.textBetween(input.from, input.to, "\n"),
          input.body,
          input.from,
          input.to,
        ],
      );
      return { saved: true };
    }, principal(grant.actor_id));
  }
  async reviewDecision(token: string, id: string, raw: unknown) {
    const input = z
      .object({
        job_id: z.uuid(),
        finding_index: z.number().int().min(0),
        status: z.enum(["OPEN", "LINKED", "APPLIED", "DISMISSED"]),
        base_hash: z.string().regex(/^[a-f0-9]{64}$/),
        from: z.number().int().min(0),
        to: z.number().int().min(0),
        quote: z.string().max(60000),
      })
      .strict()
      .parse(raw);
    const { grant } = await this.access(token, id, true);
    return this.persistence.transaction(async () => {
      await this.access(token, id, true);
      const jobs = await this.persistence.extensionQuery(
        "SELECT * FROM os_private.workspace_jobs WHERE id=$1 AND room_id=$2 AND status='COMPLETED'",
        [input.job_id, id],
      );
      const finding = (jobs.rows[0] as WorkspaceJob | undefined)?.result
        ?.findings[input.finding_index];
      if (!finding) throw Error("WORKSPACE_REVIEW_FINDING_INVALID");
      const current = await this.persistence.extensionQuery(
        "SELECT rich_json,state_hash FROM os_private.workspace_documents WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (current.rows[0]?.state_hash !== input.base_hash)
        throw Error("WORKSPACE_VERSION_CONFLICT");
      const doc = schema.nodeFromJSON(current.rows[0].rich_json);
      if (input.from > input.to || input.to > doc.content.size)
        throw Error("WORKSPACE_SELECTION_INVALID");
      if (["APPLIED", "LINKED"].includes(input.status)) {
        if (
          !input.quote.trim() ||
          doc.textBetween(input.from, input.to, "\n") !== input.quote
        )
          throw Error("WORKSPACE_REVIEW_PASSAGE_CHANGED");
        if (finding.source_id !== "EDITOR")
          throw Error("WORKSPACE_REVIEW_SOURCE_INVALID");
        if (
          input.status === "APPLIED" &&
          reviewText(input.quote) !== reviewText(finding.proposal ?? "")
        )
          throw Error("WORKSPACE_REVIEW_PROPOSAL_INVALID");
      }
      await this.persistence.extensionQuery(
        `INSERT INTO os_private.workspace_review_decisions(room_id,job_id,finding_index,actor_id,status,quote,range_from,range_to,state_hash,anchor_hash)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(room_id,job_id,finding_index) DO UPDATE
         SET actor_id=EXCLUDED.actor_id,status=EXCLUDED.status,quote=EXCLUDED.quote,range_from=EXCLUDED.range_from,
         range_to=EXCLUDED.range_to,state_hash=EXCLUDED.state_hash,anchor_hash=EXCLUDED.anchor_hash,updated_at=now()`,
        [
          id,
          input.job_id,
          input.finding_index,
          grant.actor_id,
          input.status,
          input.quote,
          input.from,
          input.to,
          input.base_hash,
          digest(JSON.stringify(doc.toJSON())),
        ],
      );
      return { saved: true };
    }, principal(grant.actor_id));
  }
  async resolveComment(token: string, id: string, commentId: string) {
    const { grant } = await this.access(token, id, true);
    await this.persistence.transaction(async () => {
      await this.access(token, id, true);
      await this.persistence.extensionQuery(
        "UPDATE os_private.workspace_comments SET resolved=true WHERE id=$1 AND room_id=$2",
        [commentId, id],
      );
    }, principal(grant.actor_id));
    return { resolved: true };
  }
  async close() {
    await Promise.all([this.owner.end(), this.runtime.end()]);
  }
}
