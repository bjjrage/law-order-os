import { z } from "zod";
import { Authorization } from "./authorization.js";
import {
  reject,
  type CoreTransaction,
  type AuthenticatedPrincipal,
  type Authenticator,
} from "./contracts.js";
import { OsCoreService } from "./service.js";
import { sha256, encodeBase64 } from "./bytes.js";
import {
  PracticeCommands,
  PracticeRecord as RecordSchema,
  type PracticeState,
  type PracticeRecord,
  type PracticePayload,
  type PracticeOperation,
  lineTotal,
} from "./practice-model.js";

const authz = new Authorization(),
  stamp = () => new Date().toISOString();
const hash = (value: unknown) =>
  sha256(new TextEncoder().encode(JSON.stringify(value)));
const normalized = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const lawOperations = new Set([
  "save_appointment",
  "appointment_status",
  "save_admission",
  "record_entry",
  "use_template",
  "create_session",
  "save_transcript",
  "review_transcript",
  "accept_transcript",
  "combine_transcripts",
  "save_minutes",
]);
export function findRecord(
  state: PracticeState,
  firm: string,
  id: string,
): PracticeRecord {
  const row = state.records.find((r) => r.id === id && r.law_firm_id === firm);
  if (!row) reject("PRACTICE_NOT_FOUND");
  return row;
}
function expected(row: PracticeRecord, revision: unknown) {
  if (row.revision !== revision) reject("VERSION_CONFLICT");
}
export async function authorizePractice(
  tx: CoreTransaction,
  state: PracticeState,
  actor: AuthenticatedPrincipal,
  firm: string,
  op: string,
  body: Record<string, any>,
) {
  const member = await authz.membership(tx, actor, firm, [
    "ADMINISTRATOR",
    "LAWYER",
  ]);
  const director = member.role === "ADMINISTRATOR";
  if (!director && !lawOperations.has(op)) reject("DIRECTOR_REQUIRED");
  const target = Object.hasOwn(body, "record_id")
    ? body.record_id
    : (body.invoice_id ?? body.session_id);
  const row = target ? findRecord(state, firm, target) : undefined;
  if (row && body.matter_id && row.matter_id !== body.matter_id)
    reject("ACCESS_DENIED");
  if (
    row?.payload.type === "APPOINTMENT" &&
    !director &&
    row.payload.responsible_identity_id !== actor.identity_id
  )
    reject("DIRECTOR_REQUIRED");
  if (
    row &&
    Object.hasOwn(body, "expected_revision") &&
    body.expected_revision == null
  )
    reject("VERSION_CONFLICT");
  const session = body.session_id
    ? findRecord(state, firm, body.session_id)
    : undefined;
  if (session && session.payload.type !== "SESSION") reject("INVALID_INPUT");
  if (row && session && row.matter_id !== session.matter_id)
    reject("ACCESS_DENIED");
  const matter = body.matter_id ?? row?.matter_id ?? session?.matter_id;
  if (matter)
    await authz.matter(
      tx,
      actor,
      firm,
      matter,
      [
        "use_template",
        "save_transcript",
        "review_transcript",
        "accept_transcript",
        "combine_transcripts",
        "save_minutes",
      ].includes(op)
        ? "DRAFT_WRITE"
        : op === "create_session"
          ? "READ"
          : "TASK_WRITE",
    );
  if (
    row &&
    !director &&
    row.payload.type === "ADMISSION" &&
    row.payload.status !== "PROPOSED"
  )
    reject("DIRECTOR_REQUIRED");
  return { director, matter_id: matter as string | undefined, row };
}
export function putRecord(
  state: PracticeState,
  actor: string,
  firm: string,
  matter: string | null,
  payload: PracticePayload,
  old?: PracticeRecord,
  newId?: string,
) {
  const at = stamp(),
    next = RecordSchema.parse({
      id: old?.id ?? newId ?? crypto.randomUUID(),
      law_firm_id: firm,
      matter_id: matter,
      revision: (old?.revision ?? 0) + 1,
      created_by: old?.created_by ?? actor,
      created_at: old?.created_at ?? at,
      updated_at: at,
      payload,
    });
  if (old)
    state.records[state.records.findIndex((r) => r.id === old.id)] = next;
  else state.records.push(next);
  state.events.push({
    id: crypto.randomUUID(),
    record_id: next.id,
    law_firm_id: firm,
    matter_id: matter,
    actor,
    at,
    revision: next.revision,
    before: old?.payload ?? null,
    after: next.payload,
  });
  return next;
}
export function invoiceBalance(state: PracticeState, invoice: PracticeRecord) {
  if (invoice.payload.type !== "INVOICE") reject("INVALID_INPUT");
  const linked = state.records.filter(
    (r) =>
      r.law_firm_id === invoice.law_firm_id &&
      "invoice_id" in r.payload &&
      r.payload.invoice_id === invoice.id,
  );
  const credits = linked.reduce(
      (n, r) => n + (r.payload.type === "CREDIT" ? r.payload.amount : 0),
      0,
    ),
    received = linked.reduce(
      (n, r) =>
        n +
        (r.payload.type === "PAYMENT"
          ? r.payload.direction === "RECEIPT"
            ? r.payload.amount
            : -r.payload.amount
          : 0),
      0,
    );
  return {
    total: invoice.payload.status === "VOID" ? 0 : invoice.payload.total,
    credits,
    received,
    balance:
      invoice.payload.status === "VOID"
        ? 0
        : invoice.payload.total - credits - received,
    currency: invoice.payload.currency,
  };
}
async function source(
  tx: CoreTransaction,
  firm: string,
  matter: string | null,
  id: string | null,
) {
  if (!id) return null;
  const v = await tx.get("documentVersions", id);
  if (!v || v.law_firm_id !== firm || v.matter_id !== matter)
    reject("ACCESS_DENIED");
  return v;
}
function accepted(state: PracticeState, firm: string, matter: string) {
  if (
    !state.records.some(
      (r) =>
        r.law_firm_id === firm &&
        r.matter_id === matter &&
        r.payload.type === "ADMISSION" &&
        r.payload.status === "ACCEPTED",
    )
  )
    reject("ADMISSION_ACCEPTANCE_REQUIRED");
}
async function registry(
  tx: CoreTransaction,
  state: PracticeState,
  firm: string,
) {
  const clients = await tx.list("clients", { law_firm_id: firm }),
    contacts = await tx.list("contacts", { law_firm_id: firm });
  const records = clients.map((c) => ({
    reference: c.id,
    label: c.display_name,
    identification: c.identification ?? "",
    matter_id: null as string | null,
  }));
  records.push(
    ...contacts.map((c) => ({
      reference: c.id,
      label: c.display_name,
      identification: "",
      matter_id: null,
    })),
  );
  for (const r of state.records.filter(
    (r) => r.law_firm_id === firm && r.payload.type === "ADMISSION",
  ))
    if (r.payload.type === "ADMISSION")
      for (const p of r.payload.parties)
        records.push({
          reference: r.id,
          label: p.name,
          identification: p.identification,
          matter_id: r.matter_id,
        });
  return records.sort(
    (a, b) =>
      a.reference.localeCompare(b.reference) || a.label.localeCompare(b.label),
  );
}
function approvedTemplate(
  state: PracticeState,
  row: PracticeRecord,
): PracticeRecord | null {
  if (row.payload.type !== "TEMPLATE" || row.payload.status === "RETIRED")
    return null;
  if (row.payload.status === "APPROVED") return row;
  const approval = state.events
    .filter(
      (e) =>
        e.record_id === row.id &&
        e.after.type === "TEMPLATE" &&
        e.after.status === "APPROVED",
    )
    .sort((a, b) => b.revision - a.revision)[0];
  if (
    !approval ||
    state.events.some(
      (e) =>
        e.record_id === row.id &&
        e.revision > approval.revision &&
        e.after.type === "TEMPLATE" &&
        e.after.status === "RETIRED",
    )
  )
    return null;
  return {
    ...row,
    revision: approval.revision,
    updated_at: approval.at,
    payload: approval.after,
  };
}
export async function practiceView(
  tx: CoreTransaction,
  state: PracticeState,
  actor: AuthenticatedPrincipal,
  firm: string,
) {
  const member = await authz.membership(tx, actor, firm, [
      "ADMINISTRATOR",
      "LAWYER",
    ]),
    director = member.role === "ADMINISTRATOR";
  const allowed = new Set<string>();
  for (const m of await tx.list("matters", { law_firm_id: firm })) {
    try {
      await authz.matter(tx, actor, firm, m.id, "READ");
      allowed.add(m.id);
    } catch {}
  }
  const records = state.records
    .map((r) =>
      !director && r.payload.type === "TEMPLATE"
        ? approvedTemplate(state, r)
        : r,
    )
    .filter((r): r is PracticeRecord => r !== null)
    .filter(
      (r) =>
        r.law_firm_id === firm && (!r.matter_id || allowed.has(r.matter_id)),
    )
    .filter(
      (r) =>
        director ||
        (r.payload.type === "APPOINTMENT" &&
          r.payload.responsible_identity_id === actor.identity_id) ||
        (r.payload.type === "TEMPLATE" && r.payload.status === "APPROVED") ||
        [
          "ADMISSION",
          "TEMPLATE_USE",
          "SESSION",
          "RECORDING",
          "TRANSCRIPT",
          "MINUTES",
        ].includes(r.payload.type) ||
        ((r.payload.type === "TIME" || r.payload.type === "EXPENSE") &&
          r.created_by === actor.identity_id),
    );
  const ids = new Set(records.map((r) => r.id));
  const documents = await tx.list("documents", { law_firm_id: firm }),
    drafts = await tx.list("drafts", { law_firm_id: firm });
  const versions = (await tx.list("documentVersions", { law_firm_id: firm }))
    .filter((v) => allowed.has(v.matter_id))
    .map((v) => {
      const draft = drafts.find((d) => d.document_id === v.document_id);
      return {
        id: v.id,
        matter_id: v.matter_id,
        title:
          documents.find((d) => d.id === v.document_id)?.title ??
          v.original_filename,
        created_at: v.incorporated_at,
        publishable:
          !draft ||
          (draft.status === "APPROVED" && draft.document_version_id === v.id),
      };
    });
  const clients = await tx.list("clients", { law_firm_id: firm }),
    matters = await tx.list("matters", { law_firm_id: firm });
  const template_values = Object.fromEntries(
    matters
      .filter((m) => allowed.has(m.id))
      .map((m) => {
        const client = clients.find((c) => c.id === m.client_id);
        return [
          m.id,
          {
            "cliente.nombre": client?.display_name ?? "",
            "cliente.identificacion": client?.identification ?? "",
            "asunto.titulo": m.title,
            "asunto.area": m.subject_area,
          },
        ];
      }),
  );
  return {
    role: member.role,
    approved_templates: state.records
      .filter((r) => r.law_firm_id === firm && r.payload.type === "TEMPLATE")
      .map((r) => approvedTemplate(state, r))
      .filter((r): r is PracticeRecord => r !== null),
    records,
    versions,
    template_values,
    events: director ? state.events.filter((e) => ids.has(e.record_id)) : [],
    balances: director
      ? records
          .filter((r) => r.payload.type === "INVOICE")
          .map((r) => ({ id: r.id, ...invoiceBalance(state, r) }))
      : [],
    retention_days:
      state.settings.find((s) => s.law_firm_id === firm)?.retention_days ??
      null,
  };
}
export async function executePractice(
  tx: CoreTransaction,
  state: PracticeState,
  core: OsCoreService,
  identities: Authenticator,
  actor: AuthenticatedPrincipal,
  firm: string,
  operation: string,
  raw: unknown,
): Promise<any> {
  if (!Object.hasOwn(PracticeCommands, operation))
    reject("PRACTICE_OPERATION_UNKNOWN");
  const op = operation as PracticeOperation,
    parsed = PracticeCommands[op].safeParse(raw);
  if (!parsed.success) reject("INVALID_INPUT");
  const b = parsed.data as Record<string, any>;
  const { row, matter_id, director } = await authorizePractice(
      tx,
      state,
      actor,
      firm,
      op,
      b,
    ),
    who = actor.identity_id;
  if (row && b.expected_revision !== undefined)
    expected(row, b.expected_revision);
  const save = (
    payload: PracticePayload,
    old: PracticeRecord | null = row ?? null,
    matter = matter_id ?? null,
  ) => putRecord(state, who, firm, matter, payload, old ?? undefined);
  if (op === "save_appointment") {
    if (
      row &&
      (row.payload.type !== "APPOINTMENT" ||
        row.payload.status !== "SCHEDULED" ||
        row.matter_id !== b.matter_id)
    )
      reject("APPOINTMENT_LOCKED");
    if (b.ends_at <= b.starts_at) reject("INVALID_APPOINTMENT_TIME");
    const client = b.client_id ? await tx.get("clients", b.client_id) : null;
    if (b.client_id && (!client || client.law_firm_id !== firm))
      reject("ACCESS_DENIED");
    if (b.matter_id) {
      const m = await tx.get("matters", b.matter_id);
      if (!m || m.client_id !== b.client_id) reject("CLIENT_MATTER_MISMATCH");
    }
    await authz.assignment(tx, actor, firm, b.responsible_identity_id);
    const member = (await tx.list("memberships", { law_firm_id: firm })).find(
      (m) => m.active && m.identity_id === b.responsible_identity_id,
    );
    if (
      !member ||
      !(await identities.identity(b.responsible_identity_id))?.active
    )
      reject("INACTIVE_ASSIGNEE");
    if (b.matter_id)
      await authz.participant(
        tx,
        b.responsible_identity_id,
        firm,
        b.matter_id,
        "READ",
      );
    if (
      state.records.some(
        (r) =>
          r.id !== row?.id &&
          r.law_firm_id === firm &&
          r.payload.type === "APPOINTMENT" &&
          r.payload.status === "SCHEDULED" &&
          r.payload.responsible_identity_id === b.responsible_identity_id &&
          r.payload.starts_at < b.ends_at &&
          r.payload.ends_at > b.starts_at,
      )
    )
      reject("APPOINTMENT_OVERLAP");
    return save({
      type: "APPOINTMENT",
      title: b.title,
      client_id: b.client_id,
      responsible_identity_id: b.responsible_identity_id,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      location: b.location,
      notes: b.notes,
      status: "SCHEDULED",
    });
  }
  if (op === "appointment_status") {
    if (
      row?.payload.type !== "APPOINTMENT" ||
      row.payload.status !== "SCHEDULED"
    )
      reject("APPOINTMENT_LOCKED");
    return save({ ...row.payload, status: b.status });
  }
  if (op === "create_payable") {
    if (b.due_on < b.issued_on) reject("INVALID_INPUT");
    if (
      state.records.some(
        (r) =>
          r.law_firm_id === firm &&
          r.payload.type === "PAYABLE" &&
          r.payload.status !== "VOID" &&
          normalized(r.payload.supplier) === normalized(b.supplier) &&
          normalized(r.payload.reference) === normalized(b.reference),
      )
    )
      reject("DUPLICATE_PAYABLE");
    return save(
      {
        type: "PAYABLE",
        supplier: b.supplier,
        reference: b.reference,
        description: b.description,
        currency: b.currency,
        total: b.total,
        issued_on: b.issued_on,
        due_on: b.due_on,
        status: "OPEN",
      },
      null,
    );
  }
  if (op === "pay_payable" || op === "void_payable") {
    if (row?.payload.type !== "PAYABLE" || row.payload.status !== "OPEN")
      reject("PAYABLE_LOCKED");
    const payments = state.records.filter(
      (r) =>
        r.law_firm_id === firm &&
        r.payload.type === "DISBURSEMENT" &&
        r.payload.payable_id === row.id,
    );
    const paid = payments.reduce(
      (n, r) => n + (r.payload.type === "DISBURSEMENT" ? r.payload.amount : 0),
      0,
    );
    if (op === "void_payable") {
      if (paid) reject("INVOICE_HAS_MOVEMENTS");
      return save({ ...row.payload, status: "VOID" });
    }
    if (b.amount > row.payload.total - paid) reject("PAYMENT_EXCEEDS_BALANCE");
    if (
      payments.some(
        (r) =>
          r.payload.type === "DISBURSEMENT" &&
          r.payload.reference === b.reference,
      )
    )
      reject("DUPLICATE_PAYMENT_REFERENCE");
    return save(
      {
        type: "DISBURSEMENT",
        payable_id: row.id,
        amount: b.amount,
        date: b.date,
        reference: b.reference,
        method: b.method,
      },
      null,
    );
  }
  if (op === "save_admission") {
    if (
      !row &&
      state.records.some(
        (r) =>
          r.law_firm_id === firm &&
          r.matter_id === matter_id &&
          r.payload.type === "ADMISSION",
      )
    )
      reject("ADMISSION_ALREADY_EXISTS");
    if (row?.payload.type !== undefined && row.payload.type !== "ADMISSION")
      reject("INVALID_INPUT");
    return save({
      type: "ADMISSION",
      scope: b.scope,
      exclusions: b.exclusions,
      jurisdiction: b.jurisdiction,
      parties: b.parties,
      status: "PROPOSED",
      conflict_check: null,
      decision_note: "",
      decided_by: null,
      decided_at: null,
    });
  }
  if (op === "check_conflicts" || op === "decide_admission") {
    if (row?.payload.type !== "ADMISSION") reject("INVALID_INPUT");
    const p = row.payload,
      all = await registry(tx, state, firm);
    if (op === "check_conflicts") {
      const matches = [];
      for (const party of p.parties)
        for (const candidate of all) {
          if (candidate.reference === row.id) continue;
          const exactId =
            party.identification &&
            candidate.identification &&
            normalized(party.identification) ===
              normalized(candidate.identification);
          const a = normalized(party.name),
            c = normalized(candidate.label);
          if (
            exactId ||
            (a.length >= 4 && c.length >= 4 && (a.includes(c) || c.includes(a)))
          )
            matches.push({
              reference: candidate.reference,
              label: candidate.label,
              reason: exactId
                ? "Identificación coincidente"
                : "Nombre semejante; requiere revisión humana",
            });
        }
      return save({
        ...p,
        conflict_check: {
          at: stamp(),
          registry_hash: await hash(all),
          matches,
        },
      });
    }
    if (
      !p.conflict_check ||
      p.conflict_check.registry_hash !== (await hash(all))
    )
      reject("CONFLICT_CHECK_REQUIRED");
    return save({
      ...p,
      status: b.decision,
      decision_note: b.note,
      decided_by: who,
      decided_at: stamp(),
    });
  }
  if (op === "save_budget") {
    accepted(state, firm, matter_id!);
    if (
      row &&
      (row.payload.type !== "BUDGET" || row.payload.status !== "DRAFT")
    )
      reject("BUDGET_LOCKED");
    lineTotal(b.lines);
    return save({
      type: "BUDGET",
      title: b.title,
      currency: b.currency,
      lines: b.lines,
      terms: b.terms,
      status: "DRAFT",
      approved_by: null,
      approved_at: null,
      client_acceptance: null,
    });
  }
  if (["approve_budget", "accept_budget", "cancel_budget"].includes(op)) {
    if (row?.payload.type !== "BUDGET") reject("INVALID_INPUT");
    const p = row.payload;
    if (op === "approve_budget") {
      if (p.status !== "DRAFT") reject("BUDGET_LOCKED");
      accepted(state, firm, matter_id!);
      return save({
        ...p,
        status: "APPROVED",
        approved_by: who,
        approved_at: stamp(),
      });
    }
    if (op === "accept_budget") {
      if (p.status !== "APPROVED") reject("BUDGET_APPROVAL_REQUIRED");
      return save({
        ...p,
        status: "ACCEPTED",
        client_acceptance: { at: b.at, reference: b.reference },
      });
    }
    return save({
      ...p,
      status: "CANCELLED",
      terms: p.terms + "\nCancelación: " + b.reason,
    });
  }
  if (op === "record_entry") {
    if (
      (b.type === "TIME" && (b.minutes < 1 || b.amount !== 0)) ||
      (b.type === "EXPENSE" && (b.amount < 1 || b.minutes !== 0))
    )
      reject("INVALID_INPUT");
    await source(tx, firm, matter_id!, b.proof_version_id);
    return save(
      {
        type: b.type,
        description: b.description,
        date: b.date,
        minutes: b.minutes,
        amount: b.amount,
        currency: b.currency,
        billable: b.billable,
        proof_version_id: b.proof_version_id,
        status: "SUBMITTED",
        decision_note: "",
        decided_by: null,
      },
      null,
    );
  }
  if (op === "decide_entry") {
    if (
      !row ||
      !["TIME", "EXPENSE"].includes(row.payload.type) ||
      !("status" in row.payload) ||
      row.payload.status !== "SUBMITTED"
    )
      reject("ENTRY_LOCKED");
    return save({
      ...row.payload,
      status: b.decision,
      decision_note: b.note,
      decided_by: who,
    } as PracticePayload);
  }
  if (op === "issue_invoice") {
    accepted(state, firm, matter_id!);
    if (b.due_on < b.issued_on) reject("INVALID_INPUT");
    if (b.budget_id) {
      const budget = findRecord(state, firm, b.budget_id);
      expected(budget, b.budget_revision);
      if (
        budget.matter_id !== matter_id ||
        budget.payload.type !== "BUDGET" ||
        budget.payload.status !== "ACCEPTED" ||
        budget.payload.currency !== b.currency
      )
        reject("BUDGET_ACCEPTANCE_REQUIRED");
    }
    const ids = new Set<string>();
    for (const id of b.entry_ids) {
      if (ids.has(id)) reject("ENTRY_ALREADY_BILLED");
      ids.add(id);
      const e = findRecord(state, firm, id);
      if (
        e.matter_id !== matter_id ||
        !["TIME", "EXPENSE"].includes(e.payload.type) ||
        !("status" in e.payload) ||
        e.payload.status !== "APPROVED" ||
        !("billable" in e.payload) ||
        !e.payload.billable ||
        e.payload.currency !== b.currency
      )
        reject("ENTRY_APPROVAL_REQUIRED");
      if (
        state.records.some(
          (r) =>
            r.payload.type === "INVOICE" &&
            r.payload.status === "ISSUED" &&
            r.payload.entry_ids.includes(id),
        )
      )
        reject("ENTRY_ALREADY_BILLED");
    }
    if (b.fiscal_reference)
      await source(
        tx,
        firm,
        matter_id!,
        b.fiscal_reference.document_version_id,
      );
    const count =
        state.records.filter(
          (r) => r.law_firm_id === firm && r.payload.type === "INVOICE",
        ).length + 1,
      total = lineTotal(b.lines);
    if (total < 1) reject("INVALID_INPUT");
    return save(
      {
        type: "INVOICE",
        number: `CI-${b.issued_on.slice(0, 4)}-${String(count).padStart(6, "0")}`,
        currency: b.currency,
        lines: b.lines,
        total,
        issued_on: b.issued_on,
        due_on: b.due_on,
        budget_id: b.budget_id,
        budget_revision: b.budget_revision,
        entry_ids: b.entry_ids,
        status: "ISSUED",
        void_reason: "",
        fiscal_reference: b.fiscal_reference,
      },
      null,
    );
  }
  if (op === "void_invoice") {
    if (row?.payload.type !== "INVOICE" || row.payload.status !== "ISSUED")
      reject("INVOICE_LOCKED");
    const balance = invoiceBalance(state, row);
    if (balance.received !== 0 || balance.credits !== 0)
      reject("INVOICE_HAS_MOVEMENTS");
    return save({ ...row.payload, status: "VOID", void_reason: b.reason });
  }
  if (op === "credit_invoice" || op === "record_payment") {
    if (row?.payload.type !== "INVOICE" || row.payload.status !== "ISSUED")
      reject("INVOICE_LOCKED");
    const balance = invoiceBalance(state, row);
    if (op === "credit_invoice") {
      if (b.amount > balance.total - balance.credits)
        reject("CREDIT_EXCEEDS_INVOICE");
      return save(
        {
          type: "CREDIT",
          invoice_id: row.id,
          amount: b.amount,
          reason: b.reason,
          date: b.date,
        },
        null,
      );
    }
    if (
      (b.direction === "RECEIPT" && b.amount > balance.balance) ||
      (b.direction === "REFUND" && b.amount > Math.max(0, -balance.balance))
    )
      reject("PAYMENT_EXCEEDS_BALANCE");
    if (
      state.records.some(
        (r) =>
          r.law_firm_id === firm &&
          r.payload.type === "PAYMENT" &&
          r.payload.invoice_id === row.id &&
          r.payload.reference === b.reference,
      )
    )
      reject("DUPLICATE_PAYMENT_REFERENCE");
    await source(tx, firm, matter_id!, b.proof_version_id);
    return save(
      {
        type: "PAYMENT",
        invoice_id: row.id,
        amount: b.amount,
        direction: b.direction,
        reference: b.reference,
        method: b.method,
        date: b.date,
        proof_version_id: b.proof_version_id,
      },
      null,
    );
  }
  if (op === "save_template") {
    if (row && row.payload.type !== "TEMPLATE") reject("INVALID_INPUT");
    return save(
      {
        type: "TEMPLATE",
        title: b.title,
        document_type: b.document_type,
        jurisdiction: b.jurisdiction,
        body: b.body,
        status: "DRAFT",
        approved_by: null,
        approved_at: null,
      },
      row,
      null,
    );
  }
  if (op === "approve_template" || op === "retire_template") {
    if (row?.payload.type !== "TEMPLATE") reject("INVALID_INPUT");
    return save(
      {
        ...row.payload,
        status: op === "approve_template" ? "APPROVED" : "RETIRED",
        approved_by: op === "approve_template" ? who : row.payload.approved_by,
        approved_at:
          op === "approve_template" ? stamp() : row.payload.approved_at,
      },
      row,
      null,
    );
  }
  if (op === "use_template") {
    const template = approvedTemplate(
      state,
      findRecord(state, firm, b.template_id),
    );
    if (
      !template ||
      template.payload.type !== "TEMPLATE" ||
      template.payload.status !== "APPROVED"
    )
      reject("TEMPLATE_APPROVAL_REQUIRED");
    expected(template, b.expected_revision);
    const matter = await tx.get("matters", matter_id!),
      client = await tx.get("clients", matter!.client_id);
    const values: Record<string, string> = {
      ...b.values,
      "cliente.nombre": client!.display_name,
      "cliente.identificacion":
        client!.identification ?? b.values["cliente.identificacion"] ?? "",
      "asunto.titulo": matter!.title,
      "asunto.area": matter!.subject_area,
    };
    const fields = [
      ...template.payload.body.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g),
    ].map((m) => m[1]!);
    if (fields.some((key) => !values[key]?.trim()))
      reject("TEMPLATE_FIELDS_REQUIRED");
    const content = template.payload.body.replace(
      /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
      (_m, key) => values[key]!,
    );
    const draft = await core.prepareDraft(
      who,
      firm,
      matter_id!,
      b.title,
      content,
    );
    const use = save(
      {
        type: "TEMPLATE_USE",
        template_id: template.id,
        template_revision: template.revision,
        draft_id: draft.id,
        document_version_id: draft.document_version_id,
        values,
      },
      null,
    );
    return { use, draft };
  }
  if (op === "publish_delivery" || op === "send_message") {
    const version = await source(
      tx,
      firm,
      matter_id!,
      b.document_version_id ?? null,
    );
    if (version) {
      const draft = (
        await tx.list("drafts", { law_firm_id: firm, matter_id: matter_id! })
      ).find((d) => d.document_id === version.document_id);
      if (
        draft &&
        (draft.status !== "APPROVED" ||
          draft.document_version_id !== version.id)
      )
        reject("APPROVED_VERSION_REQUIRED");
    }
    if (!version && !String(b.message ?? b.text ?? "").trim())
      reject("PUBLICATION_EMPTY");
    return save(
      {
        type: "PUBLICATION",
        title: b.title ?? "Comunicación del estudio",
        message: b.message ?? b.text,
        document_version_id: version?.id ?? null,
        status: "PUBLISHED",
      },
      null,
    );
  }
  if (op === "withdraw_publication") {
    if (row?.payload.type !== "PUBLICATION") reject("INVALID_INPUT");
    return save({ ...row.payload, status: "WITHDRAWN" });
  }
  if (op === "grant_portal") {
    if (
      Date.parse(b.expires_at) <= Date.now() ||
      Date.parse(b.expires_at) > Date.now() + 366 * 86400000
    )
      reject("INVALID_EXPIRATION");
    const matter = await tx.get("matters", matter_id!);
    const token = encodeBase64(
      crypto.getRandomValues(new Uint8Array(32)),
    ).replace(/[+/=]/g, (c) => (c === "+" ? "-" : c === "/" ? "_" : ""));
    const grant = save(
      {
        type: "PORTAL_GRANT",
        client_id: matter!.client_id,
        recipient: b.recipient,
        token_hash: await hash(token),
        expires_at: b.expires_at,
        allow_messages: b.allow_messages,
        revoked_at: null,
      },
      null,
    );
    return { grant, token };
  }
  if (op === "revoke_portal") {
    if (row?.payload.type !== "PORTAL_GRANT") reject("INVALID_INPUT");
    return save({ ...row.payload, revoked_at: stamp() });
  }
  if (op === "session_retention") {
    const s = state.settings.find((s) => s.law_firm_id === firm);
    if (s) s.retention_days = b.days;
    else state.settings.push({ law_firm_id: firm, retention_days: b.days });
    return { retention_days: b.days };
  }
  if (op === "create_session")
    return save(
      {
        type: "SESSION",
        title: b.title,
        room_id: b.room_id,
        status: "OPEN",
        recording_status: "NONE",
        recorder_id: null,
        capture_id: null,
        participants: [],
        started_at: null,
        stopped_at: null,
        retention_days:
          state.settings.find((s) => s.law_firm_id === firm)?.retention_days ??
          null,
      },
      null,
    );
  if (op === "save_transcript") {
    if (row?.payload.type !== "SESSION") reject("INVALID_INPUT");
    return save(
      {
        type: "TRANSCRIPT",
        session_id: row.id,
        text: b.text,
        origin: "HUMAN",
        recording_ids: [],
        model: null,
        cost_usd: 0,
        status: "REVIEWED",
      },
      null,
    );
  }
  if (op === "review_transcript") {
    if (row?.payload.type !== "TRANSCRIPT") reject("INVALID_INPUT");
    return save({ ...row.payload, text: b.text, status: "REVIEWED" });
  }
  if (op === "accept_transcript") {
    if (row?.payload.type !== "TRANSCRIPT") reject("INVALID_INPUT");
    return save({ ...row.payload, status: "REVIEWED" });
  }
  if (op === "combine_transcripts") {
    if (row?.payload.type !== "SESSION") reject("INVALID_INPUT");
    const recordings = state.records
      .filter(
        (r) =>
          r.payload.type === "RECORDING" &&
          r.payload.session_id === row.id &&
          !r.payload.withdrawn_at,
      )
      .sort((a, b) =>
        a.payload.type === "RECORDING" && b.payload.type === "RECORDING"
          ? a.payload.sequence - b.payload.sequence
          : 0,
      );
    const transcripts = state.records
      .filter(
        (r) =>
          r.payload.type === "TRANSCRIPT" &&
          r.payload.session_id === row.id &&
          r.payload.status === "REVIEWED",
      )
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const selected = recordings.map((recording) =>
      transcripts.find(
        (t) =>
          t.payload.type === "TRANSCRIPT" &&
          t.payload.recording_ids.length === 1 &&
          t.payload.recording_ids[0] === recording.id,
      ),
    );
    if (selected.some((r) => !r)) reject("SESSION_TRANSCRIPT_REVIEW_REQUIRED");
    const manual = transcripts.filter(
      (t) => t.payload.type === "TRANSCRIPT" && !t.payload.recording_ids.length,
    );
    const all = [...selected, ...manual.reverse()].filter(
      (r): r is PracticeRecord => !!r,
    );
    if (!all.length) reject("SESSION_TRANSCRIPT_REQUIRED");
    const text = all
      .map(
        (t, i) =>
          `[Tramo ${i + 1}]\n${t.payload.type === "TRANSCRIPT" ? t.payload.text : ""}`,
      )
      .join("\n\n");
    return save(
      {
        type: "TRANSCRIPT",
        session_id: row.id,
        text,
        origin: "HUMAN",
        recording_ids: recordings.map((r) => r.id),
        model: null,
        cost_usd: 0,
        status: "REVIEWED",
      },
      null,
    );
  }
  if (op === "save_minutes") {
    if (row?.payload.type === "MINUTES" && row.payload.status === "APPROVED")
      reject("MINUTES_LOCKED");
    const session = findRecord(state, firm, b.session_id),
      transcript = findRecord(state, firm, b.transcript_id);
    if (
      session.payload.type !== "SESSION" ||
      transcript.payload.type !== "TRANSCRIPT" ||
      transcript.payload.session_id !== session.id ||
      transcript.matter_id !== matter_id
    )
      reject("ACCESS_DENIED");
    if (row && row.payload.type !== "MINUTES") reject("INVALID_INPUT");
    return save(
      {
        type: "MINUTES",
        session_id: session.id,
        transcript_id: transcript.id,
        transcript_revision: transcript.revision,
        summary: b.summary,
        agreements: b.agreements,
        disagreements: b.disagreements,
        actions: b.actions.map((a: any) => ({
          ...a,
          id: crypto.randomUUID(),
          task_id: null,
        })),
        status: "PROPOSED",
        reviewed_by: null,
        reviewed_at: null,
        model: null,
        cost_usd: 0,
      },
      row,
    );
  }
  if (op === "approve_minutes") {
    if (row?.payload.type !== "MINUTES" || row.payload.status !== "PROPOSED")
      reject("MINUTES_LOCKED");
    const transcript = findRecord(state, firm, row.payload.transcript_id);
    if (
      row.payload.transcript_revision !== undefined &&
      transcript.revision !== row.payload.transcript_revision
    )
      reject("SESSION_TRANSCRIPT_CHANGED");
    return save({
      ...row.payload,
      status: "APPROVED",
      reviewed_by: who,
      reviewed_at: stamp(),
    });
  }
  if (op === "assign_minute_action") {
    if (row?.payload.type !== "MINUTES" || row.payload.status !== "APPROVED")
      reject("MINUTES_APPROVAL_REQUIRED");
    const action = row.payload.actions.find((a) => a.id === b.action_id);
    if (!action || action.task_id) reject("ACTION_ALREADY_ASSIGNED");
    const task = await core.createTask(who, firm, matter_id!, {
      title: action.description.slice(0, 240),
      responsible_identity_id: b.responsible_identity_id,
      internal_due_at: b.internal_due_at,
    });
    return {
      minutes: save({
        ...row.payload,
        actions: row.payload.actions.map((a) =>
          a.id === action.id
            ? {
                ...a,
                task_id: task.id,
                responsible_identity_id: b.responsible_identity_id,
                due_at: b.internal_due_at,
              }
            : a,
        ),
      }),
      task,
    };
  }
  reject("PRACTICE_OPERATION_UNKNOWN");
}

