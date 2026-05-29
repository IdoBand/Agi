import styles from './PushToTalk.module.css';

interface PushToTalkProps {
  isRecording: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  micSelected: boolean;
}

export function PushToTalk({
  isRecording,
  isLoading,
  isPlaying,
  error,
  micSelected,
}: PushToTalkProps) {
  const getStatusText = () => {
    if (error) return error;
    if (!micSelected) return 'Select a microphone to start';
    if (isRecording) return 'Recording... Release T to send';
    if (isLoading) return 'Processing...';
    if (isPlaying) return 'Speaking...';
    return 'Hold T to talk';
  };

  const getStatusClass = () => {
    if (error) return styles['pill--error'];
    if (!micSelected) return styles['pill--pending'];
    if (isRecording) return styles['pill--recording'];
    if (isLoading) return styles['pill--loading'];
    if (isPlaying) return styles['pill--speaking'];
    return styles['pill--idle'];
  };

  const pillCls = [styles.pill, getStatusClass(), isRecording ? 'animate-pulse' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.root}>
      <div className={pillCls}>
        <div className={styles.row}>
          {isRecording && <div className={`${styles['rec-dot']} animate-pulse`} />}
          {isLoading && <div className={`${styles.spinner} animate-spin`} />}
          {isPlaying && (
            <div className={styles.bars}>
              <div className={`${styles.bar} animate-bounce`} />
              <div className={`${styles.bar} animate-bounce`} />
              <div className={`${styles.bar} animate-bounce`} />
            </div>
          )}
          <span className={styles.label}>{getStatusText()}</span>
        </div>
      </div>
    </div>
  );
}
