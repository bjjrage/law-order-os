import { z } from 'zod';
import { Authorization } from '../../../os-core/src/authorization.js';
import { CoreError, ClientInputSchema, MatterInputSchema, type AuthenticatedPrincipal, type CoreTransaction, type ActivityAction, type Task, type Draft, type DraftReview } from '../../../os-core/src/contracts.js';
import { decodeBase64, sha256 as hashTextBytes } from '../../../os-core/src/bytes.js';
import type { OsCoreService } from '../../../os-core/src/service.js';
import { TeamConfigSchema, AssignmentSchema, PlanSchema, loadPack, executeTeam, verifyTeamRun, verifyTeamPlan, auditTeamOutputs, hashTeamValue as hashValue, type TeamState, type TeamRun, type TeamAssignment } from './specialist-engine.js';
import { hashText, type PilotEvidence } from './contractual-pilot.js';
import { asuncionDate } from './local-dates.js';
import { currentDeadline } from '../../../os-core/src/deadlines.js';
import { ExtractionSchema } from './document-extraction-contract.js';
import { MAX_DOCUMENTS, MAX_FILE_BYTES, MAX_BATCH_BYTES, MAX_SELECTED_TEXT_BYTES, MAX_OUTPUT_CHARS, documentFormat, documentMime } from './document-policy.js';
import { documentRemoved, lastDocumentChange } from './document-lifecycle.js';