export async function executePortal(
  tx: CoreTransaction,
  state: PracticeState,
  token: string,
  input: unknown,
) {
  const body = z
    .discriminatedUnion("action", [
      z.object({ action: z.literal("VIEW") }).strict(),
      z
        .object({ action: z.literal("DOWNLOAD"), publication_id: z.string() })
        .strict(),
      z
        .object({
          action: z.literal("MESSAGE"),
          message_id: z.uuid(),
          text: z.string().trim().min(1).max(12000),
        })
        .strict(),
    ])
    .parse(input);
  if (!/^[a-zA-Z0-9_-]{40,80}$/.test(token)) reject("PORTAL_ACCESS_DENIED");
  const tokenHash = await hash(token);
  const grant = state.records.find(
    (r) =>
      r.payload.type === "PORTAL_GRANT" && r.payload.token_hash === tokenHash,
  );
  if (
    !grant ||
    grant.payload.type !== "PORTAL_GRANT" ||
    grant.payload.revoked_at ||
    Date.parse(grant.payload.expires_at) <= Date.now()
  )
    reject("PORTAL_ACCESS_DENIED");
  const scope = (r: PracticeRecord) =>
    r.law_firm_id === grant.law_firm_id && r.matter_id === grant.matter_id;
  const publications = state.records.filter(
    (r) =>
      scope(r) &&
      r.payload.type === "PUBLICATION" &&
      r.payload.status === "PUBLISHED",
  );
  if (body.action === "MESSAGE") {
    if (!grant.payload.allow_messages) reject("PORTAL_MESSAGES_DISABLED");
    const existing = state.records.find(
      (r) =>
        r.payload.type === "PORTAL_MESSAGE" &&
        r.payload.grant_id === grant.id &&
        r.payload.message_id === body.message_id,
    );
    if (existing) {
      if (
        existing.payload.type !== "PORTAL_MESSAGE" ||
        existing.payload.text !== body.text
      )
        reject("COMMAND_CONFLICT");
      return { id: existing.id };
    }
    const msg = putRecord(
      state,
      "external:" + grant.id,
      grant.law_firm_id,
      grant.matter_id,
      {
        type: "PORTAL_MESSAGE",
        grant_id: grant.id,
        message_id: body.message_id,
        author_name: grant.payload.recipient,
        text: body.text,
        direction: "INBOUND",
        publication_id: null,
      },
    );
    return { id: msg.id };
  }
  if (body.action === "DOWNLOAD") {
    const publication = publications.find((r) => r.id === body.publication_id);
    if (
      !publication ||
      publication.payload.type !== "PUBLICATION" ||
      !publication.payload.document_version_id
    )
      reject("PORTAL_ACCESS_DENIED");
    const v = await source(
      tx,
      grant.law_firm_id,
      grant.matter_id,
      publication.payload.document_version_id,
    );
    return {
      title: publication.payload.title,
      mime: v!.mime_type,
      base64: v!.original_base64,
      sha256: v!.sha256,
    };
  }
  const matter = await tx.get("matters", grant.matter_id!),
    firm = await tx.get("lawFirms", grant.law_firm_id);
  return {
    firm: firm?.name,
    matter: matter?.title,
    recipient: grant.payload.recipient,
    allow_messages: grant.payload.allow_messages,
    expires_at: grant.payload.expires_at,
    publications: publications.map((r) => ({
      id: r.id,
      title: r.payload.type === "PUBLICATION" ? r.payload.title : "",
      message: r.payload.type === "PUBLICATION" ? r.payload.message : "",
      has_document:
        r.payload.type === "PUBLICATION" && !!r.payload.document_version_id,
      published_at: r.created_at,
    })),
    messages: state.records
      .filter(
        (r) =>
          scope(r) &&
          r.payload.type === "PORTAL_MESSAGE" &&
          r.payload.grant_id === grant.id,
      )
      .map((r) => ({
        id: r.id,
        text: r.payload.type === "PORTAL_MESSAGE" ? r.payload.text : "",
        at: r.created_at,
      })),
  };
}
