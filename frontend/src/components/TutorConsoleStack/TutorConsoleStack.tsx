import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { InterruptButtonState } from '../../types/tutor.types';
import { InterruptButton } from '../InterruptButton';
import { MediaConsole } from '../MediaConsole';
import styles from './TutorConsoleStack.module.css';

interface Props {
  recorder: ReturnType<typeof useVoiceRecorder>;
  pttAvailable: boolean;
  speaking: boolean;
  interruptState: InterruptButtonState;
  onInterrupt: () => void;
}

export function TutorConsoleStack({ recorder, pttAvailable, speaking, interruptState, onInterrupt }: Props) {
  return (
    <div className={styles.stack}>
      <MediaConsole recorder={recorder} pttAvailable={pttAvailable} speaking={speaking} />
      {interruptState !== 'hidden' && (
        <InterruptButton enabled={interruptState === 'enabled'} onInterrupt={onInterrupt} />
      )}
    </div>
  );
}