const id = z.string().min(1).max(128), consent = { synthetic_data: z.literal(true), max_cost_usd: z.literal(0) };
const AssignInput = z.object({ command_id: id, expected_version: z.number().int().nonnegative(), expected_human_owner_id: id, config: TeamConfigSchema, ...consent }).strict();
const PrepareInput = z.object({ command_id: id, assignment_id: id, document_ids: z.array(id).min(1).max(MAX_DOCUMENTS).refine(ids => new Set(ids).size === ids.length), acknowledge_extraction: z.literal(true).optional(), ...consent }).strict();
const RunInput = z.object({ plan_id: id, plan_hash: z.string(), authorize_offline: z.literal(true), ...consent }).strict();
const DraftInput = z.object({ run_id: id, content: z.string().min(1).max(MAX_OUTPUT_CHARS).refine(s => s.trim().length > 0).optional(), ...consent }).strict();
const RecheckInput = z.object({ run_id: id, expected_version_id: id, explicitly_confirmed: z.literal(true), ...consent }).strict();
const LinkInput = z.object({ command_id: id, config: TeamConfigSchema, expected_version: z.number().int().nonnegative(), existing_matter_id: id.optional(), create_matter: MatterInputSchema.optional(), ...consent }).strict().refine(v => Boolean(v.existing_matter_id) !== Boolean(v.create_matter));
const ContextInput = z.object({ command_id: id, config: TeamConfigSchema, expected_version: z.number().int().nonnegative(),
  client: z.discriminatedUnion('mode', [z.object({ mode: z.literal('EXISTING'), client_id: id }).strict(), z.object({ mode: z.literal('NEW'), input: ClientInputSchema }).strict()]),
  matter: z.discriminatedUnion('mode', [z.object({ mode: z.literal('EXISTING'), matter_id: id }).strict(), z.object({ mode: z.literal('NEW'), input: MatterInputSchema.omit({ client_id: true }) }).strict()]),
  ...consent,
}).strict().refine(input => input.client.mode !== 'NEW' || input.matter.mode === 'NEW');
const UploadInput = z.object({ command_id: id, files: z.array(z.object({ title: z.string().trim().min(1).max(240), original_filename: z.string().min(1).max(240), original_base64: z.string().min(4).max(Math.ceil(MAX_FILE_BYTES / 3) * 4), mime_type: z.enum(['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']), extraction: ExtractionSchema.optional() }).strict()).min(1).max(MAX_DOCUMENTS), ...consent }).strict();
const DocumentChangeInput = z.object({ command_id: id, document_id: id, expected_version_id: id, expected_change_id: id.nullable(), action: z.enum(['REMOVE', 'RESTORE']) }).strict();
function fail(code: string): never { throw new CoreError(code); }
function parse<T>(schema: z.ZodType<T>, body: unknown): T { const input = schema.safeParse(body); return input.success ? input.data : fail('TEAM_INVALID_INPUT'); }
const auth = new Authorization();
async function event(tx: CoreTransaction, principal: AuthenticatedPrincipal, firm: string, matter: string, action: ActivityAction, resource: string, version: string | null = null) {
  await tx.insert('activities', { id: crypto.randomUUID(), law_firm_id: firm, matter_id: matter, actor_identity_id: principal.identity_id, action, resource_id: resource, version_id: version, created_at: new Date().toISOString() });
}
export async function linkDirector(tx: CoreTransaction, state: TeamState, actor: AuthenticatedPrincipal, firm: string, body: unknown, core: OsCoreService) {
  await auth.membership(tx, actor, firm);
  const input = parse(LinkInput, body), inputHash = await hashValue(input);
  const prior = state.links.find(link => link.command_id === input.command_id);
  if (prior) {
    if (prior.law_firm_id !== firm || prior.actor_id !== actor.identity_id || prior.input_hash !== inputHash) fail('TEAM_COMMAND_CONFLICT');
    const matter = await auth.matter(tx, actor, firm, prior.matter_id, 'MANAGE');
    return { matter, assignment: state.assignments.find(a => a.id === prior.assignment_id)! };
  }
  if (input.create_matter && input.create_matter.responsible_identity_id !== actor.identity_id) fail('TEAM_RESPONSIBLE_REQUIRED');
  const matter = input.existing_matter_id ? await auth.matter(tx, actor, firm, input.existing_matter_id, 'MANAGE') : await core.createMatter(actor.identity_id, firm, input.create_matter!);
  const assignment = await handleTeam(tx, state, actor, firm, matter.id, 'assign', { command_id: input.command_id, expected_version: input.expected_version, expected_human_owner_id: matter.responsible_identity_id, config: input.config, ...consentValues }, core) as TeamAssignment;
  state.links.push({ law_firm_id: firm, matter_id: matter.id, command_id: input.command_id, actor_id: actor.identity_id, input_hash: inputHash, assignment_id: assignment.id });
  return { matter, assignment };
}
/** Explicit client/matter shortcut. Core writes and team confirmation commit together, including retries. */
export async function confirmDirectorContext(tx: CoreTransaction, state: TeamState, actor: AuthenticatedPrincipal, firm: string, body: unknown, core: OsCoreService) {
  await auth.membership(tx, actor, firm);
  const input = parse(ContextInput, body), inputHash = await hashValue(input);
  const prior = state.context_commands.find(command => command.command_id === input.command_id);
  if (prior) {
    if (prior.law_firm_id !== firm || prior.actor_id !== actor.identity_id || prior.input_hash !== inputHash) fail('TEAM_COMMAND_CONFLICT');
    const matter = await auth.matter(tx, actor, firm, prior.matter_id, 'MANAGE');
    const client = (await core.listClients(actor.identity_id, firm)).find(client => client.id === prior.client_id);
    if (!client || matter.client_id !== client.id) fail('TEAM_CLIENT_MISMATCH');
    return { client, matter, assignment: state.assignments.find(a => a.id === prior.assignment_id)! };
  }
  const client = input.client.mode === 'NEW' ? await core.createClient(actor.identity_id, firm, input.client.input) : (await core.listClients(actor.identity_id, firm)).find(c => c.id === (input.client.mode === 'EXISTING' ? input.client.client_id : ''));
  if (!client) fail('TEAM_CLIENT_UNAVAILABLE');
  const matter = input.matter.mode === 'NEW' ? await core.createMatter(actor.identity_id, firm, { ...input.matter.input, client_id: client.id }) : await auth.matter(tx, actor, firm, input.matter.matter_id, 'MANAGE');
  if (matter.client_id !== client.id) fail('TEAM_CLIENT_MISMATCH');
  const assignment = await handleTeam(tx, state, actor, firm, matter.id, 'assign', { command_id: input.command_id, expected_version: input.expected_version, expected_human_owner_id: matter.responsible_identity_id, config: input.config, ...consentValues }, core) as TeamAssignment;
  state.context_commands.push({ law_firm_id: firm, matter_id: matter.id, client_id: client.id, command_id: input.command_id, actor_id: actor.identity_id, input_hash: inputHash, assignment_id: assignment.id });
  return { client, matter, assignment };
}
/** Multi-file ingestion is atomic; no assignment or execution is implied by attaching evidence. */
async function incorporateTeamDocuments(tx: CoreTransaction, state: TeamState, actor: AuthenticatedPrincipal, firm: string, matterId: string, body: unknown, core: OsCoreService) {
  const input = parse(UploadInput, body), inputHash = await hashValue(input);
  const prior = state.document_commands.find(command => command.command_id === input.command_id);
  const result = (command: TeamState['document_commands'][number]) => ({ document_ids: command.document_ids, reused_document_ids: command.reused_document_ids, removed_document_ids: command.document_ids.filter(id => documentRemoved(state.document_changes, id)) });
  if (prior) return prior.law_firm_id === firm && prior.matter_id === matterId && prior.actor_id === actor.identity_id && prior.input_hash === inputHash ? result(prior) : fail('TEAM_COMMAND_CONFLICT');
  let size = 0;
  const files = [];
  for (const file of input.files) {
    const bytes = decodeBase64(file.original_base64); size += bytes.length;
    let format: keyof typeof documentMime;
    try { format = documentFormat(file.original_filename); } catch { fail('TEAM_FORMAT_UNSUPPORTED'); }
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) fail('TEAM_FILE_LIMIT');
    if (file.mime_type !== documentMime[format]) fail('TEAM_FORMAT_UNSUPPORTED');
    const originalHash = await hashTextBytes(bytes);
    if (format === 'txt') { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('TEAM_TEXT_ONLY'); } }
    if (format !== 'txt' && !file.extraction) fail('TEAM_EXTRACTION_REQUIRED');
    if (format === 'pdf' && !new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-') || format === 'docx' && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) fail('TEAM_FORMAT_UNSUPPORTED');
    if (file.extraction && (file.extraction.format !== format || file.extraction.original_sha256 !== originalHash || file.extraction.text_sha256 !== await hashText(file.extraction.text) || file.extraction.units.some(u => u.end > file.extraction!.text.length || u.start > u.end))) fail('TEAM_EXTRACTION_MISMATCH');
    files.push({ ...file, bytes, originalHash });
  }
  if (size > MAX_BATCH_BYTES) fail('TEAM_FILE_LIMIT');
  const ids: string[] = [], reused: string[] = [], created = new Set<string>();
  const existing = [];
  for (const document of await tx.list('documents', { law_firm_id: firm, matter_id: matterId })) if (document.purpose === 'ORIGINAL' && document.current_version_id) {
    const version = await tx.get('documentVersions', document.current_version_id);
    if (version) existing.push({ document, version });
  }
  for (const file of files) {
    const matches = existing.filter(item => item.version.sha256 === file.originalHash && item.version.mime_type === file.mime_type);
    const duplicate = matches.find(item => !documentRemoved(state.document_changes, item.document.id)) ?? matches[0];
    if (duplicate) { ids.push(duplicate.document.id); if (!created.has(duplicate.document.id)) reused.push(duplicate.document.id); continue; }
    const document = await core.createDocument(actor.identity_id, firm, matterId, { title: file.title });
    const version = await core.addDocumentVersion(actor.identity_id, firm, matterId, document.id, file.bytes, { mime_type: file.mime_type, original_filename: file.original_filename });
    await core.publishDocumentVersion(actor.identity_id, firm, matterId, document.id, version.id, null); ids.push(document.id);
    created.add(document.id);
    existing.push({ document, version });
    if (file.extraction) state.document_extractions.push({ ...file.extraction, law_firm_id: firm, matter_id: matterId, document_id: document.id, version_id: version.id });
  }
  const command = { law_firm_id: firm, matter_id: matterId, command_id: input.command_id, actor_id: actor.identity_id, input_hash: inputHash, document_ids: [...new Set(ids)], reused_document_ids: [...new Set(reused)] };
  state.document_commands.push(command);
  return result(command);
}
const consentValues = { synthetic_data: true, max_cost_usd: 0 };
export async function handleTeam(tx: CoreTransaction, state: TeamState, actor: AuthenticatedPrincipal, firm: string, matterId: string, operation: string, body: unknown, core: OsCoreService, exampleIds: readonly string[] = []) {
  const matter = await auth.matter(tx, actor, firm, matterId, body === undefined ? 'READ' : operation === 'documents' || operation === 'document-status' ? 'DOCUMENT_WRITE' : operation === 'draft' || operation === 'recheck' ? 'DRAFT_WRITE' : 'MANAGE');
  if (operation === 'documents' && body !== undefined) return incorporateTeamDocuments(tx, state, actor, firm, matterId, body, core);
  const scope = { law_firm_id: firm, matter_id: matterId }, inScope = (r: typeof scope) => r.law_firm_id === firm && r.matter_id === matterId;
  if (operation === 'document-status' && body !== undefined) {
    const input = parse(DocumentChangeInput, body), document = await tx.get('documents', input.document_id);
    if (!document || !inScope(document)) fail('TEAM_DOCUMENT_UNAVAILABLE');
    if (document.purpose !== 'ORIGINAL') fail('TEAM_DOCUMENT_IS_DRAFT');
    const prior = state.document_changes.find(change => change.command_id === input.command_id);
    if (prior) {
      if (!inScope(prior) || prior.actor_id !== actor.identity_id || prior.document_id !== input.document_id || prior.version_id !== input.expected_version_id || prior.previous_change_id !== input.expected_change_id || prior.action !== input.action) fail('TEAM_COMMAND_CONFLICT');
      return prior;
    }
    const latest = lastDocumentChange(state.document_changes, document.id);
    if (document.current_version_id !== input.expected_version_id || (latest?.id ?? null) !== input.expected_change_id) fail('TEAM_DOCUMENT_CHANGED');
    if ((input.action === 'REMOVE') === documentRemoved(state.document_changes, document.id)) fail('TEAM_DOCUMENT_CHANGED');
    const change = { ...scope, id: crypto.randomUUID(), command_id: input.command_id, document_id: document.id, version_id: input.expected_version_id, previous_change_id: input.expected_change_id, actor_id: actor.identity_id, action: input.action, created_at: new Date().toISOString() };
    state.document_changes.push(change); return change;
  }
  const assignment = state.assignments.filter(inScope).sort((a, b) => b.version - a.version)[0];
  const allDocuments = await tx.list('documents', scope), documents = allDocuments.filter(document => !documentRemoved(state.document_changes, document.id));
  const inventoryHash = await hashValue(documents.filter(d => d.purpose === 'ORIGINAL').map(d => ({ id: d.id, version: d.current_version_id })).sort((a, b) => a.id.localeCompare(b.id, 'en')));
  const current = (r: { assignment_id: string; human_owner_id: string; inventory_hash: string; evidence: PilotEvidence[] }) => r.assignment_id === assignment?.id && r.human_owner_id === matter.responsible_identity_id && r.inventory_hash === inventoryHash && r.evidence.every(e => documents.find(d => d.id === e.document_id)?.current_version_id === e.version_id);
  if (body === undefined && operation === 'state') {
    const runs = [];
    for (const run of state.runs.filter(inScope).slice().reverse()) {
      await verifyTeamRun(run);
      const link = state.draft_links.filter(l => l.run_id === run.id).at(-1), draft = link ? await tx.get('drafts', link.draft_id) : undefined;
      runs.push({ ...run, validity: current(run) ? 'CURRENT' as const : 'OUTDATED' as const, draft_link: link ? { ...link, current_version_id: draft?.document_version_id, audit_current: draft?.document_version_id === link.document_version_id } : null });
    }
    const metadata: TeamDocumentInfo[] = [], originals = new Map<string, { id: string; title: string }>();
    for (const document of allDocuments) if (document.current_version_id) {
      const version = await tx.get('documentVersions', document.current_version_id), extraction = state.document_extractions.find(e => e.version_id === document.current_version_id);
      if (version) {
        const removed = documentRemoved(state.document_changes, document.id), change = lastDocumentChange(state.document_changes, document.id), key = version.mime_type + ':' + version.sha256;
        const duplicate = !removed && document.purpose === 'ORIGINAL' ? originals.get(key) : undefined;
        if (!removed && document.purpose === 'ORIGINAL' && !duplicate) originals.set(key, { id: document.id, title: document.title });
        const preview = extraction?.text.slice(0, 400) ?? (/^text\/plain/iu.test(version.mime_type) ? new TextDecoder().decode(decodeBase64(version.original_base64).subarray(0, 2048)).slice(0, 400) : '');
        metadata.push({ document_id: document.id, version_id: version.id, title: document.title, original_filename: version.original_filename, mime_type: version.mime_type, status: extraction?.status ?? (/^text\/plain/iu.test(version.mime_type) ? 'COMPLETE_UNREVIEWED' : 'UNREADABLE'), ready: !removed && (extraction ? extraction.status !== 'UNREADABLE' && extraction.units.every(unit => unit.readable) : /^text\/plain/iu.test(version.mime_type)), warnings: extraction?.warnings ?? [], text_length: extraction?.text.length ?? null, source: document.purpose === 'DRAFT' ? 'DRAFT' : exampleIds.includes(document.id) ? 'EXAMPLE' : 'UPLOADED', size_bytes: Math.floor(version.original_base64.length * 3 / 4) - (version.original_base64.endsWith('==') ? 2 : version.original_base64.endsWith('=') ? 1 : 0), incorporated_at: version.incorporated_at, removed, change_id: change?.id ?? null, duplicate_of: duplicate ?? null, preview });
      }
    }
    return { assignment: assignment?.human_owner_id === matter.responsible_identity_id ? assignment : null, assignment_version: assignment?.version ?? 0, plans: state.plans.filter(inScope), runs, documents: metadata };
  }
  if (operation === 'assign') {
    const input = parse(AssignInput, body), inputHash = await hashValue(input);
    if (input.expected_human_owner_id !== matter.responsible_identity_id) fail('TEAM_OWNER_CHANGED');
    const prior = state.assignments.find(a => a.command_id === input.command_id);
    if (prior) return inScope(prior) && prior.actor_id === actor.identity_id && prior.input_hash === inputHash ? prior : fail('TEAM_COMMAND_CONFLICT');
    if ((assignment?.version ?? 0) !== input.expected_version) fail('TEAM_ASSIGNMENT_CONFLICT');
    const next = AssignmentSchema.parse({ ...scope, id: crypto.randomUUID(), command_id: input.command_id, input_hash: inputHash, version: input.expected_version + 1, human_owner_id: matter.responsible_identity_id, actor_id: actor.identity_id, config: input.config, created_at: new Date().toISOString() });
    state.assignments.push(next); await event(tx, actor, firm, matterId, 'SPECIALIST_ASSIGNED', next.id); return next;
  }
  if (actor.identity_id !== matter.responsible_identity_id) fail('TEAM_RESPONSIBLE_REQUIRED');
  if (operation === 'prepare') {
    const input = parse(PrepareInput, body);
    if (!assignment || assignment.id !== input.assignment_id || assignment.human_owner_id !== matter.responsible_identity_id) fail('TEAM_ASSIGNMENT_REQUIRED');
    for (const p of assignment.config.participants) if (!loadPack(p.persona_id, p.pack_id).offline_enabled) fail('TEAM_PACK_NOT_ENABLED');
    const evidence: z.infer<typeof PlanSchema>['evidence'] = []; let bytesCount = 0;
    for (const docId of input.document_ids) {
      const document = documents.find(d => d.id === docId);
      if (!document?.current_version_id) fail('TEAM_DOCUMENT_UNAVAILABLE');
      const version = await core.getDocumentVersion(actor.identity_id, firm, matterId, docId, document.current_version_id);
      const extraction = state.document_extractions.find(e => e.version_id === version.id && e.document_id === docId && inScope(e));
      if (extraction && (extraction.status === 'UNREADABLE' || extraction.units.some(unit => !unit.readable))) fail('TEAM_EXTRACTION_INCOMPLETE');
      if (extraction?.status === 'REVIEW_REQUIRED' && !input.acknowledge_extraction) fail('TEAM_EXTRACTION_REVIEW_REQUIRED');
      if (!extraction && !/^text\/plain(?:;|$)/iu.test(version.mime_type)) fail('TEAM_EXTRACTION_REQUIRED');
      const text = extraction ? extraction.text : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(decodeBase64(version.original_base64));
      bytesCount += new TextEncoder().encode(text).byteLength;
      if (bytesCount > MAX_SELECTED_TEXT_BYTES) fail('TEAM_EVIDENCE_LIMIT');
      if (!text.trim()) fail('TEAM_DOCUMENT_UNAVAILABLE');
      evidence.push({ document_id: docId, version_id: version.id, sha256: extraction ? extraction.text_sha256 : version.sha256, text, title: document.title, nature: document.purpose === 'DRAFT' ? 'PARTY_ALLEGATION' : 'DOCUMENT_TEXT', ...(extraction ? { original_sha256: version.sha256, extraction_status: extraction.status as 'COMPLETE_UNREVIEWED' | 'REVIEW_REQUIRED', extraction_warnings: extraction.warnings } : {}) });
    }
    const prior = state.plans.find(p => p.command_id === input.command_id);
    if (prior) return inScope(prior) && prior.assignment_id === assignment.id && prior.inventory_hash === inventoryHash && await hashValue(prior.evidence) === await hashValue(evidence) ? prior : fail('TEAM_COMMAND_CONFLICT');
    const content = { ...scope, id: crypto.randomUUID(), command_id: input.command_id, assignment_id: assignment.id, assignment_version: assignment.version, human_owner_id: matter.responsible_identity_id, config: assignment.config, evidence, inventory_hash: inventoryHash, max_cost_usd: 0, max_debate_rounds: 1, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 1800000).toISOString() };
    const plan = PlanSchema.parse({ ...content, plan_hash: await hashValue(content) });
    state.plans.push(plan); await event(tx, actor, firm, matterId, 'SPECIALIST_PLAN_PREPARED', plan.id); return plan;
  }
  if (operation === 'run') {
    const input = parse(RunInput, body), plan = state.plans.find(p => p.id === input.plan_id && inScope(p));
    if (!plan || plan.plan_hash !== input.plan_hash) fail('TEAM_PLAN_UNAVAILABLE');
    await verifyTeamPlan(plan);
    const prior = state.runs.find(r => r.plan_id === plan.id);
    // An already completed command returns its immutable historical result, even after expiry.
    if (prior) { await verifyTeamRun(prior); return prior; }
    if (Date.parse(plan.expires_at) <= Date.now()) fail('TEAM_PLAN_EXPIRED');
    if (!current(plan)) fail('TEAM_PLAN_OUTDATED');
    const run = await executeTeam(plan); await verifyTeamRun(run); state.runs.push(run);
    await event(tx, actor, firm, matterId, 'SPECIALIST_RUN_COMPLETED', run.id); return run;
  }
  if (operation === 'draft' || operation === 'recheck') {
    const input = parse(operation === 'draft' ? DraftInput : RecheckInput, body);
    const run = state.runs.find(r => r.id === input.run_id && inScope(r));
    if (!run) fail('TEAM_RUN_UNAVAILABLE');
    await verifyTeamRun(run);
    const prior = state.draft_links.find(l => l.run_id === run.id);
    if (operation === 'draft') {
      const requested = parse(DraftInput, body), text = requested.content ?? run.final_markdown;
      if (prior) { if (requested.content !== undefined && prior.content_hash !== await hashText(text)) fail('TEAM_DRAFT_ALREADY_EXISTS'); return prior; }
      if (!current(run)) fail('TEAM_PLAN_OUTDATED');
      const audit = requested.content === undefined ? run.audit : await auditTeamOutputs(run.outputs.map(o => o.phase === 'INTEGRATION' ? { ...o, author: 'HUMAN', text } : o), text);
      const draft = await core.prepareDraft(actor.identity_id, firm, matterId, requested.content === undefined ? 'Equipo jurídico · integración documental local' : 'Equipo jurídico · documento de trabajo', text);
      const link = { ...scope, run_id: run.id, draft_id: draft.id, document_version_id: draft.document_version_id, content_hash: audit.final_content_hash, audit };
      state.draft_links.push(link); return link;
    }
    const recheck = parse(RecheckInput, body);
    if (!prior) fail('TEAM_RUN_UNAVAILABLE');
    const draft = await core.getDraft(actor.identity_id, firm, matterId, prior.draft_id);
    if (draft.document_version_id !== recheck.expected_version_id) fail('VERSION_CONFLICT');
    const existing = state.draft_links.find(l => l.run_id === run.id && l.document_version_id === draft.document_version_id);
    if (existing) return existing;
    const version = await core.getDocumentVersion(actor.identity_id, firm, matterId, draft.document_id, draft.document_version_id);
    const content = new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64(version.original_base64));
    const outputs = run.outputs.map(o => o.phase === 'INTEGRATION' ? { ...o, author: 'HUMAN', text: content } : o);
    const link = { ...scope, run_id: run.id, draft_id: draft.id, document_version_id: version.id, content_hash: await hashText(content), audit: await auditTeamOutputs(outputs, content) };
    state.draft_links.push(link); await event(tx, actor, firm, matterId, 'SPECIALIST_SOURCES_RECHECKED', draft.id, version.id); return link;
  }
  fail('LOCAL_ROUTE_UNAVAILABLE');
}
export type TeamDocumentInfo = { document_id: string; version_id: string; title: string; original_filename: string; mime_type: string; status: string; ready: boolean; warnings: string[]; text_length: number | null; source: 'DRAFT' | 'EXAMPLE' | 'UPLOADED'; size_bytes: number; incorporated_at: string; removed: boolean; change_id: string | null; duplicate_of: { id: string; title: string } | null; preview: string };
export type TeamView = { assignment: TeamAssignment | null; assignment_version: number; plans: z.infer<typeof PlanSchema>[]; documents?: TeamDocumentInfo[]; runs: Array<TeamRun & { validity: 'CURRENT' | 'OUTDATED'; draft_link: (TeamState['draft_links'][number] & { current_version_id?: string; audit_current: boolean }) | null }> };

