import { z } from "zod";
const id = z.string().min(1).max(128),
  text = z.string().trim().min(1),
  date = z.iso.date(),
  stamp = z.iso.datetime();
export const Money = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const Currency = z.enum(["PYG", "USD", "EUR", "ARS", "BRL"]);
export const Line = z
  .object({
    description: text.max(500),
    quantity: z.number().int().positive().max(1000000),
    unit_amount: Money,
    tax_bps: z.number().int().min(0).max(10000),
  })
  .strict();
export const Party = z
  .object({
    name: text.max(240),
    identification: z.string().max(100),
    side: z.enum(["CLIENT", "COUNTERPARTY", "RELATED"]),
  })
  .strict();
export const Action = z
  .object({
    id,
    description: text.max(1000),
    responsible_identity_id: id.nullable(),
    due_at: stamp.nullable(),
    task_id: id.nullable(),
  })
  .strict();
export const Payload = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("APPOINTMENT"),
      title: text.max(240),
      client_id: id.nullable(),
      responsible_identity_id: id,
      starts_at: stamp,
      ends_at: stamp,
      location: z.string().max(1000),
      notes: z.string().max(4000),
      status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("PAYABLE"),
      supplier: text.max(240),
      reference: text.max(240),
      description: text.max(2000),
      currency: Currency,
      total: Money.positive(),
      issued_on: date,
      due_on: date,
      status: z.enum(["OPEN", "VOID"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("DISBURSEMENT"),
      payable_id: id,
      amount: Money.positive(),
      date,
      reference: text.max(240),
      method: z.enum(["CASH", "BANK", "CARD", "OTHER"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("ADMISSION"),
      scope: text.max(12000),
      exclusions: z.string().max(6000),
      jurisdiction: text.max(200),
      parties: z.array(Party).min(1).max(100),
      status: z.enum(["PROPOSED", "ACCEPTED", "DECLINED"]),
      conflict_check: z
        .object({
          at: stamp,
          registry_hash: z.string(),
          matches: z.array(
            z.object({ reference: id, label: z.string(), reason: z.string() }),
          ),
        })
        .nullable(),
      decision_note: z.string().max(6000),
      decided_by: id.nullable(),
      decided_at: stamp.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("BUDGET"),
      title: text.max(240),
      currency: Currency,
      lines: z.array(Line).min(1).max(100),
      terms: text.max(6000),
      status: z.enum(["DRAFT", "APPROVED", "ACCEPTED", "CANCELLED"]),
      approved_by: id.nullable(),
      approved_at: stamp.nullable(),
      client_acceptance: z
        .object({ at: date, reference: text.max(500) })
        .nullable(),
    })
    .strict(),
  z
    .object({
      type: z.enum(["TIME", "EXPENSE"]),
      description: text.max(4000),
      date,
      minutes: z.number().int().min(0).max(1440),
      amount: Money,
      currency: Currency,
      billable: z.boolean(),
      proof_version_id: id.nullable(),
      status: z.enum(["SUBMITTED", "APPROVED", "REJECTED"]),
      decision_note: z.string().max(4000),
      decided_by: id.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("INVOICE"),
      number: text.max(80),
      currency: Currency,
      lines: z.array(Line).min(1).max(100),
      total: Money,
      issued_on: date,
      due_on: date,
      budget_id: id.nullable(),
      budget_revision: z.number().int().positive().nullable(),
      entry_ids: z.array(id),
      status: z.enum(["ISSUED", "VOID"]),
      void_reason: z.string(),
      fiscal_reference: z
        .object({
          number: text.max(100),
          authorization: text.max(100),
          issuer_tax_id: text.max(100),
          document_version_id: id,
        })
        .nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("CREDIT"),
      invoice_id: id,
      amount: Money,
      reason: text.max(2000),
      date,
    })
    .strict(),
  z
    .object({
      type: z.literal("PAYMENT"),
      invoice_id: id,
      amount: Money,
      direction: z.enum(["RECEIPT", "REFUND"]),
      reference: text.max(240),
      method: z.enum(["CASH", "BANK", "CARD", "OTHER"]),
      date,
      proof_version_id: id.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("TEMPLATE"),
      title: text.max(240),
      document_type: text.max(120),
      jurisdiction: text.max(200),
      body: text.max(200000),
      status: z.enum(["DRAFT", "APPROVED", "RETIRED"]),
      approved_by: id.nullable(),
      approved_at: stamp.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("TEMPLATE_USE"),
      template_id: id,
      template_revision: z.number().int().positive(),
      draft_id: id,
      document_version_id: id,
      values: z.record(z.string(), z.string()),
    })
    .strict(),
  z
    .object({
      type: z.literal("PUBLICATION"),
      title: text.max(240),
      message: z.string().max(10000),
      document_version_id: id.nullable(),
      status: z.enum(["PUBLISHED", "WITHDRAWN"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("PORTAL_GRANT"),
      client_id: id,
      recipient: text.max(240),
      token_hash: z.string().regex(/^[a-f0-9]{64}$/),
      expires_at: stamp,
      allow_messages: z.boolean(),
      revoked_at: stamp.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("PORTAL_MESSAGE"),
      grant_id: id.nullable(),
      message_id: id,
      author_name: text.max(240),
      text: text.max(12000),
      direction: z.enum(["INBOUND", "OUTBOUND"]),
      publication_id: id.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("SESSION"),
      title: text.max(240),
      room_id: id.nullable(),
      status: z.enum(["OPEN", "CLOSED"]),
      recording_status: z.enum([
        "NONE",
        "CONSENTING",
        "RECORDING",
        "STOPPED",
        "FINALIZED",
      ]),
      recorder_id: id.nullable(),
      capture_id: id.nullable(),
      participants: z.array(
        z.object({
          identity_id: id,
          name: text,
          consent: z.enum(["PENDING", "ACCEPTED", "DECLINED"]),
          consented_at: stamp.nullable(),
        }),
      ),
      started_at: stamp.nullable(),
      stopped_at: stamp.nullable(),
      retention_days: z.number().int().min(1).max(3650).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("RECORDING"),
      session_id: id,
      capture_id: id,
      sequence: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      bytes: z.number().int().positive(),
      mime: z.enum(["audio/webm", "audio/ogg", "audio/wav"]),
      object_key: z
        .string()
        .regex(
          /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/\d+-[a-f0-9]{64}\.audio$/,
        ),
      withdrawn_at: stamp.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("TRANSCRIPT"),
      session_id: id,
      text: text.max(500000),
      origin: z.enum(["HUMAN", "AI"]),
      recording_ids: z.array(id),
      model: z.string().nullable(),
      cost_usd: z.number().nonnegative(),
      status: z.enum(["PROPOSED", "REVIEWED"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("MINUTES"),
      session_id: id,
      transcript_id: id,
      transcript_revision: z.number().int().positive().optional(),
      summary: text.max(30000),
      agreements: z.array(z.string().max(4000)),
      disagreements: z.array(z.string().max(4000)),
      actions: z.array(Action).max(100),
      status: z.enum(["PROPOSED", "APPROVED"]),
      reviewed_by: id.nullable(),
      reviewed_at: stamp.nullable(),
      model: z.string().nullable(),
      cost_usd: z.number().nonnegative(),
    })
    .strict(),
]);
export const PracticeRecord = z
  .object({
    id,
    law_firm_id: id,
    matter_id: id.nullable(),
    revision: z.number().int().positive(),
    created_by: id,
    created_at: stamp,
    updated_at: stamp,
    payload: Payload,
  })
  .strict();
export type PracticeRecord = z.infer<typeof PracticeRecord>;
export type PracticePayload = z.infer<typeof Payload>;
export const PracticeStateSchema = z
  .object({
    version: z.literal(1),
    records: z.array(PracticeRecord),
    events: z.array(
      z.object({
        id,
        record_id: id,
        law_firm_id: id,
        matter_id: id.nullable(),
        actor: id,
        at: stamp,
        revision: z.number().int().positive(),
        before: Payload.nullable(),
        after: Payload,
      }),
    ),
    settings: z.array(
      z.object({
        law_firm_id: id,
        retention_days: z.number().int().min(1).max(3650).nullable(),
      }),
    ),
  })
  .strict();
export type PracticeState = z.infer<typeof PracticeStateSchema>;
export const emptyPractice = (): PracticeState => ({
  version: 1,
  records: [],
  events: [],
  settings: [],
});
const target = {
  record_id: id,
  expected_revision: z.number().int().positive(),
};
export const PracticeCommands = {
  save_appointment: z
    .object({
      record_id: id.nullable(),
      expected_revision: z.number().int().positive().nullable(),
      matter_id: id.nullable(),
      title: text.max(240),
      client_id: id.nullable(),
      responsible_identity_id: id,
      starts_at: stamp,
      ends_at: stamp,
      location: z.string().max(1000),
      notes: z.string().max(4000),
    })
    .strict(),
  appointment_status: z
    .object({ ...target, status: z.enum(["DONE", "CANCELLED"]) })
    .strict(),
  create_payable: z
    .object({
      matter_id: id.nullable(),
      supplier: text.max(240),
      reference: text.max(240),
      description: text.max(2000),
      currency: Currency,
      total: Money.positive(),
      issued_on: date,
      due_on: date,
    })
    .strict(),
  pay_payable: z
    .object({
      ...target,
      amount: Money.positive(),
      date,
      reference: text.max(240),
      method: z.enum(["CASH", "BANK", "CARD", "OTHER"]),
    })
    .strict(),
  void_payable: z.object(target).strict(),
  save_admission: z
    .object({
      matter_id: id,
      record_id: id.nullable(),
      expected_revision: z.number().int().positive().nullable(),
      scope: text.max(12000),
      exclusions: z.string().max(6000),
      jurisdiction: text.max(200),
      parties: z.array(Party).min(1).max(100),
    })
    .strict(),
  check_conflicts: z.object(target).strict(),
  decide_admission: z
    .object({
      ...target,
      decision: z.enum(["ACCEPTED", "DECLINED"]),
      note: text.max(6000),
    })
    .strict(),
  save_budget: z
    .object({
      matter_id: id,
      record_id: id.nullable(),
      expected_revision: z.number().int().positive().nullable(),
      title: text.max(240),
      currency: Currency,
      lines: z.array(Line).min(1).max(100),
      terms: text.max(6000),
    })
    .strict(),
  approve_budget: z.object(target).strict(),
  accept_budget: z
    .object({ ...target, at: date, reference: text.max(500) })
    .strict(),
  cancel_budget: z.object({ ...target, reason: text.max(2000) }).strict(),
  record_entry: z
    .object({
      matter_id: id,
      type: z.enum(["TIME", "EXPENSE"]),
      description: text.max(4000),
      date,
      minutes: z.number().int().min(0).max(1440),
      amount: Money,
      currency: Currency,
      billable: z.boolean(),
      proof_version_id: id.nullable(),
    })
    .strict(),
  decide_entry: z
    .object({
      ...target,
      decision: z.enum(["APPROVED", "REJECTED"]),
      note: text.max(4000),
    })
    .strict(),
  issue_invoice: z
    .object({
      matter_id: id,
      currency: Currency,
      lines: z.array(Line).min(1).max(100),
      issued_on: date,
      due_on: date,
      budget_id: id.nullable(),
      budget_revision: z.number().int().positive().nullable(),
      entry_ids: z.array(id).max(100),
      fiscal_reference: z
        .object({
          number: text.max(100),
          authorization: text.max(100),
          issuer_tax_id: text.max(100),
          document_version_id: id,
        })
        .nullable(),
    })
    .strict(),
  void_invoice: z.object({ ...target, reason: text.max(2000) }).strict(),
  credit_invoice: z
    .object({
      invoice_id: id,
      amount: Money.positive(),
      reason: text.max(2000),
      date,
    })
    .strict(),
  record_payment: z
    .object({
      invoice_id: id,
      amount: Money.positive(),
      direction: z.enum(["RECEIPT", "REFUND"]),
      reference: text.max(240),
      method: z.enum(["CASH", "BANK", "CARD", "OTHER"]),
      date,
      proof_version_id: id.nullable(),
    })
    .strict(),
  save_template: z
    .object({
      record_id: id.nullable(),
      expected_revision: z.number().int().positive().nullable(),
      title: text.max(240),
      document_type: text.max(120),
      jurisdiction: text.max(200),
      body: text.max(200000),
    })
    .strict(),
  approve_template: z.object(target).strict(),
  retire_template: z.object(target).strict(),
  use_template: z
    .object({
      matter_id: id,
      template_id: id,
      expected_revision: z.number().int().positive(),
      title: text.max(240),
      values: z.record(z.string(), z.string().max(6000)),
    })
    .strict(),
  publish_delivery: z
    .object({
      matter_id: id,
      title: text.max(240),
      message: z.string().max(10000),
      document_version_id: id.nullable(),
      explicitly_confirmed: z.literal(true),
    })
    .strict(),
  withdraw_publication: z.object(target).strict(),
  grant_portal: z
    .object({
      matter_id: id,
      recipient: text.max(240),
      expires_at: stamp,
      allow_messages: z.boolean(),
    })
    .strict(),
  revoke_portal: z.object(target).strict(),
  send_message: z.object({ matter_id: id, text: text.max(12000) }).strict(),
  create_session: z
    .object({ matter_id: id, title: text.max(240), room_id: id.nullable() })
    .strict(),
  save_transcript: z
    .object({ session_id: id, text: text.max(500000) })
    .strict(),
  review_transcript: z.object({ ...target, text: text.max(500000) }).strict(),
  accept_transcript: z.object(target).strict(),
  combine_transcripts: z.object({ session_id: id }).strict(),
  save_minutes: z
    .object({
      session_id: id,
      transcript_id: id,
      record_id: id.nullable(),
      expected_revision: z.number().int().positive().nullable(),
      summary: text.max(30000),
      agreements: z.array(z.string().max(4000)),
      disagreements: z.array(z.string().max(4000)),
      actions: z
        .array(
          z.object({
            description: text.max(1000),
            responsible_identity_id: id.nullable(),
            due_at: stamp.nullable(),
          }),
        )
        .max(100),
    })
    .strict(),
  approve_minutes: z.object(target).strict(),
  assign_minute_action: z
    .object({
      ...target,
      action_id: id,
      responsible_identity_id: id,
      internal_due_at: stamp.nullable(),
    })
    .strict(),
  session_retention: z
    .object({ days: z.number().int().min(1).max(3650).nullable() })
    .strict(),
};
export type PracticeOperation = keyof typeof PracticeCommands;
export function lineTotal(lines: z.infer<typeof Line>[]) {
  let total = 0n;
  for (const l of lines) {
    const base = BigInt(l.quantity) * BigInt(l.unit_amount);
    total += base + (base * BigInt(l.tax_bps) + 5000n) / 10000n;
    if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("MONEY_OVERFLOW");
  }
  return Number(total);
}
export const moneyDigits = (currency: string) => (currency === "PYG" ? 0 : 2);
export function amountFromText(value: string, currency: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error("Importe inválido");
  const parts = value.split(".");
  const digits = moneyDigits(currency);
  if (!digits && parts[1]) throw Error("Usá guaraníes enteros");
  const amount =
    Number(parts[0]) * 10 ** digits +
    Number((parts[1] ?? "").padEnd(digits, "0"));
  if (!Number.isSafeInteger(amount)) throw Error("Importe demasiado grande");
  return amount;
}
