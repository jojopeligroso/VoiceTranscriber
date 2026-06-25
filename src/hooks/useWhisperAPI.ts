'use client';

import { useState, useCallback } from 'react';
import type { TranscriptionResult } from '@/lib/transcribe';

type APIState = 'idle' | 'transcribing' | 'done' | 'error';

export function useWhisperAPI(apiEndpoint = '/api/transcribe') {
  const [state, setState] = useState<APIState>('idle');
  const [text, setText] = useState('');
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (blob: Blob): Promise<TranscriptionResult | null> => {
    setError(null);
    setText('');
    setState('transcribing');

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const start = performance.now();
      const res = await fetch(apiEndpoint, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `API error: ${res.status}`);
      }

      const durationMs = data.durationMs ?? Math.round(performance.now() - start);
      const result: TranscriptionResult = {
        text: data.text,
        mode: 'api',
        durationMs,
      };

      setText(result.text);
      setLastResult(result);
      setState('done');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'API transcription failed';
      setError(msg);
      setState('error');
      return null;
    }
  }, [apiEndpoint]);

  const reset = useCallback(() => {
    setState('idle');
    setText('');
    setError(null);
  }, []);

  return { transcribe, text, lastResult, state, error, reset };
}
