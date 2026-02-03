import { ChatMessage } from '../../types/message.types.js';

export interface ILLMService {
  chat(messages: ChatMessage[]): Promise<string>;
}
