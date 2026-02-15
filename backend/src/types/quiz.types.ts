import { LipsyncData, FacialExpression } from './message.types.js';

export interface Question {
  id: string;
  question: string;
  answer: string;
  englishTranslation: string;
}

export interface QuizQuestion {
  index: number;
  text: string;
  answer: string;
  englishTranslation: string;
  audio: string;
  lipsync: LipsyncData;
  facialExpression: FacialExpression;
}

export interface QuizStartResponse {
  questions: QuizQuestion[];
}

export interface QuizEvaluateRequest {
  audio: File;
  questionText: string;
}

export interface QuizEvaluateResponse {
  correct: boolean;
  explanation: string;
  userTranscript: string;
}
