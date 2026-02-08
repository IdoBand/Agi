import { QuizPhase, QuizEvaluateResponse } from '../types/quiz.types';

interface QuizControlPanelProps {
  phase: QuizPhase;
  isRecording: boolean;
  currentIndex: number;
  totalQuestions: number;
  result: QuizEvaluateResponse | null;
  score: number;
  onStartQuiz: () => void;
  onSendAnswer: () => void;
  onNextQuestion: () => void;
}

export function QuizControlPanel({
  phase,
  isRecording,
  currentIndex,
  totalQuestions,
  result,
  score,
  onStartQuiz,
  onSendAnswer,
  onNextQuestion,
}: QuizControlPanelProps) {
  const isLastQuestion = currentIndex >= totalQuestions - 1;

  if (phase === 'idle') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <button
          onClick={onStartQuiz}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full shadow-lg text-lg font-medium transition-colors"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Loading quiz...</span>
        </div>
      </div>
    );
  }

  if (phase === 'asking') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="font-medium">
            Question {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
      </div>
    );
  }

  if (phase === 'listening') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div
          className={`${
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-700'
          } text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 transition-all`}
        >
          {isRecording && <div className="w-3 h-3 bg-white rounded-full animate-pulse" />}
          <span className="font-medium">
            {isRecording ? 'Recording... Release T to stop' : 'Hold T to record your answer'}
          </span>
        </div>
      </div>
    );
  }

  if (phase === 'recorded') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        {isRecording ? (
          <div className="bg-red-500 animate-pulse text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="font-medium">Re-recording... Release T to stop</span>
          </div>
        ) : (
          <>
            <button
              onClick={onSendAnswer}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full shadow-lg text-lg font-medium transition-colors"
            >
              Send Answer
            </button>
            <span className="text-gray-400 text-sm">or hold T to re-record</span>
          </>
        )}
      </div>
    );
  }

  if (phase === 'evaluating') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-yellow-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Evaluating answer...</span>
        </div>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex flex-col items-center gap-3 max-w-md">
        <div
          className={`${
            result.correct ? 'bg-green-600' : 'bg-red-600'
          } text-white px-6 py-3 rounded-2xl shadow-lg w-full`}
        >
          <div className="font-bold text-lg mb-1">
            {result.correct ? 'Correct!' : 'Incorrect'}
          </div>
          {result.userTranscript && (
            <div className="text-sm opacity-80 mb-1">You said: "{result.userTranscript}"</div>
          )}
          <div className="text-sm">{result.explanation}</div>
        </div>
        <button
          onClick={onNextQuestion}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full shadow-lg font-medium transition-colors"
        >
          {isLastQuestion ? 'Finish' : 'Next Question'}
        </button>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-gray-800 text-white px-8 py-4 rounded-2xl shadow-lg text-center">
          <div className="text-2xl font-bold mb-1">Quiz Complete!</div>
          <div className="text-lg">
            {score}/{totalQuestions} correct
          </div>
        </div>
      </div>
    );
  }

  return null;
}
