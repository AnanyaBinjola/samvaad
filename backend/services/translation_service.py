import time
import logging
from google import genai
from backend.config import SUPPORTED_LANGUAGES, GEMMA_MODEL_ID, GEMINI_API_KEY, get_allowed_targets

logger = logging.getLogger(__name__)

class GemmaTranslationService:
    def __init__(self, api_key: str = GEMINI_API_KEY, model_id: str = GEMMA_MODEL_ID):
        self.api_key = api_key
        self.model_id = model_id
        self._client = None
        if self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Google GenAI Client: {e}")

    def update_credentials(self, api_key: str, model_id: str = None):
        self.api_key = api_key
        if model_id:
            self.model_id = model_id
        if self.api_key:
            self._client = genai.Client(api_key=self.api_key)
        else:
            self._client = None

    def translate(self, text: str, source_lang: str, target_lang: str) -> dict:
        """
        Translates text from source_lang to target_lang using a real Gemma model.
        Returns a dict with: source_text, translated_text, model, processing_seconds.
        """
        if not text or not text.strip():
            raise ValueError("Input text is empty.")

        if source_lang not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported source language code '{source_lang}'.")

        if target_lang not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported target language code '{target_lang}'.")

        if source_lang == target_lang:
            raise ValueError(f"Source and target languages must be different ({source_lang} -> {target_lang}).")

        allowed_targets = get_allowed_targets(source_lang)
        if target_lang not in allowed_targets:
            raise ValueError(
                f"Translation route from {SUPPORTED_LANGUAGES[source_lang]} directly to "
                f"{SUPPORTED_LANGUAGES[target_lang]} is not permitted. Please route via English (en) or Hindi (hi)."
            )

        source_name = SUPPORTED_LANGUAGES[source_lang]
        target_name = SUPPORTED_LANGUAGES[target_lang]

        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY is not configured on the backend server. "
                "Please set GEMINI_API_KEY in your .env file to enable real Gemma model translation."
            )

        # Build precision prompt for Gemma instruction-tuned model
        prompt = (
            f"You are a professional diplomatic translator for international multilateral conferences.\n"
            f"Translate the following speech transcript faithfully and accurately from {source_name} ({source_lang}) to {target_name} ({target_lang}).\n"
            f"Preserve the exact meaning, respectful diplomatic tone, honorifics, and natural spoken cadence.\n"
            f"Output ONLY the raw translated text. Do NOT include markdown code blocks, quotes, explanations, or introductory text.\n\n"
            f"Source Text ({source_name}):\n"
            f"{text.strip()}"
        )

        start_time = time.perf_counter()
        
        try:
            if not self._client:
                self._client = genai.Client(api_key=self.api_key)

            response = self._client.models.generate_content(
                model=self.model_id,
                contents=prompt
            )

            raw_output = response.text or ""
            # Clean any leading/trailing quotes or markdown artifacts
            translated_text = raw_output.strip().strip('"').strip("'").strip()
            
            processing_seconds = max(0.01, time.perf_counter() - start_time)

            return {
                "source_text": text.strip(),
                "translated_text": translated_text,
                "model": self.model_id,
                "processing_seconds": round(processing_seconds, 3),
                "source_lang": source_lang,
                "target_lang": target_lang,
            }
        except Exception as e:
            logger.error(f"Gemma model translation error ({self.model_id}): {e}")
            raise RuntimeError(f"Gemma translation error ({self.model_id}): {str(e)}")

# Global singleton service
translation_service = GemmaTranslationService()
