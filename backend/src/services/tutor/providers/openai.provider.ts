import { ChatOpenAI } from '@langchain/openai';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import { SystemMessage } from '@langchain/core/messages';
import type { UsageMetadata } from '@langchain/core/messages';
import { config } from '../../../config/index.js';
import type { ILlmProvider, LLMProvider, NormalizedUsage } from '../../interfaces/llm-provider.interface.js';

class OpenAIProvider implements ILlmProvider {
  readonly name: LLMProvider = 'openai';
  readonly model: string = config.llm.openaiModel;

  createModel(onFailedAttempt: (error: unknown) => void): LanguageModelLike {
    return new ChatOpenAI({
      model: config.llm.openaiModel,
      apiKey: config.openai.apiKey,
      streaming: true,
      // Required so usage_metadata is emitted on on_chat_model_end while streaming.
      streamUsage: true,
      maxRetries: 6,
      onFailedAttempt,
    });
  }

  buildSystemMessage(promptText: string): SystemMessage {
    // Plain system text. OpenAI rejects Anthropic content-block cache_control;
    // its prompt caching is automatic/server-side.
    return new SystemMessage(promptText);
  }

  parseUsage(usage: UsageMetadata | undefined): NormalizedUsage {
    // OpenAI reports cached prompt tokens under input_token_details.cache_read;
    // there is no separate cache-write figure (cacheWrite stays 0).
    const cacheDetails = usage?.input_token_details as { cache_read?: number } | undefined;
    return {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheRead: cacheDetails?.cache_read ?? 0,
      cacheWrite: 0,
    };
  }

  ensureConfigured(): void {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set; tutor mode unavailable.');
    }
  }
}

export const openaiProvider: ILlmProvider = new OpenAIProvider();
