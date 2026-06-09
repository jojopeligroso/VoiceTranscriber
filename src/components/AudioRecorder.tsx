'use client';

import RecordButton from './RecordButton';

interface AudioRecorderProps {
  state: 'idle' | 'recording' | 'stopped';
  elapsedSeconds: number;
  maxDuration?: number;
  onStart: () => void;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioRecorder({ state, elapsedSeconds, maxDuration = 120, onStart, onStop }: AudioRecorderProps) {
  const remaining = maxDuration - elapsedSeconds;
  const progress = (elapsedSeconds / maxDuration) * 100;
  const isRecording = state === 'recording';

  return (
    <div className="flex flex-col items-center gap-3">
      <RecordButton state={state} onStart={onStart} onStop={onStop} />

      {isRecording && (
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--red)] animate-pulse" />
            <span className={elapsedSeconds >= 30 && remaining > 10 ? 'text-[var(--accent)]' : 'text-[var(--fg)]'}>
              Recording {formatTime(elapsedSeconds)}
            </span>
            <span className="opacity-50">/ {formatTime(maxDuration)}</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                remaining <= 10 ? 'bg-[var(--red)]' : elapsedSeconds >= 30 ? 'bg-[var(--accent)]' : 'bg-[var(--teal)]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {remaining <= 10 && (
            <p className="text-xs text-[var(--red)]">{remaining}s remaining</p>
          )}
        </div>
      )}

      {state === 'idle' && (
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-sm text-[var(--muted)]">
            <strong>Best under 30 seconds</strong> · Max 2 minutes
          </p>
          <p className="text-xs text-[var(--muted)] opacity-70">For longer text, record multiple clips</p>
        </div>
      )}
    </div>
  );
}
