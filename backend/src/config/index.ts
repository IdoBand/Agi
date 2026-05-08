import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export type STTProvider = 'whisper' | 'openai';

function parseSTTProvider(value: string | undefined): STTProvider {
  if (value === 'openai') return 'openai';
  return 'whisper';
}

export type TutorPromptVariant = 'baseline' | 'bilingual';

function parsePromptVariant(value: string | undefined): TutorPromptVariant {
  return value === 'baseline' ? 'baseline' : 'bilingual';
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  stt: {
    provider: parseSTTProvider(process.env.STT_PROVIDER),
  },

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    sttModel: process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe',
  },

  elevenLabs: {
    apiKey: process.env.ELEVEN_LABS_API_KEY || '',
    voiceId: process.env.ELEVEN_LABS_VOICE_ID || 'kgG7dCoKCfLehAPWkJOE',
  },

  whisper: {
    path: process.env.WHISPER_PATH || './bin/whisper/whisper-cli.exe',
    serverPath: process.env.WHISPER_SERVER_PATH || './bin/whisper/whisper-server.exe',
    modelPath: process.env.WHISPER_MODEL_PATH || './bin/whisper/models/ggml-medium.bin',
    // modelPath: process.env.WHISPER_MODEL_PATH || './bin/whisper/models/ggml-large-v3.bin',
    serverPort: parseInt(process.env.WHISPER_SERVER_PORT || '8178', 10),
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  },

  googleTranslate: {
    apiKey: process.env.GOOGLE_TRANSLATE_API_KEY || '',
    endpoint: 'https://translation.googleapis.com/language/translate/v2',
  },

  tutor: {
    knowledgeDir: path.resolve(process.env.TUTOR_KNOWLEDGE_DIR || './knowledge'),
    promptVariant: parsePromptVariant(process.env.TUTOR_PROMPT_VARIANT),
  },

  paths: {
    rhubarb: process.env.RHUBARB_PATH || './bin/rhubarb/rhubarb.exe',
    ffmpeg: process.env.FFMPEG_PATH || './bin/ffmpeg/ffmpeg.exe',
    temp: path.join(process.cwd(), 'temp'),
    audios: path.join(process.cwd(), 'audios'),
  },
} as const;
