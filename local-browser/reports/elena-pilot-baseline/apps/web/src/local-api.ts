import { OsCoreService } from "../../../os-core/src/service.js";
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

export const localMode = import.meta.env.VITE_DATA_MODE !== "server";
const PROFILE_KEY = "law-order-os.local.profile";
export function currentProfile(): Identity {
  return (
    LOCAL_PROFILES.find((p) => p.id === localStorage.getItem(PROFILE_KEY)) ??
    LOCAL_PROFILES[0]
  );
}
export function selectLocalProfile(id: string) {
  if (!LOCAL_PROFILES.some((p) => p.id === id))
    throw Error("Perfil local desconocido.");
  localStorage.setItem(PROFILE_KEY, id);
}
let storage: BrowserPersistence | undefined;
export function browserStore(): BrowserPersistence {
  return (storage ??= new BrowserPersistence(localStorage));
}
// Workflow profile selection, explicitly NOT authentication. Server mode retains its own real authenticator.
const profiles: Authenticator = {
  authenticate: async (id) => {
    const p = LOCAL_PROFILES.find((p) => p.id === id);
    return p
      ? {
          identity_id: p.id,
          subject: p.subject,
          session_id: "local-profile",
          expires_at: "2999-01-01T00:00:00.000Z",
        }
      : null;
  },
  identity: async (id) => LOCAL_PROFILES.find((p) => p.id === id) ?? null,
};
export async function localRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  const actor = currentProfile();
  if (path === "/session") {
    const state = browserStore().snapshot();
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
  return browserStore().transaction(async (tx) => {
    const scoped: CorePersistence = {
      assurance: "LOCAL_BROWSER_UNAUTHENTICATED",
      transaction: async (operation) => operation(tx),
    };
    const core = new OsCoreService(scoped, profiles),
      credential = actor.id;
    const b = (body ?? {}) as Record<string, any>;
    const write = body !== undefined;
    if (path === "/firms" && write) {
      const f = await core.createLawFirm(credential, b.name);
      for (const p of LOCAL_PROFILES)
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
            task.status === "PENDING" &&
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
    if (parts[2] !== "matters") throw new CoreError("LOCAL_ROUTE_UNAVAILABLE");
    if (parts.length === 3)
      return write
        ? core.createMatter(credential, firm, b as never)
        : core.listMatters(credential, firm);
    if (parts.length === 4 && !write) return core.getMatter(...args);
    const resource = parts[4],
      resourceId = parts[5]!;
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
    )
      return core.listMatterResources(
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
    if (resource === "activity" && !write) return core.matterActivity(...args);
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
    if (resource === "tasks" && write)
      return parts[6] === "status"
        ? core.updateTaskStatus(...args, resourceId, b.status)
        : core.createTask(...args, b as never);
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
        type: "text/plain;charset=utf-8",
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
