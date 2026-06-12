'use client';

import { useState } from 'react';
import type { TranscriptionResult } from '@/lib/transcribe';
import type { WhisperModel } from '@/hooks/useWhisperBrowser';

type Mode = 'browser' | 'api';

export default function InfoPanel({ lastResult, currentModel }: { mode: Mode; lastResult: TranscriptionResult | null; currentModel?: WhisperModel }) {
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
              <li><strong className="text-[var(--fg)]">Record more</strong> — each clip&apos;s text is added to your document. No character limit — record as many clips as you need.</li>
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
              <li>Audio never leaves your device — all processing happens locally, even offline after the model is cached</li>
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
                <li>Model: <code className="text-[var(--accent)]">{currentModel?.id ?? 'onnx-community/whisper-tiny.en'}</code> (fp32, WASM)</li>
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
