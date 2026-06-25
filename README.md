# VoiceTranscriber

Private voice-to-text web app. Record audio in the browser, transcribe it locally using Whisper or via the OpenAI API. No database, no accounts, no stored recordings.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How It Works

1. Click the mic button to record (max 2 minutes)
2. Click stop
3. Audio is transcribed automatically
4. Edit the result if needed, then copy to clipboard

## Transcription Modes

| Mode | Privacy | Quality | Speed |
|---|---|---|---|
| **Browser** (default) | Audio never leaves your device | Good (Whisper tiny English) | ~150MB model download on first use |
| **API** (opt-in) | Audio sent to OpenAI | Better (Whisper large) | Fast, requires API key |

## Environment Variables

```
OPENAI_API_KEY=sk-...   # Optional. Enables API transcription mode.
```

Without `OPENAI_API_KEY`, the app runs in browser-only mode. The mode toggle is hidden.

## Embedding the Component

```tsx
import { VoiceTranscriber } from './src';

// Default: browser mode, 2-minute max
<VoiceTranscriber />

// Custom configuration
<VoiceTranscriber
  defaultMode="browser"
  maxDuration={60}
  apiEndpoint="/my-custom-endpoint"
  className="my-custom-styles"
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultMode` | `'browser' \| 'api'` | `'browser'` | Initial transcription mode |
| `apiEndpoint` | `string` | `'/api/transcribe'` | Custom API endpoint for API mode |
| `maxDuration` | `number` | `120` | Max recording duration in seconds |
| `className` | `string` | `undefined` | Additional CSS classes for the container |

### Requirements

- React 19+
- Tailwind CSS (component uses Tailwind utility classes)
- `@huggingface/transformers` (peer dependency for browser mode)

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- `@huggingface/transformers` (Whisper ONNX, browser-side)
- `openai` SDK (API mode)

## Privacy

In browser mode, audio is processed entirely on your device using WebAssembly. Nothing is uploaded anywhere. In API mode, audio is sent to your own Vercel function, which forwards it to OpenAI. In both modes, audio exists only in memory during processing and is never persisted.
