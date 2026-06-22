import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { UsageMetadata } from '@langchain/core/messages';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT, CITIZENSHIP_INTERVIEW_PROMPT_BANK_ONLY } from './system-prompt.js';
import { buildTutorTools, buildBankOnlyTutorTools, dropEvalLog, dropAskedQuestions, dropBankCursor } from './tutor-tools.js';
import { ToolCallTrace, TurnTrace } from '../../types/tutor.types.js';
import { TurnLlmUsage, asAnthropicError, isRateLimitError, getRetryAfter } from '../../types/anthropic.types.js';
import { appendTurnTrace, rotateSessionTrace } from './session-trace.js';

/**
 * Per-turn correlation context made available to the singleton model's
 * `onFailedAttempt` handler (which has no turn scope of its own), so every
 * retry log line can carry `sid=<sessionId> turn=<n>`.
 */
interface TurnLogContext {
  sessionId: string;
  turnIndex: number;
}
const turnLogStore = new AsyncLocalStorage<TurnLogContext>();

function turnTag(ctx?: TurnLogContext): string {
  return ctx ? `sid=${ctx.sessionId} turn=${ctx.turnIndex}` : 'sid=- turn=-';
}

function truncateForLog(s: string, max = 200): string {
  return s.length <= max ? s : `${s.slice(0, max)}… [+${s.length - max}]`;
}

// Mirrors @langchain/core AsyncCaller's defaultFailedAttemptHandler abort set so
// supplying our own onFailedAttempt (for logging) does NOT change retry behavior:
// 429s still retry up to maxRetries; only these are aborted immediately.
const STATUS_NO_RETRY = [400, 401, 402, 403, 404, 405, 406, 407, 409];

function rethrowIfNonRetryable(error: unknown): void {
  if (typeof error !== 'object' || error === null) return;
  const e = error as {
    message?: unknown;
    name?: unknown;
    code?: unknown;
    response?: { status?: unknown };
    status?: unknown;
    error?: { code?: unknown };
  };
  if (
    (typeof e.message === 'string' && (e.message.startsWith('Cancel') || e.message.startsWith('AbortError'))) ||
    (typeof e.name === 'string' && e.name === 'AbortError')
  ) {
    throw error;
  }
  if (typeof e.code === 'string' && e.code === 'ECONNABORTED') throw error;
  const responseStatus =
    e.response && typeof e.response === 'object' && typeof e.response.status === 'number' ? e.response.status : undefined;
  const directStatus = typeof e.status === 'number' ? e.status : undefined;
  const status = responseStatus ?? directStatus;
  if (status && STATUS_NO_RETRY.includes(+status)) throw error;
  if (e.error && typeof e.error === 'object' && (e.error as { code?: unknown }).code === 'insufficient_quota') {
    const quotaErr = new Error(typeof e.message === 'string' ? e.message : 'Insufficient quota');
    quotaErr.name = 'InsufficientQuotaError';
    throw quotaErr;
  }
}

// onFailedAttempt: log every retry (429 distinctly), then preserve default retry/abort behavior.
function logFailedAttempt(error: unknown): void {
  const tag = turnTag(turnLogStore.getStore());
  const err = asAnthropicError(error);
  if (isRateLimitError(error)) {
    logger.warn(
      `[tutor-agent] ${tag} llm_retry rate_limit(429) status=${err.status ?? '-'} lc_error_code=${err.lc_error_code ?? '-'} retry-after=${getRetryAfter(error) ?? '-'} requestID=${err.requestID ?? '-'}`,
    );
  } else {
    logger.warn(
      `[tutor-agent] ${tag} llm_retry status=${err.status ?? '-'} lc_error_code=${err.lc_error_code ?? '-'} message=${err.message ?? String(error)}`,
    );
  }
  rethrowIfNonRetryable(error);
}

interface SessionState {
  lastTouched: number;
  threadId: string;
  turnCount: number;
  lastReply?: string;
  bankOnly: boolean;
}

const sessions = new Map<string, SessionState>();
const SESSION_TTL_MS = 60 * 60 * 1000;

// Static prefix (system + tool schemas) is identical across every turn, so we
// mark a single ephemeral cache breakpoint on the system block. Anthropic caches
// the whole tools→system prefix; subsequent Sonnet calls read it instead of
// re-sending ~3.6k tokens uncached. createReactAgent prepends this SystemMessage
// verbatim each turn; per-block cache_control survives into the Anthropic payload.
// (Confirm via the cacheRead/cacheWrite fields on llm_call_end — caching of the
// tools block is server-side prefix behavior, not a LangChain guarantee.)
const BANK_ONLY_SYSTEM_MESSAGE = new SystemMessage({
  content: [{ type: 'text', text: CITIZENSHIP_INTERVIEW_PROMPT_BANK_ONLY, cache_control: { type: 'ephemeral' } }],
});
const ACTIVE_SYSTEM_MESSAGE = new SystemMessage({
  content: [{ type: 'text', text: ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT, cache_control: { type: 'ephemeral' } }],
});

