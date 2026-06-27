'use client';

interface RecordButtonProps {
  state: 'idle' | 'recording' | 'stopped';
  onStart: () => void;
  onStop: () => void;
}

export default function RecordButton({ state, onStart, onStop }: RecordButtonProps) {
  const isRecording = state === 'recording';

  return (
    <button
      onClick={isRecording ? onStop : onStart}
      className={`
        relative flex items-center justify-center
        w-[120px] h-[120px] rounded-full transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${isRecording
          ? 'bg-[var(--red)] hover:opacity-90 focus:ring-[var(--red)] animate-pulse'
          : 'bg-[var(--accent)] hover:opacity-90 focus:ring-[var(--accent)]'
        }
      `}
      style={{ '--tw-ring-offset-color': 'var(--bg)' } as React.CSSProperties}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? (
        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg className="w-12 h-12 text-[#05182e]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      )}
    </button>
  );
}
