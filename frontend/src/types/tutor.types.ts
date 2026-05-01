import { FacialExpression, LipsyncData } from './message.types';

export type TutorPhase = 'idle' | 'listening' | 'recording' | 'thinking' | 'speaking';

export interface TutorTurnResponse {
  content: string;
  audio: string;
  lipsync: LipsyncData;
  facialExpression: FacialExpression;
  userTranscript: string;
}

export interface TutorTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}
