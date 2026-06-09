import { FacialExpression } from './message.types';

export interface AvatarProps {
  modelUrl: string;
  audio?: string; // base64 encoded audio
  facialExpression?: FacialExpression;
  onAudioEnd?: () => void;
  position?: [number, number, number];
  scale?: number;
}
