'use client';

import { useState, useRef, useEffect } from 'react';

interface TranscriptDisplayProps {
  text: string;
  whisperState: string;
  onClear?: () => void;
  onTextChange?: (text: string) => void;
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

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

export default function TranscriptDisplay({
  text,
  whisperState,
  onClear,
  onTextChange,
}: TranscriptDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editedTextRef = useRef(editedText);
  const textRef = useRef(text);
  const onTextChangeRef = useRef(onTextChange);
  editedTextRef.current = editedText;
  textRef.current = text;
  onTextChangeRef.current = onTextChange;

  useEffect(() => {
    if (!text) {
      setIsEditing(false);
      setEditedText('');
    } else if (!isEditing) {
      setEditedText(text);
    }
  }, [text, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (onTextChangeRef.current && editedTextRef.current !== textRef.current)
          onTextChangeRef.current(editedTextRef.current);
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  const handleCopy = async () => {
    const textToCopy = isEditing ? editedText : text;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const prevTextLenRef = useRef(0);
  useEffect(() => {
    if (text && text.length > prevTextLenRef.current && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevTextLenRef.current = text?.length ?? 0;
  }, [text]);

  if ((whisperState === 'loading-model' || whisperState === 'transcribing') && !text) {
    return null;
  }

  const displayText = isEditing ? editedText : text;
  const hasText = !!displayText;

  return (
    <div className="w-full" ref={containerRef}>
      <div
        className={`relative w-full min-h-[240px] sm:min-h-[320px] rounded-lg border transition-colors ${
          isEditing
            ? 'border-[var(--accent)]/50 bg-[var(--bg-alt)]'
            : hasText
              ? 'border-[var(--surface-alt)] bg-[var(--bg-alt)] cursor-text'
              : 'border-[var(--surface-alt)] bg-[var(--bg-alt)]'
        }`}
        onClick={() => {
          if (hasText && !isEditing) setIsEditing(true);
        }}
      >
        {/* Action buttons */}
        {hasText && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isEditing && onTextChange && editedText !== text) onTextChange(editedText);
                setIsEditing(!isEditing);
              }}
              className={`p-2 rounded-md transition-colors ${
                isEditing
                  ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface)]'
              }`}
              title={isEditing ? 'Done editing' : 'Edit text'}
            >
              <PenIcon className="w-7 h-7" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              className="p-2 rounded-md text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="w-7 h-7 text-[var(--teal)]" />
              ) : (
                <CopyIcon className="w-7 h-7" />
              )}
            </button>
            {onClear && (
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="p-2 rounded-md text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--surface)] transition-colors"
                title="Clear transcript"
              >
                <TrashIcon className="w-7 h-7" />
              </button>
            )}
          </div>
        )}

        {/* Copied feedback */}
        {copied && (
          <div className="absolute top-14 right-16 text-xs text-[var(--teal)] bg-[var(--surface)] px-2 py-1 rounded z-10">
            Copied!
          </div>
        )}

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full min-h-[240px] sm:min-h-[320px] bg-transparent text-[var(--fg)] text-base p-4 pr-16 resize-y focus:outline-none"
          />
        ) : hasText ? (
          <p className="text-[var(--fg)] text-base whitespace-pre-wrap p-4 pr-16">{displayText}</p>
        ) : (
          <div className="flex items-center justify-center min-h-[240px] sm:min-h-[320px]">
            <p className="text-sm text-[var(--muted)] italic">
              Your transcription will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
