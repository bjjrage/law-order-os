import { useEffect, useRef, useState } from "react";
import { captureVoice } from "./gabriel-audio.js";

/** Voice is an input/output for the existing document conversation, never a second agent. */
export default function WorkspaceVoice({
  instruction,
  onInstruction,
  response,
  active,
  disabled,
  offline,
  onBusy,
}: {
  instruction: string;
  onInstruction: (text: string) => void;
  response: string;
  active: boolean;
  disabled: boolean;
  offline: boolean;
  onBusy: (busy: boolean) => void;
}) {
  disabled = disabled || offline;
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<
    "idle" | "opening" | "recording" | "transcribing" | "loading" | "playing"
  >("idle");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const recorder = useRef<Awaited<ReturnType<typeof captureVoice>> | null>(
    null,
  );
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef("");
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const serial = useRef(0);
  const locked = useRef(false);
  const live = useRef({ instruction, onInstruction, onBusy, active, disabled });
  live.current = { instruction, onInstruction, onBusy, active, disabled };

  function releaseAudio() {
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
      audio.current = null;
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = "";
  }
  function dispose() {
    ++serial.current;
    locked.current = false;
    abort.current?.abort();
    abort.current = null;
    clearTimeout(timer.current);
    const recording = recorder.current;
    recorder.current = null;
    void recording?.stop(true).catch(() => {});
    releaseAudio();
  }
  function cancel() {
    dispose();
    setState("idle");
    setLevel(0);
    live.current.onBusy(false);
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/local/gabriel/status", { signal: controller.signal })
      .then(async (r) => (r.ok ? r.json() : { ready: false }))
      .then((value) => {
        if (!controller.signal.aborted) setReady(value.ready === true);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      dispose();
      live.current.onBusy(false);
    };
  }, []);
  useEffect(() => {
    if (!active || disabled) cancel();
  }, [active, disabled]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  async function request<T>(
    operation: "speech" | "transcribe",
    body: ArrayBuffer | { text: string },
    signal: AbortSignal,
  ): Promise<T> {
    const r = await fetch("/local/gabriel/" + operation, {
      method: "POST",
      signal,
      headers: {
        "Content-Type":
          body instanceof ArrayBuffer ? "audio/wav" : "application/json",
        "X-Gabriel": "1",
        "X-Request-Id": crypto.randomUUID(),
      },
      body: body instanceof ArrayBuffer ? body : JSON.stringify(body),
    });
    const result = await r.json();
    if (!r.ok) throw Error(result.error ?? "El servicio de voz no respondió.");
    return result as T;
  }
  function fail(reason: unknown, turn: number) {
    if (serial.current !== turn) return;
    cancel();
    setError(
      reason instanceof DOMException && reason.name === "NotAllowedError"
        ? "Permití el micrófono en el navegador para dictar. Podés seguir escribiendo."
        : reason instanceof Error
          ? reason.message
          : "No se pudo completar la voz. Podés seguir escribiendo.",
    );
  }
  async function finish() {
    const recording = recorder.current;
    if (!recording) return;
    recorder.current = null;
    clearTimeout(timer.current);
    const turn = serial.current;
    const signal = abort.current!.signal;
    setState("transcribing");
    try {
      const wave = await recording.stop();
      if (!wave || serial.current !== turn) return;
      const result = await request<{ text: string }>(
        "transcribe",
        wave,
        signal,
      );
      if (
        serial.current !== turn ||
        !live.current.active ||
        live.current.disabled
      )
        return;
      if (typeof result.text !== "string" || !result.text.trim())
        throw Error("No se reconoció un pedido. Probá de nuevo.");
      const text = [live.current.instruction.trim(), result.text.trim()]
        .filter(Boolean)
        .join("\n");
      live.current.onInstruction(text);
      setNotice("Dictado listo. Revisá el mensaje y pulsá Enviar.");
      cancel();
    } catch (reason) {
      fail(reason, turn);
    }
  }
  async function record() {
    if (locked.current || !ready || !active || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError(
        "Este navegador no permite grabar audio. Usá Firefox o Chrome actualizado, o escribí.",
      );
      return;
    }
    cancel();
    locked.current = true;
    live.current.onBusy(true);
    setNotice("");
    setError("");
    setState("opening");
    const turn = serial.current;
    abort.current = new AbortController();
    try {
      const recording = await captureVoice((value) => {
        if (serial.current === turn) setLevel(value);
      });
      if (serial.current !== turn) {
        await recording.stop(true);
        return;
      }
      recorder.current = recording;
      setState("recording");
      timer.current = setTimeout(() => void finish(), 30000);
    } catch (reason) {
      fail(reason, turn);
    }
  }
  async function speak() {
    if (locked.current || !ready || !active || disabled || !response.trim())
      return;
    cancel();
    locked.current = true;
    setError("");
    setNotice("");
    setState("loading");
    const turn = serial.current;
    const controller = new AbortController();
    abort.current = controller;
    try {
      const result = await request<{ audio: string; mime: string }>(
        "speech",
        { text: response.slice(0, 1600) },
        controller.signal,
      );
      if (serial.current !== turn) return;
      const bytes = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0));
      url.current = URL.createObjectURL(
        new Blob([bytes], { type: result.mime }),
      );
      const sound = new Audio(url.current);
      audio.current = sound;
      sound.onended = () => {
        if (serial.current === turn) cancel();
      };
      sound.onerror = () =>
        fail(
          Error(
            "No se pudo reproducir la voz. La respuesta escrita se conserva.",
          ),
          turn,
        );
      await sound.play();
      if (serial.current === turn) setState("playing");
    } catch (reason) {
      fail(reason, turn);
    }
  }
  const occupied = state !== "idle";
  return (
    <div className="workspace-voice" aria-label="Voz en el documento">
      <div className="workspace-voice-controls">
        <button
          type="button"
          disabled={
            !ready || disabled || !active || (occupied && state !== "recording")
          }
          aria-pressed={state === "recording"}
          onClick={() => void (state === "recording" ? finish() : record())}
          title="Dictar un pedido sobre el documento · hasta 30 segundos · hasta USD 0,01"
        >
          {state === "recording" ? (
            "■ Terminar dictado"
          ) : (
            <>
              <svg
                width="12"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
              </svg>{" "}
              Dictar
            </>
          )}
        </button>
        <button
          type="button"
          disabled={
            !ready || disabled || !active || occupied || !response.trim()
          }
          onClick={() => void speak()}
          title="Escuchar la última respuesta, hasta 1600 caracteres · voz generada por IA · hasta USD 0,04"
        >
          ▷ Escuchar respuesta
        </button>
        {occupied && (
          <button type="button" onClick={cancel} aria-label="Detener voz">
            ■ Detener
          </button>
        )}
      </div>
      {state === "recording" && (
        <meter
          min="0"
          max="0.15"
          value={level}
          aria-label="Nivel del micrófono"
        />
      )}
      <small role="status">
        {error ||
          (state === "opening"
            ? "Abriendo micrófono…"
            : state === "recording"
              ? "Te escucho · máximo 30 s. Terminar transcribe; Detener descarta."
              : state === "transcribing"
                ? "Transcribiendo tu pedido…"
                : state === "loading"
                  ? "Preparando voz IA…"
                  : state === "playing"
                    ? "Reproduciendo respuesta · voz IA"
                    : notice ||
                      (offline
                        ? "Prueba offline: sin llamadas de voz."
                        : !ready
                          ? "Voz no disponible en este servidor; podés escribir."
                          : "Dictado hasta USD 0,01 · lectura IA hasta USD 0,04"))}
      </small>
    </div>
  );
}
