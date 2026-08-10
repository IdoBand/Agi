import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export type STTProvider = 'whisper' | 'openai';

function parseSTTProvider(value: string | undefined): STTProvider {
  if (value === 'openai') return 'openai';
  return 'whisper';
}

export type LLMProvider = 'anthropic' | 'openai';

function parseLLMProvider(value: string | undefined): LLMProvider {
  return value === 'openai' ? 'openai' : 'anthropic';
}

export type TutorPromptVariant = 'baseline' | 'bilingual';

function parsePromptVariant(value: string | undefined): TutorPromptVariant {
  return value === 'baseline' ? 'baseline' : 'bilingual';
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  stt: {
    provider: parseSTTProvider(process.env.STT_PROVIDER),
    temperature: parseFloat(process.env.STT_TEMPERATURE ?? '0'),
    temperatureInc: parseFloat(process.env.STT_TEMPERATURE_INC ?? '0'),
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
    // Sub-call model that resolves runtime ("dynamic") gold answers — date, weekday,
    // weather. Shares the apiKey above. Timeout must stay well under a turn's budget:
    // it runs inside the learner-facing turn.
    resolverModel: process.env.ANTHROPIC_RESOLVER_MODEL || 'claude-haiku-4-5',
    resolverTimeoutMs: parseInt(process.env.ANTHROPIC_RESOLVER_TIMEOUT_MS || '6000', 10),
  },

  // Tutor LLM provider selection. Flip LLM_PROVIDER=openai (and set OPENAI_API_KEY)
  // to run tutor mode on OpenAI; defaults to anthropic. openaiModel is dedicated to
  // the tutor (independent of the quiz/STT OpenAI usage).
  llm: {
    provider: parseLLMProvider(process.env.LLM_PROVIDER),
    openaiModel: process.env.LLM_OPENAI_MODEL || 'gpt-5-mini',
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
    ffmpeg: process.env.FFMPEG_PATH || './bin/ffmpeg/ffmpeg.exe',
    temp: path.join(process.cwd(), 'temp'),
    audios: path.join(process.cwd(), 'audios'),
  },
} as const;
