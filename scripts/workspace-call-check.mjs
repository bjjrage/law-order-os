import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { createWorkspaceCall } from "./workspace-call.mjs";
import { mkdir } from "node:fs/promises";

// Isolated browser check: real WebRTC media and room signaling, no workspace data writes.
const server = await createServer({
  configFile: "apps/web/vite.config.ts",
  server: { port: 4325, strictPort: true },
  plugins: [
    {
      name: "call-check",
      configureServer(host) {
        host.middlewares.use(async (req, res, next) => {
          if (req.url !== "/__call-check") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            await host.transformIndexHtml(
              req.url,
              `<!doctype html><html><body style="background:#f1f2ea"><h1>Workspace compartido</h1><p>Prueba de llamada con cámara simulada</p><div id="root"></div><script type="module">
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import WorkspaceCall from '/src/WorkspaceCall.tsx';
    import '/src/workspace.css';
    const listeners = new Map();
    const provider = {on: (name, fn) => listeners.set(name, fn), off: name => listeners.delete(name), sendStateless: msg => {void window.__signal(msg)}};
    window.__receive = payload => listeners.get('stateless')?.({payload});
    window.__streams = [];
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {const stream = await getUserMedia(options); window.__streams.push(stream); return stream;};
    createRoot(document.getElementById('root')).render(React.createElement(WorkspaceCall, {provider, enabled: true, name: 'Abogado local'}));
  </script></body></html>`,
            ),
          );
        });
      },
    },
  ],
});
const call = createWorkspaceCall(async () => ({
  grant: { actor_id: "local-lawyer" },
}));
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 1100, height: 780 },
  });
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  const errors = [];
  for (const [index, page] of pages.entries()) {
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    const connection = {
      socketId: String(index),
      context: { token: String(index) },
      callbacks: { onClose: [] },
      sendStateless: (payload) => {
        void page
          .evaluate((payload) => window.__receive(payload), payload)
          .catch(() => {});
      },
    };
    await page.exposeFunction("__signal", (payload) =>
      call.handle("test-room", connection, payload),
    );
    await page.goto("http://127.0.0.1:4325/__call-check");
    console.log(`Browser ${index + 1}: joining`);
    await page
      .getByRole("button", { name: "Llamada del documento", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Unirse a la llamada", exact: true })
      .click();
    await expect(page.locator(".workspace-call-bubble")).toHaveCount(index + 1);
  }
  const [a, b] = pages;
  await expect(a.locator(".workspace-call-bubble")).toHaveCount(2);
  for (const page of pages)
    await page.getByRole("button", { name: "Plegar llamada" }).click();
  await a.getByRole("button", { name: "Activar cámara", exact: true }).click();
  await expect(
    a.getByRole("button", { name: "Apagar cámara", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      b
        .locator(".workspace-call-bubble video")
        .evaluateAll((videos) =>
          videos.some((v) => v.videoWidth > 0 && v.readyState >= 2),
        ),
    )
    .toBe(true);
  await b.getByRole("button", { name: "Activar cámara", exact: true }).click();
  await expect
    .poll(() =>
      a
        .locator(".workspace-call-bubble video")
        .evaluateAll((videos) => videos.filter((v) => v.videoWidth > 0).length),
    )
    .toBe(2);
  const bubble = a.locator(".workspace-call-bubble").first();
  const before = await bubble.boundingBox();
  await a.mouse.move(before.x + 50, before.y + 40);
  await a.mouse.down();
  await a.mouse.move(240, 200, { steps: 8 });
  await a.mouse.up();
  const after = await bubble.boundingBox();
  expect(after.x).toBeLessThan(before.x - 100);
  await bubble.focus();
  await a.keyboard.press("ArrowLeft");
  expect((await bubble.boundingBox()).x).toBe(after.x - 16);
  await a.setViewportSize({ width: 390, height: 640 });
  await expect
    .poll(async () => (await bubble.boundingBox()).x)
    .toBeLessThanOrEqual(278);
  await a.setViewportSize({ width: 1100, height: 780 });
  await mkdir("local-browser/reports/workspace-local", { recursive: true });
  await a.screenshot({
    path: "local-browser/reports/workspace-local/workspace-video-bubbles.png",
  });
  await a.getByRole("button", { name: "Apagar cámara", exact: true }).click();
  await expect(b.locator(".workspace-call-bubble video")).toHaveCount(1);
  expect(
    await a.evaluate(() =>
      window.__streams
        .flatMap((s) => s.getVideoTracks())
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await a.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Camera denied", "NotAllowedError");
    };
  });
  await a.getByRole("button", { name: "Activar cámara", exact: true }).click();
  await expect(a.getByRole("alert")).toContainText("Permití la cámara");
  expect(
    await a.evaluate(() =>
      window.__streams
        .flatMap((s) => s.getAudioTracks())
        .some((t) => t.readyState === "live"),
    ),
  ).toBe(true);
  await a.getByRole("button", { name: "Plegar llamada" }).click();
  await a
    .getByRole("button", { name: "Salir de la llamada", exact: true })
    .click();
  await expect(a.locator(".workspace-call-bubble")).toHaveCount(0);
  await expect(b.locator(".workspace-call-bubble")).toHaveCount(1);
  expect(
    await a.evaluate(() =>
      window.__streams
        .flatMap((s) => s.getTracks())
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "PASS: two-way video, camera release, denied permission, drag, keyboard, resize and leave; no browser errors.",
  );
} finally {
  call.close();
  await browser?.close();
  await server.close();
}
