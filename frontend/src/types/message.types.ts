export interface MouthCue {
  start: number;
  end: number;
  value: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X';
}

export interface LipsyncData {
  mouthCues: MouthCue[];
}

export type FacialExpression =
  | 'default'
  | 'smile'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'funnyFace'
  | 'crazy';

export interface ChatResponse {
  text: string;
  audio: string; // base64 encoded
  lipsync: LipsyncData;
  facialExpression: FacialExpression;
  animation?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  audio?: string;
  lipsync?: LipsyncData;
  facialExpression?: FacialExpression;
}
