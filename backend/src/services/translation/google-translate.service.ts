import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import {
  ITranslationService,
  TranslateRequest,
  TranslateResult,
} from './translation.types.js';

interface GoogleTranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
}

class GoogleTranslateService implements ITranslationService {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor() {
    this.apiKey = config.googleTranslate.apiKey;
    this.endpoint = config.googleTranslate.endpoint;
    logger.info('Translation service initialized: Google');
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');
    }
    const body: Record<string, string> = {
      q: req.text,
      target: req.targetLang,
      format: 'text',
    };
    if (req.sourceLang) body.source = req.sourceLang;

    const url = `${this.endpoint}?key=${this.apiKey}`;
    const startedAt = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error(`Google Translate failed: ${res.status} ${errBody}`);
      throw new Error(`Google Translate failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as GoogleTranslateResponse;
    const t = data.data?.translations?.[0];
    if (!t) {
      throw new Error('Google Translate returned no translations');
    }
    logger.debug(
      `[translate] ok target=${req.targetLang} detected=${t.detectedSourceLanguage ?? req.sourceLang ?? '-'} latencyMs=${Date.now() - startedAt}`,
    );
    return {
      translatedText: t.translatedText,
      detectedSourceLang: t.detectedSourceLanguage,
    };
  }
}

export const translationService = new GoogleTranslateService();
