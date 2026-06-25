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
  { id: 'onnx-community/whisper-tiny.en', label: 'Tiny', lang: 'English', size: '~150 MB' },
  { id: 'onnx-community/whisper-tiny', label: 'Tiny', lang: 'Multilingual', size: '~150 MB' },
  { id: 'onnx-community/whisper-base.en', label: 'Base', lang: 'English', size: '~290 MB' },
  { id: 'onnx-community/whisper-base', label: 'Base', lang: 'Multilingual', size: '~290 MB' },
  { id: 'onnx-community/whisper-small.en', label: 'Small', lang: 'English', size: '~950 MB' },
  { id: 'onnx-community/whisper-small', label: 'Small', lang: 'Multilingual', size: '~950 MB' },
];

export const DEFAULT_MODEL_ID = 'onnx-community/whisper-tiny.en';
export const MODEL_STORAGE_KEY = 'voicetranscriber-model';

// Sentinels (sessionStorage) used to detect an iOS memory-kill reload that
// interrupts the model download. If a load starts but the page reloads before
// it finishes, the sentinel survives into the fresh page and we can surface a
// clear message instead of silently re-downloading forever.
const LOAD_SENTINEL_KEY = 'voicetranscriber-loading';
const LOAD_FAILS_KEY = 'voicetranscriber-load-fails';

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPhone/iPod, plus iPadOS 13+ which reports as "MacIntel" with touch.
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// The single model allowed on iOS. iOS Safari/WebKit imposes a hard per-tab
// WASM memory ceiling. At fp32, Tiny is ~150 MB which works. Base (~290 MB) and
// Small (~950 MB) risk hitting the ceiling, especially on older iPhones. We lock
// iOS to the English-only Tiny model — the smallest, most reliable option.
// All iOS browsers use WebKit, so this covers Chrome/Firefox/Edge/Brave on
// iPhone and iPad too.
export const IOS_ALLOWED_MODEL_ID = DEFAULT_MODEL_ID; // 'onnx-community/whisper-tiny.en'

// Whether a given model may be selected on the current platform. On iOS only the
// single allowed Tiny English model is permitted; every other platform allows all.
export function isModelAllowedOnPlatform(id: string): boolean {
  return !isIOS() || id === IOS_ALLOWED_MODEL_ID;
}

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
      setModelReady(false);
      setState('idle');
    }
  }, [modelId]);

  // Detect a reload that interrupted a previous model load (iOS memory kill).
  // Runs once on mount: if the load sentinel is still set but no pipeline is
  // cached, the page reloaded mid-download. Count it, and after a second such
  // failure surface guidance instead of letting the download loop forever.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(LOAD_SENTINEL_KEY) && !cachedPipeline) {
        sessionStorage.removeItem(LOAD_SENTINEL_KEY);
        const fails = Number(sessionStorage.getItem(LOAD_FAILS_KEY) || '0') + 1;
        sessionStorage.setItem(LOAD_FAILS_KEY, String(fails));
        if (fails >= 2) {
          setError(
            'This device ran out of memory loading the speech model. ' +
            'Switch to the Tiny model (Model settings) for reliable transcription on iPhone.',
          );
          setState('error');
        }
      }
    } catch {
      /* sessionStorage unavailable (e.g. private mode) — ignore */
    }
  }, []);

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

    if (pipelinePromise) {
      await pipelinePromise;
      setModelReady(true);
      return cachedPipeline;
    }

    setState('loading-model');
    setModelProgress(0);
    setFileProgresses([]);
    filesRef.current.clear();

    // Mark that a load is in progress so a memory-kill reload can be detected.
    if (typeof window !== 'undefined') {
      try { sessionStorage.setItem(LOAD_SENTINEL_KEY, '1'); } catch { /* ignore */ }
    }

    // Ask the browser to keep our cached model from being evicted, so it
    // downloads once instead of re-fetching every visit (iOS evicts eagerly).
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      try { await navigator.storage.persist(); } catch { /* ignore */ }
    }

    const { pipeline, env } = await import('@huggingface/transformers');

    // Single-threaded WASM keeps the memory footprint low and deterministic on
    // iOS Safari, which has a strict per-tab memory ceiling. Multi-threading
    // duplicates the heap per worker and tends to trip that ceiling.
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
    }

    pipelinePromise = pipeline(
      'automatic-speech-recognition',
      modelId,
      {
        // fp32 on all platforms. The q8 ONNX variant was re-published upstream
        // with MatMulNBits ops that browser WASM runtimes don't support.
        // Tiny English at fp32 is ~150 MB but still fits under iOS Safari's
        // per-tab memory ceiling (Base/Small do not — that's the iOS lock).
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
    cachedModelId = modelId;
    pipelinePromise = null;
    // Load finished cleanly — clear the reload sentinel and failure counter.
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(LOAD_SENTINEL_KEY);
        sessionStorage.removeItem(LOAD_FAILS_KEY);
      } catch { /* ignore */ }
    }
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
      if (typeof window !== 'undefined') {
        try { sessionStorage.removeItem(LOAD_SENTINEL_KEY); } catch { /* ignore */ }
      }
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
      if (typeof window !== 'undefined') {
        try { sessionStorage.removeItem(LOAD_SENTINEL_KEY); } catch { /* ignore */ }
      }
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

  return { transcribe, loadModel, text, lastResult, state, modelProgress, fileProgresses, modelReady, error, reset };
}
