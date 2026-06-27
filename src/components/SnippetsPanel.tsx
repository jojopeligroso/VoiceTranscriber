'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_BUCKETS, type Bucket, type Snippet, type StorageEstimate } from '@/hooks/useSnippets';
import { isIOS } from '@/hooks/useWhisperBrowser';

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function InsertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" />
      <path d="M8 11h.01" /><path d="M8 16h.01" />
    </svg>
  );
}

function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ── Active-bucket bar ───────────────────────────────────────────────────────
// Compact "Saving to: [bucket ▾]" control. Sits near the transcript so the user
// always knows where finished transcripts are being auto-saved.

export function ActiveBucketBar({
  buckets,
  activeBucketId,
  onSelect,
  appendMode,
  onToggleAppendMode,
}: {
  buckets: Bucket[];
  activeBucketId: string | null;
  onSelect: (id: string) => void;
  appendMode: boolean;
  onToggleAppendMode: () => void;
}) {
  if (buckets.length === 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
      <span className="shrink-0">Saving to</span>
      <div className="relative">
        <select
          value={activeBucketId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className="appearance-none rounded-md border border-[var(--surface-alt)] bg-[var(--surface)] py-1 pl-2.5 pr-7 text-xs font-medium text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]/50 cursor-pointer"
          aria-label="Active snippet bucket"
        >
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <ChevronIcon className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--muted)]" />
      </div>
      <button
        onClick={onToggleAppendMode}
        className="flex items-center gap-1.5 shrink-0 rounded-md border border-[var(--surface-alt)] bg-[var(--surface)] px-2 py-1 text-xs hover:bg-[var(--surface-alt)] transition-colors cursor-pointer"
        title={appendMode ? 'Append mode: new recordings add to existing text' : 'Replace mode: new recordings replace existing text'}
        aria-label={appendMode ? 'Switch to replace mode' : 'Switch to append mode'}
      >
        <span className={`transition-colors ${appendMode ? 'text-[var(--muted)]' : 'text-[var(--fg)] font-medium'}`}>Replace</span>
        <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${appendMode ? 'bg-[var(--teal)]' : 'bg-[var(--surface-alt)]'}`}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${appendMode ? 'translate-x-2.5' : 'translate-x-0.5'}`} />
        </span>
        <span className={`transition-colors ${appendMode ? 'text-[var(--fg)] font-medium' : 'text-[var(--muted)]'}`}>Append</span>
      </button>
    </div>
  );
}

// ── Snippet row ─────────────────────────────────────────────────────────────

