import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { TUTOR_SYSTEM_PROMPT } from './system-prompt.js';
import { CITIZENSHIP_INTERVIEW_PROMPT } from './system-prompt.js';
import { buildTutorMcpServer, TUTOR_TOOL_NAMES, dropEvalLog } from './tutor-tools.js';
import { ToolCallTrace, TurnTrace } from '../../types/tutor.types.js';
import { appendTurnTrace, rotateSessionTrace } from './session-trace.js';

interface SessionState {
  lastTouched: number;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
}

const sessions = new Map<string, SessionState>();
const SESSION_TTL_MS = 60 * 60 * 1000;

function sweep(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastTouched > SESSION_TTL_MS) {
      sessions.delete(id);
      dropEvalLog(id);
      void rotateSessionTrace(id);
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

const FALLBACK: BilingualReply = {
  hu: 'Bocsánat, nem hallottam jól. Mondanád újra?',
  en: "Sorry, I didn't catch that. Could you say it again?",
};

interface BilingualReply {
  hu: string;
  en: string;
}

function parseBilingualReply(raw: string): BilingualReply {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  try {
    const parsed: unknown = JSON.parse(s);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { hu?: unknown }).hu === 'string' &&
      typeof (parsed as { en?: unknown }).en === 'string'
    ) {
      const hu = (parsed as { hu: string }).hu.trim();
      const en = (parsed as { en: string }).en.trim();
      if (hu) return { hu, en };
    }
    logger.warn(`[tutor-agent] bilingual parse: invalid shape`);
  } catch (e) {
    logger.warn(`[tutor-agent] bilingual parse failed: ${e}`);
  }
  return { hu: raw.trim(), en: '' };
}

function ensureInit(): void {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set; tutor mode unavailable.');
  }
}

function buildPrompt(history: SessionState['history'], userText: string): string {
  if (history.length === 0) return userText;
  const transcript = history
    .map((m) => (m.role === 'user' ? `Learner: ${m.text}` : `Tutor: ${m.text}`))
    .join('\n');
  return `${transcript}\nLearner: ${userText}`;
}

export async function runTurn(sessionId: string, userText: string): Promise<BilingualReply> {
  ensureInit();
  sweep();

  const state = sessions.get(sessionId) ?? { lastTouched: Date.now(), history: [] };

  const mcpServer = buildTutorMcpServer(sessionId);
  const prompt = buildPrompt(state.history, userText);

  let assistantText = '';
  const startedAt = Date.now();
  const toolCalls: ToolCallTrace[] = [];
  const toolById = new Map<string, ToolCallTrace>();
  try {
    const q = query({
      prompt,
      options: {
        model: config.anthropic.model,
        systemPrompt: CITIZENSHIP_INTERVIEW_PROMPT,
        mcpServers: { tutor: mcpServer },
        allowedTools: TUTOR_TOOL_NAMES,
        tools: [],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: [],
        persistSession: false,
        env: { ...process.env, ANTHROPIC_API_KEY: config.anthropic.apiKey },
      },
    });

    for await (const msg of q) {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'text') assistantText += block.text;
          else if (block.type === 'tool_use') {
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
        if (msg.subtype === 'success' && msg.result) {
          assistantText = msg.result;
        } else if (msg.subtype !== 'success') {
          logger.warn(`[tutor-agent] non-success result: ${msg.subtype}`);
        }
      }
    }
  } catch (e) {
    logger.error(`[tutor-agent] query error: ${e}`);
    throw e;
  }

  const trimmedRaw = assistantText.trim();
  const { hu, en } = trimmedRaw ? parseBilingualReply(trimmedRaw) : FALLBACK;

  state.history.push({ role: 'user', text: userText });
  state.history.push({ role: 'assistant', text: hu });
  state.lastTouched = Date.now();
  sessions.set(sessionId, state);

  const trace: TurnTrace = {
    userText,
    replyText: hu,
    replyEn: en,
    toolCalls,
    startedAt,
    durationMs: Date.now() - startedAt,
  };
  void appendTurnTrace(sessionId, trace);

  return { hu, en };
}

export function getLastAssistantReply(sessionId: string): string | undefined {
  const s = sessions.get(sessionId);
  if (!s) return undefined;
  for (let i = s.history.length - 1; i >= 0; i--) {
    if (s.history[i].role === 'assistant') return s.history[i].text;
  }
  return undefined;
}

export function resetSession(sessionId: string): void {
  void rotateSessionTrace(sessionId);
  sessions.delete(sessionId);
  dropEvalLog(sessionId);
}
