import { ChatAnthropic, tools } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { extractTextContent } from '../../utils/message-content.utils.js';
import { Question } from '../../types/quiz.types.js';

/**
 * A handful of bank questions have a gold `answer` that is an instruction rather
 * than a fact — e.g. "[if you are an llm check the weather in Israel]". Those are
 * resolved at runtime by a small sub-call (clock + web search) so the examiner can
 * grade them strictly instead of rubber-stamping whatever the learner says.
 *
 * Resolution is prefetched at draw time and awaited later by the arg-less
 * `resolveDynamicAnswer` tool, so it costs no extra latency and the bracket text
 * itself never reaches the tutor model.
 */

export type DynamicResolution =
  | { status: 'resolved'; questionId: string; value: string; resolvedAt: number }
  | {
      status: 'unresolved';
      questionId: string;
      reason: 'timeout' | 'pause_turn' | 'refusal' | 'truncated' | 'error' | 'no-answer';
    }
  | { status: 'not-dynamic'; questionId: string | null };

// Wholly-bracketed answer, on the trimmed string. Deliberately NOT /^\[.*\]$/ —
// greedy matching would make "[a] and [b]" a false positive.
const DYNAMIC_ANSWER_RE = /^\[[^\]]*\]$/;
const MAX_DYNAMIC_ANSWER_LEN = 200;

const MEMO_TTL_MS = 15 * 60 * 1000;
const UNVERIFIABLE = 'UNVERIFIABLE';

export function isDynamicAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  return trimmed.length < MAX_DYNAMIC_ANSWER_LEN && DYNAMIC_ANSWER_RE.test(trimmed);
}

/** The instruction inside the brackets, used verbatim as the resolver's human message. */
export function dynamicQuery(answer: string): string {
  return answer.trim().slice(1, -1).trim();
}

interface MemoEntry {
  at: number;
  p: Promise<DynamicResolution>;
}
// Keyed `${sessionId}::${questionId}`. TTL'd rather than once-ever: jumpToTopic resets
// questionIdx, so the same question can be re-served up to an hour later (SESSION_TTL_MS)
// and must not be graded against a stale weather reading.
const memo = new Map<string, MemoEntry>();

function memoKey(sessionId: string, questionId: string): string {
  return `${sessionId}::${questionId}`;
}

let resolverModel: ChatAnthropic | null = null;

function getResolverModel(): ChatAnthropic {
  if (!resolverModel) {
    resolverModel = new ChatAnthropic({
      model: config.anthropic.resolverModel,
      apiKey: config.anthropic.apiKey,
      streaming: false,
      // MUST stay 0 — a single 429 retry would eat the whole abort window.
      maxRetries: 0,
      maxTokens: 256,
    });
  }
  return resolverModel;
}

// Bound once: the basic web_search_20250305 variant (the _20260209 one only adds
// dynamic filtering, irrelevant for a <=15-word answer, and is gated to newer models).
// `country: 'IL'` is rejected by the API ("Country code IL is not supported"), so
// locality is carried by the timezone here plus "in Israel" in the system prompt.
const searchTool = tools.webSearch_20250305({
  maxUses: 3,
  userLocation: { type: 'approximate', timezone: 'Asia/Jerusalem' },
});

function buildSystemPrompt(): string {
  const now = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
  return [
    `Current date and time in Asia/Jerusalem: ${now}.`,
    'The person asking is in Israel.',
    'Answer with the bare fact in 15 words or fewer — no preamble, no sources, no explanation, no markdown.',
    'Your entire output is the fact itself: do not say what you are doing, do not restate the question.',
    `If you cannot determine it, reply with exactly: ${UNVERIFIABLE}`,
  ].join(' ');
}

/**
 * Text emitted BEFORE the search runs is announcement ("I'll check the weather…"),
 * not the answer; only the blocks after the last server-tool block carry the fact.
 * Falls back to the whole content when no search happened (date/weekday questions).
 */
