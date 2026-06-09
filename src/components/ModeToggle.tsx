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
    <div className="flex rounded-lg bg-gray-800 p-1 text-sm">
      <button
        onClick={() => onChange('browser')}
        className={`px-3 py-1.5 rounded-md transition-colors ${
          mode === 'browser'
            ? 'bg-gray-600 text-white'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Browser (private)
      </button>
      <button
        onClick={() => onChange('api')}
        className={`px-3 py-1.5 rounded-md transition-colors ${
          mode === 'api'
            ? 'bg-gray-600 text-white'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        API (OpenAI)
      </button>
    </div>
  );
}