function SnippetRow({
  snippet,
  onCopy,
  onInsert,
  onDelete,
}: {
  snippet: Snippet;
  onCopy: (text: string) => Promise<boolean>;
  onInsert?: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const handleCopy = async () => {
    const ok = await onCopy(snippet.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  };
  return (
    <div className="flex items-start gap-2 rounded-md bg-[var(--bg-alt)] px-2.5 py-2">
      <p className="flex-1 text-xs text-[var(--fg)] whitespace-pre-wrap break-words">{snippet.text}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={handleCopy}
          className="p-2 -m-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors"
          aria-label={copyFailed ? 'Copy failed' : 'Copy snippet'}
          title={copyFailed ? 'Copy failed' : 'Copy snippet'}
        >
          {copied ? (
            <CheckIcon className="w-4 h-4 text-[var(--teal)]" />
          ) : copyFailed ? (
            <CopyIcon className="w-4 h-4 text-[var(--red)]" />
          ) : (
            <CopyIcon className="w-4 h-4" />
          )}
        </button>
        {onInsert && (
          <button
            onClick={() => onInsert(snippet.text)}
            className="p-2 -m-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors"
            aria-label="Insert into editor"
            title="Insert into editor"
          >
            <InsertIcon className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(snippet.id)}
          className="p-2 -m-1 rounded text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--surface)] transition-colors"
          aria-label="Delete snippet"
          title="Delete snippet"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Bucket section (one per bucket) ─────────────────────────────────────────

function BucketSection({
  bucket,
  snippets,
  isActive,
  canRemove,
  reordering,
  isFirst,
  isLast,
  onSetActive,
  onRename,
  onRemove,
  onCopySnippet,
  onCopyAll,
  onInsertSnippet,
  onDeleteSnippet,
  onMove,
}: {
  bucket: Bucket;
  snippets: Snippet[];
  isActive: boolean;
  canRemove: boolean;
  reordering: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSetActive: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onCopySnippet: (text: string) => Promise<boolean>;
  onCopyAll: (snippets: Snippet[]) => Promise<boolean>;
  onInsertSnippet?: (text: string) => void;
  onDeleteSnippet: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(bucket.name);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copyAllFailed, setCopyAllFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingName]);

  const commitName = () => {
    onRename(bucket.id, draftName);
    setEditingName(false);
  };

  return (
    <div className={`rounded-lg border bg-[var(--surface)] transition-colors ${reordering ? 'border-[var(--accent)]/30' : 'border-[var(--surface-alt)]'}`}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        {reordering ? (
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              onClick={() => onMove(bucket.id, 'up')}
              disabled={isFirst}
              className={`p-0.5 rounded transition-colors ${isFirst ? 'text-[var(--muted)]/30 cursor-not-allowed' : 'text-[var(--muted)] hover:text-[var(--accent)]'}`}
              aria-label="Move up"
              title="Move up"
            >
              <ArrowUpIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onMove(bucket.id, 'down')}
              disabled={isLast}
              className={`p-0.5 rounded transition-colors ${isLast ? 'text-[var(--muted)]/30 cursor-not-allowed' : 'text-[var(--muted)] hover:text-[var(--accent)]'}`}
              aria-label="Move down"
              title="Move down"
            >
              <ArrowDownIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors shrink-0"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {editingName ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setDraftName(bucket.name); setEditingName(false); }
            }}
            maxLength={40}
            className="flex-1 min-w-0 rounded bg-[var(--bg-alt)] px-2 py-1 text-xs text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50"
          />
        ) : (
          <button
            onClick={() => { setDraftName(bucket.name); setEditingName(true); }}
            className="flex-1 min-w-0 truncate text-left text-xs font-medium text-[var(--fg)] hover:text-[var(--accent)] transition-colors"
            title="Rename bucket"
          >
            {bucket.name}
          </button>
        )}

        <span className="shrink-0 text-[10px] tabular-nums text-[var(--muted)]">
          {snippets.length}{snippets.length > 0 ? ` · ${formatStorageBytes(snippets.reduce((acc, s) => acc + s.text.length * 2 + 100, 0))}` : ''}
        </span>

        {snippets.length > 0 && (
          <button
            onClick={async () => {
              const ok = await onCopyAll(snippets);
              if (ok) {
                setCopiedAll(true);
                setTimeout(() => setCopiedAll(false), 1200);
              } else {
                setCopyAllFailed(true);
                setTimeout(() => setCopyAllFailed(false), 2000);
              }
            }}
            className="shrink-0 p-2 -m-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-alt)] transition-colors"
            aria-label={copyAllFailed ? 'Copy all failed' : 'Copy all snippets'}
            title={copyAllFailed ? 'Copy all failed' : 'Copy all snippets'}
          >
            {copiedAll ? (
              <CheckIcon className="w-4 h-4 text-[var(--teal)]" />
            ) : copyAllFailed ? (
              <ClipboardListIcon className="w-4 h-4 text-[var(--red)]" />
            ) : (
              <ClipboardListIcon className="w-4 h-4" />
            )}
          </button>
        )}

        {isActive ? (
          <span className="shrink-0 rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
            Active
          </span>
        ) : (
          <button
            onClick={() => onSetActive(bucket.id)}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--fg)] transition-colors"
            title="Make this the active bucket"
          >
            Set active
          </button>
        )}

        <button
          onClick={() => onRemove(bucket.id)}
          disabled={!canRemove}
          className={`shrink-0 p-2 -m-1 rounded transition-colors ${
            canRemove
              ? 'text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--surface-alt)]'
              : 'text-[var(--muted)]/30 cursor-not-allowed'
          }`}
          aria-label={canRemove ? 'Delete bucket and its snippets' : "Can't delete the last bucket"}
          title={canRemove ? 'Delete bucket and its snippets' : "Can't delete the last bucket"}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-1.5 border-t border-[var(--surface-alt)] p-2">
          {snippets.length === 0 ? (
            <p className="px-1 py-2 text-xs italic text-[var(--muted)]">No snippets yet.</p>
          ) : (
            snippets.map((s) => (
              <SnippetRow
                key={s.id}
                snippet={s}
                onCopy={onCopySnippet}
                onInsert={onInsertSnippet}
                onDelete={onDeleteSnippet}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────

export interface SnippetsPanelProps {
  buckets: Bucket[];
  snippets: Snippet[];
  activeBucketId: string | null;
  storageEstimate: StorageEstimate | null;
  onSetActive: (id: string) => void;
  onAddBucket: (name?: string) => void;
  onRemoveBucket: (id: string) => void;
  onRenameBucket: (id: string, name: string) => void;
  onDeleteSnippet: (id: string) => void;
  onInsertSnippet?: (text: string) => void;
  onMoveBucket: (id: string, direction: 'up' | 'down') => void;
}

export default function SnippetsPanel({
  buckets,
  snippets,
  activeBucketId,
  storageEstimate,
  onSetActive,
  onAddBucket,
  onRemoveBucket,
  onRenameBucket,
  onDeleteSnippet,
  onInsertSnippet,
  onMoveBucket,
}: SnippetsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [newName, setNewName] = useState('');

  const byBucket = useMemo(() => {
    const map = new Map<string, Snippet[]>();
    for (const s of snippets) {
      const arr = map.get(s.bucketId) ?? [];
      arr.push(s);
      map.set(s.bucketId, arr);
    }
    return map;
  }, [snippets]);

  // Clipboard write can reject (insecure context, permission denied, no user
  // gesture chain on some mobile browsers). Return success so the UI can show a
  // truthful affordance instead of pretending everything worked.
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const copyAllSnippets = async (bucketSnippets: Snippet[]): Promise<boolean> => {
    // Oldest first for natural reading order (snippets are stored newest-first)
    const text = [...bucketSnippets].reverse().map((s) => s.text).join('\n\n');
    return copyToClipboard(text);
  };

  const handleAdd = () => {
    if (buckets.length >= MAX_BUCKETS) return;
    onAddBucket(newName);
    setNewName('');
  };

  const atCap = buckets.length >= MAX_BUCKETS;

  return (
    <div className="w-full text-xs text-[var(--muted)]">
      <div className="flex w-full items-center justify-center gap-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 py-1 hover:text-[var(--fg)] transition-colors"
        >
          <span>Snippets &amp; buckets{snippets.length > 0 ? ` (${snippets.length})` : ''}</span>
          <ChevronIcon className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && buckets.length > 1 && (
          <button
            onClick={() => setReordering(!reordering)}
            className={`p-1 rounded-md transition-colors ${reordering ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
            title={reordering ? 'Done reordering' : 'Reorder buckets'}
            aria-label={reordering ? 'Done reordering' : 'Reorder buckets'}
          >
            <GripIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)] p-3">
          <div className="flex flex-col gap-2">
            {buckets.map((b, i) => (
              <BucketSection
                key={b.id}
                bucket={b}
                snippets={byBucket.get(b.id) ?? []}
                isActive={b.id === activeBucketId}
                canRemove={buckets.length > 1}
                reordering={reordering}
                isFirst={i === 0}
                isLast={i === buckets.length - 1}
                onSetActive={onSetActive}
                onRename={onRenameBucket}
                onRemove={onRemoveBucket}
                onCopySnippet={copyToClipboard}
                onCopyAll={copyAllSnippets}
                onInsertSnippet={onInsertSnippet}
                onDeleteSnippet={onDeleteSnippet}
                onMove={onMoveBucket}
              />
            ))}
          </div>

          {/* Add bucket */}
          <div className="flex items-center gap-2 border-t border-[var(--surface-alt)] pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder={atCap ? `Max ${MAX_BUCKETS} buckets` : 'New bucket name…'}
              disabled={atCap}
              maxLength={40}
              className="flex-1 min-w-0 rounded-md border border-[var(--surface-alt)] bg-[var(--bg-alt)] px-2.5 py-1.5 text-xs text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]/50 disabled:opacity-50"
            />
            <button
              onClick={handleAdd}
              disabled={atCap}
              className="shrink-0 rounded-md bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>

          {/* Storage info */}
          <div className="border-t border-[var(--surface-alt)] pt-2 space-y-1.5">
            {storageEstimate && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Snippets: {formatStorageBytes(storageEstimate.snippetBytes)}</span>
                  <span>Site total: {formatStorageBytes(storageEstimate.usageBytes)}{storageEstimate.quotaBytes > 0 ? ` / ${formatStorageBytes(storageEstimate.quotaBytes)}` : ''}</span>
                </div>
                {storageEstimate.quotaBytes > 0 && (
                  <div className="w-full h-1.5 bg-[var(--bg-alt)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        storageEstimate.usageBytes / storageEstimate.quotaBytes > 0.8
                          ? 'bg-[var(--red)]'
                          : 'bg-[var(--teal)]'
                      }`}
                      style={{ width: `${Math.min(100, (storageEstimate.usageBytes / storageEstimate.quotaBytes) * 100)}%` }}
                    />
                  </div>
                )}
                {isIOS() && (
                  <p className="text-[11px] text-[var(--accent)]">
                    iOS shares storage between the speech model (~150 MB) and snippets. If storage is tight, older snippets may be evicted.
                  </p>
                )}
              </div>
            )}
            <p className="text-[11px] italic text-[var(--muted)]">
              Saved on this device only. Kept for 7 days, then pruned automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
