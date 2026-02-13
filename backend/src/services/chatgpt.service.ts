import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { config } from '../config/index.js';
import { ChatMessage } from '../types/message.types.js';
import { ILLMService } from './interfaces/llm.interface.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `Te egy kedves, segítőkész virtuális barátnő vagy. A neved Agi.
Magyarul beszélsz, és mindig barátságos, szeretetteli hangnemben válaszolsz.
A válaszaid rövidek és természetesek legyenek, mintha egy valódi beszélgetésben lennél.
Kerüld a túl hosszú válaszokat - maximum 2-3 mondat legyen.
Használj érzelmeket és legyél empatikus.`;

export class ChatGPTService implements ILLMService {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      modelName: config.openai.model,
      openAIApiKey: config.openai.apiKey,
    });
    logger.info(`ChatGPT Service initialized with model: ${config.openai.model}`);
  }

  async chat(messages: ChatMessage[], _systemPrompt?: string): Promise<string> {
    try {
      const langchainMessages = [
        new SystemMessage(_systemPrompt ?? SYSTEM_PROMPT),
        ...messages.map((msg) =>
          msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content)
        ),
      ];

      logger.debug(`Sending ${messages.length} messages to ChatGPT`);
      const response = await this.model.invoke(langchainMessages);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      logger.debug(`Received response: ${content.substring(0, 100)}...`);
      logger.info(`CHATGPT RESPONSE: ${content}`);

      return content;
    } catch (error) {
      logger.error(`ChatGPT error: ${error}`);
      throw new Error('Failed to get response from ChatGPT');
    }
  }

  async chatWithSchema<T extends z.ZodObject>(messages: ChatMessage[], systemPrompt: string, schema: T): Promise<z.infer<T>> {
    try {
      const langchainMessages = [
        new SystemMessage(systemPrompt),
        ...messages.map((msg) =>
          msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content)
        ),
      ];

      const structuredModel = this.model.withStructuredOutput(schema);

      logger.debug(`Sending ${messages.length} messages to ChatGPT (structured)`);
      const result = await structuredModel.invoke(langchainMessages);

      return result as z.infer<T>;
    } catch (error) {
      logger.error(`ChatGPT structured output error: ${error}`);
      throw new Error('Failed to get structured response from ChatGPT');
    }
  }
}

export const chatgptService = new ChatGPTService();
