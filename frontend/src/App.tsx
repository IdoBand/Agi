import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { Experience } from './components/Experience';
import { QuizControlPanel } from './components/QuizControlPanel';
import { QuizReviewCard } from './components/QuizReviewCard';
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
    <div className="w-full h-screen flex bg-black">
      <aside
        className="w-1/4 h-full border-r border-gray-700 flex flex-col gap-4 p-4 overflow-y-auto z-20"
        style={{
          background:
            'linear-gradient(to bottom, #02152b 0%, #062a4a 25%, #1f4f7a 55%, #5f7fa0 75%, #c3b0b6 100%)',
        }}
      >
        <select
          value={selectedDeviceId || ''}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="" disabled>Select microphone</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>

        {quiz.phase === 'result' && quiz.result && (
          <QuizReviewCard
            result={quiz.result}
            questionText={quiz.currentQuestionText}
            englishTranslation={quiz.currentEnglishTranslation}
            category={quiz.currentCategory}
            correctAnswer={quiz.currentCorrectAnswer}
          />
        )}

        <div className="mt-auto">
          <QuizControlPanel
            phase={quiz.phase}
            isRecording={quiz.isRecording}
            currentIndex={quiz.currentIndex}
            totalQuestions={quiz.totalQuestions}
            score={quiz.score}
            currentQuestionText={quiz.currentQuestionText}
            micSelected={!!selectedDeviceId}
            isAudioPlaying={quiz.isAudioPlaying}
            hasRecordedAnswer={quiz.hasRecordedAnswer}
            evaluationStartTime={quiz.evaluationStartTime}
            onStartQuiz={quiz.startQuiz}
            onSendAnswer={quiz.sendAnswer}
            onNextQuestion={quiz.nextQuestion}
            onReplayQuestion={quiz.replayQuestionAudio}
            onPlayRecordedAnswer={quiz.playRecordedAnswer}
          />
        </div>
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
              currentMessage={quiz.currentMessage}
              onAudioEnd={quiz.onQuestionAudioEnd}
              onLoaded={() => setIsModelLoaded(true)}
            />
          </Suspense>
        </Canvas>

        {!isModelLoaded && <LoadingOverlay />}
      </div>
    </div>
  );
}
