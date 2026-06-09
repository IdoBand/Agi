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
}
