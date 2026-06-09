'use client';

import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import AudioRecorder from './AudioRecorder';

export default function VoiceTranscriber() {
  const { start, stop, audioBlob, state, elapsedSeconds, error } = useAudioRecorder();

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-100">VoiceTranscriber</h1>

      <AudioRecorder
        state={state}
        elapsedSeconds={elapsedSeconds}
        onStart={start}
        onStop={stop}
      />

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      {audioBlob && state === 'stopped' && (
        <p className="text-sm text-gray-400">
          Audio captured: {(audioBlob.size / 1024).toFixed(1)} KB
        </p>
      )}
    </div>
  );
}
