import { randomUUID } from 'crypto';
import { query, deleteSession } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { CITIZENSHIP_INTERVIEW_PROMPT } from './system-prompt.js';
import { buildTutorMcpServer, TUTOR_TOOL_NAMES, dropEvalLog, dropAskedQuestions } from './tutor-tools.js';
import { ToolCallTrace, TurnTrace } from '../../types/tutor.types.js';
import { appendTurnTrace, rotateSessionTrace } from './session-trace.js';

interface SessionState {
  lastTouched: number;
  sdkSessionId: string;
  turnCount: number;
  lastReply?: string;
}

const sessions = new Map<string, SessionState>();
const SESSION_TTL_MS = 60 * 60 * 1000;

const FALLBACK_HU = 'Bocsánat, nem hallottam jól. Mondanád újra?';

async function purge(sessionId: string, sdkSessionId: string): Promise<void> {
  sessions.delete(sessionId);
  dropEvalLog(sessionId);
  dropAskedQuestions(sessionId);
  void rotateSessionTrace(sessionId);
  try {
    await deleteSession(sdkSessionId);
  } catch (e) {
    logger.warn(`[tutor-agent] deleteSession failed for ${sdkSessionId}: ${e}`);
  }
}

function sweep(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastTouched > SESSION_TTL_MS) {
      void purge(id, s.sdkSessionId);
    }
  }
}

function extractToolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === 'string') return b;
        if (b && typeof b === 'object' && 'text' in b && typeof (b as { text: unknown }).text === 'string') {
          return (b as { text: string }).text;
        }
        return JSON.stringify(b);
      })
      .join('\n');
  }
  if (content === undefined || content === null) return '';
  return JSON.stringify(content);
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
    sdkSessionId: randomUUID(),
    turnCount: 0,
  };
  const isFirstTurn = state.turnCount === 0;

  const mcpServer = buildTutorMcpServer(sessionId);

  let assistantText = '';
  let buffer = '';
  let idx = 0;
  const startedAt = Date.now();
  const toolCalls: ToolCallTrace[] = [];
  const toolById = new Map<string, ToolCallTrace>();

  const pending: SentenceEvent[] = [];

  const flushFromBuffer = (): void => {
    const { sentences, remainder } = extractSentences(buffer);
    buffer = remainder;
    for (const s of sentences) {
      pending.push({ idx: idx++, hu: s });
    }
  };

  try {
    const q = query({
      prompt: userText,
      options: {
        model: config.anthropic.model,
        systemPrompt: CITIZENSHIP_INTERVIEW_PROMPT,
        mcpServers: { tutor: mcpServer },
        allowedTools: TUTOR_TOOL_NAMES,
        tools: [],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: [],
        ...(isFirstTurn ? { sessionId: state.sdkSessionId } : { resume: state.sdkSessionId }),
        env: { ...process.env, ANTHROPIC_API_KEY: config.anthropic.apiKey },
      },
    });

    for await (const msg of q) {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'text') {
            assistantText += block.text;
            buffer += block.text;
            flushFromBuffer();
          } else if (block.type === 'tool_use') {
            const tc: ToolCallTrace = { name: block.name, input: block.input };
            toolCalls.push(tc);
            toolById.set(block.id, tc);
          }
        }
      } else if (msg.type === 'user') {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block && typeof block === 'object' && (block as { type?: string }).type === 'tool_result') {
              const tr = block as { tool_use_id: string; content: unknown; is_error?: boolean };
              const tc = toolById.get(tr.tool_use_id);
              if (tc) {
                tc.output = extractToolResultText(tr.content);
                tc.isError = tr.is_error === true;
              }
            }
          }
        }
      } else if (msg.type === 'result') {
        if (msg.subtype !== 'success') {
          logger.warn(`[tutor-agent] non-success result: ${msg.subtype}`);
        }
      }

      while (pending.length > 0) {
        yield pending.shift()!;
      }
    }
  } catch (e) {
    logger.error(`[tutor-agent] query error: ${e}`);
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
  void purge(sessionId, s.sdkSessionId);
}
