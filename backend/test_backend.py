import io
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

# Ensure project root is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.main import app
from backend.services.translation_service import translation_service

client = TestClient(app)

def test_health_check_default_gemma4_model():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Samvaad" in data["service"]
    assert data["model"] == "gemma-4-26b-a4b-it"
    assert "en" in data["supported_languages"]
    assert "hi" in data["supported_languages"]

def test_api_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model"] == "gemma-4-26b-a4b-it"

def test_model_used_by_translation_service():
    """
    Verifies that the actual translation service invokes generate_content
    with the exact configured Gemma model ID (gemma-4-26b-a4b-it).
    """
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "नमस्ते, यह अनुवाद का परीक्षण है।"
    mock_genai_client.models.generate_content.return_value = mock_response

    # Temporarily attach mock client
    original_client = translation_service._client
    original_key = translation_service.api_key
    try:
        translation_service._client = mock_genai_client
        translation_service.api_key = "test_key"
        
        result = translation_service.translate(
            text="Hello, this is a test translation.",
            source_lang="en",
            target_lang="hi",
        )

        assert result["model"] == "gemma-4-26b-a4b-it"
        assert result["translated_text"] == "नमस्ते, यह अनुवाद का परीक्षण है।"
        
        # Verify generate_content was called with model='gemma-4-26b-a4b-it'
        mock_genai_client.models.generate_content.assert_called_once()
        _, kwargs = mock_genai_client.models.generate_content.call_args
        assert kwargs["model"] == "gemma-4-26b-a4b-it"
        assert "Hello, this is a test translation." in kwargs["contents"]
    finally:
        translation_service._client = original_client
        translation_service.api_key = original_key

def test_translate_text_missing_api_key():
    # Without an API key configured, endpoint returns 400 with helpful instruction
    original_key = translation_service.api_key
    original_client = translation_service._client
    try:
        translation_service.api_key = ""
        translation_service._client = None
        response = client.post(
            "/api/translate-text",
            json={"text": "Hello world", "source": "en", "target": "hi"}
        )
        assert response.status_code == 400
        assert "GEMINI_API_KEY is not configured" in response.json()["detail"]
    finally:
        translation_service.api_key = original_key
        translation_service._client = original_client

def test_translate_text_validation_same_lang():
    response = client.post(
        "/api/translate-text",
        json={"text": "Hello world", "source": "en", "target": "en"}
    )
    assert response.status_code == 400
    assert "Source and target languages must be different" in response.json()["detail"]

def test_translate_text_validation_invalid_route():
    response = client.post(
        "/api/translate-text",
        json={"text": "Hello world", "source": "ru", "target": "zh"}
    )
    assert response.status_code == 400
    assert "not permitted" in response.json()["detail"]

def test_translate_speech_empty_payload():
    response = client.post(
        "/api/translate",
        data={"source": "en", "target": "hi"},
        files={"audio": ("empty.wav", b"", "audio/wav")}
    )
    assert response.status_code == 400
    assert "empty or invalid" in response.json()["detail"]

def test_translate_speech_non_speech_tone():
    with open("test_sample.wav", "rb") as f:
        audio_data = f.read()
    response = client.post(
        "/api/translate",
        data={"source": "en", "target": "hi"},
        files={"audio": ("test_sample.wav", audio_data, "audio/wav")}
    )
    # Non-speech tone returns 500 "No speech was recognized."
    assert response.status_code == 500
    assert "No speech was recognized" in response.json()["detail"]

if __name__ == "__main__":
    print("=== Running Samvaad Backend Test Suite ===")
    test_health_check_default_gemma4_model()
    print("✓ test_health_check_default_gemma4_model passed")
    test_api_health_check()
    print("✓ test_api_health_check passed")
    test_model_used_by_translation_service()
    print("✓ test_model_used_by_translation_service passed (verified gemma-4-26b-a4b-it dispatch)")
    test_translate_text_missing_api_key()
    print("✓ test_translate_text_missing_api_key passed")
    test_translate_text_validation_same_lang()
    print("✓ test_translate_text_validation_same_lang passed")
    test_translate_text_validation_invalid_route()
    print("✓ test_translate_text_validation_invalid_route passed")
    test_translate_speech_empty_payload()
    print("✓ test_translate_speech_empty_payload passed")
    test_translate_speech_non_speech_tone()
    print("✓ test_translate_speech_non_speech_tone passed")
    print("\n=== ALL BACKEND TESTS PASSED (8/8) ===")
