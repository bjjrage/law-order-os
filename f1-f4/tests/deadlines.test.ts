import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  BrowserPersistence,
  LOCAL_PROFILES,
  parseSnapshot,
} from "../../apps/web/src/local-storage.js";
import { OsCoreService } from "../../os-core/src/service.js";
import {
  calculateDeadline,
  deadlineInstant,
  currentDeadline,
  advanceDeadlineAlerts,
  type DeadlineInput,
} from "../../os-core/src/deadlines.js";
import type { Authenticator, FirmRole } from "../../os-core/src/contracts.js";
import { LocalPlatform } from "../../apps/api/src/local-platform.js";
import { database } from "./fixtures.js";

const input: DeadlineInput = {
  category: "JUDICIAL",
  origin: "Notificación sintética del 16 de octubre",
  source_version_id: null,
  rule: {
    mode: "DAYS",
    start_date: "2026-10-16",
    days: 3,
    day_type: "BUSINESS",
    include_start: false,
    excluded_dates: ["2026-10-19"],
    time: "17:00",
    basis: "Calendario sintético revisado: excluir fin de semana y lunes",
  },
  reminders_hours: [72, 24],
  escalation_identity_id: "local-administrator",
  escalation_after_hours: 24,
};
async function setup(role: FirmRole = "LAWYER") {
  let raw: string | null = null,
    now = "2026-10-16T12:00:00.000Z";
  const store = new BrowserPersistence({
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
  });
  const auth: Authenticator = {
    authenticate: async (id) =>
      LOCAL_PROFILES.some((p) => p.id === id)
        ? {
            identity_id: id,
            subject: id,
            session_id: id,
            expires_at: "2999-01-01T00:00:00.000Z",
          }
        : null,
    identity: async (id) => LOCAL_PROFILES.find((p) => p.id === id) ?? null,
  };
  const core = new OsCoreService(store, auth, () => new Date(now));
  const owner = "local-administrator",
    lawyer = "local-lawyer";
  const firm = await core.createLawFirm(owner, "Plazos sintéticos");
  const membership = await core.addMember(owner, firm.id, lawyer, "LAWYER");
  // Historical profiles remain readable; new operational invitations only allow two roles.
  if (role !== "LAWYER")
    await store.transaction((tx) =>
      tx.replace("memberships", { ...membership, role }),
    );
  const client = await core.createClient(owner, firm.id, {
    kind: "PERSON",
    display_name: "Cliente de prueba",
    identification: null,
  });
  const matter = await core.createMatter(owner, firm.id, {
    client_id: client.id,
    title: "Asunto de prueba",
    subject_area: "Civil",
    kind: "JUDICIAL",
    responsible_identity_id: role === "ASSISTANT" ? owner : lawyer,
    opened_on: "2026-10-16",
    closed_on: null,
  });
  if (role === "ASSISTANT")
    await core.grantParticipant(owner, firm.id, matter.id, lawyer, [
      "READ",
      "TASK_WRITE",
    ]);
  const args = [firm.id, matter.id] as const;
  const create = () =>
    core.createDeadline(owner, ...args, {
      title: "Contestar traslado",
      responsible_identity_id: lawyer,
      deadline: input,
    });
  return {
    store,
    core,
    owner,
    lawyer,
    firm,
    matter,
    args,
    create,
    setNow: (value: string) => {
      now = value;
    },
  };
}

it("counts a declared calendar across weekends, exclusions, initial-day choice and leap years in Paraguay", () => {
  expect(calculateDeadline(input).due_at).toBe(
    deadlineInstant("2026-10-22", "17:00"),
  );
  expect(
    calculateDeadline({
      ...input,
      rule: {
        ...input.rule,
        mode: "DAYS",
        start_date: "2026-10-16",
        days: 1,
        day_type: "BUSINESS",
        include_start: true,
        excluded_dates: [],
        time: "17:00",
        basis: "Prueba",
      },
    }).due_at,
  ).toBe(deadlineInstant("2026-10-16", "17:00"));
  expect(
    calculateDeadline({
      ...input,
      rule: {
        mode: "DAYS",
        start_date: "2028-02-28",
        days: 2,
        day_type: "CALENDAR",
        include_start: false,
        excluded_dates: [],
        time: "09:30",
        basis: "Prueba",
      },
    }).due_at,
  ).toBe(deadlineInstant("2028-03-01", "09:30"));
  expect(() => deadlineInstant("2026-02-30", "17:00")).toThrow();
});

