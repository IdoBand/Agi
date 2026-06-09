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

// Linear interpolation for smooth transitions
export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}
