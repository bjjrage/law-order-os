import { sha256, encodeBase64, decodeBase64 } from "./bytes.js";
import { z } from "zod";
import {
  OperationalRoleSchema,
  RequestInputSchema,
  WorkAssignmentSchema,
  taskAssigner,
  isDirectorRole,
  type DirectionRequest,
} from "./work-management.js";
import {
  ScheduledTaskInputSchema,
  calculateDeadline,
  currentDeadline,
  advanceDeadlineAlerts,
  deadlineRecipientAllowed,
  type DeadlineAlert,
  type DeadlineInput,
} from "./deadlines.js";
import { Authorization, ROLE_CAPABILITIES } from "./authorization.js";
import {
  ALL_MATTER_PERMISSIONS,
  ClientInputSchema,
  ContactInputSchema,
  FirmRoleSchema,
  IdSchema,
  MatterInputSchema,
  MatterPermissionSchema,
  RelatedPartyInputSchema,
  TaskInputSchema,
  immutable,
  reject,
  type ActivityAction,
  type AuthenticatedPrincipal,
  type Authenticator,
  type ClientInput,
  type CorePersistence,
  type CoreTransaction,
  type Document,
  type DocumentVersion,
  type Draft,
  type DraftReview,
  type FirmRole,
  type MatterPermission,
  type Task,
} from "./contracts.js";
const PrincipalSchema = z
  .object({
    identity_id: IdSchema,
    subject: z.string().min(1),
    session_id: IdSchema,
    expires_at: z.iso.datetime(),
  })
  .strict();
const TimestampSchema = z.iso.datetime();
const DocumentInputSchema = z
  .object({ title: z.string().min(1).max(240) })
  .strict();
const VersionMetadataSchema = z
  .object({
    mime_type: z.string().min(1).max(100),
    original_filename: z.string().min(1).max(240),
  })
  .strict();
const GrantSchema = z
  .array(MatterPermissionSchema)
  .min(1)
  .max(6)
  .refine(
    (items) => new Set(items).size === items.length && items.includes("READ"),
  );
