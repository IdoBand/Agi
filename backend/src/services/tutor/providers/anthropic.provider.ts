import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage } from '@langchain/core/messages';
import type { UsageMetadata } from '@langchain/core/messages';
import { config } from '../../../config/index.js';
import type { ILlmProvider, LLMProvider, NormalizedUsage } from '../../interfaces/llm-provider.interface.js';

class AnthropicProvider implements ILlmProvider {
  readonly name: LLMProvider = 'anthropic';
  readonly model: string = config.anthropic.model;

  createModel(onFailedAttempt: (error: unknown) => void): BaseChatModel {
    return new ChatAnthropic({
      model: config.anthropic.model,
      apiKey: config.anthropic.apiKey,
      streaming: true,
      maxRetries: 6,
      onFailedAttempt,
    });
  }

  buildSystemMessage(promptText: string): SystemMessage {
    // Ephemeral prompt caching: a single cache breakpoint on the system block so
    // the tools→system prefix is read from cache on subsequent calls instead of
    // being re-sent (~3.6k tokens) each turn.
    return new SystemMessage({
      content: [{ type: 'text', text: promptText, cache_control: { type: 'ephemeral' } }],
    });
  }

  parseUsage(usage: UsageMetadata | undefined): NormalizedUsage {
    // input_tokens already folds in cache_read + cache_creation; split them out
    // so the prompt cache is observable (cacheWrite on the first call of a
    // session, cacheRead on every subsequent call).
    const cacheDetails = usage?.input_token_details as
      | { cache_read?: number; cache_creation?: number }
      | undefined;
    return {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheRead: cacheDetails?.cache_read ?? 0,
      cacheWrite: cacheDetails?.cache_creation ?? 0,
    };
  }

  ensureConfigured(): void {
    if (!config.anthropic.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set; tutor mode unavailable.');
    }
  }
}

export const anthropicProvider: ILlmProvider = new AnthropicProvider();
