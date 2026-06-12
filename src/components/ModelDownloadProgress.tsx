'use client';

import { useState } from 'react';
import { type FileProgress } from '@/hooks/useWhisperBrowser';
import { formatBytes } from '@/lib/utils';

export default function ModelDownloadProgress({ progress, files }: { progress: number; files: FileProgress[] }) {
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
