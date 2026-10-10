# Samvaad (संवाद)

> **Your voice. Beyond borders.**

Samvaad is an editorial-grade, standalone multilingual speech-to-speech translation studio engineered for international diplomatic conferences, multilateral forums, and cross-cultural discourse. 

Powered by a high-performance **Python FastAPI** backend and Google's **Gemma** open model family, Samvaad bridges language barriers by ingesting spoken audio through a calibrated browser microphone interface or 16-bit PCM WAV uploads, and synthesizing spoken interpretations across 16 world conference languages.

---

## 📑 Table of Contents

- [Overview & Problem Statement](#-overview--problem-statement)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Supported Languages & Pivot Routing](#-supported-languages--pivot-routing)
- [Prerequisites](#-prerequisites)
- [Step-by-Step Local Setup (macOS)](#-step-by-step-local-setup-macos)
  - [1. Backend Setup](#1-backend-setup-fastapi--gemma)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Frontend Setup](#3-frontend-setup-react--vite)
- [Running the Application](#-running-the-application)
- [How to Use Samvaad](#-how-to-use-samvaad)
- [API Contract & Specifications](#-api-contract--specifications)
- [Automated Verification & Test Suites](#-automated-verification--test-suites)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [Limitations & Future Roadmap](#-limitations--future-roadmap)
- [Security & Privacy Practices](#-security--privacy-practices)
- [License](#-license)

---

## 🌐 Overview & Problem Statement

In multilateral dialogues and global assemblies, language barriers often impede spontaneous communication. Traditional machine translation tools are frequently text-only, clunky, or lack diplomatic register and respectful tone.

**Samvaad** solves this by providing:
1. **Voice-First Interaction**: High-fidelity speech capture with real-time waveform visualization and client-side audio integrity validation.
2. **Context-Aware Translation**: Utilizing Gemma instruction-tuned models with diplomatic tone preservation and honorific accuracy.
3. **Seamless Interpretation**: Generating natural, uncompressed 16-bit 16 kHz PCM WAV speech audio for immediate playback in the listener's native language.
4. **Independent Architecture**: A standalone system decoupled from proprietary network backends, running entirely on open APIs and configurable endpoints.

---

## ✨ Key Features

- **Real Gemma Model Integration**: Employs Google's official Gemma models (default: `gemma-4-26b-a4b-it`, with configurable support for `gemma-4-31b-it`, `gemma-2-9b-it`, `gemma-2-27b-it`) via the Google Gen AI SDK.
- **Calibrated Voice Recording (*The Resonator*)**: Web Audio API-driven recorder capturing broadcast-standard 16-bit mono PCM WAV audio at 16 kHz.
- **WAV Audio Upload & Inspector**: Full client-side RIFF/WAVE header parser inspecting sample rates, bit depth, channel configuration, and flagging flat silence (muted mics).
- **Dual-Column Comparison Studio**: Side-by-side layout displaying original speech transcript and translated text with independent audio playback, speed toggles (0.75x, 1x, 1.25x, 1.5x), and copy actions.
- **16 Conference Languages with Pivot Routing**: Full support for 16 major conference languages routed through English (`en`) and Hindi (`hi`) pivots.
- **VOX Brand Companion**: Dynamic 3D-styled visual mascot with reactive state animations reflecting idle, listening, synthesizing, and error states.
- **Dual Mode Translation**: Full speech-to-speech audio interpretation alongside lightweight direct text-to-text translation endpoints.

---

## 🏛 System Architecture

```
                                      ┌──────────────────────────────────────┐
                                      │        React 19 + Vite Frontend      │
                                      │  - Audio Recording (Resonator)       │
                                      │  - WAV Header Validator              │
                                      │  - Side-by-side Comparison Studio    │
                                      └──────────────────┬───────────────────┘
                                                         │
                                    HTTP POST /api/translate (multipart/form-data)
                                    or POST /api/translate-text (JSON)
                                                         │
                                                         ▼
                                      ┌──────────────────────────────────────┐
                                      │        FastAPI Backend Server        │
                                      │         (Python 3.10+ / 3.13)        │
                                      │  - Request Validation (Pydantic)     │
                                      │  - Language Pivot Enforcer           │
                                      └──────┬───────────┬────────────┬──────┘
                                             │           │            │
                      ┌──────────────────────┘           │            └──────────────────────┐
                      ▼                                  ▼                                   ▼
        ┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
        │  1. Speech Recognition    │      │    2. Neural Translation  │      │    3. Speech Synthesis    │
        │           (ASR)           │      │           (NMT)           │      │           (TTS)           │
        │ - Multimodal Google GenAI │      │ - Google Gemma Models     │      │ - Multilingual gTTS engine│
        │ - Verbatim transcription  │      │ - Model: gemma-4-26b-a4b-it │      │ - FFmpeg / afconvert to   │
        │ - Silent audio rejection  │      │ - Diplomatic system prompt│      │   16kHz 16-bit PCM WAV    │
        └───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
```

---

## 🗺 Supported Languages & Pivot Routing

Samvaad officially supports **16 world conference languages**:

| Code | Language | Native Name | Code | Language | Native Name |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `af` | Afrikaans | Afrikaans | `kk` | Kazakh | Қазақша |
| `ar` | Arabic | العربية | `ms` | Malay | Bahasa Melayu |
| `zh` | Chinese | 中文 | `pt` | Portuguese | Português |
| `en` | **English (Pivot)** | English | `ru` | Russian | Русский |
| `es` | Spanish | Español | `sw` | Swahili | Kiswahili |
| `fa` | Persian | فارسی | `th` | Thai | ไทย |
| `hi` | **Hindi (Pivot)** | हिन्दी | `uz` | Uzbek | Oʻzbekcha |
| `id` | Indonesian | Bahasa Indonesia | `vi` | Vietnamese | Tiếng Việt |

### Pivot Routing Rules
- **Direct Pairs**: Translation between English (`en`) or Hindi (`hi`) and any of the other 15 languages is directly supported in both directions.
- **Multilateral Pairs**: Translations between two non-pivot languages (e.g. Russian → Spanish) are routed through English or Hindi to ensure diplomatic precision.

---

## 💻 Prerequisites

Before setting up Samvaad locally, ensure you have the following installed:

- **Operating System**: macOS (tested on Sonoma / Sequoia) or modern Linux / Windows (WSL2)
- **Node.js**: `v18.0.0` or later (Node 20+ recommended)
- **Python**: `3.10` or later (tested on Python `3.13`)
- **FFmpeg** (recommended for audio synthesis conversion) or native macOS `afconvert` (built-in)
  - Install via Homebrew: `brew install ffmpeg`
- **Google AI Studio API Key**: A valid API key with access to Gemma models. Obtain free from [Google AI Studio](https://aistudio.google.com/).

---

## 🛠 Step-by-Step Local Setup (macOS)

### 1. Backend Setup (FastAPI + Gemma)

Open a new terminal in the project root:

```bash
# Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install required Python dependencies
pip install -r backend/requirements.txt
```

### 2. Environment Configuration

1. Create your local environment file from the provided template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your preferred editor and configure your Google AI Studio API key:
   ```env
   # Google AI Studio API Key (Required for Gemma inference)
   GEMINI_API_KEY=your_actual_api_key_here

   # Gemma Model Selection
   GEMMA_MODEL_ID=gemma-4-26b-a4b-it

   # Backend Host & Port
   BACKEND_HOST=127.0.0.1
   BACKEND_PORT=8000
   ```

> 🔒 **Security Notice**: Never commit `.env` or share your API key. The `.gitignore` file is pre-configured to strictly exclude all environment files.

### 3. Frontend Setup (React + Vite)

In a second terminal window (or the same terminal after testing):

```bash
# Install Node.js dependencies
npm install
```

---

## 🚀 Running the Application

To run the complete Samvaad platform locally, start the backend and frontend in separate terminals:

### Terminal 1: Start the Backend Server
```bash
# Activate virtual environment if not active
source .venv/bin/activate

# Start the FastAPI server
python backend/run.py
# (Alternative: npm run server)
```
*The backend starts at `http://127.0.0.1:8000`.*

### Terminal 2: Start the Frontend Application
```bash
# Start Vite development server
npm run dev
```
*The web interface will be accessible at [http://localhost:5173](http://localhost:5173).*

---

## 📖 How to Use Samvaad

1. **Select Languages**: Choose your speaking language under **"You speak"** and the desired target under **"Translate into"**. Use the swap button (`⇄`) to quickly reverse the direction.
2. **Provide Audio Input**:
   - **Record Mode**: Click **"Start recording"**, speak clearly into your microphone, and click **"Stop recording"**. The waveform and audio inspector will display duration, sample rate, and signal strength.
   - **Upload Mode**: Switch to the **"Upload Audio"** tab and drag-and-drop any standard 16-bit PCM `.wav` file.
3. **Translate**: Click the primary **"Translate"** button.
4. **Review & Listen**:
   - The dual-column studio presents the transcribed speech alongside the translated text.
   - Click **"Play translation"** to listen to the synthesized speech.
   - Adjust playback speed (`0.75x`, `1x`, `1.25x`, `1.5x`) or copy the text directly.

---

## 🔌 API Contract & Specifications

### 1. Health Status
- **Method & Path**: `GET /health` or `GET /api/health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "service": "Samvaad Multilingual Speech-to-Speech Translation Studio",
    "model": "gemma-4-26b-a4b-it",
    "api_key_configured": true,
    "supported_languages": {
      "af": "Afrikaans",
      "ar": "Arabic",
      "en": "English",
      "hi": "Hindi",
      "...": "..."
    }
  }
  ```

### 2. Pure Text Translation (Gemma Engine)
- **Method & Path**: `POST /api/translate-text`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "text": "Distinguished delegates, welcome to the summit.",
    "source": "en",
    "target": "hi"
  }
  ```
- **Response (HTTP 200)**:
  ```json
  {
    "source_text": "Distinguished delegates, welcome to the summit.",
    "translated_text": "मान्यवर प्रतिनिधियों, शिखर सम्मेलन में आपका स्वागत है।",
    "model": "gemma-4-26b-a4b-it",
    "processing_seconds": 0.42,
    "source_lang": "en",
    "target_lang": "hi"
  }
  ```

### 3. Speech-to-Speech Audio Translation
- **Method & Path**: `POST /api/translate`
- **Headers**: `Content-Type: multipart/form-data`
- **Form Data**:
  - `audio`: Binary WAV file (`audio/wav`)
  - `source`: Source language ISO code (e.g. `en`)
  - `target`: Target language ISO code (e.g. `hi`)
- **Response (HTTP 200)**:
  ```json
  {
    "audio_base64": "UklGRi4...",
    "source_text": "Hello, welcome to the international conference.",
    "translated_text": "नमस्ते, अंतरराष्ट्रीय सम्मेलन में आपका स्वागत है।",
    "processing_seconds": 1.15,
    "model": "gemma-4-26b-a4b-it",
    "source_lang": "en",
    "target_lang": "hi"
  }
  ```
- **Response Headers**: `X-Processing-Seconds: 1.150`

---

## 🧪 Automated Verification & Test Suites

Samvaad includes comprehensive test suites across frontend linting, TypeScript compilation, audio validation, and backend inference:

```bash
# 1. Lint the frontend codebase
npm run lint

# 2. Compile TypeScript & build frontend bundle
npm run build

# 3. Run client-side WAV binary & header validation tests
node test-validation.mjs

# 4. Run backend unit & mock Gemma integration tests
.venv/bin/python backend/test_backend.py

# 5. Run end-to-end QA translation & error handling suite
node test-prompt9-qa.mjs

# 6. Run audio streaming reliability test
node test-e2e-reliability.mjs
```

---

## ❓ Troubleshooting & FAQs

### 1. "GEMINI_API_KEY is not configured on the backend server"
- Ensure you have created a `.env` file from `.env.example` in the project root.
- Check that `GEMINI_API_KEY` is populated with a valid key from Google AI Studio.
- Restart the backend server with `.venv/bin/python backend/run.py`.

### 2. "No speech was recognized" (HTTP 500)
- The backend ASR engine detects speech activity. If the recording is silent, muffled, or contains only background tone, it rejects the payload. Speak audibly and check your microphone input volume.

### 3. Microphone permission blocked in browser
- Click the lock/permission icon in your browser's address bar and set **Microphone** to **Allow**.
- Refresh the page and click **"Start recording"** again.

### 4. Direct URL connection failures / CORS issues
- In local development, the frontend is configured to use the Vite Dev Proxy (`/api/translate`), which forwards requests to `http://127.0.0.1:8000` without browser CORS restrictions. If you change the server URL in Settings, ensure CORS headers are allowed on the target backend.

---

## 🔭 Limitations & Future Roadmap

- **API Connectivity**: Gemma translation and speech recognition require an active internet connection to communicate with Google AI Studio endpoints.
- **Pivot Rule**: Direct non-pivot language pairs (e.g. Swahili to Thai) currently require routing through English or Hindi.
- **Future Improvements**:
  - Direct on-device local model inference using `gemma.cpp` / WebAssembly.
  - Low-latency bidirectional WebSocket audio streaming.
  - Fine-tuned multilingual domain adapters for legal and diplomatic terminology.

---

## 🛡 Security & Privacy Practices

- **Zero Secret Exposure**: `.env` and all secret-bearing environment files are strictly ignored by Git and never committed.
- **Backend Key Isolation**: API keys remain exclusively on the server backend and are never bundled into client-side JavaScript assets.
- **Ephemeral Audio Processing**: Uploaded audio files and synthesized interpretations are processed in-memory or in temporary buffers without persistent database logging.
- **Clean Repository**: Generated `.wav` test outputs and temporary logs are excluded from version control.

---

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
