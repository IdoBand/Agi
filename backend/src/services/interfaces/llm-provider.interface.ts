import type { LanguageModelLike } from '@langchain/core/language_models/base';
import type { SystemMessage, UsageMetadata } from '@langchain/core/messages';

export type LLMProvider = 'anthropic' | 'openai';

/** Per-call usage normalized across providers (Anthropic / OpenAI). */
export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Thin seam over the LangChain chat model so the tutor's LangGraph ReAct loop
 * can run on either Anthropic or OpenAI. Only the things that actually diverge
 * between providers live here; the streaming loop, tools, and session state in
 * claude-agent.service.ts are provider-agnostic.
 */
export interface ILlmProvider {
  /** Stable provider id (for logging / session traces). */
  readonly name: LLMProvider;
  /** Resolved model string in use (for logging / session traces). */
  readonly model: string;
  /** Build the streaming chat model, wired with the per-turn retry-log callback. */
  createModel(onFailedAttempt: (error: unknown) => void): LanguageModelLike;
  /** Build the system message for a prompt (Anthropic adds an ephemeral cache breakpoint; OpenAI sends plain text). */
  buildSystemMessage(promptText: string): SystemMessage;
  /** Normalize `usage_metadata` from an `on_chat_model_end` event. */
  parseUsage(usage: UsageMetadata | undefined): NormalizedUsage;
  /** Throw if the provider's required credentials are missing. */
  ensureConfigured(): void;
}
