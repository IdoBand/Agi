import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { listKnowledge, getKnowledgeFile } from './knowledge.service.js';
import { getAllQuestionMetas } from '../quiz.service.js';
import { Question } from '../../types/quiz.types.js';
import { TutorEvalLogEntry } from '../../types/tutor.types.js';
import { logger } from '../../utils/logger.js';

const evalLogs = new Map<string, TutorEvalLogEntry[]>();
const askedQuestions = new Map<string, Set<string>>();

interface BankCursor {
  categories: string[];
  questionsByCategory: Map<string, Question[]>;
  categoryIdx: number;
  questionIdx: number;
  lastServedId: string | null;
}
const bankCursors = new Map<string, BankCursor>();

async function buildBankCursor(): Promise<{ categories: string[]; questionsByCategory: Map<string, Question[]> }> {
  const all = await getAllQuestionMetas();
  const categories: string[] = [];
  const questionsByCategory = new Map<string, Question[]>();
  for (const q of all) {
    if (!questionsByCategory.has(q.category)) {
      categories.push(q.category);
      questionsByCategory.set(q.category, []);
    }
    questionsByCategory.get(q.category)!.push(q);
  }
  return { categories, questionsByCategory };
}

export function dropBankCursor(sessionId: string): void {
  bankCursors.delete(sessionId);
}

// Resolve a learner topic pick — a 1-based number ("3") or an exact (case-insensitive)
// category name ("CSALÁD") — to a 0-based index into `categories`. Throws on out-of-range
// number or unknown name so the caller surfaces it as a tool error.
function resolveTopicIndex(input: string, categories: string[]): number {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n < 1 || n > categories.length) {
      throw new Error(`topic number ${n} out of range 1..${categories.length}`);
    }
    return n - 1;
  }
  const idx = categories.findIndex((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (idx === -1) throw new Error(`unknown topic "${input}"`);
  return idx;
}

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

// Shared evaluation shape, embedded as the optional `evaluation` arg of the
// fused tools. `note` stays required WITHIN the optional object so the eval log
// never records an undefined note.
const evaluationSchema = z.object({
  topic: z.string(),
  correct: z.boolean(),
  note: z.string(),
});

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

  const evaluateAndDrawPracticeSchema = z.object({
    evaluation: evaluationSchema
      .optional()
      .describe("your evaluation of the learner's pending answer; omit when nothing to record"),
    draw: z
      .object({ category: z.string().optional().describe('optional category filter') })
      .optional()
      .describe('draw the next practice question; omit for an eval-only call'),
  });
  type EvaluateAndDrawPracticeArgs = z.infer<typeof evaluateAndDrawPracticeSchema>;

  const evaluateAndDrawTool = tool(
    async (args: EvaluateAndDrawPracticeArgs) => {
      try {
        // (i) Record FIRST so the eval logs the just-answered question.
        if (args.evaluation) {
          const { topic, correct, note } = args.evaluation;
          appendEvalLog(sessionId, { topic, correct, note, at: Date.now() });
        }
        // (ii) Eval-only call: do not draw, do not mutate the asked set.
        if (!args.draw) {
          return JSON.stringify({ recorded: !!args.evaluation });
        }
        const category = args.draw.category;
        const all = await getAllQuestionMetas();
        const asked = askedQuestions.get(sessionId) ?? new Set<string>();
        const byCategory = category
          ? all.filter((q) => q.category.toLowerCase() === category.toLowerCase())
          : all;
        const fresh = byCategory.filter((q) => !asked.has(q.id));
        const pool = fresh.length ? fresh : [];
        if (!pool.length) {
          throw new Error(category ? `no more questions in category "${category}"` : 'no more questions available');
        }
        const pick = shuffle(pool)[0];
        asked.add(pick.id);
        askedQuestions.set(sessionId, asked);
        return JSON.stringify({
          recorded: !!args.evaluation,
          id: pick.id,
          question: pick.question,
          answer: pick.answer,
          englishTranslation: pick.englishTranslation,
          category: pick.category,
        });
      } catch (e) {
        logger.error(`[tutor-tool evaluateAndDrawPractice] ${e}`);
        throw e;
      }
    },
    {
      name: 'evaluateAndDrawPractice',
      description:
        "Fused tool: optionally record an evaluation of the learner's pending answer AND/OR draw a random practice question — in one call. When the learner has answered, pass BOTH `evaluation` and `draw` together. Pass only `evaluation` to record without drawing (e.g. self-generated interview question, or a deferred-eval resolution). Pass only `draw` to draw without recording (first question, redundant re-draw). Drawing filters out IDs already served this session. Response includes the gold answer; do not speak it until the learner has tried.",
      schema: evaluateAndDrawPracticeSchema,
    },
  );

  return [listTool, readTool, evaluateAndDrawTool] as StructuredToolInterface[];
}

