
import { RecapState } from "../types";

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext | OfflineAudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Applies speed manipulation and professional mastering to a buffer.
 */
export async function applyEffects(
  sourceBuffer: AudioBuffer,
  speed: number = 1.0,
  enableMastering: boolean = true
): Promise<AudioBuffer> {
  // Calculate rendered length based on speed
  const baseLength = Math.ceil(sourceBuffer.length / speed);
  
  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    baseLength,
    sourceBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;
  source.playbackRate.setValueAtTime(speed, offlineCtx.currentTime);

  let inputNode: AudioNode = source;
  let lastNode: AudioNode = source;

  // --- Professional Mastering Chain ---
  if (enableMastering) {
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, offlineCtx.currentTime);
    compressor.knee.setValueAtTime(30, offlineCtx.currentTime);
    compressor.ratio.setValueAtTime(4, offlineCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, offlineCtx.currentTime);
    compressor.release.setValueAtTime(0.25, offlineCtx.currentTime);

    const eqClarity = offlineCtx.createBiquadFilter();
    eqClarity.type = 'highshelf';
    eqClarity.frequency.value = 5000;
    eqClarity.gain.value = 4;

    const eqBody = offlineCtx.createBiquadFilter();
    eqBody.type = 'peaking';
    eqBody.frequency.value = 200;
    eqBody.Q.value = 0.5;
    eqBody.gain.value = 2;

    inputNode.connect(compressor);
    compressor.connect(eqClarity);
    eqClarity.connect(eqBody);
    lastNode = eqBody;
  }

  // Final Limiter to prevent clipping
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-1, offlineCtx.currentTime);
  limiter.knee.setValueAtTime(0, offlineCtx.currentTime);
  limiter.ratio.setValueAtTime(20, offlineCtx.currentTime);
  limiter.attack.setValueAtTime(0, offlineCtx.currentTime);
  limiter.release.setValueAtTime(0.1, offlineCtx.currentTime);

  lastNode.connect(limiter);
  limiter.connect(offlineCtx.destination);
  
  source.start();
  return await offlineCtx.startRendering();
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;
  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); 
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); 
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);
  for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([outBuffer], { type: "audio/wav" });
}
