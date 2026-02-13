import { z } from 'zod';
import { ChatMessage } from '../../types/message.types.js';

export interface ILLMService {
  chat(messages: ChatMessage[], systemPrompt?: string): Promise<string>;
  chatWithSchema<T extends z.ZodObject>(messages: ChatMessage[], systemPrompt: string, schema: T): Promise<z.infer<T>>;
}
