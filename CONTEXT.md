# VoiceTranscriber

Private voice-to-text web app. Record audio in the browser, transcribe it locally or via OpenAI Whisper API, get plain text back. No database, no accounts, session-only.

## Why

Control over personal voice data. No uploading recordings to random transcription websites. Two modes: fully offline (browser-side Whisper) or API-powered (your own OpenAI key, your own backend).

## Core Interaction

1. User clicks record
2. Speaks for 15s-2min
3. Clicks stop
4. App transcribes audio
5. Text appears in an editable area
6. User edits if needed, copies to clipboard

## Architecture Decisions

### ADR-001: Dual transcription engine
- **Browser mode (default):** `@huggingface/transformers` runs Whisper small/tiny English-only model in-browser via WebAssembly. Audio never leaves the device.
- **API mode (opt-in):** Audio sent to Vercel API route -> OpenAI Whisper API. Requires `OPENAI_API_KEY` env var. Higher quality, faster.
- User toggles between modes in the UI.

### ADR-002: Embeddable component
- Core logic lives in a `<VoiceTranscriber />` React component.
- The Next.js app is a thin wrapper/demo host.
- Component is self-contained: own state, own styles, no external dependencies beyond React.
- Future embedding options: npm package, copy-paste component, or iframe.

### ADR-003: English-only default
- Browser mode ships with English-only Whisper model (~40MB vs ~80MB multilingual).
- UI states "English only" clearly.
- Multilingual support is a future toggle (download larger model).
- API mode supports all Whisper languages out of the box.

### ADR-004: No persistence
- No database, no user accounts, no saved recordings.
- Transcribed text lives in React state only.
- Page refresh = gone. This is intentional.

### ADR-005: Audio constraints
- Max recording length: 2 minutes (enforced in UI with countdown).
- Audio format: WebM/Opus via MediaRecorder API (browser-native, no libraries).
- Compressed audio for 2min typically < 1MB — well within Vercel's 4.5MB limit.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS (minimal, neutral palette) |
| Audio capture | MediaRecorder API (browser-native) |
| Browser transcription | `@huggingface/transformers` (Whisper ONNX) |
| API transcription | OpenAI `whisper-1` via `openai` SDK |
| Deployment | Vercel |

## UI Elements

- **Record button** — large, centered, changes state (idle -> recording -> processing)
- **Timer** — shows elapsed time while recording, counts up to 2:00 cap
- **Mode toggle** — "Browser (offline)" / "API (OpenAI)" switch
- **Text area** — displays transcription result, editable
- **Action icons:**
  - Pen icon — toggles edit mode on the text area
  - Copy icon — copies text to clipboard (with brief "Copied!" feedback)
- **Status indicators** — model loading progress (browser mode), processing spinner

## File Structure

```
VoiceTranscriber/
  src/
    app/
      page.tsx              # Demo/host page
      layout.tsx            # Root layout
      api/
        transcribe/
          route.ts          # OpenAI Whisper API proxy
    components/
      VoiceTranscriber.tsx  # Main embeddable component
      AudioRecorder.tsx     # Mic capture + timer logic
      TranscriptDisplay.tsx # Editable text area + copy/edit icons
      ModeToggle.tsx        # Browser/API switch
      RecordButton.tsx      # Animated record button
    hooks/
      useAudioRecorder.ts   # MediaRecorder hook
      useWhisperBrowser.ts  # Browser-side transcription hook
      useWhisperAPI.ts      # API-side transcription hook
    lib/
      transcribe.ts         # Shared transcription interface
  public/
  tailwind.config.ts
  next.config.ts
  package.json
  tsconfig.json
  CONTEXT.md
  README.md
```

## Implementation Plan

### Phase 1: Project scaffold
- Init Next.js 15 with TypeScript + Tailwind
- Set up file structure
- Deploy blank app to Vercel

### Phase 2: Audio recording
- Build `useAudioRecorder` hook (MediaRecorder API)
- Build `RecordButton` + timer UI
- 2-minute cap with auto-stop
- Test mic permissions flow

### Phase 3: Browser transcription
- Integrate `@huggingface/transformers` with Whisper English-only model
- Build `useWhisperBrowser` hook
- Show model download progress on first use
- Wire up: stop recording -> transcribe -> display text

### Phase 4: API transcription
- Build `/api/transcribe` route (OpenAI SDK)
- Build `useWhisperAPI` hook
- Mode toggle UI
- Graceful fallback if no API key configured

### Phase 5: Polish
- Editable text area with pen icon toggle
- Copy to clipboard with feedback
- Error states (mic denied, transcription failed, etc.)
- Loading/processing states
- Responsive design (works on mobile too)

### Phase 6: Embeddable packaging
- Ensure `<VoiceTranscriber />` is fully self-contained
- Document embedding instructions
- Export component from package

## Environment Variables

```
OPENAI_API_KEY=sk-...   # Optional. Only needed for API mode.
```

## Privacy Model

| Mode | Where audio goes | Who processes it |
|---|---|---|
| Browser | Stays in browser memory | Your device's CPU/GPU |
| API | Browser -> your Vercel function -> OpenAI | OpenAI (API data policy: not used for training) |

In both modes, audio is never stored. It exists in memory during processing only.
