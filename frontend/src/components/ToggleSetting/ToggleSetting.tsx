import styles from './ToggleSetting.module.css';

interface Props {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleSetting({ label, checked, disabled, onChange }: Props) {
  const cls = [
    styles.toggle,
    checked ? styles['toggle--checked'] : '',
    disabled ? styles['toggle--disabled'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={cls}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={styles.track}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
