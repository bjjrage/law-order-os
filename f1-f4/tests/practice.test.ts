import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  BrowserPersistence,
  parseSnapshot,
} from "../../apps/web/src/local-storage.js";
import { executeCoreCommand } from "../../apps/web/src/local-commands.js";
import { TestAuthenticator } from "../../os-core/testing/memory.js";
import { executePortal, invoiceBalance } from "../../os-core/src/practice.js";
import { amountFromText, lineTotal } from "../../os-core/src/practice-model.js";
async function fixture() {
  let value: string | null = null;
  const store = new BrowserPersistence({
      getItem: () => value,
      setItem: (_k, v) => {
        value = v;
      },
    }),
    auth = new TestAuthenticator();
  const people = ["Director", "Lawyer", "Other"].map((display_name) => ({
    id: randomUUID(),
    subject: randomUUID(),
    display_name,
    active: true,
  }));
  for (const p of people) auth.register(p, p.id);
  const [D, A, O] = people;
  value = JSON.stringify({ ...store.snapshot(), identities: people });
  const run = (op: string, b?: unknown, actor = D!) =>
    executeCoreCommand(store, actor, auth, op, b, []);
  const firm: any = await run("/firms", { name: "Synthetic firm" });
  await run(`/firms/${firm.id}/memberships`, {
    identity_id: A!.id,
    role: "LAWYER",
  });
  const client: any = await run(`/firms/${firm.id}/clients`, {
    kind: "PERSON",
    display_name: "Test Client",
    identification: "123",
  });
  const matter: any = await run(`/firms/${firm.id}/matters`, {
    client_id: client.id,
    title: "Test case",
    subject_area: "Civil",
    kind: "ADVISORY",
    responsible_identity_id: A!.id,
    opened_on: "2026-10-19",
    closed_on: null,
  });
  const command = (op: string, b: any, actor = D!) =>
    run(`/firms/${firm.id}/practice/${op}`, b, actor) as Promise<any>;
  const view = (actor = D!) =>
    run(`/firms/${firm.id}/practice`, undefined, actor) as Promise<any>;
  const target = (r: any) => ({
    record_id: r.id,
    expected_revision: r.revision,
  });
  const accept = async () => {
    let a = await command("save_admission", {
      matter_id: matter.id,
      record_id: null,
      expected_revision: null,
      scope: "Advice",
      exclusions: "",
      jurisdiction: "PY",
      parties: [{ name: "Test Client", identification: "123", side: "CLIENT" }],
    });
    a = await command("check_conflicts", target(a));
    return command("decide_admission", {
      ...target(a),
      decision: "ACCEPTED",
      note: "Human review completed",
    });
  };
  return {
    store,
    auth,
    run,
    firm,
    matter,
    client,
    D: D!,
    A: A!,
    O: O!,
    command,
    view,
    target,
    accept,
  };
}
it("keeps provider bills separate, preserves partial payments and restricts finances to the Director", async () => {
  const f = await fixture();
  const input = {
    matter_id: null,
    supplier: "Synthetic supplier",
    reference: "A-001",
    description: "Office rent",
    currency: "USD",
    total: 10000,
    issued_on: "2026-10-19",
    due_on: "2026-10-30",
  };
  await expect(f.command("create_payable", input, f.A)).rejects.toThrow(
    "DIRECTOR_REQUIRED",
  );
  const bill = await f.command("create_payable", input);
  await expect(f.command("create_payable", input)).rejects.toThrow(
    "DUPLICATE_PAYABLE",
  );
  const payment = {
    ...f.target(bill),
    amount: 4000,
    date: "2026-10-19",
    reference: "Bank-01",
    method: "BANK",
  };
  await f.command("pay_payable", payment);
  await expect(f.command("pay_payable", payment)).rejects.toThrow(
    "DUPLICATE_PAYMENT_REFERENCE",
  );
  await expect(
    f.command("pay_payable", {
      ...payment,
      amount: 6001,
      reference: "Bank-02",
    }),
  ).rejects.toThrow("PAYMENT_EXCEEDS_BALANCE");
  await expect(f.command("void_payable", f.target(bill))).rejects.toThrow(
    "INVOICE_HAS_MOVEMENTS",
  );
  await f.command("pay_payable", {
    ...payment,
    amount: 6000,
    reference: "Bank-02",
  });
  const view = await f.view();
  expect(
    view.records
      .filter((r: any) => r.payload.type === "DISBURSEMENT")
      .reduce((n: number, r: any) => n + r.payload.amount, 0),
  ).toBe(10000);
  expect(
    (await f.view(f.A)).records.some((r: any) =>
      ["PAYABLE", "DISBURSEMENT"].includes(r.payload.type),
    ),
  ).toBe(false);
  expect(
    parseSnapshot(f.store.exportBackup()).practice!.records.filter(
      (r) => r.payload.type === "DISBURSEMENT",
    ),
  ).toHaveLength(2);
});
it("schedules client appointments, blocks overlaps and prevents lawyers assigning or editing other people's appointments", async () => {
  const f = await fixture();
  await f.run(`/firms/${f.firm.id}/memberships`, {
    identity_id: f.O.id,
    role: "LAWYER",
  });
  const input = {
    record_id: null,
    expected_revision: null,
    matter_id: null,
    title: "Client meeting",
    client_id: f.client.id,
    responsible_identity_id: f.A.id,
    starts_at: "2026-10-20T13:00:00.000Z",
    ends_at: "2026-10-20T14:00:00.000Z",
    location: "Office",
    notes: "Synthetic",
  };
  const appointment = await f.command("save_appointment", input, f.A);
  await expect(
    f.command(
      "save_appointment",
      { ...input, responsible_identity_id: f.O.id },
      f.A,
    ),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(
    f.command("save_appointment", {
      ...input,
      starts_at: "2026-10-20T13:30:00.000Z",
    }),
  ).rejects.toThrow("APPOINTMENT_OVERLAP");
  await expect(
    f.command(
      "appointment_status",
      { ...f.target(appointment), status: "CANCELLED" },
      f.O,
    ),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  expect(
    (await f.view(f.O)).records.some((r: any) => r.id === appointment.id),
  ).toBe(false);
  const moved = await f.command(
    "save_appointment",
    {
      ...input,
      ...f.target(appointment),
      starts_at: "2026-10-20T15:00:00.000Z",
      ends_at: "2026-10-20T16:00:00.000Z",
    },
    f.A,
  );
  await expect(
    f.command(
      "appointment_status",
      { ...f.target(appointment), status: "DONE" },
      f.A,
    ),
  ).rejects.toThrow("VERSION_CONFLICT");
  await f.command("appointment_status", {
    ...f.target(moved),
    status: "CANCELLED",
  });
  await f.command("save_appointment", input);
  await expect(
    f.command("save_appointment", { ...input, ends_at: input.starts_at }),
  ).rejects.toThrow("INVALID_APPOINTMENT_TIME");
  expect(
    parseSnapshot(f.store.exportBackup()).practice!.records.filter(
      (r) => r.payload.type === "APPOINTMENT",
    ),
  ).toHaveLength(2);
});
it("keeps exact minor-unit arithmetic, rejects overflow and invalid decimal input", () => {
  expect(amountFromText("1.09", "USD")).toBe(109);
  expect(amountFromText("1000", "PYG")).toBe(1000);
  expect(() => amountFromText("1.5", "PYG")).toThrow();
  expect(() => amountFromText("1,000", "USD")).toThrow();
  expect(
    lineTotal([
      { description: "x", quantity: 3, unit_amount: 101, tax_bps: 1000 },
    ]),
  ).toBe(333);
  expect(() =>
    lineTotal([
      {
        description: "x",
        quantity: 1000000,
        unit_amount: Number.MAX_SAFE_INTEGER,
        tax_bps: 0,
      },
    ]),
  ).toThrow("MONEY_OVERFLOW");
});
it("supports internal study meetings without requiring an invented client", async () => {
  const f = await fixture();
  const meeting = await f.command(
    "save_appointment",
    {
      record_id: null,
      expected_revision: null,
      matter_id: null,
      client_id: null,
      title: "Internal planning",
      responsible_identity_id: f.A.id,
      starts_at: "2026-10-20T13:00:00Z",
      ends_at: "2026-10-20T14:00:00Z",
      location: "Office",
      notes: "",
    },
    f.A,
  );
  expect(meeting.payload.client_id).toBeNull();
  expect(
    (await f.view(f.A)).records.some((r: any) => r.id === meeting.id),
  ).toBe(true);
  await expect(
    f.command(
      "save_appointment",
      {
        record_id: null,
        expected_revision: null,
        matter_id: f.matter.id,
        client_id: null,
        title: "Invalid matter meeting",
        responsible_identity_id: f.A.id,
        starts_at: "2026-10-21T13:00:00Z",
        ends_at: "2026-10-21T14:00:00Z",
        location: "Office",
        notes: "",
      },
      f.A,
    ),
  ).rejects.toThrow("CLIENT_MATTER_MISMATCH");
});
it("requires a fresh conflict check and a Director decision, preserves revisions", async () => {
  const f = await fixture();
  let a = await f.command(
    "save_admission",
    {
      matter_id: f.matter.id,
      record_id: null,
      expected_revision: null,
      scope: "Advice",
      exclusions: "",
      jurisdiction: "PY",
      parties: [{ name: "Test Client", identification: "123", side: "CLIENT" }],
    },
    f.A,
  );
  await expect(
    f.command(
      "decide_admission",
      { ...f.target(a), decision: "ACCEPTED", note: "ok" },
      f.A,
    ),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(
    f.command("decide_admission", {
      ...f.target(a),
      decision: "ACCEPTED",
      note: "ok",
    }),
  ).rejects.toThrow("CONFLICT_CHECK_REQUIRED");
  a = await f.command("check_conflicts", f.target(a));
  expect(a.payload.conflict_check.matches.length).toBeGreaterThan(0);
  await f.run(`/firms/${f.firm.id}/clients`, {
    kind: "PERSON",
    display_name: "New client",
    identification: null,
  });
  await expect(
    f.command("decide_admission", {
      ...f.target(a),
      decision: "ACCEPTED",
      note: "ok",
    }),
  ).rejects.toThrow("CONFLICT_CHECK_REQUIRED");
  await expect(f.view(f.O)).rejects.toThrow("ACCESS_DENIED");
  expect(parseSnapshot(f.store.exportBackup()).practice?.events).toHaveLength(
    2,
  );
});
it("approves budgets and expenses, reconciles receipts, credits and refunds without overwriting invoices", async () => {
  const f = await fixture();
  const budget = {
    matter_id: f.matter.id,
    record_id: null,
    expected_revision: null,
    title: "Fee",
    currency: "USD",
    lines: [
      { description: "Advice", quantity: 1, unit_amount: 10000, tax_bps: 0 },
    ],
    terms: "Fixed fee",
  };
  await expect(f.command("save_budget", budget)).rejects.toThrow(
    "ADMISSION_ACCEPTANCE_REQUIRED",
  );
  await f.accept();
  let b = await f.command("save_budget", budget);
  b = await f.command("approve_budget", f.target(b));
  b = await f.command("accept_budget", {
    ...f.target(b),
    at: "2026-10-19",
    reference: "Signed agreement",
  });
  const expense = await f.command(
    "record_entry",
    {
      matter_id: f.matter.id,
      type: "EXPENSE",
      description: "Travel",
      date: "2026-10-19",
      minutes: 0,
      amount: 1000,
      currency: "USD",
      billable: true,
      proof_version_id: null,
    },
    f.A,
  );
  const approved = await f.command("decide_entry", {
    ...f.target(expense),
    decision: "APPROVED",
    note: "Receipt reviewed",
  });
  const input = {
    matter_id: f.matter.id,
    currency: "USD",
    lines: budget.lines,
    issued_on: "2026-10-19",
    due_on: "2026-10-20",
    budget_id: b.id,
    budget_revision: b.revision,
    entry_ids: [approved.id],
    fiscal_reference: null,
  };
  const invoice = await f.command("issue_invoice", input);
  await expect(f.command("issue_invoice", input)).rejects.toThrow(
    "ENTRY_ALREADY_BILLED",
  );
  await expect(f.command("issue_invoice", input, f.A)).rejects.toThrow(
    "DIRECTOR_REQUIRED",
  );
  const pay = {
    invoice_id: invoice.id,
    amount: 10000,
    direction: "RECEIPT",
    reference: "BANK-1",
    method: "BANK",
    date: "2026-10-19",
    proof_version_id: null,
  };
  await f.command("record_payment", pay);
  await expect(f.command("record_payment", pay)).rejects.toThrow();
  await f.command("credit_invoice", {
    invoice_id: invoice.id,
    amount: 2000,
    reason: "Adjustment",
    date: "2026-10-19",
  });
  await f.command("record_payment", {
    ...pay,
    amount: 2000,
    direction: "REFUND",
    reference: "BANK-2",
  });
  const v = await f.view();
  expect(v.balances[0].balance).toBe(0);
  expect(v.records.find((r: any) => r.id === invoice.id).payload.type).toBe(
    "INVOICE",
  );
  expect(
    v.records.filter((r: any) => r.payload.type === "PAYMENT"),
  ).toHaveLength(2);
  const av = await f.view(f.A);
  expect(av.records.map((r: any) => r.payload.type)).not.toContain("INVOICE");
  expect(av.events).toEqual([]);
  await expect(
    f.command("void_invoice", { ...f.target(invoice), reason: "Try" }),
  ).rejects.toThrow("INVOICE_HAS_MOVEMENTS");
});
it("creates documents from approved template revisions and isolates revocable published-version portal access", async () => {
  const f = await fixture();
  let t = await f.command("save_template", {
    record_id: null,
    expected_revision: null,
    title: "Letter",
    document_type: "Letter",
    jurisdiction: "PY",
    body: "Dear {{cliente.nombre}}, {{custom.text}}",
  });
  await expect(
    f.command(
      "use_template",
      {
        matter_id: f.matter.id,
        template_id: t.id,
        expected_revision: t.revision,
        title: "Letter",
        values: { "custom.text": "Hello" },
      },
      f.A,
    ),
  ).rejects.toThrow("TEMPLATE_APPROVAL_REQUIRED");
  t = await f.command("approve_template", f.target(t));
  const result = await f.command(
    "use_template",
    {
      matter_id: f.matter.id,
      template_id: t.id,
      expected_revision: t.revision,
      title: "Letter",
      values: { "custom.text": "Hello" },
    },
    f.A,
  );
  expect(result.draft.document_version_id).toBeTruthy();
  await expect(
    f.command("publish_delivery", {
      matter_id: f.matter.id,
      title: "Draft",
      message: "",
      document_version_id: result.draft.document_version_id,
      explicitly_confirmed: true,
    }),
  ).rejects.toThrow("APPROVED_VERSION_REQUIRED");
  const publication = await f.command("publish_delivery", {
    matter_id: f.matter.id,
    title: "Reviewed notice",
    message: "Only this public text",
    document_version_id: null,
    explicitly_confirmed: true,
  });
  const grant = await f.command("grant_portal", {
    matter_id: f.matter.id,
    recipient: "Client",
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    allow_messages: true,
  });
  const portal = (input: any) =>
    f.store.transaction((tx, _p, _t, s) =>
      executePortal(tx, s, grant.token, input),
    );
  const view: any = await portal({ action: "VIEW" });
  expect(JSON.stringify(view)).not.toContain("custom.text");
  expect(view.publications).toHaveLength(1);
  expect(view.recipient).toBe("Client");
  const prefix = `/firms/${f.firm.id}/matters/${f.matter.id}`;
  const review: any = await f.run(
    `${prefix}/drafts/${result.draft.id}/reviews`,
    {
      reviewer_identity_id: f.D.id,
      expected_version_id: result.draft.document_version_id,
      internal_due_at: null,
    },
  );
  await f.run(`${prefix}/reviews/${review.review.id}/decisions`, {
    decision: "APPROVE",
    expected_version_id: result.draft.document_version_id,
    explicitly_confirmed: true,
  });
  const documentPublication = await f.command("publish_delivery", {
    matter_id: f.matter.id,
    title: "Approved letter",
    message: "Reviewed delivery",
    document_version_id: result.draft.document_version_id,
    explicitly_confirmed: true,
  });
  await f.run(
    `${prefix}/drafts/${result.draft.id}/versions`,
    {
      expected_version_id: result.draft.document_version_id,
      content: "PRIVATE NEW DRAFT - not approved",
    },
    f.A,
  );
  const delivered: any = await portal({
    action: "DOWNLOAD",
    publication_id: documentPublication.id,
  });
  expect(Buffer.from(delivered.base64, "base64").toString()).toBe(
    "Dear Test Client, Hello",
  );
  await f.command("withdraw_publication", f.target(documentPublication));
  await expect(
    portal({ action: "DOWNLOAD", publication_id: result.draft.id }),
  ).rejects.toThrow("PORTAL_ACCESS_DENIED");
  const message = {
    action: "MESSAGE",
    message_id: randomUUID(),
    text: "Received",
  };
  expect(await portal(message)).toEqual(await portal(message));
  await expect(portal({ ...message, text: "Changed" })).rejects.toThrow(
    "COMMAND_CONFLICT",
  );
  await f.command("withdraw_publication", f.target(publication));
  expect(((await portal({ action: "VIEW" })) as any).publications).toHaveLength(
    0,
  );
  await f.command("revoke_portal", f.target(grant.grant));
  await expect(portal({ action: "VIEW" })).rejects.toThrow(
    "PORTAL_ACCESS_DENIED",
  );
});
it("keeps the latest approved template usable while a new revision is drafted, and disables it on retirement", async () => {
  const f = await fixture();
  let template = await f.command("save_template", {
    record_id: null,
    expected_revision: null,
    title: "Approved wording",
    document_type: "Letter",
    jurisdiction: "PY",
    body: "APPROVED {{cliente.nombre}}",
  });
  template = await f.command("approve_template", f.target(template));
  const revision = await f.command("save_template", {
    ...f.target(template),
    title: "New draft wording",
    document_type: "Letter",
    jurisdiction: "PY",
    body: "UNAPPROVED TEXT",
  });
  const available = (await f.view(f.A)).records.find(
    (r: any) => r.id === template.id,
  );
  expect(available.revision).toBe(template.revision);
  expect(available.payload.body).toContain("APPROVED");
  const result = await f.command(
    "use_template",
    {
      matter_id: f.matter.id,
      template_id: template.id,
      expected_revision: template.revision,
      title: "Safe letter",
      values: {},
    },
    f.A,
  );
  const version = f.store
    .snapshot()
    .tables.documentVersions.find(
      (v) => v.id === result.draft.document_version_id,
    )!;
  expect(Buffer.from(version.original_base64, "base64").toString()).toBe(
    "APPROVED Test Client",
  );
  await f.command("retire_template", f.target(revision));
  expect(
    (await f.view(f.A)).records.some((r: any) => r.id === template.id),
  ).toBe(false);
  await expect(
    f.command(
      "use_template",
      {
        matter_id: f.matter.id,
        template_id: template.id,
        expected_revision: template.revision,
        title: "Denied",
        values: {},
      },
      f.A,
    ),
  ).rejects.toThrow("TEMPLATE_APPROVAL_REQUIRED");
});
it("requires Director approval before turning minutes into human assignments", async () => {
  const f = await fixture();
  const session = await f.command(
      "create_session",
      { matter_id: f.matter.id, title: "Discussion", room_id: null },
      f.A,
    ),
    transcript = await f.command(
      "save_transcript",
      { session_id: session.id, text: "We should review the terms." },
      f.A,
    );
  let minutes = await f.command(
    "save_minutes",
    {
      session_id: session.id,
      transcript_id: transcript.id,
      record_id: null,
      expected_revision: null,
      summary: "Discussed terms",
      agreements: ["Review"],
      disagreements: [],
      actions: [
        {
          description: "Review terms",
          responsible_identity_id: null,
          due_at: null,
        },
      ],
    },
    f.A,
  );
  await expect(
    f.command("approve_minutes", f.target(minutes), f.A),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  minutes = await f.command("approve_minutes", f.target(minutes));
  const body = {
    ...f.target(minutes),
    action_id: minutes.payload.actions[0].id,
    responsible_identity_id: f.A.id,
    internal_due_at: null,
  };
  const result = await f.command("assign_minute_action", body);
  expect(result.task.responsible_identity_id).toBe(f.A.id);
  await expect(
    f.command("assign_minute_action", { ...body, ...f.target(result.minutes) }),
  ).rejects.toThrow("ACTION_ALREADY_ASSIGNED");
});
