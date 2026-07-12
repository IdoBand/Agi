import { Canvas } from '@react-three/fiber';
import { Suspense, startTransition, useCallback, useRef, useState } from 'react';
import { Experience } from './components/Experience';
import { DEFAULT_AVATAR_ID, getAvatarProfile } from './utils/avatarProfiles';
import { useLocalStorage } from './hooks/useLocalStorage';
import { StorageKeys } from './utils/storage';
import { TutorConsoleStack } from './components/TutorConsoleStack';
import { SpeechBubbleVisualizer } from './components/SpeechBubbleVisualizer';
import { Sidebar } from './components/Sidebar';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { Message } from './types/message.types';
import { InterruptButtonState } from './types/tutor.types';
import styles from './App.module.css';

function LoadingOverlay() {
  return (
    <div className={styles['loading-overlay']}>
      <div className={styles['loading-content']}>
        <div className={`${styles['loading-spinner']} animate-spin`} />
        <div className={styles['loading-text']}>Loading avatar...</div>
      </div>
    </div>
  );
}

function SceneContent({
  currentMessage,
  onAudioEnd,
  onLoaded,
  avatarId,
}: {
  currentMessage: Message | null;
  onAudioEnd: () => void;
  onLoaded: () => void;
  avatarId: string;
}) {
  useState(() => {
    onLoaded();
  });
  return (
    <Experience
      currentMessage={currentMessage}
      onAudioEnd={onAudioEnd}
      avatarId={avatarId}
    />
  );
}

export default function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [pttAvailable, setPttAvailable] = useState(false);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [interruptState, setInterruptState] = useState<InterruptButtonState>('hidden');
  const audioEndCbRef = useRef<() => void>(() => {});
  const interruptCbRef = useRef<() => void>(() => {});

  const [storedAvatarId, setAvatarId] = useLocalStorage<string>(
    StorageKeys.avatarId,
    DEFAULT_AVATAR_ID
  );
  // Normalize stale ids at source so picker highlight + rendered model agree.
  const avatarId = getAvatarProfile(storedAvatarId).id;
  // startTransition keeps the old model visible while a not-yet-loaded model
  // suspends (Suspense fallback is null — would blank the canvas).
  const handleAvatarChange = useCallback(
    (id: string) => {
      startTransition(() => setAvatarId(id));
    },
    [setAvatarId]
  );

  const recorder = useVoiceRecorder();

  const handleMessage = useCallback((m: Message | null) => setCurrentMessage(m), []);
  const registerAudioEndCb = useCallback((cb: () => void) => {
    audioEndCbRef.current = cb;
  }, []);
  const handleAudioEnd = useCallback(() => audioEndCbRef.current(), []);
  const registerInterruptCb = useCallback((cb: () => void) => {
    interruptCbRef.current = cb;
  }, []);
  const handleInterrupt = useCallback(() => interruptCbRef.current(), []);

  return (
    <div className={styles.app}>
      <Sidebar
        recorder={recorder}
        onMessage={handleMessage}
        onAudioEndRef={registerAudioEndCb}
        onPttAvailableChange={setPttAvailable}
        onSpeakingChange={setTutorSpeaking}
        onInterruptRef={registerInterruptCb}
        onInterruptStateChange={setInterruptState}
        avatarId={avatarId}
        onAvatarChange={handleAvatarChange}
      />

      <div className={styles.stage}>
        <div className={styles.overlay} />

        <Canvas
          shadows
          camera={{ position: [0, 1.0, 1.6], fov: 38 }}
          className={styles.canvas}
        >
          <Suspense fallback={null}>
            <SceneContent
              currentMessage={currentMessage}
              onAudioEnd={handleAudioEnd}
              onLoaded={() => setIsModelLoaded(true)}
              avatarId={avatarId}
            />
          </Suspense>
        </Canvas>

        <SpeechBubbleVisualizer />

        <TutorConsoleStack
          recorder={recorder}
          pttAvailable={pttAvailable}
          speaking={tutorSpeaking}
          interruptState={interruptState}
          onInterrupt={handleInterrupt}
        />

        {!isModelLoaded && <LoadingOverlay />}
      </div>
    </div>
  );
}
