import { afterAll, beforeAll, expect, it } from "vitest";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { buildServer } from "../../apps/api/src/server.js";
import { database, fixture, admin, lawyer } from "./fixtures.js";
let db: Awaited<ReturnType<typeof database>>;
beforeAll(async () => {
  db = await database();
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("checks compact browser UI against HTTP and real PostgreSQL, with TEST-ONLY identity", async () => {
  const f = await fixture(db);
  for (let i = 1; i <= 16; i++) {
    const matter = await db.core.createMatter(admin.token, f.firm.id, {
      client_id: f.client.id,
      title: `Asesoría sintética ${String(i).padStart(2, "0")}`,
      kind: "ADVISORY",
      subject_area: "Contratos",
      responsible_identity_id: admin.id,
      opened_on: "2026-10-13",
      closed_on: null,
    });
    await db.core.createTask(admin.token, f.firm.id, matter.id, {
      title: `Revisar documentación ${String(i).padStart(2, "0")}`,
      responsible_identity_id: admin.id,
      internal_due_at: "2026-10-13T18:00:00.000Z",
    });
  }
  const app = buildServer({
    persistence: db.persistence,
    auth: db.auth,
    sessionPool: db.pool,
    origin: "http://127.0.0.1:4312",
  });
  await app.listen({ host: "127.0.0.1", port: 4312 });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const evidence: {
    viewport: string;
    topbar: number;
    sidebar: number;
    font: string;
    rows_visible: number;
  }[] = [];
  try {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "os_session",
        value: admin.token,
        url: "http://127.0.0.1:4312",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await mkdir("f1-f4/reports/screenshots", { recursive: true });
    for (const [width, height] of [
      [1440, 900],
      [1366, 768],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      await page.goto("http://127.0.0.1:4312");
      await page
        .getByRole("heading", { name: "Mi día", exact: true })
        .waitFor();
      await page
        .getByText("Revisar documentación 01", { exact: true })
        .waitFor();
      const measurements = await page.evaluate(() => ({
        topbar: document.querySelector(".topbar")!.getBoundingClientRect()
          .height,
        sidebar: document.querySelector(".sidebar")!.getBoundingClientRect()
          .width,
        font: getComputedStyle(document.body).fontSize,
        rows_visible: [...document.querySelectorAll("tbody tr")].filter(
          (row) => row.getBoundingClientRect().bottom <= innerHeight,
        ).length,
      }));
      expect(measurements.topbar).toBe(44);
      expect(measurements.sidebar).toBe(212);
      expect(measurements.font).toBe("13px");
      expect(measurements.rows_visible).toBeGreaterThanOrEqual(12);
      evidence.push({ viewport: `${width}x${height}`, ...measurements });
      await page.screenshot({
        path: `f1-f4/reports/screenshots/my-day-${width}x${height}-100.png`,
        fullPage: false,
      });
    }
    await page.getByRole("button", { name: "Clientes", exact: true }).click();
    await page
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .click();
    await page
      .getByLabel("Nombre", { exact: true })
      .fill("Cliente creado en navegador");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("cell", { name: "Cliente creado en navegador", exact: true })
      .waitFor();
    expect(
      (await db.core.listClients(admin.token, f.firm.id)).some(
        (c) => c.display_name === "Cliente creado en navegador",
      ),
    ).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Asuntos", exact: true }).click();
    await page
      .getByRole("button", { name: "Asesoría sintética 01", exact: true })
      .waitFor();
    await page.screenshot({
      path: "f1-f4/reports/screenshots/matters-1366x768-100.png",
    });
    await page
      .getByRole("button", {
        name: "Asesoría contractual sintética",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Preparar borrador", exact: true })
      .click();
    await page
      .getByLabel("Título", { exact: true })
      .fill("Escrito desde navegador");
    await page
      .getByLabel("Contenido de la versión")
      .fill("Contenido sintético revisable.");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("tab", { name: "Borradores", exact: true }).click();
    await page
      .getByRole("button", { name: "Solicitar revisión", exact: true })
      .click();
    await page.getByLabel("Revisor distinto del autor").selectOption(lawyer.id);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const reviewerContext = await browser.newContext();
    await reviewerContext.addCookies([
      {
        name: "os_session",
        value: lawyer.token,
        url: "http://127.0.0.1:4312",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    const reviewPage = await reviewerContext.newPage();
    await reviewPage.goto("http://127.0.0.1:4312");
    await reviewPage
      .getByRole("button", {
        name: "Asesoría contractual sintética",
        exact: true,
      })
      .click();
    await reviewPage
      .getByRole("button", { name: "Aprobar versión", exact: true })
      .click();
    await reviewPage
      .getByLabel("Revisé el contenido y apruebo esta versión.")
      .check();
    await reviewPage
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await reviewPage.getByText("Aprobado", { exact: true }).waitFor();
    expect(
      (
        await db.core.listMatterResources(
          admin.token,
          f.firm.id,
          f.matter.id,
          "drafts",
        )
      )[0]?.status,
    ).toBe("APPROVED");
    await reviewPage.screenshot({
      path: "f1-f4/reports/screenshots/exact-review-browser.png",
    });
    await reviewerContext.close();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement!;
      return { tag: el.tagName, outline: getComputedStyle(el).outlineStyle };
    });
    expect(focused.tag).not.toBe("BODY");
    await page.setViewportSize({ width: 320, height: 740 });
    await page.screenshot({
      path: "f1-f4/reports/screenshots/matters-320-reflow.png",
      fullPage: true,
    });
    expect(failures).toEqual([]);
    await writeFile(
      "f1-f4/reports/browser-evidence.json",
      JSON.stringify(
        {
          status: "PASS_UI_HTTP_POSTGRES",
          authentication: "SYNTHETIC_TEST_DOUBLE_ONLY",
          storage: "REAL_LOCAL_FILESYSTEM_TEST_ADAPTER",
          supabase_auth_storage_e2e: "BLOCKED_NOT_RUN",
          evidence,
          keyboard: focused,
          external_requests: "BLOCKED",
          paid_calls: 0,
        },
        null,
        2,
      ),
    );
    await context.close();
  } finally {
    await browser.close();
    await app.close();
  }
}, 60000);
