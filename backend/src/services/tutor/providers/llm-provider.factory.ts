import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import type { ILlmProvider } from '../../interfaces/llm-provider.interface.js';
import { anthropicProvider } from './anthropic.provider.js';
import { openaiProvider } from './openai.provider.js';

function createLlmProvider(): ILlmProvider {
  switch (config.llm.provider) {
    case 'anthropic':
      return anthropicProvider;
    case 'openai':
      return openaiProvider;
    default: {
      const _exhaustive: never = config.llm.provider;
      throw new Error(`Unknown LLM provider: ${_exhaustive}`);
    }
  }
}

export const llmProvider: ILlmProvider = createLlmProvider();
logger.info(`Tutor LLM provider initialized: ${llmProvider.name} (model: ${llmProvider.model})`);
