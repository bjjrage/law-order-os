import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { database } from "./fixtures.js";
import {
  BrowserPersistence,
  LOCAL_PROFILES,
} from "../../apps/web/src/local-storage.js";
import { LocalPlatform } from "../../apps/api/src/local-platform.js";
import {
  MemoryTestPersistence,
  TestAuthenticator,
} from "../../os-core/testing/memory.js";
import { OsCoreService } from "../../os-core/src/service.js";
import { ALL_MATTER_PERMISSIONS } from "../../os-core/src/contracts.js";
import { managementRoute } from "../../packages/workspace/src/management-tools.js";
import {
  currentDeadline,
  type DeadlineInput,
} from "../../os-core/src/deadlines.js";

async function fixture() {
  const store = new MemoryTestPersistence(),
    auth = new TestAuthenticator();
  const [director, a, b, outsider] = [
    "Director",
    "Abogada A",
    "Abogado B",
    "Ajeno",
  ].map((display_name) => ({
    id: randomUUID(),
    subject: randomUUID(),
    display_name,
    active: true,
  }));
  for (const person of [director!, a!, b!, outsider!])
    auth.register(person, person.id);
  const core = new OsCoreService(store, auth),
    D = director!.id,
    A = a!.id,
    B = b!.id,
    O = outsider!.id;
  const firm = await core.createLawFirm(D, "Estudio sintético");
  await core.addMember(D, firm.id, A, "LAWYER");
  await core.addMember(D, firm.id, B, "LAWYER");
  const client = await core.createClient(A, firm.id, {
    kind: "PERSON",
    display_name: "Cliente sintético",
    identification: null,
  });
  const matter = await core.createMatter(A, firm.id, {
    client_id: client.id,
    title: "Caso de A",
    subject_area: "Civil",
    kind: "ADVISORY",
    responsible_identity_id: A,
    opened_on: "2026-10-19",
    closed_on: null,
  });
  await core.grantParticipant(D, firm.id, matter.id, B, [
    ...ALL_MATTER_PERMISSIONS,
  ]);
  return {
    store,
    auth,
    core,
    D,
    A,
    B,
    O,
    firm,
    matter,
    args: [firm.id, matter.id] as const,
  };
}
it("gives Directors firm oversight without making a case manager another Director", async () => {
  const f = await fixture();
  expect(
    (await f.core.workBoard(f.D, f.firm.id, true)).matters.map((m) => m.id),
  ).toEqual([f.matter.id]);
  expect((await f.core.workBoard(f.A, f.firm.id)).role).toBe("LAWYER");
  await expect(f.core.workBoard(f.A, f.firm.id, true)).rejects.toThrow(
    "DIRECTOR_REQUIRED",
  );
  await expect(f.core.workBoard(f.O, f.firm.id, true)).rejects.toThrow(
    "ACCESS_DENIED",
  );
  await expect(
    f.core.grantParticipant(f.A, ...f.args, f.O, ["READ"]),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(f.core.reassignMatter(f.A, ...f.args, f.B, f.A)).rejects.toThrow(
    "DIRECTOR_REQUIRED",
  );
  await expect(
    f.core.addMember(f.A, f.firm.id, f.O, "ADMINISTRATOR"),
  ).rejects.toThrow("ACCESS_DENIED");
  await expect(
    f.core.addMember(f.D, f.firm.id, f.O, "ASSISTANT"),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(f.core.deactivateMember(f.D, f.firm.id, f.D)).rejects.toThrow(
    "LAST_ADMINISTRATOR",
  );
});
it("protects assignment, ownership and revisions even when a lawyer has MANAGE", async () => {
  const f = await fixture(),
    input = {
      title: "Preparar contrato",
      responsible_identity_id: f.A,
      internal_due_at: null,
    };
  const task = await f.core.createTask(f.D, ...f.args, input);
  await expect(
    f.core.updateTaskStatus(f.A, ...f.args, task.id, "CANCELLED"),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(
    f.core.createTask(f.A, ...f.args, {
      ...input,
      responsible_identity_id: f.B,
    }),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(
    f.core.reviseTask(f.A, ...f.args, task.id, input, 1),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(
    f.core.updateTaskStatus(f.B, ...f.args, task.id, "DONE"),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  const progress = await f.core.recordTaskProgress(
    f.A,
    ...f.args,
    task.id,
    "Falta antecedente",
    "BLOCKED",
  );
  expect(progress.progress?.[0]?.by).toBe(f.A);
  const reassigned = await f.core.reviseTask(
    f.D,
    ...f.args,
    task.id,
    { ...input, responsible_identity_id: f.B },
    1,
  );
  expect(reassigned.assignment_history).toHaveLength(2);
  expect(reassigned.assignment_history?.[0]?.responsible_identity_id).toBe(f.A);
  await expect(
    f.core.reviseTask(f.D, ...f.args, task.id, input, 1),
  ).rejects.toThrow("VERSION_CONFLICT");
  const own = await f.core.createTask(f.A, ...f.args, input);
  await f.core.reviseTask(
    f.A,
    ...f.args,
    own.id,
    { ...input, title: "Mi organización" },
    1,
  );
  await f.core.updateTaskStatus(f.A, ...f.args, own.id, "DONE");
  expect(
    (await f.core.workBoard(f.A, f.firm.id)).tasks.every(
      (t) => t.responsible_identity_id === f.A,
    ),
  ).toBe(true);
});
it("routes review requests through Direction and preserves the exact author/version", async () => {
  const f = await fixture(),
    draft = await f.core.prepareDraft(
      f.A,
      ...f.args,
      "Borrador",
      "Texto sintético original",
    );
  await expect(
    f.core.requestDraftReview(f.A, ...f.args, draft.id, f.B, null),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  const request = await f.core.requestDirection(f.A, ...f.args, {
    kind: "REVIEW",
    note: "Necesito revisión",
    draft_id: draft.id,
    target_task_id: null,
  });
  expect((await f.core.workBoard(f.B, f.firm.id)).requests).toEqual([]);
  await expect(
    f.core.resolveDirection(f.A, ...f.args, request.id, {
      decision: "ASSIGN",
      responsible_identity_id: f.B,
      internal_due_at: null,
      note: "Revisar",
    }),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(
    f.core.resolveDirection(f.D, ...f.args, request.id, {
      decision: "ASSIGN",
      responsible_identity_id: f.A,
      internal_due_at: null,
      note: "Revisar",
    }),
  ).rejects.toThrow("SELF_REVIEW_FORBIDDEN");
  const result = await f.core.resolveDirection(f.D, ...f.args, request.id, {
    decision: "ASSIGN",
    responsible_identity_id: f.B,
    internal_due_at: null,
    note: "Revisar versión recibida",
  });
  expect(result.request.status).toBe("DONE");
  expect(result.task?.kind).toBe("DRAFT_REVIEW");
  expect(result.task?.assigned_by).toBe(f.D);
  await expect(
    f.core.reviseTask(
      f.A,
      ...f.args,
      result.task!.id,
      { title: "Revisar", responsible_identity_id: f.B, internal_due_at: null },
      1,
    ),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  await expect(
    f.core.reviseTask(
      f.D,
      ...f.args,
      result.task!.id,
      { title: "Revisar", responsible_identity_id: f.A, internal_due_at: null },
      1,
    ),
  ).rejects.toThrow("SELF_REVIEW_FORBIDDEN");
  const reassigned = await f.core.reviseTask(
    f.D,
    ...f.args,
    result.task!.id,
    { title: "Revisar", responsible_identity_id: f.D, internal_due_at: null },
    1,
  );
  expect(reassigned.assignment_revision).toBe(2);
  expect(
    (await f.core.listMatterResources(f.D, ...f.args, "reviews"))[0]
      ?.reviewer_identity_id,
  ).toBe(f.D);
  expect(
    (await f.core.workBoard(f.D, f.firm.id, true)).drafts[0]
      ?.document_version_id,
  ).toBe(draft.document_version_id);
  await expect(
    f.core.resolveDirection(f.D, ...f.args, request.id, {
      decision: "ASSIGN",
      responsible_identity_id: f.B,
      internal_due_at: null,
      note: "Repetir",
    }),
  ).rejects.toThrow("REQUEST_ALREADY_RESOLVED");
});
it("requires actual rescheduling and reconfirmation before closing a request", async () => {
  const f = await fixture();
  const deadline: DeadlineInput = {
    category: "INTERNAL",
    origin: "Entrega acordada",
    source_version_id: null,
    rule: { mode: "MANUAL", date: "2026-11-01", time: "17:00" },
    reminders_hours: [24],
    escalation_identity_id: f.D,
    escalation_after_hours: 24,
  };
  const input = { title: "Entregar", responsible_identity_id: f.A, deadline };
  const task = await f.core.createDeadline(f.D, ...f.args, input);
  await f.core.confirmDeadline(f.A, ...f.args, task.id, 1);
  await expect(
    f.core.reviseDeadline(f.A, ...f.args, task.id, input, 1, "Mover"),
  ).rejects.toThrow("DIRECTOR_REQUIRED");
  const request = await f.core.requestDirection(f.A, ...f.args, {
    kind: "RESCHEDULE",
    note: "Falta informe",
    draft_id: null,
    target_task_id: task.id,
  });
  const resolution = {
    decision: "RESOLVED" as const,
    responsible_identity_id: null,
    internal_due_at: null,
    note: "Acordamos nueva fecha",
  };
  await expect(
    f.core.resolveDirection(f.D, ...f.args, request.id, resolution),
  ).rejects.toThrow("REQUEST_ACTION_REQUIRED");
  const revised = await f.core.reviseDeadline(
    f.D,
    ...f.args,
    task.id,
    {
      ...input,
      deadline: {
        ...deadline,
        rule: { mode: "MANUAL", date: "2026-11-03", time: "17:00" },
      },
    },
    1,
    "Nueva fecha acordada",
  );
  expect(currentDeadline(revised)?.confirmed_at).toBeNull();
  expect(revised.deadline?.versions).toHaveLength(2);
  await f.core.resolveDirection(f.D, ...f.args, request.id, resolution);
  await expect(
    f.core.requestDirection(f.A, ...f.args, {
      kind: "HELP",
      note: "Ayuda",
      draft_id: "foreign",
      target_task_id: null,
    }),
  ).rejects.toThrow("INVALID_INPUT");
});
it("denies inactive assignees and isolates the Director's authority to their firm", async () => {
  const f = await fixture();
  f.auth.deactivate(f.B);
  await expect(
    f.core.createTask(f.D, ...f.args, {
      title: "Inactivo",
      responsible_identity_id: f.B,
      internal_due_at: null,
    }),
  ).rejects.toThrow("INACTIVE_ASSIGNEE");
  const foreign = await f.core.createLawFirm(f.O, "Otro estudio");
  await expect(f.core.workBoard(f.D, foreign.id, true)).rejects.toThrow(
    "ACCESS_DENIED",
  );
});
it("rejects actor injection in management tools and requires read revisions", () => {
  expect(() =>
    managementRoute("firm", "study_work", {
      team: false,
      matter_id: null,
      actor_id: "Director",
    }),
  ).toThrow();
  expect(() =>
    managementRoute("firm", "assign_task", {
      mode: "EDIT",
      matter_id: "matter",
      task_id: "task",
      title: "Editar",
      responsible_identity_id: "a",
      due_at: null,
      expected_revision: null,
    }),
  ).toThrow();
});

it("migrates historical assignments once, preserving versions, authors and accounts; replays respect role removal", async () => {
  const db = await database();
  try {
    let raw: string | null = null;
    const store = new BrowserPersistence({
        getItem: () => raw,
        setItem: (_k, v) => {
          raw = v;
        },
      }),
      auth = new TestAuthenticator();
    for (const p of LOCAL_PROFILES) auth.register(p, p.id);
    const core = new OsCoreService(store, auth),
      legacy = LOCAL_PROFILES[0]!;
    const firm = await core.createLawFirm(legacy.id, "Migración sintética"),
      client = await core.createClient(legacy.id, firm.id, {
        kind: "PERSON",
        display_name: "Cliente",
        identification: null,
      });
    const matter = await core.createMatter(legacy.id, firm.id, {
      client_id: client.id,
      title: "Original",
      subject_area: "Civil",
      kind: "ADVISORY",
      responsible_identity_id: legacy.id,
      opened_on: "2026-10-19",
      closed_on: null,
    });
    await core.prepareDraft(
      legacy.id,
      firm.id,
      matter.id,
      "Contrato",
      "Contenido inmutable",
    );
    await core.createTask(legacy.id, firm.id, matter.id, {
      title: "Tarea histórica",
      responsible_identity_id: legacy.id,
      internal_due_at: null,
    });
    const director = {
        id: randomUUID(),
        subject: randomUUID(),
        display_name: "Director real",
        active: true,
      },
      lawyer = {
        id: randomUUID(),
        subject: randomUUID(),
        display_name: "Abogado real",
        active: true,
      };
    const platform = new LocalPlatform(db.pool);
    await platform.initialize();
    await platform.activate(store.exportBackup(), director);
    await expect(
      platform.command(
        director,
        [director],
        `/firms/${firm.id}/memberships/${director.id}/deactivation`,
        {},
        randomUUID(),
      ),
    ).rejects.toThrow("LAST_ADMINISTRATOR");
    const old = await platform.raw();
    delete old.hierarchy_version;
    for (const t of old.tables.tasks) {
      delete t.assigned_by;
      delete t.assignment_revision;
      delete t.assignment_history;
    }
    await db.pool.query(
      "UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",
      [old],
    );
    expect(await platform.hierarchyReady()).toBe(false);
    const migration = await platform.migrateHierarchy([director]);
    const next = await platform.raw();
    expect(migration.changed).toBe(true);
    expect(next.tables.documentVersions).toEqual(old.tables.documentVersions);
    expect(next.tables.drafts).toEqual(old.tables.drafts);
    expect(next.tables.memberships).toEqual(old.tables.memberships);
    expect(next.tables.tasks[0]?.assigned_by).toBe(legacy.id);
    expect((await platform.migrateHierarchy([director])).changed).toBe(false);
    const root = `/firms/${firm.id}`,
      path = root + `/matters/${matter.id}/tasks`,
      id = randomUUID(),
      directory = [director, lawyer];
    await platform.command(
      director,
      directory,
      root + "/memberships",
      { identity_id: lawyer.id, role: "LAWYER" },
      randomUUID(),
    );
    await platform.command(
      director,
      directory,
      root + `/matters/${matter.id}/participants`,
      { identity_id: lawyer.id, permissions: [...ALL_MATTER_PERMISSIONS] },
      randomUUID(),
    );
    const input = {
      title: "Encargo persistente",
      responsible_identity_id: lawyer.id,
      internal_due_at: null,
    };
    const result = await platform.command(director, directory, path, input, id);
    expect(
      (await platform.command(director, directory, path, input, id)).data,
    ).toEqual(result.data);
    const demoted = await platform.raw();
    demoted.tables.memberships.find(
      (m) => m.identity_id === director.id,
    )!.role = "LAWYER";
    await db.pool.query(
      "UPDATE os_private.platform_state SET snapshot=$1 WHERE id=true",
      [demoted],
    );
    await expect(
      platform.command(director, directory, path, input, id),
    ).rejects.toThrow("DIRECTOR_REQUIRED");
  } finally {
    await db.close();
  }
});