type DashboardRecord = { id: string; matter_id: string; matter_title: string; label: string; tab: string; due_at?: string | null };
export type DashboardData = { refreshed_at: string; timezone: 'America/Asuncion'; scope: 'PERSONAL_AUTHORIZED_MATTERS' | 'FIRM_TEAM'; open_requests: number; metrics: Array<{ id: string; label: string; period: string; records: DashboardRecord[] }> };
export async function dashboard(core: OsCoreService, actorId: string, firm: string): Promise<DashboardData> {
  const now = new Date(), today = asuncionDate(now);
  const work = await core.workBoard(actorId, firm);
  const director = work.role === 'ADMINISTRATOR';
  const metrics: DashboardData['metrics'] = [
    { id: 'overdue', label: 'Mis tareas vencidas', period: 'Pendientes · antes de ahora', records: [] },
    { id: 'today', label: 'Mis tareas para hoy', period: 'Pendientes · resto de hoy', records: [] },
    { id: 'reviews', label: 'Mis revisiones pendientes', period: 'Pendientes · todas las fechas', records: [] },
    { id: 'changes', label: 'Mis borradores con cambios', period: 'Cambios solicitados · todas las fechas', records: [] },
  ];
  for (const matter of await core.listMatters(actorId, firm)) {
    const [tasks, reviews, drafts] = await Promise.all([core.listMatterResources(actorId, firm, matter.id, 'tasks'), core.listMatterResources(actorId, firm, matter.id, 'reviews'), core.listMatterResources(actorId, firm, matter.id, 'drafts')]);
    for (const task of tasks as Task[]) if (!task.direction_request && task.kind === 'INTERNAL' && task.status === 'PENDING' && (director || task.responsible_identity_id === actorId) && task.internal_due_at && (!task.deadline || currentDeadline(task)?.confirmed_at)) {
      const target = Date.parse(task.internal_due_at) < now.getTime() ? metrics[0]! : asuncionDate(new Date(task.internal_due_at)) === today ? metrics[1]! : null;
      target?.records.push({ id: task.id, matter_id: matter.id, matter_title: matter.title, label: task.title, tab: 'tasks', due_at: task.internal_due_at });
    }
    for (const review of reviews as DraftReview[]) if (review.status === 'PENDING' && (director || review.reviewer_identity_id === actorId)) metrics[2]!.records.push({ id: review.id, matter_id: matter.id, matter_title: matter.title, label: 'Revisión de borrador', tab: 'reviews' });
    for (const draft of drafts as Draft[]) if (draft.status === 'CHANGES_REQUESTED' && (director || draft.author_identity_id === actorId)) metrics[3]!.records.push({ id: draft.id, matter_id: matter.id, matter_title: matter.title, label: 'Borrador con cambios solicitados', tab: 'drafts' });
  }
  if (director) metrics.forEach(m=>{ m.label=m.label.replace(/^Mis /,'').replace(/^tareas/,'Tareas').replace(/^revisiones/,'Revisiones').replace(/^borradores/,'Borradores'); });
  return { refreshed_at: now.toISOString(), timezone: 'America/Asuncion', scope: director?'FIRM_TEAM':'PERSONAL_AUTHORIZED_MATTERS', open_requests: work.requests.filter(t=>t.direction_request?.status==='OPEN').length, metrics };
}
