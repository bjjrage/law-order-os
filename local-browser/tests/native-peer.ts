/** Synthetic audio and a real loopback WebRTC peer; no microphone or provider. */
export function installNativePeer() {
  const Peer = window.RTCPeerConnection;
  const state: any = { sent: [], streams: [] };
  (window as any).__documentVoice = state;
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async () => {
      const audio = new AudioContext(),
        source = audio.createOscillator(),
        sink = audio.createMediaStreamDestination();
      source.connect(sink);
      source.start();
      await audio.resume();
      const stream = sink.stream,
        track = stream.getAudioTracks()[0]!,
        stop = track.stop.bind(track);
      track.stop = () => {
        source.stop();
        void audio.close();
        stop();
      };
      state.streams.push(stream);
      return stream;
    },
  });
  state.answer = async (sdp: string) => {
    const pc = new Peer();
    state.peer = pc;
    pc.ondatachannel = (e) => {
      state.channel = e.channel;
      e.channel.onmessage = (m) => state.sent.push(JSON.parse(m.data));
    };
    const audio = new AudioContext(),
      source = audio.createOscillator(),
      sink = audio.createMediaStreamDestination();
    source.connect(sink);
    source.start();
    await audio.resume();
    state.audio = audio;
    sink.stream.getTracks().forEach((t) => pc.addTrack(t, sink.stream));
    await pc.setRemoteDescription({ type: "offer", sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    if (pc.iceGatheringState !== "complete")
      await new Promise<void>((done) => {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") done();
        };
      });
    return pc.localDescription!.sdp;
  };
  state.emit = (event: unknown) => state.channel.send(JSON.stringify(event));
}
