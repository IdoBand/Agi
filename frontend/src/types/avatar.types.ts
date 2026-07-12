import { FacialExpression } from './message.types';
import { ExpressionMorphTargets } from '../utils/facialExpressions';

// A morph target plus a 0-1 multiplier applied to the driving signal.
export interface MorphDrive {
  morph: string;
  gain: number;
}

export interface SpeechConfig {
  mouthTargets: MorphDrive[]; // amplitude-driven mouth morphs
  browTargets: MorphDrive[]; // speech-emphasis brow lift
  rmsGain: number; // rms -> openness multiplier
}

export interface BlinkConfig {
  morphs: string[];
  intervalMinS: number;
  intervalMaxS: number;
  durationS: number;
}

// Fully describes an avatar: model path + all model-specific animation
// config. Morph names are model-specific — casing matters; an unmatched
// morph is a silent no-op (the viseme_aa bug).
export interface AvatarProfile {
  id: string;
  label: string;
  modelUrl: string;
  position: [number, number, number];
  scale: number;
  visemes: string[]; // full per-model viseme list (reset loop)
  speech: SpeechConfig;
  blink: BlinkConfig;
  expressions: Record<FacialExpression, ExpressionMorphTargets>;
  expressionMorphs: string[]; // reset list
}

export interface AvatarProps {
  profile: AvatarProfile;
  audio?: string; // base64 encoded audio
  playId?: number; // changes per chunk so identical consecutive base64 re-triggers the effect
  facialExpression?: FacialExpression;
  onAudioEnd?: () => void;
}
