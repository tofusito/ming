import asyncio
import base64
import json
import logging
import os
import subprocess
import tempfile
import time
from typing import Literal

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field


Direction = Literal["zh_to_es", "es_to_zh"]


def _gemini_post_with_retry(client: httpx.Client, url: str, headers: dict, body: dict, retries: int = 3) -> httpx.Response:
    """POST to Gemini retrying on 429/503 with exponential backoff."""
    for attempt in range(retries + 1):
        response = client.post(url, headers=headers, json=body)
        if response.status_code not in (429, 503) or attempt == retries:
            return response
        delay = 2 ** attempt
        logger.warning("Gemini %s, reintentando en %ds (intento %d/%d)", response.status_code, delay, attempt + 1, retries)
        time.sleep(delay)
    return response  # unreachable but satisfies type checker


async def _http_post_with_retry(client: httpx.AsyncClient, url: str, retries: int = 3, delay: float = 1.0, **kwargs) -> httpx.Response:
    """POST to internal service retrying on 5xx or connection errors."""
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await client.post(url, **kwargs)
            if response.status_code < 500 or attempt == retries:
                return response
            logger.warning("%s devolvió %s, reintentando (intento %d/%d)", url, response.status_code, attempt + 1, retries)
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt == retries:
                raise
            logger.warning("%s error de conexión: %s, reintentando (intento %d/%d)", url, exc, attempt + 1, retries)
        await asyncio.sleep(delay)
    if last_exc:
        raise last_exc
    return response
ProcessingMode = Literal["classic", "direct_audio"]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ming.api")

app = FastAPI(title="ming-translator-api", version="0.1.0")

STT_URL = os.getenv("STT_URL", "http://stt:9001")
TTS_URL = os.getenv("TTS_URL", "http://tts:9002")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "deepseek").strip().lower()
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

# OpenRouter / Moonshot fallback if you want to restore them later.
# OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
# OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "moonshotai/kimi-k2.5:nitro")
# OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "")
# OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "Ming Translator")
# KIMI_BASE_URL = os.getenv("KIMI_BASE_URL", "https://api.moonshot.ai/v1")
# KIMI_MODEL = os.getenv("KIMI_MODEL", "kimi-k2.5")
# KIMI_DISABLE_THINKING = os.getenv("KIMI_DISABLE_THINKING", "true").lower() == "true"


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    direction: Direction


class TranslateResponse(BaseModel):
    direction: Direction
    source_text: str
    translated_text: str
    output_language: str


class TurnResponse(BaseModel):
    direction: Direction
    transcript: str
    transcript_language: str | None
    translation: str
    output_language: str
    audio_base64: str | None = None
    audio_content_type: str | None = None


def build_system_prompt(direction: Direction) -> str:
    if direction == "zh_to_es":
        return (
            "You are a family conversation translator. Translate spoken Chinese into natural spoken Spanish. "
            "The Chinese may contain Mandarin usage, regional Sichuan expressions, family shorthand, or colloquial phrasing. "
            "The Spanish should sound natural and easy to understand for Andalusian family members, but never parody dialect. "
            "Preserve intent, politeness, warmth, and implied meaning. "
            "If there is no true dialect-equivalent phrase, use plain natural Spanish. "
            "Return only the translated utterance."
        )

    return (
        "You are a family conversation translator. Translate spoken Spanish into natural spoken Simplified Chinese. "
        "The Spanish may contain Andalusian phrasing, clipped pronunciation, colloquial family wording, or culturally specific expressions. "
        "The Chinese should be easy for Chinese family members to understand, while gently reflecting Sichuan-style conversational warmth when appropriate. "
        "Do not force dialect slang if it reduces clarity. "
        "Preserve intent, politeness, warmth, and implied meaning. "
        "Return only the translated utterance in Simplified Chinese."
    )


def output_language_for(direction: Direction) -> str:
    return "es" if direction == "zh_to_es" else "zh-cn"


def input_language_for(direction: Direction) -> str:
    return "zh" if direction == "zh_to_es" else "es"


def source_extension_for(content_type: str | None) -> str:
    mapping = {
        "audio/webm": ".webm",
        "video/webm": ".webm",
        "audio/mp4": ".m4a",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/flac": ".flac",
        "audio/aac": ".aac",
    }
    return mapping.get((content_type or "").split(";")[0].strip().lower(), ".bin")


def normalize_audio_for_gemini(audio_bytes: bytes, content_type: str | None) -> tuple[bytes, str]:
    source_suffix = source_extension_for(content_type)

    with tempfile.TemporaryDirectory() as temp_dir:
        source_path = os.path.join(temp_dir, f"source{source_suffix}")
        output_path = os.path.join(temp_dir, "normalized.wav")

        with open(source_path, "wb") as source_file:
            source_file.write(audio_bytes)

        process = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                source_path,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                output_path,
            ],
            capture_output=True,
            text=True,
        )
        if process.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f"Audio normalization failed: {process.stderr.strip() or 'ffmpeg error'}",
            )

        with open(output_path, "rb") as output_file:
            return output_file.read(), "audio/wav"