export function buildBankOnlyTutorTools(sessionId: string): StructuredToolInterface[] {
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

  const listTopicsTool = tool(
    async () => {
      try {
        const { categories } = await buildBankCursor();
        return JSON.stringify({ topics: categories.map((name, i) => ({ number: i + 1, name })) });
      } catch (e) {
        logger.error(`[tutor-tool listTopics] ${e}`);
        throw e;
      }
    },
    {
      name: 'listTopics',
      description:
        'List the bank topic categories in fixed order, each with its 1-based number. Read-only — does not draw or move the cursor. Call when the learner asks which topics exist, or to get canonical names before a jump.',
      schema: z.object({}),
    },
  );

  const evaluateAndDrawNextSchema = z.object({
    evaluation: evaluationSchema
      .optional()
      .describe("your evaluation of the learner's pending answer; omit when nothing to record"),
    draw: z
      .object({
        skip: z.enum(['none', 'question', 'category']).default('none'),
        jumpToTopic: z
          .string()
          .optional()
          .describe(
            "jump to a specific topic — its number from listTopics (e.g. '3') or category name (e.g. 'CSALÁD'); when set, skip is ignored",
          ),
      })
      .optional()
      .describe('draw the next bank question; omit for an eval-only call'),
  });
  type EvaluateAndDrawNextArgs = z.infer<typeof evaluateAndDrawNextSchema>;

  const evaluateAndDrawNextTool = tool(
    async (args: EvaluateAndDrawNextArgs) => {
      try {
        // (i) Record FIRST so the eval logs the just-answered/skipped question.
        const recorded = !!args.evaluation;
        if (args.evaluation) {
          const { topic, correct, note } = args.evaluation;
          appendEvalLog(sessionId, { topic, correct, note, at: Date.now() });
        }
        // (ii) Eval-only call: leave the cursor (lastServedId) untouched.
        if (!args.draw) {
          return JSON.stringify({ recorded });
        }

        let cur = bankCursors.get(sessionId);
        const firstEver = !cur;
        if (!cur) {
          const built = await buildBankCursor();
          cur = {
            categories: built.categories,
            questionsByCategory: built.questionsByCategory,
            categoryIdx: 0,
            questionIdx: 0,
            lastServedId: null,
          };
          bankCursors.set(sessionId, cur);
        }

        const skip = args.draw.skip;
        let announceNewCategory = firstEver;
        const startCategoryIdx = cur.categoryIdx;

        const jumpRaw = args.draw.jumpToTopic?.trim();
        if (jumpRaw) {
          // Jump wins over skip — reposition the cursor to the chosen topic.
          cur.categoryIdx = resolveTopicIndex(jumpRaw, cur.categories); // throws → tool error
          cur.questionIdx = 0;
          announceNewCategory = true;
        } else if (skip === 'category') {
          cur.categoryIdx += 1;
          cur.questionIdx = 0;
        } else if (skip === 'question') {
          cur.questionIdx += 1;
        } else {
          // skip === 'none': re-call guard — if current slot is what we just served, advance.
          if (cur.lastServedId !== null) {
            const catName = cur.categories[cur.categoryIdx];
            const list = catName ? cur.questionsByCategory.get(catName) ?? [] : [];
            const peek = list[cur.questionIdx];
            if (peek && peek.id === cur.lastServedId) {
              cur.questionIdx += 1;
            }
          }
        }

        // Advance past exhausted categories
        while (cur.categoryIdx < cur.categories.length) {
          const catName = cur.categories[cur.categoryIdx];
          const list = cur.questionsByCategory.get(catName) ?? [];
          if (cur.questionIdx < list.length) break;
          cur.categoryIdx += 1;
          cur.questionIdx = 0;
        }

        if (cur.categoryIdx !== startCategoryIdx) announceNewCategory = true;

        if (cur.categoryIdx >= cur.categories.length) {
          cur.lastServedId = null;
          return JSON.stringify({ recorded, done: true });
        }

        const categoryName = cur.categories[cur.categoryIdx];
        const list = cur.questionsByCategory.get(categoryName) ?? [];
        const pick = list[cur.questionIdx];
        cur.lastServedId = pick.id;

        const asked = askedQuestions.get(sessionId) ?? new Set<string>();
        asked.add(pick.id);
        askedQuestions.set(sessionId, asked);

        const payload: Record<string, unknown> = {
          recorded,
          id: pick.id,
          question: pick.question,
          answer: pick.answer,
          englishTranslation: pick.englishTranslation,
          category: pick.category,
        };
        if (announceNewCategory) {
          payload.newCategory = true;
          payload.categoryName = categoryName;
        }
        return JSON.stringify(payload);
      } catch (e) {
        logger.error(`[tutor-tool evaluateAndDrawNext] ${e}`);
        throw e;
      }
    },
    {
      name: 'evaluateAndDrawNext',
      description:
        "Fused tool: optionally record an evaluation of the learner's pending answer AND/OR draw the next bank question from the server-managed category-ordered cursor — in one call. When the learner has answered, pass BOTH `evaluation` and `draw` together. Pass only `evaluation` to record without advancing the cursor (e.g. a deferred-eval resolution). Pass only `draw` to advance without recording (first question, redundant re-draw with draw.skip='question'). draw.skip: 'question' skips current, 'category' jumps to next category, 'none' otherwise. draw.jumpToTopic (number from listTopics or category name) repositions the cursor to that topic, then continues sequentially once it is exhausted; when set, skip is ignored. Returns { newCategory:true, categoryName } when entering a new category, { done:true } when exhausted. Response includes the gold answer; do not speak it until the learner has tried.",
      schema: evaluateAndDrawNextSchema,
    },
  );

  return [listTool, readTool, listTopicsTool, evaluateAndDrawNextTool] as StructuredToolInterface[];
}
