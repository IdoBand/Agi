import { randomUUID } from 'crypto';
import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT } from './system-prompt.js';
import { buildTutorTools, dropEvalLog, dropAskedQuestions } from './tutor-tools.js';
import { ToolCallTrace, TurnTrace } from '../../types/tutor.types.js';
import { appendTurnTrace, rotateSessionTrace } from './session-trace.js';

interface SessionState {
  lastTouched: number;
  threadId: string;
  turnCount: number;
  lastReply?: string;
}

const sessions = new Map<string, SessionState>();
const SESSION_TTL_MS = 60 * 60 * 1000;

const FALLBACK_HU = 'Bocsánat, nem hallottam jól. Mondanád újra?';

const checkpointer = new MemorySaver();
let chatModel: ChatAnthropic | null = null;

function getChatModel(): ChatAnthropic {
  if (!chatModel) {
    chatModel = new ChatAnthropic({
      model: config.anthropic.model,
      apiKey: config.anthropic.apiKey,
      streaming: true,
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
): AsyncGenerator<SentenceEvent, RunTurnStreamResult, void> {
  ensureInit();
  sweep();

  const state = sessions.get(sessionId) ?? {
    lastTouched: Date.now(),
    threadId: randomUUID(),
    turnCount: 0,
  };

  const tools = buildTutorTools(sessionId);
  const agent = createReactAgent({
    llm: getChatModel(),
    tools,
    prompt: ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT,
    checkpointer,
  });

  let assistantText = '';
  let buffer = '';
  let idx = 0;
  const startedAt = Date.now();
  const toolCalls: ToolCallTrace[] = [];
  const toolByRunId = new Map<string, ToolCallTrace>();

  const pending: SentenceEvent[] = [];

  const flushFromBuffer = (): void => {
    const { sentences, remainder } = extractSentences(buffer);
    buffer = remainder;
    for (const s of sentences) {
      pending.push({ idx: idx++, hu: s });
    }
  };

  try {
    const stream = agent.streamEvents(
      { messages: [new HumanMessage(userText)] },
      { version: 'v2', configurable: { thread_id: state.threadId } },
    );

    for await (const ev of stream) {
      if (ev.event === 'on_chat_model_stream') {
        const chunk = (ev.data as { chunk?: { content?: unknown } }).chunk;
        const text = chunkTextContent(chunk?.content);
        if (text) {
          assistantText += text;
          buffer += text;
          flushFromBuffer();
        }
      } else if (ev.event === 'on_tool_start') {
        const input = (ev.data as { input?: unknown }).input;
        const tc: ToolCallTrace = { name: ev.name, input };
        toolCalls.push(tc);
        toolByRunId.set(ev.run_id, tc);
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
        }
      }

      while (pending.length > 0) {
        yield pending.shift()!;
      }
    }
  } catch (e) {
    logger.error(`[tutor-agent] agent stream error: ${e}`);
    throw e;
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

  const trace: TurnTrace = {
    userText,
    replyText: fullHu,
    toolCalls,
    startedAt,
    durationMs: Date.now() - startedAt,
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
    return;
  }
  purge(sessionId, s.threadId);
}
