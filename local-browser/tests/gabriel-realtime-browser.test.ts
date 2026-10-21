import { it, expect } from "vitest";
import { chromium, expect as ui } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

it("keeps a real WebRTC microphone open across turns, interruptions, typed input and OS tools, then stops every track", async () => {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url!, "http://local").pathname;
      const file = resolve(
        "dist/web",
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (
        !file.startsWith(resolve("dist/web") + "\\") &&
        !file.startsWith(resolve("dist/web") + "/")
      )
        throw Error("INVALID_PATH");
      res.setHeader(
        "Content-Type",
        (
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".html": "text/html",
          } as any
        )[extname(file)] ?? "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  let starts = 0,
    stops = 0;
  const forbidden: string[] = [],
    errors: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      localStorage.setItem("law-order.gabriel.voice.v1", "false");
      const state: any = { streams: [], sent: [], pcs: [], channel: null };
      (window as any).__nativeVoice = state;
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const audio = new AudioContext();
          await audio.resume();
          const source = audio.createOscillator(),
            sink = audio.createMediaStreamDestination();
          source.connect(sink);
          source.start();
          const stream = sink.stream;
          state.streams.push(stream);
          const track = stream.getAudioTracks()[0]!,
            stop = track.stop.bind(track);
          track.stop = () => {
            if (track.readyState !== "ended") {
              source.stop();
              void audio.close();
              stop();
            }
          };
          return stream;
        },
      });
      const Peer = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Peer {
        constructor(config?: RTCConfiguration) {
          super(config);
          state.pcs.push(this);
        }
      };
      state.provider = async (sdp: string) => {
        const pc = new Peer();
        state.providerPc = pc;
        pc.ontrack = (e) => {
          state.receivedMicrophone = e.track;
        };
        pc.ondatachannel = (e) => {
          state.channel = e.channel;
          e.channel.onmessage = (m) => state.sent.push(JSON.parse(m.data));
        };
        const audio = new AudioContext();
        await audio.resume();
        state.providerAudio = audio;
        const oscillator = audio.createOscillator(),
          sink = audio.createMediaStreamDestination();
        oscillator.connect(sink);
        oscillator.start();
        pc.addTrack(sink.stream.getAudioTracks()[0]!, sink.stream);
        await pc.setRemoteDescription({ type: "offer", sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        if (pc.iceGatheringState !== "complete")
          await new Promise<void>((done) => {
            const timeout = setTimeout(done, 1500);
            pc.onicegatheringstatechange = () => {
              if (pc.iceGatheringState === "complete") {
                clearTimeout(timeout);
                done();
              }
            };
          });
        return pc.localDescription!.sdp;
      };
      state.emit = (event: any) => state.channel.send(JSON.stringify(event));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    await context.route("**/local/gabriel/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/status"))
        return route.fulfill({ json: { ready: true } });
      if (path.endsWith("/realtime/state"))
        return route.fulfill({
          json: { ended: false, estimated_usd: 0.001, responses: 2 },
        });
      if (path.endsWith("/realtime/stop")) {
        stops++;
        return route.fulfill({ json: { stopped: true } });
      }
      if (path.endsWith("/realtime")) {
        starts++;
        const request = route.request().postDataJSON();
        const sdp = await page.evaluate(
          (sdp) => (window as any).__nativeVoice.provider(sdp),
          request.sdp,
        );
        return route.fulfill({
          json: {
            sdp,
            session_id: "synthetic-session",
            model: "gpt-realtime-2.1-mini",
          },
        });
      }
      forbidden.push(path);
      return route.fulfill({
        status: 500,
        json: { error: "Old per-turn pipeline must not run." },
      });
    });
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Administración", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Crear estudio", exact: true })
      .click();
    await page
      .getByLabel("Nombre del estudio sintético")
      .fill("Estudio ficticio de voz nativa");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Conversar por voz con Gabriel",
        exact: true,
      })
      .click();
    await ui
      .poll(() =>
        page.evaluate(() => (window as any).__nativeVoice.channel?.readyState),
      )
      .toBe("open");
    await ui
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__nativeVoice.streams[0]?.getAudioTracks()[0]
              .enabled,
        ),
      )
      .toBe(true);
    const emit = (e: any) =>
      page.evaluate((e) => (window as any).__nativeVoice.emit(e), e);
    await emit({
      type: "input_audio_buffer.speech_started",
      item_id: "user_1",
    });
    await emit({
      type: "input_audio_buffer.speech_stopped",
      item_id: "user_1",
    });
    await emit({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user_1",
      transcript: "Quiero hablar de un contrato.",
    });
    await emit({ type: "response.created", response: { id: "r1" } });
    await emit({
      type: "response.output_item.added",
      item: { id: "answer_1", role: "assistant" },
    });
    await emit({ type: "output_audio_buffer.started" });
    await emit({
      type: "response.output_audio_transcript.delta",
      item_id: "answer_1",
      delta: "Contame qué necesita tu cliente.",
    });
    await ui(
      page.getByText("Contame qué necesita tu cliente.", { exact: true }),
    ).toBeVisible();
    // Start speaking while Gabriel is still producing audio: same microphone.
    await emit({
      type: "input_audio_buffer.speech_started",
      item_id: "user_2",
    });
    await emit({
      type: "response.done",
      response: { id: "r1", status: "cancelled" },
    });
    await emit({ type: "output_audio_buffer.cleared" });
    await emit({
      type: "response.output_audio_transcript.done",
      item_id: "answer_1",
      transcript: "Texto posterior no escuchado",
    });
    await ui(
      page.getByText("Texto posterior no escuchado", { exact: true }),
    ).toHaveCount(0);
    await emit({
      type: "input_audio_buffer.speech_stopped",
      item_id: "user_2",
    });
    await emit({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "user_2",
      transcript: "Esperá, primero abrí Clientes.",
    });
    await ui(
      page.getByText("Respuesta interrumpida", { exact: true }),
    ).toBeVisible();
    await emit({ type: "response.created", response: { id: "r2" } });
    await emit({
      type: "response.function_call_arguments.done",
      call_id: "call_nav",
      name: "navigate_os",
      arguments: JSON.stringify({ destination: "clients" }),
    });
    await emit({
      type: "response.done",
      response: { id: "r2", status: "completed" },
    });
    await ui(
      page.getByRole("heading", { name: "Clientes", exact: true }),
    ).toBeVisible();
    await ui
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__nativeVoice.sent.filter(
              (e: any) => e.item?.type === "function_call_output",
            ).length,
        ),
      )
      .toBe(1);
    // Duplicate provider event must not execute the UI action twice.
    await emit({
      type: "response.function_call_arguments.done",
      call_id: "call_nav",
      name: "navigate_os",
      arguments: JSON.stringify({ destination: "clients" }),
    });
    await emit({ type: "response.created", response: { id: "r3" } });
    await page
      .getByLabel("Mensaje para Gabriel")
      .fill("Y conservá el objetivo anterior.");
    await page.getByLabel("Mensaje para Gabriel").press("Enter");
    await ui(
      page.getByText("Y conservá el objetivo anterior.", { exact: true }),
    ).toBeVisible();
    await ui
      .poll(() =>
        page.evaluate(() =>
          (window as any).__nativeVoice.sent.some(
            (e: any) =>
              e.item?.content?.[0]?.text === "Y conservá el objetivo anterior.",
          ),
        ),
      )
      .toBe(true);
    await emit({
      type: "response.done",
      response: { id: "r3", status: "cancelled" },
    });
    expect(
      await page.evaluate(() => (window as any).__nativeVoice.streams.length),
    ).toBe(1);
    expect(
      await page.evaluate(
        () =>
          (window as any).__nativeVoice.streams[0].getAudioTracks()[0]
            .readyState,
      ),
    ).toBe("live");
    await page
      .getByRole("button", { name: "Silenciar micrófono", exact: true })
      .click();
    expect(
      await page.evaluate(
        () =>
          (window as any).__nativeVoice.streams[0].getAudioTracks()[0].enabled,
      ),
    ).toBe(false);
    await page
      .getByRole("button", { name: "Activar micrófono", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cerrar conversación", exact: true })
      .click();
    await ui
      .poll(() =>
        page.evaluate(() =>
          (window as any).__nativeVoice.streams.every((s: MediaStream) =>
            s.getTracks().every((t) => t.readyState === "ended"),
          ),
        ),
      )
      .toBe(true);
    await ui.poll(() => stops).toBeGreaterThan(0);
    expect(starts).toBe(1);
    expect(forbidden).toEqual([]);
    expect(errors).toEqual([]);
    await page
      .getByRole("button", { name: "Hablar con Gabriel", exact: true })
      .click();
    await ui(
      page.getByText("Esperá, primero abrí Clientes.", { exact: true }),
    ).toBeVisible();
    await mkdir("local-browser/reports/gabriel", { recursive: true });
    await page.screenshot({
      path: "local-browser/reports/gabriel/native-voice.png",
    });
    await writeFile(
      "local-browser/reports/gabriel/native-voice-verification.json",
      JSON.stringify(
        {
          result: "PASS",
          real_loopback_webrtc: true,
          microphone_acquisitions: 1,
          native_session_creations: starts,
          voice_turns_retained: 2,
          interruptions: true,
          typing_during_response: true,
          navigation_tool: true,
          mute: true,
          close_stops_tracks: true,
          legacy_pipeline_calls: forbidden.length,
          paid_calls: 0,
          browser_errors: errors,
        },
        null,
        2,
      ),
    );
    await page.evaluate(() => {
      const s = (window as any).__nativeVoice;
      s.providerPc?.close();
      void s.providerAudio?.close();
    });
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}, 90000);
