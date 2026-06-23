export type FacialExpression =
  | 'default'
  | 'smile'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'funnyFace'
  | 'crazy';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  audio?: string;
  facialExpression?: FacialExpression;
  playId?: number; // monotonic nonce so identical consecutive base64 still re-triggers playback
}
