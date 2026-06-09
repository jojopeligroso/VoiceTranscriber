'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWhisperBrowser } from '@/hooks/useWhisperBrowser';
import { useWhisperAPI } from '@/hooks/useWhisperAPI';
import AudioRecorder from './AudioRecorder';
import TranscriptDisplay from './TranscriptDisplay';
import ModeToggle from './ModeToggle';

type Mode = 'browser' | 'api';

export interface VoiceTranscriberProps {
  defaultMode?: Mode;
  apiEndpoint?: string;
  maxDuration?: number;
  className?: string;
}

export default function VoiceTranscriber({
  defaultMode = 'browser',
  apiEndpoint,
  maxDuration,
  className,
}: VoiceTranscriberProps = {}) {
  const apiAvailable = !!process.env.NEXT_PUBLIC_HAS_API_KEY;
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const recorder = useAudioRecorder(maxDuration);
  const whisperBrowser = useWhisperBrowser();
  const whisperAPI = useWhisperAPI(apiEndpoint);

  const activeWhisper = mode === 'browser' ? whisperBrowser : whisperAPI;
  const isProcessing =
    whisperBrowser.state === 'loading-model' ||
    whisperBrowser.state === 'transcribing' ||
    whisperAPI.state === 'transcribing';

  const hasResult = activeWhisper.state === 'done' && !!activeWhisper.text;
  const hasError = activeWhisper.state === 'error';

  // Show recorder when idle or recording; hide when processing or showing result
  const showRecorder = recorder.state === 'idle' || recorder.state === 'recording';

  // Gate auto-transcribe to current recording cycle only
  const recordingIdRef = useRef(0);
  const lastBlobIdRef = useRef(0);

  useEffect(() => {
    if (
      recorder.state === 'stopped' &&
      recorder.audioBlob &&
      activeWhisper.state === 'idle' &&
      lastBlobIdRef.current === recordingIdRef.current
    ) {
      activeWhisper.transcribe(recorder.audioBlob);
    }
  }, [recorder.state, recorder.audioBlob, activeWhisper]);

  useEffect(() => {
    if (recorder.audioBlob) {
      lastBlobIdRef.current = recordingIdRef.current;
    }
  }, [recorder.audioBlob]);

  const handleStart = () => {
    recordingIdRef.current++;
    setDismissedError(null);
    recorder.reset();
    whisperBrowser.reset();
    whisperAPI.reset();
    setTimeout(() => recorder.start(), 0);
  };

  const handleNewRecording = () => {
    recordingIdRef.current++;
    setDismissedError(null);
    recorder.reset();
    whisperBrowser.reset();
    whisperAPI.reset();
  };

  const handleRetry = useCallback(() => {
    if (recorder.audioBlob) {
      setDismissedError(null);
      activeWhisper.reset();
      setTimeout(() => {
        if (recorder.audioBlob) activeWhisper.transcribe(recorder.audioBlob);
      }, 50);
    }
  }, [recorder.audioBlob, activeWhisper]);

  const currentError = recorder.error || activeWhisper.error;
  const showError = currentError && currentError !== dismissedError;

  return (
    <div className={`flex flex-col items-center gap-6 w-full max-w-md mx-auto px-4 py-6 sm:px-6 ${className ?? ''}`}>
      <h1 className="text-2xl font-semibold text-gray-100">VoiceTranscriber</h1>

      <ModeToggle mode={mode} onChange={setMode} apiAvailable={apiAvailable} />

      {showRecorder && (
        <AudioRecorder
          state={recorder.state}
          elapsedSeconds={recorder.elapsedSeconds}
          maxDuration={maxDuration}
          onStart={handleStart}
          onStop={recorder.stop}
        />
      )}

      {showError && (
        <div className="w-full rounded-lg border border-red-800/50 bg-red-900/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-red-400">{currentError}</p>
            <button
              onClick={() => setDismissedError(currentError)}
              className="text-red-500 hover:text-red-300 text-xs shrink-0"
            >
              Dismiss
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {activeWhisper.error && recorder.audioBlob && (
              <button
                onClick={handleRetry}
                className="text-xs px-3 py-1 rounded bg-red-800/50 text-red-300 hover:bg-red-800 transition-colors"
              >
                Retry
              </button>
            )}
            <button
              onClick={handleNewRecording}
              className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              New recording
            </button>
          </div>
        </div>
      )}

      <TranscriptDisplay
        text={activeWhisper.text}
        isProcessing={isProcessing}
        modelProgress={whisperBrowser.modelProgress}
        whisperState={activeWhisper.state}
      />

      {/* New recording button after successful transcription */}
      {hasResult && (
        <button
          onClick={handleNewRecording}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-sm text-gray-200 hover:bg-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          Record again
        </button>
      )}

      <p className="text-xs text-gray-600 text-center">
        {mode === 'browser' ? 'Audio stays on your device' : 'Audio sent to OpenAI API'}
        {' \u00B7 English only'}
      </p>
    </div>
  );
}
