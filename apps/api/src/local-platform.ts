import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  BrowserPersistence,
  parseSnapshot,
  TABLES,
  LOCAL_PROFILES,
  type Snapshot,
} from "../../web/src/local-storage.js";
import { executeCoreCommand } from "../../web/src/local-commands.js";
import {
  ALL_MATTER_PERMISSIONS,
  type Identity,
  type Authenticator,
  type CoreTransaction,
} from "../../../os-core/src/contracts.js";
import { Authorization } from "../../../os-core/src/authorization.js";
import { authorizePractice, executePortal, putRecord, findRecord } from "../../../os-core/src/practice.js";
import { emptyPractice } from "../../../os-core/src/practice-model.js";
import { OsCoreService } from "../../../os-core/src/service.js";
import { advanceDeadlineAlerts } from "../../../os-core/src/deadlines.js";
import { directorAccessSql } from "../../../packages/persistence-postgres/src/director-policy.js";
import { WorkspaceSeedSchema } from "../../../packages/workspace/src/model.js";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export class LocalPlatform {
  constructor(readonly pool: Pool) {}
  async stopRecording(room:{law_firm_id:string;matter_id:string},sessionId:string){
    const client=await this.pool.connect();try{await client.query("BEGIN");const state=await this.raw(client,true),store=this.store(state,async value=>{await client.query("UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",[value])});
      const result=await store.transaction((_tx,_p,_t,practice)=>{const row=findRecord(practice,room.law_firm_id,sessionId);if(row.matter_id!==room.matter_id||row.payload.type!=="SESSION")throw Error("ACCESS_DENIED");if(row.payload.recording_status==="STOPPED")return row;return putRecord(practice,"system:call-stop",row.law_firm_id,row.matter_id,{...row.payload,recording_status:"STOPPED",status:"CLOSED",stopped_at:new Date().toISOString()},row)});await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }
  async saveSessionAI(actor:Identity,directory:Identity[],firm:string,sourceId:string,sourceRevision:number,payload:unknown,jobId:string){
    const client=await this.pool.connect();try{await client.query("BEGIN");const state=await this.raw(client,true),store=this.store(state,async value=>{await client.query("UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",[value])});
      const result=await store.transaction(async(tx,_p,_t,practice)=>{const source=findRecord(practice,firm,sourceId),principal=await this.authenticator(actor,directory).authenticate(actor.id);if(!principal||!source.matter_id)throw Error("ACCESS_DENIED");await new Authorization().matter(tx,principal,firm,source.matter_id,"DRAFT_WRITE");
        const existing=practice.records.find(r=>r.id===jobId);if(existing){if(existing.law_firm_id!==firm||existing.matter_id!==source.matter_id||!["TRANSCRIPT","MINUTES"].includes(existing.payload.type))throw Error("SESSION_AI_RECORD_CONFLICT");return existing}
        if(source.revision!==sourceRevision)throw Error("VERSION_CONFLICT");
        const {Payload}=await import("../../../os-core/src/practice-model.js"),output=Payload.parse(payload);
        if(output.type==="TRANSCRIPT"){if(source.payload.type!=="RECORDING"||source.payload.withdrawn_at||output.session_id!==source.payload.session_id||output.recording_ids.length!==1||output.recording_ids[0]!==source.id)throw Error("ACCESS_DENIED")}
        else if(output.type==="MINUTES"){if(source.payload.type!=="TRANSCRIPT"||output.transcript_id!==source.id||output.session_id!==source.payload.session_id||output.status!=="PROPOSED"||output.actions.some(a=>a.task_id||a.responsible_identity_id))throw Error("ACCESS_DENIED")}
        else throw Error("INVALID_AI_OUTPUT");return putRecord(practice,actor.id,firm,source.matter_id,output,undefined,jobId)});
      await client.query("COMMIT");return result;
    }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
  }
  async sessionRecord(actor:Identity,directory:Identity[],input:{firm:string;matter:string;event:string;session_id?:string;data:any}){
    const client=await this.pool.connect();
    try{await client.query("BEGIN");const state=await this.raw(client,true),store=this.store(state,async value=>{await client.query("UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",[value])});
      const result=await store.transaction(async(tx,_p,_t,practice)=>{
        const principal=await this.authenticator(actor,directory).authenticate(actor.id);if(!principal)throw Error("UNAUTHENTICATED");
        await new Authorization().matter(tx,principal,input.firm,input.matter,"READ");
        const previous=input.session_id?findRecord(practice,input.firm,input.session_id):undefined;
        if(previous&&(previous.matter_id!==input.matter||previous.payload.type!=="SESSION"))throw Error("ACCESS_DENIED");
        const p=previous?.payload.type==="SESSION"?previous.payload:null,d=input.data;
        if(input.event==="REQUEST")return putRecord(practice,actor.id,input.firm,input.matter,{type:"SESSION",title:d.title,room_id:d.room_id,status:"OPEN",recording_status:"CONSENTING",recorder_id:actor.id,capture_id:d.capture_id,participants:d.participants,started_at:null,stopped_at:null,retention_days:practice.settings.find(s=>s.law_firm_id===input.firm)?.retention_days??null});
        if(!p||!previous)throw Error("SESSION_NOT_FOUND");
        if(input.event==="CONSENT")return putRecord(practice,actor.id,input.firm,input.matter,{...p,participants:d.participants},previous);
        if(input.event==="START"){if(p.recording_status!=="CONSENTING"||p.participants.some(x=>x.consent!=="ACCEPTED"))throw Error("SESSION_CONSENT_REQUIRED");return putRecord(practice,actor.id,input.firm,input.matter,{...p,recording_status:"RECORDING",started_at:new Date().toISOString()},previous)}
        if(input.event==="STOP")return putRecord(practice,actor.id,input.firm,input.matter,{...p,recording_status:"STOPPED",status:"CLOSED",stopped_at:new Date().toISOString()},previous);
        if(input.event==="UPLOAD"){
          if(p.recorder_id!==actor.id||p.capture_id!==d.capture_id||!p.started_at||!(["RECORDING","STOPPED"].includes(p.recording_status))||p.stopped_at&&Date.now()-Date.parse(p.stopped_at)>120000)throw Error("SESSION_CAPTURE_CLOSED");
          const existing=practice.records.find(r=>r.payload.type==="RECORDING"&&r.payload.capture_id===d.capture_id&&r.payload.sequence===d.sequence);
          if(existing){if(existing.payload.type!=="RECORDING"||existing.payload.sha256!==d.sha256)throw Error("RECORDING_SEQUENCE_CONFLICT");return existing}
          return putRecord(practice,actor.id,input.firm,input.matter,{type:"RECORDING",session_id:previous.id,capture_id:d.capture_id,sequence:d.sequence,sha256:d.sha256,bytes:d.bytes,mime:d.mime,object_key:d.object_key,withdrawn_at:null});
        }
        throw Error("SESSION_EVENT_UNKNOWN");
      });await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  }
  async portal(token:string,body:unknown){
    const client=await this.pool.connect();
    try{await client.query("BEGIN");const state=await this.raw(client,true);const store=this.store(state,async s=>{await client.query("UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",[s]);});
      const data=await store.transaction((tx,_pilot,_team,practice)=>executePortal(tx,practice,token,body));
      await client.query("COMMIT");return data;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
  async hierarchyReady() {
    if (!(await this.configured())) return true;
    return (await this.raw()).hierarchy_version === 1;
  }
  async migrateHierarchy(directory: Identity[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const state = await this.raw(client, true);
      if (state.hierarchy_version === 1) {
        await client.query("COMMIT");
        return { changed: false };
      }
      const real = new Set(directory.map((person) => person.id));
      if (
        state.tables.memberships.some(
          (m) =>
            m.active &&
            real.has(m.identity_id) &&
            !["ADMINISTRATOR", "LAWYER"].includes(m.role),
        )
      )
        throw Error(
          "Revisá la correspondencia de roles históricos antes de activar Dirección y Abogados.",
        );
      const before = hash(JSON.stringify(state));
      for (const task of state.tables.tasks) {
        task.assigned_by ??=
          state.tables.activities.find(
            (a) => a.resource_id === task.id && a.action === "TASK_CREATED",
          )?.actor_identity_id ??
          state.tables.activities.find(
            (a) =>
              a.resource_id === task.draft_review_id &&
              a.action === "REVIEW_REQUESTED",
          )?.actor_identity_id ??
          task.responsible_identity_id;
        task.assignment_revision ??= 0;
      }
      state.hierarchy_version = 1;
      state.revision++;
      parseSnapshot(JSON.stringify(state));
      await client.query(directorAccessSql);
      await client.query(
        "UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",
        [state],
      );
      await client.query(
        "INSERT INTO os_private.platform_access_log(actor_id,operation) VALUES('system:roles',$1)",
        ["director-lawyer-v1:" + before],
      );
      await client.query("COMMIT");
      return {
        changed: true,
        original_hash: before,
        tasks_preserved: state.tables.tasks.length,
        originals_preserved: state.tables.documentVersions.length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async director(actor: Identity, directory: Identity[], firmId: string) {
    const state = await this.raw();
    return this.store(state).transaction(async (tx) => {
      const principal = (await this.authenticator(
        actor,
        directory,
      ).authenticate(actor.id))!;
      return new Authorization().director(tx, principal, firmId);
    });
  }
  async tickDeadlines(now = new Date().toISOString()) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query(
        "SELECT 1 FROM os_private.platform_state",
      );
      if (!exists.rowCount) {
        await client.query("COMMIT");
        return;
      }
      const state = await this.raw(client, true);
      let changed = false;
      state.tables.tasks = state.tables.tasks.map((task) => {
        const next = advanceDeadlineAlerts(
          task,
          state.tables.memberships.filter((member) =>
            state.identities?.some(
              (person) => person.id === member.identity_id && person.active,
            ),
          ),
          state.tables.participants,
          now,
          randomUUID,
        );
        if (JSON.stringify(next) !== JSON.stringify(task)) changed = true;
        return next;
      });
      if (changed) {
        state.revision++;
        parseSnapshot(JSON.stringify(state));
        await client.query(
          "UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",
          [state],
        );
        await client.query(
          "INSERT INTO os_private.platform_access_log(actor_id,operation) VALUES('system:deadlines','deadline-alerts-generated')",
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async initialize() {
    await this.pool
      .query(`CREATE TABLE IF NOT EXISTS os_private.platform_state (
      id boolean PRIMARY KEY DEFAULT true CHECK(id), snapshot jsonb NOT NULL, owner_id text NOT NULL,
      migration_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS os_private.platform_commands (
      actor_id text NOT NULL, command_id uuid NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,command_id));
      CREATE TABLE IF NOT EXISTS os_private.platform_access_log (
      id bigserial PRIMARY KEY, actor_id text NOT NULL, operation text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS os_private.platform_invitations (
      token_hash text PRIMARY KEY, email text NOT NULL, firm_id text NOT NULL, role text NOT NULL,
      expires_at timestamptz NOT NULL, accepted_by text, created_by text NOT NULL);
      REVOKE ALL ON os_private.platform_state,os_private.platform_commands,os_private.platform_access_log,os_private.platform_invitations FROM PUBLIC;`);
  }
  async configured() {
    return !!(await this.pool.query("SELECT 1 FROM os_private.platform_state"))
      .rowCount;
  }
  async raw(
    client: Pool | PoolClient = this.pool,
    lock = false,
  ): Promise<Snapshot> {
    const row = (
      await client.query(
        "SELECT snapshot FROM os_private.platform_state WHERE id=true" +
          (lock ? " FOR UPDATE" : ""),
      )
    ).rows[0];
    if (!row) throw Error("La instalación central todavía no está activada.");
    return parseSnapshot(JSON.stringify(row.snapshot));
  }
  private store(snapshot: Snapshot, commit?: (s: Snapshot) => Promise<void>) {
    let raw = JSON.stringify(snapshot);
    return new BrowserPersistence({
      getItem: () => raw,
      setItem: () => {
        throw Error("WRITE_REQUIRES_TRANSACTION");
      },
      setItemAsync: async (_key, value) => {
        const next = parseSnapshot(value);
        if (!commit) throw Error("READ_ONLY");
        await commit(next);
        raw = value;
      },
    });
  }
  private authenticator(actor: Identity, directory: Identity[]): Authenticator {
    return {
      authenticate: async (id) =>
        id === actor.id && actor.active
          ? {
              identity_id: actor.id,
              subject: actor.subject,
              session_id: "authenticated-local-session",
              expires_at: "2999-01-01T00:00:00.000Z",
            }
          : null,
      identity: async (id) => {
        const person = directory.find((p) => p.id === id);
        if (person) return person;
        const historical = LOCAL_PROFILES.find((p) => p.id === id);
        return historical ? { ...historical, active: false } : null;
      },
    };
  }
  async validateMigration(raw: string | null) {
    const state = raw
      ? parseSnapshot(raw)
      : {
          format: "LAW_ORDER_LOCAL" as const,
          schema_version: 1 as const,
          revision: 0,
          tables: Object.fromEntries(
            TABLES.map((t) => [t, []]),
          ) as unknown as Snapshot["tables"],
        };
    const verifier = this.store(state, async () => {});
    await verifier.importBackup(JSON.stringify(state));
    return state;
  }
  private async syncAccess(client: Pool | PoolClient, state: Snapshot) {
    // Relational editor metadata follows the authoritative Core state, including revocations.
    for (const p of [...LOCAL_PROFILES, ...(state.identities ?? [])])
      await client.query(
        "INSERT INTO os_private.identities(id,subject,display_name,active) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,active=EXCLUDED.active",
        [p.id, p.subject, p.display_name, p.active],
      );
    for (const table of ["memberships", "participants"] as const)
      for (const row of state.tables[table]) {
        const parent = table === "memberships" ? "lawFirms" : "matters";
        const id =
          table === "memberships"
            ? row.law_firm_id
            : (row as Snapshot["tables"]["participants"][number]).matter_id;
        await client.query(
          `INSERT INTO os_private."${table}"(data) SELECT $1::jsonb WHERE EXISTS(SELECT 1 FROM os_private."${parent}" WHERE id=$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`,
          [row, id],
        );
      }
  }
  async activate(raw: string | null, owner: Identity) {
    const state = await this.validateMigration(raw);
    // Validate original bytes and historic audit manifests before accepting a migration.
    let verified = state;
    const verifier = this.store(state, async (s) => {
      verified = s;
    });
    await verifier.importBackup(JSON.stringify(state));
    const sourceHash = hash(JSON.stringify(state));
    verified.identities = [
      ...(verified.identities ?? []).filter((i) => i.id !== owner.id),
      owner,
    ];
    verified.hierarchy_version = 1;
    for (const task of verified.tables.tasks) {
      task.assigned_by ??=
        verified.tables.activities.find(
          (a) => a.resource_id === task.id && a.action === "TASK_CREATED",
        )?.actor_identity_id ?? task.responsible_identity_id;
      task.assignment_revision ??= 0;
    }
    for (const firm of verified.tables.lawFirms) {
      verified.tables.memberships.push({
        id: randomUUID(),
        law_firm_id: firm.id,
        identity_id: owner.id,
        role: "ADMINISTRATOR",
        active: true,
        created_at: new Date().toISOString(),
      });
      for (const matter of verified.tables.matters.filter(
        (m) => m.law_firm_id === firm.id,
      ))
        verified.tables.participants.push({
          id: randomUUID(),
          law_firm_id: firm.id,
          matter_id: matter.id,
          identity_id: owner.id,
          permissions: [...ALL_MATTER_PERMISSIONS],
          active: true,
          created_at: new Date().toISOString(),
        });
    }
    parseSnapshot(JSON.stringify(verified));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('os.actor',$1,true)", [owner.id]);
      await client.query(directorAccessSql);
      await client.query(
        "INSERT INTO os_private.platform_state(id,snapshot,owner_id,migration_hash) VALUES(true,$1,$2,$3)",
        [verified, owner.id, sourceHash],
      );
      await this.syncAccess(client, verified);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return {
      original_hash: sourceHash,
      studies: state.tables.lawFirms.length,
      documents: state.tables.documents.length,
      original_versions: state.tables.documentVersions.length,
    };
  }
  async owner(actor: string) {
    return (
      (
        await this.pool.query(
          "SELECT owner_id FROM os_private.platform_state WHERE id=true",
        )
      ).rows[0]?.owner_id === actor
    );
  }
  async view(actor: Identity, directory: Identity[], state?: Snapshot) {
    state ??= await this.raw();
    const store = this.store(state),
      auth = this.authenticator(actor, directory),
      visible = structuredClone(state);
    // Practice records have their own per-module field/role filters; never cache the private ledger or portal grants in the general snapshot.
    delete visible.practice;
    const firms = new Set(
      state.tables.memberships
        .filter((m) => m.identity_id === actor.id && m.active)
        .map((m) => m.law_firm_id),
    );
    const matters = new Set<string>();
    const clientFirms = new Set<string>();
    const core = new OsCoreService(store, auth);
    for (const firm of firms) {
      try {
        await core.listClients(actor.id, firm);
        clientFirms.add(firm);
      } catch (error) {
        if ((error as { code?: string }).code !== "ACCESS_DENIED") throw error;
      }
    }
    await store.transaction(async (tx) => {
      const principal = (await auth.authenticate(actor.id))!;
      for (const m of state.tables.matters.filter((m) =>
        firms.has(m.law_firm_id),
      )) {
        try {
          await new Authorization().matter(
            tx,
            principal,
            m.law_firm_id,
            m.id,
            "READ",
          );
          matters.add(m.id);
        } catch {
          /* Exclude an inaccessible case. */
        }
      }
    });
    for (const table of TABLES)
      (visible.tables[table] as any[]) = state.tables[table].filter((r: any) =>
        table === "lawFirms"
          ? firms.has(r.id)
          : firms.has(r.law_firm_id) &&
            (!r.matter_id || matters.has(r.matter_id)) &&
            (table !== "matters" || matters.has(r.id)),
      );
    // Keep schema references for read-only case access without exposing a forbidden client directory.
    const contactIds = new Set(
      visible.tables.relatedParties.map((p) => p.contact_id),
    );
    visible.tables.contacts = visible.tables.contacts
      .filter((c) => clientFirms.has(c.law_firm_id) || contactIds.has(c.id))
      .map((c) =>
        clientFirms.has(c.law_firm_id)
          ? c
          : {
              ...c,
              display_name: "Contacto reservado",
              email: null,
              phone: null,
            },
      );
    const clientIds = new Set([
      ...visible.tables.matters.map((m) => m.client_id),
      ...visible.tables.contacts.map((c) => c.client_id),
    ]);
    visible.tables.clients = visible.tables.clients
      .filter((c) => clientFirms.has(c.law_firm_id) || clientIds.has(c.id))
      .map((c) =>
        clientFirms.has(c.law_firm_id)
          ? c
          : {
              ...c,
              display_name: "Cliente reservado",
              identification: null,
            },
      );
    for (const key of ["legal_team", "specialist_pilot"] as const)
      if (visible[key])
        for (const [field, entries] of Object.entries(visible[key]!))
          if (Array.isArray(entries))
            (visible[key] as any)[field] = entries.filter(
              (e: any) =>
                firms.has(e.law_firm_id) &&
                (!e.matter_id || matters.has(e.matter_id)),
            );
    const ids = new Set(visible.tables.memberships.map((m) => m.identity_id));
    ids.add(actor.id);
    const profiles = directory.filter((p) => ids.has(p.id));
    // Keep identity references needed to validate historical records; names are not credentials.
    const serialized =
      JSON.stringify(visible.tables) +
      JSON.stringify(visible.legal_team ?? {}) +
      JSON.stringify(visible.specialist_pilot ?? {});
    visible.identities = (state.identities ?? []).filter(
      (i) => i.id === actor.id || serialized.includes(JSON.stringify(i.id)),
    );
    parseSnapshot(JSON.stringify(visible));
    return { identity: actor, profiles, snapshot: visible };
  }
  async command(
    actor: Identity,
    directory: Identity[],
    path: string,
    body: unknown,
    commandId?: string,
    knownRevision?: number,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('os.actor',$1,true)", [actor.id]);
      const state = await this.raw(client, true);
      state.identities = [
        ...(state.identities ?? []).filter(
          (p) => !directory.some((d) => d.id === p.id),
        ),
        ...directory,
      ];
      const fingerprint = hash(JSON.stringify([path, body]));
      if (body !== undefined) {
        if (!commandId || !/^[a-f0-9-]{36}$/i.test(commandId))
          throw Error("Falta identificador del comando.");
        const prior = (
          await client.query(
            "SELECT fingerprint,result FROM os_private.platform_commands WHERE actor_id=$1 AND command_id=$2",
            [actor.id, commandId],
          )
        ).rows[0];
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw Error("El identificador ya corresponde a otro pedido.");
          const parts = path.split("/").filter(Boolean),
            principal = (await this.authenticator(
              actor,
              directory,
            ).authenticate(actor.id))!;
          if (parts[0] === "firms" && parts[1])
            await this.store(state).transaction(async (tx) => {
              const authorization = new Authorization();
              await authorization.membership(tx, principal, parts[1]!);
              if(parts[2]==="practice")await authorizePractice(tx,state.practice??emptyPractice(),principal,parts[1]!,parts[3]??"",body as Record<string,any>);
              if (parts[2] === "memberships")
                await authorization.director(tx, principal, parts[1]!);
              if (parts[2] === "matters" && parts.length === 3)
                await authorization.assignment(
                  tx,
                  principal,
                  parts[1]!,
                  (body as any).responsible_identity_id,
                );
              if (parts[2] === "matters" && parts[3])
                await authorization.matter(
                  tx,
                  principal,
                  parts[1]!,
                  parts[3],
                  "READ",
                );
              // A command receipt cannot recover revoked authority after a role change.
              if (parts[2] === "matters" && parts[3] && body) {
                const b = body as Record<string, any>;
                if (
                  ["tasks", "deadlines", "direction-requests"].includes(
                    parts[4] ?? "",
                  )
                )
                  await authorization.matter(
                    tx,
                    principal,
                    parts[1]!,
                    parts[3],
                    "TASK_WRITE",
                  );
                if (
                  parts[4] === "participants" ||
                  parts[4] === "responsible" ||
                  (parts[4] === "direction-requests" &&
                    parts[6] === "resolution") ||
                  (parts[4] === "drafts" && parts[6] === "reviews")
                )
                  await authorization.director(tx, principal, parts[1]!);
                if (
                  (parts[4] === "tasks" || parts[4] === "deadlines") &&
                  parts.length === 5
                )
                  await authorization.assignment(
                    tx,
                    principal,
                    parts[1]!,
                    b.responsible_identity_id,
                  );
                if (parts[4] === "tasks" && parts[5]) {
                  const task = await tx.get("tasks", parts[5]);
                  if (
                    !task ||
                    task.law_firm_id !== parts[1] ||
                    task.matter_id !== parts[3]
                  )
                    throw Error("ACCESS_DENIED");
                  if (parts[6] === "assignment") {
                    await authorization.assignment(
                      tx,
                      principal,
                      parts[1]!,
                      b.input?.responsible_identity_id,
                    );
                    if (
                      task.responsible_identity_id !== actor.id ||
                      (task.assigned_by ?? task.responsible_identity_id) !==
                        actor.id
                    )
                      await authorization.director(tx, principal, parts[1]!);
                  } else if (task.responsible_identity_id !== actor.id)
                    await authorization.director(tx, principal, parts[1]!);
                  if (
                    parts[6] === "status" &&
                    b.status !== "DONE" &&
                    (task.assigned_by ?? task.responsible_identity_id) !==
                      actor.id
                  )
                    await authorization.director(tx, principal, parts[1]!);
                }
                if (parts[4] === "deadlines" && parts[5]) {
                  const task = await tx.get("tasks", parts[5]);
                  if (
                    !task ||
                    task.law_firm_id !== parts[1] ||
                    task.matter_id !== parts[3]
                  )
                    throw Error("ACCESS_DENIED");
                  if (
                    task.responsible_identity_id !== actor.id ||
                    (parts[6] !== "confirmation" &&
                      (task.assigned_by ?? task.responsible_identity_id) !==
                        actor.id)
                  )
                    await authorization.director(tx, principal, parts[1]!);
                }
              }
            });
          await client.query("COMMIT");
          const visible = await this.view(actor, directory);
          const replay = structuredClone(prior.result);
          if (parts[2] === "deadline-inbox" && Array.isArray(replay.data)) {
            const allowed = new Set(
              visible.snapshot.tables.matters.map((matter) => matter.id),
            );
            replay.data = replay.data.filter((entry: { matter_id: string }) =>
              allowed.has(entry.matter_id),
            );
          }
          return { ...replay, ...visible };
        }
      }
      const store = this.store(state, async (s) => {
        await client.query(
          "UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",
          [s],
        );
      });
      const data = await executeCoreCommand(
        store,
        actor,
        this.authenticator(actor, directory),
        path,
        body,
        [],
        "VERIFIED_REAL",
      );
      if (body !== undefined) await this.syncAccess(client, store.snapshot());
      const result =
        data instanceof Blob
          ? {
              blob: {
                type: data.type,
                base64: Buffer.from(await data.arrayBuffer()).toString(
                  "base64",
                ),
              },
            }
          : { data };
      if (body !== undefined)
        await client.query(
          "INSERT INTO os_private.platform_commands(actor_id,command_id,fingerprint,result) VALUES($1,$2,$3,$4)",
          [actor.id, commandId, fingerprint, result],
        );
      await client.query(
        "INSERT INTO os_private.platform_access_log(actor_id,operation) VALUES($1,$2)",
        [actor.id, path],
      );
      await client.query("COMMIT");
      const latest = store.snapshot();
      return {
        ...result,
        ...(knownRevision === latest.revision
          ? {}
          : await this.view(actor, directory, latest)),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async mergeCheckpoint(
    actor: Identity,
    directory: Identity[],
    result: { document: any; draft: any; version: any },
    roomId: string,
  ) {
    await this.grant(actor, result.draft, true);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('os.actor',$1,true)", [actor.id]);
      const state = await this.raw(client, true);
      state.identities = [
        ...(state.identities ?? []).filter(
          (p) => !directory.some((d) => d.id === p.id),
        ),
        ...directory,
      ];
      const latest = (
        await client.query(
          "SELECT checkpoint_version_id FROM os_private.workspace_documents WHERE id=$1",
          [roomId],
        )
      ).rows[0];
      if (latest?.checkpoint_version_id !== result.version.id) {
        await client.query("COMMIT");
        return;
      }
      const store = this.store(state, async (next) => {
        await client.query(
          "UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",
          [next],
        );
      });
      await store.transaction(async (tx) => {
        const draft = await tx.get("drafts", result.draft.id);
        if (!draft || draft.matter_id !== result.draft.matter_id)
          throw Error("WORKSPACE_NOT_FOUND");
        if (!(await tx.get("documentVersions", result.version.id)))
          await tx.insert("documentVersions", result.version);
        await tx.replace("documents", result.document);
        await tx.replace("drafts", result.draft);
        for (const review of await tx.list("reviews", draft))
          if (review.draft_id === draft.id && review.status === "PENDING") {
            await tx.replace("reviews", { ...review, status: "SUPERSEDED" });
            for (const task of await tx.list("tasks", draft))
              if (task.draft_review_id === review.id)
                await tx.replace("tasks", { ...task, status: "CANCELLED" });
          }
      });
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async seed(actor: Identity, directory: Identity[], raw: any) {
    const view = await this.view(actor, directory);
    const s = view.snapshot.tables,
      draft = s.drafts.find((d) => d.id === raw.draft?.id);
    if (!draft || raw.actor_id !== actor.id)
      throw Error("WORKSPACE_ACCESS_DENIED");
    const matter = s.matters.find((m) => m.id === draft.matter_id)!;
    return WorkspaceSeedSchema.parse({
      ...raw,
      synthetic_data: false,
      actor_id: actor.id,
      firm: s.lawFirms.find((f) => f.id === draft.law_firm_id),
      matter,
      client: s.clients.find((c) => c.id === matter.client_id),
      draft,
      document: s.documents.find((d) => d.id === draft.document_id),
      version: s.documentVersions.find(
        (v) => v.id === draft.document_version_id,
      ),
      memberships: s.memberships.filter(
        (m) => m.law_firm_id === draft.law_firm_id,
      ),
      participants: s.participants.filter(
        (p) => p.matter_id === draft.matter_id,
      ),
    });
  }
  async grant(
    actor: Identity,
    room: { law_firm_id: string; matter_id: string },
    write: boolean,
  ) {
    const s = await this.raw();
    await this.store(s).transaction(async (tx: CoreTransaction) => {
      await new Authorization().matter(
        tx,
        {
          identity_id: actor.id,
          subject: actor.subject,
          session_id: "local-session",
          expires_at: "2999-01-01T00:00:00.000Z",
        },
        room.law_firm_id,
        room.matter_id,
        write ? "DRAFT_WRITE" : "READ",
      );
    });
  }
}
