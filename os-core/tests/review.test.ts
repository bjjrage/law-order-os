import { describe, expect, it } from 'vitest';
import { ALL_MATTER_PERMISSIONS } from '../src/index.js';
import { setup } from './fixtures.js';

async function reviewSetup() {
  const context = await setup();
  const { service, firm, matter } = context;
  await service.grantParticipant('admin-token', firm.id, matter.id, 'reviewer', [...ALL_MATTER_PERMISSIONS]);
  const draft = await service.prepareDraft('lawyer-token', firm.id, matter.id, 'Synthetic draft', 'SYNTHETIC draft version one');
  const requested = await service.requestDraftReview('lawyer-token', firm.id, matter.id, draft.id, 'reviewer', null);
  return { ...context, draft, ...requested };
}
describe('OS Core explicit human review — TESTED_OFFLINE', () => {
  it('requires explicit confirmation, not task completion or a download', async () => {
    const { service, firm, matter, draft, review, task } = await reviewSetup();
    await expect(Promise.resolve().then(() => service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: draft.document_version_id, explicitly_confirmed: false } as never))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(service.updateTaskStatus('reviewer-token', firm.id, matter.id, task.id, 'DONE')).rejects.toMatchObject({ code: 'USE_REVIEW_WORKFLOW' });
    await service.getDocumentVersion('reviewer-token', firm.id, matter.id, draft.document_id, draft.document_version_id);
    expect((await service.getDraft('lawyer-token', firm.id, matter.id, draft.id)).status).toBe('IN_REVIEW');
  });
  it('rejects self review and a non-designated reviewer even with review permission', async () => {
    const { service, firm, matter, draft, review } = await reviewSetup();
    await expect(service.requestDraftReview('lawyer-token', firm.id, matter.id, draft.id, 'lawyer', null)).rejects.toMatchObject({ code: 'SELF_REVIEW_FORBIDDEN' });
    await expect(service.decideDraftReview('admin-token', firm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: draft.document_version_id, explicitly_confirmed: true })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('binds approval to the exact frozen version and rejects stale versions', async () => {
    const { service, firm, matter, draft, review } = await reviewSetup();
    await expect(service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: 'unknown-old-version', explicitly_confirmed: true })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await service.getDraft('lawyer-token', firm.id, matter.id, draft.id)).status).toBe('IN_REVIEW');
  });
  it('supersedes outstanding reviews when content changes and preserves old originals', async () => {
    const { service, firm, matter, draft, review, task } = await reviewSetup();
    const changed = await service.reviseDraft('lawyer-token', firm.id, matter.id, draft.id, draft.document_version_id, 'SYNTHETIC draft version two');
    expect(changed.status).toBe('DRAFT'); expect(changed.document_version_id).not.toBe(draft.document_version_id);
    expect((await service.getTask('reviewer-token', firm.id, matter.id, task.id)).status).toBe('CANCELLED');
    await expect(service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: draft.document_version_id, explicitly_confirmed: true })).rejects.toMatchObject({ code: 'REVIEW_STATE_CONFLICT' });
    const original = await service.getDocumentVersion('lawyer-token', firm.id, matter.id, draft.document_id, draft.document_version_id);
    expect(Buffer.from(original.original_base64, 'base64').toString()).toBe('SYNTHETIC draft version one');
  });
  it('does not allow external document version commands to bypass the draft review workflow', async () => {
    const { service, firm, matter, draft } = await reviewSetup();
    await expect(service.addDocumentVersion('lawyer-token', firm.id, matter.id, draft.document_id, Buffer.from('Injected'), { mime_type: 'text/plain', original_filename: 'injected.txt' })).rejects.toMatchObject({ code: 'USE_DRAFT_WORKFLOW' });
    await expect(service.publishDocumentVersion('lawyer-token', firm.id, matter.id, draft.document_id, draft.document_version_id, draft.document_version_id)).rejects.toMatchObject({ code: 'USE_DRAFT_WORKFLOW' });
  });
  it('removes approval when an approved draft is revised and demands a new human decision', async () => {
    const { service, firm, matter, draft, review } = await reviewSetup();
    await service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: draft.document_version_id, explicitly_confirmed: true });
    const changed = await service.reviseDraft('lawyer-token', firm.id, matter.id, draft.id, draft.document_version_id, 'SYNTHETIC version after approval');
    expect(changed.status).toBe('DRAFT');
    const events = await service.matterActivity('lawyer-token', firm.id, matter.id);
    expect(events.filter(event => event.action === 'DRAFT_APPROVED')).toMatchObject([{ version_id: draft.document_version_id }]);
    expect(events.filter(event => event.action === 'DRAFT_APPROVED').some(event => event.version_id === changed.document_version_id)).toBe(false);
    await expect(service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: changed.document_version_id, explicitly_confirmed: true })).rejects.toMatchObject({ code: 'REVIEW_STATE_CONFLICT' });
  });
  it('requires reviewer role and explicit participation, and revocation takes effect before approval', async () => {
    const { service, firm, matter, draft, review } = await reviewSetup();
    await service.grantParticipant('admin-token', firm.id, matter.id, 'assistant', ['READ', 'DRAFT_WRITE']);
    await service.revokeParticipant('admin-token', firm.id, matter.id, 'reviewer');
    await expect(service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: draft.document_version_id, explicitly_confirmed: true })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    const another = await service.prepareDraft('lawyer-token', firm.id, matter.id, 'Another', 'Synthetic');
    await expect(service.requestDraftReview('lawyer-token', firm.id, matter.id, another.id, 'assistant', null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.requestDraftReview('lawyer-token', firm.id, matter.id, another.id, 'stranger', null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('rejects draft/review IDs supplied from another study', async () => {
    const { service, firm, otherFirm, matter, draft, review } = await reviewSetup();
    await expect(service.getDraft('other-token', firm.id, matter.id, draft.id)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(service.decideDraftReview('other-token', otherFirm.id, matter.id, review.id, { decision: 'APPROVE', expected_version_id: draft.document_version_id, explicitly_confirmed: true })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('records changes requested and then a fresh explicit review without auto-approval', async () => {
    const { service, firm, matter, draft, review } = await reviewSetup();
    await service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, { decision: 'REQUEST_CHANGES', expected_version_id: draft.document_version_id, explicitly_confirmed: true });
    expect((await service.getDraft('lawyer-token', firm.id, matter.id, draft.id)).status).toBe('CHANGES_REQUESTED');
    const changed = await service.reviseDraft('lawyer-token', firm.id, matter.id, draft.id, draft.document_version_id, 'Corrected synthetic version');
    const fresh = await service.requestDraftReview('lawyer-token', firm.id, matter.id, draft.id, 'reviewer', null);
    expect(fresh.review.document_version_id).toBe(changed.document_version_id);
    expect((await service.getDraft('lawyer-token', firm.id, matter.id, draft.id)).status).toBe('IN_REVIEW');
  });
  it('makes repeated approval a state conflict and records only one approval', async () => {
    const { service, firm, matter, draft, review } = await reviewSetup();
    const input = { decision: 'APPROVE' as const, expected_version_id: draft.document_version_id, explicitly_confirmed: true as const };
    await service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, input);
    await expect(service.decideDraftReview('reviewer-token', firm.id, matter.id, review.id, input)).rejects.toMatchObject({ code: 'REVIEW_STATE_CONFLICT' });
    expect((await service.matterActivity('lawyer-token', firm.id, matter.id)).filter(item => item.action === 'DRAFT_APPROVED')).toHaveLength(1);
  });
});
