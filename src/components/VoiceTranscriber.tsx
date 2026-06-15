'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWhisperBrowser, WHISPER_MODELS, DEFAULT_MODEL_ID, MODEL_STORAGE_KEY, isIOS, isIOSCompatibleModel, type FileProgress, type WhisperModel } from '@/hooks/useWhisperBrowser';
import { useWhisperAPI } from '@/hooks/useWhisperAPI';
import type { TranscriptionResult } from '@/lib/transcribe';
import AudioRecorder from './AudioRecorder';
import TranscriptDisplay from './TranscriptDisplay';
import ModeToggle from './ModeToggle';
import ThemeToggle from './ThemeToggle';

type Mode = 'browser' | 'api';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Telegram|Twitter|Line|WhatsApp|Snapchat|WeChat|MicroMessenger/i.test(ua);
}

// On iOS only Tiny and Base are offered (Small exceeds Safari's memory ceiling).
function modelsForPlatform(): WhisperModel[] {
  return isIOS() ? WHISPER_MODELS.filter((m) => isIOSCompatibleModel(m.id)) : WHISPER_MODELS;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ModelDownloadProgress({ progress, files }: { progress: number; files: FileProgress[] }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="w-full rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--fg)]">Preparing speech engine</p>
          <span className="text-sm tabular-nums text-[var(--muted)]">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-[var(--surface-alt)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--teal)] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">
            One-time download. Cached for future use.
          </p>
          {files.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex items-center gap-1"
            >
              {files.length} files
              <svg
                className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
        {showDetails && files.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--surface-alt)]">
            {files.map((f) => (
              <div key={f.name} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.done ? 'bg-[var(--teal)]' : 'bg-[var(--accent)] animate-pulse'}`} />
                <span className="text-[var(--muted)] truncate flex-1">{f.name}</span>
                <span className="text-[var(--muted)] tabular-nums shrink-0">
                  {formatBytes(f.loaded)} / {formatBytes(f.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelSettings({ modelId, onChange, disabled, models, note }: { modelId: string; onChange: (id: string) => void; disabled: boolean; models: WhisperModel[]; note?: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = models.find(m => m.id === modelId) ?? WHISPER_MODELS.find(m => m.id === modelId);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`p-1.5 rounded-md transition-colors ${open ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
        title="Model settings"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)] p-3 shadow-lg z-20">
          <p className="text-xs font-medium text-[var(--fg)] mb-2">Speech model</p>
          {current && (
            <p className="text-xs text-[var(--muted)] mb-3">
              Current: {current.label} ({current.lang}) — {current.size}
            </p>
          )}
          <div className="flex flex-col gap-1">
            {models.map(m => (
              <button
                key={m.id}
                disabled={disabled && m.id !== modelId}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={`flex items-center justify-between px-2.5 py-2 rounded-md text-left text-xs transition-colors ${
                  m.id === modelId
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : disabled
                      ? 'text-[var(--muted)]/50 cursor-not-allowed'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--fg)]'
                }`}
              >
                <span className="font-medium">{m.label} <span className="font-normal">— {m.lang}</span></span>
                <span className="tabular-nums">{m.size}</span>
              </button>
            ))}
          </div>
          {note && (
            <p className="text-xs text-[var(--muted)] mt-2 italic">
              {note}
            </p>
          )}
          {disabled && (
            <p className="text-xs text-[var(--muted)] mt-2 italic">
              Stop recording to change model
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoPanel({ mode, lastResult, currentModel }: { mode: Mode; lastResult: TranscriptionResult | null; currentModel?: WhisperModel }) {
  const [expanded, setExpanded] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <div className="text-xs text-[var(--muted)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center gap-1.5 py-1 hover:text-[var(--fg)] transition-colors"
      >
        <span>Tips & info</span>
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)] space-y-4">
          <div>
            <p className="font-medium text-[var(--accent)] mb-1.5">How it works</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong className="text-[var(--fg)]">Tap Get Ready</strong> — allow microphone access when prompted</li>
              <li><strong className="text-[var(--fg)]">Speak clearly</strong> — the app records audio locally on your device</li>
              <li><strong className="text-[var(--fg)]">Tap Stop</strong> — transcription begins automatically</li>
              <li><strong className="text-[var(--fg)]">Wait</strong> — the model processes your audio (first time takes longer as it downloads ~40 MB)</li>
              <li><strong className="text-[var(--fg)]">Record more</strong> — each clip's text is added to your document. Record as many clips as you need.</li>
              <li><strong className="text-[var(--fg)]">Edit if needed</strong> — tap the text to make corrections</li>
              <li><strong className="text-[var(--fg)]">Copy</strong> — tap the copy icon to grab your text</li>
            </ol>
          </div>

          <div>
            <p className="font-medium text-[var(--accent)] mb-1.5">Best results</p>
            <ul className="space-y-1">
              <li><strong className="text-[var(--fg)]">Keep recordings under 30 seconds</strong> for best accuracy</li>
              <li>Maximum recording length is 2 minutes (auto-stops)</li>
              <li>For longer content, record multiple short clips — each one appends to your text automatically</li>
              <li>Speak at a natural pace — no need to slow down</li>
              <li>Minimize background noise</li>
              <li>One speaker at a time</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-[var(--accent)] mb-1.5">About the model</p>
            <ul className="space-y-1">
              <li>Uses <strong className="text-[var(--fg)]">Whisper {currentModel?.label ?? 'Tiny'} {currentModel?.lang ?? 'English'}</strong> — a speech recognition model that runs entirely in your browser</li>
              <li>Audio never leaves your device</li>
              <li>{currentModel?.size ?? '~40 MB'} model downloads once, then cached for future visits</li>
              <li>Best for: short dictation, quick notes, voice memos</li>
              <li>Not ideal for: long meetings, multiple speakers, noisy environments</li>
            </ul>
          </div>

          <div className="border-t border-[var(--surface-alt)] pt-3">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              <span>Technical details</span>
              <svg
                className={`w-3 h-3 transition-transform ${showTechnical ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {showTechnical && (
              <ul className="mt-2 space-y-1">
                <li>Model: <code className="text-[var(--accent)]">{currentModel?.id ?? 'onnx-community/whisper-tiny.en'}</code> (q8, WASM)</li>
                <li>Audio: 16 kHz mono, processed in 28-second chunks</li>
                <li>Works in Chrome, Firefox, Edge. Safari has limited support.</li>
                <li>In-app browsers (Telegram, WhatsApp) may not work — use your default browser</li>
              </ul>
            )}
          </div>

          {lastResult && (
            <div className="pt-2 border-t border-[var(--surface-alt)] text-[var(--muted)] tabular-nums">
              Last: {lastResult.audioDurationS}s audio
              {' \u00B7 '}{lastResult.chunks} chunk{lastResult.chunks !== 1 ? 's' : ''}
              {' \u00B7 '}{(lastResult.durationMs / 1000).toFixed(1)}s processing
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const availableModels = modelsForPlatform();
  const [browserModelId, setBrowserModelId] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_MODEL_ID;
    const stored = localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL_ID;
    // On iOS, force any previously-saved incompatible model (e.g. Small) back
    // to the tiny default so a returning user isn't stuck in the download loop.
    if (isIOS() && !isIOSCompatibleModel(stored)) return DEFAULT_MODEL_ID;
    return stored;
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

  const handleClear = () => {
    setDismissedError(null);
    setAccumulatedText('');
    prevWhisperTextRef.current = '';
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
    <div className={`relative flex flex-col items-center gap-4 w-full max-w-md mx-auto px-4 py-2 sm:px-6 ${className ?? ''}`}>
      <ThemeToggle />
      <h1 className="text-xl font-semibold text-[var(--fg)] text-center w-full" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>VoiceTranscriber</h1>

      {/* In-app browser warning */}
      {inApp && !inAppWarningDismissed && (
        <div className="w-full rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-[var(--accent)]">
              You're in an in-app browser. The speech model (~150 MB) will need to re-download each visit.
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
            models={availableModels}
            note={isIOS() ? 'On iPhone, Tiny is saved for instant reuse. Base works too but re-downloads each visit. Larger models aren’t supported on iOS.' : undefined}
          />
        )}
      </div>
    </div>
  );
}
