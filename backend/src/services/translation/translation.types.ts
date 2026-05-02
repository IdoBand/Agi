export interface TranslateRequest {
  text: string;
  targetLang: string;
  sourceLang?: string;
}

export interface TranslateResult {
  translatedText: string;
  detectedSourceLang?: string;
}

export interface ITranslationService {
  translate(req: TranslateRequest): Promise<TranslateResult>;
}