const WRITERS: readonly FirmRole[] = ["ADMINISTRATOR", "LAWYER"];
const LAWYERS: readonly FirmRole[] = ["ADMINISTRATOR", "LAWYER"];
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) reject("INVALID_INPUT");
  return result.data;
}
function id(value: string): string {
  return parse(IdSchema, value);
}
/** Trusted service boundary. No HTTP/session implementation or production persistence is supplied. */
export class OsCoreService {
  private readonly authorization = new Authorization();
  constructor(
    private readonly persistence: CorePersistence,
    private readonly authenticator: Authenticator,
    private readonly clock: () => Date = () => new Date(),
    private readonly newId: () => string = () => globalThis.crypto.randomUUID(),
  ) {}
  private now(): string {
    return this.clock().toISOString();
  }
  private async run<T>(
    credential: string,
    operation: (
      tx: CoreTransaction,
      actor: AuthenticatedPrincipal,
    ) => T | Promise<T>,
  ): Promise<T> {
    if (typeof credential !== "string" || credential.length === 0)
      reject("UNAUTHENTICATED");
    const authenticated = PrincipalSchema.safeParse(
      await this.authenticator.authenticate(credential),
    );
    if (
      !authenticated.success ||
      Date.parse(authenticated.data.expires_at) <= this.clock().getTime()
    )
      reject("UNAUTHENTICATED");
    const actor = authenticated.data;
    const identity = await this.authenticator.identity(actor.identity_id);
    if (
      !identity?.active ||
      identity.id !== actor.identity_id ||
      identity.subject !== actor.subject
    )
      reject("UNAUTHENTICATED");
    return immutable(
      await this.persistence.transaction((tx) => operation(tx, actor), actor),
    );
  }
  private async activity(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
    matterId: string | null,
    action: ActivityAction,
    resourceId: string,
    versionId: string | null = null,
  ): Promise<void> {
    await tx.insert("activities", {
      id: this.newId(),
      law_firm_id: firmId,
      matter_id: matterId,
      actor_identity_id: actor.identity_id,
      action,
      resource_id: resourceId,
      version_id: versionId,
      created_at: this.now(),
    });
  }
  private assignmentRecord(task: Task, actorId: string) {
    const revision = (task.assignment_revision ?? 0) + 1;
    return {
      assigned_by: actorId,
      assignment_revision: revision,
      assignment_history: [
        ...(task.assignment_history ?? []),
        {
          revision,
          assigned_by: actorId,
          responsible_identity_id: task.responsible_identity_id,
          title: task.title,
          internal_due_at: task.internal_due_at,
          at: this.now(),
        },
      ],
    };
  }
  private async targetMember(
    tx: CoreTransaction,
    firmId: string,
    identityId: string,
    roles?: readonly FirmRole[],
  ) {
    const membership = (
      await tx.list("memberships", { law_firm_id: firmId })
    ).find((item) => item.identity_id === identityId && item.active);
    if (!membership || (roles && !roles.includes(membership.role))) reject();
    return membership;
  }
  private async document(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
    matterId: string,
    documentId: string,
    permission: MatterPermission,
  ): Promise<Document> {
    await this.authorization.matter(
      tx,
      actor,
      id(firmId),
      id(matterId),
      permission,
    );
    const document = await tx.get("documents", id(documentId));
    if (
      !document ||
      document.law_firm_id !== firmId ||
      document.matter_id !== matterId
    )
      reject();
    return document;
  }
  private async incorporate(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    document: Document,
    bytes: Uint8Array,
    metadata: {
      mime_type: string;
      original_filename: string;
    },
  ): Promise<DocumentVersion> {
    const parsed = parse(VersionMetadataSchema, metadata);
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength === 0 ||
      bytes.byteLength > 20 * 1024 * 1024
    )
      reject("INVALID_DOCUMENT_BYTES");
    const copied = Uint8Array.from(bytes);
    const version: DocumentVersion = {
      id: this.newId(),
      law_firm_id: document.law_firm_id,
      matter_id: document.matter_id,
      document_id: document.id,
      original_base64: encodeBase64(copied),
      sha256: await sha256(copied),
      ...parsed,
      incorporated_by: actor.identity_id,
      incorporated_at: this.now(),
    };
    await tx.insert("documentVersions", version);
    await this.activity(
      tx,
      actor,
      document.law_firm_id,
      document.matter_id,
      "VERSION_INCORPORATED",
      document.id,
      version.id,
    );
    return version;
  }
  async createLawFirm(credential: string, name: string) {
    const parsedName = parse(z.string().trim().min(1).max(240), name);
    return this.run(credential, async (tx, actor) => {
      const firm = {
        id: this.newId(),
        name: parsedName,
        created_at: this.now(),
      };
      await tx.insert("lawFirms", firm);
      await tx.insert("memberships", {
        id: this.newId(),
        law_firm_id: firm.id,
        identity_id: actor.identity_id,
        role: "ADMINISTRATOR",
        active: true,
        created_at: this.now(),
      });
      await this.activity(tx, actor, firm.id, null, "FIRM_CREATED", firm.id);
      return firm;
    });
  }
  async getLawFirm(credential: string, firmId: string) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId));
      return (await tx.get("lawFirms", firmId))!;
    });
  }
  async addMember(
    credential: string,
    firmId: string,
    identityId: string,
    role: FirmRole,
  ) {
    id(identityId);
    parse(OperationalRoleSchema, role);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId), [
        "ADMINISTRATOR",
      ]);
      const target = await this.authenticator.identity(identityId);
      if (!target?.active || target.id !== identityId)
        reject("IDENTITY_NOT_AVAILABLE");
      if (
        (await tx.list("memberships", { law_firm_id: firmId })).some(
          (item) => item.identity_id === identityId,
        )
      )
        reject("MEMBERSHIP_ALREADY_EXISTS");
      const member = {
        id: this.newId(),
        law_firm_id: firmId,
        identity_id: identityId,
        role,
        active: true,
        created_at: this.now(),
      };
      await tx.insert("memberships", member);
      await this.activity(tx, actor, firmId, null, "MEMBER_ADDED", member.id);
      return member;
    });
  }
  async deactivateMember(
    credential: string,
    firmId: string,
    identityId: string,
  ) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId), [
        "ADMINISTRATOR",
      ]);
      const member = await this.targetMember(tx, firmId, id(identityId));
      if (member.role === "ADMINISTRATOR") {
        const directors = (
          await tx.list("memberships", { law_firm_id: firmId })
        ).filter((m) => m.active && m.role === "ADMINISTRATOR");
        const active = (
          await Promise.all(
            directors.map((m) => this.authenticator.identity(m.identity_id)),
          )
        ).filter((p) => p?.active);
        if (active.some((p) => p!.id === identityId) && active.length <= 1)
          reject("LAST_ADMINISTRATOR");
      }
      await tx.replace("memberships", { ...member, active: false });
      await this.activity(
        tx,
        actor,
        firmId,
        null,
        "MEMBER_DEACTIVATED",
        member.id,
      );
      return { deactivated: true };
    });
  }
  async createClient(credential: string, firmId: string, input: ClientInput) {
    const parsed = parse(ClientInputSchema, input);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId), WRITERS);
      const client = {
        ...parsed,
        id: this.newId(),
        law_firm_id: firmId,
        created_at: this.now(),
      };
      await tx.insert("clients", client);
      await this.activity(tx, actor, firmId, null, "CLIENT_CREATED", client.id);
      return client;
    });
  }
  async getClient(credential: string, firmId: string, clientId: string) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId), WRITERS);
      const client = await tx.get("clients", id(clientId));
      if (!client || client.law_firm_id !== firmId) reject();
      return client;
    });
  }
  async createContact(
    credential: string,
    firmId: string,
    input: z.infer<typeof ContactInputSchema>,
  ) {
    const parsed = parse(ContactInputSchema, input);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId), WRITERS);
      const client = await tx.get("clients", parsed.client_id);
      if (!client || client.law_firm_id !== firmId) reject();
      const contact = {
        ...parsed,
        id: this.newId(),
        law_firm_id: firmId,
        created_at: this.now(),
      };
      await tx.insert("contacts", contact);
      await this.activity(
        tx,
        actor,
        firmId,
        null,
        "CONTACT_CREATED",
        contact.id,
      );
      return contact;
    });
  }
  async createMatter(
    credential: string,
    firmId: string,
    input: z.infer<typeof MatterInputSchema>,
  ) {
    const parsed = parse(MatterInputSchema, input);
    if (parsed.closed_on !== null) reject("NEW_MATTER_MUST_BE_OPEN");
    return this.run(credential, async (tx, actor) => {
      await this.authorization.assignment(
        tx,
        actor,
        firmId,
        parsed.responsible_identity_id,
      );
      if (
        !(await this.authenticator.identity(parsed.responsible_identity_id))
          ?.active
      )
        reject("INACTIVE_ASSIGNEE");
      await this.authorization.membership(tx, actor, id(firmId), LAWYERS);
      const client = await tx.get("clients", parsed.client_id);
      if (!client || client.law_firm_id !== firmId) reject();
      await this.targetMember(
        tx,
        firmId,
        parsed.responsible_identity_id,
        LAWYERS,
      );
      const matter = {
        ...parsed,
        id: this.newId(),
        law_firm_id: firmId,
        status: "OPEN" as const,
        created_at: this.now(),
      };
      await tx.insert("matters", matter);
      for (const identityId of new Set([
        actor.identity_id,
        parsed.responsible_identity_id,
      ]))
        await tx.insert("participants", {
          id: this.newId(),
          law_firm_id: firmId,
          matter_id: matter.id,
          identity_id: identityId,
          permissions: [...ALL_MATTER_PERMISSIONS],
          active: true,
          created_at: this.now(),
        });
      await this.activity(
        tx,
        actor,
        firmId,
        matter.id,
        "MATTER_CREATED",
        matter.id,
      );
      return matter;
    });
  }
  async getMatter(credential: string, firmId: string, matterId: string) {
    return this.run(
      credential,
      async (tx, actor) =>
        await this.authorization.matter(
          tx,
          actor,
          id(firmId),
          id(matterId),
          "READ",
        ),
    );
  }
  async grantParticipant(
    credential: string,
    firmId: string,
    matterId: string,
    identityId: string,
    permissions: MatterPermission[],
  ) {
    const parsed = parse(GrantSchema, permissions);
    id(identityId);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.director(tx, actor, firmId);
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "MANAGE",
      );
      const member = await this.targetMember(tx, firmId, identityId);
      if (!(await this.authenticator.identity(identityId))?.active)
        reject("INACTIVE_ASSIGNEE");
      if (
        parsed.some(
          (permission) => !ROLE_CAPABILITIES[member.role].includes(permission),
        )
      )
        reject("ROLE_PERMISSION_CONFLICT");
      const prior = (
        await tx.list("participants", {
          law_firm_id: firmId,
          matter_id: matterId,
        })
      ).find((item) => item.identity_id === identityId);
      const participant = {
        id: prior?.id ?? this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        identity_id: identityId,
        permissions: parsed,
        active: true,
        created_at: prior?.created_at ?? this.now(),
      };
      if (prior) await tx.replace("participants", participant);
      else await tx.insert("participants", participant);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "PARTICIPANT_GRANTED",
        participant.id,
      );
      return participant;
    });
  }
  async revokeParticipant(
    credential: string,
    firmId: string,
    matterId: string,
    identityId: string,
  ) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.director(tx, actor, firmId);
      const targetMembership = await this.targetMember(tx, firmId, identityId);
      if (isDirectorRole(targetMembership.role))
        reject("DIRECTOR_ACCESS_REQUIRED");
      const matter = await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "MANAGE",
      );
      if (matter.responsible_identity_id === id(identityId))
        reject("RESPONSIBLE_PARTICIPANT_REQUIRED");
      const participant = (
        await tx.list("participants", {
          law_firm_id: firmId,
          matter_id: matterId,
        })
      ).find((item) => item.identity_id === identityId && item.active);
      if (!participant) reject();
      await tx.replace("participants", { ...participant, active: false });
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "PARTICIPANT_REVOKED",
        participant.id,
      );
      return { revoked: true };
    });
  }
  async createRelatedParty(
    credential: string,
    firmId: string,
    matterId: string,
    input: z.infer<typeof RelatedPartyInputSchema>,
  ) {
    const parsed = parse(RelatedPartyInputSchema, input);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "MANAGE",
      );
      if (parsed.contact_id) {
        const contact = await tx.get("contacts", parsed.contact_id);
        if (!contact || contact.law_firm_id !== firmId) reject();
      }
      const party = {
        ...parsed,
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        created_at: this.now(),
      };
      await tx.insert("relatedParties", party);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "RELATED_PARTY_CREATED",
        party.id,
      );
      return party;
    });
  }
  async createDocument(
    credential: string,
    firmId: string,
    matterId: string,
    input: z.infer<typeof DocumentInputSchema>,
  ) {
    const parsed = parse(DocumentInputSchema, input);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "DOCUMENT_WRITE",
      );
      const document: Document = {
        ...parsed,
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        purpose: "ORIGINAL",
        current_version_id: null,
        created_at: this.now(),
      };
      await tx.insert("documents", document);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DOCUMENT_CREATED",
        document.id,
      );
      return document;
    });
  }
  async addDocumentVersion(
    credential: string,
    firmId: string,
    matterId: string,
    documentId: string,
    bytes: Uint8Array,
    metadata: {
      mime_type: string;
      original_filename: string;
    },
  ) {
    const copied = bytes instanceof Uint8Array ? Uint8Array.from(bytes) : bytes;
    return this.run(credential, async (tx, actor) => {
      const document = await this.document(
        tx,
        actor,
        firmId,
        matterId,
        documentId,
        "DOCUMENT_WRITE",
      );
      if (document.purpose !== "ORIGINAL") reject("USE_DRAFT_WORKFLOW");
      return await this.incorporate(tx, actor, document, copied, metadata);
    });
  }
  async publishDocumentVersion(
    credential: string,
    firmId: string,
    matterId: string,
    documentId: string,
    versionId: string,
    expectedCurrentVersionId: string | null,
  ) {
    id(versionId);
    if (expectedCurrentVersionId !== null) id(expectedCurrentVersionId);
    return this.run(credential, async (tx, actor) => {
      const document = await this.document(
        tx,
        actor,
        firmId,
        matterId,
        documentId,
        "DOCUMENT_WRITE",
      );
      if (document.purpose !== "ORIGINAL") reject("USE_DRAFT_WORKFLOW");
      const version = await tx.get("documentVersions", versionId);
      if (
        !version ||
        version.document_id !== documentId ||
        version.law_firm_id !== firmId ||
        version.matter_id !== matterId
      )
        reject();
      if (document.current_version_id !== expectedCurrentVersionId)
        reject("VERSION_CONFLICT");
      const published = { ...document, current_version_id: versionId };
      await tx.replace("documents", published);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "VERSION_PUBLISHED",
        documentId,
        versionId,
      );
      return published;
    });
  }
  async getDocument(
    credential: string,
    firmId: string,
    matterId: string,
    documentId: string,
  ) {
    return this.run(
      credential,
      async (tx, actor) =>
        await this.document(tx, actor, firmId, matterId, documentId, "READ"),
    );
  }
  async getDocumentVersion(
    credential: string,
    firmId: string,
    matterId: string,
    documentId: string,
    versionId: string,
  ) {
    return this.run(credential, async (tx, actor) => {
      await this.document(tx, actor, firmId, matterId, documentId, "READ");
      const version = await tx.get("documentVersions", id(versionId));
      if (
        !version ||
        version.document_id !== documentId ||
        version.law_firm_id !== firmId ||
        version.matter_id !== matterId
      )
        reject();
      if (
        (await sha256(decodeBase64(version.original_base64))) !== version.sha256
      )
        reject("DOCUMENT_INTEGRITY_FAILURE");
      return version;
    });
  }
  async createTask(
    credential: string,
    firmId: string,
    matterId: string,
    input: z.infer<typeof TaskInputSchema>,
  ) {
    const parsed = parse(TaskInputSchema, input);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.assignment(
        tx,
        actor,
        firmId,
        parsed.responsible_identity_id,
      );
      if (
        !(await this.authenticator.identity(parsed.responsible_identity_id))
          ?.active
      )
        reject("INACTIVE_ASSIGNEE");
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "TASK_WRITE",
      );
      await this.authorization.participant(
        tx,
        parsed.responsible_identity_id,
        firmId,
        matterId,
        "TASK_WRITE",
      );
      const task: Task = {
        ...parsed,
        assigned_by: actor.identity_id,
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        kind: "INTERNAL",
        draft_review_id: null,
        status: "PENDING",
        created_at: this.now(),
      };
      Object.assign(task, this.assignmentRecord(task, actor.identity_id));
      await tx.insert("tasks", task);
      await this.activity(tx, actor, firmId, matterId, "TASK_CREATED", task.id);
      return task;
    });
  }
  async workBoard(credential: string, firmId: string, team = false) {
    return this.run(credential, async (tx, actor) => {
      const member = await this.authorization.membership(
        tx,
        actor,
        id(firmId),
        LAWYERS,
      );
      const director = isDirectorRole(member.role);
      if (team && !director) reject("DIRECTOR_REQUIRED");
      const matters = [];
      for (const matter of await tx.list("matters", { law_firm_id: firmId })) {
        try {
          await this.authorization.matter(tx, actor, firmId, matter.id, "READ");
          matters.push(matter);
        } catch (error) {
          if ((error as { code?: string }).code !== "ACCESS_DENIED")
            throw error;
        }
      }
      const visible = new Set(matters.map((m) => m.id));
      const tasks = (await tx.list("tasks", { law_firm_id: firmId })).filter(
        (t) =>
          visible.has(t.matter_id) &&
          (team || t.responsible_identity_id === actor.identity_id),
      );
      const requests = (await tx.list("tasks", { law_firm_id: firmId })).filter(
        (t) =>
          visible.has(t.matter_id) &&
          t.direction_request &&
          (director || t.responsible_identity_id === actor.identity_id),
      );
      const people = [];
      for (const membership of await tx.list("memberships", {
        law_firm_id: firmId,
      })) {
        const identity = await this.authenticator.identity(
          membership.identity_id,
        );
        if (
          membership.active &&
          identity?.active &&
          (director || identity.id === actor.identity_id)
        )
          people.push({
            identity_id: identity.id,
            display_name: identity.display_name,
            role: membership.role,
          });
      }
      const documents = await tx.list("documents", { law_firm_id: firmId });
      const drafts = (await tx.list("drafts", { law_firm_id: firmId }))
        .filter((d) => visible.has(d.matter_id))
        .map((d) => ({
          id: d.id,
          matter_id: d.matter_id,
          document_version_id: d.document_version_id,
          status: d.status,
          author_identity_id: d.author_identity_id,
          title:
            documents.find((document) => document.id === d.document_id)
              ?.title ?? "Borrador",
        }));
      return {
        role: member.role,
        team: team && director,
        matters,
        tasks: tasks.filter((t) => !t.direction_request),
        requests,
        people,
        drafts,
      };
    });
  }
  async reviseTask(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
    input: z.infer<typeof WorkAssignmentSchema>,
    expectedRevision: number,
  ) {
    const parsed = parse(WorkAssignmentSchema, input);
    parse(z.number().int().nonnegative(), expectedRevision);
    return this.run(credential, async (tx, actor) => {
      const member = await this.authorization.assignment(
        tx,
        actor,
        firmId,
        parsed.responsible_identity_id,
      );
      await this.authorization.matter(
        tx,
        actor,
        firmId,
        matterId,
        "TASK_WRITE",
      );
      const task = await tx.get("tasks", id(taskId));
      if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId)
        reject();
      if (task.direction_request || task.deadline || task.status !== "PENDING")
        reject("USE_TASK_WORKFLOW");
      if ((task.assignment_revision ?? 0) !== expectedRevision)
        reject("VERSION_CONFLICT");
      if (
        !isDirectorRole(member.role) &&
        (task.responsible_identity_id !== actor.identity_id ||
          taskAssigner(task) !== actor.identity_id)
      )
        reject("DIRECTOR_REQUIRED");
      if (task.kind === "DRAFT_REVIEW") {
        await this.authorization.director(tx, actor, firmId);
        const review =
          task.draft_review_id &&
          (await tx.get("reviews", task.draft_review_id));
        const draft = review && (await tx.get("drafts", review.draft_id));
        if (
          !review ||
          !draft ||
          review.status !== "PENDING" ||
          draft.status !== "IN_REVIEW" ||
          draft.document_version_id !== review.document_version_id
        )
          reject("VERSION_CONFLICT");
        if (
          draft.author_identity_id === parsed.responsible_identity_id ||
          draft.coauthor_identity_ids?.includes(parsed.responsible_identity_id)
        )
          reject("SELF_REVIEW_FORBIDDEN");
        await this.authorization.participant(
          tx,
          parsed.responsible_identity_id,
          firmId,
          matterId,
          "DRAFT_REVIEW",
        );
        await tx.replace("reviews", {
          ...review,
          reviewer_identity_id: parsed.responsible_identity_id,
        });
      } else
        await this.authorization.participant(
          tx,
          parsed.responsible_identity_id,
          firmId,
          matterId,
          "TASK_WRITE",
        );
      if (
        !(await this.authenticator.identity(parsed.responsible_identity_id))
          ?.active
      )
        reject("INACTIVE_ASSIGNEE");
      const next = { ...task, ...parsed };
      Object.assign(next, this.assignmentRecord(next, actor.identity_id));
      await tx.replace("tasks", next);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "TASK_ASSIGNED",
        task.id,
      );
      return next;
    });
  }
  async recordTaskProgress(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
    note: string,
    state: "UPDATE" | "BLOCKED",
  ) {
    parse(z.string().trim().min(1).max(4000), note);
    parse(z.enum(["UPDATE", "BLOCKED"]), state);
    return this.run(credential, async (tx, actor) => {
      const task = await tx.get("tasks", id(taskId));
      if (
        !task ||
        task.law_firm_id !== firmId ||
        task.matter_id !== matterId ||
        task.status !== "PENDING"
      )
        reject();
      if (task.direction_request) reject("USE_DIRECTION_REQUEST_WORKFLOW");
      await this.authorization.matter(
        tx,
        actor,
        firmId,
        matterId,
        task.kind === "DRAFT_REVIEW" ? "DRAFT_REVIEW" : "TASK_WRITE",
      );
      if (task.responsible_identity_id !== actor.identity_id)
        await this.authorization.director(tx, actor, firmId);
      const next = {
        ...task,
        progress: [
          ...(task.progress ?? []),
          {
            id: this.newId(),
            by: actor.identity_id,
            at: this.now(),
            state,
            note: note.trim(),
          },
        ],
      };
      await tx.replace("tasks", next);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "TASK_PROGRESS_RECORDED",
        task.id,
      );
      return next;
    });
  }
  async requestDirection(
    credential: string,
    firmId: string,
    matterId: string,
    input: z.infer<typeof RequestInputSchema>,
  ) {
    const parsed = parse(RequestInputSchema, input);
    if (
      (parsed.kind !== "REVIEW" && parsed.draft_id !== null) ||
      (parsed.kind !== "RESCHEDULE" && parsed.target_task_id !== null)
    )
      reject("INVALID_INPUT");
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        firmId,
        matterId,
        parsed.kind === "REVIEW" ? "DRAFT_WRITE" : "TASK_WRITE",
      );
      await this.authorization.membership(tx, actor, firmId, LAWYERS);
      let version: string | null = null,
        targetRevision: number | null = null;
      if (parsed.kind === "REVIEW") {
        if (!parsed.draft_id) reject("INVALID_INPUT");
        const draft = await this.draft(
          tx,
          actor,
          firmId,
          matterId,
          parsed.draft_id,
          "DRAFT_WRITE",
        );
        version = draft.document_version_id;
      }
      if (parsed.kind === "RESCHEDULE") {
        const target =
          parsed.target_task_id &&
          (await tx.get("tasks", parsed.target_task_id));
        if (
          !target ||
          target.law_firm_id !== firmId ||
          target.matter_id !== matterId ||
          target.responsible_identity_id !== actor.identity_id ||
          target.status !== "PENDING"
        )
          reject();
        targetRevision =
          target.deadline?.revision ?? target.assignment_revision ?? 0;
      }
      const request: DirectionRequest = {
        ...parsed,
        document_version_id: version,
        target_revision: targetRevision,
        status: "OPEN",
        resolved_by: null,
        resolved_at: null,
        resolution_task_id: null,
        resolution_note: null,
      };
      const task: Task = {
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        title:
          parsed.kind === "REVIEW"
            ? "Solicitud de revisión a Dirección"
            : parsed.kind === "RESCHEDULE"
              ? "Solicitud de reprogramación"
              : "Solicitud de intervención a Dirección",
        responsible_identity_id: actor.identity_id,
        assigned_by: actor.identity_id,
        internal_due_at: null,
        kind: "INTERNAL",
        draft_review_id: null,
        status: "PENDING",
        created_at: this.now(),
        direction_request: request,
      };
      await tx.insert("tasks", task);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DIRECTION_REQUESTED",
        task.id,
      );
      return task;
    });
  }
  async resolveDirection(
    credential: string,
    firmId: string,
    matterId: string,
    requestId: string,
    input: {
      decision: "ASSIGN" | "RESOLVED" | "DECLINE";
      responsible_identity_id: string | null;
      internal_due_at: string | null;
      note: string;
    },
  ) {
    const parsed = parse(
      z
        .object({
          decision: z.enum(["ASSIGN", "RESOLVED", "DECLINE"]),
          responsible_identity_id: IdSchema.nullable(),
          internal_due_at: TimestampSchema.nullable(),
          note: z.string().trim().min(1).max(4000),
        })
        .strict(),
      input,
    );
    return this.run(credential, async (tx, actor) => {
      await this.authorization.director(tx, actor, firmId);
      await this.authorization.matter(
        tx,
        actor,
        firmId,
        matterId,
        "TASK_WRITE",
      );
      const requestTask = await tx.get("tasks", id(requestId));
      if (
        !requestTask ||
        requestTask.law_firm_id !== firmId ||
        requestTask.matter_id !== matterId ||
        !requestTask.direction_request
      )
        reject();
      const request = requestTask.direction_request;
      if (request.status !== "OPEN") reject("REQUEST_ALREADY_RESOLVED");
      let createdTask: Task | null = null;
      if (parsed.decision === "ASSIGN") {
        if (request.kind === "RESCHEDULE") reject("REQUEST_ACTION_REQUIRED");
        if (!parsed.responsible_identity_id) reject("INVALID_INPUT");
        if (
          !(await this.authenticator.identity(parsed.responsible_identity_id))
            ?.active
        )
          reject("INACTIVE_ASSIGNEE");
        if (request.kind === "REVIEW") {
          const draft = await this.draft(
            tx,
            actor,
            firmId,
            matterId,
            request.draft_id!,
            "DRAFT_WRITE",
          );
          if (draft.document_version_id !== request.document_version_id)
            reject("VERSION_CONFLICT");
          createdTask = (
            await this.createReviewInside(
              tx,
              actor,
              firmId,
              matterId,
              draft.id,
              parsed.responsible_identity_id,
              parsed.internal_due_at,
            )
          ).task;
        } else {
          await this.authorization.participant(
            tx,
            parsed.responsible_identity_id,
            firmId,
            matterId,
            "TASK_WRITE",
          );
          createdTask = {
            id: this.newId(),
            law_firm_id: firmId,
            matter_id: matterId,
            title: parsed.note.slice(0, 240),
            responsible_identity_id: parsed.responsible_identity_id,
            assigned_by: actor.identity_id,
            internal_due_at: parsed.internal_due_at,
            kind: "INTERNAL",
            draft_review_id: null,
            status: "PENDING",
            created_at: this.now(),
          };
          Object.assign(
            createdTask,
            this.assignmentRecord(createdTask, actor.identity_id),
          );
          await tx.insert("tasks", createdTask);
          await this.activity(
            tx,
            actor,
            firmId,
            matterId,
            "TASK_CREATED",
            createdTask.id,
          );
        }
      } else if (parsed.decision === "RESOLVED") {
        if (request.kind === "REVIEW") reject("REVIEW_ASSIGNMENT_REQUIRED");
        if (request.kind === "RESCHEDULE") {
          const target = await tx.get("tasks", request.target_task_id!);
          if (
            !target ||
            (target.status === "PENDING" &&
              (target.deadline?.revision ?? target.assignment_revision ?? 0) ===
                request.target_revision)
          )
            reject("REQUEST_ACTION_REQUIRED");
        }
      }
      request.status =
        parsed.decision === "ASSIGN"
          ? "ASSIGNED"
          : parsed.decision === "DECLINE"
            ? "DECLINED"
            : "RESOLVED";
      request.resolved_by = actor.identity_id;
      request.resolved_at = this.now();
      request.resolution_task_id = createdTask?.id ?? null;
      request.resolution_note = parsed.note;
      const resolved: Task = {
        ...requestTask,
        direction_request: request,
        status: parsed.decision === "DECLINE" ? "CANCELLED" : "DONE",
      };
      await tx.replace("tasks", resolved);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DIRECTION_REQUEST_RESOLVED",
        requestTask.id,
      );
      return { request: resolved, task: createdTask };
    });
  }
  async getTask(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
  ) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "READ",
      );
      const task = await tx.get("tasks", id(taskId));
      if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId)
        reject();
      return task;
    });
  }
  async updateTaskStatus(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
    status: "PENDING" | "DONE" | "CANCELLED",
    expectedDeadlineRevision?: number,
  ) {
    parse(z.enum(["PENDING", "DONE", "CANCELLED"]), status);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "TASK_WRITE",
      );
      const task = await tx.get("tasks", id(taskId));
      if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId)
        reject();
      if (task.kind === "DRAFT_REVIEW") reject("USE_REVIEW_WORKFLOW");
      if (task.direction_request) reject("USE_DIRECTION_REQUEST_WORKFLOW");
      if (task.deadline && task.deadline.revision !== expectedDeadlineRevision)
        reject("VERSION_CONFLICT");
      if (actor.identity_id !== task.responsible_identity_id)
        await this.authorization.director(tx, actor, firmId);
      if (status !== "DONE" && taskAssigner(task) !== actor.identity_id)
        await this.authorization.director(tx, actor, firmId);
      const updated = { ...task, status };
      await tx.replace("tasks", updated);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "TASK_STATUS_CHANGED",
        task.id,
      );
      return updated;
    });
  }
  private async deadlineTargets(
    tx: CoreTransaction,
    firmId: string,
    matterId: string,
    responsible: string,
    input: DeadlineInput,
  ) {
    if (!(await this.authenticator.identity(responsible))?.active)
      reject("INACTIVE_ASSIGNEE");
    await this.authorization.participant(
      tx,
      responsible,
      firmId,
      matterId,
      "TASK_WRITE",
    );
    if (input.escalation_identity_id) {
      if (
        !(await this.authenticator.identity(input.escalation_identity_id))
          ?.active
      )
        reject("INACTIVE_ASSIGNEE");
      if (input.escalation_identity_id === responsible) reject("INVALID_INPUT");
      await this.authorization.participant(
        tx,
        input.escalation_identity_id,
        firmId,
        matterId,
        "READ",
      );
    }
    if (input.source_version_id) {
      const source = await tx.get("documentVersions", input.source_version_id);
      if (
        !source ||
        source.law_firm_id !== firmId ||
        source.matter_id !== matterId
      )
        reject("ACCESS_DENIED");
    }
  }
  async createDeadline(
    credential: string,
    firmId: string,
    matterId: string,
    input: z.infer<typeof ScheduledTaskInputSchema>,
  ) {
    const parsed = parse(ScheduledTaskInputSchema, input);
    const calculated = calculateDeadline(parsed.deadline);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.assignment(
        tx,
        actor,
        firmId,
        parsed.responsible_identity_id,
      );
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "TASK_WRITE",
      );
      await this.deadlineTargets(
        tx,
        firmId,
        matterId,
        parsed.responsible_identity_id,
        parsed.deadline,
      );
      const task: Task = {
        assigned_by: actor.identity_id,
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        title: parsed.title,
        responsible_identity_id: parsed.responsible_identity_id,
        internal_due_at: calculated.due_at,
        kind: "INTERNAL",
        draft_review_id: null,
        status: "PENDING",
        created_at: this.now(),
        deadline: {
          revision: 1,
          versions: [
            {
              ...parsed.deadline,
              ...calculated,
              revision: 1,
              responsible_identity_id: parsed.responsible_identity_id,
              recorded_by: actor.identity_id,
              recorded_at: this.now(),
              change_reason: "Alta del plazo",
              confirmed_at: null,
              confirmed_by: null,
            },
          ],
          alerts: [],
        },
      };
      Object.assign(task, this.assignmentRecord(task, actor.identity_id));
      await tx.insert("tasks", task);
      await this.activity(tx, actor, firmId, matterId, "TASK_CREATED", task.id);
      return task;
    });
  }
  async getDeadlineSource(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
  ) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "READ",
      );
      const task = await tx.get("tasks", id(taskId));
      if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId)
        reject();
      const sourceId = currentDeadline(task)?.source_version_id;
      const source = sourceId
        ? await tx.get("documentVersions", sourceId)
        : undefined;
      if (
        !source ||
        source.law_firm_id !== firmId ||
        source.matter_id !== matterId
      )
        reject("SOURCE_NOT_AVAILABLE");
      if (
        (await sha256(decodeBase64(source.original_base64))) !== source.sha256
      )
        reject("DOCUMENT_INTEGRITY_FAILURE");
      return source;
    });
  }
  async reviseDeadline(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
    input: z.infer<typeof ScheduledTaskInputSchema>,
    expectedRevision: number,
    reason: string,
  ) {
    const parsed = parse(ScheduledTaskInputSchema, input);
    parse(z.number().int().nonnegative(), expectedRevision);
    parse(z.string().trim().min(1).max(2000), reason);
    const calculated = calculateDeadline(parsed.deadline);
    return this.run(credential, async (tx, actor) => {
      const member = await this.authorization.assignment(
        tx,
        actor,
        firmId,
        parsed.responsible_identity_id,
      );
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "TASK_WRITE",
      );
      const task = await tx.get("tasks", id(taskId));
      if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId)
        reject();
      if (
        task.kind !== "INTERNAL" ||
        task.direction_request ||
        task.status !== "PENDING"
      )
        reject("TASK_NOT_PENDING");
      if ((task.deadline?.revision ?? 0) !== expectedRevision)
        reject("VERSION_CONFLICT");
      if (
        !isDirectorRole(member.role) &&
        (task.responsible_identity_id !== actor.identity_id ||
          taskAssigner(task) !== actor.identity_id)
      )
        reject("DIRECTOR_REQUIRED");
      await this.deadlineTargets(
        tx,
        firmId,
        matterId,
        parsed.responsible_identity_id,
        parsed.deadline,
      );
      const revision = expectedRevision + 1;
      const next: Task = {
        ...task,
        title: parsed.title,
        responsible_identity_id: parsed.responsible_identity_id,
        internal_due_at: calculated.due_at,
        deadline: {
          revision,
          versions: [
            ...(task.deadline?.versions ?? []),
            {
              ...parsed.deadline,
              ...calculated,
              revision,
              responsible_identity_id: parsed.responsible_identity_id,
              recorded_by: actor.identity_id,
              recorded_at: this.now(),
              change_reason: reason.trim(),
              confirmed_at: null,
              confirmed_by: null,
            },
          ],
          alerts: task.deadline?.alerts ?? [],
        },
      };
      Object.assign(next, this.assignmentRecord(next, actor.identity_id));
      await tx.replace("tasks", next);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DEADLINE_REVISED",
        task.id,
      );
      return next;
    });
  }
  async confirmDeadline(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
    expectedRevision: number,
  ) {
    parse(z.number().int().positive(), expectedRevision);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "TASK_WRITE",
      );
      await this.authorization.membership(tx, actor, firmId, LAWYERS);
      const task = await tx.get("tasks", id(taskId));
      if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId)
        reject();
      await this.authorization.assignment(
        tx,
        actor,
        firmId,
        task.responsible_identity_id,
      );
      if (task.status !== "PENDING") reject("TASK_NOT_PENDING");
      const version = currentDeadline(task);
      if (!version || version.revision !== expectedRevision)
        reject("VERSION_CONFLICT");
      await this.deadlineTargets(
        tx,
        firmId,
        matterId,
        task.responsible_identity_id,
        version,
      );
      if (version.confirmed_at) return task;
      version.confirmed_by = actor.identity_id;
      version.confirmed_at = this.now();
      await tx.replace("tasks", task);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DEADLINE_CONFIRMED",
        task.id,
      );
      return task;
    });
  }
  async deadlineInbox(credential: string, firmId: string) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId));
      const allMemberships = await tx.list("memberships", {
        law_firm_id: firmId,
      });
      const memberships = (
        await Promise.all(
          allMemberships.map(async (member) =>
            (await this.authenticator.identity(member.identity_id))?.active
              ? member
              : null,
          ),
        )
      ).filter(
        (member): member is NonNullable<typeof member> => member !== null,
      );
      const participants = await tx.list("participants", {
        law_firm_id: firmId,
      });
      const entries: Array<{
        task_id: string;
        matter_id: string;
        title: string;
        due_at: string;
        alert: DeadlineAlert;
      }> = [];
      for (const task of await tx.list("tasks", { law_firm_id: firmId })) {
        if (
          !deadlineRecipientAllowed(
            task,
            actor.identity_id,
            memberships,
            participants,
          )
        )
          continue;
        const next = advanceDeadlineAlerts(
          task,
          memberships,
          participants,
          this.now(),
          this.newId,
        );
        const version = currentDeadline(next);
        if (task.status === "PENDING" && version?.confirmed_at) {
          for (const alert of next.deadline!.alerts) {
            if (
              alert.recipient_id !== actor.identity_id ||
              alert.revision !== version.revision ||
              alert.acknowledged_at ||
              (alert.blocked_at && !alert.released_at) ||
              (alert.kind === "REMINDER" &&
                Date.parse(version.due_at) <= this.clock().getTime())
            )
              continue;
            alert.presented_at ??= this.now();
            entries.push({
              task_id: task.id,
              matter_id: task.matter_id,
              title: task.title,
              due_at: version.due_at,
              alert,
            });
          }
        }
        if (JSON.stringify(next) !== JSON.stringify(task))
          await tx.replace("tasks", next);
      }
      return entries.sort((a, b) => a.due_at.localeCompare(b.due_at));
    });
  }
  async acknowledgeDeadlineAlert(
    credential: string,
    firmId: string,
    matterId: string,
    taskId: string,
    alertId: string,
  ) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "READ",
      );
      const task = await tx.get("tasks", id(taskId));
      if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId)
        reject();
      const alert = task.deadline?.alerts.find(
        (a) => a.id === id(alertId) && a.recipient_id === actor.identity_id,
      );
      if (!alert || !alert.presented_at) reject();
      if (alert.acknowledged_at) return task;
      alert.acknowledged_at = this.now();
      await tx.replace("tasks", task);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DEADLINE_ALERT_ACKNOWLEDGED",
        task.id,
      );
      return task;
    });
  }
  async prepareDraft(
    credential: string,
    firmId: string,
    matterId: string,
    title: string,
    content: string,
  ) {
    parse(DocumentInputSchema, { title });
    parse(z.string().min(1).max(1000000), content);
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "DRAFT_WRITE",
      );
      const document: Document = {
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        title,
        purpose: "DRAFT",
        current_version_id: null,
        created_at: this.now(),
      };
      await tx.insert("documents", document);
      const version = await this.incorporate(
        tx,
        actor,
        document,
        new TextEncoder().encode(content),
        {
          mime_type: "text/plain; charset=utf-8",
          original_filename: "draft.txt",
        },
      );
      await tx.replace("documents", {
        ...document,
        current_version_id: version.id,
      });
      const draft: Draft = {
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        document_id: document.id,
        document_version_id: version.id,
        author_identity_id: actor.identity_id,
        status: "DRAFT",
        created_at: this.now(),
      };
      await tx.insert("drafts", draft);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DRAFT_CREATED",
        draft.id,
        version.id,
      );
      return draft;
    });
  }
  private async draft(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
    matterId: string,
    draftId: string,
    permission: MatterPermission,
  ): Promise<Draft> {
    await this.authorization.matter(
      tx,
      actor,
      id(firmId),
      id(matterId),
      permission,
    );
    const draft = await tx.get("drafts", id(draftId));
    if (!draft || draft.law_firm_id !== firmId || draft.matter_id !== matterId)
      reject();
    return draft;
  }
  async getDraft(
    credential: string,
    firmId: string,
    matterId: string,
    draftId: string,
  ) {
    return this.run(
      credential,
      async (tx, actor) =>
        await this.draft(tx, actor, firmId, matterId, draftId, "READ"),
    );
  }
  async reviseDraft(
    credential: string,
    firmId: string,
    matterId: string,
    draftId: string,
    expectedVersionId: string,
    content: string,
  ) {
    return this.reviseDraftContent(
      credential,
      firmId,
      matterId,
      draftId,
      expectedVersionId,
      content,
      false,
    );
  }
  /** Explicit collaborative command. DRAFT_WRITE and matter participation are still required. */
  async reviseCollaborativeDraft(
    credential: string,
    firmId: string,
    matterId: string,
    draftId: string,
    expectedVersionId: string,
    content: string,
    coauthors: string[] = [],
  ) {
    parse(z.array(IdSchema).max(64), coauthors);
    return this.reviseDraftContent(
      credential,
      firmId,
      matterId,
      draftId,
      expectedVersionId,
      content,
      true,
      coauthors,
    );
  }
  private async reviseDraftContent(
    credential: string,
    firmId: string,
    matterId: string,
    draftId: string,
    expectedVersionId: string,
    content: string,
    collaborative: boolean,
    coauthors: string[] = [],
  ) {
    id(expectedVersionId);
    parse(z.string().min(1).max(1000000), content);
    return this.run(credential, async (tx, actor) => {
      const draft = await this.draft(
        tx,
        actor,
        firmId,
        matterId,
        draftId,
        "DRAFT_WRITE",
      );
      if (!collaborative && draft.author_identity_id !== actor.identity_id)
        await this.authorization.matter(tx, actor, firmId, matterId, "MANAGE");
      if (draft.document_version_id !== expectedVersionId)
        reject("VERSION_CONFLICT");
      const document = await this.document(
        tx,
        actor,
        firmId,
        matterId,
        draft.document_id,
        "DRAFT_WRITE",
      );
      const version = await this.incorporate(
        tx,
        actor,
        document,
        new TextEncoder().encode(content),
        {
          mime_type: "text/plain; charset=utf-8",
          original_filename: "draft.txt",
        },
      );
      for (const review of (
        await tx.list("reviews", { law_firm_id: firmId, matter_id: matterId })
      ).filter(
        (item) => item.draft_id === draftId && item.status === "PENDING",
      )) {
        await tx.replace("reviews", { ...review, status: "SUPERSEDED" });
        for (const task of (
          await tx.list("tasks", { law_firm_id: firmId, matter_id: matterId })
        ).filter((item) => item.draft_review_id === review.id))
          await tx.replace("tasks", { ...task, status: "CANCELLED" });
      }
      await tx.replace("documents", {
        ...document,
        current_version_id: version.id,
      });
      const revised: Draft = {
        ...draft,
        ...(collaborative
          ? {
              coauthor_identity_ids: [
                ...new Set([
                  draft.author_identity_id,
                  ...(draft.coauthor_identity_ids ?? []),
                  actor.identity_id,
                  ...coauthors,
                ]),
              ],
            }
          : {}),
        document_version_id: version.id,
        status: "DRAFT",
      };
      await tx.replace("drafts", revised);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DRAFT_REVISED",
        draft.id,
        version.id,
      );
      return revised;
    });
  }
  async requestDraftReview(
    credential: string,
    firmId: string,
    matterId: string,
    draftId: string,
    reviewerIdentityId: string,
    internalDueAt: string | null,
  ) {
    id(reviewerIdentityId);
    parse(TaskInputSchema, {
      title: "Revisión",
      responsible_identity_id: reviewerIdentityId,
      internal_due_at: internalDueAt,
    });
    return this.run(credential, async (tx, actor) => {
      return this.createReviewInside(
        tx,
        actor,
        firmId,
        matterId,
        draftId,
        reviewerIdentityId,
        internalDueAt,
      );
    });
  }
  private async createReviewInside(
    tx: CoreTransaction,
    actor: AuthenticatedPrincipal,
    firmId: string,
    matterId: string,
    draftId: string,
    reviewerIdentityId: string,
    internalDueAt: string | null,
  ) {
    await this.authorization.director(tx, actor, firmId);
    if (!(await this.authenticator.identity(reviewerIdentityId))?.active)
      reject("INACTIVE_ASSIGNEE");
    const draft = await this.draft(
      tx,
      actor,
      firmId,
      matterId,
      draftId,
      "DRAFT_WRITE",
    );
    if (draft.author_identity_id !== actor.identity_id)
      await this.authorization.matter(tx, actor, firmId, matterId, "MANAGE");
    if (
      draft.author_identity_id === reviewerIdentityId ||
      draft.coauthor_identity_ids?.includes(reviewerIdentityId)
    )
      reject("SELF_REVIEW_FORBIDDEN");
    await this.authorization.participant(
      tx,
      reviewerIdentityId,
      firmId,
      matterId,
      "DRAFT_REVIEW",
    );
    if (!["DRAFT", "CHANGES_REQUESTED"].includes(draft.status))
      reject("DRAFT_STATE_CONFLICT");
    const review: DraftReview = {
      id: this.newId(),
      law_firm_id: firmId,
      matter_id: matterId,
      draft_id: draftId,
      document_version_id: draft.document_version_id,
      reviewer_identity_id: reviewerIdentityId,
      status: "PENDING",
      decided_at: null,
      created_at: this.now(),
    };
    const task: Task = {
      assigned_by: actor.identity_id,
      id: this.newId(),
      law_firm_id: firmId,
      matter_id: matterId,
      title: "Revisar borrador documental",
      responsible_identity_id: reviewerIdentityId,
      internal_due_at: internalDueAt,
      kind: "DRAFT_REVIEW",
      draft_review_id: review.id,
      status: "PENDING",
      created_at: this.now(),
    };
    Object.assign(task, this.assignmentRecord(task, actor.identity_id));
    await tx.insert("reviews", review);
    await tx.insert("tasks", task);
    await tx.replace("drafts", { ...draft, status: "IN_REVIEW" });
    await this.activity(
      tx,
      actor,
      firmId,
      matterId,
      "REVIEW_REQUESTED",
      review.id,
      review.document_version_id,
    );
    return { review, task };
  }
  async decideDraftReview(
    credential: string,
    firmId: string,
    matterId: string,
    reviewId: string,
    input: {
      decision: "APPROVE" | "REQUEST_CHANGES";
      expected_version_id: string;
      explicitly_confirmed: true;
    },
  ) {
    const parsed = parse(
      z
        .object({
          decision: z.enum(["APPROVE", "REQUEST_CHANGES"]),
          expected_version_id: IdSchema,
          explicitly_confirmed: z.literal(true),
        })
        .strict(),
      input,
    );
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "DRAFT_REVIEW",
      );
      const review = await tx.get("reviews", id(reviewId));
      if (
        !review ||
        review.law_firm_id !== firmId ||
        review.matter_id !== matterId ||
        review.reviewer_identity_id !== actor.identity_id
      )
        reject();
      const draft = await this.draft(
        tx,
        actor,
        firmId,
        matterId,
        review.draft_id,
        "DRAFT_REVIEW",
      );
      if (
        draft.author_identity_id === actor.identity_id ||
        draft.coauthor_identity_ids?.includes(actor.identity_id)
      )
        reject("SELF_REVIEW_FORBIDDEN");
      if (review.status !== "PENDING" || draft.status !== "IN_REVIEW")
        reject("REVIEW_STATE_CONFLICT");
      if (
        review.document_version_id !== parsed.expected_version_id ||
        draft.document_version_id !== parsed.expected_version_id
      )
        reject("VERSION_CONFLICT");
      const status =
        parsed.decision === "APPROVE"
          ? ("APPROVED" as const)
          : ("CHANGES_REQUESTED" as const);
      const decided = { ...review, status, decided_at: this.now() };
      await tx.replace("reviews", decided);
      await tx.replace("drafts", { ...draft, status });
      for (const task of (
        await tx.list("tasks", { law_firm_id: firmId, matter_id: matterId })
      ).filter((item) => item.draft_review_id === reviewId))
        await tx.replace("tasks", { ...task, status: "DONE" });
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        status === "APPROVED" ? "DRAFT_APPROVED" : "CHANGES_REQUESTED",
        draft.id,
        parsed.expected_version_id,
      );
      return decided;
    });
  }
  async listClients(credential: string, firmId: string) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId), WRITERS);
      return tx.list("clients", { law_firm_id: firmId });
    });
  }
  async listMembers(credential: string, firmId: string) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId));
      return tx.list("memberships", { law_firm_id: firmId });
    });
  }
  async listMatters(credential: string, firmId: string) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.membership(tx, actor, id(firmId));
      const visible = [];
      for (const matter of await tx.list("matters", { law_firm_id: firmId })) {
        try {
          await this.authorization.participant(
            tx,
            actor.identity_id,
            firmId,
            matter.id,
            "READ",
          );
          visible.push(matter);
        } catch (error) {
          if ((error as { code?: string }).code !== "ACCESS_DENIED")
            throw error;
        }
      }
      return visible;
    });
  }
  async listMatterResources<
    K extends
      | "documents"
      | "tasks"
      | "drafts"
      | "reviews"
      | "participants"
      | "proceedings"
      | "deliveries"
      | "documentVersions",
  >(credential: string, firmId: string, matterId: string, table: K) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "READ",
      );
      return tx.list(table, { law_firm_id: firmId, matter_id: matterId });
    });
  }
  async reassignMatter(
    credential: string,
    firmId: string,
    matterId: string,
    identityId: string,
    expectedResponsibleId: string,
  ) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.director(tx, actor, firmId);
      const matter = await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "MANAGE",
      );
      if (matter.responsible_identity_id !== id(expectedResponsibleId))
        reject("VERSION_CONFLICT");
      await this.targetMember(tx, firmId, id(identityId), LAWYERS);
      if (!(await this.authenticator.identity(identityId))?.active)
        reject("INACTIVE_ASSIGNEE");
      const previous = (
        await tx.list("participants", {
          law_firm_id: firmId,
          matter_id: matterId,
        })
      ).find((p) => p.identity_id === identityId);
      const participant = {
        id: previous?.id ?? this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        identity_id: identityId,
        active: true,
        permissions: [...ALL_MATTER_PERMISSIONS],
        created_at: previous?.created_at ?? this.now(),
      };
      if (previous) await tx.replace("participants", participant);
      else await tx.insert("participants", participant);
      const updated = { ...matter, responsible_identity_id: identityId };
      await tx.replace("matters", updated);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "PARTICIPANT_GRANTED",
        participant.id,
      );
      return updated;
    });
  }
  async createProceeding(
    credential: string,
    firmId: string,
    matterId: string,
    input: { title: string; court: string | null; number: string | null },
  ) {
    const parsed = parse(
      z
        .object({
          title: z.string().min(1).max(240),
          court: z.string().max(240).nullable(),
          number: z.string().max(128).nullable(),
        })
        .strict(),
      input,
    );
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "MANAGE",
      );
      const proceeding = {
        ...parsed,
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        created_at: this.now(),
      };
      await tx.insert("proceedings", proceeding);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "PROCEEDING_CREATED",
        proceeding.id,
      );
      return proceeding;
    });
  }
  async recordDelivery(
    credential: string,
    firmId: string,
    matterId: string,
    input: {
      document_version_id: string;
      kind: "DELIVERY" | "FILING";
      recipient: string;
      receipt_version_id: string;
      occurred_at: string;
    },
  ) {
    const parsed = parse(
      z
        .object({
          document_version_id: IdSchema,
          kind: z.enum(["DELIVERY", "FILING"]),
          recipient: z.string().min(1).max(240),
          receipt_version_id: IdSchema,
          occurred_at: TimestampSchema,
        })
        .strict(),
      input,
    );
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "DRAFT_REVIEW",
      );
      const approved = (
        await tx.list("reviews", { law_firm_id: firmId, matter_id: matterId })
      ).some(
        (r) =>
          r.document_version_id === parsed.document_version_id &&
          r.status === "APPROVED",
      );
      if (!approved) reject("APPROVED_VERSION_REQUIRED");
      const receipt = await tx.get(
        "documentVersions",
        parsed.receipt_version_id,
      );
      if (
        !receipt ||
        receipt.law_firm_id !== firmId ||
        receipt.matter_id !== matterId
      )
        reject();
      const delivery = {
        ...parsed,
        id: this.newId(),
        law_firm_id: firmId,
        matter_id: matterId,
        recorded_by: actor.identity_id,
        created_at: this.now(),
      };
      await tx.insert("deliveries", delivery);
      await this.activity(
        tx,
        actor,
        firmId,
        matterId,
        "DELIVERY_RECORDED",
        delivery.id,
        delivery.document_version_id,
      );
      return delivery;
    });
  }
  async matterActivity(credential: string, firmId: string, matterId: string) {
    return this.run(credential, async (tx, actor) => {
      await this.authorization.matter(
        tx,
        actor,
        id(firmId),
        id(matterId),
        "READ",
      );
      return await tx.list("activities", {
        law_firm_id: firmId,
        matter_id: matterId,
      });
    });
  }
}
