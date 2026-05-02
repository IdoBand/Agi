import { Request, Response, NextFunction } from 'express';
import { translationService } from '../services/translation/google-translate.service.js';

export async function handleTranslate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { text, targetLang, sourceLang } = req.body ?? {};

  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  if (typeof targetLang !== 'string' || !targetLang.trim()) {
    res.status(400).json({ error: 'targetLang is required' });
    return;
  }

  try {
    const result = await translationService.translate({
      text,
      targetLang,
      sourceLang: typeof sourceLang === 'string' ? sourceLang : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
