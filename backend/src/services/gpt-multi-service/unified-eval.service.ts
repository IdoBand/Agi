import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { WorkflowContext, createWorkflowFile, createTempFile, deleteTempFile } from '../../utils/file.utils.js';
import { QuizEvaluateResponse } from '../../types/quiz.types.js';

const execAsync = promisify(exec);
const openai = new OpenAI({ apiKey: config.openai.apiKey });

const UnifiedEvalSchema = z.object({
  transcript: z.string(),
  correct: z.boolean(),
  explanation: z.string(),
});

async function convertToMp3(inputPath: string, ctx?: WorkflowContext): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.mp3') return inputPath;

  const outputPath = ctx
    ? await createWorkflowFile(ctx, 'input', 'converted.mp3')
    : await createTempFile('.mp3');

  try {
    const command = `"${config.paths.ffmpeg}" -i "${inputPath}" -ar 16000 -ac 1 -y "${outputPath}"`;
    await execAsync(command);
    logger.debug(`[unified-eval] converted ${ext} → mp3`);
    return outputPath;
  } catch (error) {
    logger.error(`[unified-eval] ffmpeg conversion error: ${error}`);
    throw new Error('Failed to convert audio to mp3');
  }
}

const SYSTEM_PROMPT = `Te egy kvíz értékelő asszisztens vagy. Két feladatod van:
1. Írd át a felhasználó hangüzenetét szöveggé (magyar nyelv).
2. Értékeld, hogy a válasz helyes-e.

FONTOS — Átírás (transcript):
- A "transcript" mezőbe KIZÁRÓLAG azt írd, amit a felhasználó TÉNYLEGESEN mondott a hangfelvételen.
- NE keverd össze a helyes választ azzal, amit a felhasználó mondott.
- NE módosítsd, egészítsd ki, vagy javítsd a felhasználó szavait a helyes válasz alapján.
- Ha a felhasználó csak egy szót mondott, akkor a transcript is csak egy szó legyen.

Értékelés (correct):
- Kapni fogsz egy helyes választ referenciaként. Hasonlítsd össze a felhasználó ÁTÍRT válaszát ezzel.
- Rövid válaszok (akár egyetlen szó) teljesen elfogadhatók, ha a jelentés stimmel.
- A beszédfelismerés gyakran kisebb helyesírási hibákat ejt — ezeket ignoráld.
- A kis- és nagybetűk közötti különbséget ignoráld (pl. "focizni" = "Focizni").
- Csak azt vizsgáld, hogy a válasz JELENTÉSE megegyezik-e a helyes válasszal, vagy közel áll hozzá.
- NE büntesd a választ a rövidsége vagy részletessége miatt.

NE használj <think> tageket vagy bármilyen gondolkodási blokkot. CSAK a JSON-t add vissza, semmi mást.

Válaszolj PONTOSAN ebben a JSON formátumban:
{"transcript": "what the user said", "correct": true/false, "explanation": "short explanation in English"}`;

export async function transcribeAndEvaluate(
  audioPath: string,
  questionText: string,
  correctAnswer: string,
  ctx?: WorkflowContext
): Promise<QuizEvaluateResponse> {
  const mp3Path = await convertToMp3(audioPath, ctx);
  const needsCleanup = mp3Path !== audioPath;

  try {
    const audioData = fs.readFileSync(mp3Path);
    const base64Audio = audioData.toString('base64');

    const fileSizeKB = (audioData.length / 1024).toFixed(1);
    logger.debug(`[unified-eval] format=mp3 size=${fileSizeKB}KB audioPath=${audioPath}`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini-audio-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Kérdés: ${questionText}\nHelyes válasz: ${correctAnswer}`,
            },
            {
              type: 'input_audio',
              input_audio: { data: base64Audio, format: 'mp3' },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0].message.content;
    if (!raw) throw new Error('Empty response from unified eval');

    logger.debug(`[unified-eval] raw response: ${raw}`);

    const cleaned = raw.replace(/```(?:json)?\s*/g, '').trim();

    let parsed;
    try {
      parsed = UnifiedEvalSchema.parse(JSON.parse(cleaned));
    } catch (parseError) {
      logger.error(`[unified-eval] JSON parse failed. Raw content: "${raw}"`);
      throw parseError;
    }

    if (ctx) {
      const destPath = await createWorkflowFile(ctx, 'input', 'transcript.txt');
      await fsPromises.writeFile(destPath, parsed.transcript);
    }

    logger.info(`[unified-eval] transcript="${parsed.transcript}" correct=${parsed.correct}`);

    return {
      correct: parsed.correct,
      explanation: parsed.explanation,
      userTranscript: parsed.transcript,
    };
  } catch (error) {
    logger.error('[unified-eval] transcribeAndEvaluate error:', error);
    throw error;
  } finally {
    if (needsCleanup) await deleteTempFile(mp3Path);
  }
}
