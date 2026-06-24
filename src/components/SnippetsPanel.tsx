'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_BUCKETS, type Bucket, type Snippet } from '@/hooks/useSnippets';

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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
}: {
  buckets: Bucket[];
  activeBucketId: string | null;
  onSelect: (id: string) => void;
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
  onCopy: (text: string) => void;
  onInsert?: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-md bg-[var(--bg-alt)] px-2.5 py-2">
      <p className="flex-1 text-xs text-[var(--fg)] whitespace-pre-wrap break-words">{snippet.text}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => { onCopy(snippet.text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors"
          title="Copy snippet"
        >
          {copied ? <CheckIcon className="w-4 h-4 text-[var(--teal)]" /> : <CopyIcon className="w-4 h-4" />}
        </button>
        {onInsert && (
          <button
            onClick={() => onInsert(snippet.text)}
            className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors"
            title="Insert into editor"
          >
            <InsertIcon className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(snippet.id)}
          className="p-1 rounded text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--surface)] transition-colors"
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
  onSetActive,
  onRename,
  onRemove,
  onCopySnippet,
  onInsertSnippet,
  onDeleteSnippet,
}: {
  bucket: Bucket;
  snippets: Snippet[];
  isActive: boolean;
  canRemove: boolean;
  onSetActive: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onCopySnippet: (text: string) => void;
  onInsertSnippet?: (text: string) => void;
  onDeleteSnippet: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(bucket.name);
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
    <div className="rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors shrink-0"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronIcon className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

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
          {snippets.length}
        </span>

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
          className={`shrink-0 p-1 rounded transition-colors ${
            canRemove
              ? 'text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--surface-alt)]'
              : 'text-[var(--muted)]/30 cursor-not-allowed'
          }`}
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
  onSetActive: (id: string) => void;
  onAddBucket: (name?: string) => void;
  onRemoveBucket: (id: string) => void;
  onRenameBucket: (id: string, name: string) => void;
  onDeleteSnippet: (id: string) => void;
  onInsertSnippet?: (text: string) => void;
}

export default function SnippetsPanel({
  buckets,
  snippets,
  activeBucketId,
  onSetActive,
  onAddBucket,
  onRemoveBucket,
  onRenameBucket,
  onDeleteSnippet,
  onInsertSnippet,
}: SnippetsPanelProps) {
  const [expanded, setExpanded] = useState(false);
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

  const copyToClipboard = (text: string) => {
    try { void navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  const handleAdd = () => {
    if (buckets.length >= MAX_BUCKETS) return;
    onAddBucket(newName);
    setNewName('');
  };

  const atCap = buckets.length >= MAX_BUCKETS;

  return (
    <div className="w-full text-xs text-[var(--muted)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-center gap-1.5 py-1 hover:text-[var(--fg)] transition-colors"
      >
        <span>Snippets &amp; buckets{snippets.length > 0 ? ` (${snippets.length})` : ''}</span>
        <ChevronIcon className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)] p-3">
          <div className="flex flex-col gap-2">
            {buckets.map((b) => (
              <BucketSection
                key={b.id}
                bucket={b}
                snippets={byBucket.get(b.id) ?? []}
                isActive={b.id === activeBucketId}
                canRemove={buckets.length > 1}
                onSetActive={onSetActive}
                onRename={onRenameBucket}
                onRemove={onRemoveBucket}
                onCopySnippet={copyToClipboard}
                onInsertSnippet={onInsertSnippet}
                onDeleteSnippet={onDeleteSnippet}
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

          <p className="text-[11px] italic text-[var(--muted)]">
            Snippets are saved on this device only and kept for several days. A browser set to
            clear data on exit (e.g. Brave Shields) may remove them sooner.
          </p>
        </div>
      )}
    </div>
  );
}
