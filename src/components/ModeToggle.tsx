'use client';

type Mode = 'browser' | 'api';

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  apiAvailable: boolean;
}

export default function ModeToggle({ mode, onChange, apiAvailable }: ModeToggleProps) {
  if (!apiAvailable) return null;

  return (
    <div className="flex rounded-lg bg-[var(--surface)] p-1 text-sm">
      <button
        onClick={() => onChange('browser')}
        className={`px-3 py-1.5 rounded-md transition-colors ${
          mode === 'browser'
            ? 'bg-[var(--accent)] text-[#05182e]'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'
        }`}
      >
        Browser (private)
      </button>
      <button
        onClick={() => onChange('api')}
        className={`px-3 py-1.5 rounded-md transition-colors ${
          mode === 'api'
            ? 'bg-[var(--accent)] text-[#05182e]'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'
        }`}
      >
        API (OpenAI)
      </button>
    </div>
  );
}
