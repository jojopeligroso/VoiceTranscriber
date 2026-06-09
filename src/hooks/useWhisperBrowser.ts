'use client';

import { useState, useCallback } from 'react';
import { audioToFloat32 } from '@/lib/transcribe';
import type { TranscriptionResult } from '@/lib/transcribe';

type WhisperState = 'idle' | 'loading-model' | 'transcribing' | 'done' | 'error';

// Module-level cache so the pipeline persists across component remounts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPipeline: any = null;
let pipelinePromise: Promise<unknown> | null = null;

export function useWhisperBrowser() {
  const [state, setState] = useState<WhisperState>('idle');
  const [text, setText] = useState('');
  const [modelProgress, setModelProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(!!cachedPipeline);

  const loadPipeline = useCallback(async () => {
    if (cachedPipeline) {
      setModelReady(true);
      return cachedPipeline;
    }

    if (pipelinePromise) {
      await pipelinePromise;
      setModelReady(true);
      return cachedPipeline;
    }

    setState('loading-model');
    setModelProgress(0);

    const { pipeline } = await import('@huggingface/transformers');

    pipelinePromise = pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        dtype: 'fp32',
        device: 'wasm',
        progress_callback: (progress: { status: string; progress?: number }) => {
          if (progress.status === 'progress' && typeof progress.progress === 'number') {
            setModelProgress(Math.round(progress.progress));
          }
        },
      },
    );

    cachedPipeline = await pipelinePromise;
    pipelinePromise = null;
    setModelProgress(100);
    setModelReady(true);
    setState('idle');
    return cachedPipeline;
  }, []);

  const loadModel = useCallback(async () => {
    try {
      await loadPipeline();
    } catch (err) {
      cachedPipeline = null;
      pipelinePromise = null;
      const msg = err instanceof Error ? err.message : 'Failed to download model';
      setError(msg);
      setState('error');
    }
  }, [loadPipeline]);

  const transcribe = useCallback(async (blob: Blob): Promise<TranscriptionResult | null> => {
    setError(null);
    setText('');

    try {
      const pipe = await loadPipeline();
      if (!pipe) throw new Error('Failed to load Whisper model');

      setState('transcribing');
      const float32 = await audioToFloat32(blob);

      const start = performance.now();
      const result = await pipe(float32);
      const durationMs = performance.now() - start;

      const transcriptionResult: TranscriptionResult = {
        text: result.text.trim(),
        mode: 'browser',
        durationMs,
      };

      setText(transcriptionResult.text);
      setState('done');
      return transcriptionResult;
    } catch (err) {
      cachedPipeline = null;
      pipelinePromise = null;
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      setError(msg);
      setState('error');
      return null;
    }
  }, [loadPipeline]);

  const reset = useCallback(() => {
    setState('idle');
    setText('');
    setError(null);
    setModelProgress(0);
  }, []);

  return { transcribe, loadModel, text, state, modelProgress, modelReady, error, reset };
}
