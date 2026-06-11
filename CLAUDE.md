# VoiceTranscriber

Private voice-to-text transcription that runs entirely in the browser. No server-side processing — audio never leaves the device.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Speech model:** Whisper via @huggingface/transformers (ONNX, WASM, fp32)
- **Hosting:** Vercel (free tier)
- **Deploy URL:** https://voice-transcriber-ten.vercel.app/

## Architecture

Single-page app. One main component (`VoiceTranscriber.tsx`) orchestrates:
- `useAudioRecorder` — MediaRecorder API, captures mic input
- `useWhisperBrowser` — loads Whisper model via HuggingFace transformers.js, transcribes locally
- `useWhisperAPI` — optional server-side fallback via OpenAI API (gated by NEXT_PUBLIC_HAS_API_KEY)

Audio flow: mic → MediaRecorder → Blob → audioToFloat32 (resample to 16kHz) → Whisper pipeline → text

Model is cached at module level (`cachedPipeline`) so it survives component remounts. ~40MB download on first use, then cached by the browser and service worker.

## iOS / WebKit — Critical

**All iOS browsers (Brave, Chrome, Firefox, Safari) use Apple's WebKit engine.** There is no Chromium on iPhone.

- Service workers are NOT registered on iOS — they cause page reloads via skipWaiting/clients.claim, which kills mic permissions
- Any existing service worker from a previous deploy is actively unregistered on iOS
- The `apple-mobile-web-app-capable` meta tag was removed — it puts iOS into a restrictive standalone security context that breaks mic permissions
- iOS aggressively evicts service worker caches (~7 days no use)
- `beforeinstallprompt` never fires on iOS — PWA install banner is invisible there
- AudioContext must be created from a user gesture on iOS

**Before touching service worker or PWA code, test on an iPhone.** The user tests on Brave for iPhone.

## PWA

- `public/manifest.json` — app manifest with icons
- `public/sw.js` — service worker (registered on non-iOS only)
  - Precaches app shell on install
  - Caches HuggingFace model files at runtime (cache-first, immutable by content hash)
  - Same-origin assets: stale-while-revalidate
  - Navigation: network-first with offline fallback
- `InstallBanner.tsx` — shows a dismissable install prompt at the bottom of the page after the user's first successful transcription. Persists dismissal in localStorage.

## Audio Recording

- MIME type detection: tries `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` (iOS uses mp4)
- Manual chunking: audio is split into 28-second segments for transcription (Whisper has a 30s context window)
- Max recording duration: 2 minutes (auto-stops)
- Multi-clip append mode: each recording appends to accumulated text

## Gotchas

1. **Don't add skipWaiting/clients.claim without iOS testing** — causes reload loops that destroy the cached model and mic permissions
2. **AudioContext creation** — `audioToFloat32` creates a new AudioContext per call. iOS limits concurrent contexts. Always close them.
3. **In-app browsers** (Telegram, WhatsApp, Instagram) can't cache the model between visits — the app warns users about this
4. **Model size** — Tiny English is ~40MB, Small is ~250MB. These download over the network on first use. Don't assume instant availability.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Design

"Retro 82" theme with light/dark toggle. CSS custom properties for theming (`--fg`, `--bg`, `--surface`, `--accent`, `--teal`, `--muted`, `--red`). Dark mode is default.
