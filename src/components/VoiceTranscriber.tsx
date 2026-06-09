'use client';

import { useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWhisperBrowser } from '@/hooks/useWhisperBrowser';
import AudioRecorder from './AudioRecorder';
import TranscriptDisplay from './TranscriptDisplay';

export default function VoiceTranscriber() {
  const recorder = useAudioRecorder();
  const whisper = useWhisperBrowser();

  // Auto-transcribe when recording stops
  useEffect(() => {
    if (recorder.state === 'stopped' && recorder.audioBlob && whisper.state === 'idle') {
      whisper.transcribe(recorder.audioBlob);
    }
  }, [recorder.state, recorder.audioBlob, whisper.state, whisper.transcribe]);

  const handleStart = () => {
    whisper.reset();
    recorder.start();
  };

  const isProcessing = whisper.state === 'loading-model' || whisper.state === 'transcribing';

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-100">VoiceTranscriber</h1>

      <AudioRecorder
        state={recorder.state}
        elapsedSeconds={recorder.elapsedSeconds}
        onStart={handleStart}
        onStop={recorder.stop}
      />

      {recorder.error && (
        <p className="text-sm text-red-400 text-center">{recorder.error}</p>
      )}

      {whisper.error && (
        <p className="text-sm text-red-400 text-center">{whisper.error}</p>
      )}

      <TranscriptDisplay
        text={whisper.text}
        isProcessing={isProcessing}
        modelProgress={whisper.modelProgress}
        whisperState={whisper.state}
      />
    </div>
  );
}
