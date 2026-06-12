'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { PenIcon, CopyIcon, CheckIcon, TrashIcon } from './icons';

interface TranscriptDisplayProps {
  text: string;
  whisperState: string;
  onClear?: () => void;
  onTextChange?: (text: string) => void;
}

function TranscriptDisplay({
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

  // Keep refs current for the click-outside handler (must be in effect, not render)
  useEffect(() => {
    editedTextRef.current = editedText;
    textRef.current = text;
    onTextChangeRef.current = onTextChange;
  });

  // Sync editedText from prop only when NOT editing — prevents cursor resets
  useEffect(() => {
    if (!text) {
      setIsEditing(false); // eslint-disable-line react-hooks/set-state-in-effect
      setEditedText('');
    } else if (!isEditing) {
      setEditedText(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Focus + cursor-to-end only on the false→true transition into editing
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (isEditing && !wasEditingRef.current && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
    wasEditingRef.current = isEditing;
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
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
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

export default memo(TranscriptDisplay);
