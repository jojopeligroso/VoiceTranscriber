'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

export interface WhisperModel {
  id: string;
  label: string;
  lang: string;
  size: string;
}

export const WHISPER_MODELS: WhisperModel[] = [
  { id: 'onnx-community/whisper-tiny.en', label: 'Tiny', lang: 'English', size: '~40 MB' },
  { id: 'onnx-community/whisper-tiny', label: 'Tiny', lang: 'Multilingual', size: '~40 MB' },
  { id: 'onnx-community/whisper-base.en', label: 'Base', lang: 'English', size: '~75 MB' },
  { id: 'onnx-community/whisper-base', label: 'Base', lang: 'Multilingual', size: '~75 MB' },
  { id: 'onnx-community/whisper-small.en', label: 'Small', lang: 'English', size: '~250 MB' },
  { id: 'onnx-community/whisper-small', label: 'Small', lang: 'Multilingual', size: '~250 MB' },
];

export const DEFAULT_MODEL_ID = 'onnx-community/whisper-tiny.en';
export const MODEL_STORAGE_KEY = 'voicetranscriber-model';

// Module-level cache so the pipeline persists across component remounts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPipeline: any = null;
let cachedModelId: string | null = null;
let pipelinePromise: Promise<unknown> | null = null;

export function useWhisperBrowser(modelId: string = DEFAULT_MODEL_ID) {
  const [state, setState] = useState<WhisperState>('idle');
  const [text, setText] = useState('');
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(!!cachedPipeline && cachedModelId === modelId);

  // Reset readiness when model selection changes
  useEffect(() => {
    const ready = !!cachedPipeline && cachedModelId === modelId;
    if (!ready) {
      setModelReady(false); // eslint-disable-line react-hooks/set-state-in-effect
      setState('idle');
    }
  }, [modelId]);

  // Track per-file progress for aggregation
  const filesRef = useRef<Map<string, { loaded: number; total: number }>>(new Map());

  const loadPipeline = useCallback(async () => {
    // Invalidate cache if model changed
    if (cachedPipeline && cachedModelId !== modelId) {
      cachedPipeline = null;
      cachedModelId = null;
      pipelinePromise = null;
    }

    if (cachedPipeline) {
      setModelReady(true);
      return cachedPipeline;
    }

    // If a previous load is in progress, await it — but handle failure
    if (pipelinePromise) {
      try {
        await pipelinePromise;
        if (cachedPipeline) {
          setModelReady(true);
          return cachedPipeline;
        }
      } catch {
        // Previous load failed — fall through to retry
        pipelinePromise = null;
      }
    }

    setState('loading-model');
    setModelProgress(0);
    setFileProgresses([]);
    filesRef.current.clear();

    const { pipeline, env } = await import('@huggingface/transformers');

    // Enable ONNX WASM proxy: runs inference in an internal worker thread,
    // preventing the main thread from freezing during transcription.
    // Skip on iOS/Safari where the proxy worker can fail to initialize.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS && env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.proxy = true;
    }

    pipelinePromise = pipeline(
      'automatic-speech-recognition',
      modelId,
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
    cachedModelId = modelId;
    pipelinePromise = null;
    setModelProgress(100);
    setModelReady(true);
    setState('idle');
    return cachedPipeline;
  }, [modelId]);

  const loadModel = useCallback(async () => {
    try {
      await loadPipeline();
    } catch (err) {
      cachedPipeline = null;
      cachedModelId = null;
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

      // Manual chunking: split audio into ~28s segments and transcribe each.
      // Whisper has a 30-second context window; the pipeline's built-in
      // chunking doesn't work reliably with WASM + fp32.
      const SAMPLE_RATE = 16000;
      const CHUNK_SECONDS = 28;
      const CHUNK_SAMPLES = CHUNK_SECONDS * SAMPLE_RATE;

      const chunks: string[] = [];
      for (let offset = 0; offset < float32.length; offset += CHUNK_SAMPLES) {
        const end = Math.min(offset + CHUNK_SAMPLES, float32.length);
        const segment = float32.slice(offset, end);
        // Skip very short trailing segments (< 0.5s)
        if (segment.length < SAMPLE_RATE * 0.5) break;
        const segResult = await pipe(segment);
        const segText = (segResult.text || '').trim();
        if (segText) chunks.push(segText);
      }

      const fullText = chunks.join(' ');
      const durationMs = performance.now() - start;

      const audioDurationS = Math.round(float32.length / SAMPLE_RATE);

      const transcriptionResult: TranscriptionResult = {
        text: fullText,
        mode: 'browser',
        durationMs,
        audioDurationS,
        chunks: chunks.length,
      };

      setText(transcriptionResult.text);
      setLastResult(transcriptionResult);
      setState('done');
      return transcriptionResult;
    } catch (err) {
      cachedPipeline = null;
      cachedModelId = null;
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
    // Clear dangling promise from failed loads so retry works
    if (!cachedPipeline) {
      pipelinePromise = null;
    }
  }, []);

  return { transcribe, loadModel, text, lastResult, state, modelProgress, fileProgresses, modelReady, error, reset };
}
