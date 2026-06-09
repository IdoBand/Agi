import fs from 'fs/promises';
import path from 'path';
import { Question, QuizQuestion, QuizEvaluateResponse } from '../types/quiz.types.js';
import { readFileAsBase64 } from '../utils/file.utils.js';
import { transcribeAndEvaluate } from './gpt-multi-service/unified-eval.service.js';
import { logger } from '../utils/logger.js';
import { WorkflowContext } from '../utils/file.utils.js';

const QUESTIONS_PATH = path.resolve('knowledge/citizenship/mergedQuestions.json');
const AUDIO_DIR = path.resolve('assets/questionsAudio');

let questionsCache: Question[] | null = null;

async function loadQuestions(): Promise<Question[]> {
  if (questionsCache) return questionsCache;
  const raw = await fs.readFile(QUESTIONS_PATH, 'utf-8');
  questionsCache = JSON.parse(raw) as Question[];
  return questionsCache;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadQuestionAudio(question: Question, index: number): Promise<QuizQuestion> {
  const mp3Path = path.join(AUDIO_DIR, `${question.id}.mp3`);

  try {
    await fs.access(mp3Path);
  } catch {
    throw new Error(`Missing pre-generated audio for question ${question.id}`);
  }

  const audio = await readFileAsBase64(mp3Path);

  return {
    index,
    text: question.question,
    answer: question.answer,
    englishTranslation: question.englishTranslation,
    category: question.category,
    audio,
    facialExpression: 'default',
  };
}

export async function getRandomQuestionMeta(count: number): Promise<Question[]> {
  const questions = await loadQuestions();
  return shuffle(questions).slice(0, count);
}

export async function getAllQuestionMetas(): Promise<Question[]> {
  const all = await loadQuestions();
  return all.filter((q) => q.answer.trim().length > 0);
}

export async function getRandomQuestions(count: number): Promise<QuizQuestion[]> {
  const questions = await loadQuestions();
  const selected = shuffle(questions).slice(0, count);
  return Promise.all(selected.map((q, i) => loadQuestionAudio(q, i)));
}

export async function getFirstQuestions(count: number): Promise<QuizQuestion[]> {
  const questions = await loadQuestions();
  const selected = questions.slice(0, count);
  return Promise.all(selected.map((q, i) => loadQuestionAudio(q, i)));
}

export async function getShuffledQuestions(count: number): Promise<QuizQuestion[]> {
  const questions = await loadQuestions();
  const selected = shuffle(questions.slice(0, count));
  return Promise.all(selected.map((q, i) => loadQuestionAudio(q, i)));
}

export async function evaluateAnswerUnified(
  audioPath: string,
  questionText: string,
  correctAnswer: string,
  ctx?: WorkflowContext
): Promise<QuizEvaluateResponse> {
  logger.debug(`[quiz-evaluate-unified] audioPath=${audioPath} questionText=${questionText} correctAnswer=${correctAnswer}`);
  return transcribeAndEvaluate(audioPath, questionText, correctAnswer, ctx);
}
