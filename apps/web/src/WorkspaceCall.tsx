import { useEffect, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { createPortal } from "react-dom";
import {platformRequest} from "./platform-client.js";
import {transcriptionWav} from "./session-audio.js";
type Capture={session_id:string;firm:string;capture_id:string;status:string;recorder:string;participants:{peer_id:string;name:string;consent:string}[]};

type Person = {
  id: string;
  name: string;
  muted: boolean;
  camera?: boolean;
  video?: MediaStream;
  state?: string;
};
type Snapshot = {
  joining: boolean;
  joined: boolean;
  muted: boolean;
  peers: Person[];
  error: string;
  playback: boolean;
  camera: boolean;
  cameraBusy: boolean;
  video: MediaStream | null;
  capture:Capture|null;
  saving:number;
  saved:number;
  recovery:{url:string;name:string}[];
};
const empty = (): Snapshot => ({
  joining: false,
  joined: false,
  muted: true,
  peers: [],
  error: "",
  playback: false,
  camera: false,
  cameraBusy: false,
  video: null,
  capture:null,saving:0,saved:0,recovery:[],
});

/** Uses the document's authenticated channel for signaling; no separate voice identity. */
class DocumentCall {
  recorder:MediaRecorder|null=null;
  mix:AudioContext|null=null;
  destination:MediaStreamAudioDestinationNode|null=null;
  recordingTimer:ReturnType<typeof setTimeout>|undefined;
  recordingSequence=0;
  uploadQueue:Promise<void>=Promise.resolve();
  stopRecording(){clearTimeout(this.recordingTimer);if(this.recorder?.state==="recording")this.recorder.stop();this.recorder=null;void this.mix?.close();this.mix=null;this.destination=null;}
  record(){
    const capture=this.state.capture;if(!capture||capture.status!=="RECORDING"||capture.recorder!==this.self||this.recorder)return;
    try{
      if(!window.MediaRecorder||!this.stream)throw Error("Este navegador no puede grabar la sesión.");
      this.mix??=new AudioContext();this.destination??=this.mix.createMediaStreamDestination();
      if(!this.recordingSequence){this.mix.createMediaStreamSource(this.stream).connect(this.destination);for(const p of this.peers.values())if(p.audio.srcObject instanceof MediaStream)this.mix.createMediaStreamSource(p.audio.srcObject).connect(this.destination)}
      const mime=["audio/webm;codecs=opus","audio/ogg;codecs=opus"].find(m=>MediaRecorder.isTypeSupported(m));if(!mime)throw Error("No hay un formato de grabación compatible.");
      const recorder=new MediaRecorder(this.destination.stream,{mimeType:mime,audioBitsPerSecond:64000}),sequence=this.recordingSequence++,chunks:BlobPart[]=[];this.recorder=recorder;
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      recorder.onerror=()=>{this.state.error="La grabación se interrumpió. Revisá los segmentos guardados.";this.send({event:"record-stop"});this.stopRecording();this.emit()};
      recorder.onstop=()=>{
        const blob=new Blob(chunks,{type:mime.split(";")[0]}),name=`sesion-${capture.session_id}-${sequence}.${mime.includes("ogg")?"ogg":"webm"}`;this.state.saving++;this.emit();
        this.uploadQueue=this.uploadQueue.catch(()=>{}).then(async()=>{try{const bytes=new Uint8Array(await blob.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const pcm=await transcriptionWav(btoa(binary));await platformRequest("recording-upload",{firm:capture.firm,session_id:capture.session_id,capture_id:capture.capture_id,sequence,mime:"audio/wav",base64:pcm});this.state.saved++}catch{this.state.error="No se pudo guardar un segmento. Descargalo para conservarlo y volvé a intentar la conexión.";this.state.recovery.push({url:URL.createObjectURL(blob),name})}finally{this.state.saving--;this.emit()}});
        if(this.recorder===recorder){this.recorder=null;if(this.state.capture?.capture_id===capture.capture_id&&this.state.capture.status==="RECORDING")this.record()}
      };
      recorder.start();void this.mix.resume();this.recordingTimer=setTimeout(()=>{if(recorder.state==="recording")recorder.stop()},60000);
    }catch(e){this.state.error=(e as Error).message;this.send({event:"record-stop"});this.stopRecording();this.emit()}
  }
  state = empty();
  stream: MediaStream | null = null;
  video: MediaStream | null = null;
  self = "";
  epoch = 0;
  timer: ReturnType<typeof setTimeout> | undefined;
  peers = new Map<
    string,
    {
      pc: RTCPeerConnection;
      audio: HTMLAudioElement;
      pending: RTCIceCandidateInit[];
      queue: Promise<void>;
    }
  >();
  constructor(
    private provider: HocuspocusProvider,
    private output: HTMLElement,
    private update: (s: Snapshot) => void,
  ) {
    provider.on("stateless", this.receive);
    provider.on("status", this.status);
    provider.on("close", this.disconnect);
    provider.on("authenticationFailed", this.disconnect);
  }
  emit() {
    this.update({ ...this.state, peers: [...this.state.peers] });
  }
  send(message: object) {
    this.provider.sendStateless(JSON.stringify({ kind: "call", ...message }));
  }
  status = ({ status }: { status: string }) => {
    if (status !== "connected") this.disconnect();
  };
  disconnect = () => {
    if (this.state.joined || this.state.joining)
      this.leave(
        "La conexión se interrumpió. Volvé a unirte cuando el documento reconecte.",
      );
  };
  remove(id: string) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
      peer.audio.pause();
      peer.audio.srcObject = null;
      peer.audio.remove();
      this.peers.delete(id);
    }
    this.state.peers = this.state.peers.filter((p) => p.id !== id);
  }
  leave(error = "", notify = true) {
    this.stopRecording();
    ++this.epoch;
    clearTimeout(this.timer);
    if (notify && (this.state.joined || this.state.joining))
      try {
        this.send({ event: "leave" });
      } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video?.getTracks().forEach((t) => t.stop());
    this.video = null;
    for (const id of [...this.peers.keys()]) this.remove(id);
    this.self = "";
    this.state = { ...empty(), error, saving:this.state.saving,saved:this.state.saved,recovery:this.state.recovery };
    this.emit();
  }
  async join() {
    if (this.state.joined || this.state.joining) return;
    this.leave();
    this.state.joining = true;
    this.emit();
    const turn = this.epoch;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
        throw Error(
          "La llamada necesita un navegador compatible y localhost o HTTPS.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (this.epoch !== turn) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!stream.getAudioTracks().length)
        throw Error("No se encontró un micrófono.");
      this.stream = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = false;
        t.onended = () => {
          if (this.epoch === turn)
            this.leave("El micrófono se desconectó. Volvé a unirte.");
        };
      });
      this.send({ event: "join" });
      this.timer = setTimeout(() => {
        if (this.epoch === turn && this.state.joining)
          this.leave(
            "La sala no respondió. Verificá la conexión y volvé a unirte.",
          );
      }, 12000);
    } catch (e) {
      if (this.epoch === turn)
        this.leave(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Permití el micrófono en el navegador para unirte a la llamada."
            : e instanceof Error
              ? e.message
              : "No se pudo abrir el micrófono.",
        );
    }
  }
  mute() {
    if (!this.state.joined) return;
    this.state.muted = !this.state.muted;
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !this.state.muted;
    });
    this.send({ event: "mute", muted: this.state.muted });
    this.emit();
  }
  async camera() {
    if (!this.state.joined || this.state.cameraBusy) return;
    if (this.state.camera) {
      this.video?.getTracks().forEach((t) => t.stop());
      this.video = null;
      this.state.video = null;
      this.state.camera = false;
      for (const { pc } of this.peers.values()) {
        const sender = pc
          .getTransceivers()
          .find((t) => t.receiver.track.kind === "video")?.sender;
        void sender?.replaceTrack(null).catch(() => {});
      }
      this.send({ event: "camera", camera: false });
      this.emit();
      return;
    }
    const turn = this.epoch;
    this.state.cameraBusy = true;
    this.state.error = "";
    this.emit();
    let captured: MediaStream | null = null;
    try {
      if (!this.state.camera) {
        captured = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 320 },
            height: { ideal: 320 },
            frameRate: { ideal: 15, max: 20 },
            facingMode: "user",
          },
        });
        if (turn !== this.epoch) {
          captured.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!captured.getVideoTracks().length)
          throw Error("No se encontró una cámara.");
      }
      const track = captured?.getVideoTracks()[0] ?? null;
      await Promise.all(
        [...this.peers.values()].map(({ pc }) => {
          const sender = pc
            .getTransceivers()
            .find((t) => t.receiver.track.kind === "video")?.sender;
          return sender?.replaceTrack(track);
        }),
      );
      if (turn !== this.epoch) {
        captured?.getTracks().forEach((t) => t.stop());
        return;
      }
      this.video?.getTracks().forEach((t) => t.stop());
      this.video = captured;
      this.state.video = captured;
      this.state.camera = !!track;
      if (track)
        track.onended = () => {
          if (turn === this.epoch && this.state.camera) void this.camera();
        };
      this.send({ event: "camera", camera: this.state.camera });
    } catch (e) {
      captured?.getTracks().forEach((t) => t.stop());
      if (turn === this.epoch)
        this.state.error =
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Permití la cámara en el navegador para compartir tu imagen."
            : "No se pudo activar la cámara. Verificá que esté disponible y volvé a intentar.";
    } finally {
      if (turn === this.epoch) {
        this.state.cameraBusy = false;
        this.emit();
      }
    }
  }
  async play() {
    const results = await Promise.allSettled(
      [...this.peers.values()]
        .filter((p) => p.audio.srcObject)
        .map((p) => p.audio.play()),
    );
    this.state.playback = results.some((r) => r.status === "rejected");
    this.emit();
  }
  peer(id: string) {
    let peer = this.peers.get(id);
    if (peer) return peer;
    const pc = new RTCPeerConnection({ iceServers: [] });
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.dataset.callPeer = id;
    this.output.append(audio);
    peer = { pc, audio, pending: [], queue: Promise.resolve() };
    this.peers.set(id, peer);
    this.stream!.getTracks().forEach((t) => pc.addTrack(t, this.stream!));
    const turn = this.epoch;
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.epoch === turn)
        this.send({ event: "signal", to: id, candidate: candidate.toJSON() });
    };
    pc.ontrack = ({ track }) => {
      if (this.epoch !== turn) return;
      if (track.kind === "video") {
        const p = this.state.peers.find((p) => p.id === id);
        if (p) p.video = new MediaStream([track]);
        this.emit();
        return;
      }
      audio.srcObject = new MediaStream([track]);
      if(this.mix&&this.destination)this.mix.createMediaStreamSource(audio.srcObject).connect(this.destination);
      void audio.play().catch(() => {
        if (this.epoch === turn) {
          this.state.playback = true;
          this.emit();
        }
      });
    };
    pc.onconnectionstatechange = () => {
      if (this.epoch !== turn) return;
      const p = this.state.peers.find((p) => p.id === id);
      if (p) p.state = pc.connectionState;
      if (pc.connectionState === "failed")
        this.state.error =
          "No se pudo conectar el audio con un participante. Salgan y vuelvan a unirse; entre redes distintas puede requerirse un servidor de retransmisión.";
      this.emit();
    };
    return peer;
  }
  receive = ({ payload }: { payload: string }) => {
    let m;
    try {
      m = JSON.parse(payload);
    } catch {
      return;
    }
    if (m.kind !== "call" || (!this.state.joined && !this.state.joining))
      return;
    if (m.event === "ended" || m.event === "error") {
      this.leave(
        m.code === "CALL_FULL"
          ? "La llamada admite hasta 6 personas."
          : "La llamada terminó o tu acceso al documento ya no está disponible.",
      );
      return;
    }
    if (m.event === "joined") {
      clearTimeout(this.timer);
      this.self = m.self.id;
      this.state.joined = true;
      this.state.joining = false;
      this.state.peers = m.peers;
      this.emit();
      return;
    }
    if (!this.state.joined) return;
    if(m.event==="recording_error"){this.state.error="No se pudo registrar la grabación. La llamada sigue disponible.";this.emit();return}
    if(m.event==="recording"){
      const changed=this.state.capture?.capture_id!==m.capture?.capture_id;this.state.capture=m.capture;
      if(changed){this.stopRecording();this.recordingSequence=0}
      if(m.capture?.status==="RECORDING")this.record();else this.stopRecording();this.emit();return;
    }
    if (m.event === "left") {
      this.remove(m.id);
      this.emit();
      return;
    }
    if (m.event === "mute") {
      const p = this.state.peers.find((p) => p.id === m.id);
      if (p) p.muted = m.muted;
      this.emit();
      return;
    }
    if (m.event === "camera") {
      const p = this.state.peers.find((p) => p.id === m.id);
      if (p) p.camera = m.camera === true;
      this.emit();
      return;
    }
    const turn = this.epoch;
    if (m.event === "peer") {
      if (this.state.peers.some((p) => p.id === m.peer.id)) return;
      this.state.peers.push(m.peer);
      this.emit();
      const peer = this.peer(m.peer.id);
      peer.pc.addTransceiver(this.video?.getVideoTracks()[0] ?? "video", {
        direction: "sendrecv",
      });
      peer.queue = peer.queue
        .then(async () => {
          if (this.epoch !== turn) return;
          await peer.pc.setLocalDescription(await peer.pc.createOffer());
          if (this.epoch === turn)
            this.send({
              event: "signal",
              to: m.peer.id,
              description: peer.pc.localDescription?.toJSON(),
            });
        })
        .catch(() => {
          if (this.epoch === turn) {
            this.state.error =
              "No se pudo preparar el audio. Salí y volvé a unirte.";
            this.emit();
          }
        });
    } else if (
      m.event === "signal" &&
      this.state.peers.some((p) => p.id === m.from)
    ) {
      const peer = this.peer(m.from);
      peer.queue = peer.queue
        .then(async () => {
          if (this.epoch !== turn) return;
          if (m.description) {
            await peer.pc.setRemoteDescription(m.description);
            if (m.description.type === "offer") {
              const video = peer.pc
                .getTransceivers()
                .find((t) => t.receiver.track.kind === "video");
              if (video) {
                video.direction = "sendrecv";
                await video.sender.replaceTrack(
                  this.video?.getVideoTracks()[0] ?? null,
                );
              }
            }
            for (const candidate of peer.pending.splice(0))
              await peer.pc.addIceCandidate(candidate);
            if (m.description.type === "offer") {
              await peer.pc.setLocalDescription(await peer.pc.createAnswer());
              if (this.epoch === turn)
                this.send({
                  event: "signal",
                  to: m.from,
                  description: peer.pc.localDescription?.toJSON(),
                });
            }
          } else if (m.candidate) {
            if (peer.pc.remoteDescription)
              await peer.pc.addIceCandidate(m.candidate);
            else if (peer.pending.length < 64) peer.pending.push(m.candidate);
          }
        })
        .catch(() => {
          if (this.epoch === turn) {
            this.state.error =
              "Se interrumpió la negociación de audio. Salí y volvé a unirte.";
            this.emit();
          }
        });
    }
  };
  destroy() {
    this.leave();
    this.provider.off("stateless", this.receive);
    this.provider.off("status", this.status);
    this.provider.off("close", this.disconnect);
    this.provider.off("authenticationFailed", this.disconnect);
  }
}

