import { expect, it } from "vitest";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import { Pool } from "pg";
import { chromium, expect as browserExpect } from "@playwright/test";
import { database } from "./fixtures.js";
import {
  BrowserPersistence,
  LOCAL_PROFILES,
  STORAGE_KEY,
  parseSnapshot,
} from "../../apps/web/src/local-storage.js";
import { executeCoreCommand } from "../../apps/web/src/local-commands.js";
import {
  WorkspaceRepository,
  LocalWorkspaceBlobs,
} from "../../apps/api/src/workspace.js";
import type { Authenticator } from "../../os-core/src/contracts.js";
import { LocalPlatform } from "../../apps/api/src/local-platform.js";
// @ts-expect-error Local native host.
import { createPlatformBridge } from "../../scripts/platform-bridge.mjs";
// @ts-expect-error Local native host.
import { createWorkspaceBridge } from "../../scripts/workspace-bridge.mjs";
// @ts-expect-error Local backup tools.
import * as backupTools from "../../scripts/platform-backup.mjs";
const { createPlatformBackup, restorePlatformBackup, verifyPlatformBackup } =
  backupTools;

it("does not expose the client directory through the cache of an administration account", async () => {
  let raw: string | null = null;
  const store = new BrowserPersistence({
      getItem: () => raw,
      setItem: (_k, v) => {
        raw = v;
      },
    }),
    actor = LOCAL_PROFILES[0];
  const auth: Authenticator = {
    authenticate: async (id) => ({
      identity_id: id,
      subject: id,
      session_id: "fixture",
      expires_at: "2999-01-01T00:00:00.000Z",
    }),
    identity: async (id) => LOCAL_PROFILES.find((p) => p.id === id) ?? null,
  };
  const command = (path: string, body?: unknown) =>
    executeCoreCommand(store, actor, auth, path, body);
  const firm: any = await command("/firms", { name: "Estudio privado" });
  const client: any = await command(`/firms/${firm.id}/clients`, {
    kind: "PERSON",
    display_name: "Nombre reservado del cliente",
    identification: "IDENTIFICACION-PRIVADA",
  });
  await command(`/firms/${firm.id}/clients`, {
    kind: "PERSON",
    display_name: "Cliente ajeno al asunto",
    identification: null,
  });
  const matter: any = await command(`/firms/${firm.id}/matters`, {
    client_id: client.id,
    title: "Asunto visible",
    kind: "ADVISORY",
    subject_area: "Contratos",
    responsible_identity_id: actor.id,
    opened_on: "2026-10-18",
    closed_on: null,
  });
  const state = store.snapshot(),
    now = new Date().toISOString(),
    person = {
      id: randomUUID(),
      subject: "",
      display_name: "Administración",
      active: true,
    };
  person.subject = person.id;
  state.identities = [person];
  state.tables.memberships.push({
    id: randomUUID(),
    law_firm_id: firm.id,
    identity_id: person.id,
    role: "ADMINISTRATION",
    active: true,
    created_at: now,
  });
  const platform = new LocalPlatform({} as Pool);
  expect(
    (await platform.view(person, [person], state)).snapshot.tables.clients,
  ).toEqual([]);
  state.tables.participants.push({
    id: randomUUID(),
    law_firm_id: firm.id,
    matter_id: matter.id,
    identity_id: person.id,
    permissions: ["READ"],
    active: true,
    created_at: now,
  });
  const cache = (await platform.view(person, [person], state)).snapshot;
  expect(cache.tables.matters.map((m) => m.id)).toEqual([matter.id]);
  expect(cache.tables.clients).toHaveLength(1);
  expect(cache.tables.clients[0]).toMatchObject({
    id: client.id,
    display_name: "Cliente reservado",
    identification: null,
  });
  expect(JSON.stringify(cache)).not.toContain("IDENTIFICACION-PRIVADA");
  expect(JSON.stringify(cache)).not.toContain("Cliente ajeno al asunto");
  expect(state.tables.clients[0]?.display_name).toBe(
    "Nombre reservado del cliente",
  );
});

