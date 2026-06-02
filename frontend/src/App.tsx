import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useRef, useState } from 'react';
import { Experience } from './components/Experience';
import { MediaConsole } from './components/MediaConsole';
import { SpeechBubbleVisualizer } from './components/SpeechBubbleVisualizer';
import { Sidebar } from './components/Sidebar';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { Message } from './types/message.types';
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
}: {
  currentMessage: Message | null;
  onAudioEnd: () => void;
  onLoaded: () => void;
}) {
  useState(() => {
    onLoaded();
  });
  return <Experience currentMessage={currentMessage} onAudioEnd={onAudioEnd} />;
}

export default function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [pttAvailable, setPttAvailable] = useState(false);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const audioEndCbRef = useRef<() => void>(() => {});

  const recorder = useVoiceRecorder();

  const handleMessage = useCallback((m: Message | null) => setCurrentMessage(m), []);
  const registerAudioEndCb = useCallback((cb: () => void) => {
    audioEndCbRef.current = cb;
  }, []);
  const handleAudioEnd = useCallback(() => audioEndCbRef.current(), []);

  return (
    <div className={styles.app}>
      <Sidebar
        recorder={recorder}
        onMessage={handleMessage}
        onAudioEndRef={registerAudioEndCb}
        onPttAvailableChange={setPttAvailable}
        onSpeakingChange={setTutorSpeaking}
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
            />
          </Suspense>
        </Canvas>

        <SpeechBubbleVisualizer />

        <MediaConsole recorder={recorder} pttAvailable={pttAvailable} speaking={tutorSpeaking} />

        {!isModelLoaded && <LoadingOverlay />}
      </div>
    </div>
  );
}
