# Ming Translator App Plan

## Goal

Build a mobile-first, self-hosted web app for family conversations between:

- Mandarin Chinese / Sichuan-flavored Chinese
- Andalusian Spanish / natural family Spanish

The app should support two interaction styles:

1. A walkie-talkie mode for one-handed use and simpler turn-taking.
2. A shared split-screen mode for two people facing each other across one phone.

## Product Direction

### UX Principles

- Mobile-first, single-screen experience.
- Very large touch targets.
- Minimal reading burden for older family members.
- Clear turn-taking.
- Fast feedback at every step: listening, transcribing, translating, speaking.

### Proposed Main Screen

- Top bar with a segmented control:
  - `Pulsa`
  - `Split`
- In `Walkie` mode:
  - header with current direction:
    - `Chinese -> Spanish`
    - `Spanish -> Chinese`
  - one large microphone button centered near the bottom
  - two stacked cards:
    - original transcript
    - final translation
  - a compact switch action:
    - flip conversation direction
  - this is the default opening view
- In `Split` mode:
  - the screen is divided into two halves
  - top half belongs to one person
  - bottom half belongs to the other person
  - the bottom half is rotated 180 degrees for natural reading across the table

### Interaction Modes

#### Walkie Mode

This should be the default mode.

Why it fits the product:

- it is the fastest way to open the app and start talking
- it works better on smaller phones
- it is simpler for first-time use
- it keeps the main interaction obvious: press, stop, translate, listen

#### Split Mode

Why it fits the product:

- the phone sits in the middle of the table
- each person has a clear side to tap
- nobody needs to pass the device around
- it feels more like a real interpreter device than a generic recorder

Each half should contain:

- a large press-to-talk button
- live transcript for that speaker
- translated result for the other person
- replay button for spoken output

Rules:

- only one side can record at a time
- after a side finishes, the app transcribes, translates, and optionally speaks the result aloud
- each side keeps a short local history of its last turn

## Recommended Architecture

### Services

- `api`: orchestration service
  - accepts text or audio turns
  - calls STT
  - calls Kimi
  - optionally calls TTS
- `stt`: self-hosted speech-to-text
- `tts`: self-hosted text-to-speech
- `web`: mobile UI served behind the stack

### Why this split

- Kimi should only be used for translation and phrasing quality.
- Speech recognition and speech synthesis should remain local and self-hosted.
- The API key stays server-side.
- Each component can be tuned independently without rewriting the whole app.

## Model Choice

### Kimi

Use `kimi-k2.6` by default, configurable via environment.

Reasoning:

- The public Kimi docs currently document `kimi-k2.6`, `kimi-k2.5`, and the older `kimi-k2-*` preview family.
- The older `kimi-k2` series is marked for discontinuation on May 25, 2026.
- I do not see an officially documented `kimi-k2.6-fast` model name in the public docs as of April 22, 2026.
- `kimi-k2.6` is the best default if the priority is higher translation quality and better instruction following.

This is an inference from the currently published docs, not a claim that Moonshot will never release a faster K2.6 variant.

### Provider Routing

Use OpenRouter as the default provider path for `moonshotai/kimi-k2.6`.

Reasoning:

- OpenRouter exposes an OpenAI-compatible API surface.
- The documented base URL is `https://openrouter.ai/api/v1`.
- The documented model identifier is `moonshotai/kimi-k2.6`.
- This lets the app spend existing OpenRouter credits while keeping the backend implementation simple.

Keep the direct Moonshot path commented in the API code as a fallback.

## Speech Stack Choice

### STT: faster-whisper

Use `faster-whisper` with the `large-v3` model by default.

Why:

- strong multilingual accuracy
- good production footprint compared to vanilla Whisper
- suitable for Chinese and Spanish
- easy to self-host as a dedicated service

### TTS: Piper

Use `Piper` for local synthesis.

Why:

- lighter and simpler than XTTS
- good enough quality for a family translator
- much faster to build and run on CPU
- suitable for self-hosted low-maintenance deployment

## Translation Prompt Strategy

The translation layer should optimize for:

- spoken naturalness
- family comprehension
- regional meaning preservation
- clarity over literalism

The system prompt should explicitly handle:

- Mandarin Chinese
- Sichuan regional expressions when present
- Andalusian Spanish phrasing when present
- family and in-law conversation tone

Rules:

- preserve meaning first
- preserve warmth and politeness when present
- do not exaggerate dialect
- if there is no good dialect-equivalent phrase, choose natural plain speech
- return only the translated utterance unless ambiguity requires a short clarification

## Deployment Notes

- Run the stack with Docker Compose.
- Put Cloudflare Tunnel in front of the web app or reverse proxy later.
- Add an auth layer before exposing it on the public internet.
- Keep `MOONSHOT_API_KEY` only in server environment variables.
- Persist STT/TTS model caches using Docker volumes.

## Frontend Direction for Next Iteration

Recommended stack:

- React + Vite
- installable PWA
- MediaRecorder for mobile audio capture
- direct upload to the `/turn` endpoint

Frontend state should include:

- current mode: `walkie | split`
- active side in split mode: `top | bottom`
- current direction in walkie mode: `zh_to_es | es_to_zh`
- transcript and translation per side
- busy state per side
- playback state per side

## Sources

- Kimi API overview: <https://platform.kimi.ai/docs/api/overview>
- Kimi model list: <https://platform.kimi.ai/docs/models>
- Kimi K2.6 quickstart: <https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart>
- Kimi pricing and limits overview: <https://platform.kimi.ai/docs/pricing/limits>
- OpenRouter quickstart: <https://openrouter.ai/docs/quickstart>
- OpenRouter authentication: <https://openrouter.ai/docs/api/reference/authentication>
- OpenRouter Kimi K2.6 model page: <https://openrouter.ai/moonshotai/kimi-k2.6>
- OpenAI Whisper repository: <https://github.com/openai/whisper>
- faster-whisper repository: <https://github.com/SYSTRAN/faster-whisper>
- Coqui XTTS docs: <https://docs.coqui.ai/en/latest/models/xtts.html>
- Coqui TTS docker docs: <https://docs.coqui.ai/en/dev/docker_images.html>
