import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useRef, useState } from 'react';
import { Experience } from './components/Experience';
import { QuizMode } from './components/QuizMode';
import { TutorChatMode } from './components/TutorChatMode';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { Message } from './types/message.types';

type Mode = 'quiz' | 'tutor';

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="text-white text-xl">Loading avatar...</div>
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
  const [mode, setMode] = useState<Mode>('quiz');
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const audioEndCbRef = useRef<() => void>(() => {});

  const recorder = useVoiceRecorder();

  const handleMessage = useCallback((m: Message | null) => setCurrentMessage(m), []);
  const registerAudioEndCb = useCallback((cb: () => void) => {
    audioEndCbRef.current = cb;
  }, []);
  const handleAudioEnd = useCallback(() => audioEndCbRef.current(), []);

  return (
    <div className="w-full h-screen flex bg-black">
      <aside
        className="w-1/4 h-full border-r border-gray-700 flex flex-col gap-4 p-4 overflow-y-auto z-20"
        style={{
          background:
            'linear-gradient(to bottom, #02152b 0%, #062a4a 25%, #1f4f7a 55%, #5f7fa0 75%, #c3b0b6 100%)',
        }}
      >
        <div className="flex gap-2">
          <button
            onClick={() => setMode('quiz')}
            className={`flex-1 px-3 py-1.5 rounded text-sm font-medium ${
              mode === 'quiz' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Quiz
          </button>
          <button
            onClick={() => setMode('tutor')}
            className={`flex-1 px-3 py-1.5 rounded text-sm font-medium ${
              mode === 'tutor' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            Tutor
          </button>
        </div>

        <select
          value={recorder.selectedDeviceId || ''}
          onChange={(e) => recorder.setSelectedDeviceId(e.target.value)}
          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="" disabled>Select microphone</option>
          {recorder.devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>

        {mode === 'quiz' && (
          <QuizMode recorder={recorder} onMessage={handleMessage} onAudioEndRef={registerAudioEndCb} />
        )}
        {mode === 'tutor' && (
          <TutorChatMode recorder={recorder} onMessage={handleMessage} onAudioEndRef={registerAudioEndCb} />
        )}
      </aside>

      <div className="flex-1 h-full relative bg-black">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, rgba(255,255,255,0) 55%, rgba(255,255,255,0.7) 100%)',
            zIndex: 0,
          }}
        />

        <Canvas
          shadows
          camera={{ position: [0, 1.0, 1.6], fov: 38 }}
          className="w-full h-full relative"
          style={{ zIndex: 1 }}
        >
          <Suspense fallback={null}>
            <SceneContent
              currentMessage={currentMessage}
              onAudioEnd={handleAudioEnd}
              onLoaded={() => setIsModelLoaded(true)}
            />
          </Suspense>
        </Canvas>

        {!isModelLoaded && <LoadingOverlay />}
      </div>
    </div>
  );
}
