export interface TranscriptionResult {
  text: string;
  mode: 'browser' | 'api';
  durationMs: number;
}

export async function audioToFloat32(blob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const float32 = audioBuffer.getChannelData(0); // mono
  audioContext.close();
  return float32;
}
