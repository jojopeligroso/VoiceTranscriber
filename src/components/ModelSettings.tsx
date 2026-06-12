'use client';

import { useState, useRef, useEffect } from 'react';
import { WHISPER_MODELS } from '@/hooks/useWhisperBrowser';

export default function ModelSettings({ modelId, onChange, disabled }: { modelId: string; onChange: (id: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = WHISPER_MODELS.find(m => m.id === modelId);

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
            {WHISPER_MODELS.map(m => (
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
