import { AvatarProfile } from '../types/avatar.types';
import { allVisemes } from './lipsync';
import {
  facialExpressions,
  allExpressionMorphTargets,
} from './facialExpressions';

// Both current models use ARKit-style morph naming, so they share the
// default viseme/expression lists. A future non-ARKit avatar overrides
// these per-profile instead of touching the shared defaults.
export const AVATAR_PROFILES = {
  'rocketbox-female': {
    id: 'rocketbox-female',
    label: 'Rocketbox Female',
    modelUrl: '/models/female_adult_01.glb',
    position: [0, -1.5, 0],
    scale: 1.5,
    visemes: allVisemes,
    speech: {
      mouthTargets: [
        { morph: 'viseme_aa', gain: 0.55 },
        { morph: 'viseme_O', gain: 0.25 },
      ],
      browTargets: [
        { morph: 'browInnerUp', gain: 0.25 },
        { morph: 'browOuterUpLeft', gain: 0.15 },
        { morph: 'browOuterUpRight', gain: 0.15 },
      ],
      rmsGain: 4,
    },
    blink: {
      morphs: ['eyeBlinkLeft', 'eyeBlinkRight'],
      intervalMinS: 2,
      intervalMaxS: 6,
      durationS: 0.25,
    },
    expressions: facialExpressions,
    expressionMorphs: allExpressionMorphTargets,
  },
  rpm: {
    id: 'rpm',
    label: 'Ready Player Me',
    modelUrl: '/models/avatar.glb',
    position: [0, -1.5, 0],
    scale: 1.5,
    // Verify morph casing when tuned — RPM may use viseme_AA vs viseme_aa;
    // an unmatched morph is a harmless no-op.
    visemes: allVisemes,
    speech: {
      // Untuned guess — never seen with working viseme_aa; tune when picker lands.
      mouthTargets: [
        { morph: 'viseme_aa', gain: 0.85 },
        { morph: 'viseme_O', gain: 0.3 },
      ],
      browTargets: [
        { morph: 'browInnerUp', gain: 0.25 },
        { morph: 'browOuterUpLeft', gain: 0.15 },
        { morph: 'browOuterUpRight', gain: 0.15 },
      ],
      rmsGain: 4,
    },
    blink: {
      morphs: ['eyeBlinkLeft', 'eyeBlinkRight'],
      intervalMinS: 2,
      intervalMaxS: 6,
      durationS: 0.25,
    },
    expressions: facialExpressions,
    expressionMorphs: allExpressionMorphTargets,
  },
} satisfies Record<string, AvatarProfile>;

export type AvatarId = keyof typeof AVATAR_PROFILES;

export const DEFAULT_AVATAR_ID: AvatarId = 'rocketbox-female';

// Only sanctioned lookup — guards stale localStorage ids.
export function getAvatarProfile(id: string): AvatarProfile {
  const profile = (AVATAR_PROFILES as Record<string, AvatarProfile>)[id];
  return profile ? profile : AVATAR_PROFILES[DEFAULT_AVATAR_ID];
}
