import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ALL_MATTER_PERMISSIONS, OsCoreService } from '../src/index.js';
import { MemoryTestPersistence, TestAuthenticator } from '../testing/memory.js';
import { setup } from './fixtures.js';

describe('OS Core — TESTED_OFFLINE contracts, never persistent E2E', () => {
  it('executes all 14 requested service steps with synthetic identities and records explicit version-bound approval', async () => {
    const persistence = new MemoryTestPersistence();
    const auth = new TestAuthenticator();
    for (const name of ['administrator', 'lawyer', 'unauthorized']) auth.register({ id: name, subject: `test:${name}`, display_name: name, active: true }, name);
    const service = new OsCoreService(persistence, auth);
    const firm = await service.createLawFirm('administrator', 'Estudio E2E sintético'); // 1
    await service.addMember('administrator', firm.id, 'lawyer', 'LAWYER'); // 2
    const client = await service.createClient('administrator', firm.id, { kind: 'ORGANIZATION', display_name: 'Cliente sintético SA', identification: null }); // 3
    const matter = await service.createMatter('administrator', firm.id, { client_id: client.id, title: 'Asesoramiento sintético', kind: 'ADVISORY', subject_area: 'Contratos', responsible_identity_id: 'lawyer', opened_on: '2026-10-13', closed_on: null }); // 4,5
    expect(matter.responsible_identity_id).toBe('lawyer');
    const document = await service.createDocument('administrator', firm.id, matter.id, { title: 'Original sintético' });
    const original = await service.addDocumentVersion('administrator', firm.id, matter.id, document.id, Buffer.from('ORIGINAL SINTÉTICO'), { mime_type: 'text/plain', original_filename: 'original.txt' });
    await service.publishDocumentVersion('administrator', firm.id, matter.id, document.id, original.id, null); // 6
    const task = await service.createTask('administrator', firm.id, matter.id, { title: 'Preparar borrador', responsible_identity_id: 'lawyer', internal_due_at: null }); // 7
    expect((await service.getMatter('lawyer', firm.id, matter.id)).id).toBe(matter.id); // 8
    await expect(service.getMatter('unauthorized', firm.id, matter.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' }); // 9,10
    const draft = await service.prepareDraft('lawyer', firm.id, matter.id, 'Borrador sintético', 'TEXTO NO PRESENTADO'); // 11
    const { review, task: reviewTask } = await service.requestDraftReview('lawyer', firm.id, matter.id, draft.id, 'administrator', null); // 12
    expect((await service.getTask('administrator', firm.id, matter.id, reviewTask.id)).status).toBe('PENDING');
    expect((await service.getDraft('lawyer', firm.id, matter.id, draft.id)).status).toBe('IN_REVIEW');
    await service.decideDraftReview('administrator', firm.id, matter.id, review.id, { decision: 'APPROVE', explicitly_confirmed: true, expected_version_id: draft.document_version_id }); // 13
    const events = await service.matterActivity('lawyer', firm.id, matter.id); // 14
    expect(events.filter(item => item.action === 'DRAFT_APPROVED')).toMatchObject([{ actor_identity_id: 'administrator', resource_id: draft.id, version_id: draft.document_version_id }]);
    expect((await service.getDraft('lawyer', firm.id, matter.id, draft.id)).status).toBe('APPROVED');
    expect((await service.getTask('administrator', firm.id, matter.id, reviewTask.id)).status).toBe('DONE');
    expect((await service.getTask('lawyer', firm.id, matter.id, task.id)).status).toBe('PENDING');
    expect(persistence.assurance).toBe('TESTED_OFFLINE');
    expect(JSON.stringify(events)).not.toContain('TEXTO NO PRESENTADO');
    expect(JSON.stringify(events)).not.toContain('Cliente sintético SA');
  });

  it.each(['getMatter', 'getDocument', 'getDocumentVersion', 'getTask', 'matterActivity'] as const)('rejects known IDs from another study through %s', async operation => {
    const { service, firm, otherFirm, matter, document, version, task } = await setup();
    const invoke = (scope: string) => {
      switch (operation) {
        case 'getMatter': return service.getMatter('other-token', scope, matter.id);
        case 'getDocument': return service.getDocument('other-token', scope, matter.id, document.id);
        case 'getDocumentVersion': return service.getDocumentVersion('other-token', scope, matter.id, document.id, version.id);
        case 'getTask': return service.getTask('other-token', scope, matter.id, task.id);
        case 'matterActivity': return service.matterActivity('other-token', scope, matter.id);
      }
    };
    await expect(invoke(firm.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(invoke(otherFirm.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('denies an active same-study lawyer without explicit matter participation', async () => {
    const { service, firm, matter, document, version, task } = await setup();
    await expect(service.getMatter('stranger-token', firm.id, matter.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.getDocumentVersion('stranger-token', firm.id, matter.id, document.id, version.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.getTask('stranger-token', firm.id, matter.id, task.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('supports identity membership in two studies but requires participation in each matter', async () => {
    const { service, firm, otherFirm, matter } = await setup();
    await service.addMember('other-token', otherFirm.id, 'lawyer', 'LAWYER');
    expect((await service.getLawFirm('lawyer-token', otherFirm.id)).id).toBe(otherFirm.id);
    await expect(service.getMatter('lawyer-token', otherFirm.id, matter.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    expect((await service.getMatter('lawyer-token', firm.id, matter.id)).id).toBe(matter.id);
  });
  it('prevents a second firm administrator from accessing another firm records', async () => {
    const { service, firm, client } = await setup();
    await expect(service.getClient('other-token', firm.id, client.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.addMember('other-token', firm.id, 'other', 'ADMINISTRATOR')).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('does not grant matter access to study administrators implicitly', async () => {
    const { service, firm, matter } = await setup();
    await service.addMember('admin-token', firm.id, 'other', 'ADMINISTRATOR');
    await expect(service.getMatter('other-token', firm.id, matter.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('requires administrator role to create memberships and cannot add unknown identities', async () => {
    const { service, firm } = await setup();
    await expect(service.addMember('lawyer-token', firm.id, 'other', 'ADMINISTRATOR')).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.addMember('admin-token', firm.id, 'nonexistent', 'LAWYER')).rejects.toMatchObject({ code: 'IDENTITY_NOT_AVAILABLE' });
    await expect(service.addMember('admin-token', firm.id, 'lawyer', 'LAWYER')).rejects.toMatchObject({ code: 'MEMBERSHIP_ALREADY_EXISTS' });
  });
  it('rejects foreign client/contact references rather than reparenting them', async () => {
    const { service, firm, otherFirm, client, matter } = await setup();
    await expect(service.createMatter('other-token', otherFirm.id, { client_id: client.id, title: 'Foreign', kind: 'OTHER', subject_area: 'Other', responsible_identity_id: 'other', opened_on: '2026-10-13', closed_on: null })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.createContact('other-token', otherFirm.id, { client_id: client.id, display_name: 'Foreign', email: null, phone: null })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    const foreignClient = await service.createClient('other-token', otherFirm.id, { kind: 'ORGANIZATION', display_name: 'Foreign SA', identification: null });
    const foreignContact = await service.createContact('other-token', otherFirm.id, { client_id: foreignClient.id, display_name: 'Foreign contact', email: null, phone: null });
    await expect(service.createRelatedParty('admin-token', firm.id, matter.id, { kind: 'OTHER', display_name: 'Foreign', contact_id: foreignContact.id })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('separates natural/legal clients, contacts and related parties', async () => {
    const { service, firm, client, matter } = await setup();
    const organization = await service.createClient('admin-token', firm.id, { kind: 'ORGANIZATION', display_name: 'Synthetic corporation', identification: 'SYNTHETIC' });
    const contact = await service.createContact('admin-token', firm.id, { client_id: organization.id, display_name: 'Representative', email: 'test@example.test', phone: null });
    const related = await service.createRelatedParty('admin-token', firm.id, matter.id, { kind: 'OPPOSING_PARTY', display_name: 'Synthetic opposing party', contact_id: null });
    expect(client.kind).toBe('PERSON'); expect(organization.kind).toBe('ORGANIZATION');
    expect(contact.client_id).toBe(organization.id); expect(related.matter_id).toBe(matter.id); expect(related.id).not.toBe(client.id);
  });
  it('rejects unknown payload fields instead of accepting injected tenant IDs', async () => {
    const { service, firm, otherFirm } = await setup();
    await expect(Promise.resolve().then(() => service.createClient('admin-token', firm.id, { kind: 'PERSON', display_name: 'Injected', identification: null, law_firm_id: otherFirm.id } as never))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it.each(['', 'not-a-token', '{"identity_id":"admin"}'])('rejects request-supplied identity/invalid credentials %s', async credential => {
    const { service, firm } = await setup();
    await expect(service.getLawFirm(credential, firm.id)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
  it('rejects expired or revoked sessions and inactive identities', async () => {
    const { service, authenticator, firm, matter } = await setup();
    authenticator.register({ id: 'lawyer', subject: 'test:lawyer', display_name: 'Lawyer', active: true }, 'expired', '2026-10-12T00:00:00.000Z');
    await expect(service.getMatter('expired', firm.id, matter.id)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    authenticator.revoke('lawyer-token');
    await expect(service.getMatter('lawyer-token', firm.id, matter.id)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    authenticator.deactivate('admin');
    await expect(service.getMatter('admin-token', firm.id, matter.id)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
  it('applies membership revocation immediately to old matter permissions', async () => {
    const { service, firm, matter, document } = await setup();
    await service.deactivateMember('admin-token', firm.id, 'lawyer');
    await expect(service.getDocument('lawyer-token', firm.id, matter.id, document.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.createTask('admin-token', firm.id, matter.id, { title: 'Invalid assignee', responsible_identity_id: 'lawyer', internal_due_at: null })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('prevents removing the final study administrator', async () => {
    const { service, firm } = await setup();
    await expect(service.deactivateMember('admin-token', firm.id, 'admin')).rejects.toMatchObject({ code: 'LAST_ADMINISTRATOR' });
  });
  it('caps matter grants by role and requires READ and unique permissions', async () => {
    const { service, firm, matter } = await setup();
    await expect(service.grantParticipant('admin-token', firm.id, matter.id, 'assistant', [...ALL_MATTER_PERMISSIONS])).rejects.toMatchObject({ code: 'ROLE_PERMISSION_CONFLICT' });
    await expect(Promise.resolve().then(() => service.grantParticipant('admin-token', firm.id, matter.id, 'assistant', ['DRAFT_WRITE']))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(Promise.resolve().then(() => service.grantParticipant('admin-token', firm.id, matter.id, 'assistant', ['READ', 'READ']))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await service.grantParticipant('admin-token', firm.id, matter.id, 'assistant', ['READ', 'DRAFT_WRITE']);
    await expect(service.prepareDraft('assistant-token', firm.id, matter.id, 'Draft', 'Synthetic')).resolves.toMatchObject({ author_identity_id: 'assistant' });
    await expect(service.grantParticipant('assistant-token', firm.id, matter.id, 'stranger', ['READ'])).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('revokes participation without affecting other explicit study memberships', async () => {
    const { service, firm, matter } = await setup();
    await service.grantParticipant('admin-token', firm.id, matter.id, 'stranger', ['READ']);
    await expect(service.getMatter('stranger-token', firm.id, matter.id)).resolves.toMatchObject({ id: matter.id });
    await service.revokeParticipant('admin-token', firm.id, matter.id, 'stranger');
    await expect(service.getMatter('stranger-token', firm.id, matter.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.getLawFirm('stranger-token', firm.id)).resolves.toMatchObject({ id: firm.id });
    await expect(service.revokeParticipant('admin-token', firm.id, matter.id, 'lawyer')).rejects.toMatchObject({ code: 'RESPONSIBLE_PARTICIPANT_REQUIRED' });
  });
  it('preserves immutable original bytes, independent versions and explicit publication', async () => {
    const { service, firm, matter, document, version } = await setup();
    const bytes = Buffer.from('SECOND SYNTHETIC VERSION');
    const second = await service.addDocumentVersion('lawyer-token', firm.id, matter.id, document.id, bytes, { mime_type: 'text/plain', original_filename: 'second.txt' });
    bytes.fill(0);
    expect((await service.getDocument('lawyer-token', firm.id, matter.id, document.id)).current_version_id).toBe(version.id);
    await service.publishDocumentVersion('lawyer-token', firm.id, matter.id, document.id, second.id, version.id);
    const old = await service.getDocumentVersion('lawyer-token', firm.id, matter.id, document.id, version.id);
    const current = await service.getDocumentVersion('lawyer-token', firm.id, matter.id, document.id, second.id);
    expect(Buffer.from(old.original_base64, 'base64').toString()).toBe('CONTENIDO PRIVADO SINTÉTICO');
    expect(Buffer.from(current.original_base64, 'base64').toString()).toBe('SECOND SYNTHETIC VERSION');
    expect(current.sha256).toBe(createHash('sha256').update('SECOND SYNTHETIC VERSION').digest('hex'));
    expect(Object.isFrozen(current)).toBe(true);
  });
  it('blocks conflicting concurrent publication and leaves one explicit current version', async () => {
    const { service, firm, matter, document, version } = await setup();
    const a = await service.addDocumentVersion('lawyer-token', firm.id, matter.id, document.id, Buffer.from('A'), { mime_type: 'text/plain', original_filename: 'a.txt' });
    const b = await service.addDocumentVersion('lawyer-token', firm.id, matter.id, document.id, Buffer.from('B'), { mime_type: 'text/plain', original_filename: 'b.txt' });
    const results = await Promise.allSettled([service.publishDocumentVersion('lawyer-token', firm.id, matter.id, document.id, a.id, version.id), service.publishDocumentVersion('lawyer-token', firm.id, matter.id, document.id, b.id, version.id)]);
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(item => item.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason.code).toBe('VERSION_CONFLICT');
  });
  it('does not expose versions from another document or matter using a known version ID', async () => {
    const { service, firm, matter, document, version, client, task } = await setup();
    const second = await service.createDocument('lawyer-token', firm.id, matter.id, { title: 'Second' });
    await expect(service.getDocumentVersion('lawyer-token', firm.id, matter.id, second.id, version.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.publishDocumentVersion('lawyer-token', firm.id, matter.id, second.id, version.id, null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    const newMatter = await service.createMatter('admin-token', firm.id, { client_id: client.id, title: 'Second matter', kind: 'OTHER', subject_area: 'Other', responsible_identity_id: 'lawyer', opened_on: '2026-10-13', closed_on: null });
    await expect(service.getDocument('lawyer-token', firm.id, newMatter.id, document.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.getTask('lawyer-token', firm.id, newMatter.id, task.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    expect((await service.getDocument('lawyer-token', firm.id, matter.id, document.id)).current_version_id).toBe(version.id);
  });
  it('requires assignment to an authorized matter participant and rejects malformed internal due dates', async () => {
    const { service, firm, matter } = await setup();
    await expect(service.createTask('admin-token', firm.id, matter.id, { title: 'No access', responsible_identity_id: 'stranger', internal_due_at: null })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(Promise.resolve().then(() => service.createTask('admin-token', firm.id, matter.id, { title: 'Invalid due date', responsible_identity_id: 'lawyer', internal_due_at: 'tomorrow' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('keeps activity content-free and does not publish any judicial filing event', async () => {
    const { service, firm, matter } = await setup();
    await service.prepareDraft('lawyer-token', firm.id, matter.id, 'Secret title', 'Secret legal document contents');
    const events = await service.matterActivity('lawyer-token', firm.id, matter.id);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('Secret'); expect(serialized).not.toContain('token'); expect(serialized).not.toContain('PRIVADO');
    expect(events.every(event => !event.action.includes('FILED'))).toBe(true);
  });
});
