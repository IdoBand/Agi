import styles from './NoRecordOverlay.module.css';

export function NoRecordOverlay() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={styles['stop-overlay']}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="5" y1="5" x2="19" y2="19" />
    </svg>
  );
}
