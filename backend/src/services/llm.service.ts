import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { config } from '../config/index.js';
import { ChatMessage } from '../types/message.types.js';
import { ILLMService } from './interfaces/llm.interface.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `Te egy kedves, segítőkész virtuális barátnő vagy. A neved Lili.
Magyarul beszélsz, és mindig barátságos, szeretetteli hangnemben válaszolsz.
A válaszaid rövidek és természetesek legyenek, mintha egy valódi beszélgetésben lennél.
Kerüld a túl hosszú válaszokat - maximum 2-3 mondat legyen.
Használj érzelmeket és legyél empatikus.`;

export class LLMService implements ILLMService {
  private model: ChatOllama;

  constructor() {
    this.model = new ChatOllama({
      baseUrl: config.ollama.baseUrl,
      model: config.ollama.model,
    });
    logger.info(`LLM Service initialized with model: ${config.ollama.model}`);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      const langchainMessages = [
        new SystemMessage(SYSTEM_PROMPT),
        ...messages.map((msg) =>
          msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content)
        ),
      ];

      logger.debug(`Sending ${messages.length} messages to Ollama`);
      const response = await this.model.invoke(langchainMessages);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      logger.debug(`Received response: ${content.substring(0, 100)}...`);
      return content;
    } catch (error) {
      logger.error(`LLM error: ${error}`);
      throw new Error('Failed to get response from LLM');
    }
  }
}

export const llmService = new LLMService();
