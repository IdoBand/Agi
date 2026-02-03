import express from 'express';
import cors from 'cors';
import { uploadAudio } from './middleware/upload.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { handleVoiceChat, handleTextChat, clearHistory } from './controllers/chat.controller.js';
import { ensureDir } from './utils/file.utils.js';
import { config } from './config/index.js';

export async function createApp(): Promise<express.Application> {
  const app = express();

  // Ensure required directories exist
  await ensureDir(config.paths.temp);
  await ensureDir(config.paths.audios);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Static files for audio
  app.use('/audios', express.static(config.paths.audios));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Chat routes
  app.post('/chat', uploadAudio, handleVoiceChat);
  app.post('/chat/text', handleTextChat);
  app.post('/chat/clear', clearHistory);

  // Error handling
  app.use(errorHandler);

  return app;
}
