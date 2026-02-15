import { Request, Response, NextFunction } from 'express';
import { ChatRequest } from '../types/request.types.js';
import { WorkflowContext, deleteWorkflowDir } from '../utils/file.utils.js';
import { getRandomQuestions, getShuffledQuestions, evaluateAnswer } from '../services/quiz.service.js';
import { logger } from '../utils/logger.js';

export async function handleQuizStart(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    logger.info('Starting quiz round');
    const questions = await getRandomQuestions(10);
    res.json({ questions });
  } catch (error) {
    next(error);
  }
}

export async function handleQuizStartTest(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    logger.info('Starting quiz round (test/deterministic)');
    const questions = await getShuffledQuestions(10);
    res.json({ questions });
  } catch (error) {
    next(error);
  }
}

export async function handleQuizEvaluate(
  req: ChatRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const audioFile = req.file;
  const questionText = req.body?.questionText as string | undefined;
  const correctAnswer = req.body?.correctAnswer as string | undefined;

  if (!questionText) {
    res.status(400).json({ error: 'questionText is required' });
    return;
  }

  if (!correctAnswer) {
    res.status(400).json({ error: 'correctAnswer is required' });
    return;
  }

  if (!audioFile) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  try {
    const ctx: WorkflowContext = { workflowId: req.workflowId! };
    const result = await evaluateAnswer(audioFile.path, questionText, correctAnswer, ctx);
    logger.info(`Quiz eval: correct=${result.correct}`);
    res.json(result);
    await deleteWorkflowDir(ctx);
  } catch (error) {
    next(error);
  }
}
