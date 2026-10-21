/** Bounded mono PCM recording, supported by Firefox as well as Chromium. */
export function encodeVoice(
  samples: Float32Array,
  sourceRate: number,
): ArrayBuffer {
  const rate = 16000,
    count = Math.min(
      30 * rate,
      Math.floor((samples.length * rate) / sourceRate),
    );
  const buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const ascii = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const index = (i * sourceRate) / rate,
      left = Math.floor(index),
      fraction = index - left;
    const value = Math.max(
      -1,
      Math.min(
        1,
        (samples[left] ?? 0) * (1 - fraction) +
          (samples[left + 1] ?? samples[left] ?? 0) * fraction,
      ),
    );
    view.setInt16(
      44 + i * 2,
      Math.round(value * (value < 0 ? 32768 : 32767)),
      true,
    );
  }
  return buffer;
}
export async function captureVoice(
  onLevel: (level: number) => void,
  onEndOfTurn?: () => void,
) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
  let context: AudioContext | null = null;
  try {
    context = new AudioContext();
    await context.resume();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await context?.close().catch(() => {});
    throw error;
  }
  const source = context.createMediaStreamSource(stream),
    processor = context.createScriptProcessor(4096, 1, 1),
    silent = context.createGain();
  silent.gain.value = 0;
  const chunks: Float32Array[] = [];
  let length = 0,
    closed = false,
    speechSamples = 0,
    silenceSamples = 0,
    ended = false;
  processor.onaudioprocess = (event) => {
    const data = event.inputBuffer.getChannelData(0),
      remaining = context.sampleRate * 30 - length;
    if (remaining <= 0 || closed) return;
    const copy = data.slice(0, Math.min(remaining, data.length));
    chunks.push(copy);
    length += copy.length;
    const rms = Math.sqrt(
      copy.reduce((sum, value) => sum + value * value, 0) / copy.length,
    );
    onLevel(rms);
    if (rms > 0.012) {
      speechSamples += copy.length;
      silenceSamples = 0;
    } else silenceSamples += copy.length;
    // Optional hands-free turns. Manual dictation used by the editor is unchanged.
    if (
      onEndOfTurn &&
      !ended &&
      speechSamples >= context.sampleRate * 0.35 &&
      silenceSamples >= context.sampleRate * 1.4
    ) {
      ended = true;
      queueMicrotask(() => {
        if (!closed) onEndOfTurn();
      });
    }
  };
  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);
  return {
    stop: async (discard = false) => {
      if (closed) return null;
      closed = true;
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      silent.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context.close();
      onLevel(0);
      if (discard) return null;
      const samples = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      if (length < context.sampleRate * 0.3)
        throw Error("Hablá durante al menos un segundo y volvé a intentarlo.");
      if (!samples.some((sample) => Math.abs(sample) > 0.005))
        throw Error("No detecté voz. Acercate al micrófono y volvé a hablar.");
      return encodeVoice(samples, context.sampleRate);
    },
  };
}
