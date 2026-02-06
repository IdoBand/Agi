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

  // Test lipsync endpoint (temporary - uses saved files to avoid burning ElevenLabs credits)
  app.get('/test-lipsync', async (_req, res) => {
    const mp3 = await import('fs').then((fs) =>
      fs.promises.readFile('temp/20a01544-48fa-4ab6-8365-bfe7084a7bd7.mp3')
    );
    const json = await import('fs').then((fs) =>
      fs.promises.readFile('temp/e76fe7d0-ab79-45a6-ac52-88a9f3c48865.json', 'utf-8')
    );
    res.json({
      text: 'Test',
      audio: mp3.toString('base64'),
      lipsync: JSON.parse(json),
      facialExpression: 'smile',
    });
  });

  // Chat routes
  app.post('/chat', uploadAudio, handleVoiceChat);
  app.post('/chat/text', handleTextChat);
  app.post('/chat/clear', clearHistory);

  // Error handling
  app.use(errorHandler);

  return app;
}
