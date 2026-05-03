import { useEffect } from 'react';
import { Message } from '../types/message.types';
import { useQuiz } from '../hooks/useQuiz';
import { QuizControlPanel } from './QuizControlPanel';
import { QuizReviewCard } from './QuizReviewCard';

interface VoiceRecorderInput {
  isRecording: boolean;
  selectedDeviceId: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

interface Props {
  recorder: VoiceRecorderInput;
  onMessage: (m: Message | null) => void;
  onAudioEndRef: (cb: () => void) => void;
  onPttAvailableChange: (v: boolean) => void;
}

export function QuizMode({ recorder, onMessage, onAudioEndRef, onPttAvailableChange }: Props) {
  const quiz = useQuiz(recorder, onPttAvailableChange);

  useEffect(() => {
    onMessage(quiz.currentMessage);
  }, [quiz.currentMessage, onMessage]);

  useEffect(() => {
    onAudioEndRef(quiz.onQuestionAudioEnd);
  }, [quiz.onQuestionAudioEnd, onAudioEndRef]);

  return (
    <>
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
          micSelected={!!recorder.selectedDeviceId}
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
    </>
  );
}
