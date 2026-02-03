import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    const app = await createApp();

    app.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
      logger.info('Endpoints:');
      logger.info('  POST /chat        - Voice chat (multipart/form-data with audio file)');
      logger.info('  POST /chat/text   - Text chat (JSON body with message)');
      logger.info('  POST /chat/clear  - Clear conversation history');
      logger.info('  GET  /health      - Health check');
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

main();
