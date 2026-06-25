# VoiceTranscriber

Private voice-to-text dictation tool. Record audio in the browser, transcribe locally or via OpenAI Whisper API, get editable text back. No database, no accounts, session-only.

## Glossary

- **Dictation** — The primary use case. User speaks for 30s-3min to produce text they'll paste elsewhere (messages, docs, emails). Not quick voice notes; not meeting transcription.
- **Browser mode** — Default transcription mode. Audio is processed entirely on-device via Whisper ONNX (WebAssembly). Nothing leaves the browser. Hard cap: 2 minutes (auto-stops). Best accuracy under 30 seconds. Beyond that, Whisper tiny degrades — record multiple short clips instead.
- **API mode** — Opt-in transcription mode. Audio sent to a Vercel API route which proxies to OpenAI Whisper API. Higher quality, handles longer recordings (up to 25 min). Requires `OPENAI_API_KEY`.
- **Auto-switch** — Two-stage behaviour when a recording approaches browser mode's practical limit. Stage 1 (warning): a non-intrusive banner appears during recording as the limit approaches ("Longer recordings need API for best results"). Stage 2 (consent): after the user stops, a prompt asks permission before sending audio to the API ("This recording is longer than browser mode handles well. Send to API for better results?"). Audio is never sent off-device without explicit consent. Exact trigger thresholds TBD via user testing.
- **Hard cap** — Recording auto-stops at 2 minutes. The recommended duration for best accuracy is under 30 seconds. The timer turns amber after 30s as a gentle signal.
- **Model** — `onnx-community/whisper-tiny.en` (English-only, ~150MB fp32). Downloaded once on first use, cached in browser IndexedDB. Runs via WASM on main thread.
- **Get Ready** — Pre-recording step where the user triggers the one-time model download. Mic button only appears after the model is loaded.
- **Instructions panel** — Collapsible panel in the UI explaining: model in use, step-by-step guide, realistic recording limits, and expected wait times. Essential because the component will be embedded in other apps where end users (not developers) need to understand the flow.
- **Chunked processing** — Whisper processes audio in 30-second windows. Without chunking, only the first ~30s is transcribed. The pipeline must use `chunk_length_s` and `stride_length_s` to split longer audio into overlapping segments and stitch text together.
- **In-app browser** — Ephemeral WebViews (Telegram, WhatsApp, Instagram, etc.) don't persist Cache API, so the ~150MB model re-downloads every visit. The app detects in-app browsers and shows a one-time warning suggesting the user open their default browser. No forced API mode, no workarounds — if they ignore the warning, that's on them.
- **iOS model lock** — On iOS/iPadOS (all browsers are WebKit), only the ~150 MB Tiny English model (`whisper-tiny.en`, fp32) is allowed. Base (~290 MB) and Small (~950 MB) risk exceeding WebKit's per-tab WASM memory ceiling on older iPhones. The app force-selects Tiny English on iOS and greys out every other option in Model settings with a plain-language note. This is also the fix for the out-of-memory "stuck loading" loop a returning user could hit with a larger model.
- **Snippet buckets** — User-managed containers for saving dictated text. Pick an active bucket; every finished transcript auto-saves into it. Add/rename/remove buckets (cap of 12). Stored in IndexedDB (`voicetranscriber-snippets`) behind `navigator.storage.persist()` — the same durable mechanism as the model cache, chosen because `localStorage` is evicted aggressively on iOS/Brave. Snippets carry a TTL (`SNIPPET_RETENTION_MS`, 7 days) and are pruned on load. Best-effort: a browser set to clear data on exit can still wipe them.

## Privacy Model

| Mode | Where audio goes | Who processes it |
|---|---|---|
| Browser | Stays in browser memory | Your device's CPU/WASM |
| API | Browser → your Vercel function → OpenAI | OpenAI (not used for training per API policy) |

In both modes, audio is never stored. It exists in memory during processing only.
