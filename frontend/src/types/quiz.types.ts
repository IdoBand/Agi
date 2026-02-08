import { FacialExpression, LipsyncData } from './message.types';

export type QuizPhase =
  | 'idle'
  | 'loading'
  | 'asking'
  | 'listening'
  | 'recorded'
  | 'evaluating'
  | 'result'
  | 'finished';

export interface QuizQuestion {
  index: number;
  text: string;
  audio: string;
  lipsync: LipsyncData;
  facialExpression: FacialExpression;
}

export interface QuizEvaluateResponse {
  correct: boolean;
  explanation: string;
  userTranscript: string;
}
