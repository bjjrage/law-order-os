import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Authorization, ROLE_CAPABILITIES } from './authorization.js';
import { ALL_MATTER_PERMISSIONS, ClientInputSchema, ContactInputSchema, FirmRoleSchema, IdSchema, MatterInputSchema, MatterPermissionSchema, RelatedPartyInputSchema, TaskInputSchema, immutable, reject, type ActivityAction, type AuthenticatedPrincipal, type Authenticator, type ClientInput, type CorePersistence, type CoreTransaction, type Document, type DocumentVersion, type Draft, type DraftReview, type FirmRole, type MatterPermission, type Task } from './contracts.js';

const PrincipalSchema = z.object({ identity_id: IdSchema, subject: z.string().min(1), session_id: IdSchema, expires_at: z.iso.datetime() }).strict();
const DocumentInputSchema = z.object({ title: z.string().min(1).max(240) }).strict();
const VersionMetadataSchema = z.object({ mime_type: z.string().min(1).max(100), original_filename: z.string().min(1).max(240) }).strict();
const GrantSchema = z.array(MatterPermissionSchema).min(1).max(6).refine(items => new Set(items).size === items.length && items.includes('READ'));
const WRITERS: readonly FirmRole[] = ['ADMINISTRATOR', 'COORDINATOR', 'LAWYER', 'ASSISTANT'];
const LAWYERS: readonly FirmRole[] = ['ADMINISTRATOR', 'COORDINATOR', 'LAWYER'];
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) reject('INVALID_INPUT'); return result.data; }
function id(value: string): string { return parse(IdSchema, value); }

