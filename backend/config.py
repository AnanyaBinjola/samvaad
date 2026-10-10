import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root or backend directory
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

# Configuration Settings
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip() or os.environ.get("GOOGLE_API_KEY", "").strip()
GEMMA_MODEL_ID = os.environ.get("GEMMA_MODEL_ID", "gemma-4-26b-a4b-it").strip()

BACKEND_HOST = os.environ.get("BACKEND_HOST", "127.0.0.1").strip()
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8000"))

# Supported Language Matrix (16 Conference Languages)
SUPPORTED_LANGUAGES = {
    "af": "Afrikaans",
    "ar": "Arabic",
    "zh": "Chinese",
    "en": "English",
    "es": "Spanish",
    "fa": "Persian",
    "hi": "Hindi",
    "id": "Indonesian",
    "kk": "Kazakh",
    "ms": "Malay",
    "pt": "Portuguese",
    "ru": "Russian",
    "sw": "Swahili",
    "th": "Thai",
    "uz": "Uzbek",
    "vi": "Vietnamese",
}

# English & Hindi Pivot Routing Rules
def get_allowed_targets(source: str) -> list[str]:
    if source in ("en", "hi"):
        return [code for code in SUPPORTED_LANGUAGES if code != source]
    return ["en", "hi"]
