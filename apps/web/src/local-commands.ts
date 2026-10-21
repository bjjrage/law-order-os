import { OsCoreService } from "../../../os-core/src/service.js";
import { executePractice, practiceView } from "../../../os-core/src/practice.js";
import {
  CoreError,
  type Authenticator,
  type CorePersistence,
  type Identity,
  type TableName,
  type Task,
} from "../../../os-core/src/contracts.js";
import { decodeBase64 } from "../../../os-core/src/bytes.js";
import { BrowserPersistence, LOCAL_PROFILES } from "./local-storage.js";
import { strToU8, zipSync } from "fflate";
import { documentRemoved } from "./document-lifecycle.js";

export async function executeCoreCommand(
  store: BrowserPersistence,
  actor: Identity,
  profiles: Authenticator,
  path: string,
  body?: unknown,
  autoProfiles: readonly Identity[] = LOCAL_PROFILES,
  assurance: CorePersistence["assurance"] = "LOCAL_BROWSER_UNAUTHENTICATED",
): Promise<unknown> {
  if (path === "/session") {
    const state = store.snapshot();
    return {
      identity: actor,
      csrf: "",
      firms: state.tables.lawFirms.filter((f) =>
        state.tables.memberships.some(
          (m) =>
            m.law_firm_id === f.id && m.identity_id === actor.id && m.active,
        ),
      ),
    };
  }
  const parts = path.split("/").filter(Boolean),
    firm = parts[1]!,
    matter = parts[3]!;
  // Every command, including multipart incorporation and review conflict checks, commits once.
  return store.transaction(async (tx, pilot, team, practice) => {
    const scoped: CorePersistence = {
      assurance,
      transaction: async (operation) => operation(tx),
    };
    const core = new OsCoreService(scoped, profiles),
      credential = actor.id;
    const b = (body ?? {}) as Record<string, any>;
    const write = body !== undefined;
    if(parts[0]==="firms"&&parts[2]==="practice"){
      const principal=await profiles.authenticate(actor.id);if(!principal)throw new CoreError("UNAUTHENTICATED");
      return write?executePractice(tx,practice,core,profiles,principal,firm,parts[3]??"",body):practiceView(tx,practice,principal,firm);
    }
    if (path === "/firms" && write) {
      const f = await core.createLawFirm(credential, b.name);
      for (const p of autoProfiles)
        if (p.id !== actor.id)
          await core.addMember(credential, f.id, p.id, "LAWYER");
      return f;
    }
    if (parts[0] !== "firms") throw new CoreError("LOCAL_ROUTE_UNAVAILABLE");
    const args = [credential, firm, matter] as const;
    if (parts.length === 2 && !write) return core.getLawFirm(credential, firm);
    if (parts[2] === "memberships") {
      if (parts.length === 3)
        return write
          ? core.addMember(credential, firm, b.identity_id, b.role)
          : core.listMembers(credential, firm);
      if (parts[4] === "deactivation" && write)
        return core.deactivateMember(credential, firm, parts[3]!);
    }
    if (parts[2] === "clients" && parts.length === 3)
      return write
        ? core.createClient(credential, firm, b as never)
        : core.listClients(credential, firm);
    if (parts[2] === "dashboard" && parts.length === 3 && !write) {
      const { dashboard } = await import("./local-team.js");
      return dashboard(core, actor.id, firm);
    }
    if (
      parts[2] === "director" &&
      parts[3] === "link" &&
      parts.length === 4 &&
      write
    ) {
      const { linkDirector } = await import("./local-team.js");
      const principal = await profiles.authenticate(actor.id);
      if (!principal) throw new CoreError("UNAUTHENTICATED");
      return linkDirector(tx, team, principal, firm, body, core);
    }
    if (
      parts[2] === "director" &&
      parts[3] === "context" &&
      parts.length === 4 &&
      write
    ) {
      const { confirmDirectorContext } = await import("./local-team.js");
      const principal = await profiles.authenticate(actor.id);
      if (!principal) throw new CoreError("UNAUTHENTICATED");
      return confirmDirectorContext(tx, team, principal, firm, body, core);
    }
    if (parts[2] === "my-day" && !write) {
      const matters = await core.listMatters(credential, firm);
      const tasks: Array<Task & { matter_title: string }> = [];
      for (const m of matters)
        for (const task of await core.listMatterResources(
          credential,
          firm,
          m.id,
          "tasks",
        ))
          if (
            !task.direction_request && task.status === "PENDING" &&
            task.responsible_identity_id === actor.id
          )
            tasks.push({ ...task, matter_title: m.title });
      tasks.sort(
        (a, b) =>
          (a.internal_due_at ?? "9999").localeCompare(
            b.internal_due_at ?? "9999",
          ) || a.id.localeCompare(b.id),
      );
      return { tasks };
    }
    if (parts[2] === "deadline-inbox" && parts.length === 3 && write)
      return core.deadlineInbox(credential, firm);
    if (parts[2] === "work" && !write) return core.workBoard(credential, firm, parts[3] === "team");
    if (parts[2] !== "matters") throw new CoreError("LOCAL_ROUTE_UNAVAILABLE");
    if (parts.length === 3)
      return write
        ? core.createMatter(credential, firm, b as never)
        : core.listMatters(credential, firm);
    if (parts.length === 4 && !write) return core.getMatter(...args);
    const resource = parts[4],
      resourceId = parts[5]!;
    if (resource === "legal-team") {
      const { handleTeam } = await import("./local-team.js");
      const principal = await profiles.authenticate(actor.id);
      if (!principal) throw new CoreError("UNAUTHENTICATED");
      if (body !== undefined && ["assign", "prepare", "run"].includes(resourceId)) {
        await core.getMatter(...args);
        throw new CoreError("LEGAL_WORKFLOW_UNIFIED");
      }
      const examples = pilot.fixture_commands
        .filter(
          (command) =>
            command.law_firm_id === firm && command.matter_id === matter,
        )
        .flatMap((command) => command.document_ids);
      return handleTeam(
        tx,
        team,
        principal,
        firm,
        matter,
        resourceId ?? "state",
        body,
        core,
        examples,
      );
    }
    if (resource === "contractual-pilot") {
      const { handleLocalSpecialist } = await import("./local-specialist.js");
      const principal = await profiles.authenticate(actor.id);
      if (!principal) throw new CoreError("UNAUTHENTICATED");
      return handleLocalSpecialist(
        tx,
        pilot,
        principal,
        firm,
        matter,
        resourceId ?? "state",
        body,
        core,
        credential,
        team.document_changes,
      );
    }
    if (
      parts.length === 5 &&
      !write &&
      [
        "documents",
        "tasks",
        "drafts",
        "reviews",
        "participants",
        "proceedings",
        "deliveries",
        "documentVersions",
      ].includes(resource!)
    ) {
      const rows = await core.listMatterResources(
        ...args,
        resource as Exclude<
          TableName,
          | "lawFirms"
          | "memberships"
          | "clients"
          | "contacts"
          | "relatedParties"
          | "matters"
          | "activities"
        >,
      );
      return resource === "documents"
        ? rows.filter((row) => !documentRemoved(team.document_changes, row.id))
        : rows;
    }
    if (resource === "activity" && !write) return core.matterActivity(...args);
    if (resource === "tasks" && parts[6] === "deadline-source" && !write) {
      const version = await core.getDeadlineSource(...args, resourceId);
      return new Blob(
        [Uint8Array.from(decodeBase64(version.original_base64))],
        { type: version.mime_type },
      );
    }
    if (resource === "responsible" && write)
      return core.reassignMatter(
        ...args,
        b.identity_id,
        b.expected_responsible_id,
      );
    if (resource === "participants" && write)
      return parts[6] === "revocation"
        ? core.revokeParticipant(...args, resourceId)
        : core.grantParticipant(...args, b.identity_id, b.permissions);
    if (resource === "tasks" && write) {
      if (parts[6] === "status") return core.updateTaskStatus(...args, resourceId, b.status, b.expected_deadline_revision);
      if (parts[6] === "assignment") return core.reviseTask(...args, resourceId, b.input, b.expected_revision);
      if (parts[6] === "progress") return core.recordTaskProgress(...args, resourceId, b.note, b.state);
      if (parts.length === 5) return core.createTask(...args, b as never);
    }
    if (resource === "direction-requests" && write) return parts[6] === "resolution"
      ? core.resolveDirection(...args, resourceId, b as never) : core.requestDirection(...args, b as never);
    if (resource === "deadlines" && write) {
      if (parts.length === 5) return core.createDeadline(...args, b as never);
      if (parts[6] === "revision")
        return core.reviseDeadline(
          ...args,
          resourceId,
          b.input,
          b.expected_revision,
          b.reason,
        );
      if (parts[6] === "confirmation")
        return core.confirmDeadline(...args, resourceId, b.expected_revision);
      if (parts[6] === "acknowledgement")
        return core.acknowledgeDeadlineAlert(...args, resourceId, b.alert_id);
    }
    if (resource === "proceedings" && write)
      return core.createProceeding(...args, b as never);
    if (resource === "deliveries" && write)
      return core.recordDelivery(...args, b as never);
    if (resource === "originals" && write) {
      if (typeof b.original_base64 !== "string" || b.mime_type !== "text/plain")
        throw new CoreError("INVALID_DOCUMENT_BYTES");
      const bytes = decodeBase64(b.original_base64);
      if (!bytes.length || bytes.length > 1024 * 1024)
        throw Error("El archivo local debe tener entre 1 byte y 1 MiB.");
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const doc = await core.createDocument(...args, { title: b.title });
      const version = await core.addDocumentVersion(...args, doc.id, bytes, {
        mime_type: "text/plain",
        original_filename: b.original_filename,
      });
      const document = await core.publishDocumentVersion(
        ...args,
        doc.id,
        version.id,
        null,
      );
      return { document, version_id: version.id, sha256: version.sha256 };
    }
    if (resource === "drafts" && write) {
      if (parts.length === 5)
        return core.prepareDraft(...args, b.title, b.content);
      if (parts[6] === "versions")
        return core.reviseDraft(
          ...args,
          resourceId,
          b.expected_version_id,
          b.content,
        );
      if (parts[6] === "reviews") {
        const d = await core.getDraft(...args, resourceId);
        if (d.document_version_id !== b.expected_version_id)
          throw new CoreError("VERSION_CONFLICT");
        return core.requestDraftReview(
          ...args,
          resourceId,
          b.reviewer_identity_id,
          b.internal_due_at,
        );
      }
    }
    if (resource === "reviews" && parts[6] === "decisions" && write)
      return core.decideDraftReview(...args, resourceId, b as never);
    if (
      resource === "documents" &&
      parts[6] === "versions" &&
      parts[8] === "content" &&
      !write
    ) {
      const v = await core.getDocumentVersion(...args, resourceId, parts[7]!);
      return new Blob([Uint8Array.from(decodeBase64(v.original_base64))], {
        type: v.mime_type,
      });
    }
    if (resource === "annexes" && !write) {
      const versions = await core.listMatterResources(
        ...args,
        "documentVersions",
      );
      const files: Record<string, Uint8Array> = {};
      const manifest = [];
      for (const v of [...versions].sort((a, b) => a.id.localeCompare(b.id))) {
        const verified = await core.getDocumentVersion(
          ...args,
          v.document_id,
          v.id,
        );
        files[`${v.id}.txt`] = decodeBase64(verified.original_base64);
        manifest.push({
          id: v.id,
          document_id: v.document_id,
          sha256: v.sha256,
          original_filename: v.original_filename,
        });
      }
      files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
      return new Blob(
        [
          Uint8Array.from(
            zipSync(files, { mtime: new Date(1980, 0, 2), level: 0 }),
          ),
        ],
        { type: "application/zip" },
      );
    }
    throw new CoreError("LOCAL_ROUTE_UNAVAILABLE");
  });
}
