import fs from 'fs/promises';
import path from 'path';
import { Question, QuizQuestion, QuizEvaluateResponse } from '../types/quiz.types.js';
import { LipsyncData } from '../types/message.types.js';
import { z } from 'zod';
import { readFileAsBase64 } from '../utils/file.utils.js';
import { audioService } from './audio.service.js';
import { chatgptService } from './chatgpt.service.js';
import { logger } from '../utils/logger.js';
import { WorkflowContext } from '../utils/file.utils.js';

const EvalResponseSchema = z.object({
  correct: z.boolean(),
  explanation: z.string(),
});

const QUESTIONS_PATH = path.resolve('src/scripts/tesseractjs/questions.json');
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
  const jsonPath = path.join(AUDIO_DIR, `${question.id}.json`);

  try {
    await fs.access(mp3Path);
  } catch {
    throw new Error(`Missing pre-generated audio for question ${question.id}`);
  }

  const audio = await readFileAsBase64(mp3Path);
  const lipsyncRaw = await fs.readFile(jsonPath, 'utf-8');
  const lipsync: LipsyncData = JSON.parse(lipsyncRaw);

  return {
    index,
    text: question.question,
    answer: question.answer,
    audio,
    lipsync,
    facialExpression: 'default',
  };
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

const EVAL_SYSTEM_PROMPT = `Te egy kvíz értékelő asszisztens vagy. A felhasználó egy kérdésre válaszolt szóban (beszédfelismeréssel átiratva).

Szabályok:
- Rövid válaszok (akár egyetlen szó) teljesen elfogadhatók, ha a jelentés stimmel.
- A beszédfelismerés gyakran kisebb helyesírási hibákat ejt — ezeket ignoráld.
- A kis- és nagybetűk közötti különbséget ignoráld (pl. "focizni" = "Focizni").
- Csak azt vizsgáld, hogy a válasz JELENTÉSE megegyezik-e a helyes válasszal, vagy közel áll hozzá.
- NE büntesd a választ a rövidsége vagy részletessége miatt.

NE használj <think> tageket vagy bármilyen gondolkodási blokkot. CSAK a JSON-t add vissza, semmi mást.

Válaszolj PONTOSAN ebben a JSON formátumban:
{"correct": true/false, "explanation": "short explanation in English"}`;

export async function evaluateAnswer(
  audioPath: string,
  questionText: string,
  correctAnswer: string,
  ctx?: WorkflowContext
): Promise<QuizEvaluateResponse> {
  // STT
  const userTranscript = await audioService.transcribe(audioPath, ctx);
  logger.info(`Quiz STT: "${userTranscript}"`);

  // Build eval prompt
  const userPrompt = `Kérdés: ${questionText}\nHelyes válasz: ${correctAnswer}\nA felhasználó válasza: ${userTranscript}`;
  const messages = [
    { role: 'user' as const, content: userPrompt },
  ];

  const result = await chatgptService.chatWithSchema(messages, EVAL_SYSTEM_PROMPT, EvalResponseSchema);
  logger.info(`Quiz eval result: ${JSON.stringify(result)}`);

  return { correct: result.correct, explanation: result.explanation, userTranscript };
}
