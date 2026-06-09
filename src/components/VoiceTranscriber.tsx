'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const modelReady = whisperBrowser.modelReady;

  // Show recorder when: model ready (browser) or API mode, AND idle or recording
  const showRecorder =
    (mode === 'api' || modelReady) &&
    (recorder.state === 'idle' || recorder.state === 'recording');

  // Auto-transcribe when recording stops.
  // Safe from race conditions because handleStart calls recorder.reset()
  // (clearing audioBlob + setting state to idle) before resetting whisper.
  useEffect(() => {
    if (recorder.state === 'stopped' && recorder.audioBlob && activeWhisper.state === 'idle') {
      activeWhisper.transcribe(recorder.audioBlob);
    }
  }, [recorder.state, recorder.audioBlob, activeWhisper]);

  const handleGetReady = () => {
    whisperBrowser.loadModel();
  };

  const handleStart = () => {
    setDismissedError(null);
    // Reset recorder FIRST — clears audioBlob and sets state to idle,
    // preventing the useEffect from re-triggering on stale data
    recorder.reset();
    whisperBrowser.reset();
    whisperAPI.reset();
    setTimeout(() => recorder.start(), 0);
  };

  const handleNewRecording = () => {
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

      {/* Get Ready: shown before model is loaded in browser mode */}
      {mode === 'browser' && !modelReady && whisperBrowser.state === 'idle' && (
        <button
          onClick={handleGetReady}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
          </svg>
          Get ready
        </button>
      )}

      {/* Model download progress */}
      {mode === 'browser' && whisperBrowser.state === 'loading-model' && (
        <div className="w-full rounded-lg border border-gray-700 bg-gray-800/50 p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-200">Preparing speech engine</p>
              <span className="text-sm tabular-nums text-gray-400">{whisperBrowser.modelProgress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${whisperBrowser.modelProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              One-time download (~40 MB). Cached for future use.
            </p>
          </div>
        </div>
      )}

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

      {/* Transcribing spinner */}
      {activeWhisper.state === 'transcribing' && (
        <div className="w-full rounded-lg border border-gray-700 bg-gray-800/50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm text-gray-300">Transcribing audio...</p>
          </div>
        </div>
      )}

      <TranscriptDisplay
        text={activeWhisper.text}
        isProcessing={isProcessing}
        modelProgress={whisperBrowser.modelProgress}
        whisperState={activeWhisper.state}
      />

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
