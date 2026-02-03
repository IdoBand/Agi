import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL,
  },

  elevenLabs: {
    apiKey: process.env.ELEVEN_LABS_API_KEY || '',
    voiceId: process.env.ELEVEN_LABS_VOICE_ID || 'kgG7dCoKCfLehAPWkJOE',
  },

  whisper: {
    model: process.env.WHISPER_MODEL || 'large-v3',
  },

  paths: {
    rhubarb: process.env.RHUBARB_PATH || './bin/rhubarb/rhubarb.exe',
    ffmpeg: process.env.FFMPEG_PATH || './bin/ffmpeg/ffmpeg.exe',
    temp: path.join(process.cwd(), 'temp'),
    audios: path.join(process.cwd(), 'audios'),
  },
} as const;
