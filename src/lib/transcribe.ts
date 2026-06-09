export interface TranscriptionResult {
  text: string;
  mode: 'browser' | 'api';
  durationMs: number;
  audioDurationS?: number;
  chunks?: number;
}

export async function audioToFloat32(blob: Blob): Promise<Float32Array> {
  // Decode at browser's native sample rate (don't force 16kHz — many browsers ignore it)
  const audioContext = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const nativeSampleRate = audioBuffer.sampleRate;

  if (nativeSampleRate === 16000) {
    const data = audioBuffer.getChannelData(0);
    audioContext.close();
    return data;
  }

  // Resample to 16kHz using OfflineAudioContext (reliable, browser-native)
  const duration = audioBuffer.duration;
  const targetLength = Math.round(duration * 16000);
  const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const resampled = await offlineCtx.startRendering();
  audioContext.close();
  return resampled.getChannelData(0);
}
