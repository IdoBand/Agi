import styles from './BackButton.module.css';

interface Props {
  onClick: () => void;
}

export function BackButton({ onClick }: Props) {
  return (
    <button type="button" aria-label="Back to menu" onClick={onClick} className={styles.btn}>
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
  );
}
