'use client';

import { useState, useEffect } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWhisperBrowser } from '@/hooks/useWhisperBrowser';
import { useWhisperAPI } from '@/hooks/useWhisperAPI';
import AudioRecorder from './AudioRecorder';
import TranscriptDisplay from './TranscriptDisplay';
import ModeToggle from './ModeToggle';

type Mode = 'browser' | 'api';

export default function VoiceTranscriber() {
  const apiAvailable = !!process.env.NEXT_PUBLIC_HAS_API_KEY;
  const [mode, setMode] = useState<Mode>('browser');

  const recorder = useAudioRecorder();
  const whisperBrowser = useWhisperBrowser();
  const whisperAPI = useWhisperAPI();

  const activeWhisper = mode === 'browser' ? whisperBrowser : whisperAPI;
  const isProcessing =
    whisperBrowser.state === 'loading-model' ||
    whisperBrowser.state === 'transcribing' ||
    whisperAPI.state === 'transcribing';

  // Auto-transcribe when recording stops
  useEffect(() => {
    if (recorder.state === 'stopped' && recorder.audioBlob && activeWhisper.state === 'idle') {
      activeWhisper.transcribe(recorder.audioBlob);
    }
  }, [recorder.state, recorder.audioBlob, activeWhisper]);

  const handleStart = () => {
    whisperBrowser.reset();
    whisperAPI.reset();
    recorder.start();
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-100">VoiceTranscriber</h1>

      <ModeToggle mode={mode} onChange={setMode} apiAvailable={apiAvailable} />

      <AudioRecorder
        state={recorder.state}
        elapsedSeconds={recorder.elapsedSeconds}
        onStart={handleStart}
        onStop={recorder.stop}
      />

      {recorder.error && (
        <p className="text-sm text-red-400 text-center">{recorder.error}</p>
      )}

      {activeWhisper.error && (
        <p className="text-sm text-red-400 text-center">{activeWhisper.error}</p>
      )}

      <TranscriptDisplay
        text={activeWhisper.text}
        isProcessing={isProcessing}
        modelProgress={'modelProgress' in whisperBrowser ? whisperBrowser.modelProgress : 0}
        whisperState={activeWhisper.state}
      />
    </div>
  );
}
