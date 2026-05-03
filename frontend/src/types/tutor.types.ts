export type TutorPhase = 'idle' | 'listening' | 'recording' | 'thinking' | 'speaking';

export type TurnEvent =
  | { type: 'transcript'; text: string }
  | { type: 'sentence'; idx: number; hu: string }
  | { type: 'audio'; idx: number; base64: string }
  | { type: 'done'; fullHu: string };

export interface TutorTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  textEn?: string;
  at: number;
}
