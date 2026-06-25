# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
```

No test framework is configured.

## What This Is

Private voice-to-text dictation tool. Record audio in the browser, transcribe on-device via Whisper ONNX (default) or via OpenAI Whisper API (opt-in), get editable text. No database, no accounts. Single-page app.

**Deploy:** https://voice-transcriber-ten.vercel.app/

## Architecture

Next.js 16 App Router, but effectively a single client-side page. One route (`/`), one API route (`/api/transcribe` — OpenAI proxy). All transcription logic runs client-side in browser mode.

### Component hierarchy

`page.tsx` → `VoiceTranscriber` (orchestrator, ~550 lines) → `AudioRecorder` → `RecordButton`, `TranscriptDisplay`, `ModeToggle`, `ThemeToggle`, `SnippetsPanel`

`VoiceTranscriber` owns all state and coordinates the recording → transcription → display flow. Hooks do the heavy lifting:

- **`useAudioRecorder`** — MediaRecorder wrapper, 2-min hard cap, produces audio Blob
- **`useWhisperBrowser`** — Transformers.js pipeline (Whisper ONNX), module-level singleton cache, chunked processing for audio >28s
- **`useWhisperAPI`** — Sends audio to `/api/transcribe` which proxies to OpenAI
- **`useSnippets`** — IndexedDB CRUD for snippet buckets (7-day TTL, max 12 buckets)

### Persistence (all client-side)

| What | Where | Why not localStorage |
|---|---|---|
| Whisper model (~40-250MB) | IndexedDB + Cache Storage (via transformers.js) | Size |
| Snippet buckets & snippets | IndexedDB (`voicetranscriber-snippets`) | iOS/Brave evict localStorage aggressively |
| Theme preference | localStorage | Simple, sync, tiny |
| Active bucket ID | IndexedDB meta store | Collocated with snippet data |

### Audio pipeline

Record (MediaRecorder) → Blob → AudioContext decode → OfflineAudioContext resample to 16kHz → split into 28s chunks → Whisper pipeline per chunk → join text

### Styling

Tailwind CSS v4 with CSS custom properties for theming (`var(--fg)`, `var(--accent)`, `var(--surface)`, etc.). "Retro 82" aesthetic defined in `globals.css`. Dark/light via `html.dark` class.

### Embeddable component

`src/index.ts` exports `VoiceTranscriber` for embedding in other apps. Props: `apiEndpoint`, `maxDuration`, `defaultMode`.

## Gotchas

### 1. iOS WebKit memory ceiling
All iOS browsers use WebKit with a per-tab WASM memory ceiling. At fp32, the Tiny English model (~150MB) fits comfortably. Base (~290MB) and Small (~950MB) risk hitting that ceiling, especially on older iPhones. The app locks iOS to `whisper-tiny.en` and greys out other options. If you add a new model, gate it through `isModelAllowedOnPlatform()` in `useWhisperBrowser.ts`.

### 2. Module-level pipeline cache
`useWhisperBrowser` caches the Whisper pipeline at **module level** (not component level) so it survives React remounts. The download promise is also cached to prevent duplicate downloads. Don't move this into component state or it will re-download on every mount.

### 3. In-app browser model re-download
WebViews from Telegram, WhatsApp, Instagram etc. don't persist Cache Storage. The ~150MB model re-downloads every visit. Detection is in `isInAppBrowser()` in `VoiceTranscriber.tsx`. No fix exists — just the warning banner.

### 4. Chunked processing is required for audio >30s
Whisper processes 30-second windows. Without `chunk_length_s` and `stride_length_s` in the pipeline call, only the first ~30s gets transcribed silently (no error). The pipeline splits at 28s with overlap to avoid cutting mid-word.

### 5. Audio resampling must use OfflineAudioContext
Direct sample-rate conversion via AudioContext is unreliable across browsers. The app decodes to whatever rate the device provides, then resamples to 16kHz (Whisper's requirement) via OfflineAudioContext. See `transcribe.ts`.

### 6. IndexedDB is best-effort on aggressive privacy browsers
Brave Shields on aggressive mode and browsers set to "clear data on exit" will wipe IndexedDB. `navigator.storage.persist()` is requested but not guaranteed. Snippet persistence is documented as best-effort to users.

### 7. Service worker cleanup
An old PWA service worker (`sw.js`) is unregistered on startup in `layout.tsx`. The `public/sw.js` is a self-destruct stub. Don't register new service workers — it caused an iOS cache-quota loop.

### 8. No OPENAI_API_KEY = no API mode toggle
`next.config.ts` exposes `NEXT_PUBLIC_HAS_API_KEY` at build time. The mode toggle (browser/API) only renders when this is truthy. Locally, set `OPENAI_API_KEY` in `.env.local` to see API mode.

### 9. iOS WASM single-threading
iOS devices must run WASM single-threaded. Multi-threaded WASM duplicates the heap, doubling memory usage and hitting the WebKit ceiling. The pipeline configuration in `useWhisperBrowser` handles this.
