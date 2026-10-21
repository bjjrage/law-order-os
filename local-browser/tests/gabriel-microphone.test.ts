import { afterEach, expect, it, vi } from "vitest";
import { captureVoice } from "../../apps/web/src/gabriel-audio.js";
afterEach(() => vi.unstubAllGlobals());
function microphone() {
  const stop = vi.fn(),
    disconnect = vi.fn(),
    close = vi.fn(async () => {});
  const processor = {
    connect: vi.fn(),
    disconnect,
    onaudioprocess: null as
      | ((event: {
          inputBuffer: { getChannelData: () => Float32Array };
        }) => void)
      | null,
  };
  const node = { connect: vi.fn(), disconnect, gain: { value: 1 } };
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })),
    },
  });
  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 16000;
      destination = {};
      resume = vi.fn(async () => {});
      close = close;
      createMediaStreamSource = () => node;
      createScriptProcessor = () => processor;
      createGain = () => node;
    },
  );
  return { stop, close, processor };
}
it("cancel releases microphone tracks and context exactly once, returning no audio to upload", async () => {
  const fake = microphone(),
    recorder = await captureVoice(vi.fn());
  expect(await recorder.stop(true)).toBeNull();
  expect(await recorder.stop(true)).toBeNull();
  expect(fake.stop).toHaveBeenCalledTimes(1);
  expect(fake.close).toHaveBeenCalledTimes(1);
  expect(fake.processor.onaudioprocess).toBeNull();
});
it("rejects silence while still closing the device; spoken samples produce WAV", async () => {
  const fake = microphone(),
    recorder = await captureVoice(vi.fn());
  fake.processor.onaudioprocess!({
    inputBuffer: { getChannelData: () => new Float32Array(16000) },
  });
  await expect(recorder.stop()).rejects.toThrow("No detecté voz");
  expect(fake.stop).toHaveBeenCalledTimes(1);
  const spoken = await captureVoice(vi.fn());
  fake.processor.onaudioprocess!({
    inputBuffer: { getChannelData: () => new Float32Array(16000).fill(0.1) },
  });
  expect((await spoken.stop())?.byteLength).toBe(32044);
});
it("handles denied microphone and context initialization failure without leaking tracks", async () => {
  const fake = microphone();
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        throw Error("No audio device");
      }
    },
  );
  await expect(captureVoice(vi.fn())).rejects.toThrow("No audio device");
  expect(fake.stop).toHaveBeenCalledTimes(1);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        throw new DOMException("Denied", "NotAllowedError");
      }),
    },
  });
  await expect(captureVoice(vi.fn())).rejects.toMatchObject({
    name: "NotAllowedError",
  });
});
it("ends hands-free turns after speech and a pause, never on initial silence or after cancellation", async () => {
  const fake = microphone(),
    ended = vi.fn(),
    recorder = await captureVoice(vi.fn(), ended);
  const feed = (seconds: number, value: number) =>
    fake.processor.onaudioprocess!({
      inputBuffer: {
        getChannelData: () =>
          new Float32Array(Math.round(16000 * seconds)).fill(value),
      },
    });
  feed(2, 0);
  await Promise.resolve();
  expect(ended).not.toHaveBeenCalled();
  feed(0.5, 0.1);
  feed(1, 0);
  await Promise.resolve();
  expect(ended).not.toHaveBeenCalled();
  feed(0.5, 0);
  await Promise.resolve();
  expect(ended).toHaveBeenCalledTimes(1);
  feed(1, 0);
  await Promise.resolve();
  expect(ended).toHaveBeenCalledTimes(1);
  await recorder.stop(true);
  const canceled = await captureVoice(vi.fn(), ended);
  feed(0.5, 0.1);
  feed(1.5, 0);
  await canceled.stop(true);
  await Promise.resolve();
  expect(ended).toHaveBeenCalledTimes(1);
});
