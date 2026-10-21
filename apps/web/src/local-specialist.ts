import { z } from 'zod';
import { Authorization } from '../../../os-core/src/authorization.js';
import { CoreError, type CoreTransaction, type AuthenticatedPrincipal, type ActivityAction } from '../../../os-core/src/contracts.js';
import { decodeBase64 } from '../../../os-core/src/bytes.js';
import type { OsCoreService } from '../../../os-core/src/service.js';
import { AssignmentSchema, PlanSchema, executeContractualPilot, verifyPilotRun, auditPilotOutputs, hashText, hashValue, SYNTHETIC_CONTRACT, SYNTHETIC_ANNEX, type PilotState, type PilotEvidence, type PilotRun } from './contractual-pilot.js';
import { documentRemoved, type DocumentChange } from './document-lifecycle.js';

const id = z.string().min(1).max(128);
const confirmation = { synthetic_data: z.literal(true), max_cost_usd: z.literal(0) };
const AssignInput = z.object({ command_id: id, expected_version: z.number().int().nonnegative(), expected_human_owner_id: id, profile_id: z.literal('elena'), ...confirmation }).strict();
const PrepareInput = z.object({ command_id: id, assignment_id: id, question: z.string().trim().min(15).max(2000), document_ids: z.array(id).min(1).max(4).refine(items => new Set(items).size === items.length), ...confirmation }).strict();
const RunInput = z.object({ plan_id: id, plan_hash: z.string(), authorize_offline: z.literal(true), ...confirmation }).strict();
const DraftInput = z.object({ run_id: id, ...confirmation }).strict();
const RecheckInput = DraftInput.extend({ expected_version_id: id, explicitly_confirmed: z.literal(true) }).strict();
const FixtureInput = z.object({ command_id: id, ...confirmation }).strict();
function fail(code: string): never { throw new CoreError(code); }
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  return result.success ? result.data : fail('PILOT_INVALID_INPUT');
}

