// whisper-worker.js
// ES module Web Worker — runs Whisper inference off the main thread.
// Receives messages from the main thread and posts results back.

let cachedPipeline = null;
let cachedModelId = null;

// Lazy-loaded once on first loadModel call, then reused.
let transformers = null;

async function getTransformers() {
  if (!transformers) {
    transformers = await import(
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.web.js'
    );
  }
  return transformers;
}

async function loadModel(modelId) {
  // Already loaded the right model — nothing to do.
  if (cachedPipeline && cachedModelId === modelId) {
    self.postMessage({ type: 'model-ready' });
    return;
  }

  // Invalidate cache when model changes.
  cachedPipeline = null;
  cachedModelId = null;

  try {
    const { pipeline } = await getTransformers();

    cachedPipeline = await pipeline(
      'automatic-speech-recognition',
      modelId,
      {
        dtype: 'fp32',
        device: 'wasm',
        progress_callback: (event) => {
          self.postMessage({ type: 'model-progress', data: event });
        },
      }
    );

    cachedModelId = modelId;
    self.postMessage({ type: 'model-ready' });
  } catch (err) {
    cachedPipeline = null;
    cachedModelId = null;
    self.postMessage({ type: 'error', message: err.message || 'Failed to load model' });
  }
}

async function transcribe(audio) {
  if (!cachedPipeline) {
    self.postMessage({ type: 'error', message: 'Model not loaded. Call load-model first.' });
    return;
  }

  try {
    const SAMPLE_RATE = 16000;
    const CHUNK_SECONDS = 28;
    const CHUNK_SAMPLES = CHUNK_SECONDS * SAMPLE_RATE; // 448000
    const MIN_SAMPLES = SAMPLE_RATE * 0.5;             // 8000 — skip < 0.5s trailing segments

    const totalChunks = Math.ceil(audio.length / CHUNK_SAMPLES);
    const start = performance.now();
    const chunkTexts = [];
    let chunkIndex = 0;

    for (let offset = 0; offset < audio.length; offset += CHUNK_SAMPLES) {
      const end = Math.min(offset + CHUNK_SAMPLES, audio.length);
      const segment = audio.slice(offset, end);

      if (segment.length < MIN_SAMPLES) break;

      const result = await cachedPipeline(segment);
      const text = (result.text || '').trim();

      if (text) chunkTexts.push(text);

      self.postMessage({
        type: 'chunk-result',
        text,
        chunkIndex,
        totalChunks,
      });

      chunkIndex++;
    }

    const fullText = chunkTexts.join(' ');
    const durationMs = performance.now() - start;
    const audioDurationS = Math.round(audio.length / SAMPLE_RATE);

    self.postMessage({
      type: 'transcribe-done',
      text: fullText,
      durationMs,
      audioDurationS,
      chunks: chunkIndex,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || 'Transcription failed' });
  }
}

self.addEventListener('message', (event) => {
  const msg = event.data;

  switch (msg.type) {
    case 'load-model':
      loadModel(msg.modelId).catch((err) => {
        self.postMessage({ type: 'error', message: err.message || 'Load failed' });
      });
      break;

    case 'transcribe':
      transcribe(msg.audio).catch((err) => {
        self.postMessage({ type: 'error', message: err.message || 'Transcribe failed' });
      });
      break;

    default:
      self.postMessage({ type: 'error', message: `Unknown message type: ${msg.type}` });
  }
});