const FALLBACK_HU = 'Bocsánat, nem hallottam jól. Mondanád újra?';

const checkpointer = new MemorySaver();
let chatModel: ChatAnthropic | null = null;

function getChatModel(): ChatAnthropic {
  if (!chatModel) {
    chatModel = new ChatAnthropic({
      model: config.anthropic.model,
      apiKey: config.anthropic.apiKey,
      streaming: true,
      maxRetries: 6,
      onFailedAttempt: logFailedAttempt,
    });
  }
  return chatModel;
}

function dropThread(threadId: string): void {
  const store = (checkpointer as unknown as { storage?: Map<string, unknown> }).storage;
  if (store instanceof Map) {
    store.delete(threadId);
  }
}

function purge(sessionId: string, threadId: string): void {
  sessions.delete(sessionId);
  dropEvalLog(sessionId);
  dropAskedQuestions(sessionId);
  dropBankCursor(sessionId);
  void rotateSessionTrace(sessionId);
  dropThread(threadId);
}

function sweep(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastTouched > SESSION_TTL_MS) {
      purge(id, s.threadId);
    }
  }
}

function ensureInit(): void {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set; tutor mode unavailable.');
  }
}

const SENTENCE_BOUNDARY = /([^.!?…\n]+[.!?…]+|\S[^\n]*\n)/g;

function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let lastIdx = 0;
  SENTENCE_BOUNDARY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SENTENCE_BOUNDARY.exec(buffer)) !== null) {
    const s = m[0].trim();
    if (s.length >= 2) sentences.push(s);
    lastIdx = SENTENCE_BOUNDARY.lastIndex;
  }
  return { sentences, remainder: buffer.slice(lastIdx) };
}

function chunkTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    let out = '';
    for (const block of content) {
      if (typeof block === 'string') {
        out += block;
      } else if (block && typeof block === 'object') {
        const b = block as { type?: string; text?: unknown };
        if (b.type === 'text' && typeof b.text === 'string') out += b.text;
      }
    }
    return out;
  }
  return '';
}

// Narrow shape of the fused evaluateAndDraw* tool args, used only to detect a
// silent redundancy re-draw (a step that skips a question without recording an
// evaluation). Kept loose (optional/unknown-ish) since it parses raw event args.
interface EvaluateAndDrawArgs {
  evaluation?: { topic?: string; correct?: boolean; note?: string } | null;
  draw?: { skip?: string; jumpToTopic?: string } | null;
}

