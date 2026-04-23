# Ming Translator

Self-hosted family voice translator for:

- Mandarin Chinese / Sichuan-flavored Chinese
- Andalusian Spanish / natural family Spanish

## Stack

- `web`: mobile-first React + Vite PWA
- `api`: FastAPI orchestration service
- `stt`: faster-whisper
- `tts`: Piper
- `llm`: OpenRouter routing to `moonshotai/kimi-k2.6`

## Features

- Default walkie-talkie mode for quick use
- Alternate split-screen mode for shared table conversations
- Speech-to-text handled locally
- Translation handled through OpenRouter with Kimi K2.6
- Text-to-speech handled locally
- Voice playback toggle
- Mobile-focused interface with animated feedback

## Quick Start

1. Edit `.env` and set a real `OPENROUTER_API_KEY`.
2. Start the stack:

```bash
docker compose up --build
```

4. Open the app at:

```text
http://localhost:3000
```

## Notes

- The TTS and STT services can take time on first boot because models are downloaded and cached.
- Piper is intentionally used to keep the stack lighter and easier to run on CPU.
- The API key stays server-side and is never exposed to the browser.
- The API layer keeps the direct Moonshot/Kimi setup commented as a fallback, but the active path uses OpenRouter.
