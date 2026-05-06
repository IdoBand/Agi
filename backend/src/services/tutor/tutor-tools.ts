import { z } from 'zod';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { listKnowledge, getKnowledgeFile } from './knowledge.service.js';
import { getAllQuestionMetas } from '../quiz.service.js';
import { TutorEvalLogEntry } from '../../types/tutor.types.js';
import { logger } from '../../utils/logger.js';

const evalLogs = new Map<string, TutorEvalLogEntry[]>();
const askedQuestions = new Map<string, Set<string>>();

export function appendEvalLog(sessionId: string, entry: TutorEvalLogEntry): void {
  const list = evalLogs.get(sessionId) ?? [];
  list.push(entry);
  evalLogs.set(sessionId, list);
}

export function getEvalLog(sessionId: string): TutorEvalLogEntry[] {
  return evalLogs.get(sessionId) ?? [];
}

export function dropEvalLog(sessionId: string): void {
  evalLogs.delete(sessionId);
}

export function dropAskedQuestions(sessionId: string): void {
  askedQuestions.delete(sessionId);
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function err(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTutorMcpServer(sessionId: string) {
  const listTool = tool(
    'listKnowledge',
    'List all curated knowledge files (titles, summaries, tags). Call this once at session start.',
    {},
    async () => {
      try {
        const entries = await listKnowledge();
        return ok(JSON.stringify({ entries }));
      } catch (e) {
        logger.error(`[tutor-tool listKnowledge] ${e}`);
        return err((e as Error).message);
      }
    }
  );

  const readTool = tool(
    'readKnowledge',
    'Read the full contents of a curated knowledge file by its manifest path.',
    { path: z.string().describe('manifest path, e.g. "numbers.md"') },
    async (args) => {
      try {
        const content = await getKnowledgeFile(args.path);
        return ok(JSON.stringify({ content }));
      } catch (e) {
        logger.error(`[tutor-tool readKnowledge] ${e}`);
        return err((e as Error).message);
      }
    }
  );

  const drawTool = tool(
    'drawPracticeQuestion',
    'Draw a random practice question (Hungarian Q&A pair) from the question bank. Server filters out IDs already served this session.',
    { category: z.string().optional().describe('optional category filter') },
    async (args) => {
      try {
        const all = await getAllQuestionMetas();
        const asked = askedQuestions.get(sessionId) ?? new Set<string>();
        const byCategory = args.category
          ? all.filter((q) => q.category.toLowerCase() === args.category!.toLowerCase())
          : all;
        const fresh = byCategory.filter((q) => !asked.has(q.id));
        const pool = fresh.length ? fresh : [];
        if (!pool.length) {
          return err(args.category ? `no more questions in category "${args.category}"` : 'no more questions available');
        }
        const pick = shuffle(pool)[0];
        asked.add(pick.id);
        askedQuestions.set(sessionId, asked);
        return ok(JSON.stringify({
          id: pick.id,
          question: pick.question,
          answer: pick.answer,
          englishTranslation: pick.englishTranslation,
          category: pick.category,
        }));
      } catch (e) {
        logger.error(`[tutor-tool drawPracticeQuestion] ${e}`);
        return err((e as Error).message);
      }
    }
  );

  const recordTool = tool(
    'recordEvaluation',
    'Record an evaluation of the learner\'s answer for self-tracking. Does not affect the conversation.',
    {
      topic: z.string(),
      correct: z.boolean(),
      note: z.string(),
    },
    async (args) => {
      appendEvalLog(sessionId, { topic: args.topic, correct: args.correct, note: args.note, at: Date.now() });
      return ok(JSON.stringify({ ok: true }));
    }
  );

  return createSdkMcpServer({
    name: 'tutor',
    version: '0.1.0',
    tools: [listTool, readTool, drawTool, recordTool],
  });
}

export const TUTOR_TOOL_NAMES = [
  'mcp__tutor__listKnowledge',
  'mcp__tutor__readKnowledge',
  'mcp__tutor__drawPracticeQuestion',
  'mcp__tutor__recordEvaluation',
];
