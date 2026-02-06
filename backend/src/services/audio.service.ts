import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
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

      // Run whisper.cpp with Hungarian language
      // Use relative path - whisper.cpp outputs relative to input path
      const relativeWavPath = path.relative(process.cwd(), wavPath);
      const command = `"${config.whisper.path}" -m "${config.whisper.modelPath}" -f "${relativeWavPath}" -l hu -t 6 -otxt`;

      logger.debug(`Running Whisper: ${command}`);
      logger.debug(`CWD: ${process.cwd()}`);
      const { stdout, stderr } = await execAsync(command, { timeout: 120000, cwd: process.cwd() });
      if (stdout) console.log('Whisper stdout:', stdout);
      if (stderr) console.log('Whisper stderr:', stderr);

      // Debug: list temp folder contents
      const tempFiles = await fs.readdir(config.paths.temp);
      console.log('Temp folder contents:', tempFiles.filter(f => f.includes('.txt')));

      // Read the transcription output (whisper.cpp appends .txt to relative path)
      const txtPath = relativeWavPath + '.txt';
      console.log('Looking for:', txtPath);
      const transcription = await fs.readFile(txtPath, 'utf-8');

      // Cleanup temp files - DISABLED FOR TESTING
      // if (wavPath !== audioPath) {
      //   await deleteTempFile(wavPath);
      // }
      // await deleteTempFile(txtPath);

      const result = transcription.trim();
      logger.debug(`Transcription: ${result}`);

      console.log('\n========================================');
      console.log('WHISPER STT RESULT:', result);
      console.log('========================================\n');

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
