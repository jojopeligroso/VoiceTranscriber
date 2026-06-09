# VoiceTranscriber

Private voice-to-text dictation tool. Record audio in the browser, transcribe locally or via OpenAI Whisper API, get editable text back. No database, no accounts, session-only.

## Glossary

- **Dictation** — The primary use case. User speaks for 30s-3min to produce text they'll paste elsewhere (messages, docs, emails). Not quick voice notes; not meeting transcription.
- **Browser mode** — Default transcription mode. Audio is processed entirely on-device via Whisper ONNX (WebAssembly). Nothing leaves the browser. Realistic quality limit: ~2-3 minutes. Beyond that, Whisper tiny drops words or cuts off mid-sentence.
- **API mode** — Opt-in transcription mode. Audio sent to a Vercel API route which proxies to OpenAI Whisper API. Higher quality, handles longer recordings (up to 25 min). Requires `OPENAI_API_KEY`.
- **Auto-switch** — Two-stage behaviour when a recording approaches browser mode's practical limit. Stage 1 (warning): a non-intrusive banner appears during recording as the limit approaches ("Longer recordings need API for best results"). Stage 2 (consent): after the user stops, a prompt asks permission before sending audio to the API ("This recording is longer than browser mode handles well. Send to API for better results?"). Audio is never sent off-device without explicit consent. Exact trigger thresholds TBD via user testing.
- **Soft cap** — The UI shows a recommended recording duration (~2-3 min in browser mode) but does not force-stop the recording. The cap is guidance, not enforcement.
- **Model** — `onnx-community/whisper-tiny.en` (English-only, ~150MB fp32). Downloaded once on first use, cached in browser IndexedDB. Runs via WASM on main thread.
- **Get Ready** — Pre-recording step where the user triggers the one-time model download. Mic button only appears after the model is loaded.
- **Instructions panel** — Collapsible panel in the UI explaining: model in use, step-by-step guide, realistic recording limits, and expected wait times. Essential because the component will be embedded in other apps where end users (not developers) need to understand the flow.
- **Chunked processing** — Whisper processes audio in 30-second windows. Without chunking, only the first ~30s is transcribed. The pipeline must use `chunk_length_s` and `stride_length_s` to split longer audio into overlapping segments and stitch text together.

## Privacy Model

| Mode | Where audio goes | Who processes it |
|---|---|---|
| Browser | Stays in browser memory | Your device's CPU/WASM |
| API | Browser → your Vercel function → OpenAI | OpenAI (not used for training per API policy) |

In both modes, audio is never stored. It exists in memory during processing only.
