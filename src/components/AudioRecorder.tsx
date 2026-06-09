'use client';

import RecordButton from './RecordButton';

interface AudioRecorderProps {
  state: 'idle' | 'recording' | 'stopped';
  elapsedSeconds: number;
  onStart: () => void;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MAX_DURATION = 120;

export default function AudioRecorder({ state, elapsedSeconds, onStart, onStop }: AudioRecorderProps) {
  const remaining = MAX_DURATION - elapsedSeconds;
  const progress = (elapsedSeconds / MAX_DURATION) * 100;
  const isRecording = state === 'recording';

  return (
    <div className="flex flex-col items-center gap-4">
      <RecordButton state={state} onStart={onStart} onStop={onStop} />

      {isRecording && (
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Recording {formatTime(elapsedSeconds)}</span>
            <span className="text-gray-600">/ {formatTime(MAX_DURATION)}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                remaining <= 10 ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {remaining <= 10 && (
            <p className="text-xs text-red-400">{remaining}s remaining</p>
          )}
        </div>
      )}

      {state === 'idle' && (
        <p className="text-sm text-gray-500">Tap to record (max 2 min)</p>
      )}
    </div>
  );
}
