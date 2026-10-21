import { useEffect, useRef, useState } from "react";
import type { Client, Matter } from "../../../os-core/src/contracts.js";
import GabrielAvatar, { type GabrielState } from "./GabrielAvatar.js";
import AnalysisLevelPicker from "./AnalysisLevelPicker.js";
import { queueGabrielRequest } from "./gabriel-request.js";

import { asuncionDate } from "./local-dates.js";
import { captureVoice } from "./gabriel-audio.js";
import { GabrielRealtime } from "./gabriel-realtime.js";
import {
  GabrielWorkspace,
  gabrielDocumentContext,
} from "./gabriel-workspace.js";
import {
  classifyGabriel,
  destinations,
  type Destination,
} from "./gabriel-intents.js";
import "./gabriel.css";
import { clampGabrielPosition, defaultGabrielPosition, gabrielSize } from "./gabriel-position.js";
import { isManagementTool, executeManagement } from "./gabriel-management.js";

type Message = {
  role: "user" | "assistant";
  content: string;
  source?: string;
  id?: string;
  partial?: boolean;
  interrupted?: boolean;
};
type Reply = {
  reply: string;
  action: "NONE" | "NAVIGATE" | "TEAM";
  destination: Destination;
  analysis_premise: string;
  management_actions?: Array<{name:string;command_id:string}>;
};
type Props = {
  firmId: string;
  actorId: string;
  clients: Client[];
  matters: Matter[];
  view: string;
  matter: Matter | null;
  onNavigate: (view: string) => void;
  onOpen: (matter: Matter, tab: string, draftId?: string) => void;
  launch: number;
};
const labels: Record<GabrielState, string> = {
  idle: "Estoy acá",
  listening: "Te escucho…",
  thinking: "Pensando…",
  speaking: "Hablando…",
};
const positionKey = "law-order.gabriel.position.v2";
const viewport = () => ({
  width: document.documentElement.clientWidth,
  height: window.innerHeight,
});
const clamp = (position: { x: number; y: number }) => clampGabrielPosition(position, viewport());
function restorePosition() {
  try {
    const p = JSON.parse(localStorage.getItem(positionKey) ?? "null");
    if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return clamp(p);
  } catch {
    /* Storage may be unavailable; the launcher remains usable. */
  }
  return defaultGabrielPosition(viewport());
}