it("requires human confirmation and retains immutable origins when a deadline or responsible changes", async () => {
  const f = await setup(),
    task = await f.create();
  expect(currentDeadline(task)?.confirmed_at).toBeNull();
  expect(await f.core.deadlineInbox(f.lawyer, f.firm.id)).toEqual([]);
  await f.core.confirmDeadline(f.owner, ...f.args, task.id, 1);
  const next = await f.core.reviseDeadline(
    f.owner,
    ...f.args,
    task.id,
    {
      title: task.title,
      responsible_identity_id: f.owner,
      deadline: { ...input, escalation_identity_id: f.lawyer },
    },
    1,
    "Nuevo responsable y revisión de cómputo",
  );
  expect(next.deadline?.versions).toHaveLength(2);
  expect(next.deadline?.versions[0]?.confirmed_by).toBe(f.owner);
  expect(currentDeadline(next)?.confirmed_at).toBeNull();
  await expect(
    f.core.confirmDeadline(f.owner, ...f.args, task.id, 1),
  ).rejects.toThrow("VERSION_CONFLICT");
  await expect(
    f.core.updateTaskStatus(f.owner, ...f.args, task.id, "DONE", 1),
  ).rejects.toThrow("VERSION_CONFLICT");
  expect(
    parseSnapshot(f.store.exportBackup()).tables.tasks[0]?.deadline?.revision,
  ).toBe(2);
  const corrupt = JSON.parse(f.store.exportBackup());
  corrupt.tables.tasks[0].internal_due_at = "2026-10-20T12:00:00.000Z";
  expect(() => parseSnapshot(JSON.stringify(corrupt))).toThrow();
});

it("delivers and acknowledges notices once, escalates an unfinished task after downtime and stops on completion", async () => {
  const f = await setup(),
    task = await f.create();
  await f.core.confirmDeadline(f.owner, ...f.args, task.id, 1);
  f.setNow(deadlineInstant("2026-10-21", "18:00"));
  const first = await f.core.deadlineInbox(f.lawyer, f.firm.id);
  expect(first).toHaveLength(1);
  expect(first[0]?.alert.kind).toBe("REMINDER");
  expect((await f.core.deadlineInbox(f.lawyer, f.firm.id))[0]?.alert.id).toBe(
    first[0]?.alert.id,
  );
  await expect(
    f.core.acknowledgeDeadlineAlert(
      f.owner,
      ...f.args,
      task.id,
      first[0]!.alert.id,
    ),
  ).rejects.toThrow("ACCESS_DENIED");
  await f.core.acknowledgeDeadlineAlert(
    f.lawyer,
    ...f.args,
    task.id,
    first[0]!.alert.id,
  );
  expect(await f.core.deadlineInbox(f.lawyer, f.firm.id)).toHaveLength(0);
  f.setNow(deadlineInstant("2026-10-24", "18:00"));
  const escalated = await f.core.deadlineInbox(f.owner, f.firm.id);
  expect(escalated.map((e) => e.alert.kind)).toEqual(["ESCALATION"]);
  expect(
    (await f.core.deadlineInbox(f.lawyer, f.firm.id)).map((e) => e.alert.kind),
  ).toEqual(["OVERDUE"]);
  await f.core.updateTaskStatus(f.lawyer, ...f.args, task.id, "DONE", 1);
  expect(await f.core.deadlineInbox(f.owner, f.firm.id)).toEqual([]);
  expect(
    (await f.core.getTask(f.owner, ...f.args, task.id)).deadline?.alerts,
  ).toHaveLength(3);
});

it("records blocked escalation without leaking a case after revocation, then releases it if access is restored", async () => {
  const f = await setup(),
    task = await f.core.createDeadline(f.owner, ...f.args, {
      title: "Seguimiento",
      responsible_identity_id: f.owner,
      deadline: { ...input, escalation_identity_id: f.lawyer },
    });
  await f.core.confirmDeadline(f.owner, ...f.args, task.id, 1);
  await f.core.reassignMatter(f.owner, ...f.args, f.owner, f.lawyer);
  await f.core.revokeParticipant(f.owner, ...f.args, f.lawyer);
  const snapshot = f.store.snapshot();
  const next = advanceDeadlineAlerts(
    snapshot.tables.tasks[0]!,
    snapshot.tables.memberships,
    snapshot.tables.participants,
    deadlineInstant("2026-10-24", "18:00"),
    randomUUID,
  );
  expect(
    next.deadline?.alerts.find((a) => a.kind === "ESCALATION")?.blocked_at,
  ).toBeTruthy();
  expect(await f.core.deadlineInbox(f.lawyer, f.firm.id)).toEqual([]);
  await f.core.grantParticipant(f.owner, ...f.args, f.lawyer, [
    "READ",
    "TASK_WRITE",
  ]);
  const restored = f.store.snapshot();
  const released = advanceDeadlineAlerts(
    next,
    restored.tables.memberships,
    restored.tables.participants,
    deadlineInstant("2026-10-25", "18:00"),
    randomUUID,
  );
  expect(
    released.deadline?.alerts.find((a) => a.kind === "ESCALATION")?.released_at,
  ).toBeTruthy();
});

it("does not allow assistants to confirm, inaccessible people to receive a task, or a foreign document as origin", async () => {
  const f = await setup("ASSISTANT");
  const task = await f.create();
  await expect(
    f.core.confirmDeadline(f.lawyer, ...f.args, task.id, 1),
  ).rejects.toThrow("ACCESS_DENIED");
  await expect(
    f.core.createDeadline(f.owner, ...f.args, {
      title: "Prueba",
      responsible_identity_id: "missing",
      deadline: input,
    }),
  ).rejects.toThrow();
  await expect(
    f.core.createDeadline(f.owner, ...f.args, {
      title: "Prueba",
      responsible_identity_id: f.owner,
      deadline: {
        ...input,
        escalation_identity_id: null,
        source_version_id: "foreign-version",
      },
    }),
  ).rejects.toThrow("ACCESS_DENIED");
});

