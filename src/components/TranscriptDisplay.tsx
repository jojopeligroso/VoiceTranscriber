'use client';

interface TranscriptDisplayProps {
  text: string;
  isProcessing: boolean;
  modelProgress: number;
  whisperState: string;
}

export default function TranscriptDisplay({
  text,
  isProcessing,
  modelProgress,
  whisperState,
}: TranscriptDisplayProps) {
  if (whisperState === 'loading-model') {
    return (
      <div className="w-full flex flex-col items-center gap-2">
        <p className="text-sm text-gray-400">Downloading Whisper model...</p>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${modelProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">{modelProgress}%</p>
      </div>
    );
  }

  if (whisperState === 'transcribing') {
    return (
      <div className="w-full flex flex-col items-center gap-2">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Transcribing...</p>
      </div>
    );
  }

  if (!text && !isProcessing) {
    return (
      <div className="w-full">
        <div className="w-full min-h-[100px] rounded-lg border border-gray-700 bg-gray-800/50 p-4 flex items-center justify-center">
          <p className="text-sm text-gray-500 italic">
            Your transcription will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full min-h-[100px] rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <p className="text-gray-200 whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
