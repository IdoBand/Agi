import fs from 'fs';
import fsPromises from 'fs/promises';
import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { ISTTService } from '../interfaces/stt.interface.js';
import { logger } from '../../utils/logger.js';
import { WorkflowContext, createWorkflowFile } from '../../utils/file.utils.js';

export class OpenAISTTService implements ISTTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    logger.info(`STT service initialized: OpenAI (model: ${config.openai.sttModel})`);
  }

  async transcribe(audioPath: string, ctx?: WorkflowContext, prompt?: string): Promise<string> {
    const startedAt = Date.now();
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: config.openai.sttModel,
        language: 'hu',
        ...(config.stt.temperature >= 0 ? { temperature: config.stt.temperature } : {}),
        ...(prompt ? { prompt } : {}),
      });

      const result = transcription.text.trim();

      if (ctx) {
        const destPath = await createWorkflowFile(ctx, 'input', 'transcript.txt');
        await fsPromises.writeFile(destPath, result);
      }

      logger.info(`OPENAI STT RESULT: ${result}`);
      logger.debug(`[stt-openai] ok latencyMs=${Date.now() - startedAt} chars=${result.length}`);
      return result;
    } catch (error) {
      logger.error(`OpenAI transcription error: ${error}`);
      throw new Error('Failed to transcribe audio via OpenAI');
    }
  }
}
