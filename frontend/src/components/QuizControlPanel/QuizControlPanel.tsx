import { useState, useEffect } from 'react';
import { QuizPhase } from '../../types/quiz.types';
import { BackButton } from '../BackButton';
import styles from './QuizControlPanel.module.css';

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
  return <span className={styles.timer}>{minutes}:{seconds.toString().padStart(2, '0')}</span>;
}

interface QuizControlPanelProps {
  phase: QuizPhase;
  isRecording: boolean;
  currentIndex: number;
  totalQuestions: number;
  score: number;
  currentQuestionText: string;
  micSelected: boolean;
  isAudioPlaying: boolean;
  hasRecordedAnswer: boolean;
  evaluationStartTime: number | null;
  onStartQuiz: () => void;
  onSendAnswer: () => void;
  onNextQuestion: () => void;
  onReplayQuestion: () => void;
  onPlayRecordedAnswer: () => void;
  onBack: () => void;
}

export function QuizControlPanel({
  phase,
  isRecording,
  currentIndex,
  totalQuestions,
  score,
  currentQuestionText,
  micSelected,
  isAudioPlaying,
  hasRecordedAnswer,
  evaluationStartTime,
  onStartQuiz,
  onSendAnswer,
  onNextQuestion,
  onReplayQuestion,
  onPlayRecordedAnswer,
  onBack,
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
      <div className={styles['idle-wrap']}>
        {!micSelected && (
          <span className={styles.warning}>Select a microphone first</span>
        )}
        <button
          onClick={onStartQuiz}
          disabled={!micSelected}
          className={styles['start-btn']}
        >
          Start Quiz
        </button>
      </div>
    );
  }

  // All other phases: bottom panel
  return (
    <div className={styles.panel}>
      {/* Header row: back to menu */}
      <div className={styles['header-row']}>
        <BackButton onClick={onBack} />
      </div>

      {/* Top row: score ratio + text toggle */}
      <div className={styles['top-row']}>
        {totalQuestions > 0 ? (
          <span className={styles.score}>{scoreLabel}</span>
        ) : (
          <div />
        )}
        {showTextToggle && (
          <label className={styles['toggle-label']}>
            <input
              type="checkbox"
              checked={showQuestionText}
              onChange={(e) => setShowQuestionText(e.target.checked)}
              className={styles.checkbox}
            />
            Show question
          </label>
        )}
      </div>

      {/* Question text (conditional) */}
      {showTextToggle && showQuestionText && currentQuestionText && (
        <div className={styles['question-text']}>
          {currentQuestionText}
        </div>
      )}

      {/* Phase-specific controls with fade */}
      <div key={phase} className="animate-fadeIn">
        {phase === 'loading' && (
          <div className={styles['status-row']}>
            <div className={`${styles.spinner} animate-spin`} />
            <span className={styles.label}>Loading quiz...</span>
          </div>
        )}

        {phase === 'asking' && (
          <div className={styles['status-row']}>
            <div className={styles.bars}>
              <div className={`${styles.bar} animate-bounce`} />
              <div className={`${styles.bar} animate-bounce`} />
              <div className={`${styles.bar} animate-bounce`} />
            </div>
            <span className={styles.label}>Question {currentIndex + 1}/{totalQuestions}</span>
          </div>
        )}

        {phase === 'listening' && (
          <div className={styles['col-center']}>
            {!isRecording && (
              <button
                onClick={onReplayQuestion}
                disabled={isAudioPlaying}
                className={styles['pill-btn']}
              >
                Replay Question
              </button>
            )}
          </div>
        )}

        {phase === 'recorded' && (
          <div className={styles['col-center']}>
            {!isRecording && (
              <>
                <button
                  onClick={onSendAnswer}
                  disabled={isAudioPlaying}
                  className={styles['send-btn']}
                >
                  Send Answer
                </button>
                <div className={styles['btn-row']}>
                  <button
                    onClick={onReplayQuestion}
                    disabled={isAudioPlaying}
                    className={styles['pill-btn']}
                  >
                    Replay Question
                  </button>
                  <button
                    onClick={onPlayRecordedAnswer}
                    disabled={isAudioPlaying || !hasRecordedAnswer}
                    className={styles['pill-btn']}
                  >
                    Play Answer
                  </button>
                </div>
                <span className={styles.hint}>or hold T to re-record</span>
              </>
            )}
          </div>
        )}

        {phase === 'evaluating' && (
          <div className={styles['status-row']}>
            <div className={`${styles.spinner} animate-spin`} />
            <span className={styles.label}>Evaluating...</span>
            {evaluationStartTime != null && <EvaluationTimer startTime={evaluationStartTime} />}
          </div>
        )}

        {phase === 'result' && (
          <div className={styles['result-wrap']}>
            <button
              onClick={onNextQuestion}
              className={styles['next-btn']}
            >
              {isLastQuestion ? 'Finish' : 'Next Question'}
            </button>
          </div>
        )}

        {phase === 'finished' && (
          <div className={styles.finished}>
            <div className={styles['finished-title']}>Quiz Complete!</div>
            <div className={styles['finished-score']}>{score}/{totalQuestions}</div>
          </div>
        )}
      </div>
    </div>
  );
}
