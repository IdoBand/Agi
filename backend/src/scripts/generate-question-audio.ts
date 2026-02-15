// DO NOT DELETE - Run commands:
// npx tsx src/scripts/generate-question-audio.ts --force
// npx tsx src/scripts/generate-question-audio.ts --limit 5 --force

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import fs from 'fs/promises';
import { audioService } from '../services/audio.service.js';
import { lipsyncService } from '../services/lipsync.service.js';
import { logger } from '../utils/logger.js';
import { Question } from '../types/quiz.types.js';

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const QUESTIONS_PATH = path.resolve(__dirname, 'tesseractjs/questions.json');
const OUTPUT_DIR = path.resolve(BACKEND_ROOT, 'assets/questionsAudio');

async function main(): Promise<void> {
  const limitArg = process.argv.find(a => a.startsWith('--limit'));
  const limitVal = process.argv[process.argv.indexOf('--limit') + 1];
  const limit = limitArg ? parseInt(limitVal, 10) : undefined;
  const force = process.argv.includes('--force');

  const raw = await fs.readFile(QUESTIONS_PATH, 'utf-8');
  const questions: Question[] = JSON.parse(raw);
  const subset = limit ? questions.slice(0, limit) : questions;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  logger.info(`Processing ${subset.length} of ${questions.length} questions`);

  for (let i = 0; i < subset.length; i++) {
    const q = subset[i];
    const mp3Path = path.join(OUTPUT_DIR, `${q.id}.mp3`);
    const jsonPath = path.join(OUTPUT_DIR, `${q.id}.json`);

    // Skip if already generated (unless --force)
    if (!force) {
      try {
        await fs.access(mp3Path);
        logger.info(`[${i + 1}/${subset.length}] Skipping "${q.question}" (already exists)`);
        continue;
      } catch {
        // file doesn't exist, proceed
      }
    }

    logger.info(`[${i + 1}/${subset.length}] Generating audio for: "${q.question}"`);

    // TTS
    const audioBuffer = await audioService.synthesize(`[calm, formal examiner tone] ${q.question}`);
    await fs.writeFile(mp3Path, audioBuffer);
    logger.info(`  Saved MP3: ${mp3Path}`);

    // Lipsync
    const lipsyncData = await lipsyncService.generateLipsync(mp3Path);
    await fs.writeFile(jsonPath, JSON.stringify(lipsyncData, null, 2));
    logger.info(`  Saved lipsync: ${jsonPath}`);
  }

  logger.info('Done');
}

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
