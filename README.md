# AGI - Voice-Activated 3D Avatar

Voice-activated 3D avatar system with Hungarian language support.

## Project Structure

```
C:\Users\USER\Desktop\projects\agi\
├── backend/                    # Express + TypeScript
│   ├── src/
│   │   ├── config/index.ts
│   │   ├── controllers/chat.controller.ts
│   │   ├── services/
│   │   │   ├── audio.service.ts    (Whisper STT + ElevenLabs TTS)
│   │   │   ├── llm.service.ts      (Ollama + LangChain)
│   │   │   └── lipsync.service.ts  (Rhubarb)
│   │   ├── middleware/
│   │   ├── types/
│   │   └── utils/
│   ├── bin/
│   │   ├── ffmpeg/
│   │   │   └── ffmpeg.exe          (Audio conversion)
│   │   └── rhubarb/
│   │       └── rhubarb.exe         (Lip sync generation)
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                   # React + R3F + TypeScript
    ├── src/
    │   ├── components/
    │   │   ├── Avatar.tsx          (3D avatar with lipsync)
    │   │   ├── Experience.tsx      (R3F scene)
    │   │   └── PushToTalk.tsx      (Status indicator)
    │   ├── hooks/
    │   │   ├── useChat.ts          (API + T key handling)
    │   │   └── useVoiceRecorder.ts (MediaRecorder)
    │   ├── types/
    │   └── utils/
    ├── package.json
    └── vite.config.ts
```

## To Get Started

**1. Backend:**
```bash
cd C:\Users\USER\Desktop\projects\agi\backend
npm install
# Edit .env with your ElevenLabs API key
# Ensure Ollama is running with llama3 model
# Ensure Whisper CLI is installed (pip install openai-whisper)
# FFmpeg and Rhubarb binaries are included in ./bin/
npm run dev
```

**2. Frontend:**
```bash
cd C:\Users\USER\Desktop\projects\agi\frontend
npm install
# Add your avatar.glb to ./public/models/
npm run dev
```

**3. Use:**
- Open http://localhost:5173
- Hold **T** key to record voice
- Release **T** to send to backend
- Avatar responds with synced lipsync

## Prerequisites

- **Ollama** running with `llama3` model
- **Python Whisper CLI** (`pip install openai-whisper`)
- **ElevenLabs API key**
- **ReadyPlayer Me avatar** `.glb` file

## Bundled Binaries

FFmpeg and Rhubarb are included in `backend/bin/`:

```
backend/bin/
├── ffmpeg/
│   └── ffmpeg.exe      # Audio conversion (MP3→WAV)
└── rhubarb/
    └── rhubarb.exe     # Lip sync generation
```

Verify paths in `backend/.env`:
```
FFMPEG_PATH=./bin/ffmpeg/ffmpeg.exe
RHUBARB_PATH=./bin/rhubarb/rhubarb.exe
```

### Updating Binaries

**FFmpeg:** Download from https://ffmpeg.org/download.html

**Rhubarb:** Download from https://github.com/DanielSWolf/rhubarb-lip-sync/releases