export default function GabrielAssistant({
  firmId,
  actorId,
  clients,
  matters,
  view,
  matter,
  onNavigate,
  onOpen,
  launch,
}: Props) {
  const workspaceScope = useRef({ firmId, actorId, matters, onOpen });
  workspaceScope.current = { firmId, actorId, matters, onOpen };
  const [workspace] = useState(
    () =>
      new GabrielWorkspace(
        () => ({
          firm: workspaceScope.current.firmId,
          actor: workspaceScope.current.actorId as
            "local-administrator" | "local-lawyer",
          matters: workspaceScope.current.matters,
        }),
        (selected, draft) =>
          workspaceScope.current.onOpen(selected, "workspace", draft),
        undefined,
        (result) => {
          if (!mounted.current) return;
          if (realtime.current?.connected)
            realtime.current.notifyWorkspaceResult(result);
          else
            voiceMessage(
              "workspace_" + result.job_id,
              "assistant",
              String(
                result.summary ??
                  result.error ??
                  "El encargo terminó. Podés consultar su resultado guardado.",
              ),
              true,
            );
        },
      ),
  );
  const [expanded, setExpanded] = useState(false),
    [voice, setVoice] = useState(() => {
      try {
        return localStorage.getItem("law-order.gabriel.voice.v1") !== "false";
      } catch {
        return true;
      }
    }),
    [state, setState] = useState<GabrielState>("idle");
  const [text, setText] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [error, setError] = useState(""),
    [level, setLevel] = useState(0);
  const [ready, setReady] = useState<boolean | null>(null),
    [seconds, setSeconds] = useState(0);
  const [continuousVoice, setContinuousVoice] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false),
    [voiceCost, setVoiceCost] = useState(0);
  const realtime = useRef<GabrielRealtime | null>(null);
  const continuousRef = useRef(false),
    resumeListening = useRef<() => void>(() => {}),
    messagesRef = useRef<Message[]>([]);
  const [position, setPosition] = useState(restorePosition);
  const [premise, setPremise] = useState(""),
    [asOf, setAsOf] = useState(asuncionDate()),
    [targetMatter, setTargetMatter] = useState(""),
    [teamBusy, setTeamBusy] = useState(false),
    [teamError, setTeamError] = useState("");
  const controller = useRef<AbortController | null>(null),
    recorder = useRef<Awaited<ReturnType<typeof captureVoice>> | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    audioUrl = useRef("");
  const serial = useRef(0),
    locked = useRef(false),
    mounted = useRef(true),
    voiceRef = useRef(voice),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panel = useRef<HTMLElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    transcript = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    launcher = useRef<HTMLButtonElement>(null);
  const drag = useRef<{
    pointer: number;
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false),
    [dragging, setDragging] = useState(false);
  const sessionKey = "law-order.director.intake." + firmId + "." + actorId;
  voiceRef.current = voice;
  function clearTimer() {
    if (timer.current) clearInterval(timer.current);
    if (autoStop.current) clearTimeout(autoStop.current);
    timer.current = autoStop.current = null;
  }
  function releaseAudio() {
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = "";
  }
  function interrupt(endConversation = true) {
    if (endConversation) {
      continuousRef.current = false;
      setContinuousVoice(false);
    }
    serial.current++;
    realtime.current?.stop();
    realtime.current = null;
    controller.current?.abort();
    controller.current = null;
    clearTimer();
    releaseAudio();
    void recorder.current?.stop(true);
    recorder.current = null;
    locked.current = false;
    setState("idle");
    setLevel(0);
  }
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    void fetch("/local/gabriel/status", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setReady(data.ready))
      .catch(() => {
        if (!abort.signal.aborted) setReady(false);
      });
    const resize = () => setPosition((p) => clamp(p));
    window.addEventListener("resize", resize);
    return () => {
      mounted.current = false;
      abort.abort();
      serial.current++;
      controller.current?.abort();
      realtime.current?.stop();
      workspace.dispose();
      clearTimer();
      releaseAudio();
      void recorder.current?.stop(true);
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    realtime.current?.updateContext({
      firm_id:firmId,
      view: Object.hasOwn(destinations, view) ? view : "dashboard",
      matter_title: matter?.title ?? null,
      document: gabrielDocumentContext(firmId, actorId),
    });
  }, [view, matter?.title,firmId]);
  useEffect(() => {
    const stop = () => realtime.current?.stop();
    window.addEventListener("pagehide", stop);
    return () => window.removeEventListener("pagehide", stop);
  }, []);
  useEffect(() => {
    if (launch) setExpanded(true);
  }, [launch]);
  useEffect(() => {
    if (expanded) input.current?.focus();
  }, [expanded]);
  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [messages, state]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null");
      if (saved?.expires_at > Date.now()) {
        setPremise(saved.question ?? "");
        setAsOf(saved.as_of ?? asuncionDate());
        setTargetMatter(saved.matter_id ?? "");
      }
    } catch {
      /* a malformed draft cannot execute */
    }
  }, [sessionKey]);
  useEffect(() => {
    interrupt();
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(sessionKey + ".conversation") ?? "[]",
      );
      const history: Message[] =
        Array.isArray(saved) &&
        saved.every(
          (m) =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string",
        )
          ? saved
          : [];
      messagesRef.current = history;
      setMessages(history);
    } catch {
      messagesRef.current = [];
      setMessages([]);
    }
  }, [sessionKey]);
  function appendMessage(message: Message) {
    messagesRef.current = [...messagesRef.current, message];
    setMessages(messagesRef.current);
    try {
      sessionStorage.setItem(
        sessionKey + ".conversation",
        JSON.stringify(messagesRef.current),
      );
    } catch {
      /* Keep the full in-memory conversation if browser storage is full. */
    }
  }
  function voiceMessage(
    id: string,
    role: Message["role"],
    content: string,
    final: boolean,
    interrupted = false,
  ) {
    const index = messagesRef.current.findIndex((m) => m.id === id);
    const message: Message = {
      id,
      role,
      content,
      partial: !final,
      interrupted,
      ...(role === "assistant"
        ? { source: "Voz IA · orientación sin fuentes cotejadas" }
        : {}),
    };
    messagesRef.current =
      index < 0
        ? [...messagesRef.current, message]
        : messagesRef.current.map((m, i) => (i === index ? message : m));
    setMessages(messagesRef.current);
    // Streaming updates stay in memory; synchronous browser storage is written
    // once at completed turns instead of serializing the whole chat per token.
    if (final)
      try {
        sessionStorage.setItem(
          sessionKey + ".conversation",
          JSON.stringify(messagesRef.current),
        );
      } catch {}
  }
  useEffect(() => {
    if (premise)
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          question: premise,
          as_of: asOf,
          matter_id: targetMatter,
          expires_at: Date.now() + 1800000,
        }),
      );
  }, [sessionKey, premise, asOf, targetMatter]);
  async function request<T>(
    operation: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<T> {
    const response = await fetch("/local/gabriel/" + operation, {
      method: "POST",
      headers: {
        "Content-Type":
          body instanceof ArrayBuffer ? "audio/wav" : "application/json",
        "X-Gabriel": "1",
        "X-Request-Id": crypto.randomUUID(),
      },
      body: body instanceof ArrayBuffer ? body : JSON.stringify(body),
      signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error ?? "No se pudo completar la petición.");
    return result;
  }
  async function say(reply: string, turn: number, signal: AbortSignal) {
    if (!voiceRef.current || ready !== true || serial.current !== turn) return;
    try {
      setState("thinking");
      const result = await request<{ audio: string; mime: string }>(
        "speech",
        { text: reply },
        signal,
      );
      if (serial.current !== turn || !voiceRef.current) return;
      const bytes = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0));
      audioUrl.current = URL.createObjectURL(
        new Blob([bytes], { type: result.mime }),
      );
      const sound = new Audio(audioUrl.current);
      audio.current = sound;
      sound.onended = () => {
        if (serial.current === turn) {
          releaseAudio();
          setState("idle");
          autoStop.current = setTimeout(() => {
            if (serial.current === turn) resumeListening.current();
          }, 200);
        }
      };
      sound.onerror = () => {
        if (serial.current === turn) {
          releaseAudio();
          setState("idle");
          continuousRef.current = false;
          setContinuousVoice(false);
          setError(
            "No se pudo reproducir la voz. La respuesta está escrita abajo.",
          );
        }
      };
      await sound.play();
      if (serial.current === turn) setState("speaking");
      else {
        sound.pause();
        releaseAudio();
      }
    } catch (reason) {
      if (serial.current === turn) {
        setState("idle");
        continuousRef.current = false;
        setContinuousVoice(false);
        setError(
          reason instanceof Error && reason.name !== "AbortError"
            ? "Voz no disponible: " + reason.message
            : "",
        );
      }
    }
  }
  function propose(value: string) {
    setPremise(value);
    setTargetMatter(matter?.id ?? "");
    setTeamError("");
    if (!dialog.current?.open) dialog.current?.showModal();
  }
  async function respond(question: string, turn: number, signal: AbortSignal) {
    // Connected conversations are interpreted by the model, with their context.
    // Deterministic shortcuts are only an offline fallback.
    const intent =
      ready === true ? { kind: "answer" as const } : classifyGabriel(question);
    let reply = "",
      source = "Ayuda del OS · local";
    const history = messagesRef.current.map(({ role, content }) => ({
      role,
      content,
    }));
    appendMessage({ role: "user", content: question });
    setText("");
    if (intent.kind === "navigate") {
      onNavigate(intent.destination);
      reply = `Abrí ${destinations[intent.destination].label}. ${destinations[intent.destination].description}`;
    } else if (intent.kind === "help")
      reply = destinations[intent.destination].description;
    else if (intent.kind === "team") {
      propose(question);
      reply =
        "Elegí el asunto para continuar con Gabriel. Él elegirá los especialistas necesarios al recibir tu pedido.";
    } else {
      source = "Orientación IA · sin fuentes cotejadas";
      const result = await request<Reply>(
        "chat",
        {
          message: question,
          firm_id: firmId,
          history,
          view: Object.hasOwn(destinations, view) ? view : "dashboard",
          context: { matter_title: matter?.title ?? null },
        },
        signal,
      );
      if (serial.current !== turn) return;
      reply = result.reply;
      if(result.management_actions?.length) window.dispatchEvent(new Event("law-order-work-changed"));
      if (
        result.action === "NAVIGATE" &&
        Object.hasOwn(destinations, result.destination)
      ) {
        onNavigate(result.destination);
        source = "Ayuda del OS";
      }
      if (result.action === "TEAM") {
        continuousRef.current = false;
        setContinuousVoice(false);
        propose(result.analysis_premise);
      }
    }
    if (serial.current !== turn) return;
    appendMessage({ role: "assistant", content: reply, source });
    setState("idle");
    await say(reply, turn, signal);
  }
  async function send(value = text) {
    if (realtime.current && value.trim()) {
      if (realtime.current.sendText(value)) setText("");
      return;
    }
    if (locked.current || !value.trim() || value.length > 2000) return;
    const local = classifyGabriel(value).kind !== "answer";
    if (!local && ready !== true) {
      setError(
        "La conexión IA no está disponible. Podés navegar, pedir ayuda o armar un equipo.",
      );
      return;
    }
    interrupt(false);
    locked.current = true;
    const turn = ++serial.current,
      abort = new AbortController();
    controller.current = abort;
    setState("thinking");
    setError("");
    try {
      await respond(value.trim(), turn, abort.signal);
    } catch (reason) {
      if (serial.current === turn) {
        continuousRef.current = false;
        setContinuousVoice(false);
        setState("idle");
        setText(value);
        setError(
          reason instanceof Error && reason.name !== "AbortError"
            ? reason.message
            : "",
        );
      }
    } finally {
      if (serial.current === turn) locked.current = false;
    }
  }
  async function finishRecording() {
    const recording = recorder.current;
    if (!recording) return;
    recorder.current = null;
    clearTimer();
    const turn = serial.current,
      abort = controller.current!;
    setState("thinking");
    try {
      const wave = await recording.stop();
      if (!wave || serial.current !== turn) return;
      const result = await request<{ text: string }>(
        "transcribe",
        wave,
        abort.signal,
      );
      if (serial.current === turn)
        await respond(result.text, turn, abort.signal);
    } catch (reason) {
      if (serial.current === turn) {
        continuousRef.current = false;
        setContinuousVoice(false);
        setState("idle");
        setError(
          reason instanceof Error && reason.name !== "AbortError"
            ? reason.message
            : "",
        );
      }
    } finally {
      if (serial.current === turn) locked.current = false;
    }
  }
  async function startRecording(inConversation = false) {
    if (state === "listening") {
      await finishRecording();
      return;
    }
    if (ready !== true) {
      continuousRef.current = false;
      setContinuousVoice(false);
      setError(
        "El servidor de voz no está disponible. Podés escribir tu pregunta.",
      );
      setExpanded(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      continuousRef.current = false;
      setContinuousVoice(false);
      setError(
        "Este navegador no permite grabar audio. Abrí el OS en Firefox o Chrome actualizado, o escribí.",
      );
      setExpanded(true);
      return;
    }
    interrupt(!inConversation);
    setExpanded(true);
    setError("");
    locked.current = true;
    const turn = ++serial.current;
    controller.current = new AbortController();
    setState("thinking");
    try {
      const recording = await captureVoice(
        setLevel,
        inConversation ? () => void finishRecording() : undefined,
      );
      if (serial.current !== turn || !mounted.current) {
        await recording.stop(true);
        return;
      }
      recorder.current = recording;
      setSeconds(0);
      setState("listening");
      timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      autoStop.current = setTimeout(() => {
        void finishRecording();
      }, 30000);
    } catch (reason) {
      if (serial.current === turn) {
        continuousRef.current = false;
        setContinuousVoice(false);
        locked.current = false;
        setState("idle");
        setError(
          reason instanceof DOMException && reason.name === "NotAllowedError"
            ? "Permití el micrófono en el navegador para hablar con Gabriel. También podés escribir."
            : "No se pudo abrir el micrófono. Revisá el dispositivo y los permisos.",
        );
      }
    }
  }
  resumeListening.current = () => {
    if (continuousRef.current && mounted.current) void startRecording(true);
  };
  function toggleVoiceConversation() {
    if (continuousRef.current) {
      interrupt();
      return;
    }
    interrupt();
    const turn = ++serial.current;
    continuousRef.current = true;
    setContinuousVoice(true);
    setVoiceMuted(false);
    setVoiceCost(0);
    setError("");
    setExpanded(true);
    voiceRef.current = true;
    setVoice(true);
    const connection = new GabrielRealtime({
      history: messagesRef.current
        .filter((m) => m.content.trim())
        .map(({ role, content, interrupted }) => ({
          role,
          content,
          interrupted,
        })),
      context: {
        firm_id:firmId,
        view: Object.hasOwn(destinations, view) ? view : "dashboard",
        matter_title: matter?.title ?? null,
        document: gabrielDocumentContext(firmId, actorId),
      },
      onState: (value) => {
        if (mounted.current && serial.current === turn) setState(value);
      },
      onMessage: (id, role, content, final, interrupted) => {
        if (mounted.current && serial.current === turn)
          voiceMessage(id, role, content, final, interrupted);
      },
      onError: (message, fatal) => {
        if (mounted.current && serial.current === turn) {
          setError(message);
          if (fatal) {
            continuousRef.current = false;
            setContinuousVoice(false);
            realtime.current = null;
            setState("idle");
          }
        }
      },
      onCost: (value) => {
        if (mounted.current && serial.current === turn) setVoiceCost(value);
      },
      onTool: (name, args) => {
        if (!mounted.current || serial.current !== turn)
          return { error: "La sesión terminó; no se ejecutó la acción." };
        if (isManagementTool(name)) return executeManagement(firmId,name,args);
        if (
          [
            "workspace_documents",
            "read_workspace",
            "delegate_workspace",
          ].includes(name)
        )
          return workspace.tool(name, args, messagesRef.current);
        if (
          name === "navigate_os" &&
          typeof args.destination === "string" &&
          Object.hasOwn(destinations, args.destination)
        ) {
          onNavigate(args.destination);
          return { opened: args.destination };
        }
        if (
          name === "prepare_analysis" &&
          typeof args.premise === "string" &&
          args.premise.trim().length >= 15
        ) {
          propose(args.premise);
          return {
            status: "DRAFT_PREPARED",
            analysis_executed: false,
            requires: "Revisar el encargo y vincularlo a un cliente y asunto.",
          };
        }
        return {
          error: "Acción o datos no válidos; no se ejecutó ningún cambio.",
        };
      },
    });
    realtime.current = connection;
    void connection.start();
  }
  const move = (x: number, y: number, persist = true) => {
    const next = clamp({ x, y });
    setPosition(next);
    if (persist) {
      try {
        localStorage.setItem(positionKey, JSON.stringify(next));
      } catch {
        // Dragging also works when browser storage is blocked or full.
      }
    }
  };
  return (
    <>
      <aside
        className={
          "gabriel-floating is-" + state + (dragging ? " is-dragging" : "")
        }
        style={{ left: position.x, top: position.y }}
        aria-label="Asistente Gabriel"
      >
        <button
          ref={launcher}
          className="gabriel-avatar-button"
          title="Arrastrame para moverme · Clic para conversar"
          aria-expanded={expanded}
          aria-controls="gabriel-conversation"
          aria-label={expanded ? "Minimizar a Gabriel" : "Hablar con Gabriel"}
          aria-describedby="gabriel-drag-instructions"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            suppressClick.current = false;
            drag.current = {
              pointer: e.pointerId,
              dx: e.clientX - position.x,
              dy: e.clientY - position.y,
              startX: e.clientX,
              startY: e.clientY,
              moved: false,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const gesture = drag.current;
            if (!gesture || gesture.pointer !== e.pointerId) return;
            if (
              !gesture.moved &&
              Math.hypot(
                e.clientX - gesture.startX,
                e.clientY - gesture.startY,
              ) < 5
            )
              return;
            gesture.moved = true;
            suppressClick.current = true;
            setDragging(true);
            move(e.clientX - gesture.dx, e.clientY - gesture.dy, false);
          }}
          onPointerUp={(e) => {
            const gesture = drag.current;
            if (gesture?.pointer === e.pointerId && gesture.moved)
              move(e.clientX - gesture.dx, e.clientY - gesture.dy);
            drag.current = null;
            setDragging(false);
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
            suppressClick.current = false;
          }}
          onKeyDown={(e) => {
            const delta = {
              ArrowLeft: [-20, 0],
              ArrowRight: [20, 0],
              ArrowUp: [0, -20],
              ArrowDown: [0, 20],
            }[e.key];
            if (delta) {
              e.preventDefault();
              move(position.x + delta[0]!, position.y + delta[1]!);
            }
          }}
          onClick={(e) => {
            if (suppressClick.current && e.detail !== 0) {
              suppressClick.current = false;
              return;
            }
            suppressClick.current = false;
            if (expanded) interrupt();
            setExpanded(!expanded);
          }}
        >
          <GabrielAvatar state={state} level={level} />
          <span className="gabriel-name">
            Gabriel <i />
          </span>
        </button>
        <span id="gabriel-drag-instructions" className="sr-only">
          Arrastrá directamente el avatar para moverlo, o usá las flechas del
          teclado. Hacé clic para conversar.
        </span>
        <div className="gabriel-mini-controls">
          <button
            aria-label={
              continuousVoice
                ? "Finalizar conversación por voz"
                : "Conversar por voz con Gabriel"
            }
            aria-pressed={continuousVoice}
            onClick={toggleVoiceConversation}
            title={
              continuousVoice
                ? "Finalizar conversación por voz"
                : "Conversar por voz"
            }
          >
            {state === "listening" ? "■" : <MicIcon />}
          </button>
          <button
            onClick={() => {
              localStorage.setItem(
                "law-order.gabriel.voice.v1",
                String(!voice),
              );
              setVoice(!voice);
              if (voice) interrupt();
            }}
            aria-pressed={voice}
            aria-label={
              voice ? "Silenciar voz de Gabriel" : "Activar voz de Gabriel"
            }
            title={voice ? "Silenciar voz" : "Activar voz"}
          >
            <VoiceIcon active={voice} />
          </button>
        </div>
        <span className="gabriel-state" role="status">
          {continuousVoice && !realtime.current?.connected
            ? "Conectando voz…"
            : labels[state]}
          {state === "listening" && !continuousVoice ? ` ${seconds}/30 s` : ""}
        </span>
        {state === "listening" && !continuousVoice && (
          <meter
            className="gabriel-mic-level"
            min={0}
            max={0.15}
            value={level}
            aria-label="Nivel del micrófono"
          />
        )}
      </aside>
      {expanded && (
        <section
          id="gabriel-conversation"
          ref={panel}
          className="gabriel-conversation"
          aria-label="Conversación con Gabriel"
          style={{
            left: Math.max(
              12,
              Math.min(
                window.innerWidth - Math.min(390, window.innerWidth - 24) - 12,
                position.x >= 410 ? position.x - 402 : position.x + gabrielSize.width + 12,
              ),
            ),
            bottom: 12,
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              interrupt();
              setExpanded(false);
              launcher.current?.focus();
            }
          }}
        >
          <header>
            <div>
              <span className="eyebrow">DIRECTOR JURÍDICO · IA</span>
              <h2>Hablemos, ¿qué necesitás?</h2>
            </div>
            <button
              aria-label="Cerrar conversación"
              onClick={() => {
                interrupt();
                setExpanded(false);
                launcher.current?.focus();
              }}
            >
              ×
            </button>
          </header>
          <p className="gabriel-context">
            {matter
              ? "En este asunto · " + matter.title
              : (destinations[view as Destination]?.label ?? "Estudio")}
            <span>Voz generada por IA</span>
          </p>
          <div
            className="gabriel-transcript"
            ref={transcript}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {!messages.length && (
              <div className="gabriel-welcome">
                {premise && (
                  <button onClick={() => dialog.current?.showModal()}>
                    Retomar encargo pendiente ↗
                  </button>
                )}
                <strong>Una pregunta, un atajo o un equipo.</strong>
                <p>
                  Hablame o escribí. Elegí la potencia del análisis y contame qué
                  necesitás; yo elijo los especialistas para el asunto.
                </p>
                <div>
                  {[
                    "¿Qué es una fusión empresarial?",
                    "Abrí Clientes",
                    "¿Para qué sirve Agenda?",
                  ].map((example) => (
                    <button key={example} onClick={() => void send(example)}>
                      {example} ↗
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, i) => (
              <article
                key={i}
                className={"gabriel-message from-" + message.role}
              >
                <small>{message.role === "user" ? "Vos" : "Gabriel"}</small>
                <p>
                  {message.content ||
                    (message.role === "user" ? "Escuchando…" : "…")}
                </p>
                {message.interrupted && <small>Respuesta interrumpida</small>}
                {message.source && <span>{message.source}</span>}
              </article>
            ))}
          </div>
          {error && (
            <p className="gabriel-error" role="alert">
              {error}
            </p>
          )}
          <div className="gabriel-activity" role="status">
            {state === "idle"
              ? ready === false
                ? "Ayuda y navegación local disponibles"
                : "Listo para escucharte"
              : continuousVoice && !realtime.current?.connected
                ? "Conectando voz…"
                : labels[state]}
            {state === "listening" && !continuousVoice && ` · ${seconds}/30 s`}
            {continuousVoice && (
              <small>
                {" "}
                · Voz en vivo · consumo por uso · podés interrumpir hablando
                {voiceMuted ? " · micrófono silenciado" : ""}
                {voiceCost ? ` · estimado USD ${voiceCost.toFixed(3)}` : ""}
              </small>
            )}
            {state !== "idle" && (
              <button
                onClick={() => {
                  if (realtime.current) {
                    if (!realtime.current.connected || state === "listening")
                      interrupt();
                    else realtime.current.interruptResponse();
                  } else interrupt();
                }}
              >
                {continuousVoice && !realtime.current?.connected
                  ? "Cancelar conexión"
                  : continuousVoice && state === "listening"
                    ? "Finalizar escucha"
                    : state === "listening"
                      ? "Cancelar"
                      : continuousVoice
                        ? "Interrumpir y hablar"
                        : "Interrumpir"}
              </button>
            )}
          </div>
          <AnalysisLevelPicker />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="gabriel-input">
              Mensaje para Gabriel
            </label>
            <textarea
              ref={input}
              id="gabriel-input"
              maxLength={2000}
              rows={2}
              placeholder="Preguntá, pedí navegar o planteá un análisis…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="gabriel-compose-actions">
              <button
                type="button"
                aria-pressed={continuousVoice}
                onClick={toggleVoiceConversation}
              >
                {continuousVoice ? "Finalizar voz" : "Conversar por voz"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (realtime.current)
                    setVoiceMuted(realtime.current.toggleMute());
                  else void startRecording();
                }}
                aria-label={
                  continuousVoice
                    ? voiceMuted
                      ? "Activar micrófono"
                      : "Silenciar micrófono"
                    : state === "listening"
                      ? "Terminar grabación y enviar"
                      : "Grabar consulta"
                }
              >
                <MicIcon />
                {continuousVoice
                  ? voiceMuted
                    ? "Activar micrófono"
                    : "Silenciar micrófono"
                  : state === "listening"
                    ? "Terminar"
                    : "Dictar"}
              </button>
              <button
                type="button"
                disabled={
                  !text.trim() && !messages.some((m) => m.role === "user")
                }
                onClick={() => {
                  interrupt();
                  propose(
                    text.trim() ||
                      [...messages].reverse().find((m) => m.role === "user")!
                        .content,
                  );
                }}
              >
                Trabajar en un asunto
              </button>
              <button
                className="primary"
                disabled={
                  (!continuousVoice &&
                    (state === "thinking" || state === "listening")) ||
                  !text.trim()
                }
                type="submit"
              >
                Enviar ↗
              </button>
            </div>
          </form>
          <details className="gabriel-privacy">
            <summary>Alcance y privacidad</summary>
            <p>
              La conversación y el contexto se envían a OpenAI. Cuando pedís
              consultar un documento, se comparte el texto recuperado de ese
              documento o propuesta. Los encargos usan los especialistas y
              controles del workspace, hasta USD 0,60 por encargo, sin aplicar
              cambios al documento. La voz en vivo mantiene el micrófono abierto
              para escuchar interrupciones; «Finalizar voz» lo cierra. El audio
              se procesa en tiempo real y su transcripción queda en esta pestaña
              hasta iniciar otra conversación. Conversar o leer por voz no
              verifica fuentes jurídicas. La voz en vivo se factura por uso y
              muestra un estimado durante la sesión; el trabajo jurídico
              conserva su presupuesto separado. El dictado manual y la lectura
              mantienen la reserva diaria anterior.
            </p>
            <button
              onClick={() => {
                interrupt();
                setMessages([]);
                messagesRef.current = [];
                sessionStorage.removeItem(sessionKey + ".conversation");
                setText("");
                setError("");
              }}
            >
              Nueva conversación
            </button>
          </details>
        </section>
      )}
      <dialog
        ref={dialog}
        className="gabriel-team-dialog"
        aria-labelledby="gabriel-team-title"
        onCancel={(e) => {
          if (teamBusy) e.preventDefault();
        }}
        onClose={() => input.current?.focus()}
      >
        <header>
          <div>
            <span className="eyebrow">TRABAJO JURÍDICO</span>
            <h2 id="gabriel-team-title">Prepará el análisis</h2>
          </div>
          <button
            disabled={teamBusy}
            aria-label="Cerrar propuesta de equipo"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <p>Elegí el asunto. Gabriel decidirá qué especialistas necesita tu pedido dentro del mismo workflow.</p>
        <label>Qué necesitás<textarea rows={3} value={premise} onChange={(e) => setPremise(e.target.value)} /></label>
        <label>Asunto<select value={targetMatter} onChange={(e) => setTargetMatter(e.target.value)}>
          <option value="">Elegí un asunto</option>
          {matters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        <AnalysisLevelPicker />
        <p>El pedido queda listo en el documento para que lo revises y envíes. No se ejecuta al elegir el asunto.</p>
        {teamError && <p role="alert" className="error">{teamError}</p>}
        <button className="primary" disabled={!targetMatter || !premise.trim()} onClick={() => {
          const selected = matters.find((item) => item.id === targetMatter);
          if (!selected) return;
          queueGabrielRequest(selected.id, actorId, premise);
          dialog.current?.close(); interrupt(); setExpanded(false); setPremise("");
          onOpen(selected, "workspace");
        }}>Continuar con Gabriel →</button>
      </dialog>
    </>
  );
}
function VoiceIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="m11 4-5 4H2v8h4l5 4V4Z" />
      {active ? (
        <path d="M15 8a5 5 0 0 1 0 8m3-12a10 10 0 0 1 0 16" />
      ) : (
        <path d="m16 9 6 6m0-6-6 6" />
      )}
    </svg>
  );
}
function MicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" />
    </svg>
  );
}