// The tool args arrive on the event stream either directly
// (`{ draw: {...}, evaluation: {...} }`) or nested+stringified
// (`ev.data.input = { input: '{"draw":{"skip":"question"}}' }`, seen in debug.log).
// Unwrap defensively: if `.input` is a string, JSON.parse it; else use the value as-is.
function parseEvaluateAndDrawArgs(input: unknown): EvaluateAndDrawArgs | null {
  if (typeof input !== 'object' || input === null) return null;
  const nested = (input as { input?: unknown }).input;
  let raw: unknown = input;
  if (typeof nested === 'string') {
    try {
      raw = JSON.parse(nested);
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || raw === null) return null;
  return raw as EvaluateAndDrawArgs;
}

// Silent-re-draw predicate (matches the tool schema: top-level `evaluation?` + `draw?`):
// a draw that skips the current question with no evaluation recorded. This is the
// turn shape whose narration ("Redundant — skipping silently.") must never be spoken.
function isSilentReDraw(input: unknown): boolean {
  const args = parseEvaluateAndDrawArgs(input);
  if (!args) return false;
  const draw = args.draw;
  const hasQuestionSkip = typeof draw === 'object' && draw !== null && draw.skip === 'question';
  return hasQuestionSkip && args.evaluation == null;
}

export interface SentenceEvent {
  idx: number;
  hu: string;
}

export interface RunTurnStreamResult {
  fullHu: string;
}

export async function* runTurnStream(
  sessionId: string,
  userText: string,
  bankOnly?: boolean,
): AsyncGenerator<SentenceEvent, RunTurnStreamResult, void> {
  ensureInit();
  sweep();

  const state = sessions.get(sessionId) ?? {
    lastTouched: Date.now(),
    threadId: randomUUID(),
    turnCount: 0,
    bankOnly: !!bankOnly,
  };

  const turnIndex = state.turnCount + 1;
  const logTag = `sid=${sessionId} turn=${turnIndex}`;

  const tools = state.bankOnly ? buildBankOnlyTutorTools(sessionId) : buildTutorTools(sessionId);
  const prompt = state.bankOnly ? BANK_ONLY_SYSTEM_MESSAGE : ACTIVE_SYSTEM_MESSAGE;
  const agent = createReactAgent({
    llm: getChatModel(),
    tools,
    prompt,
    checkpointer,
  });

  const toolNames = tools.map((t) => (t as { name: string }).name).join(',');
  logger.info(
    `[tutor-agent] ${logTag} turn_start userTextLen=${userText.length} bankOnly=${state.bankOnly} threadId=${state.threadId} tools=[${toolNames}]`,
  );

  let assistantText = '';
  let buffer = '';
  let idx = 0;
  const startedAt = Date.now();
  const toolCalls: ToolCallTrace[] = [];
  const toolByRunId = new Map<string, ToolCallTrace>();

  // Per-turn LLM accounting (ReAct fan-out → multiple Sonnet calls).
  let sonnetCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const llmStartByRunId = new Map<string, number>();
  const toolStartByRunId = new Map<string, number>();

  const pending: SentenceEvent[] = [];

  const flushFromBuffer = (): void => {
    const { sentences, remainder } = extractSentences(buffer);
    buffer = remainder;
    for (const s of sentences) {
      pending.push({ idx: idx++, hu: s });
    }
  };

  // Per-step (per-LLM-call) gating. Step #1 streams live (latency-critical first
  // audio; a silent re-draw structurally can't occur in call #1). Steps #2+ are
  // buffered until their tool call is seen: a silent re-draw drops the buffered
  // text (rolled back out of assistantText), anything else flushes it.
  let firstCallCommitted = false;
  let stepIsLive = false;
  let stepBuffer = '';
  let stepRollbackMark = 0;

  const flushStepBuffer = (): void => {
    if (!stepBuffer) return;
    buffer += stepBuffer;
    stepBuffer = '';
    flushFromBuffer();
  };

  try {
    const stream = agent.streamEvents(
      { messages: [new HumanMessage(userText)] },
      { version: 'v2', configurable: { thread_id: state.threadId } },
    );
    const iterator = stream[Symbol.asyncIterator]();

    while (true) {
      // Advance the generator inside the turn context so the singleton model's
      // onFailedAttempt retries log under this turn's sid/turn.
      const next = await turnLogStore.run({ sessionId, turnIndex }, () => iterator.next());
      if (next.done) break;
      const ev = next.value;

      if (ev.event === 'on_chat_model_stream') {
        // Hot path: never log per token; count/time at start/end only.
        const chunk = (ev.data as { chunk?: { content?: unknown } }).chunk;
        const text = chunkTextContent(chunk?.content);
        if (text) {
          assistantText += text;
          if (stepIsLive) {
            // Step #1: stream live (preserve first-audio latency).
            buffer += text;
            flushFromBuffer();
          } else {
            // Steps #2+: hold until the step's tool call decides drop vs flush.
            stepBuffer += text;
          }
        }
      } else if (ev.event === 'on_chat_model_start') {
        // A non-live step that buffered text but issued no tool call is a
        // final-answer step; flush it before the next call's state resets.
        if (!stepIsLive) flushStepBuffer();
        sonnetCalls += 1;
        // Step #1 streams live; every subsequent step is buffered & gated.
        stepIsLive = !firstCallCommitted;
        firstCallCommitted = true;
        stepBuffer = '';
        stepRollbackMark = assistantText.length;
        llmStartByRunId.set(ev.run_id, Date.now());
        logger.debug(`[tutor-agent] ${logTag} llm_call_start #${sonnetCalls} live=${stepIsLive}`);
      } else if (ev.event === 'on_chat_model_end') {
        const out = (ev.data as { output?: { usage_metadata?: UsageMetadata } }).output;
        const usage = out?.usage_metadata;
        const inT = usage?.input_tokens ?? 0;
        const outT = usage?.output_tokens ?? 0;
        // input_tokens already folds in cache_read + cache_creation; these split it
        // out so the prompt cache is observable (cacheWrite on first call of a
        // session, cacheRead on every subsequent call).
        const cacheDetails = usage?.input_token_details as
          | { cache_read?: number; cache_creation?: number }
          | undefined;
        const cacheRead = cacheDetails?.cache_read ?? 0;
        const cacheWrite = cacheDetails?.cache_creation ?? 0;
        inputTokens += inT;
        outputTokens += outT;
        const startedLlm = llmStartByRunId.get(ev.run_id);
        llmStartByRunId.delete(ev.run_id);
        const latencyMs = startedLlm !== undefined ? Date.now() - startedLlm : -1;
        logger.debug(
          `[tutor-agent] ${logTag} llm_call_end in=${inT} out=${outT} cacheRead=${cacheRead} cacheWrite=${cacheWrite} latencyMs=${latencyMs}`,
        );
      } else if (ev.event === 'on_tool_start') {
        const input = (ev.data as { input?: unknown }).input;
        // Resolve the buffered step's text now that we can see its tool args.
        if (!stepIsLive) {
          if (isSilentReDraw(input)) {
            // Drop the silent-re-draw narration: discard buffered text and roll
            // assistantText back so the persisted reply stays consistent.
            assistantText = assistantText.slice(0, stepRollbackMark);
            const dropped = stepBuffer.length;
            stepBuffer = '';
            logger.debug(`[tutor-agent] ${logTag} step_text_dropped chars=${dropped}`);
          } else {
            const flushed = stepBuffer.length;
            flushStepBuffer();
            logger.debug(`[tutor-agent] ${logTag} step_text_flushed chars=${flushed}`);
          }
        }
        const tc: ToolCallTrace = { name: ev.name, input };
        toolCalls.push(tc);
        toolByRunId.set(ev.run_id, tc);
        toolStartByRunId.set(ev.run_id, Date.now());
        logger.debug(`[tutor-agent] ${logTag} tool_start name=${ev.name} args=${truncateForLog(JSON.stringify(input))}`);
      } else if (ev.event === 'on_tool_end') {
        const tc = toolByRunId.get(ev.run_id);
        if (tc) {
          const output = (ev.data as { output?: unknown }).output;
          let outStr: string;
          if (output === undefined || output === null) {
            outStr = '';
          } else if (typeof output === 'string') {
            outStr = output;
          } else if (typeof output === 'object' && 'content' in (output as object)) {
            const c = (output as { content?: unknown }).content;
            outStr = typeof c === 'string' ? c : JSON.stringify(c);
            const status = (output as { status?: string }).status;
            if (status === 'error') tc.isError = true;
          } else {
            outStr = JSON.stringify(output);
          }
          tc.output = outStr;
          const startedTool = toolStartByRunId.get(ev.run_id);
          toolStartByRunId.delete(ev.run_id);
          const durationMs = startedTool !== undefined ? Date.now() - startedTool : -1;
          logger.debug(
            `[tutor-agent] ${logTag} tool_end name=${tc.name} durationMs=${durationMs} isError=${!!tc.isError} output=${truncateForLog(outStr)}`,
          );
        }
      }

      while (pending.length > 0) {
        yield pending.shift()!;
      }
    }
  } catch (e) {
    const err = asAnthropicError(e);
    if (isRateLimitError(e)) {
      logger.warn(
        `[tutor-agent] ${logTag} turn_error rate_limit(429) status=${err.status ?? '-'} retry-after=${getRetryAfter(e) ?? '-'} requestID=${err.requestID ?? '-'}`,
      );
    } else {
      logger.error(`[tutor-agent] ${logTag} turn_error status=${err.status ?? '-'} stack=${err.stack ?? String(e)}`);
    }
    throw e;
  }

  // A final-answer step (text, no tool call) leaves text in stepBuffer; flush it.
  if (!stepIsLive) flushStepBuffer();
  while (pending.length > 0) {
    yield pending.shift()!;
  }

  const tail = buffer.trim();
  if (tail.length >= 2) {
    yield { idx: idx++, hu: tail };
  }

  let fullHu = assistantText.trim();
  if (!fullHu) {
    fullHu = FALLBACK_HU;
    if (idx === 0) {
      yield { idx: idx++, hu: FALLBACK_HU };
    }
  }

  state.turnCount += 1;
  state.lastTouched = Date.now();
  state.lastReply = fullHu;
  sessions.set(sessionId, state);

  const durationMs = Date.now() - startedAt;
  const llmUsage: TurnLlmUsage = { sonnetCalls, inputTokens, outputTokens };
  logger.info(
    `[tutor-agent] ${logTag} turn_summary sonnetCalls=${sonnetCalls} inTokens=${inputTokens} outTokens=${outputTokens} toolCalls=${toolCalls.length} durationMs=${durationMs} replyLen=${fullHu.length}`,
  );

  const trace: TurnTrace = {
    turnIndex,
    userText,
    replyText: fullHu,
    toolCalls,
    startedAt,
    durationMs,
    llmUsage,
  };
  void appendTurnTrace(sessionId, trace);

  return { fullHu };
}

export function getLastAssistantReply(sessionId: string): string | undefined {
  return sessions.get(sessionId)?.lastReply;
}

export function resetSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) {
    void rotateSessionTrace(sessionId);
    dropEvalLog(sessionId);
    dropAskedQuestions(sessionId);
    dropBankCursor(sessionId);
    return;
  }
  purge(sessionId, s.threadId);
}
