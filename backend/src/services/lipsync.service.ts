import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { LipsyncData } from '../types/message.types.js';
import { logger } from '../utils/logger.js';
import { createTempFile, deleteTempFile, WorkflowContext, createWorkflowFile } from '../utils/file.utils.js';

const execAsync = promisify(exec);

export class LipsyncService {
  private rhubarbPath: string;
  private ffmpegPath: string;

  constructor() {
    this.rhubarbPath = config.paths.rhubarb;
    this.ffmpegPath = config.paths.ffmpeg;
    logger.info(`Lipsync Service initialized with Rhubarb at: ${this.rhubarbPath}`);
    logger.info(`Lipsync Service using FFmpeg at: ${this.ffmpegPath}`);
  }

  private async convertToWav(inputPath: string, ctx?: WorkflowContext): Promise<string> {
    const outputPath = ctx
      ? await createWorkflowFile(ctx, 'output', 'audio.wav')
      : await createTempFile('.wav');
    const command = `"${this.ffmpegPath}" -y -i "${inputPath}" "${outputPath}"`;
    logger.debug(`Converting audio to WAV: ${command}`);
    await execAsync(command);
    return outputPath;
  }

  async generateLipsync(audioPath: string, ctx?: WorkflowContext): Promise<LipsyncData> {
    const outputPath = ctx
      ? await createWorkflowFile(ctx, 'output', 'lipsync.json')
      : await createTempFile('.json');
    let wavPath: string | null = null;

    try {
      // Convert MP3 to WAV for Rhubarb (works best with WAV files)
      wavPath = await this.convertToWav(audioPath, ctx);

      // Rhubarb command: generate JSON output with extended mouth shapes
      const command = `"${this.rhubarbPath}" -f json -o "${outputPath}" "${wavPath}" -r phonetic`;

      logger.debug(`Running Rhubarb: ${command}`);
      await execAsync(command);

      // Read and parse the output
      const jsonContent = await fs.readFile(outputPath, 'utf-8');
      const rhubarbOutput = JSON.parse(jsonContent);

      logger.debug(`Generated ${rhubarbOutput.mouthCues?.length || 0} mouth cues`);

      return {
        mouthCues: rhubarbOutput.mouthCues || [],
      };
    } catch (error) {
      logger.error(`Lipsync generation error: ${error}`);
      // Return empty lipsync data on error
      return { mouthCues: [] };
    } finally {
      if (wavPath) await deleteTempFile(wavPath);
      await deleteTempFile(outputPath);
    }
  }
}

export const lipsyncService = new LipsyncService();