/** Trusted service boundary. No HTTP/session implementation or production persistence is supplied. */
export class OsCoreService {
  private readonly authorization = new Authorization();
  constructor(private readonly persistence: CorePersistence, private readonly authenticator: Authenticator, private readonly clock: () => Date = () => new Date(), private readonly newId: () => string = randomUUID) {}
  private now(): string { return this.clock().toISOString(); }
  private async run<T>(credential: string, operation: (tx: CoreTransaction, actor: AuthenticatedPrincipal) => T | Promise<T>): Promise<T> {
    if (typeof credential !== 'string' || credential.length === 0) reject('UNAUTHENTICATED');
    const authenticated = PrincipalSchema.safeParse(await this.authenticator.authenticate(credential));
    if (!authenticated.success || Date.parse(authenticated.data.expires_at) <= this.clock().getTime()) reject('UNAUTHENTICATED');
    const actor = authenticated.data;
    const identity = await this.authenticator.identity(actor.identity_id);
    if (!identity?.active || identity.id !== actor.identity_id || identity.subject !== actor.subject) reject('UNAUTHENTICATED');
    return immutable(await this.persistence.transaction(tx => operation(tx, actor)));
  }
  private activity(tx: CoreTransaction, actor: AuthenticatedPrincipal, firmId: string, matterId: string | null, action: ActivityAction, resourceId: string, versionId: string | null = null): void {
    tx.insert('activities', { id: this.newId(), law_firm_id: firmId, matter_id: matterId, actor_identity_id: actor.identity_id, action, resource_id: resourceId, version_id: versionId, created_at: this.now() });
  }
  private targetMember(tx: CoreTransaction, firmId: string, identityId: string, roles?: readonly FirmRole[]) {
    const membership = tx.list('memberships', { law_firm_id: firmId }).find(item => item.identity_id === identityId && item.active);
    if (!membership || (roles && !roles.includes(membership.role))) reject();
    return membership;
  }
  private document(tx: CoreTransaction, actor: AuthenticatedPrincipal, firmId: string, matterId: string, documentId: string, permission: MatterPermission): Document {
    this.authorization.matter(tx, actor, id(firmId), id(matterId), permission);
    const document = tx.get('documents', id(documentId));
    if (!document || document.law_firm_id !== firmId || document.matter_id !== matterId) reject();
    return document;
  }
  private incorporate(tx: CoreTransaction, actor: AuthenticatedPrincipal, document: Document, bytes: Uint8Array, metadata: { mime_type: string; original_filename: string }): DocumentVersion {
    const parsed = parse(VersionMetadataSchema, metadata);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 20 * 1024 * 1024) reject('INVALID_DOCUMENT_BYTES');
    const copied = Buffer.from(bytes);
    const version: DocumentVersion = { id: this.newId(), law_firm_id: document.law_firm_id, matter_id: document.matter_id, document_id: document.id, original_base64: copied.toString('base64'), sha256: createHash('sha256').update(copied).digest('hex'), ...parsed, incorporated_by: actor.identity_id, incorporated_at: this.now() };
    tx.insert('documentVersions', version);
    this.activity(tx, actor, document.law_firm_id, document.matter_id, 'VERSION_INCORPORATED', document.id, version.id);
    return version;
  }
  createLawFirm(credential: string, name: string) {
    const parsedName = parse(z.string().trim().min(1).max(240), name);
    return this.run(credential, (tx, actor) => {
      const firm = { id: this.newId(), name: parsedName, created_at: this.now() };
      tx.insert('lawFirms', firm);
      tx.insert('memberships', { id: this.newId(), law_firm_id: firm.id, identity_id: actor.identity_id, role: 'ADMINISTRATOR', active: true, created_at: this.now() });
      this.activity(tx, actor, firm.id, null, 'FIRM_CREATED', firm.id);
      return firm;
    });
  }
  getLawFirm(credential: string, firmId: string) {
    return this.run(credential, (tx, actor) => { this.authorization.membership(tx, actor, id(firmId)); return tx.get('lawFirms', firmId)!; });
  }
  addMember(credential: string, firmId: string, identityId: string, role: FirmRole) {
    id(identityId); parse(FirmRoleSchema, role);
    return this.run(credential, async (tx, actor) => {
      this.authorization.membership(tx, actor, id(firmId), ['ADMINISTRATOR']);
      const target = await this.authenticator.identity(identityId);
      if (!target?.active || target.id !== identityId) reject('IDENTITY_NOT_AVAILABLE');
      if (tx.list('memberships', { law_firm_id: firmId }).some(item => item.identity_id === identityId)) reject('MEMBERSHIP_ALREADY_EXISTS');
      const member = { id: this.newId(), law_firm_id: firmId, identity_id: identityId, role, active: true, created_at: this.now() };
      tx.insert('memberships', member);
      this.activity(tx, actor, firmId, null, 'MEMBER_ADDED', member.id);
      return member;
    });
  }
  deactivateMember(credential: string, firmId: string, identityId: string) {
    return this.run(credential, (tx, actor) => {
      this.authorization.membership(tx, actor, id(firmId), ['ADMINISTRATOR']);
      const member = this.targetMember(tx, firmId, id(identityId));
      if (member.role === 'ADMINISTRATOR' && tx.list('memberships', { law_firm_id: firmId }).filter(item => item.active && item.role === 'ADMINISTRATOR').length === 1) reject('LAST_ADMINISTRATOR');
      tx.replace('memberships', { ...member, active: false });
      this.activity(tx, actor, firmId, null, 'MEMBER_DEACTIVATED', member.id);
      return { deactivated: true };
    });
  }
  createClient(credential: string, firmId: string, input: ClientInput) {
    const parsed = parse(ClientInputSchema, input);
    return this.run(credential, (tx, actor) => {
      this.authorization.membership(tx, actor, id(firmId), WRITERS);
      const client = { ...parsed, id: this.newId(), law_firm_id: firmId, created_at: this.now() };
      tx.insert('clients', client); this.activity(tx, actor, firmId, null, 'CLIENT_CREATED', client.id); return client;
    });
  }
  getClient(credential: string, firmId: string, clientId: string) {
    return this.run(credential, (tx, actor) => { this.authorization.membership(tx, actor, id(firmId), WRITERS); const client = tx.get('clients', id(clientId)); if (!client || client.law_firm_id !== firmId) reject(); return client; });
  }
  createContact(credential: string, firmId: string, input: z.infer<typeof ContactInputSchema>) {
    const parsed = parse(ContactInputSchema, input);
    return this.run(credential, (tx, actor) => {
      this.authorization.membership(tx, actor, id(firmId), WRITERS);
      const client = tx.get('clients', parsed.client_id); if (!client || client.law_firm_id !== firmId) reject();
      const contact = { ...parsed, id: this.newId(), law_firm_id: firmId, created_at: this.now() };
      tx.insert('contacts', contact); this.activity(tx, actor, firmId, null, 'CONTACT_CREATED', contact.id); return contact;
    });
  }
  createMatter(credential: string, firmId: string, input: z.infer<typeof MatterInputSchema>) {
    const parsed = parse(MatterInputSchema, input);
    if (parsed.closed_on !== null) reject('NEW_MATTER_MUST_BE_OPEN');
    return this.run(credential, (tx, actor) => {
      this.authorization.membership(tx, actor, id(firmId), LAWYERS);
      const client = tx.get('clients', parsed.client_id); if (!client || client.law_firm_id !== firmId) reject();
      this.targetMember(tx, firmId, parsed.responsible_identity_id, LAWYERS);
      const matter = { ...parsed, id: this.newId(), law_firm_id: firmId, status: 'OPEN' as const, created_at: this.now() };
      tx.insert('matters', matter);
      for (const identityId of new Set([actor.identity_id, parsed.responsible_identity_id])) tx.insert('participants', { id: this.newId(), law_firm_id: firmId, matter_id: matter.id, identity_id: identityId, permissions: [...ALL_MATTER_PERMISSIONS], active: true, created_at: this.now() });
      this.activity(tx, actor, firmId, matter.id, 'MATTER_CREATED', matter.id);
      return matter;
    });
  }
  getMatter(credential: string, firmId: string, matterId: string) { return this.run(credential, (tx, actor) => this.authorization.matter(tx, actor, id(firmId), id(matterId), 'READ')); }
  grantParticipant(credential: string, firmId: string, matterId: string, identityId: string, permissions: MatterPermission[]) {
    const parsed = parse(GrantSchema, permissions); id(identityId);
    return this.run(credential, (tx, actor) => {
      this.authorization.matter(tx, actor, id(firmId), id(matterId), 'MANAGE');
      const member = this.targetMember(tx, firmId, identityId);
      if (parsed.some(permission => !ROLE_CAPABILITIES[member.role].includes(permission))) reject('ROLE_PERMISSION_CONFLICT');
      const prior = tx.list('participants', { law_firm_id: firmId, matter_id: matterId }).find(item => item.identity_id === identityId);
      const participant = { id: prior?.id ?? this.newId(), law_firm_id: firmId, matter_id: matterId, identity_id: identityId, permissions: parsed, active: true, created_at: prior?.created_at ?? this.now() };
      if (prior) tx.replace('participants', participant); else tx.insert('participants', participant);
      this.activity(tx, actor, firmId, matterId, 'PARTICIPANT_GRANTED', participant.id); return participant;
    });
  }
  revokeParticipant(credential: string, firmId: string, matterId: string, identityId: string) {
    return this.run(credential, (tx, actor) => {
      const matter = this.authorization.matter(tx, actor, id(firmId), id(matterId), 'MANAGE');
      if (matter.responsible_identity_id === id(identityId)) reject('RESPONSIBLE_PARTICIPANT_REQUIRED');
      const participant = tx.list('participants', { law_firm_id: firmId, matter_id: matterId }).find(item => item.identity_id === identityId && item.active); if (!participant) reject();
      tx.replace('participants', { ...participant, active: false }); this.activity(tx, actor, firmId, matterId, 'PARTICIPANT_REVOKED', participant.id); return { revoked: true };
    });
  }
  createRelatedParty(credential: string, firmId: string, matterId: string, input: z.infer<typeof RelatedPartyInputSchema>) {
    const parsed = parse(RelatedPartyInputSchema, input);
    return this.run(credential, (tx, actor) => {
      this.authorization.matter(tx, actor, id(firmId), id(matterId), 'MANAGE');
      if (parsed.contact_id) { const contact = tx.get('contacts', parsed.contact_id); if (!contact || contact.law_firm_id !== firmId) reject(); }
      const party = { ...parsed, id: this.newId(), law_firm_id: firmId, matter_id: matterId, created_at: this.now() };
      tx.insert('relatedParties', party); this.activity(tx, actor, firmId, matterId, 'RELATED_PARTY_CREATED', party.id); return party;
    });
  }
  createDocument(credential: string, firmId: string, matterId: string, input: z.infer<typeof DocumentInputSchema>) {
    const parsed = parse(DocumentInputSchema, input);
    return this.run(credential, (tx, actor) => {
      this.authorization.matter(tx, actor, id(firmId), id(matterId), 'DOCUMENT_WRITE');
      const document: Document = { ...parsed, id: this.newId(), law_firm_id: firmId, matter_id: matterId, purpose: 'ORIGINAL', current_version_id: null, created_at: this.now() };
      tx.insert('documents', document); this.activity(tx, actor, firmId, matterId, 'DOCUMENT_CREATED', document.id); return document;
    });
  }
  addDocumentVersion(credential: string, firmId: string, matterId: string, documentId: string, bytes: Uint8Array, metadata: { mime_type: string; original_filename: string }) {
    const copied = bytes instanceof Uint8Array ? Uint8Array.from(bytes) : bytes;
    return this.run(credential, (tx, actor) => { const document = this.document(tx, actor, firmId, matterId, documentId, 'DOCUMENT_WRITE'); if (document.purpose !== 'ORIGINAL') reject('USE_DRAFT_WORKFLOW'); return this.incorporate(tx, actor, document, copied, metadata); });
  }
  publishDocumentVersion(credential: string, firmId: string, matterId: string, documentId: string, versionId: string, expectedCurrentVersionId: string | null) {
    id(versionId); if (expectedCurrentVersionId !== null) id(expectedCurrentVersionId);
    return this.run(credential, (tx, actor) => {
      const document = this.document(tx, actor, firmId, matterId, documentId, 'DOCUMENT_WRITE'); if (document.purpose !== 'ORIGINAL') reject('USE_DRAFT_WORKFLOW');
      const version = tx.get('documentVersions', versionId);
      if (!version || version.document_id !== documentId || version.law_firm_id !== firmId || version.matter_id !== matterId) reject();
      if (document.current_version_id !== expectedCurrentVersionId) reject('VERSION_CONFLICT');
      const published = { ...document, current_version_id: versionId }; tx.replace('documents', published);
      this.activity(tx, actor, firmId, matterId, 'VERSION_PUBLISHED', documentId, versionId); return published;
    });
  }
  getDocument(credential: string, firmId: string, matterId: string, documentId: string) { return this.run(credential, (tx, actor) => this.document(tx, actor, firmId, matterId, documentId, 'READ')); }
  getDocumentVersion(credential: string, firmId: string, matterId: string, documentId: string, versionId: string) {
    return this.run(credential, (tx, actor) => {
      this.document(tx, actor, firmId, matterId, documentId, 'READ');
      const version = tx.get('documentVersions', id(versionId));
      if (!version || version.document_id !== documentId || version.law_firm_id !== firmId || version.matter_id !== matterId) reject();
      if (createHash('sha256').update(Buffer.from(version.original_base64, 'base64')).digest('hex') !== version.sha256) reject('DOCUMENT_INTEGRITY_FAILURE');
      return version;
    });
  }
  createTask(credential: string, firmId: string, matterId: string, input: z.infer<typeof TaskInputSchema>) {
    const parsed = parse(TaskInputSchema, input);
    return this.run(credential, (tx, actor) => {
      this.authorization.matter(tx, actor, id(firmId), id(matterId), 'TASK_WRITE');
      this.authorization.participant(tx, parsed.responsible_identity_id, firmId, matterId, 'READ');
      const task: Task = { ...parsed, id: this.newId(), law_firm_id: firmId, matter_id: matterId, kind: 'INTERNAL', draft_review_id: null, status: 'PENDING', created_at: this.now() };
      tx.insert('tasks', task); this.activity(tx, actor, firmId, matterId, 'TASK_CREATED', task.id); return task;
    });
  }
  getTask(credential: string, firmId: string, matterId: string, taskId: string) {
    return this.run(credential, (tx, actor) => { this.authorization.matter(tx, actor, id(firmId), id(matterId), 'READ'); const task = tx.get('tasks', id(taskId)); if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId) reject(); return task; });
  }
  updateTaskStatus(credential: string, firmId: string, matterId: string, taskId: string, status: 'PENDING' | 'DONE' | 'CANCELLED') {
    parse(z.enum(['PENDING', 'DONE', 'CANCELLED']), status);
    return this.run(credential, (tx, actor) => {
      this.authorization.matter(tx, actor, id(firmId), id(matterId), 'TASK_WRITE');
      const task = tx.get('tasks', id(taskId)); if (!task || task.law_firm_id !== firmId || task.matter_id !== matterId) reject();
      if (task.kind === 'DRAFT_REVIEW') reject('USE_REVIEW_WORKFLOW');
      if (actor.identity_id !== task.responsible_identity_id) this.authorization.matter(tx, actor, firmId, matterId, 'MANAGE');
      const updated = { ...task, status }; tx.replace('tasks', updated); this.activity(tx, actor, firmId, matterId, 'TASK_STATUS_CHANGED', task.id); return updated;
    });
  }
  prepareDraft(credential: string, firmId: string, matterId: string, title: string, content: string) {
    parse(DocumentInputSchema, { title }); parse(z.string().min(1).max(1_000_000), content);
    return this.run(credential, (tx, actor) => {
      this.authorization.matter(tx, actor, id(firmId), id(matterId), 'DRAFT_WRITE');
      const document: Document = { id: this.newId(), law_firm_id: firmId, matter_id: matterId, title, purpose: 'DRAFT', current_version_id: null, created_at: this.now() };
      tx.insert('documents', document);
      const version = this.incorporate(tx, actor, document, Buffer.from(content, 'utf8'), { mime_type: 'text/plain; charset=utf-8', original_filename: 'draft.txt' });
      tx.replace('documents', { ...document, current_version_id: version.id });
      const draft: Draft = { id: this.newId(), law_firm_id: firmId, matter_id: matterId, document_id: document.id, document_version_id: version.id, author_identity_id: actor.identity_id, status: 'DRAFT', created_at: this.now() };
      tx.insert('drafts', draft); this.activity(tx, actor, firmId, matterId, 'DRAFT_CREATED', draft.id, version.id); return draft;
    });
  }
  private draft(tx: CoreTransaction, actor: AuthenticatedPrincipal, firmId: string, matterId: string, draftId: string, permission: MatterPermission): Draft {
    this.authorization.matter(tx, actor, id(firmId), id(matterId), permission);
    const draft = tx.get('drafts', id(draftId)); if (!draft || draft.law_firm_id !== firmId || draft.matter_id !== matterId) reject(); return draft;
  }
  getDraft(credential: string, firmId: string, matterId: string, draftId: string) { return this.run(credential, (tx, actor) => this.draft(tx, actor, firmId, matterId, draftId, 'READ')); }
  reviseDraft(credential: string, firmId: string, matterId: string, draftId: string, expectedVersionId: string, content: string) {
    id(expectedVersionId); parse(z.string().min(1).max(1_000_000), content);
    return this.run(credential, (tx, actor) => {
      const draft = this.draft(tx, actor, firmId, matterId, draftId, 'DRAFT_WRITE');
      if (draft.author_identity_id !== actor.identity_id) this.authorization.matter(tx, actor, firmId, matterId, 'MANAGE');
      if (draft.document_version_id !== expectedVersionId) reject('VERSION_CONFLICT');
      const document = this.document(tx, actor, firmId, matterId, draft.document_id, 'DRAFT_WRITE');
      const version = this.incorporate(tx, actor, document, Buffer.from(content, 'utf8'), { mime_type: 'text/plain; charset=utf-8', original_filename: 'draft.txt' });
      for (const review of tx.list('reviews', { law_firm_id: firmId, matter_id: matterId }).filter(item => item.draft_id === draftId && item.status === 'PENDING')) {
        tx.replace('reviews', { ...review, status: 'SUPERSEDED' });
        for (const task of tx.list('tasks', { law_firm_id: firmId, matter_id: matterId }).filter(item => item.draft_review_id === review.id)) tx.replace('tasks', { ...task, status: 'CANCELLED' });
      }
      tx.replace('documents', { ...document, current_version_id: version.id });
      const revised: Draft = { ...draft, document_version_id: version.id, status: 'DRAFT' }; tx.replace('drafts', revised);
      this.activity(tx, actor, firmId, matterId, 'DRAFT_REVISED', draft.id, version.id); return revised;
    });
  }
  requestDraftReview(credential: string, firmId: string, matterId: string, draftId: string, reviewerIdentityId: string, internalDueAt: string | null) {
    id(reviewerIdentityId); parse(TaskInputSchema, { title: 'Revisión', responsible_identity_id: reviewerIdentityId, internal_due_at: internalDueAt });
    return this.run(credential, (tx, actor) => {
      const draft = this.draft(tx, actor, firmId, matterId, draftId, 'DRAFT_WRITE');
      if (draft.author_identity_id !== actor.identity_id) this.authorization.matter(tx, actor, firmId, matterId, 'MANAGE');
      if (draft.author_identity_id === reviewerIdentityId) reject('SELF_REVIEW_FORBIDDEN');
      this.authorization.participant(tx, reviewerIdentityId, firmId, matterId, 'DRAFT_REVIEW');
      if (!['DRAFT', 'CHANGES_REQUESTED'].includes(draft.status)) reject('DRAFT_STATE_CONFLICT');
      const review: DraftReview = { id: this.newId(), law_firm_id: firmId, matter_id: matterId, draft_id: draftId, document_version_id: draft.document_version_id, reviewer_identity_id: reviewerIdentityId, status: 'PENDING', decided_at: null, created_at: this.now() };
      const task: Task = { id: this.newId(), law_firm_id: firmId, matter_id: matterId, title: 'Revisar borrador documental', responsible_identity_id: reviewerIdentityId, internal_due_at: internalDueAt, kind: 'DRAFT_REVIEW', draft_review_id: review.id, status: 'PENDING', created_at: this.now() };
      tx.insert('reviews', review); tx.insert('tasks', task); tx.replace('drafts', { ...draft, status: 'IN_REVIEW' });
      this.activity(tx, actor, firmId, matterId, 'REVIEW_REQUESTED', review.id, review.document_version_id); return { review, task };
    });
  }
  decideDraftReview(credential: string, firmId: string, matterId: string, reviewId: string, input: { decision: 'APPROVE' | 'REQUEST_CHANGES'; expected_version_id: string; explicitly_confirmed: true }) {
    const parsed = parse(z.object({ decision: z.enum(['APPROVE', 'REQUEST_CHANGES']), expected_version_id: IdSchema, explicitly_confirmed: z.literal(true) }).strict(), input);
    return this.run(credential, (tx, actor) => {
      this.authorization.matter(tx, actor, id(firmId), id(matterId), 'DRAFT_REVIEW');
      const review = tx.get('reviews', id(reviewId));
      if (!review || review.law_firm_id !== firmId || review.matter_id !== matterId || review.reviewer_identity_id !== actor.identity_id) reject();
      const draft = this.draft(tx, actor, firmId, matterId, review.draft_id, 'DRAFT_REVIEW');
      if (draft.author_identity_id === actor.identity_id) reject('SELF_REVIEW_FORBIDDEN');
      if (review.status !== 'PENDING' || draft.status !== 'IN_REVIEW') reject('REVIEW_STATE_CONFLICT');
      if (review.document_version_id !== parsed.expected_version_id || draft.document_version_id !== parsed.expected_version_id) reject('VERSION_CONFLICT');
      const status = parsed.decision === 'APPROVE' ? 'APPROVED' as const : 'CHANGES_REQUESTED' as const;
      const decided = { ...review, status, decided_at: this.now() }; tx.replace('reviews', decided); tx.replace('drafts', { ...draft, status });
      for (const task of tx.list('tasks', { law_firm_id: firmId, matter_id: matterId }).filter(item => item.draft_review_id === reviewId)) tx.replace('tasks', { ...task, status: 'DONE' });
      this.activity(tx, actor, firmId, matterId, status === 'APPROVED' ? 'DRAFT_APPROVED' : 'CHANGES_REQUESTED', draft.id, parsed.expected_version_id);
      return decided;
    });
  }
  matterActivity(credential: string, firmId: string, matterId: string) { return this.run(credential, (tx, actor) => { this.authorization.matter(tx, actor, id(firmId), id(matterId), 'READ'); return tx.list('activities', { law_firm_id: firmId, matter_id: matterId }); }); }
}
