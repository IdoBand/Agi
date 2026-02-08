import fs from 'fs/promises';
import path from 'path';
import { Question, QuizQuestion, QuizEvaluateResponse } from '../types/quiz.types.js';
import { LipsyncData } from '../types/message.types.js';
import { readFileAsBase64 } from '../utils/file.utils.js';
import { audioService } from './audio.service.js';
import { llmService } from './llm.service.js';
import { logger } from '../utils/logger.js';
import { WorkflowContext } from '../utils/file.utils.js';

const QUESTIONS_PATH = path.resolve('backend/src/tesseractjs/questions.json');
const AUDIO_DIR = path.resolve('backend/assets/questionsAudio');

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
    text: question.q,
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

const EVAL_SYSTEM_PROMPT = `Te egy kvíz értékelő asszisztens vagy. A felhasználó egy kérdésre válaszolt.
Döntsd el, hogy a válasz elfogadható-e. A válasznak nem kell tökéletesnek lennie,
de relevánsnak és értelmesnek kell lennie a kérdés kontextusában.
Adj egy rövid magyarázatot is, hogy miért helyes vagy helytelen a válasz.

Válaszolj PONTOSAN ebben a JSON formátumban:
{"correct": true/false, "explanation": "rövid magyarázat"}`;

export async function evaluateAnswer(
  audioPath: string,
  questionText: string,
  ctx?: WorkflowContext
): Promise<QuizEvaluateResponse> {
  // STT
  const userTranscript = await audioService.transcribe(audioPath, ctx);
  logger.info(`Quiz STT: "${userTranscript}"`);

  // Build eval prompt
  const userPrompt = `Kérdés: ${questionText}\nVálasz: ${userTranscript}`;
  const messages = [
    { role: 'user' as const, content: `${EVAL_SYSTEM_PROMPT}\n\n${userPrompt}` },
  ];

  const llmRaw = await llmService.chat(messages);
  logger.info(`Quiz eval raw: ${llmRaw}`);

  // Parse JSON from LLM response
  try {
    const parsed = JSON.parse(llmRaw) as { correct: boolean; explanation: string };
    return { correct: parsed.correct, explanation: parsed.explanation, userTranscript };
  } catch {
    logger.error(`Failed to parse eval JSON: ${llmRaw}`);
    return { correct: false, explanation: '', userTranscript };
  }
}
