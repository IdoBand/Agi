import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { ChatRequest } from '../types/request.types.js';
import { TutorTurnResponse } from '../types/tutor.types.js';
import { WorkflowContext, deleteWorkflowDir } from '../utils/file.utils.js';
import { sttService } from '../services/stt/stt.service.js';
import { ttsService } from '../services/tts/tts.service.js';
import { lipsyncService } from '../services/lipsync/lipsync.service.js';
import { runTurn, resetSession, getLastAssistantReply } from '../services/tutor/claude-agent.service.js';
import { buildSttPrompt } from '../services/tutor/stt-prompt.js';
import { logger } from '../utils/logger.js';

export async function handleTutorTurn(
  req: ChatRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const audioFile = req.file;
  const sessionId = req.body?.sessionId as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  if (!audioFile) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  const ctx: WorkflowContext = { workflowId: req.workflowId! };
  try {
    const sttPrompt = buildSttPrompt(getLastAssistantReply(sessionId));
    const userTranscript = await sttService.transcribe(audioFile.path, ctx, sttPrompt);
    logger.info(`[tutor] sid=${sessionId} stt="${userTranscript}"`);

    const trimmed = userTranscript.trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Empty transcript' });
      await deleteWorkflowDir(ctx);
      return;
    }

    const { hu, en } = await runTurn(sessionId, trimmed);
    logger.info(`[tutor] sid=${sessionId} reply="${hu}"`);
    logger.debug(`[tutor] sid=${sessionId} en.length=${en.length}`);

    const audioBuf = await ttsService.synthesize(hu);
    const audioPath = await ttsService.saveToFile(audioBuf, ctx);
    const lipsync = await lipsyncService.generateLipsync(audioPath, ctx);
    const audioBytes = await fs.readFile(audioPath);

    const response: TutorTurnResponse = {
      content: hu,
      contentEn: en,
      audio: audioBytes.toString('base64'),
      lipsync,
      facialExpression: 'default',
      userTranscript: trimmed,
    };
    res.json(response);
    await deleteWorkflowDir(ctx);
  } catch (error) {
    logger.error(`[tutor-turn] error: ${error}`);
    next(error);
  }
}

export async function handleTutorReset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId = req.body?.sessionId as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  try {
    resetSession(sessionId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
