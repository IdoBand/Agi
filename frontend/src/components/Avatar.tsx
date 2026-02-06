import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { AvatarProps } from '../types/avatar.types';
import { MouthCue } from '../types/message.types';
import { visemeMapping, allVisemes, lerp } from '../utils/lipsync';
import {
  facialExpressions,
  allExpressionMorphTargets,
} from '../utils/facialExpressions';

export function Avatar({
  modelUrl,
  audio,
  lipsync,
  facialExpression = 'default',
  onAudioEnd,
  position = [0, -1.5, 0],
  scale = 1,
}: AvatarProps) {
  const { scene } = useGLTF(modelUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element and handle playback
  useEffect(() => {
    if (!audio) {
      return;
    }

    // Create audio from base64
    const audioData = `data:audio/mp3;base64,${audio}`;
    const audioElement = new Audio(audioData);
    audioRef.current = audioElement;

    audioElement.onended = () => {
      onAudioEnd?.();
    };

    audioElement.play().catch((err) => {
      console.error('Audio playback error:', err);
      onAudioEnd?.();
    });

    return () => {
      audioElement.pause();
      audioElement.src = '';
    };
  }, [audio, onAudioEnd]);

  // Get current viseme based on audio time
  const getCurrentViseme = useMemo(() => {
    if (!lipsync?.mouthCues?.length) {
      return () => 'X';
    }

    return (currentTime: number): string => {
      const cue = lipsync.mouthCues.find(
        (c: MouthCue) => currentTime >= c.start && currentTime < c.end
      );
      return cue?.value || 'X';
    };
  }, [lipsync]);

  // Smooth morph target transitions - applies to ALL meshes with morph targets
  const lerpMorphTarget = (target: string, value: number, speed: number) => {
    scene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary[target];
        if (index !== undefined && child.morphTargetInfluences) {
          child.morphTargetInfluences[index] = lerp(
            child.morphTargetInfluences[index],
            value,
            speed
          );
        }
      }
    });
  };

  // Animation frame
  useFrame(() => {
    const audioElement = audioRef.current;
    const currentTime = audioElement?.currentTime || 0;
    const isAudioPlaying = audioElement && !audioElement.paused;

    // Reset all visemes
    allVisemes.forEach((viseme) => {
      lerpMorphTarget(viseme, 0, 0.5);
    });

    // Apply current viseme if audio is playing
    if (isAudioPlaying && lipsync) {
      const viseme = getCurrentViseme(currentTime);
      const morphTarget = visemeMapping[viseme] || 'viseme_PP';
      lerpMorphTarget(morphTarget, 1, 0.5);
    }

    // Apply facial expression
    const expressionTargets = facialExpressions[facialExpression] || {};

    // Reset expression morph targets not in current expression
    allExpressionMorphTargets.forEach((target) => {
      if (!(target in expressionTargets)) {
        lerpMorphTarget(target, 0, 0.1);
      }
    });

    // Apply expression morph targets
    Object.entries(expressionTargets).forEach(([target, value]) => {
      lerpMorphTarget(target, value as number, 0.1);
    });
  });

  return (
    <group position={position} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/avatar.glb');