def build_direct_audio_prompt(direction: Direction) -> str:
    if direction == "zh_to_es":
        return (
            "Listen carefully to this short family conversation audio. "
            "The speaker is expected to speak Chinese, which may include Mandarin, Sichuan regional usage, "
            "colloquial family wording, or imperfect pronunciation. "
            "First transcribe only the words that are actually audible, using Simplified Chinese when possible. "
            "Do not invent names, places, or extra context that are not clearly present in the audio. "
            "Then translate it into natural spoken Spanish that sounds clear and warm for Andalusian family members, "
            "without parodying dialect. "
            "Return only valid JSON with keys transcript, translation, and detected_language. "
            "detected_language must be a short BCP-47 style code such as zh-CN or es-ES."
        )

    return (
        "Listen carefully to this short family conversation audio. "
        "The speaker is expected to speak Spanish, which may include Andalusian phrasing, clipped pronunciation, "
        "or colloquial family wording. "
        "First transcribe only the words that are actually audible in Spanish. "
        "Do not invent names, places, or extra context that are not clearly present in the audio. "
        "Then translate it into clear natural Simplified Chinese that Chinese family members can understand easily, "
        "gently reflecting Sichuan conversational warmth only when it improves naturalness. "
        "Return only valid JSON with keys transcript, translation, and detected_language. "
        "detected_language must be a short BCP-47 style code such as zh-CN or es-ES."
    )


def translate_text(text: str, direction: Direction) -> str:
    if LLM_PROVIDER == "deepseek":
        return translate_text_deepseek(text, direction)
    if LLM_PROVIDER == "gemini":
        return translate_text_gemini(text, direction)
    raise HTTPException(status_code=500, detail=f"Unsupported LLM_PROVIDER '{LLM_PROVIDER}'")


def translate_text_deepseek(text: str, direction: Direction) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY is not configured")

    started_at = time.perf_counter()
    request_body = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {
                "role": "system",
                "content": build_system_prompt(direction),
            },
            {
                "role": "user",
                "content": text.strip(),
            },
        ],
        "thinking": {"type": "disabled"},
        "temperature": 0,
        "max_tokens": 160,
    }

    endpoint = f"{DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions"

    with httpx.Client(timeout=8) as client:
        response = client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=request_body,
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"DeepSeek API failed: {response.text}")

    payload = response.json()
    choices = payload.get("choices") or []
    if not choices:
        raise HTTPException(status_code=502, detail="DeepSeek API returned no choices")

    message = choices[0].get("message") or {}
    content = (message.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="DeepSeek API returned an empty translation")

    logger.info(
        "Translated direction=%s chars=%s provider=deepseek model=%s elapsed=%.2fs source=%r translated=%r",
        direction,
        len(text.strip()),
        DEEPSEEK_MODEL,
        time.perf_counter() - started_at,
        text.strip(),
        content,
    )
    return content


