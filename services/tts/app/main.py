import logging
import os
import subprocess
import tempfile
import time

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ming.tts")

TTS_ES_VOICE = os.getenv("TTS_ES_VOICE", "es_ES-davefx-medium")
TTS_ZH_VOICE = os.getenv("TTS_ZH_VOICE", "zh_CN-huayan-medium")
TTS_PIPER_DOWNLOAD_DIR = os.getenv("TTS_PIPER_DOWNLOAD_DIR", "/root/.local/share/piper")


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: str = Field(pattern="^(es|zh-cn)$")


def resolve_voice(language: str) -> str:
    if language == "es":
        return TTS_ES_VOICE
    if language == "zh-cn":
        return TTS_ZH_VOICE
    raise HTTPException(status_code=400, detail=f"Unsupported language '{language}'")


def ensure_voice(voice: str) -> None:
    subprocess.run(
        [
            "python",
            "-m",
            "piper.download_voices",
            "--data-dir",
            TTS_PIPER_DOWNLOAD_DIR,
            voice,
        ],
        capture_output=True,
        text=True,
        check=True,
    )


app = FastAPI(title="ming-translator-tts", version="0.1.0")


@app.on_event("startup")
def startup_event() -> None:
    for voice in {TTS_ES_VOICE, TTS_ZH_VOICE}:
        started_at = time.perf_counter()
        ensure_voice(voice)
        logger.info("Prepared Piper voice=%s in %.2fs", voice, time.perf_counter() - started_at)


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "engine": "piper"}


@app.post("/synthesize")
def synthesize(request: SynthesizeRequest):
    voice = resolve_voice(request.language)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        output_path = tmp.name

    command = [
        "python",
        "-m",
        "piper",
        "-m",
        voice,
        "--data-dir",
        TTS_PIPER_DOWNLOAD_DIR,
        "-f",
        output_path,
    ]

    started_at = time.perf_counter()
    try:
        subprocess.run(
            command,
            input=request.text.strip(),
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Piper synthesis failed: {exc.stderr.strip() or exc.stdout.strip() or 'unknown error'}",
        ) from exc

    logger.info(
        "Synthesized voice=%s chars=%s elapsed=%.2fs",
        voice,
        len(request.text.strip()),
        time.perf_counter() - started_at,
    )

    return FileResponse(output_path, media_type="audio/wav", filename="speech.wav")