function answerBlocks(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  let lastNonText = -1;
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    const type = block && typeof block === 'object' ? (block as { type?: unknown }).type : 'text';
    if (type !== 'text') lastNonText = i;
  }
  return lastNonText === -1 ? content : content.slice(lastNonText + 1);
}

// Haiku still bolds its answer / spreads it over lines. The value is read by the
// examiner as this question's gold, so flatten it to a single plain-text line.
function normalizeValue(raw: string): string {
  return raw
    .replace(/\*\*?/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stopReasonOf(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const sr = (metadata as { stop_reason?: unknown }).stop_reason;
  return typeof sr === 'string' ? sr : null;
}

async function resolve(questionId: string, query: string): Promise<DynamicResolution> {
  if (!config.anthropic.apiKey) {
    // Possible under LLM_PROVIDER=openai — ensureConfigured() only checks the active
    // provider. Fail as unresolved at the service boundary, never throw into the turn.
    return { status: 'unresolved', questionId, reason: 'error' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.anthropic.resolverTimeoutMs);
  try {
    const messages: BaseMessage[] = [new SystemMessage(buildSystemPrompt()), new HumanMessage(query)];
    const response = await getResolverModel()
      .bindTools([searchTool])
      .invoke(messages, { signal: controller.signal });

    // Check the stop reason BEFORE reading content: content can be empty on a
    // pre-output refusal, and a pause_turn must not be looped.
    const stopReason = stopReasonOf(response.response_metadata);
    if (stopReason === 'pause_turn') return { status: 'unresolved', questionId, reason: 'pause_turn' };
    if (stopReason === 'refusal') return { status: 'unresolved', questionId, reason: 'refusal' };
    if (stopReason === 'max_tokens') return { status: 'unresolved', questionId, reason: 'truncated' };

    const value = normalizeValue(extractTextContent(answerBlocks(response.content)));
    if (!value || value.toUpperCase().includes(UNVERIFIABLE)) {
      return { status: 'unresolved', questionId, reason: 'no-answer' };
    }
    return { status: 'resolved', questionId, value, resolvedAt: Date.now() };
  } catch (e) {
    const aborted = controller.signal.aborted;
    if (!aborted) logger.error(`[dynamic-answer] qid=${questionId} resolver_error ${e}`);
    return { status: 'unresolved', questionId, reason: aborted ? 'timeout' : 'error' };
  } finally {
    clearTimeout(timer);
  }
}

function truncate(s: string, max = 120): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Single-flight, TTL'd resolution promise for (session, question). */
function ensureResolution(sessionId: string, q: Question): Promise<DynamicResolution> {
  const key = memoKey(sessionId, q.id);
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.at < MEMO_TTL_MS) return hit.p;

  const startedAt = now;
  const p = resolve(q.id, dynamicQuery(q.answer)).then((r) => {
    const value = r.status === 'resolved' ? truncate(r.value) : (r as { reason?: string }).reason ?? '-';
    logger.debug(
      `[dynamic-answer] sid=${sessionId} qid=${q.id} status=${r.status} latencyMs=${Date.now() - startedAt} value=${value}`,
    );
    return r;
  });
  memo.set(key, { at: startedAt, p });
  return p;
}

/** Fire-and-forget: start resolving while the model is still speaking the question. */
export function prefetchDynamicAnswer(sessionId: string, q: Question): void {
  if (!isDynamicAnswer(q.answer)) return;
  void ensureResolution(sessionId, q);
}

export async function getDynamicAnswer(sessionId: string, q: Question): Promise<DynamicResolution> {
  if (!isDynamicAnswer(q.answer)) return { status: 'not-dynamic', questionId: q.id };
  return ensureResolution(sessionId, q);
}

export function dropDynamicAnswers(sessionId: string): void {
  const prefix = `${sessionId}::`;
  for (const key of memo.keys()) {
    if (key.startsWith(prefix)) memo.delete(key);
  }
}
