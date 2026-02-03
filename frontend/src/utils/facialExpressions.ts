import { FacialExpression } from '../types/message.types';

// Morph target values for each facial expression
// Values are 0-1 representing intensity
export interface ExpressionMorphTargets {
  [morphTarget: string]: number;
}

export const facialExpressions: Record<FacialExpression, ExpressionMorphTargets> = {
  default: {},

  smile: {
    mouthSmileLeft: 0.4,
    mouthSmileRight: 0.4,
    eyeSquintLeft: 0.3,
    eyeSquintRight: 0.3,
  },

  sad: {
    mouthFrownLeft: 0.5,
    mouthFrownRight: 0.5,
    browInnerUp: 0.4,
    eyeSquintLeft: 0.1,
    eyeSquintRight: 0.1,
  },

  angry: {
    browDownLeft: 0.6,
    browDownRight: 0.6,
    eyeSquintLeft: 0.4,
    eyeSquintRight: 0.4,
    jawForward: 0.2,
    mouthFrownLeft: 0.3,
    mouthFrownRight: 0.3,
  },

  surprised: {
    eyeWideLeft: 0.7,
    eyeWideRight: 0.7,
    browOuterUpLeft: 0.5,
    browOuterUpRight: 0.5,
    browInnerUp: 0.5,
    mouthOpen: 0.3,
  },

  funnyFace: {
    mouthLeft: 0.5,
    eyeSquintLeft: 0.6,
    browDownLeft: 0.3,
    cheekPuff: 0.4,
  },

  crazy: {
    eyeWideLeft: 0.8,
    eyeWideRight: 0.3,
    browOuterUpLeft: 0.6,
    browDownRight: 0.4,
    mouthSmileLeft: 0.5,
    mouthFrownRight: 0.3,
    tongueOut: 0.2,
  },
};

// All expression morph targets for resetting
export const allExpressionMorphTargets = [
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthOpen',
  'mouthLeft',
  'mouthRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'jawForward',
  'jawOpen',
  'tongueOut',
];

export function getExpressionMorphTargets(
  expression: FacialExpression
): ExpressionMorphTargets {
  return facialExpressions[expression] || facialExpressions.default;
}
