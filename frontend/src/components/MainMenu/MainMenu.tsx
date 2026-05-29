import type { Mode } from '../Sidebar';
import styles from './MainMenu.module.css';

interface Props {
  mode: Mode;
  onModeChange: (m: Mode) => void;
}

export function MainMenu({ mode, onModeChange }: Props) {
  return (
    <div className={styles.menu}>
      <button
        onClick={() => onModeChange('quiz')}
        className={`${styles.btn} ${mode === 'quiz' ? styles['btn--selected'] : styles['btn--idle']}`}
      >
        Quiz
      </button>
      <button
        onClick={() => onModeChange('tutor')}
        className={`${styles.btn} ${mode === 'tutor' ? styles['btn--selected'] : styles['btn--idle']}`}
      >
        Tutor
      </button>
    </div>
  );
}
