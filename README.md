# AGI - Voice-Activated 3D Avatar

Voice-activated 3D avatar for learning Hungarian. Two modes share one avatar
pipeline: a free-form **Tutor** (Claude via the Agent SDK) and a strict
**Quiz** (pre-generated questions + spoken-answer evaluation).

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
│   │   │   ├── gpt-multi-service/   # unified transcribe+evaluate (quiz)
│   │   │   └── tutor/               # Claude Agent SDK runner + tools
│   │   ├── scripts/                 # generate-question-audio (offline TTS)
│   │   ├── middleware/ types/ utils/
│   ├── bin/
│   │   ├── ffmpeg/ffmpeg.exe         # audio conversion
│   │   └── whisper/                  # whisper-server.exe + models/
│   └── package.json
│
└── frontend/                   # React + R3F + TypeScript
    ├── src/
    │   ├── components/Avatar.tsx     # amplitude-driven mouth
    │   ├── components/Experience.tsx # R3F scene
    │   ├── hooks/                    # useTutorChat, useQuiz, useVoiceRecorder
    │   ├── types/ utils/
    └── package.json
```

## Endpoints

```
POST /tutor/turn       Tutor turn (multipart audio)
POST /tutor/reset      Reset tutor session
GET  /quiz/start       Start quiz round
GET  /quiz/start/test  Start deterministic quiz round
POST /quiz/evaluate    Evaluate spoken answer (multipart audio)
POST /translate        Translate text
GET  /health           Health check
```

## Getting Started

**Backend:**
```bash
cd backend
npm install
# Edit .env with API keys (see Prerequisites)
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
# Add your avatar.glb to ./public/models/
npm run dev
```

Open http://localhost:5173 and hold **T** to record voice.

## Prerequisites

- **Anthropic API key** (`ANTHROPIC_API_KEY`) — tutor (Claude Agent SDK)
- **OpenAI API key** (`OPENAI_API_KEY`) — quiz answer evaluation (and optional OpenAI STT)
- **ElevenLabs API key** (`ELEVEN_LABS_API_KEY`) — TTS
- **Google Translate API key** (`GOOGLE_TRANSLATE_API_KEY`) — translation
- **ReadyPlayer Me avatar** `.glb` in `frontend/public/models/`

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
# STT_PROVIDER=openai   # optional: use OpenAI STT instead of local Whisper
```

**FFmpeg:** https://ffmpeg.org/download.html
**whisper.cpp server + models:** https://github.com/ggerganov/whisper.cpp

## Notes

- The avatar mouth is driven by **audio amplitude on the frontend** — there is
  no server-side lipsync step.
- Quiz audio is pre-generated offline via
  `npx tsx src/scripts/generate-question-audio.ts` (writes `.mp3` per question).
