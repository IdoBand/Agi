import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { Experience } from './components/Experience';
import { PushToTalk } from './components/PushToTalk';
import { QuizControlPanel } from './components/QuizControlPanel';
import { useChat } from './hooks/useChat';
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
  const quiz = useQuiz();
  const isQuizActive = quiz.phase !== 'idle';
  const chat = useChat(isQuizActive);

  // Quiz controls currentMessage and onAudioEnd when active
  const currentMessage = isQuizActive ? quiz.currentMessage : chat.currentMessage;
  const onAudioEnd = isQuizActive ? quiz.onQuestionAudioEnd : chat.onAudioEnd;

  // Use quiz device selection when quiz active, else chat's
  const devices = isQuizActive ? quiz.devices : chat.devices;
  const selectedDeviceId = isQuizActive ? quiz.selectedDeviceId : chat.selectedDeviceId;
  const setSelectedDeviceId = isQuizActive ? quiz.setSelectedDeviceId : chat.setSelectedDeviceId;

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
      </div>

      {/* Quiz UI or Chat UI */}
      {isQuizActive ? (
        <QuizControlPanel
          phase={quiz.phase}
          isRecording={quiz.isRecording}
          currentIndex={quiz.currentIndex}
          totalQuestions={quiz.totalQuestions}
          result={quiz.result}
          score={quiz.score}
          onStartQuiz={quiz.startQuiz}
          onSendAnswer={quiz.sendAnswer}
          onNextQuestion={quiz.nextQuestion}
        />
      ) : (
        <>
          <PushToTalk
            isRecording={chat.isRecording}
            isLoading={chat.isLoading}
            isPlaying={chat.isPlaying}
            error={chat.error}
            micSelected={!!chat.selectedDeviceId}
          />
          {/* Start Quiz button */}
          {selectedDeviceId && (
            <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-10">
              <button
                onClick={quiz.startQuiz}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full shadow-lg font-medium transition-colors"
              >
                Start Quiz
              </button>
            </div>
          )}
        </>
      )}

      {!isModelLoaded && <LoadingOverlay />}
    </div>
  );
}
