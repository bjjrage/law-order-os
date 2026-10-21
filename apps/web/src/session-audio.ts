/** Convert one stored audio segment to a verifiable mono PCM WAV for transcription. */
export async function transcriptionWav(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    context = new AudioContext();
  let audio: AudioBuffer;
  try {
    audio = await context.decodeAudioData(bytes.buffer);
  } finally {
    await context.close();
  }
  const frames = Math.ceil(audio.duration * 16000),
    offline = new OfflineAudioContext(1, frames, 16000),
    source = offline.createBufferSource();
  source.buffer = audio;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering(),
    samples = rendered.getChannelData(0),
    buffer = new ArrayBuffer(44 + samples.length * 2),
    v = new DataView(buffer);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, buffer.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  let binary = "";
  const result = new Uint8Array(buffer);
  for (let i = 0; i < result.length; i += 8192)
    binary += String.fromCharCode(...result.subarray(i, i + 8192));
  return btoa(binary);
}
