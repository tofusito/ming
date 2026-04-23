import logging
import os
import tempfile
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ming.stt")

STT_MODEL = os.getenv("STT_MODEL", "small")
STT_DEVICE = os.getenv("STT_DEVICE", "cpu")
STT_COMPUTE_TYPE = os.getenv("STT_COMPUTE_TYPE", "int8")
STT_BEAM_SIZE = int(os.getenv("STT_BEAM_SIZE", "1"))
STT_VAD_FILTER = os.getenv("STT_VAD_FILTER", "false").lower() == "true"
STT_INITIAL_PROMPT = os.getenv(
    "STT_INITIAL_PROMPT",
    "The speaker may use Mandarin Chinese, Sichuan regional speech, Andalusian Spanish, family names, and colloquial expressions.",
)

model: WhisperModel | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    start = time.perf_counter()
    model = WhisperModel(STT_MODEL, device=STT_DEVICE, compute_type=STT_COMPUTE_TYPE)
    logger.info("Loaded Whisper model=%s device=%s compute=%s in %.2fs", STT_MODEL, STT_DEVICE, STT_COMPUTE_TYPE, time.perf_counter() - start)
    yield


app = FastAPI(title="ming-translator-stt", version="0.1.0", lifespan=lifespan)


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
) -> dict[str, object]:
    if model is None:
        raise HTTPException(status_code=503, detail="Whisper model is not loaded yet")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio is empty")

    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    started_at = time.perf_counter()
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp.flush()

        kwargs: dict[str, object] = {
            "beam_size": STT_BEAM_SIZE,
            "vad_filter": STT_VAD_FILTER,
            "initial_prompt": STT_INITIAL_PROMPT,
            "task": "transcribe",
        }
        if language:
            kwargs["language"] = language

        segments, info = model.transcribe(tmp.name, **kwargs)
        text = " ".join(segment.text.strip() for segment in segments).strip()

    elapsed = time.perf_counter() - started_at
    logger.info(
        "Transcribed bytes=%s language_hint=%s detected=%s duration=%.2fs elapsed=%.2fs",
        len(audio_bytes),
        language,
        getattr(info, "language", None),
        getattr(info, "duration", 0.0) or 0.0,
        elapsed,
    )

    return {
        "text": text,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "duration": getattr(info, "duration", None),
    }
