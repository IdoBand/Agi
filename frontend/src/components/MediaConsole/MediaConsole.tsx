import { useEffect, useRef, useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { NoRecordOverlay } from '../NoRecordOverlay';
import styles from './MediaConsole.module.css';

interface Props {
  recorder: ReturnType<typeof useVoiceRecorder>;
  pttAvailable: boolean;
  speaking: boolean;
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.icon}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export function MediaConsole({ recorder, pttAvailable, speaking }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const showRight = recorder.isRecording || pttAvailable;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.left}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={styles['mic-btn']}
          title={
            speaking
              ? 'Tutor is speaking…'
              : recorder.selectedDeviceId
                ? 'Change microphone'
                : 'Select microphone'
          }
        >
          <span className={styles['mic-icon-wrap']}>
            <MicIcon />
            {speaking && <NoRecordOverlay />}
          </span>
        </button>
        {open && (
          <div className={`${styles.menu} scrollbar-milky`}>
            {recorder.devices.length === 0 && (
              <div className={styles['menu-empty']}>No microphones found</div>
            )}
            {recorder.devices.map((d) => {
              const selected = d.deviceId === recorder.selectedDeviceId;
              return (
                <button
                  key={d.deviceId}
                  onClick={() => {
                    recorder.setSelectedDeviceId(d.deviceId);
                    setOpen(false);
                  }}
                  className={`${styles['menu-item']} ${selected ? styles['menu-item--selected'] : ''}`}
                >
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showRight && (
        <>
          <div className={styles.divider} />
          <div className={styles.right}>
            {recorder.isRecording ? (
              <>
                <div className={styles['rec-dot']} />
                <span>Recording...</span>
              </>
            ) : (
              <span>Hold T to record</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
