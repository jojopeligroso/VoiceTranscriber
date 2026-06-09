'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWhisperBrowser, type FileProgress } from '@/hooks/useWhisperBrowser';
import { useWhisperAPI } from '@/hooks/useWhisperAPI';
import type { TranscriptionResult } from '@/lib/transcribe';
import AudioRecorder from './AudioRecorder';
import TranscriptDisplay from './TranscriptDisplay';
import ModeToggle from './ModeToggle';

type Mode = 'browser' | 'api';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Common in-app browser identifiers
  return /FBAN|FBAV|Instagram|Telegram|Twitter|Line|WhatsApp|Snapchat|WeChat|MicroMessenger/i.test(ua);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ModelDownloadProgress({ progress, files }: { progress: number; files: FileProgress[] }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="w-full rounded-lg border border-gray-700 bg-gray-800/50 p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-200">Preparing speech engine</p>
          <span className="text-sm tabular-nums text-gray-400">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            One-time download. Cached for future use.
          </p>
          {files.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
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
          <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-700/50">
            {files.map((f) => (
              <div key={f.name} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.done ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`} />
                <span className="text-gray-400 truncate flex-1">{f.name}</span>
                <span className="text-gray-500 tabular-nums shrink-0">
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

function InfoPanel({ mode, lastResult }: { mode: Mode; lastResult: TranscriptionResult | null }) {
  const [expanded, setExpanded] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <div className="w-full text-xs text-gray-500">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-1 hover:text-gray-400 transition-colors"
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
        <div className="mt-2 rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-sm text-gray-400 space-y-4">
          <div>
            <p className="font-medium text-gray-300 mb-1.5">How it works</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Tap Get Ready</strong> — allow microphone access when prompted</li>
              <li><strong>Speak clearly</strong> — the app records audio locally on your device</li>
              <li><strong>Tap Stop</strong> — transcription begins automatically</li>
              <li><strong>Wait</strong> — the model processes your audio (first time takes longer as it downloads ~40 MB)</li>
              <li><strong>Record more</strong> — each clip's text is added to your document. Record as many clips as you need.</li>
              <li><strong>Edit if needed</strong> — tap the text to make corrections</li>
              <li><strong>Copy</strong> — tap the copy icon to grab your text</li>
            </ol>
          </div>

          <div>
            <p className="font-medium text-gray-300 mb-1.5">Best results</p>
            <ul className="space-y-1">
              <li><strong>Keep recordings under 30 seconds</strong> for best accuracy</li>
              <li>Maximum recording length is 2 minutes (auto-stops)</li>
              <li>For longer content, record multiple short clips — each one appends to your text automatically</li>
              <li>Speak at a natural pace — no need to slow down</li>
              <li>Minimize background noise</li>
              <li>One speaker at a time</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-gray-300 mb-1.5">About the model</p>
            <ul className="space-y-1">
              <li>Uses <strong>Whisper Tiny English</strong> — a small speech recognition model that runs entirely in your browser</li>
              <li>Audio never leaves your device</li>
              <li>~40 MB model downloads once, then cached for future visits</li>
              <li>Best for: short dictation, quick notes, voice memos</li>
              <li>Not ideal for: long meetings, multiple speakers, noisy environments</li>
            </ul>
          </div>

          <div className="border-t border-gray-700/50 pt-3">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
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
                <li>Model: <code className="text-gray-300">onnx-community/whisper-tiny.en</code> (fp32, WASM)</li>
                <li>Audio: 16 kHz mono, processed in 28-second chunks</li>
                <li>Works in Chrome, Firefox, Edge. Safari has limited support.</li>
                <li>In-app browsers (Telegram, WhatsApp) may not work — use your default browser</li>
              </ul>
            )}
          </div>

          {lastResult && (
            <div className="pt-2 border-t border-gray-700/50 text-gray-600 tabular-nums">
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

  const recorder = useAudioRecorder(maxDuration);
  const whisperBrowser = useWhisperBrowser();
  const whisperAPI = useWhisperAPI(apiEndpoint);

  const activeWhisper = mode === 'browser' ? whisperBrowser : whisperAPI;
  const isProcessing =
    whisperBrowser.state === 'loading-model' ||
    whisperBrowser.state === 'transcribing' ||
    whisperAPI.state === 'transcribing';

  const hasResult = activeWhisper.state === 'done' && !!activeWhisper.text;
  const hasAccumulatedText = !!accumulatedText;
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

  // Append new transcription to accumulated text
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
    <div className={`flex flex-col items-center gap-6 w-full max-w-md mx-auto px-4 py-6 sm:px-6 ${className ?? ''}`}>
      <h1 className="text-2xl font-semibold text-gray-100">VoiceTranscriber</h1>

      {/* In-app browser warning */}
      {inApp && !inAppWarningDismissed && (
        <div className="w-full rounded-lg border border-amber-800/50 bg-amber-900/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-amber-300">
              You're in an in-app browser. The speech model (~150 MB) will need to re-download each visit.
              For the best experience, open this page in your default browser.
            </p>
            <button
              onClick={() => setInAppWarningDismissed(true)}
              className="text-amber-500 hover:text-amber-300 text-xs shrink-0 mt-0.5"
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
        <ModelDownloadProgress
          progress={whisperBrowser.modelProgress}
          files={whisperBrowser.fileProgresses}
        />
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
            <svg className="w-5 h-5 shrink-0 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-300">Transcribing audio...</p>
          </div>
        </div>
      )}

      <TranscriptDisplay
        text={accumulatedText}
        isProcessing={isProcessing}
        modelProgress={whisperBrowser.modelProgress}
        whisperState={activeWhisper.state}
        onClear={hasAccumulatedText ? handleClear : undefined}
        onTextChange={setAccumulatedText}
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

      <InfoPanel
        mode={mode}
        lastResult={whisperBrowser.lastResult}
      />
    </div>
  );
}
