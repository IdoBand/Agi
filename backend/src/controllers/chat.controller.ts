import { Request, Response, NextFunction } from 'express';
import { audioService } from '../services/audio.service.js';
import { llmService } from '../services/llm.service.js';
import { lipsyncService } from '../services/lipsync.service.js';
import { ChatMessage, ChatResponse, FacialExpression } from '../types/message.types.js';
import { ChatRequest, TextChatRequest } from '../types/request.types.js';
import { logger } from '../utils/logger.js';
import { deleteTempFile, deleteWorkflowDir, readFileAsBase64, WorkflowContext, createWorkflowContext, createWorkflowFile } from '../utils/file.utils.js';

// In-memory conversation history (for demo purposes)
// In production, use a database or session storage
const conversationHistory: ChatMessage[] = [];

/**
 * Analyze text to determine appropriate facial expression
 */
function detectExpression(text: string): FacialExpression {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('😊') || lowerText.includes('örül') || lowerText.includes('boldog') || lowerText.includes('szeret')) {
    return 'smile';
  }
  if (lowerText.includes('😢') || lowerText.includes('szomor') || lowerText.includes('sajnál')) {
    return 'sad';
  }
  if (lowerText.includes('😠') || lowerText.includes('mérges') || lowerText.includes('dühös')) {
    return 'angry';
  }
  if (lowerText.includes('😮') || lowerText.includes('meglepő') || lowerText.includes('wow')) {
    return 'surprised';
  }
  if (lowerText.includes('😜') || lowerText.includes('vicces') || lowerText.includes('haha')) {
    return 'funnyFace';
  }

  return 'smile'; // Default to friendly smile
}

/**
 * Handle voice chat: audio input → STT → LLM → TTS → Lipsync → response
 */
export async function handleVoiceChat(
  req: ChatRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const audioFile = req.file;

  if (!audioFile) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  try {
    logger.info('Processing voice chat request');

    // Create workflow context from upload middleware's workflowId
    const ctx: WorkflowContext = { workflowId: req.workflowId! };

    // Step 1: Transcribe audio to text (STT)
    const userText = await audioService.transcribe(audioFile.path, ctx);
    logger.info(`User said: ${userText}`);

    if (!userText || userText.trim() === '') {
      res.status(400).json({ error: 'Could not transcribe audio' });
      return;
    }

    // Step 2: Add to conversation history and get LLM response
    conversationHistory.push({ role: 'user', content: userText });
    const llmResponse = await llmService.chat(conversationHistory);
    conversationHistory.push({ role: 'assistant', content: llmResponse });

    // Keep conversation history manageable
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, 2);
    }

    // Save LLM response to workflow output
    await createWorkflowFile(ctx, 'output', 'response.txt', llmResponse);

    // Step 3: Synthesize response to audio (TTS)
    const audioBuffer = await audioService.synthesize(llmResponse);
    const audioPath = await audioService.saveToFile(audioBuffer, ctx);

    // Step 4: Generate lipsync data
    const lipsyncData = await lipsyncService.generateLipsync(audioPath, ctx);

    // Step 5: Prepare response
    const audioBase64 = await readFileAsBase64(audioPath);
    const expression = detectExpression(llmResponse);

    const response: ChatResponse = {
      text: llmResponse,
      audio: audioBase64,
      lipsync: lipsyncData,
      facialExpression: expression,
    };

    logger.info('Voice chat response sent');
    res.json(response);

    await deleteTempFile(audioFile.path);
    await deleteTempFile(audioPath);
    await deleteWorkflowDir(ctx);
  } catch (error) {
    if (audioFile?.path) {
      await deleteTempFile(audioFile.path);
    }
    next(error);
  }
}

/**
 * Handle text chat: text input → LLM → TTS → Lipsync → response
 */
export async function handleTextChat(
  req: TextChatRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    logger.info(`Processing text chat: ${message}`);

    // Create new workflow context for text chat
    const ctx = createWorkflowContext();

    // Step 1: Add to conversation history and get LLM response
    conversationHistory.push({ role: 'user', content: message });
    const llmResponse = await llmService.chat(conversationHistory);
    conversationHistory.push({ role: 'assistant', content: llmResponse });

    // Keep conversation history manageable
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, 2);
    }

    // Save LLM response to workflow output
    await createWorkflowFile(ctx, 'output', 'response.txt', llmResponse);

    // Step 2: Synthesize response to audio (TTS)
    const audioBuffer = await audioService.synthesize(llmResponse);
    const audioPath = await audioService.saveToFile(audioBuffer, ctx);

    // Step 3: Generate lipsync data
    const lipsyncData = await lipsyncService.generateLipsync(audioPath, ctx);

    // Step 4: Prepare response
    const audioBase64 = await readFileAsBase64(audioPath);
    const expression = detectExpression(llmResponse);

    const response: ChatResponse = {
      text: llmResponse,
      audio: audioBase64,
      lipsync: lipsyncData,
      facialExpression: expression,
    };

    logger.info('Text chat response sent');
    res.json(response);

    await deleteTempFile(audioPath);
    await deleteWorkflowDir(ctx);
  } catch (error) {
    next(error);
  }
}

/**
 * Clear conversation history
 */
export function clearHistory(_req: Request, res: Response): void {
  conversationHistory.length = 0;
  logger.info('Conversation history cleared');
  res.json({ success: true });
}
