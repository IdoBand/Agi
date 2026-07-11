# AGI - Voice-Activated 3D Avatar

Voice-activated 3D avatar for learning Hungarian. Two modes share one avatar
pipeline: a free-form **Tutor** (Claude via LangChain/LangGraph) and a strict
**Quiz** (pre-generated questions + spoken-answer evaluation). Pick a mode
from the main menu.

## Project Structure

```
agi/
├── backend/                    # Express + TypeScript
│   ├── src/
│   │   ├── config/index.ts
│   │   ├── app.ts / index.ts        # app wiring + bootstrap
│   │   ├── routes/                  # tutor, quiz, translation
│   │   ├── controllers/             # tutor, quiz, translation
│   │   ├── services/
│   │   │   ├── stt/                 # Whisper (default) | OpenAI STT
│   │   │   ├── tts/                 # ElevenLabs
│   │   │   ├── translation/         # Google Translate
│   │   │   ├── gpt-multi-service/   # unified-eval.service.ts (transcribe+evaluate, quiz)
│   │   │   ├── quiz.service.ts      # question bank loader + draws
│   │   │   ├── interfaces/          # llm-provider / stt / tts interfaces
│   │   │   └── tutor/               # LangGraph agent, tools, session-trace, stt-prompt
│   │   │       └── providers/       # LLM provider factory: Anthropic | OpenAI
│   │   ├── scripts/                 # generate-question-audio (offline TTS)
│   │   ├── middleware/              # upload, request-logger, error
│   │   ├── utils/logger.ts          # Winston → logs/debug.log
│   │   └── types/
│   ├── knowledge/                   # manifest + citizenship question bank (quiz+tutor source of truth; untracked)
│   ├── bin/
│   │   ├── ffmpeg/ffmpeg.exe        # audio conversion
│   │   └── whisper/                 # whisper-server.exe + models/
│   └── package.json
│
└── frontend/                   # React + R3F + TypeScript
    ├── src/
    │   ├── components/
    │   │   ├── Avatar.tsx / Experience.tsx   # R3F scene, amplitude-driven mouth
    │   │   ├── QuizMode.tsx / TutorMode.tsx  # the two UI modes
    │   │   └── <Name>/                       # ~16 CSS-module folders: MainMenu, MediaConsole, Sidebar, QuizControlPanel…
    │   ├── hooks/                    # useTutorChat, useQuiz, useVoiceRecorder, useLocalStorage
    │   ├── utils/                    # avatarProfiles, lipsync, facialExpressions, sharedAnalyser…
    │   ├── styles/tokens.css         # design tokens (colors, gradients, utilities)
    │   └── types/
    └── package.json
```

## Endpoints

```
POST /tutor/turn        Tutor turn (multipart audio) — SSE stream:
                        transcript / sentence / audio (base64 mp3, per sentence) / done
POST /tutor/reset       Reset tutor session
GET  /quiz/start        Start quiz round (10 random questions)
GET  /quiz/start/test   Deterministic round (first 30 questions, shuffled)
GET  /quiz/categories   Question bank categories
POST /quiz/evaluate     Evaluate spoken answer (multipart audio)
POST /translate         Translate text
GET  /health            Health check
GET  /audios/*          Static mp3s from backend/audios/
```

## Getting Started

**Backend** (runs on **3005** via `.env` `PORT`; code default is 3000):
```bash
cd backend
npm install
# Edit .env with PORT=3005 + API keys (see Prerequisites)
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and hold **T** to record voice. Vite proxies
`/tutor`, `/quiz`, `/translate`, `/chat` to port 3005. The avatar ships in
the repo (`frontend/public/models/female_adult_01.glb` is the default).

## Prerequisites

- **Anthropic API key** (`ANTHROPIC_API_KEY`) — tutor (default LLM provider)
- **OpenAI API key** (`OPENAI_API_KEY`) — quiz answer evaluation (and optional OpenAI STT / tutor LLM)
- **ElevenLabs API key** (`ELEVEN_LABS_API_KEY`) — TTS
- **Google Translate API key** (`GOOGLE_TRANSLATE_API_KEY`) — translation

Notable `.env` vars (see `backend/src/config/index.ts` for all):
```
PORT=3005
LLM_PROVIDER=anthropic          # anthropic | openai (tutor LLM)
ANTHROPIC_MODEL=claude-sonnet-4-6
LLM_OPENAI_MODEL=gpt-5-mini     # tutor model when LLM_PROVIDER=openai
ELEVEN_LABS_VOICE_ID=...
STT_PROVIDER=whisper            # whisper (local, default) | openai
TUTOR_KNOWLEDGE_DIR=./knowledge
TUTOR_PROMPT_VARIANT=bilingual  # baseline | bilingual
```

## Bundled Binaries

```
backend/bin/
├── ffmpeg/ffmpeg.exe      # audio conversion (used by Whisper STT + quiz eval)
└── whisper/
    ├── whisper-server.exe  # local STT server (default provider)
    └── models/             # e.g. ggml-medium.bin
```

Relevant `.env` paths:
```
FFMPEG_PATH=./bin/ffmpeg/ffmpeg.exe
WHISPER_SERVER_PATH=./bin/whisper/whisper-server.exe
WHISPER_MODEL_PATH=./bin/whisper/models/ggml-medium.bin
```

**FFmpeg:** https://ffmpeg.org/download.html
**whisper.cpp server + models:** https://github.com/ggerganov/whisper.cpp

## Notes

- The avatar mouth is driven by **audio amplitude on the frontend** — no
  server-side lipsync. Blinking and speech-driven brows ride the same signal.
- Default avatar is the rocketbox `female_adult_01.glb`; per-model animation
  gains live in `frontend/src/utils/avatarProfiles.ts`.
- Tutor replies stream sentence-by-sentence: each sentence is TTS'd as it
  arrives, so first audio plays while the model is still generating.
- Tutor sessions are traced to markdown transcripts under
  `backend/logs/tutor-sessions/<sessionId>.md`; backend logs go to
  `backend/logs/debug.log`.
- Styling is vanilla CSS + CSS Modules; shared tokens in
  `frontend/src/styles/tokens.css`.
- Quiz audio is pre-generated offline via
  `npx tsx src/scripts/generate-question-audio.ts` (writes `.mp3` per question).
