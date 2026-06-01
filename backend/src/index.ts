import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { asAnthropicError, isRateLimitError, getRetryAfter } from './types/anthropic.types.js';

function logProcessError(label: string, e: unknown): void {
  const err = asAnthropicError(e);
  if (isRateLimitError(e)) {
    logger.error(
      `[process] ${label} rate_limit(429) status=${err.status ?? '-'} retry-after=${getRetryAfter(e) ?? '-'} requestID=${err.requestID ?? '-'}`,
    );
  } else {
    logger.error(`[process] ${label}: ${err.stack ?? err.message ?? String(e)}`);
  }
}

process.on('unhandledRejection', (reason) => {
  logProcessError('unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  logProcessError('uncaughtException', err);
});

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
