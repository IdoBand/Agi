import { useState, useEffect } from 'react';
import { QuizPhase, QuizEvaluateResponse } from '../types/quiz.types';

function EvaluationTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startTime) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return <span className="font-mono text-gray-400">{minutes}:{seconds.toString().padStart(2, '0')}</span>;
}

interface QuizControlPanelProps {
  phase: QuizPhase;
  isRecording: boolean;
  currentIndex: number;
  totalQuestions: number;
  result: QuizEvaluateResponse | null;
  score: number;
  currentQuestionText: string;
  currentEnglishTranslation: string;
  micSelected: boolean;
  isAudioPlaying: boolean;
  hasRecordedAnswer: boolean;
  evaluationStartTime: number | null;
  onStartQuiz: () => void;
  onSendAnswer: () => void;
  onNextQuestion: () => void;
  onReplayQuestion: () => void;
  onPlayRecordedAnswer: () => void;
}

export function QuizControlPanel({
  phase,
  isRecording,
  currentIndex,
  totalQuestions,
  result,
  score,
  currentQuestionText,
  currentEnglishTranslation,
  micSelected,
  isAudioPlaying,
  hasRecordedAnswer,
  evaluationStartTime,
  onStartQuiz,
  onSendAnswer,
  onNextQuestion,
  onReplayQuestion,
  onPlayRecordedAnswer,
}: QuizControlPanelProps) {
  const [showQuestionText, setShowQuestionText] = useState(false);
  const isLastQuestion = currentIndex >= totalQuestions - 1;

  const showTextToggle = phase === 'asking' || phase === 'listening' || phase === 'recorded' || phase === 'evaluating';

  // Questions answered so far (currentIndex during active question, currentIndex after result)
  const questionsAnswered = currentIndex + 1;
  const scoreLabel = `${score}/${questionsAnswered}`;

  // Idle: standalone centered button, no panel
  if (phase === 'idle') {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <button
          onClick={onStartQuiz}
          disabled={!micSelected}
          className={`px-8 py-3 rounded-full shadow-lg text-lg font-medium transition-colors ${
            micSelected
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Start Quiz
        </button>
        {!micSelected && (
          <span className="text-yellow-400 text-sm">Select a microphone first</span>
        )}
      </div>
    );
  }

  // All other phases: bottom panel
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 px-6 py-4">
      {/* Top row: score ratio + text toggle */}
      <div className="flex items-center justify-between mb-3">
        {totalQuestions > 0 ? (
          <span className="text-gray-300 text-sm font-medium">{scoreLabel}</span>
        ) : (
          <div />
        )}
        {showTextToggle && (
          <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showQuestionText}
              onChange={(e) => setShowQuestionText(e.target.checked)}
              className="accent-blue-500"
            />
            Show question
          </label>
        )}
      </div>

      {/* Question text (conditional) */}
      {showTextToggle && showQuestionText && currentQuestionText && (
        <div className="text-gray-300 text-sm mb-3 px-1 transition-opacity duration-200">
          {currentQuestionText}
        </div>
      )}

      {/* Phase-specific controls with fade */}
      <div key={phase} className="animate-fadeIn">
        {phase === 'loading' && (
          <div className="flex items-center justify-center gap-3 text-white">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Loading quiz...</span>
          </div>
        )}

        {phase === 'asking' && (
          <div className="flex items-center justify-center gap-3 text-white">
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="font-medium">Question {currentIndex + 1}/{totalQuestions}</span>
          </div>
        )}

        {phase === 'listening' && (
          <div className="flex flex-col items-center gap-2">
            {isRecording ? (
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                <span className="font-medium">Recording... Release T to stop</span>
              </div>
            ) : (
              <>
                <span className="text-gray-300 font-medium">Hold T to record your answer</span>
                <button
                  onClick={onReplayQuestion}
                  disabled={isAudioPlaying}
                  className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
                    isAudioPlaying
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  Replay Question
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'recorded' && (
          <div className="flex flex-col items-center gap-2">
            {isRecording ? (
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                <span className="font-medium">Re-recording... Release T to stop</span>
              </div>
            ) : (
              <>
                <button
                  onClick={onSendAnswer}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-full font-medium transition-colors"
                >
                  Send Answer
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onReplayQuestion}
                    disabled={isAudioPlaying}
                    className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
                      isAudioPlaying
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    Replay Question
                  </button>
                  <button
                    onClick={onPlayRecordedAnswer}
                    disabled={isAudioPlaying || !hasRecordedAnswer}
                    className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
                      isAudioPlaying || !hasRecordedAnswer
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    Play Answer
                  </button>
                </div>
                <span className="text-gray-500 text-xs">or hold T to re-record</span>
              </>
            )}
          </div>
        )}

        {phase === 'evaluating' && (
          <div className="flex items-center justify-center gap-3 text-white">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Evaluating...</span>
            {evaluationStartTime != null && <EvaluationTimer startTime={evaluationStartTime} />}
          </div>
        )}

        {phase === 'result' && result && (
          <div className="flex flex-col items-center gap-3">
            <div className={`${result.correct ? 'bg-green-600/20 border-green-600' : 'bg-red-600/20 border-red-600'} border rounded-xl px-5 py-3 max-w-md w-full`}>
              <div className={`font-bold text-lg mb-1 ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
                {result.correct ? 'Correct!' : 'Incorrect'}
              </div>
              {result.userTranscript && (
                <div className="text-gray-400 text-sm mb-1">You said: &quot;{result.userTranscript}&quot;</div>
              )}
              <div className="text-gray-300 text-sm">{result.explanation}</div>
              {currentEnglishTranslation && (
                <div className="text-gray-400 text-xs mt-2 italic border-t border-gray-600 pt-2">
                  Translation: {currentEnglishTranslation}
                </div>
              )}
            </div>
            <button
              onClick={onNextQuestion}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-full font-medium transition-colors"
            >
              {isLastQuestion ? 'Finish' : 'Next Question'}
            </button>
          </div>
        )}

        {phase === 'finished' && (
          <div className="text-center">
            <div className="text-white text-2xl font-bold mb-1">Quiz Complete!</div>
            <div className="text-gray-300 text-lg">{score}/{totalQuestions}</div>
          </div>
        )}
      </div>
    </div>
  );
}
