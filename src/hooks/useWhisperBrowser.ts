'use client';

import { useState, useCallback, useRef } from 'react';
import { audioToFloat32 } from '@/lib/transcribe';
import type { TranscriptionResult } from '@/lib/transcribe';

type WhisperState = 'idle' | 'loading-model' | 'transcribing' | 'done' | 'error';

export interface FileProgress {
  name: string;
  loaded: number;
  total: number;
  progress: number;
  done: boolean;
}

// Module-level cache so the pipeline persists across component remounts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPipeline: any = null;
let pipelinePromise: Promise<unknown> | null = null;

export function useWhisperBrowser() {
  const [state, setState] = useState<WhisperState>('idle');
  const [text, setText] = useState('');
  const [modelProgress, setModelProgress] = useState(0);
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(!!cachedPipeline);

  // Track per-file progress for aggregation
  const filesRef = useRef<Map<string, { loaded: number; total: number }>>(new Map());

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
    setFileProgresses([]);
    filesRef.current.clear();

    const { pipeline } = await import('@huggingface/transformers');

    pipelinePromise = pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-tiny.en',
      {
        dtype: 'fp32',
        device: 'wasm',
        progress_callback: (event: {
          status: string;
          file?: string;
          name?: string;
          loaded?: number;
          total?: number;
          progress?: number;
        }) => {
          const fileKey = event.file || event.name || 'unknown';

          if (event.status === 'progress' && typeof event.loaded === 'number' && typeof event.total === 'number') {
            filesRef.current.set(fileKey, { loaded: event.loaded, total: event.total });

            // Aggregate: total loaded / total size across all files
            let totalLoaded = 0;
            let totalSize = 0;
            const details: FileProgress[] = [];

            filesRef.current.forEach((val, key) => {
              totalLoaded += val.loaded;
              totalSize += val.total;
              const pct = val.total > 0 ? Math.round((val.loaded / val.total) * 100) : 0;
              details.push({
                name: key.split('/').pop() || key,
                loaded: val.loaded,
                total: val.total,
                progress: pct,
                done: pct >= 100,
              });
            });

            const aggregate = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;
            setModelProgress(aggregate);
            setFileProgresses(details);
          } else if (event.status === 'done') {
            const existing = filesRef.current.get(fileKey);
            if (existing) {
              filesRef.current.set(fileKey, { loaded: existing.total, total: existing.total });
            }
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
    setFileProgresses([]);
  }, []);

  return { transcribe, loadModel, text, state, modelProgress, fileProgresses, modelReady, error, reset };
}
