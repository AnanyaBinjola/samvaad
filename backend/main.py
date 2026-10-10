import sys
from pathlib import Path

# Ensure project root is in sys.path for direct script execution
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import base64
import time
import logging
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from backend.config import (
    SUPPORTED_LANGUAGES,
    GEMMA_MODEL_ID,
    GEMINI_API_KEY,
    BACKEND_HOST,
    BACKEND_PORT,
    get_allowed_targets,
)
from backend.services.translation_service import translation_service
from backend.services.speech_service import transcribe_speech_audio, synthesize_speech_wav

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("samvaad.backend")

app = FastAPI(
    title="Samvaad Translation API",
    description="Standalone Multilingual Speech-to-Speech Translation Backend powered by Gemma",
    version="1.0.0",
)

# CORS Middleware to allow browser requests from Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Processing-Seconds"],
)


# Pydantic Schemas
class TextTranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Source speech transcription or text to translate")
    source: str = Field(..., min_length=2, max_length=5, description="Source language ISO code (e.g. 'en')")
    target: str = Field(..., min_length=2, max_length=5, description="Target language ISO code (e.g. 'hi')")


class TextTranslationResponse(BaseModel):
    source_text: str
    translated_text: str
    model: str
    processing_seconds: float
    source_lang: str
    target_lang: str


class HealthStatusResponse(BaseModel):
    status: str
    service: str
    model: str
    api_key_configured: bool
    supported_languages: dict[str, str]


# Health Check Endpoints
@app.get("/", response_model=HealthStatusResponse)
@app.get("/health", response_model=HealthStatusResponse)
@app.get("/api/health", response_model=HealthStatusResponse)
def health_check():
    return HealthStatusResponse(
        status="healthy",
        service="Samvaad Multilingual Speech-to-Speech Translation Studio",
        model=translation_service.model_id,
        api_key_configured=bool(translation_service.api_key),
        supported_languages=SUPPORTED_LANGUAGES,
    )


# Pure Text Translation Endpoint (Gemma Model)
@app.post("/api/translate-text", response_model=TextTranslationResponse)
@app.post("/translate-text", response_model=TextTranslationResponse)
def translate_text_endpoint(
    req: TextTranslationRequest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Translates text directly using the configured Gemma model.
    """
    effective_api_key = x_api_key.strip() if (x_api_key and x_api_key.strip()) else translation_service.api_key
    if effective_api_key != translation_service.api_key:
        translation_service.update_credentials(effective_api_key)

    try:
        result = translation_service.translate(
            text=req.text,
            source_lang=req.source,
            target_lang=req.target,
        )
        return TextTranslationResponse(**result)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(run_err),
        )
    except Exception as exc:
        logger.error(f"Unexpected text translation error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal translation failure: {str(exc)}",
        )


# Full Speech-to-Speech Translation Endpoint (Contract Compliant)
@app.post("/api/translate")
@app.post("/translate")
async def translate_speech_endpoint(
    audio: UploadFile = File(..., description="16-bit PCM WAV audio file"),
    source: str = Form(..., description="Source language code (e.g. 'en')"),
    target: str = Form(..., description="Target language code (e.g. 'hi')"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Full Speech-to-Speech Translation Pipeline:
    1. Ingests 16-bit PCM WAV audio from Resonator or file upload.
    2. Transcribes spoken audio into source text (ASR).
    3. Translates source text using the real Gemma model.
    4. Synthesizes translated speech into high-fidelity 16-bit PCM WAV audio (TTS).
    5. Returns base64 WAV payload, source transcript, and translated text.
    """
    start_total_time = time.perf_counter()

    # 1. Parameter Validation
    source_clean = source.strip().lower()
    target_clean = target.strip().lower()

    if source_clean not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported source language code '{source_clean}'.",
        )
    if target_clean not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported target language code '{target_clean}'.",
        )
    if source_clean == target_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source and target languages must be different ({source_clean} -> {target_clean}).",
        )

    allowed_targets = get_allowed_targets(source_clean)
    if target_clean not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Direct translation from {SUPPORTED_LANGUAGES[source_clean]} to {SUPPORTED_LANGUAGES[target_clean]} is not permitted. Please route via English or Hindi.",
        )

    # 2. Read Audio Payload
    try:
        audio_bytes = await audio.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded audio stream: {str(e)}",
        )

    if not audio_bytes or len(audio_bytes) < 44:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio payload is empty or invalid (missing WAV header).",
        )

    effective_api_key = x_api_key.strip() if (x_api_key and x_api_key.strip()) else translation_service.api_key
    if effective_api_key != translation_service.api_key:
        translation_service.update_credentials(effective_api_key)

    # 3. Speech Recognition (ASR)
    try:
        source_text = transcribe_speech_audio(audio_bytes, source_clean, effective_api_key)
    except ValueError as asr_err:
        logger.warning(f"ASR warning: {asr_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No speech was recognized.",
        )
    except Exception as e:
        logger.error(f"ASR error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech recognition failed: {str(e)}",
        )

    if not source_text or not source_text.strip():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No speech was recognized.",
        )

    # 4. Neural Translation via Gemma Model
    try:
        translation_result = translation_service.translate(
            text=source_text,
            source_lang=source_clean,
            target_lang=target_clean,
        )
        translated_text = translation_result["translated_text"]
    except ValueError as v_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(v_err),
        )
    except RuntimeError as r_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(r_err),
        )

    # 5. Speech Synthesis (TTS) into 16 kHz 16-bit PCM WAV
    try:
        synthesized_wav_bytes = synthesize_speech_wav(translated_text, target_clean)
    except Exception as tts_err:
        logger.error(f"TTS synthesis error: {tts_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech synthesis error: {str(tts_err)}",
        )

    total_processing_seconds = max(0.01, time.perf_counter() - start_total_time)

    # 6. Encode WAV to Base64 for JSON response
    audio_base64 = base64.b64encode(synthesized_wav_bytes).decode("ascii")

    return JSONResponse(
        content={
            "audio_base64": audio_base64,
            "source_text": source_text,
            "translated_text": translated_text,
            "processing_seconds": round(total_processing_seconds, 3),
            "model": translation_service.model_id,
            "source_lang": source_clean,
            "target_lang": target_clean,
        },
        headers={
            "X-Processing-Seconds": f"{total_processing_seconds:.3f}",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        reload=True,
    )
