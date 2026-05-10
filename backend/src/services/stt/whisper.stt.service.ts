import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../../config/index.js';
import { ISTTService } from '../interfaces/stt.interface.js';
import { logger } from '../../utils/logger.js';
import { createTempFile, deleteTempFile, WorkflowContext, createWorkflowFile } from '../../utils/file.utils.js';

const execAsync = promisify(exec);

export class WhisperSTTService implements ISTTService {
  private whisperServerProcess: ChildProcess | null = null;
  private ffmpegPath: string;

  constructor() {
    this.ffmpegPath = config.paths.ffmpeg;
    this.startWhisperServer();
    logger.info('Whisper STT Service initialized');
  }

  private startWhisperServer(): void {
    logger.info(`Starting whisper-server on port ${config.whisper.serverPort}...`);
    this.whisperServerProcess = spawn(
      config.whisper.serverPath,
      ['-m', config.whisper.modelPath, '-l', 'hu', '--port', String(config.whisper.serverPort), '--host', '127.0.0.1'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    this.whisperServerProcess.stdout?.on('data', (d: Buffer) => {
      logger.debug(`whisper-server: ${d.toString()}`);
    });

    this.whisperServerProcess.stderr?.on('data', (d: Buffer) => {
      logger.debug(`whisper-server: ${d.toString()}`);
    });

    this.whisperServerProcess.on('exit', (code) => {
      logger.warn(`Whisper server exited with code ${code}`);
      this.whisperServerProcess = null;
    });
  }

  private async waitForWhisperServer(timeoutMs = 90000): Promise<void> {
    const url = `http://127.0.0.1:${config.whisper.serverPort}/health`;
    const start = Date.now();
    while (true) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Whisper server did not become ready in time');
      }
      try {
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json() as { status: string };
          if (json.status === 'ok') {
            logger.info('Whisper server ready');
            return;
          }
        }
      } catch {
        // server not up yet
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  private async convertToWav(inputPath: string, ctx?: WorkflowContext): Promise<string> {
    if (inputPath.endsWith('.wav')) {
      return inputPath;
    }

    const outputPath = ctx
      ? await createWorkflowFile(ctx, 'input', 'converted.wav')
      : await createTempFile('.wav');

    try {
      const command = `"${this.ffmpegPath}" -i "${inputPath}" -ar 16000 -ac 1 -y "${outputPath}"`;
      await execAsync(command);
      return outputPath;
    } catch (error) {
      logger.error(`Audio conversion error: ${error}`);
      throw new Error('Failed to convert audio format');
    }
  }

  async transcribe(audioPath: string, ctx?: WorkflowContext, prompt?: string): Promise<string> {
    try {
      const wavPath = await this.convertToWav(audioPath, ctx);

      await this.waitForWhisperServer();

      const fileBuffer = await fs.readFile(wavPath);
      const blob = new Blob([fileBuffer], { type: 'audio/wav' });
      const form = new FormData();
      form.append('file', blob, path.basename(wavPath));
      form.append('language', 'hu');
      form.append('response_format', 'json');
      if (config.stt.temperature >= 0) form.append('temperature', String(config.stt.temperature));
      if (config.stt.temperatureInc >= 0) form.append('temperature_inc', String(config.stt.temperatureInc));
      if (prompt) form.append('initial_prompt', prompt);

      logger.debug(`Sending audio to whisper-server at port ${config.whisper.serverPort}`);
      const response = await fetch(`http://127.0.0.1:${config.whisper.serverPort}/inference`, {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        throw new Error(`Whisper server returned ${response.status}: ${await response.text()}`);
      }

      const json = await response.json() as { text: string };
      const result = json.text.trim();

      if (ctx) {
        const destPath = await createWorkflowFile(ctx, 'input', 'transcript.txt');
        await fs.writeFile(destPath, result);
      }

      if (wavPath !== audioPath) {
        await deleteTempFile(wavPath);
      }

      logger.info(`WHISPER STT RESULT: ${result}`);
      return result;
    } catch (error) {
      logger.error(`Transcription error: ${error}`);
      throw new Error('Failed to transcribe audio');
    }
  }
}