export async function handleLocalSpecialist(tx: CoreTransaction, pilot: PilotState, principal: AuthenticatedPrincipal, firm: string, matterId: string, operation: string, body: unknown, core: OsCoreService, credential: string, changes: readonly DocumentChange[] = []) {
  const auth = new Authorization();
  const matter = await auth.matter(tx, principal, firm, matterId, body === undefined ? 'READ' : operation === 'draft' || operation === 'recheck' ? 'DRAFT_WRITE' : operation === 'fixture' ? 'DOCUMENT_WRITE' : 'MANAGE');
  const scope = { law_firm_id: firm, matter_id: matterId };
  const inScope = (row: typeof scope) => row.law_firm_id === firm && row.matter_id === matterId;
  const assignments = pilot.assignments.filter(inScope).sort((a, b) => b.version - a.version);
  const assignment = assignments[0];
  const allDocuments = await tx.list('documents', scope), scopedDocuments = allDocuments.filter(document => !documentRemoved(changes, document.id));
  const originalDocuments = scopedDocuments.filter(document => document.purpose === 'ORIGINAL');
  const inventoryHash = await hashValue(originalDocuments.map(document => ({ id: document.id, version: document.current_version_id })).sort((a, b) => a.id.localeCompare(b.id, 'en')));
  const isCurrent = (run: PilotRun) => run.inventory_hash === inventoryHash && run.human_owner_id === matter.responsible_identity_id && run.assignment_id === assignment?.id && run.evidence.every(document => scopedDocuments.find(current => current.id === document.document_id)?.current_version_id === document.version_id);
  async function event(action: ActivityAction, resourceId: string, versionId: string | null = null) {
    await tx.insert('activities', { ...scope, id: crypto.randomUUID(), actor_identity_id: principal.identity_id, action, resource_id: resourceId, version_id: versionId, created_at: new Date().toISOString() });
  }
  if (body === undefined && operation === 'state') {
    const runs = [];
    for (const run of pilot.runs.filter(inScope).slice().reverse()) {
      await verifyPilotRun(run);
      const links = pilot.draft_links.filter(link => link.run_id === run.id);
      const link = links.at(-1);
      const draft = link ? await tx.get('drafts', link.draft_id) : undefined;
      runs.push({ ...run, validity: isCurrent(run) ? 'CURRENT' as const : 'OUTDATED' as const, draft_link: link ? { ...link, current_version_id: draft?.document_version_id, audit_current: link.document_version_id === draft?.document_version_id } : null });
    }
    return { assignment: assignment?.human_owner_id === matter.responsible_identity_id ? assignment : null, assignment_version: assignment?.version ?? 0, plans: pilot.plans.filter(inScope), runs, offline_only: true, cost_usd: 0 };
  }
  if (operation === 'assign') {
    const input = parse(AssignInput, body);
    if (input.expected_human_owner_id !== matter.responsible_identity_id) fail('PILOT_OWNER_CHANGED');
    const prior = pilot.assignments.find(item => item.command_id === input.command_id);
    if (prior) {
      if (!inScope(prior) || prior.human_owner_id !== matter.responsible_identity_id || prior.assigned_by !== principal.identity_id) fail('PILOT_COMMAND_CONFLICT');
      return prior;
    }
    if ((assignment?.version ?? 0) !== input.expected_version) fail('PILOT_ASSIGNMENT_CONFLICT');
    const next = AssignmentSchema.parse({ ...scope, id: crypto.randomUUID(), command_id: input.command_id, version: input.expected_version + 1, human_owner_id: matter.responsible_identity_id, profile_id: 'elena', pack_id: 'civil_contractual', pack_version: 1, assigned_by: principal.identity_id, created_at: new Date().toISOString() });
    pilot.assignments.push(next);
    await event('SPECIALIST_ASSIGNED', next.id);
    return next;
  }
  // Execution authority is distinct from MANAGE and from the assignment itself.
  if (principal.identity_id !== matter.responsible_identity_id) fail('PILOT_RESPONSIBLE_REQUIRED');
  if (operation === 'fixture') {
    const input = parse(FixtureInput, body);
    const prior = pilot.fixture_commands.find(item => item.command_id === input.command_id);
    if (prior) return inScope(prior) ? prior : fail('PILOT_COMMAND_CONFLICT');
    const documentIds = [];
    for (const [title, content] of [['Contrato sintético Elena', SYNTHETIC_CONTRACT], ['Anexo A', SYNTHETIC_ANNEX]]) {
      const digest = await hashText(content!);
      let existingId: string | undefined;
      for (const existing of [...scopedDocuments, ...allDocuments.filter(document => documentRemoved(changes, document.id))].filter(document => document.purpose === 'ORIGINAL' && document.current_version_id)) {
        const version = await tx.get('documentVersions', existing.current_version_id!);
        if (version?.sha256 === digest && version.mime_type === 'text/plain') { existingId = existing.id; break; }
      }
      if (existingId) { documentIds.push(existingId); continue; }
      const document = await core.createDocument(credential, firm, matterId, { title: title! });
      const version = await core.addDocumentVersion(credential, firm, matterId, document.id, new TextEncoder().encode(content!), { mime_type: 'text/plain', original_filename: title + '.txt' });
      await core.publishDocumentVersion(credential, firm, matterId, document.id, version.id, null);
      documentIds.push(document.id);
    }
    const result = { ...scope, command_id: input.command_id, document_ids: documentIds };
    pilot.fixture_commands.push(result);
    return result;
  }
  if (operation === 'prepare') {
    const input = parse(PrepareInput, body);
    if (!assignment || assignment.id !== input.assignment_id || assignment.human_owner_id !== matter.responsible_identity_id) fail('PILOT_ASSIGNMENT_REQUIRED');
    const evidence: PilotEvidence[] = [];
    let size = 0;
    for (const documentId of input.document_ids) {
      const document = scopedDocuments.find(item => item.id === documentId);
      if (!document?.current_version_id) fail('PILOT_DOCUMENT_UNAVAILABLE');
      const version = await core.getDocumentVersion(credential, firm, matterId, documentId, document.current_version_id);
      if (!/^text\/plain(?:;|$)/iu.test(version.mime_type)) fail('PILOT_TEXT_ONLY');
      const bytes = decodeBase64(version.original_base64);
      size += bytes.byteLength;
      if (size > 24576) fail('PILOT_EVIDENCE_LIMIT');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      evidence.push({ document_id: documentId, version_id: version.id, sha256: version.sha256, title: document.title, nature: document.purpose === 'DRAFT' ? 'PARTY_ALLEGATION' : 'DOCUMENT_TEXT', text });
    }
    const prior = pilot.plans.find(item => item.command_id === input.command_id);
    if (prior) {
      if (!inScope(prior) || prior.question !== input.question || prior.assignment_id !== assignment.id || prior.inventory_hash !== inventoryHash || await hashValue(prior.evidence) !== await hashValue(evidence)) fail('PILOT_COMMAND_CONFLICT');
      return prior;
    }
    const now = new Date();
    const content = { ...scope, id: crypto.randomUUID(), command_id: input.command_id, assignment_id: assignment.id, assignment_version: assignment.version, human_owner_id: matter.responsible_identity_id, question: input.question, evidence, inventory_hash: inventoryHash, created_at: now.toISOString(), expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), mode: 'OFFLINE_SIMULATION' as const, max_cost_usd: 0 as const };
    const plan = PlanSchema.parse({ ...content, plan_hash: await hashValue(content) });
    pilot.plans.push(plan);
    await event('SPECIALIST_PLAN_PREPARED', plan.id);
    return plan;
  }
  if (operation === 'run') {
    const input = parse(RunInput, body);
    const plan = pilot.plans.find(item => item.id === input.plan_id && inScope(item));
    if (!plan || plan.plan_hash !== input.plan_hash) fail('PILOT_PLAN_UNAVAILABLE');
    if (Date.parse(plan.expires_at) <= Date.now()) fail('PILOT_PLAN_EXPIRED');
    if (plan.inventory_hash !== inventoryHash || plan.human_owner_id !== matter.responsible_identity_id || plan.assignment_id !== assignment?.id) fail('PILOT_PLAN_OUTDATED');
    for (const document of plan.evidence) if ((await tx.get('documents', document.document_id))?.current_version_id !== document.version_id) fail('PILOT_PLAN_OUTDATED');
    const prior = pilot.runs.find(run => run.plan_id === plan.id);
    if (prior) { await verifyPilotRun(prior); return prior; }
    const run = await executeContractualPilot(plan);
    pilot.runs.push(run);
    await event('SPECIALIST_RUN_COMPLETED', run.id);
    return run;
  }
  if (operation === 'draft' || operation === 'recheck') {
    const input = operation === 'draft' ? parse(DraftInput, body) : parse(RecheckInput, body);
    const run = pilot.runs.find(item => item.id === input.run_id && inScope(item));
    if (!run) fail('PILOT_RUN_UNAVAILABLE');
    await verifyPilotRun(run);
    const prior = pilot.draft_links.find(link => link.run_id === run.id);
    if (operation === 'draft') {
      if (prior) return prior;
      if (!isCurrent(run)) fail('PILOT_PLAN_OUTDATED');
      const draft = await core.prepareDraft(credential, firm, matterId, 'Elena · revisión contractual sintética', run.final_markdown);
      const link = { ...scope, run_id: run.id, draft_id: draft.id, document_version_id: draft.document_version_id, content_hash: run.audit.final_content_hash, audit: run.audit };
      pilot.draft_links.push(link);
      return link;
    }
    const recheck = parse(RecheckInput, body);
    if (!prior) fail('PILOT_RUN_UNAVAILABLE');
    const draft = await core.getDraft(credential, firm, matterId, prior.draft_id);
    if (draft.document_version_id !== recheck.expected_version_id) fail('VERSION_CONFLICT');
    const existing = pilot.draft_links.find(link => link.run_id === run.id && link.document_version_id === draft.document_version_id);
    if (existing) return existing;
    const version = await core.getDocumentVersion(credential, firm, matterId, draft.document_id, draft.document_version_id);
    const content = new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64(version.original_base64));
    const outputs = run.outputs.map(output => output.id === 'final' ? { ...output, author: 'HUMAN' as const, text: content } : output);
    const audit = await auditPilotOutputs(outputs, content);
    const link = { ...scope, run_id: run.id, draft_id: draft.id, document_version_id: version.id, content_hash: await hashText(content), audit };
    pilot.draft_links.push(link);
    await event('SPECIALIST_SOURCES_RECHECKED', draft.id, version.id);
    return link;
  }
  fail('LOCAL_ROUTE_UNAVAILABLE');
}

export type PilotView = {
  assignment: z.infer<typeof AssignmentSchema> | null; assignment_version: number;
  plans: z.infer<typeof PlanSchema>[];
  runs: Array<PilotRun & { validity: 'CURRENT' | 'OUTDATED'; draft_link: (PilotState['draft_links'][number] & { current_version_id?: string; audit_current: boolean }) | null }>;
};
