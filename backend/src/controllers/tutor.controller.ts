import { Request, Response, NextFunction } from 'express';
import { ChatRequest } from '../types/request.types.js';
import { TurnEvent } from '../types/tutor.types.js';
import { WorkflowContext, deleteWorkflowDir } from '../utils/file.utils.js';
import { sttService } from '../services/stt/stt.service.js';
import { ttsService } from '../services/tts/tts.service.js';
import { runTurnStream, resetSession, getLastAssistantReply } from '../services/tutor/claude-agent.service.js';
import { buildSttPrompt } from '../services/tutor/stt-prompt.js';
import { logger } from '../utils/logger.js';

function sseSend(res: Response, event: TurnEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

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
    const sttDoneAt = Date.now();
    logger.info(`[tutor] sid=${sessionId} stt_done text="${userTranscript}"`);

    const trimmed = userTranscript.trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Empty transcript' });
      await deleteWorkflowDir(ctx);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseSend(res, { type: 'transcript', text: trimmed });

    let firstSentenceAt: number | null = null;
    let firstAudioAt: number | null = null;

    const ttsPromises: Array<Promise<{ idx: number; base64: string }>> = [];
    let nextEmitIdx = 0;
    const ready = new Map<number, string>();

    const drainAudio = (): void => {
      while (ready.has(nextEmitIdx)) {
        const base64 = ready.get(nextEmitIdx)!;
        ready.delete(nextEmitIdx);
        if (firstAudioAt === null) {
          firstAudioAt = Date.now();
          logger.info(
            `[tutor] sid=${sessionId} first_audio_emitted dt_from_stt=${firstAudioAt - sttDoneAt}ms`
          );
        }
        sseSend(res, { type: 'audio', idx: nextEmitIdx, base64 });
        nextEmitIdx++;
      }
    };

    const stream = runTurnStream(sessionId, trimmed);
    let result: { fullHu: string } = { fullHu: '' };
    while (true) {
      const next = await stream.next();
      if (next.done) {
        result = next.value;
        break;
      }
      const { idx, hu } = next.value;
      if (firstSentenceAt === null) {
        firstSentenceAt = Date.now();
        logger.info(
          `[tutor] sid=${sessionId} first_sentence_emitted dt_from_stt=${firstSentenceAt - sttDoneAt}ms`
        );
      }
      sseSend(res, { type: 'sentence', idx, hu });

      const p = ttsService
        .synthesize(hu)
        .then((buf) => ({ idx, base64: buf.toString('base64') }))
        .then((r) => {
          ready.set(r.idx, r.base64);
          drainAudio();
          return r;
        })
        .catch((err) => {
          logger.error(`[tutor] sid=${sessionId} tts error idx=${idx}: ${err}`);
          ready.set(idx, '');
          drainAudio();
          return { idx, base64: '' };
        });
      ttsPromises.push(p);
    }

    await Promise.all(ttsPromises);
    drainAudio();

    sseSend(res, { type: 'done', fullHu: result.fullHu });
    logger.info(
      `[tutor] sid=${sessionId} done total_dt_from_stt=${Date.now() - sttDoneAt}ms reply="${result.fullHu}"`
    );
    res.end();
    await deleteWorkflowDir(ctx);
  } catch (error) {
    logger.error(`[tutor-turn] error: ${error}`);
    if (!res.headersSent) {
      next(error);
    } else {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
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
