import { AvatarProfile } from '../types/avatar.types';

export const AVATAR_PROFILES: Record<string, AvatarProfile> = {
  'rocketbox-female': {
    id: 'rocketbox-female',
    label: 'Rocketbox Female',
    modelUrl: '/models/female_adult_01.glb',
    position: [0, -1.5, 0],
    scale: 1.5,
    mouthGain: 0.55,
    mouthOGain: 0.25,
  },
  rpm: {
    id: 'rpm',
    label: 'Ready Player Me',
    modelUrl: '/models/avatar.glb',
    position: [0, -1.5, 0],
    scale: 1.5,
    // Untuned guess — never seen with working viseme_aa; tune when picker lands.
    mouthGain: 0.85,
    mouthOGain: 0.3,
  },
};

export const DEFAULT_AVATAR_ID = 'rocketbox-female';
