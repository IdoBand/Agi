import { VisemeMapping, VisemeType } from '../types/avatar.types';

// Maps Preston Blair / Rhubarb viseme codes to ReadyPlayer Me morph targets
export const visemeMapping: VisemeMapping = {
  A: 'viseme_PP', // Closed lips: P, B, M
  B: 'viseme_kk', // Slightly open: K, G, S
  C: 'viseme_I',  // Wide/smile: E, I
  D: 'viseme_AA', // Open mouth: A, AI
  E: 'viseme_O',  // Round small: O
  F: 'viseme_U',  // Round large: U, OO
  G: 'viseme_FF', // Upper teeth on lip: F, V
  H: 'viseme_TH', // Tongue between teeth: TH
  X: 'viseme_PP', // Neutral/silence
};

// All viseme morph target names for resetting
export const allVisemes = [
  'viseme_PP',
  'viseme_kk',
  'viseme_I',
  'viseme_AA',
  'viseme_O',
  'viseme_U',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_E',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_sil',
];

export function getVisemeMorphTarget(viseme: VisemeType): string {
  return visemeMapping[viseme] || 'viseme_PP';
}

// Linear interpolation for smooth transitions
export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}
