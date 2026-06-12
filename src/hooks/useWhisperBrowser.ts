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

// ---------------------------------------------------------------------------
// Module-level worker singleton and resolver references
// ---------------------------------------------------------------------------

let workerInstance: Worker | null = null;
let workerModelId: string | null = null;

let resolveLoad: (() => void) | null = null;
let rejectLoad: ((err: Error) => void) | null = null;
let resolveTranscribe: ((result: TranscriptionResult) => void) | null = null;
let rejectTranscribe: ((err: Error) => void) | null = null;
let progressCallback: ((event: {
  status: string;
  file?: string;
  name?: string;
  loaded?: number;
  total?: number;
  progress?: number;
}) => void) | null = null;
let chunkCallback: ((text: string, index: number, total: number) => void) | null = null;

function getOrCreateWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker('/whisper-worker.js', { type: 'module' });
    workerInstance.onmessage = handleWorkerMessage;
    workerInstance.onerror = (e) => {
      const err = new Error(e.message || 'Worker failed to initialize');
      if (rejectLoad) {
        rejectLoad(err);
        resolveLoad = null;
        rejectLoad = null;
      } else if (rejectTranscribe) {
        rejectTranscribe(err);
        resolveTranscribe = null;
        rejectTranscribe = null;
      }
    };
  }
  return workerInstance;
}

function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  workerModelId = null;
  resolveLoad = null;
  rejectLoad = null;
  resolveTranscribe = null;
  rejectTranscribe = null;
  progressCallback = null;
  chunkCallback = null;
}

function handleWorkerMessage(event: MessageEvent) {
  const msg = event.data as {
    type: string;
    data?: {
      status: string;
      file?: string;
      name?: string;
      loaded?: number;
      total?: number;
      progress?: number;
    };
    text?: string;
    chunkIndex?: number;
    totalChunks?: number;
    durationMs?: number;
    audioDurationS?: number;
    chunks?: number;
    message?: string;
  };

  switch (msg.type) {
    case 'model-progress':
      if (progressCallback && msg.data) {
        progressCallback(msg.data);
      }
      break;

    case 'model-ready':
      // workerModelId is set inside resolveLoad (which captures modelId via closure)
      if (resolveLoad) {
        resolveLoad();
        resolveLoad = null;
        rejectLoad = null;
      }
      break;

    case 'chunk-result':
      if (chunkCallback && typeof msg.text === 'string' && typeof msg.chunkIndex === 'number' && typeof msg.totalChunks === 'number') {
        chunkCallback(msg.text, msg.chunkIndex, msg.totalChunks);
      }
      break;

    case 'transcribe-done':
      if (resolveTranscribe) {
        const result: TranscriptionResult = {
          text: msg.text ?? '',
          mode: 'browser',
          durationMs: msg.durationMs ?? 0,
          audioDurationS: msg.audioDurationS,
          chunks: msg.chunks,
        };
        resolveTranscribe(result);
        resolveTranscribe = null;
        rejectTranscribe = null;
        chunkCallback = null;
      }
      break;

    case 'error': {
      const err = new Error(msg.message ?? 'Worker error');
      if (rejectLoad) {
        rejectLoad(err);
        resolveLoad = null;
        rejectLoad = null;
      } else if (rejectTranscribe) {
        rejectTranscribe(err);
        resolveTranscribe = null;
        rejectTranscribe = null;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWhisperBrowser(modelId: string = DEFAULT_MODEL_ID) {
  const [state, setState] = useState<WhisperState>('idle');
  const [text, setText] = useState('');
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(workerModelId === modelId);

  // Track per-file progress for aggregation (same logic as before)
  const filesRef = useRef<Map<string, { loaded: number; total: number }>>(new Map());

  // Reset readiness when model selection changes
  useEffect(() => {
    const ready = workerModelId === modelId;
    if (!ready) {
      setModelReady(false); // eslint-disable-line react-hooks/set-state-in-effect
      setState('idle');
    }
  }, [modelId]);

  const loadModel = useCallback(async () => {
    // If this model is already loaded in the worker, nothing to do
    if (workerModelId === modelId) {
      setModelReady(true);
      return;
    }

    // If a different model is loading, kill the worker to avoid WASM OOM (std::bad_alloc)
    if (resolveLoad) {
      terminateWorker();
    }

    setState('loading-model');
    setModelProgress(0);
    setFileProgresses([]);
    filesRef.current.clear();

    // Wire up the progress callback before posting so no events are missed
    progressCallback = (event) => {
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
    };

    try {
      await new Promise<void>((resolve, reject) => {
        resolveLoad = () => {
          workerModelId = modelId;
          setModelProgress(100);
          setModelReady(true);
          setState('idle');
          resolve();
        };
        rejectLoad = reject;

        const worker = getOrCreateWorker();
        worker.postMessage({ type: 'load-model', modelId });
      });
    } catch (err) {
      terminateWorker();
      const msg = err instanceof Error ? err.message : 'Failed to download model';
      setError(msg);
      setState('error');
    } finally {
      progressCallback = null;
    }
  }, [modelId]);

  const transcribe = useCallback(async (blob: Blob): Promise<TranscriptionResult | null> => {
    setError(null);
    setText('');

    try {
      // Ensure the model is loaded (no-ops if already loaded in the worker)
      await loadModel();

      // Decode and resample audio on the main thread (requires AudioContext/DOM APIs)
      const float32 = await audioToFloat32(blob);

      setState('transcribing');

      const result = await new Promise<TranscriptionResult>((resolve, reject) => {
        resolveTranscribe = resolve;
        rejectTranscribe = reject;

        chunkCallback = null;

        const worker = getOrCreateWorker();
        worker.postMessage(
          { type: 'transcribe', audio: float32 },
          [float32.buffer],
        );
      });

      setText(result.text);
      setLastResult(result);
      setState('done');
      return result;
    } catch (err) {
      terminateWorker();
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      setError(msg);
      setState('error');
      return null;
    }
  }, [loadModel]);

  const reset = useCallback(() => {
    setState('idle');
    setText('');
    setError(null);
    setModelProgress(0);
    setFileProgresses([]);
    // Worker is NOT terminated — it still holds the cached model
  }, []);

  return { transcribe, loadModel, text, lastResult, state, modelProgress, fileProgresses, modelReady, error, reset };
}
