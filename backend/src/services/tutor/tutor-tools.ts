import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
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

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTutorTools(sessionId: string): StructuredToolInterface[] {
  const listTool = tool(
    async () => {
      try {
        const entries = await listKnowledge();
        return JSON.stringify({ entries });
      } catch (e) {
        logger.error(`[tutor-tool listKnowledge] ${e}`);
        throw e;
      }
    },
    {
      name: 'listKnowledge',
      description: 'List all curated knowledge files (titles, summaries, tags). Call this once at session start.',
      schema: z.object({}),
    },
  );

  const readTool = tool(
    async (args: { path: string }) => {
      try {
        const content = await getKnowledgeFile(args.path);
        return JSON.stringify({ content });
      } catch (e) {
        logger.error(`[tutor-tool readKnowledge] ${e}`);
        throw e;
      }
    },
    {
      name: 'readKnowledge',
      description: 'Read the full contents of a curated knowledge file by its manifest path.',
      schema: z.object({ path: z.string().describe('manifest path, e.g. "numbers.md"') }),
    },
  );

  const drawTool = tool(
    async (args: { category?: string }) => {
      try {
        const all = await getAllQuestionMetas();
        const asked = askedQuestions.get(sessionId) ?? new Set<string>();
        const byCategory = args.category
          ? all.filter((q) => q.category.toLowerCase() === args.category!.toLowerCase())
          : all;
        const fresh = byCategory.filter((q) => !asked.has(q.id));
        const pool = fresh.length ? fresh : [];
        if (!pool.length) {
          throw new Error(args.category ? `no more questions in category "${args.category}"` : 'no more questions available');
        }
        const pick = shuffle(pool)[0];
        asked.add(pick.id);
        askedQuestions.set(sessionId, asked);
        return JSON.stringify({
          id: pick.id,
          question: pick.question,
          answer: pick.answer,
          englishTranslation: pick.englishTranslation,
          category: pick.category,
        });
      } catch (e) {
        logger.error(`[tutor-tool drawPracticeQuestion] ${e}`);
        throw e;
      }
    },
    {
      name: 'drawPracticeQuestion',
      description: 'Draw a random practice question (Hungarian Q&A pair) from the question bank. Server filters out IDs already served this session.',
      schema: z.object({ category: z.string().optional().describe('optional category filter') }),
    },
  );

  const recordTool = tool(
    async (args: { topic: string; correct: boolean; note: string }) => {
      appendEvalLog(sessionId, { topic: args.topic, correct: args.correct, note: args.note, at: Date.now() });
      return JSON.stringify({ ok: true });
    },
    {
      name: 'recordEvaluation',
      description: "Record an evaluation of the learner's answer for self-tracking. Does not affect the conversation.",
      schema: z.object({
        topic: z.string(),
        correct: z.boolean(),
        note: z.string(),
      }),
    },
  );

  return [listTool, readTool, drawTool, recordTool] as StructuredToolInterface[];
}