it("stores server-generated notices with PostgreSQL while no browser is open and preserves them on service restart", async () => {
  const db = await database();
  try {
    const f = await setup(),
      task = await f.create();
    await f.core.confirmDeadline(f.owner, ...f.args, task.id, 1);
    const owner = {
      id: randomUUID(),
      subject: "",
      display_name: "Titular real de prueba",
      active: true,
    };
    owner.subject = owner.id;
    let platform = new LocalPlatform(db.pool);
    await platform.initialize();
    await platform.activate(f.store.exportBackup(), owner);
    await expect(
      platform.command(
        owner,
        [owner],
        `/firms/${f.firm.id}/matters/${f.matter.id}/deadlines`,
        {
          title: "No asignar a alias histórico",
          responsible_identity_id: f.lawyer,
          deadline: input,
        },
        randomUUID(),
      ),
    ).rejects.toThrow("INACTIVE_ASSIGNEE");
    const clock = deadlineInstant("2026-10-24", "18:00");
    await Promise.all([
      platform.tickDeadlines(clock),
      platform.tickDeadlines(clock),
    ]);
    let state = await platform.raw();
    expect(state.tables.tasks[0]?.deadline?.alerts.map((a) => a.kind)).toEqual([
      "OVERDUE",
      "ESCALATION",
    ]);
    expect(
      state.tables.tasks[0]?.deadline?.alerts.every((a) => !a.presented_at),
    ).toBe(true);
    platform = new LocalPlatform(db.pool);
    await platform.initialize();
    await platform.tickDeadlines(clock);
    state = await platform.raw();
    expect(state.tables.tasks[0]?.deadline?.alerts).toHaveLength(2);
    expect(state.tables.tasks[0]?.deadline?.versions[0]?.origin).toBe(
      input.origin,
    );
    expect(
      (await platform.view(owner, [owner])).snapshot.tables.tasks,
    ).toHaveLength(1);
    const path = `/firms/${f.firm.id}/matters/${f.matter.id}`;
    const created = await platform.command(
      owner,
      [owner],
      path + "/deadlines",
      {
        title: "Aviso privado del titular",
        responsible_identity_id: owner.id,
        deadline: {
          ...input,
          escalation_identity_id: null,
          rule: { mode: "MANUAL", date: "2020-01-02", time: "17:00" },
        },
      },
      randomUUID(),
    );
    const createdTask = created.data as { id: string };
    await platform.command(
      owner,
      [owner],
      path + `/deadlines/${createdTask.id}/confirmation`,
      { expected_revision: 1 },
      randomUUID(),
    );
    const inboxId = randomUUID(),
      inboxPath = `/firms/${f.firm.id}/deadline-inbox`;
    expect(
      (await platform.command(owner, [owner], inboxPath, {}, inboxId)).data,
    ).toHaveLength(1);
    const revoked = await platform.raw();
    // Removing an explicit participant cannot remove Director-wide oversight.
    // This fixture models losing the Director role as well as the case access.
    revoked.tables.memberships
      .filter((m) => m.identity_id === owner.id)
      .forEach((m) => {
        m.role = "LAWYER";
      });
    revoked.tables.participants
      .filter((p) => p.identity_id === owner.id)
      .forEach((p) => {
        p.active = false;
      });
    revoked.revision++;
    await db.pool.query(
      "UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",
      [revoked],
    );
    expect(
      (await platform.command(owner, [owner], inboxPath, {}, inboxId)).data,
    ).toEqual([]);
  } finally {
    await db.close();
  }
}, 60000);

it("keeps the exact documentary version of the origin after a new document version is published", async () => {
  const f = await setup();
  const draft = await f.core.prepareDraft(
    f.owner,
    ...f.args,
    "Notificación",
    "Texto original de la notificación",
  );
  const task = await f.core.createDeadline(f.owner, ...f.args, {
    title: "Responder",
    responsible_identity_id: f.lawyer,
    deadline: { ...input, source_version_id: draft.document_version_id },
  });
  const revised = await f.core.reviseDraft(
    f.owner,
    ...f.args,
    draft.id,
    draft.document_version_id,
    "Texto posterior distinto",
  );
  expect(revised.document_version_id).not.toBe(draft.document_version_id);
  expect(
    (await f.core.getDeadlineSource(f.lawyer, ...f.args, task.id)).id,
  ).toBe(draft.document_version_id);
  await f.core.reassignMatter(f.owner, ...f.args, f.owner, f.lawyer);
  await f.core.revokeParticipant(f.owner, ...f.args, f.lawyer);
  await expect(
    f.core.getDeadlineSource(f.lawyer, ...f.args, task.id),
  ).rejects.toThrow("ACCESS_DENIED");
});
