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
    logger.info('OpenAI STT Service initialized');
  }

  async transcribe(audioPath: string, ctx?: WorkflowContext, prompt?: string): Promise<string> {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: config.openai.sttModel,
        language: 'hu',
        ...(prompt ? { prompt } : {}),
      });

      const result = transcription.text.trim();

      if (ctx) {
        const destPath = await createWorkflowFile(ctx, 'input', 'transcript.txt');
        await fsPromises.writeFile(destPath, result);
      }

      logger.info(`OPENAI STT RESULT: ${result}`);
      return result;
    } catch (error) {
      logger.error(`OpenAI transcription error: ${error}`);
      throw new Error('Failed to transcribe audio via OpenAI');
    }
  }
}