it("migrates without rewriting originals, authenticates real users, enforces live permissions and restores a verified local backup", async () => {
  const db = await database(),
    root = resolve(".local-dev/platform-tests", randomUUID());
  await mkdir(root, { recursive: true });
  const originalConfig = JSON.parse(
    await readFile(".local-dev/app-config.json", "utf8"),
  );
  const url = new URL(originalConfig.auth_database_url);
  url.pathname = "/" + db.name;
  const runtimeUrl = new URL(originalConfig.database_url);
  runtimeUrl.pathname = "/" + db.name;
  const config = { auth_database_url: url.href, database_url: runtimeUrl.href };
  await mkdir(resolve(root, ".local-dev"), { recursive: true });
  await writeFile(
    resolve(root, ".local-dev/app-config.json"),
    JSON.stringify(config),
  );
  let raw: string | null = null;
  const store = new BrowserPersistence({
    getItem: () => raw,
    setItem: (_k, v) => {
      raw = v;
    },
  });
  const actor = LOCAL_PROFILES[0];
  const auth: Authenticator = {
    authenticate: async (id) => ({
      identity_id: id,
      subject: id,
      session_id: "fixture",
      expires_at: "2999-01-01T00:00:00.000Z",
    }),
    identity: async (id) => LOCAL_PROFILES.find((p) => p.id === id) ?? null,
  };
  const cmd = (path: string, body?: unknown) =>
    executeCoreCommand(store, actor, auth, path, body);
  const firm: any = await cmd("/firms", { name: "Estudio de prueba central" });
  const client: any = await cmd(`/firms/${firm.id}/clients`, {
    kind: "ORGANIZATION",
    display_name: "Cliente sintético",
    identification: null,
  });
  const matter: any = await cmd(`/firms/${firm.id}/matters`, {
    client_id: client.id,
    title: "Contrato sintético central",
    kind: "ADVISORY",
    subject_area: "Contratos",
    responsible_identity_id: actor.id,
    opened_on: "2026-10-18",
    closed_on: null,
  });
  const prefix = `/firms/${firm.id}/matters/${matter.id}`;
  const draft: any = await cmd(prefix + "/drafts", {
    title: "Contrato central",
    content: "Cláusula sintética. Precio pactado: 100. Original conservado.",
  });
  const original = store.snapshot(),
    originalVersion = original.tables.documentVersions[0]!;
  let platform: any, workspace: any, browser: any;
  const server = createServer(async (req, res) => {
    try {
      if (
        (await platform.handle(req, res)) ||
        (await platform.gate(req, res)) ||
        (await workspace.handle(req, res))
      )
        return;
      const path = new URL(req.url!, "http://localhost").pathname;
      if (path.startsWith("/local/")) {
        res.writeHead(404);
        res.end();
        return;
      }
      const file = resolve(
        "dist/web",
        "." + (extname(path) ? path : "/index.html"),
      );
      res.setHeader(
        "Content-Type",
        (
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".html": "text/html",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream",
      );
      const bytes = await readFile(file);
      res.end(
        extname(file) === ".html"
          ? bytes
              .toString("utf8")
              .replace(
                "<head>",
                '<head><meta name="law-order-platform" content="local-accounts-v1">',
              )
          : bytes,
      );
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  await mkdir(resolve(root,"phase2/reports"),{recursive:true});
  await writeFile(resolve(root,"phase2/reports/model-connectivity-standard-prices.json"),JSON.stringify([{model_id:"gpt-6-luna",mode:"STANDARD",as_of_date:new Date().toISOString().slice(0,10),input_per_million_usd:0.1,output_per_million_usd:0.5}]));
  const sessionProviderCalls:string[]=[];
  platform = createPlatformBridge(root, origin, {
    pool: db.pool,
    config,
    aiConfiguration:{approval:{enabled:true,max_cost_usd:0.6},env:{OPENAI_API_KEY:"synthetic-session-key",OPENAI_LUNA_MODEL:"gpt-6-luna"}},
    aiTransport:async(url:string)=>{sessionProviderCalls.push(url);if(url.includes("/models/"))return Response.json({id:"gpt-6-luna"});if(url.endsWith("/audio/transcriptions"))return Response.json({text:"Acuerdo: revisar las condiciones.",usage:{input_tokens:10,output_tokens:8}});return Response.json({model:"gpt-6-luna",status:"completed",usage:{input_tokens:80,output_tokens:60},output:[{content:[{type:"output_text",text:JSON.stringify({summary:"Se revisaran las condiciones.",agreements:[{statement:"Revisar las condiciones",evidence_quote:"Acuerdo: revisar las condiciones."}],disagreements:[],actions:[{statement:"Revisar las condiciones",evidence_quote:"Acuerdo: revisar las condiciones."}]})}]}]})},
    onError: (e: Error & { code?: string }) => {
      if (e.code && /^\d/.test(e.code))
        console.error("Platform database error", e.code, e.message);
    },
  });
  const repository = new WorkspaceRepository(
    new Pool({ connectionString: url.href }),
    new Pool({ connectionString: runtimeUrl.href }),
    new LocalWorkspaceBlobs(resolve(root, ".local-dev/workspace-objects")),
    platform.authenticator,
  );
  workspace = createWorkspaceBridge(root, origin, {
    repository,
    platform,
    runAI: () => {
      throw Error("LIVE_AI_NOT_AUTHORIZED_BY_TEST");
    },
  });
  workspace.attach(server);
  const post = async (path: string, body: unknown, cookie?: string) =>
    fetch(origin + path, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-Platform": "1",
        "X-Workspace": "1",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  const password = "Fixture-local-" + randomUUID();
  async function login(email: string) {
    const r = await post("/local/auth/sign-in/email", { email, password });
    expect(r.status, await r.clone().text()).toBe(200);
    return r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }
  const state = async (cookie: string) =>
    (
      await fetch(origin + "/local/platform/state", {
        headers: { Cookie: cookie },
      })
    ).json();
  const core = async (
    cookie: string,
    path: string,
    body?: unknown,
    id = randomUUID(),
  ) => {
    const r = await post(
      "/local/platform/core",
      { path, body, command_id: id },
      cookie,
    );
    return { status: r.status, result: await r.json() };
  };
  try {
    expect(
      (await (await fetch(origin + "/local/platform/status")).json()).enabled,
    ).toBe(false);
    const legacyAdoption = await post("/local/workspace/adopt", {
      actor_id: actor.id,
      synthetic_data: true,
      firm,
      client,
      matter,
      draft,
      document: original.tables.documents[0],
      version: originalVersion,
      memberships: original.tables.memberships,
      participants: original.tables.participants,
    });
    expect(legacyAdoption.status, await legacyAdoption.clone().text()).toBe(
      200,
    );
    const legacyAccess = await legacyAdoption.json();
    const corrupted = structuredClone(original);
    corrupted.tables.documentVersions[0]!.sha256 = "0".repeat(64);
    expect(
      (
        await post("/local/platform/activate", {
          name: "Titular prueba",
          email: "owner@law.invalid",
          password,
          snapshot: JSON.stringify(corrupted),
        })
      ).status,
    ).toBe(400);
    expect(
      (await db.pool.query('SELECT count(*)::int count FROM os_auth."user"'))
        .rows[0].count,
    ).toBe(0);
    browser = await chromium.launch({ channel: "msedge", headless: true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"] });
    const setupContext = await browser.newContext(),
      setupPage = await setupContext.newPage();
    await setupContext.route("**/*", (route: any) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    await setupContext.addInitScript(
      ({ key, value }: { key: string; value: string }) =>
        localStorage.setItem(key, value),
      { key: STORAGE_KEY, value: raw! },
    );
    await setupPage.goto(origin);
    await setupPage
      .getByRole("button", { name: "Administración", exact: true })
      .click();
    await setupPage
      .getByRole("button", {
        name: "Configurar mi cuenta y centralizar",
        exact: true,
      })
      .click();
    await setupPage
      .getByLabel("Tu nombre", { exact: true })
      .fill("Titular prueba");
    await setupPage
      .getByLabel("Correo de acceso", { exact: true })
      .fill("owner@law.invalid");
    await setupPage
      .getByLabel("Contraseña · mínimo 12 caracteres", { exact: true })
      .fill(password);
    await setupPage
      .getByLabel("Repetir contraseña", { exact: true })
      .fill(password);
    const activated = setupPage.waitForResponse((r: any) =>
      r.url().endsWith("/local/platform/activate"),
    );
    await setupPage
      .getByRole("button", {
        name: "Activar y conservar mis datos",
        exact: true,
      })
      .click();
    expect((await activated).status()).toBe(200);
    await browserExpect(
      setupPage.getByRole("heading", {
        name: "Ingresar al estudio",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await setupPage.evaluate(
        (key: string) => JSON.parse(localStorage.getItem(key)!),
        STORAGE_KEY,
      ),
    ).toEqual(original);
    await setupContext.close();
    expect(store.snapshot()).toEqual(original);
    expect((await fetch(origin + "/local/platform/state")).status).toBe(401);
    expect(
      (
        await post("/local/auth/sign-up/email", {
          email: "open@law.invalid",
          password,
          name: "No",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post("/local/auth/sign-in/email", {
          email: "owner@law.invalid",
          password: "incorrecta",
        })
      ).status,
    ).not.toBe(200);
    const owner = await login("owner@law.invalid"),
      migrated = await state(owner);
    expect(migrated.identity.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(migrated.snapshot.tables.documentVersions[0]).toEqual(
      originalVersion,
    );
    expect(migrated.snapshot.tables.drafts[0].author_identity_id).toBe(
      actor.id,
    );
    const crossOrigin = await fetch(origin + "/local/platform/core", {
      method: "POST",
      headers: {
        Origin: "https://external.invalid",
        "X-Platform": "1",
        "Content-Type": "application/json",
        Cookie: owner,
      },
      body: JSON.stringify({ path: "/session" }),
    });
    expect(crossOrigin.status).toBe(403);
    const invitation = await (
      await post(
        "/local/platform/invite",
        { email: "lawyer@law.invalid", firm_id: firm.id, role: "LAWYER" },
        owner,
      )
    ).json();
    const token = new URL(invitation.link).hash.slice("#invitation=".length);
    expect(
      (
        await post("/local/platform/accept-invitation", {
          token,
          name: "Abogada prueba",
          password,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post("/local/platform/accept-invitation", {
          token,
          name: "Repetida",
          password,
        })
      ).status,
    ).toBe(400);
    const lawyer = await login("lawyer@law.invalid"),
      lawState = await state(lawyer);
    expect(lawState.snapshot.tables.matters).toHaveLength(0);
    expect(lawState.snapshot.tables.documentVersions).toHaveLength(0);
    expect((await core(lawyer, prefix + "/drafts")).status).not.toBe(200);
    expect((await post("/local/platform/backup", {}, lawyer)).status).toBe(400);
    const permissions = ["READ", "DRAFT_WRITE", "DRAFT_REVIEW", "TASK_WRITE"];
    expect(
      (
        await core(owner, prefix + "/participants", {
          identity_id: lawState.identity.id,
          permissions,
        })
      ).status,
    ).toBe(200);
    expect((await core(lawyer, prefix + "/drafts")).result.data[0].id).toBe(
      draft.id,
    );
    const invitationB = await (
      await post(
        "/local/platform/invite",
        { email: "reviewer@law.invalid", firm_id: firm.id, role: "LAWYER" },
        owner,
      )
    ).json();
    expect(
      (
        await post("/local/platform/accept-invitation", {
          token: new URL(invitationB.link).hash.slice("#invitation=".length),
          name: "Abogado B",
          password,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(
          "/local/platform/invite",
          {
            email: "forbidden@law.invalid",
            firm_id: firm.id,
            role: "ADMINISTRATOR",
          },
          lawyer,
        )
      ).status,
    ).not.toBe(200);
    const commandId = randomUUID();
    const a = await core(
      owner,
      `/firms/${firm.id}/clients`,
      { kind: "PERSON", display_name: "Comando único", identification: null },
      commandId,
    );
    const b = await core(
      owner,
      `/firms/${firm.id}/clients`,
      { kind: "PERSON", display_name: "Comando único", identification: null },
      commandId,
    );
    expect(a.result.data.id).toBe(b.result.data.id);
    expect(
      (
        await core(
          owner,
          `/firms/${firm.id}/clients`,
          { kind: "PERSON", display_name: "Distinto", identification: null },
          commandId,
        )
      ).status,
    ).toBe(400);
    const seed = (s: any) => ({
      actor_id: s.identity.id,
      synthetic_data: true,
      firm,
      client,
      matter,
      draft,
      document: s.snapshot.tables.documents[0],
      version: originalVersion,
      memberships: s.snapshot.tables.memberships,
      participants: s.snapshot.tables.participants,
    });
    const adopted = await post(
      "/local/workspace/adopt",
      seed(await state(owner)),
      owner,
    );
    expect(adopted.status, await adopted.clone().text()).toBe(200);
    const access = await adopted.json();
    expect(access.room.id).toBe(legacyAccess.room.id);
    const lawyerAdoption = await post(
      "/local/workspace/adopt",
      seed(await state(lawyer)),
      lawyer,
    );
    expect(lawyerAdoption.status, await lawyerAdoption.clone().text()).toBe(
      200,
    );
    const lawAccess = await lawyerAdoption.json();
    expect(
      (
        await fetch(origin + `/local/workspace/rooms/${access.room.id}`, {
          headers: { Cookie: lawyer, Authorization: "Bearer " + access.token },
        })
      ).status,
    ).toBe(403);
    // Browser flow uses real cookies, server state and the existing editor UI.
    expect(
      (
        await post("/local/auth/sign-in/email", {
          email: "owner@law.invalid",
          password,
        })
      ).status,
    ).toBe(429);
    // The real sign-in protection is three attempts per ten seconds. Do not relax it for tests.
    await new Promise((r) => setTimeout(r, 10500));
    browser ??= await chromium.launch({ channel: "msedge", headless: true });
    const contexts = await Promise.all([
      browser.newContext({permissions:["microphone"]}),
      browser.newContext({permissions:["microphone"]}),
    ]);
    const pages = await Promise.all(contexts.map((c: any) => c.newPage()));
    const errors: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      pages[i].on("pageerror", (e: Error) => errors.push(e.message));
      pages[i].on("response", async (r: any) => {
        if (r.url().includes("/local/auth/") && !r.ok())
          console.error("Auth browser status", r.status(), await r.text());
      });
      await contexts[i].route("**/*", (route: any) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      await pages[i].goto(origin);
      await pages[i]
        .getByLabel("Correo", { exact: true })
        .fill(i === 0 ? "owner@law.invalid" : "lawyer@law.invalid");
      await pages[i].getByLabel("Contraseña", { exact: true }).fill(password);
      await pages[i]
        .getByRole("button", { name: "Ingresar", exact: true })
        .click();
      await browserExpect(
        pages[i].getByRole("button", { name: "Salir", exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await browserExpect(pages[i].getByLabel("Perfil de prueba")).toHaveCount(
        0,
      );
      await pages[i].goto(
        `${origin}/?workspace=${access.room.id}#access=${i === 0 ? access.token : lawAccess.token}`,
      );
      await browserExpect(
        pages[i].locator(".tiptap[contenteditable=true]"),
      ).toContainText("Original conservado", { timeout: 20000 });
    }
    // Stage 2.1: three real, independent sessions, no external AI/network calls.
    const contextB = await browser.newContext(),
      pageB = await contextB.newPage();
    await contextB.route("**/*", (route: any) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    pageB.on("pageerror", (e: Error) => errors.push(e.message));
    await pageB.goto(origin);
    await pageB
      .getByLabel("Correo", { exact: true })
      .fill("reviewer@law.invalid");
    await pageB.getByLabel("Contraseña", { exact: true }).fill(password);
    await pageB.getByRole("button", { name: "Ingresar", exact: true }).click();
    await browserExpect(
      pageB.getByRole("button", { name: "Salir", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    const cookieB = (await contextB.cookies(origin))
      .map((c: any) => `${c.name}=${c.value}`)
      .join("; ");
    const stateB = await state(cookieB);
    expect(
      (
        await core(owner, prefix + "/participants", {
          identity_id: stateB.identity.id,
          permissions,
        })
      ).status,
    ).toBe(200);
    const teamPage = await contexts[0].newPage(),
      myPage = await contexts[1].newPage();
    for (const page of [teamPage, myPage]) {
      page.on("pageerror", (e: Error) => errors.push(e.message));
      await page.goto(origin);
      await page.getByRole("button", { name: "Agenda", exact: true }).click();
    }
    await browserExpect(
      teamPage.getByText("Dirección del despacho", { exact: true }).last(),
    ).toBeVisible();
    await teamPage
      .getByRole("button", { name: "Asignar tarea", exact: true })
      .click();
    await teamPage
      .getByLabel("Trabajo a realizar", { exact: true })
      .fill("Preparar entrega del equipo");
    await teamPage
      .getByLabel("Abogado responsable", { exact: true })
      .selectOption(lawState.identity.id);
    await teamPage
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    const assigned = (
      await core(owner, `/firms/${firm.id}/work/team`)
    ).result.data.tasks.find(
      (t: any) => t.title === "Preparar entrega del equipo",
    );
    expect(assigned.assigned_by).toBe(migrated.identity.id);
    await myPage.reload();
    await myPage.getByRole("button", { name: "Agenda", exact: true }).click();
    const received = myPage
      .locator(".agenda-entry")
      .filter({ hasText: "Preparar entrega del equipo" });
    await browserExpect(received).toBeVisible();
    await browserExpect(
      received.getByRole("button", { name: "Modificar encargo", exact: true }),
    ).toHaveCount(0);
    await received
      .locator(".work-progress > summary")
      .filter({ hasText: "Avances" })
      .click();
    await received
      .getByRole("button", { name: "Registrar avance / bloqueo", exact: true })
      .click();
    await received
      .getByLabel("Avance o impedimento", { exact: true })
      .fill("Necesito un antecedente");
    await received.getByLabel("Necesito resolver un bloqueo").check();
    await received
      .getByRole("button", { name: "Guardar avance", exact: true })
      .click();
    await browserExpect(received).toContainText("Necesito un antecedente");
    expect(
      (
        await core(lawyer, prefix + "/tasks", {
          title: "Delegación prohibida",
          responsible_identity_id: stateB.identity.id,
          internal_due_at: null,
        })
      ).status,
    ).not.toBe(200);
    await myPage
      .getByRole("button", { name: "Solicitar a Dirección", exact: true })
      .click();
    await myPage
      .getByLabel("Qué necesitás y por qué", { exact: true })
      .fill("Necesito apoyo para los anexos");
    await myPage.getByRole("button", { name: "Guardar", exact: true }).click();
    await teamPage.reload();
    await teamPage.getByRole("button", { name: "Agenda", exact: true }).click();
    await teamPage
      .getByRole("button", { name: "Atender solicitud", exact: true })
      .click();
    await teamPage
      .getByLabel("Abogado responsable", { exact: true })
      .selectOption(stateB.identity.id);
    await teamPage
      .getByLabel("Encargo o motivo de la decisión", { exact: true })
      .fill("Revisar anexos del contrato");
    await teamPage
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await pageB.getByRole("button", { name: "Agenda", exact: true }).click();
    const intervention = pageB
      .locator(".agenda-entry")
      .filter({ hasText: "Revisar anexos del contrato" });
    await browserExpect(intervention).toBeVisible();
    // Gabriel's existing floating avatar can be moved with its keyboard controls.
    for (let i = 0; i < 12; i++)
      await pageB
        .getByRole("button", { name: "Hablar con Gabriel", exact: true })
        .press("ArrowLeft");
    await intervention
      .getByRole("button", { name: "Completar", exact: true })
      .click();
    const authored = await core(lawyer, prefix + "/drafts", {
      title: "Borrador de la abogada",
      content: "Versión sintética para revisión independiente.",
    });
    expect(authored.status).toBe(200);
    await myPage.getByRole("button", { name: "Asuntos", exact: true }).click();
    await myPage
      .locator("article")
      .filter({
        has: myPage.getByRole("heading", { name: matter.title, exact: true }),
      })
      .getByRole("button", { name: "Abrir asunto →", exact: true })
      .click();
    await myPage.getByRole("button", { name: /Volver al asunto/ }).click();
    await myPage.getByRole("tab", { name: "Borradores", exact: true }).click();
    await myPage
      .getByRole("row")
      .filter({ hasText: "Borrador de la abogada" })
      .getByRole("button", { name: "Solicitar revisión", exact: true })
      .click();
    await browserExpect(
      myPage.getByRole("heading", {
        name: "Solicitar intervención a Dirección",
        exact: true,
      }),
    ).toBeVisible();
    await browserExpect(
      myPage.getByLabel("Revisor distinto del autor", { exact: true }),
    ).toHaveCount(0);
    await myPage
      .getByLabel("Qué necesitás y por qué", { exact: true })
      .fill("Solicito revisión independiente de esta versión");
    await myPage.getByRole("button", { name: "Guardar", exact: true }).click();
    await teamPage.reload();
    await teamPage.getByRole("button", { name: "Agenda", exact: true }).click();
    await teamPage
      .getByRole("button", { name: "Atender solicitud", exact: true })
      .click();
    await teamPage
      .getByLabel("Abogado responsable", { exact: true })
      .selectOption(stateB.identity.id);
    await teamPage
      .getByLabel("Encargo o motivo de la decisión", { exact: true })
      .fill("Revisar la versión recibida");
    await teamPage
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await pageB.reload();
    await pageB.getByRole("button", { name: "Mi día", exact: true }).click();
    await browserExpect(
      pageB
        .locator(".agenda-entry")
        .filter({ hasText: "Revisar borrador documental" }),
    ).toBeVisible();
    await expect(
      platform.managementTool(
        { cookie: lawyer },
        firm.id,
        "assign_review",
        {
          matter_id: matter.id,
          draft_id: authored.result.data.id,
          expected_version_id: authored.result.data.document_version_id,
          reviewer_identity_id: stateB.identity.id,
          due_at: null,
        },
        randomUUID(),
      ),
    ).rejects.toThrow("DIRECTOR_REQUIRED");
    // Text host and voice tools execute the same session-bound canonical commands.
    const toolArgs = {
      mode: "CREATE",
      matter_id: matter.id,
      task_id: null,
      title: "Encargo de Gabriel",
      responsible_identity_id: stateB.identity.id,
      due_at: null,
      expected_revision: null,
    };
    const toolId = randomUUID();
    const toolTask = await platform.managementTool(
      { cookie: owner },
      firm.id,
      "assign_task",
      toolArgs,
      toolId,
    );
    expect(
      (
        await platform.managementTool(
          { cookie: owner },
          firm.id,
          "assign_task",
          toolArgs,
          toolId,
        )
      ).id,
    ).toBe(toolTask.id);
    await expect(
      platform.managementTool(
        { cookie: lawyer },
        firm.id,
        "assign_task",
        toolArgs,
        randomUUID(),
      ),
    ).rejects.toThrow("DIRECTOR_REQUIRED");
    const ownTool = await platform.managementTool(
      { cookie: lawyer },
      firm.id,
      "assign_task",
      {
        ...toolArgs,
        title: "Tarea propia por voz",
        responsible_identity_id: lawState.identity.id,
      },
      randomUUID(),
    );
    expect(ownTool.assigned_by).toBe(lawState.identity.id);
    await mkdir("local-browser/reports/platform-local", { recursive: true });
    await teamPage.screenshot({
      path: "local-browser/reports/platform-local/director-team.png",
      fullPage: true,
    });
    await myPage.screenshot({
      path: "local-browser/reports/platform-local/lawyer-work.png",
      fullPage: true,
    });
    await teamPage.close();
    await myPage.close();
    await contextB.close();
    // Stage 2: a real owner records and confirms a deadline; the escalation recipient sees it in Mi día.
    const deadlinePage = await contexts[0].newPage();
    deadlinePage.on("pageerror", (e: Error) => errors.push(e.message));
    await deadlinePage.goto(origin);
    await deadlinePage
      .getByRole("button", { name: "Asuntos", exact: true })
      .click();
    await deadlinePage
      .locator("article")
      .filter({
        has: deadlinePage.getByRole("heading", {
          name: matter.title,
          exact: true,
        }),
      })
      .getByRole("button", { name: "Abrir asunto →", exact: true })
      .click();
    await deadlinePage
      .getByRole("button", { name: /Volver al asunto/ })
      .click();
    await deadlinePage
      .getByRole("tab", { name: "Tareas", exact: true })
      .click();
    await deadlinePage
      .getByRole("button", { name: "Nueva tarea o plazo", exact: true })
      .click();
    await deadlinePage
      .getByLabel("Próxima acción", { exact: true })
      .fill("Contestar notificación de prueba");
    await deadlinePage
      .getByLabel("Responsable", { exact: true })
      .selectOption(lawState.identity.id);
    await deadlinePage.getByLabel("Tipo de plazo").selectOption("JUDICIAL");
    await deadlinePage
      .getByLabel("Origen del plazo")
      .fill("Notificación sintética; fecha pasada para comprobar avisos");
    await deadlinePage
      .getByLabel("Documento de respaldo (opcional)")
      .selectOption(originalVersion.id);
    await deadlinePage
      .getByLabel("Fecha de vencimiento", { exact: true })
      .fill("2020-01-02");
    await deadlinePage.getByLabel("Hora límite · Paraguay").fill("17:00");
    await deadlinePage
      .getByLabel("Escalar vencimiento a")
      .selectOption(migrated.identity.id);
    await deadlinePage
      .getByLabel("Escalar después de vencido (horas)")
      .fill("1");
    await deadlinePage
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    const deadlineEntry = deadlinePage
      .locator(".agenda-entry")
      .filter({ hasText: "Contestar notificación de prueba" });
    await browserExpect(deadlineEntry).toContainText(
      "Pendiente de confirmación",
    );
    await deadlineEntry.locator(".deadline-details > summary").click();
    const sourceDownload = deadlinePage.waitForEvent("download");
    await deadlineEntry
      .getByRole("button", {
        name: "Descargar versión de respaldo",
        exact: true,
      })
      .click();
    const sourceFile = await (await sourceDownload).path();
    expect(await readFile(sourceFile!, "utf8")).toContain(
      "Original conservado",
    );
    await deadlineEntry
      .getByLabel("Revisé el origen, el calendario y el vencimiento")
      .check();
    await deadlineEntry
      .getByRole("button", {
        name: "Confirmar plazo y activar avisos",
        exact: true,
      })
      .click();
    await browserExpect(deadlineEntry).toContainText("Confirmado");
    await deadlinePage
      .getByRole("button", { name: "Mi día", exact: true })
      .click();
    await browserExpect(
      deadlinePage.getByRole("region", { name: "Avisos de plazos" }),
    ).toContainText("Requiere seguimiento");
    await deadlinePage
      .getByRole("button", { name: "Reconocer aviso", exact: true })
      .click();
    await browserExpect(
      deadlinePage.getByRole("region", { name: "Avisos de plazos" }),
    ).toContainText("Sin avisos pendientes");
    // The Director receives the supervision alert; the responsible lawyer receives overdue notice.
    const escalationPage = await contexts[1].newPage();
    await escalationPage.goto(origin);
    await escalationPage
      .getByRole("button", { name: "Mi día", exact: true })
      .click();
    await browserExpect(
      escalationPage.getByRole("region", { name: "Avisos de plazos" }),
    ).toContainText("Plazo vencido");
    await mkdir(resolve("local-browser/reports/platform-local"), {
      recursive: true,
    });
    await escalationPage.screenshot({
      path: resolve(
        "local-browser/reports/platform-local/deadline-escalation.png",
      ),
      fullPage: true,
    });
    await deadlinePage.close();
    await escalationPage.close();
    await pages[0]
      .getByRole("button", { name: "Compartir", exact: true })
      .click();
    await pages[0]
      .locator(".workspace-share select")
      .selectOption(lawState.identity.id);
    await pages[0]
      .getByRole("checkbox", { name: "Enlace de solo lectura", exact: true })
      .check();
    await pages[0]
      .getByRole("button", { name: "Crear enlace local", exact: true })
      .click();
    const readOnlyLink = await pages[0]
      .locator(".workspace-share-link input")
      .inputValue();
    expect(readOnlyLink).toContain("#access=");
    expect(
      (await state(owner)).snapshot.tables.participants.find(
        (p: any) => p.identity_id === lawState.identity.id,
      ).permissions,
    ).toEqual(permissions);
    const readOnlyPage = await contexts[1].newPage();
    await readOnlyPage.goto(readOnlyLink);
    await browserExpect(readOnlyPage.locator(".tiptap")).toHaveAttribute(
      "contenteditable",
      "false",
    );
    await readOnlyPage.close();
    await pages[0]
      .locator(".tiptap[contenteditable=true]")
      .press("Control+End");
    await pages[0]
      .locator(".tiptap[contenteditable=true]")
      .pressSequentially(" Edición humana sincronizada.");
    await browserExpect(pages[1].locator(".tiptap")).toContainText(
      "Edición humana sincronizada",
      { timeout: 20000 },
    );
    await browserExpect(
      pages[0].getByText("Guardado en servidor local", { exact: true }),
    ).toBeVisible();
    await pages[0]
      .getByRole("button", { name: "Registrar versión", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state(owner)).snapshot.tables.documentVersions
            .map((v: any) =>
              Buffer.from(v.original_base64, "base64").toString("utf8"),
            )
            .join("\n"),
        { timeout: 15000 },
      )
      .toContain("Edición humana sincronizada");
    // Two authenticated collaborators record real browser MediaRecorder audio,
    // with fake microphone input. No audio is sent to an AI provider.
    for(const page of pages){await page.getByRole("button",{name:"Llamada del documento",exact:true}).click();await page.getByRole("button",{name:"Unirse a la llamada",exact:true}).click();}
    await pages[0].getByRole("button",{name:"Solicitar grabación de audio",exact:true}).click();
    for(const page of pages)await page.getByRole("button",{name:"Acepto la grabación",exact:true}).click();
    await browserExpect(pages[1].getByText("● Grabando audio de la sesión",{exact:true})).toBeVisible();
    await new Promise(r=>setTimeout(r,1200));
    await pages[1].getByRole("button",{name:"Detener grabación",exact:true}).click();
    await expect.poll(async()=>{const result=await core(owner,`/firms/${firm.id}/practice`);return result.result.data.records.filter((r:any)=>r.payload.type==="RECORDING").length},{timeout:15000}).toBeGreaterThan(0);
    const recording=(await core(owner,`/firms/${firm.id}/practice`)).result.data.records.find((r:any)=>r.payload.type==="RECORDING");
    const recordingDownload=await post("/local/platform/recording-download",{firm:firm.id,recording_id:recording.id},owner);expect(recordingDownload.status).toBe(200);expect(Buffer.from((await recordingDownload.json()).base64,"base64").length).toBeGreaterThan(100);
    expect(recording.payload.mime).toBe("audio/wav");
    const transcribeId=randomUUID(),transcribed=await platform.managementTool({cookie:owner},firm.id,"transcribe_session",{session_id:recording.payload.session_id,budget_usd:0.6},transcribeId);
    expect(transcribed.created_transcripts).toHaveLength(1);
    const callsBeforeReuse=sessionProviderCalls.length;await platform.managementTool({cookie:owner},firm.id,"transcribe_session",{session_id:recording.payload.session_id,budget_usd:0.6},transcribeId);expect(sessionProviderCalls).toHaveLength(callsBeforeReuse);
    const transcript=(await core(owner,`/firms/${firm.id}/practice`)).result.data.records.find((r:any)=>r.id===transcribed.created_transcripts[0]);
    expect((await core(owner,`/firms/${firm.id}/practice/accept_transcript`,{record_id:transcript.id,expected_revision:transcript.revision})).status).toBe(200);
    const actId=randomUUID(),act=await platform.managementTool({cookie:owner},firm.id,"session_minutes",{session_id:recording.payload.session_id,budget_usd:0.6},actId);expect(act.record.payload.status).toBe("PROPOSED");expect(act.record.payload.actions[0].task_id).toBeNull();
    const callsBeforeActReuse=sessionProviderCalls.length;await platform.managementTool({cookie:owner},firm.id,"session_minutes",{session_id:recording.payload.session_id,budget_usd:0.6},actId);expect(sessionProviderCalls).toHaveLength(callsBeforeActReuse);
    for(const page of pages)await page.getByRole("button",{name:"Salir de la llamada",exact:true}).last().click();
    const centralAfter = await state(owner);
    expect(
      centralAfter.snapshot.tables.documentVersions.length,
    ).toBeGreaterThan(1);
    expect(
      centralAfter.snapshot.tables.documentVersions.find(
        (v: any) => v.id === originalVersion.id,
      ),
    ).toEqual(originalVersion);
    expect(
      (
        await core(owner, prefix + "/participants", {
          identity_id: lawState.identity.id,
          permissions: ["READ"],
        })
      ).status,
    ).toBe(200);
    const readonlyAdoption = await post(
      "/local/workspace/adopt",
      seed(await state(lawyer)),
      lawyer,
    );
    expect(readonlyAdoption.status, await readonlyAdoption.clone().text()).toBe(
      200,
    );
    expect((await readonlyAdoption.json()).read_only).toBe(true);
    const revoked = await core(
      owner,
      prefix + `/participants/${lawState.identity.id}/revocation`,
      {},
    );
    expect(revoked.status, JSON.stringify(revoked.result)).toBe(200);
    expect(
      (
        await fetch(origin + `/local/workspace/rooms/${access.room.id}`, {
          headers: {
            Cookie: lawyer,
            Authorization: "Bearer " + lawAccess.token,
          },
        })
      ).status,
    ).toBe(403);
    await browserExpect(
      pages[1].getByText(/Acceso retirado|acceso.*retirado/i).first(),
    ).toBeVisible({ timeout: 20000 });
    await browserExpect(pages[1].locator(".tiptap")).toHaveAttribute(
      "contenteditable",
      "false",
    );
    expect(errors).toEqual([]);
    // New business modules use the same authenticated server and central state.
    const practice=async(op:string,body?:unknown,cookie=owner)=>{const r=await core(cookie,`/firms/${firm.id}/practice${op?"/"+op:""}`,body);expect(r.status,JSON.stringify(r.result)).toBe(200);return r.result.data};
    const adminPage=await contexts[0].newPage();await adminPage.goto(origin);
    await adminPage.getByRole("button",{name:"Asuntos",exact:true}).click();
    await adminPage.getByText(matter.title,{exact:true}).first().click();
    await adminPage.getByRole("button",{name:"← Volver al asunto",exact:true}).click();
    await adminPage.getByRole("tab",{name:"Gestión del asunto",exact:true}).click();
    await adminPage.getByRole("button",{name:"Registrar encargo",exact:true}).click();
    await adminPage.getByLabel("Alcance del encargo",{exact:true}).fill("Encargo sintetico para prueba integral");
    await adminPage.locator('textarea[name="parties"]').fill("Cliente sintetico | TEST-123 | CLIENT");
    await adminPage.getByRole("button",{name:"Guardar",exact:true}).click();
    await browserExpect(adminPage.getByText("Encargo sintetico para prueba integral",{exact:true})).toBeVisible();
    let admission=(await practice("")).records.find((r:any)=>r.payload.type==="ADMISSION");
    admission=await practice("check_conflicts",{record_id:admission.id,expected_revision:admission.revision});
    admission=await practice("decide_admission",{record_id:admission.id,expected_revision:admission.revision,decision:"ACCEPTED",note:"Conflictos revisados por Director"});
    expect((await core(lawyer,`/firms/${firm.id}/practice/issue_invoice`,{matter_id:matter.id})).status).not.toBe(200);
    // Exercise the forms as well as the command service: money must survive
    // UI serialization, and an approved template must open the real editor.
    await adminPage.getByRole("button",{name:"Honorarios y cobros",exact:true}).click();
    await adminPage.getByRole("button",{name:"Nuevo presupuesto",exact:true}).click();
    await adminPage.locator('.practice-panel textarea[name="lines"]').fill("Asesoramiento | 1 | 100000 | 10");
    await adminPage.locator('.practice-panel input[name="title"]').fill("Honorarios sinteticos");
    await adminPage.locator('.practice-panel textarea[name="terms"]').fill("Aceptacion documentada y pago por transferencia");
    await adminPage.getByRole("button",{name:"Guardar",exact:true}).click();
    await adminPage.getByRole("button",{name:"Aprobar",exact:true}).click();
    await adminPage.getByRole("button",{name:"Registrar aceptación del cliente",exact:true}).click();
    await adminPage.locator('.practice-panel input[name="reference"]').fill("Aceptacion sintetica del cliente");
    await adminPage.getByRole("button",{name:"Guardar",exact:true}).click();
    await expect.poll(async()=>{const view=await practice("");return view.records.find((r:any)=>r.payload.type==="BUDGET")?.payload.status}).toBe("ACCEPTED");
    const acceptedBudget=(await practice("")).records.find((r:any)=>r.payload.type==="BUDGET");
    expect(acceptedBudget.payload.status).toBe("ACCEPTED");
    await adminPage.getByRole("button",{name:"Liquidar honorarios",exact:true}).click();
    await adminPage.locator('.practice-panel textarea[name="lines"]').fill("Asesoramiento | 1 | 100000 | 10");
    await adminPage.locator('.practice-panel select[name="budget"]').selectOption(acceptedBudget.id);
    await adminPage.getByRole("button",{name:"Guardar",exact:true}).click();
    await adminPage.getByRole("button",{name:"Registrar pago / devolución",exact:true}).click();
    await adminPage.getByLabel("Importe",{exact:true}).fill("25000");
    await adminPage.locator('.practice-panel input[name="reference"]').fill("REC-SYNTHETIC-UI");
    await adminPage.getByRole("button",{name:"Guardar",exact:true}).click();
    await expect.poll(async()=>{const view=await practice("");return view.balances[0]?.balance}).toBe(85000);
    await mkdir(resolve(process.cwd(),".local-dev/reports"),{recursive:true});
    await adminPage.screenshot({path:resolve(process.cwd(),".local-dev/reports/stage-22-economy.png"),fullPage:true});
    await adminPage.getByRole("button",{name:"Plantillas",exact:true}).click();
    await adminPage.getByRole("button",{name:"Nueva plantilla del estudio",exact:true}).click();
    await adminPage.getByLabel("Nombre de plantilla",{exact:true}).fill("Plantilla sintetica aprobada");
    await adminPage.getByLabel("Tipo de documento",{exact:true}).fill("Contrato");
    await adminPage.locator('.practice-panel textarea[name="body"]').fill("Contrato de {{cliente.nombre}} para {{asunto.titulo}}. Alcance: {{alcance}}.");
    await adminPage.getByRole("button",{name:"Guardar",exact:true}).click();
    await adminPage.getByRole("button",{name:"Aprobar plantilla",exact:true}).click();
    await adminPage.getByRole("button",{name:"Crear en el editor",exact:true}).click();
    await adminPage.getByLabel("Título del documento",{exact:true}).fill("Contrato creado desde plantilla");
    await adminPage.locator('input[name="value:alcance"]').fill("Objeto sintetico revisable");
    await adminPage.getByRole("button",{name:"Guardar",exact:true}).click();
    await browserExpect(adminPage.locator(".tiptap")).toContainText("Objeto sintetico revisable",{timeout:20000});
    await adminPage.screenshot({path:resolve(process.cwd(),".local-dev/reports/stage-22-template-editor.png"),fullPage:true});
    await adminPage.getByRole("button",{name:"← Volver al asunto",exact:true}).click();
    await adminPage.getByRole("tab",{name:"Gestión del asunto",exact:true}).click();
    const publication=await practice("publish_delivery",{matter_id:matter.id,title:"Comunicacion revisada",message:"Texto visible al cliente",document_version_id:null,explicitly_confirmed:true});
    const grant=await practice("grant_portal",{matter_id:matter.id,recipient:"Cliente portal",expires_at:new Date(Date.now()+86400000).toISOString(),allow_messages:true});
    const portalContext=await browser.newContext();const portalPage=await portalContext.newPage();await portalPage.goto(origin+"/#portal="+grant.token);
    await browserExpect(portalPage.getByRole("heading",{name:"Comunicacion revisada"})).toBeVisible();
    await browserExpect(portalPage.getByRole("button",{name:"Asuntos",exact:true})).toHaveCount(0);
    await portalPage.getByRole("textbox",{name:"Mensaje al estudio"}).fill("Mensaje del cliente, privado a este acceso");await portalPage.getByRole("button",{name:"Enviar mensaje",exact:true}).click();await browserExpect(portalPage.getByRole("status")).toContainText("Mensaje registrado");
    const response=await fetch(origin+"/local/portal",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","X-Platform":"1",Authorization:"Bearer "+grant.token},body:JSON.stringify({action:"DOWNLOAD",publication_id:draft.id})});expect(response.status).not.toBe(200);
    await practice("revoke_portal",{record_id:grant.grant.id,expected_revision:grant.grant.revision});await portalPage.reload();await browserExpect(portalPage.getByRole("alert")).toBeVisible();await portalContext.close();await adminPage.close();
    const accountRecovery=await (await post("/local/platform/recovery-link",{firm_id:firm.id,user_id:lawState.identity.id},owner)).json();expect(accountRecovery.link).toContain("#recovery=");
    const recoveryToken=new URL(accountRecovery.link).hash.slice("#recovery=".length),newPassword="Recovered-synthetic-"+randomUUID();expect((await post("/local/platform/recover-account",{token:recoveryToken,password:newPassword})).status).toBe(200);expect((await post("/local/platform/recover-account",{token:recoveryToken,password:newPassword})).status).not.toBe(200);
    expect((await fetch(origin+"/local/platform/state",{headers:{Cookie:lawyer}})).status).toBe(401);
    expect((await post("/local/auth/sign-in/email",{email:"lawyer@law.invalid",password:newPassword})).status).toBe(200);
    const library=resolve(root,"local-browser/library/research");await mkdir(resolve(library,"originals"),{recursive:true});await writeFile(resolve(library,"originals/test.raw"),"Synthetic bibliography original");
    const catalog=new DatabaseSync(resolve(library,"corpus.sqlite"));catalog.exec("PRAGMA journal_mode=WAL;CREATE TABLE documents(id INTEGER PRIMARY KEY,text TEXT);INSERT INTO documents VALUES(1,'Committed WAL content')");
    await browser.close();
    browser = null;
    const copied = await createPlatformBackup(
      root,
      db.pool,
      config,
      process.cwd(),
    );
    const dir = resolve(root, ".local-dev/backups", copied.id);
    catalog.close();
    expect(
      (await verifyPlatformBackup(dir)).files.some((f: any) =>
        f.path.startsWith("objects/"),
      ),
    ).toBe(true);
    const restored = await restorePlatformBackup(
      root,
      dir,
      db.pool,
      config,
      process.cwd(),
    );
    expect(restored).toMatchObject({
      sqlite_verified:1,
      status: "VERIFIED",
      active_database_changed: false,
    });
    expect(await readFile(resolve(root,restored.isolated_files,"files/local-browser/library/research/originals/test.raw"),"utf8")).toBe("Synthetic bibliography original");
    const file = resolve(dir, "configuration/platform-auth-secret");
    const bytes = await readFile(file);
    await writeFile(file, "alterado");
    await expect(verifyPlatformBackup(dir)).rejects.toThrow(
      "BACKUP_INTEGRITY_FAILED",
    );
    await writeFile(file, bytes);
    await platform.close();
    platform = createPlatformBridge(root, origin, { pool: db.pool, config });
    expect(
      (await state(owner)).snapshot.tables.clients.some(
        (c: any) => c.id === client.id,
      ),
    ).toBe(true);
    expect((await post("/local/auth/sign-out", {}, owner)).status).toBe(200);
    expect(
      (
        await fetch(origin + "/local/platform/state", {
          headers: { Cookie: owner },
        })
      ).status,
    ).toBe(401);
    await mkdir("local-browser/reports/platform-local", { recursive: true });
    await writeFile(
      "local-browser/reports/platform-local/result.json",
      JSON.stringify(
        {
          tested_at: new Date().toISOString(),
          identities: "REAL_BETTER_AUTH",
          migration_original_unchanged: true,
          two_human_editors: true,
          deadline_creation_confirmation_and_escalation: true,
          permission_revocation: true,
          backup_restore: restored.status,
          live_ai_calls: 0,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (browser)
      for (const context of browser.contexts())
        for (const page of context.pages()) {
          console.error(
            "Platform browser evidence:",
            (await page.locator("body").innerText()).slice(0, 3500),
          );
          await mkdir("local-browser/reports/platform-local", {
            recursive: true,
          });
          await page.screenshot({
            path: "local-browser/reports/platform-local/failure.png",
          });
        }
    throw error;
  } finally {
    if (browser) await browser.close();
    await workspace.close();
    await platform.close();
    await new Promise<void>((r) => server.close(() => r()));
    await db.close();
  }
}, 300000);
