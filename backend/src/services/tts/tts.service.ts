import fs from 'fs/promises';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from '../../config/index.js';
import { ITTSService } from '../interfaces/tts.interface.js';
import { logger } from '../../utils/logger.js';
import { createTempFile, WorkflowContext, createWorkflowFile } from '../../utils/file.utils.js';

class TTSService implements ITTSService {
  private elevenLabs: ElevenLabsClient;

  constructor() {
    this.elevenLabs = new ElevenLabsClient({
      apiKey: config.elevenLabs.apiKey,
    });
    logger.info('TTS Service initialized');
  }

  async synthesize(text: string): Promise<Buffer> {
    try {
      logger.debug(`Synthesizing text: ${text.substring(0, 50)}...`);

      const audioStream = await this.elevenLabs.textToSpeech.convert(
        config.elevenLabs.voiceId,
        {
          text,
          modelId: 'eleven_v3',
        }
      );

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }

      const audioBuffer = Buffer.concat(chunks);
      logger.debug(`Generated audio: ${audioBuffer.length} bytes`);

      return audioBuffer;
    } catch (error) {
      logger.error(`TTS error: ${error}`);
      throw new Error('Failed to synthesize speech');
    }
  }

  async saveToFile(audioBuffer: Buffer, ctx?: WorkflowContext): Promise<string> {
    const filePath = ctx
      ? await createWorkflowFile(ctx, 'output', 'audio.mp3')
      : await createTempFile('.mp3');
    await fs.writeFile(filePath, audioBuffer);
    return filePath;
  }
}

export const ttsService = new TTSService();
