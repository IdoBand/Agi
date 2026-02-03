import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { ElevenLabsClient } from 'elevenlabs';
import { config } from '../config/index.js';
import { ISTTService } from './interfaces/stt.interface.js';
import { ITTSService } from './interfaces/tts.interface.js';
import { logger } from '../utils/logger.js';
import { createTempFile, deleteTempFile } from '../utils/file.utils.js';

const execAsync = promisify(exec);

export class AudioService implements ISTTService, ITTSService {
  private elevenLabs: ElevenLabsClient;
  private ffmpegPath: string;

  constructor() {
    this.elevenLabs = new ElevenLabsClient({
      apiKey: config.elevenLabs.apiKey,
    });
    this.ffmpegPath = config.paths.ffmpeg;
    logger.info('Audio Service initialized');
  }

  /**
   * Transcribe audio to text using Whisper CLI
   * Requires: pip install openai-whisper
   */
  async transcribe(audioPath: string): Promise<string> {
    try {
      // Convert to WAV if needed (Whisper works best with WAV)
      const wavPath = await this.convertToWav(audioPath);

      // Run Whisper CLI with Hungarian language
      const command = `whisper "${wavPath}" --model ${config.whisper.model} --language hu --output_format txt --output_dir "${config.paths.temp}"`;

      logger.debug(`Running Whisper: ${command}`);
      await execAsync(command, { timeout: 120000 }); // 2 minute timeout

      // Read the transcription output
      const txtPath = wavPath.replace('.wav', '.txt');
      const transcription = await fs.readFile(txtPath, 'utf-8');

      // Cleanup temp files - DISABLED FOR TESTING
      // if (wavPath !== audioPath) {
      //   await deleteTempFile(wavPath);
      // }
      // await deleteTempFile(txtPath);

      const result = transcription.trim();
      logger.debug(`Transcription: ${result}`);

      return result;
    } catch (error) {
      logger.error(`Transcription error: ${error}`);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Convert audio to WAV format using FFmpeg
   */
  private async convertToWav(inputPath: string): Promise<string> {
    if (inputPath.endsWith('.wav')) {
      return inputPath;
    }

    const outputPath = await createTempFile('.wav');

    try {
      const command = `"${this.ffmpegPath}" -i "${inputPath}" -ar 16000 -ac 1 -y "${outputPath}"`;
      await execAsync(command);
      return outputPath;
    } catch (error) {
      logger.error(`Audio conversion error: ${error}`);
      throw new Error('Failed to convert audio format');
    }
  }

  /**
   * Synthesize text to speech using ElevenLabs
   */
  async synthesize(text: string): Promise<Buffer> {
    try {
      logger.debug(`Synthesizing text: ${text.substring(0, 50)}...`);

      const audioStream = await this.elevenLabs.generate({
        voice: config.elevenLabs.voiceId,
        text,
        model_id: 'eleven_multilingual_v2',
      });

      // Convert stream to buffer
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

  /**
   * Save audio buffer to a temp file and return the path
   */
  async saveToFile(audioBuffer: Buffer): Promise<string> {
    const filePath = await createTempFile('.mp3');
    await fs.writeFile(filePath, audioBuffer);
    return filePath;
  }
}

export const audioService = new AudioService();
