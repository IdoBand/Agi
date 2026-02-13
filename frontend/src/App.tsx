import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { Experience } from './components/Experience';
import { QuizControlPanel } from './components/QuizControlPanel';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { useQuiz } from './hooks/useQuiz';

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
  currentMessage: ReturnType<typeof useQuiz>['currentMessage'];
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

  const {
    isRecording,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    startRecording,
    stopRecording,
  } = useVoiceRecorder();

  const quiz = useQuiz({ isRecording, selectedDeviceId, startRecording, stopRecording });

  return (
    <div className="w-full h-screen bg-gray-900 relative">
      <Canvas
        shadows
        camera={{ position: [0, 1.0, 1.6], fov: 38 }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <SceneContent
            currentMessage={quiz.currentMessage}
            onAudioEnd={quiz.onQuestionAudioEnd}
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
      </div>

      <QuizControlPanel
        phase={quiz.phase}
        isRecording={quiz.isRecording}
        currentIndex={quiz.currentIndex}
        totalQuestions={quiz.totalQuestions}
        result={quiz.result}
        score={quiz.score}
        currentQuestionText={quiz.currentQuestionText}
        micSelected={!!selectedDeviceId}
        onStartQuiz={quiz.startQuiz}
        onSendAnswer={quiz.sendAnswer}
        onNextQuestion={quiz.nextQuestion}
      />

      {!isModelLoaded && <LoadingOverlay />}
    </div>
  );
}
