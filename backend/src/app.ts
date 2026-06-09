import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware.js';
import { requestLogger } from './middleware/request-logger.middleware.js';
import { ensureDir } from './utils/file.utils.js';
import { config } from './config/index.js';
import quizRoutes from './routes/quiz.routes.js';
import tutorRoutes from './routes/tutor.routes.js';
import translationRoutes from './routes/translation.routes.js';

export async function createApp(): Promise<express.Application> {
  const app = express();

  // Ensure required directories exist
  await ensureDir(config.paths.temp);
  await ensureDir(config.paths.audios);

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Static files for audio
  app.use('/audios', express.static(config.paths.audios));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Quiz routes
  app.use('/quiz', quizRoutes);

  // Tutor routes
  app.use('/tutor', tutorRoutes);

  // Translation routes
  app.use('/translate', translationRoutes);

  // Error handling
  app.use(errorHandler);

  return app;
}
