import { NoRecordOverlay } from '../NoRecordOverlay';
import consoleStyles from '../MediaConsole/MediaConsole.module.css';
import styles from './InterruptButton.module.css';

interface Props {
  enabled: boolean;
  onInterrupt: () => void;
}

function FastForwardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={consoleStyles.icon}
    >
      <polygon points="2,4 12,12 2,20" />
      <polygon points="12,4 22,12 12,20" />
    </svg>
  );
}

export function InterruptButton({ enabled, onInterrupt }: Props) {
  return (
    <div className={consoleStyles.wrap}>
      <button
        type="button"
        className={`${consoleStyles['mic-btn']} ${styles.btn}`}
        disabled={!enabled}
        onClick={onInterrupt}
        title={enabled ? 'Skip to your turn (N)' : 'Tutor is still preparing…'}
      >
        <span className={consoleStyles['mic-icon-wrap']}>
          <FastForwardIcon />
          {!enabled && <NoRecordOverlay />}
        </span>
      </button>
      {enabled && (
        <>
          <div className={consoleStyles.divider} />
          <div className={consoleStyles.right}>
            <span>Press N to interrupt</span>
          </div>
        </>
      )}
    </div>
  );
}
