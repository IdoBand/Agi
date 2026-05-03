import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { AvatarProps } from '../types/avatar.types';
import { MouthCue } from '../types/message.types';
import { visemeMapping, allVisemes, lerp } from '../utils/lipsync';
import { getAudioContext } from '../utils/audioContext';
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const amplitudeBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const mouthOpenRef = useRef<number>(0);

  // Create audio element and handle playback
  useEffect(() => {
    if (!audio) {
      return;
    }

    // Create audio from base64
    const audioData = `data:audio/mp3;base64,${audio}`;
    const audioElement = new Audio(audioData);
    audioRef.current = audioElement;

    // Set up WebAudio analyser for amplitude-driven mouth animation. The
    // AudioContext is a process-wide singleton resumed on the user gesture
    // (T-key press) so audio is not silenced here by autoplay policy.
    const audioContext = getAudioContext();
    audioContextRef.current = audioContext;

    let analyser = analyserRef.current;
    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      analyser.connect(audioContext.destination);
      analyserRef.current = analyser;
      amplitudeBufferRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    }

    const sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(analyser);
    sourceNodeRef.current = sourceNode;

    audioElement.onended = () => {
      onAudioEnd?.();
    };

    const startPlayback = async () => {
      try {
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        await audioElement.play();
      } catch (err) {
        console.error('Audio playback error:', err);
        onAudioEnd?.();
      }
    };
    startPlayback();

    return () => {
      audioElement.pause();
      audioElement.src = '';
      try {
        sourceNode.disconnect();
      } catch {
        // already disconnected
      }
      sourceNodeRef.current = null;
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

    // Amplitude-driven mouth (used when no lipsync cues are provided, e.g. streaming path)
    const useAmplitudeMouth = isAudioPlaying && !lipsync && !!analyserRef.current;
    const amplitudeVisemes = new Set<string>(['viseme_AA', 'viseme_O']);

    // Reset all visemes (skip the two AA/O drive amplitude path manages itself)
    allVisemes.forEach((viseme) => {
      if (useAmplitudeMouth && amplitudeVisemes.has(viseme)) {
        return;
      }
      lerpMorphTarget(viseme, 0, 0.5);
    });

    // Apply current viseme if audio is playing
    if (isAudioPlaying && lipsync) {
      const viseme = getCurrentViseme(currentTime);
      const morphTarget = visemeMapping[viseme] || 'viseme_PP';
      lerpMorphTarget(morphTarget, 1, 0.5);
    } else if (useAmplitudeMouth) {
      const analyser = analyserRef.current!;
      const buf = amplitudeBufferRef.current!;
      analyser.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      const target = Math.min(1, rms * 4);
      mouthOpenRef.current = lerp(mouthOpenRef.current, target, 0.35);
      lerpMorphTarget('viseme_AA', mouthOpenRef.current, 0.5);
      lerpMorphTarget('viseme_O', mouthOpenRef.current * 0.3, 0.5);
    } else {
      mouthOpenRef.current = lerp(mouthOpenRef.current, 0, 0.35);
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
