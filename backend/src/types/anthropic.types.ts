import type { UsageMetadata } from '@langchain/core/messages';

/**
 * Minimal structural shape of an error thrown by the Anthropic SDK / LangChain
 * ChatAnthropic. Thrown errors arrive as `unknown`; narrow via `asAnthropicError`.
 * - `RateLimitError extends APIError<429>` → `status:429`, `headers`, `type:'rate_limit_error'`, `requestID`.
 * - LangChain wraps rate-limits with `lc_error_code:'MODEL_RATE_LIMIT'`.
 */
export interface AnthropicApiErrorShape {
  status?: number;
  lc_error_code?: string;
  type?: string;
  requestID?: string;
  headers?: { get?: (name: string) => string | null };
  message?: string;
  stack?: string;
}

/** Narrow an unknown thrown value to the Anthropic error shape (no `any`). */
export function asAnthropicError(e: unknown): AnthropicApiErrorShape {
  if (e && typeof e === 'object') return e as AnthropicApiErrorShape;
  return { message: String(e) };
}

/** True when the error is an Anthropic/LangChain rate-limit (HTTP 429). */
export function isRateLimitError(e: unknown): boolean {
  const err = asAnthropicError(e);
  return err.status === 429 || err.lc_error_code === 'MODEL_RATE_LIMIT';
}

/** Extract the `retry-after` header value if present, else null. */
export function getRetryAfter(e: unknown): string | null {
  const err = asAnthropicError(e);
  const v = err.headers?.get?.('retry-after');
  return v ?? null;
}

/** Per-turn Sonnet usage accumulated across the ReAct fan-out. */
export interface TurnLlmUsage {
  sonnetCalls: number;
  inputTokens: number;
  outputTokens: number;
}

export type { UsageMetadata };
