import { config } from '../../config/index.js';
import { ISTTService } from '../interfaces/stt.interface.js';
import { WhisperSTTService } from './whisper.stt.service.js';
import { OpenAISTTService } from './openai.stt.service.js';

function createSTTService(): ISTTService {
  switch (config.stt.provider) {
    case 'whisper':
      return new WhisperSTTService();
    case 'openai':
      return new OpenAISTTService();
    default: {
      const _exhaustive: never = config.stt.provider;
      throw new Error(`Unknown STT provider: ${_exhaustive}`);
    }
  }
}

export const sttService: ISTTService = createSTTService();
