'use client';

import { useState, useRef, useEffect } from 'react';

interface TranscriptDisplayProps {
  text: string;
  isProcessing: boolean;
  modelProgress: number;
  whisperState: string;
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

export default function TranscriptDisplay({
  text,
  isProcessing,
  modelProgress,
  whisperState,
}: TranscriptDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external text changes
  useEffect(() => {
    if (!isEditing) setEditedText(text);
  }, [text, isEditing]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, [isEditing]);

  const handleCopy = async () => {
    const textToCopy = isEditing ? editedText : text;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Loading and transcribing states are handled by VoiceTranscriber directly
  if (whisperState === 'loading-model' || whisperState === 'transcribing') {
    return null;
  }

  const displayText = isEditing ? editedText : text;
  const hasText = !!displayText;

  return (
    <div className="w-full">
      <div className="relative w-full min-h-[120px] rounded-lg border border-gray-700 bg-gray-800/50">
        {/* Action buttons */}
        {hasText && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-1.5 rounded-md transition-colors ${
                isEditing
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
              }`}
              title={isEditing ? 'Done editing' : 'Edit text'}
            >
              <PenIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-green-400" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        {/* Copied feedback */}
        {copied && (
          <div className="absolute top-2 right-20 text-xs text-green-400 bg-gray-800 px-2 py-1 rounded">
            Copied!
          </div>
        )}

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full min-h-[120px] bg-transparent text-gray-200 p-4 pr-20 resize-y focus:outline-none"
          />
        ) : hasText ? (
          <p className="text-gray-200 whitespace-pre-wrap p-4 pr-20">{displayText}</p>
        ) : (
          <div className="flex items-center justify-center min-h-[120px]">
            <p className="text-sm text-gray-500 italic">
              Your transcription will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
