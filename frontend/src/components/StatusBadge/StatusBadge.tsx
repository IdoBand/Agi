import styles from './StatusBadge.module.css';

interface Props {
  ok: boolean;
  title?: string;
}

export function StatusBadge({ ok, title }: Props): JSX.Element {
  return (
    <span
      className={`${styles.glyph} ${ok ? styles['glyph--ok'] : styles['glyph--off']}`}
      title={title}
    >
      {ok ? '✓' : '✕'}
    </span>
  );
}
