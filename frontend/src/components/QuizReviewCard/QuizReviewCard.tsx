import { QuizEvaluateResponse } from '../../types/quiz.types';
import styles from './QuizReviewCard.module.css';

interface QuizReviewCardProps {
  result: QuizEvaluateResponse;
  questionText: string;
  englishTranslation: string;
  category: string;
  correctAnswer: string;
}

export function QuizReviewCard({
  result,
  questionText,
  englishTranslation,
  category,
  correctAnswer,
}: QuizReviewCardProps) {
  return (
    <div className={`${styles.card} ${result.correct ? styles['card--correct'] : styles['card--incorrect']}`}>
      <div className={`${styles.heading} ${result.correct ? styles['heading--correct'] : styles['heading--incorrect']}`}>
        {result.correct ? 'Correct!' : 'Incorrect'}
      </div>
      {questionText && (
        <div>
          <div className={styles.label}>Question</div>
          <div className={styles.value}>{questionText}</div>
        </div>
      )}
      {category && (
        <div>
          <div className={styles.label}>Category</div>
          <div className={`${styles.value} ${styles['value--category']}`}>{category}</div>
        </div>
      )}
      {result.userTranscript && (
        <div>
          <div className={styles.label}>You Said</div>
          <div className={`${styles.value} ${styles['value--muted']}`}>&quot;{result.userTranscript}&quot;</div>
        </div>
      )}
      {correctAnswer && (
        <div>
          <div className={styles.label}>Correct Answer</div>
          <div className={styles.value}>{correctAnswer}</div>
        </div>
      )}
      <div>
        <div className={styles.label}>Evaluation</div>
        <div className={styles.value}>{result.explanation}</div>
      </div>
      {englishTranslation && (
        <div>
          <div className={styles.label}>Translation</div>
          <div className={`${styles.value} ${styles['value--translation']}`}>{englishTranslation}</div>
        </div>
      )}
    </div>
  );
}