def translate_text_gemini(text: str, direction: Direction) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

    started_at = time.perf_counter()
    request_body = {
        "system_instruction": {
            "parts": [{"text": build_system_prompt(direction)}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": text.strip()}],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 512,
        },
    }

    endpoint = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent"

    with httpx.Client(timeout=30) as client:
        response = _gemini_post_with_retry(
            client,
            endpoint,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            body=request_body,
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Gemini API failed: {response.text}")

    payload = response.json()
    candidates = payload.get("candidates") or []
    if not candidates:
        raise HTTPException(status_code=502, detail="Gemini API returned no candidates")

    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    content = "".join((part.get("text") or "") for part in parts).strip()
    if not content:
        raise HTTPException(status_code=502, detail="Gemini API returned an empty translation")

    logger.info(
        "Translated direction=%s chars=%s provider=gemini model=%s elapsed=%.2fs source=%r translated=%r",
        direction,
        len(text.strip()),
        GEMINI_MODEL,
        time.perf_counter() - started_at,
        text.strip(),
        content,
    )
    return content


def translate_audio_direct(audio_bytes: bytes, content_type: str | None, direction: Direction) -> tuple[str, str, str | None]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

    normalized_audio, normalized_mime_type = normalize_audio_for_gemini(audio_bytes, content_type)
    started_at = time.perf_counter()
    request_body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": build_direct_audio_prompt(direction)},
                    {
                        "inline_data": {
                            "mime_type": normalized_mime_type,
                            "data": base64.b64encode(normalized_audio).decode("ascii"),
                        }
                    },
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "transcript": {"type": "string"},
                    "translation": {"type": "string"},
                    "detected_language": {"type": "string"},
                },
                "required": ["transcript", "translation", "detected_language"],
                "propertyOrdering": ["transcript", "translation", "detected_language"],
            },
        },
    }

    endpoint = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent"

    with httpx.Client(timeout=60) as client:
        response = _gemini_post_with_retry(
            client,
            endpoint,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            body=request_body,
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Gemini audio API failed: {response.text}")

    payload = response.json()
    candidates = payload.get("candidates") or []
    if not candidates:
        raise HTTPException(status_code=502, detail="Gemini audio API returned no candidates")

    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    content = "".join((part.get("text") or "") for part in parts).strip()
    if not content:
        raise HTTPException(status_code=502, detail="Gemini audio API returned an empty response")

    try:
        structured = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini audio API returned invalid JSON: {content}") from exc

    transcript = (structured.get("transcript") or "").strip()
    translation = (structured.get("translation") or "").strip()
    detected_language = (structured.get("detected_language") or "").strip() or None

    if not transcript or not translation:
        raise HTTPException(status_code=502, detail="Gemini audio API returned incomplete fields")

    logger.info(
        "Translated direct-audio direction=%s audio_bytes=%s model=%s elapsed=%.2fs transcript=%r translated=%r detected=%r",
        direction,
        len(audio_bytes),
        GEMINI_MODEL,
        time.perf_counter() - started_at,
        transcript,
        translation,
        detected_language,
    )

    return transcript, translation, detected_language


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/translate", response_model=TranslateResponse)
def translate(request: TranslateRequest) -> TranslateResponse:
    translated = translate_text(request.text, request.direction)
    return TranslateResponse(
        direction=request.direction,
        source_text=request.text.strip(),
        translated_text=translated,
        output_language=output_language_for(request.direction),
    )


@app.post("/turn", response_model=TurnResponse)
async def process_turn(
    direction: Direction = Form(...),
    speak: bool = Form(True),
    processing_mode: ProcessingMode = Form("classic"),
    audio: UploadFile = File(...),
) -> TurnResponse:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio is empty")

    turn_started_at = time.perf_counter()
    transcript = ""
    transcript_language = None
    translation = ""
    stt_elapsed = 0.0
    translation_elapsed = 0.0
    async with httpx.AsyncClient(timeout=180) as client:
        if processing_mode == "direct_audio":
            translation_started_at = time.perf_counter()
            transcript, translation, transcript_language = translate_audio_direct(audio_bytes, audio.content_type, direction)
            translation_elapsed = time.perf_counter() - translation_started_at
        else:
            stt_started_at = time.perf_counter()
            stt_response = await _http_post_with_retry(
                client,
                f"{STT_URL}/transcribe",
                data={"language": input_language_for(direction)},
                files={"file": (audio.filename or "audio.webm", audio_bytes, audio.content_type or "application/octet-stream")},
            )
            if stt_response.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"STT service failed: {stt_response.text}")
            stt_elapsed = time.perf_counter() - stt_started_at

            stt_payload = stt_response.json()
            transcript = (stt_payload.get("text") or "").strip()
            transcript_language = stt_payload.get("language")
            if not transcript:
                raise HTTPException(status_code=422, detail="STT returned an empty transcript")

            translation_started_at = time.perf_counter()
            translation = translate_text(transcript, direction)
            translation_elapsed = time.perf_counter() - translation_started_at

        audio_base64 = None
        audio_content_type = None
        tts_elapsed = 0.0
        if speak:
            tts_started_at = time.perf_counter()
            tts_response = await _http_post_with_retry(
                client,
                f"{TTS_URL}/synthesize",
                json={
                    "text": translation,
                    "language": output_language_for(direction),
                },
            )
            if tts_response.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"TTS service failed: {tts_response.text}")
            audio_content_type = tts_response.headers.get("content-type", "audio/wav")
            audio_base64 = base64.b64encode(tts_response.content).decode("ascii")
            tts_elapsed = time.perf_counter() - tts_started_at

    logger.info(
        "Turn mode=%s direction=%s audio_bytes=%s transcript_chars=%s transcript=%r translation=%r stt=%.2fs translate=%.2fs tts=%.2fs total=%.2fs",
        processing_mode,
        direction,
        len(audio_bytes),
        len(transcript),
        transcript,
        translation,
        stt_elapsed,
        translation_elapsed,
        tts_elapsed,
        time.perf_counter() - turn_started_at,
    )

    return TurnResponse(
        direction=direction,
        transcript=transcript,
        transcript_language=transcript_language,
        translation=translation,
        output_language=output_language_for(direction),
        audio_base64=audio_base64,
        audio_content_type=audio_content_type,
    )
