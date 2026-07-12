import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { AvatarProps } from '../types/avatar.types';
import { AVATAR_PROFILES } from '../utils/avatarProfiles';
import { lerp } from '../utils/lipsync';
import { getAudioContext } from '../utils/audioContext';
import { setSharedAnalyser } from '../utils/sharedAnalyser';

export function Avatar({
  profile,
  audio,
  playId,
  facialExpression = 'default',
  onAudioEnd,
}: AvatarProps) {
  const { modelUrl, position, scale } = profile;
  const { scene } = useGLTF(modelUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const amplitudeBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const mouthOpenRef = useRef<number>(0);
  const blinkStartRef = useRef<number>(-1);
  const nextBlinkRef = useRef<number>(0);

  // Derived lookups hoisted out of useFrame — no per-frame allocs.
  const mouthMorphSet = useMemo(
    () => new Set(profile.speech.mouthTargets.map((t) => t.morph)),
    [profile]
  );
  const browGains = useMemo(
    () => new Map(profile.speech.browTargets.map((t) => [t.morph, t.gain])),
    [profile]
  );

  // Clear shared analyser only on full unmount, so subsequent messages can reuse it.
  useEffect(() => {
    return () => {
      setSharedAnalyser(null);
    };
  }, []);

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
      setSharedAnalyser(analyser);
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
    // playId re-triggers playback when consecutive chunks are byte-identical.
  }, [audio, playId, onAudioEnd]);

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
  useFrame((state) => {
    const audioElement = audioRef.current;
    const isAudioPlaying = audioElement && !audioElement.paused;

    // Amplitude-driven mouth (RMS of the playing audio drives the open/close)
    const useAmplitudeMouth = isAudioPlaying && !!analyserRef.current;

    // Reset all visemes (skip the morphs the amplitude path manages itself)
    profile.visemes.forEach((viseme) => {
      if (useAmplitudeMouth && mouthMorphSet.has(viseme)) {
        return;
      }
      lerpMorphTarget(viseme, 0, 0.5);
    });

    // Apply facial expression
    const expressionTargets = profile.expressions[facialExpression] || {};

    // Drive the mouth from audio amplitude while playing
    if (useAmplitudeMouth) {
      const analyser = analyserRef.current!;
      const buf = amplitudeBufferRef.current!;
      analyser.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      const target = Math.min(1, rms * profile.speech.rmsGain);
      mouthOpenRef.current = lerp(mouthOpenRef.current, target, 0.35);
      profile.speech.mouthTargets.forEach((t) => {
        lerpMorphTarget(t.morph, mouthOpenRef.current * t.gain, 0.5);
      });
    } else {
      mouthOpenRef.current = lerp(mouthOpenRef.current, 0, 0.35);
      // Explicitly return speech-driven morphs to rest — independent of the
      // viseme/expression reset lists, so no subset invariant is required.
      mouthMorphSet.forEach((morph) => {
        lerpMorphTarget(morph, 0, 0.5);
      });
      browGains.forEach((_gain, morph) => {
        if (!(morph in expressionTargets)) {
          lerpMorphTarget(morph, 0, 0.1);
        }
      });
    }

    // Blink: fast close/open (morphs not in expression sets, no conflict)
    const { blink: blinkCfg } = profile;
    const t = state.clock.elapsedTime;
    if (t >= nextBlinkRef.current) {
      blinkStartRef.current = t;
      nextBlinkRef.current =
        t +
        blinkCfg.intervalMinS +
        Math.random() * (blinkCfg.intervalMaxS - blinkCfg.intervalMinS);
    }
    const sinceBlink = t - blinkStartRef.current;
    const blink =
      sinceBlink < blinkCfg.durationS
        ? Math.sin((sinceBlink / blinkCfg.durationS) * Math.PI)
        : 0;
    blinkCfg.morphs.forEach((morph) => {
      lerpMorphTarget(morph, blink, 0.8);
    });

    // Reset expression morph targets not in current expression
    // (brows follow speech emphasis; skip their reset while amplitude path owns them)
    profile.expressionMorphs.forEach((target) => {
      if (useAmplitudeMouth && browGains.has(target)) {
        return;
      }
      if (!(target in expressionTargets)) {
        lerpMorphTarget(target, 0, 0.1);
      }
    });

    // Apply expression morph targets
    Object.entries(expressionTargets).forEach(([target, value]) => {
      lerpMorphTarget(target, value, 0.1);
    });

    // Gentle brow lift tracking speech energy (expression keeps priority)
    if (useAmplitudeMouth) {
      const emphasis = mouthOpenRef.current;
      browGains.forEach((gain, target) => {
        if (!(target in expressionTargets)) {
          lerpMorphTarget(target, emphasis * gain, 0.08);
        }
      });
    }
  });

  return (
    <group position={position} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

// Preload all avatar models
Object.values(AVATAR_PROFILES).forEach((profile) => {
  useGLTF.preload(profile.modelUrl);
});
