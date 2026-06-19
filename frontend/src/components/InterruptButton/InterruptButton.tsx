import { NoRecordOverlay } from '../NoRecordOverlay';
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
      className={styles.icon}
    >
      <polygon points="2,4 12,12 2,20" />
      <polygon points="12,4 22,12 12,20" />
    </svg>
  );
}

export function InterruptButton({ enabled, onInterrupt }: Props) {
  return (
    <button
      type="button"
      className={styles.btn}
      disabled={!enabled}
      onClick={onInterrupt}
      title={enabled ? 'Skip to your turn (N)' : 'Tutor is still preparing…'}
    >
      <span className={styles['icon-wrap']}>
        <FastForwardIcon />
        {!enabled && <NoRecordOverlay />}
      </span>
    </button>
  );
}