function CallBubble({
  person,
  index,
  local,
  busy,
  onCamera,
  onMute,
  onLeave,
  onOpen,
}: {
  person: Person;
  index: number;
  local?: boolean;
  busy?: boolean;
  onCamera?: () => void;
  onMute?: () => void;
  onLeave?: () => void;
  onOpen?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState(() => ({
    x: window.innerWidth - 124 - (index % 3) * 116,
    y: window.innerHeight - 178 - Math.floor(index / 3) * 156,
  }));
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  function bounded(x: number, y: number) {
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - 112)),
      y: Math.max(8, Math.min(y, window.innerHeight - 150)),
    };
  }
  useEffect(() => {
    const resize = () => setPosition((p) => bounded(p.x, p.y));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = person.video ?? null;
    if (person.video) void element.play().catch(() => {});
    return () => {
      element.srcObject = null;
    };
  }, [person.video, person.camera]);
  const initials = person.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className="workspace-call-bubble"
      style={{ left: position.x, top: position.y }}
      role="group"
      tabIndex={0}
      aria-label={`${person.name}${local ? " · vos" : ""}. ${person.camera ? "Cámara activa" : "Cámara apagada"}. ${person.muted ? "Micrófono apagado" : "Micrófono activo"}. Mové con las flechas o arrastrá.`}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const movement: Record<string, [number, number]> = {
          ArrowLeft: [-16, 0],
          ArrowRight: [16, 0],
          ArrowUp: [0, -16],
          ArrowDown: [0, 16],
        };
        const step = movement[e.key];
        if (!step) return;
        e.preventDefault();
        setPosition((p) => bounded(p.x + step[0], p.y + step[1]));
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest("button"))
          return;
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          left: position.x,
          top: position.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (start)
          setPosition(
            bounded(
              start.left + e.clientX - start.x,
              start.top + e.clientY - start.y,
            ),
          );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
    >
      <div
        className={`workspace-call-face${person.camera ? " has-camera" : ""}${local ? " is-local" : ""}`}
      >
        {person.camera && person.video ? (
          <video ref={video} autoPlay muted playsInline aria-hidden="true" />
        ) : (
          <span className="workspace-call-initials" aria-hidden="true">
            {initials}
          </span>
        )}
        <span className="workspace-call-name">
          {local ? "Vos" : person.name}
        </span>
        {person.muted && (
          <span className="workspace-call-muted" aria-hidden="true">
            ◌
          </span>
        )}
      </div>
      {local && (
        <div className="workspace-call-bubble-controls">
          <button
            aria-label={
              person.muted ? "Activar micrófono" : "Silenciar micrófono"
            }
            aria-pressed={!person.muted}
            onClick={onMute}
          >
            {person.muted ? "Mic /" : "Mic"}
          </button>
          <button
            disabled={busy}
            aria-label={person.camera ? "Apagar cámara" : "Activar cámara"}
            aria-pressed={!!person.camera}
            onClick={onCamera}
          >
            Cam
          </button>
          <button aria-label="Opciones de llamada" onClick={onOpen}>
            ···
          </button>
          <button
            className="workspace-call-hangup"
            aria-label="Salir de la llamada"
            onClick={onLeave}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceCall({
  provider,
  enabled,
  name,
}: {
  provider: HocuspocusProvider;
  enabled: boolean;
  name: string;
}) {
  const [open, setOpen] = useState(false),
    [state, setState] = useState(empty);
  const output = useRef<HTMLDivElement>(null),
    session = useRef<DocumentCall | null>(null);
  useEffect(() => {
    if (!output.current) return;
    const call = new DocumentCall(provider, output.current, setState);
    session.current = call;
    const unload = () => call.leave();
    window.addEventListener("pagehide", unload);
    return () => {
      window.removeEventListener("pagehide", unload);
      call.destroy();
      session.current = null;
    };
  }, [provider]);
  useEffect(() => {
    if (!enabled)
      session.current?.leave(
        "Reconectá el documento antes de unirte a la llamada.",
      );
  }, [enabled]);
  useEffect(() => {
    if (state.error) setOpen(true);
  }, [state.error]);
  const total = state.joined ? state.peers.length + 1 : 0;
  return (
    <>
      <button
        type="button"
        className="workspace-call-toggle"
        aria-expanded={open}
        aria-label={
          total ? `Llamada · ${total} personas` : "Llamada del documento"
        }
        onClick={() => setOpen(!open)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C10 21 3 14 3 5a2 2 0 0 1 2-2Z" />
        </svg>{" "}
        {state.capture?.status==="RECORDING"?<strong className="workspace-recording-label">● Grabando</strong>:"Llamada"}{total ? ` · ${total}` : ""}
      </button>
      {createPortal(
        <>
          <div ref={output} className="workspace-call-audio" hidden />
          {state.joined && (
            <>
              <CallBubble
                person={{
                  id: "self",
                  name,
                  muted: state.muted,
                  camera: state.camera,
                  video: state.video ?? undefined,
                }}
                index={0}
                local
                busy={state.cameraBusy}
                onMute={() => session.current?.mute()}
                onCamera={() => void session.current?.camera()}
                onLeave={() => session.current?.leave()}
                onOpen={() => setOpen(true)}
              />
              {state.peers.map((person, index) => (
                <CallBubble key={person.id} person={person} index={index + 1} />
              ))}
            </>
          )}
          {open && (
            <section
              className="workspace-call-panel"
              aria-label="Llamada entre colaboradores"
            >
              <header>
                <strong>Llamada del documento</strong>
                <button
                  aria-label="Plegar llamada"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </header>
              <p>
                Conversá con las personas que abrieron este mismo documento.
                Invitalas desde Compartir.
              </p>
              {state.joined ? (
                <>
                  <ul aria-label="Personas en la llamada">
                    <li>
                      <strong>{name} · vos</strong>
                      <span>
                        {state.muted ? "Micrófono apagado" : "Micrófono activo"}
                      </span>
                    </li>
                    {state.peers.map((p) => (
                      <li key={p.id}>
                        <strong>{p.name}</strong>
                        <span>
                          {p.state === "connected"
                            ? p.muted
                              ? "Micrófono apagado"
                              : "Audio conectado"
                            : p.state === "failed"
                              ? "Sin conexión de audio"
                              : "Conectando audio…"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!state.peers.length && (
                    <small>Estás en la sala. Esperando a otra persona.</small>
                  )}
                  <div className="workspace-call-controls">
                    {(!state.capture||state.capture.status==="STOPPED")&&<button onClick={()=>session.current?.send({event:"record-request"})}>Solicitar grabación de audio</button>}
                    {state.capture?.status==="CONSENTING"&&<div role="status"><strong>Se solicita grabar esta sesión.</strong><p>El audio se guardará en el asunto. La transcripción IA requiere una acción posterior.</p><button onClick={()=>session.current?.send({event:"record-consent",capture_id:state.capture?.capture_id,accept:true})}>Acepto la grabación</button><button onClick={()=>session.current?.send({event:"record-consent",capture_id:state.capture?.capture_id,accept:false})}>No acepto</button><p>{state.capture.participants.map(p=>`${p.name}: ${p.consent==="ACCEPTED"?"aceptó":p.consent==="DECLINED"?"rechazó":"pendiente"}`).join(" · ")}</p></div>}
                    {state.capture?.status==="RECORDING"&&<div className="workspace-recording-indicator" role="status"><strong>● Grabando audio de la sesión</strong><button onClick={()=>session.current?.send({event:"record-stop"})}>Detener grabación</button></div>}
                    <button
                      disabled={state.cameraBusy}
                      aria-pressed={state.camera}
                      onClick={() => void session.current?.camera()}
                    >
                      {state.cameraBusy
                        ? "Preparando cámara…"
                        : state.camera
                          ? "Apagar cámara"
                          : "Activar cámara"}
                    </button>
                    <button
                      aria-pressed={!state.muted}
                      onClick={() => session.current?.mute()}
                    >
                      {state.muted
                        ? "Activar micrófono"
                        : "Silenciar micrófono"}
                    </button>
                    <button onClick={() => session.current?.leave()}>
                      Salir de la llamada
                    </button>
                  </div>
                  {state.playback && (
                    <button onClick={() => void session.current?.play()}>
                      Activar audio recibido
                    </button>
                  )}
                </>
              ) : (
                <button
                  disabled={!enabled || state.joining}
                  onClick={() => void session.current?.join()}
                >
                  {state.joining
                    ? "Conectando llamada…"
                    : "Unirse a la llamada"}
                </button>
              )}
              {state.joining && (
                <button onClick={() => session.current?.leave()}>
                  Cancelar llamada
                </button>
              )}
              {state.error && <p role="alert">{state.error}</p>}
              <small>
                Audio y video entre personas. Solo se graba audio cuando todos aceptan. Entrás con micrófono y cámara apagados. Arrastrá los
                círculos para acomodarlos. Entorno local, hasta 6 personas.
              </small>
              {(state.saved>0||state.saving>0)&&<p role="status">{state.saved} segmentos guardados · {state.saving} por guardar. Revisalos en Gestión del asunto → Sesiones.</p>}
              {state.recovery.map(r=><p key={r.url}><a href={r.url} download={r.name}>Descargar segmento pendiente de recuperación</a></p>)}
            </section>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
