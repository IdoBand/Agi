import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { Experience } from './components/Experience';
import { PushToTalk } from './components/PushToTalk';
import { useChat } from './hooks/useChat';

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
  currentMessage: ReturnType<typeof useChat>['currentMessage'];
  onAudioEnd: () => void;
  onLoaded: () => void;
}) {
  // Trigger loaded callback when component mounts
  useState(() => {
    onLoaded();
  });

  return <Experience currentMessage={currentMessage} onAudioEnd={onAudioEnd} />;
}

export default function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const {
    currentMessage,
    isRecording,
    isLoading,
    isPlaying,
    error,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    onAudioEnd,
    playTestLipsync,
  } = useChat();

  return (
    <div className="w-full h-screen bg-gray-900 relative">
      <Canvas
        shadows
        camera={{ position: [0, 0, 3], fov: 50 }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <SceneContent
            currentMessage={currentMessage}
            onAudioEnd={onAudioEnd}
            onLoaded={() => setIsModelLoaded(true)}
          />
        </Suspense>
      </Canvas>

      {/* Microphone selector */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <select
          value={selectedDeviceId || ''}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="" disabled>Select microphone</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <button
          onClick={playTestLipsync}
          disabled={isPlaying}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg"
        >
          Test Lipsync
        </button>
      </div>

      <PushToTalk
        isRecording={isRecording}
        isLoading={isLoading}
        isPlaying={isPlaying}
        error={error}
        micSelected={!!selectedDeviceId}
      />

      {!isModelLoaded && <LoadingOverlay />}
    </div>
  );
}
