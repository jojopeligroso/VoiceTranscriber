'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWhisperBrowser, WHISPER_MODELS, DEFAULT_MODEL_ID, MODEL_STORAGE_KEY } from '@/hooks/useWhisperBrowser';
import { useWhisperAPI } from '@/hooks/useWhisperAPI';
import AudioRecorder from './AudioRecorder';
import TranscriptDisplay from './TranscriptDisplay';
import ModeToggle from './ModeToggle';
import ThemeToggle from './ThemeToggle';
import InstallBanner from './InstallBanner';
import { isInAppBrowser } from '@/lib/utils';
import ModelDownloadProgress from './ModelDownloadProgress';
import ModelSettings from './ModelSettings';
import InfoPanel from './InfoPanel';

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
  const [inAppWarningDismissed, setInAppWarningDismissed] = useState(false);
  const [accumulatedText, setAccumulatedText] = useState('');
  const prevWhisperTextRef = useRef('');
  const inApp = isInAppBrowser();
  const [hasTranscribed, setHasTranscribed] = useState(false);
  const [browserModelId, setBrowserModelId] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_MODEL_ID;
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL_ID;
  });

  const handleModelChange = (id: string) => {
    setBrowserModelId(id);
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  };

  const recorder = useAudioRecorder(maxDuration);
  const whisperBrowser = useWhisperBrowser(browserModelId);
  const whisperAPI = useWhisperAPI(apiEndpoint);

  const activeWhisper = mode === 'browser' ? whisperBrowser : whisperAPI;
  const hasResult = activeWhisper.state === 'done' && !!activeWhisper.text;
  const hasAccumulatedText = !!accumulatedText;
  const modelReady = whisperBrowser.modelReady;

  const showRecorder =
    (mode === 'api' || modelReady) &&
    (recorder.state === 'idle' || recorder.state === 'recording');

  useEffect(() => {
    if (recorder.state === 'stopped' && recorder.audioBlob && activeWhisper.state === 'idle') {
      activeWhisper.transcribe(recorder.audioBlob);
    }
  }, [recorder.state, recorder.audioBlob, activeWhisper]);

  useEffect(() => {
    const newText = activeWhisper.text;
    if (newText && newText !== prevWhisperTextRef.current) {
      setAccumulatedText(prev => prev ? prev + '\n' + newText : newText);
      prevWhisperTextRef.current = newText;
      setHasTranscribed(true);
    }
    if (!newText) {
      prevWhisperTextRef.current = '';
    }
  }, [activeWhisper.text]);

  const handleGetReady = () => {
    whisperBrowser.loadModel();
  };

  const handleStart = () => {
    setDismissedError(null);
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

  const handleClear = useCallback(() => {
    setDismissedError(null);
    setAccumulatedText('');
    prevWhisperTextRef.current = '';
    recorder.reset();
    whisperBrowser.reset();
    whisperAPI.reset();
  }, [recorder, whisperBrowser, whisperAPI]);

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
    <div className={`relative flex flex-col items-center gap-4 w-full max-w-md mx-auto px-4 py-2 sm:px-6 ${className ?? ''}`}>
      <ThemeToggle />
      <h1 className="text-xl font-semibold text-[var(--fg)] text-center w-full" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>VoiceTranscriber</h1>

      {/* In-app browser warning */}
      {inApp && !inAppWarningDismissed && (
        <div className="w-full rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-[var(--accent)]">
              You&apos;re in an in-app browser. The speech model (~150 MB) will need to re-download each visit.
              For the best experience, open this page in your default browser.
            </p>
            <button
              onClick={() => setInAppWarningDismissed(true)}
              className="text-[var(--accent)] opacity-70 hover:opacity-100 text-xs shrink-0 mt-0.5"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <ModeToggle mode={mode} onChange={setMode} apiAvailable={apiAvailable} />

      {/* Get Ready: shown before model is loaded in browser mode */}
      {mode === 'browser' && !modelReady && whisperBrowser.state === 'idle' && (
        <button
          onClick={handleGetReady}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-[#05182e] font-medium hover:opacity-90 transition-opacity"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
          </svg>
          Get ready
        </button>
      )}

      {/* Model download progress */}
      {mode === 'browser' && whisperBrowser.state === 'loading-model' && (
        <ModelDownloadProgress
          progress={whisperBrowser.modelProgress}
          files={whisperBrowser.fileProgresses}
        />
      )}

      {showRecorder && (
        <div className="my-4">
          <AudioRecorder
            state={recorder.state}
            elapsedSeconds={recorder.elapsedSeconds}
            maxDuration={maxDuration}
            onStart={handleStart}
            onStop={recorder.stop}
          />
        </div>
      )}

      {showError && (
        <div className="w-full rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-[var(--red)]">{currentError}</p>
            <button
              onClick={() => setDismissedError(currentError)}
              className="text-[var(--red)] opacity-70 hover:opacity-100 text-xs shrink-0"
            >
              Dismiss
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {activeWhisper.error && recorder.audioBlob && (
              <button
                onClick={handleRetry}
                className="text-xs px-3 py-1 rounded bg-[var(--red)]/20 text-[var(--red)] hover:bg-[var(--red)]/30 transition-colors"
              >
                Retry
              </button>
            )}
            <button
              onClick={handleNewRecording}
              className="text-xs px-3 py-1 rounded bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-alt)] transition-colors"
            >
              New recording
            </button>
          </div>
        </div>
      )}

      {/* Transcribing spinner */}
      {activeWhisper.state === 'transcribing' && (
        <div className="w-full rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0 animate-spin text-[var(--teal)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[var(--fg)]">Transcribing audio...</p>
          </div>
        </div>
      )}

      <TranscriptDisplay
        text={accumulatedText}
        whisperState={activeWhisper.state}
        onClear={hasAccumulatedText ? handleClear : undefined}
        onTextChange={setAccumulatedText}
      />

      {hasResult && (
        <button
          onClick={handleNewRecording}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--surface)] text-sm text-[var(--fg)] hover:bg-[var(--surface-alt)] transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          Record again
        </button>
      )}

      <div className="flex items-center justify-center gap-1">
        <InfoPanel
          mode={mode}
          lastResult={whisperBrowser.lastResult}
          currentModel={WHISPER_MODELS.find(m => m.id === browserModelId)}
        />
        {mode === 'browser' && (
          <ModelSettings
            modelId={browserModelId}
            onChange={handleModelChange}
            disabled={recorder.state === 'recording' || whisperBrowser.state === 'transcribing'}
          />
        )}
      </div>

      <InstallBanner show={hasTranscribed} />
    </div>
  );
}
