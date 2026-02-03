import { FacialExpression, LipsyncData } from './message.types';

export interface AvatarProps {
  modelUrl: string;
  audio?: string; // base64 encoded audio
  lipsync?: LipsyncData;
  facialExpression?: FacialExpression;
  onAudioEnd?: () => void;
  position?: [number, number, number];
  scale?: number;
}

export type VisemeType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X';

export interface VisemeMapping {
  [key: string]: string;
}
