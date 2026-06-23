import { FacialExpression } from './message.types';

export interface AvatarProps {
  modelUrl: string;
  audio?: string; // base64 encoded audio
  playId?: number; // changes per chunk so identical consecutive base64 re-triggers the effect
  facialExpression?: FacialExpression;
  onAudioEnd?: () => void;
  position?: [number, number, number];
  scale?: number;
}
