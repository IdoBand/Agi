import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { InterruptButtonState } from '../../types/tutor.types';
import { InterruptButton } from '../InterruptButton';
import { MediaConsole } from '../MediaConsole';
import { PanelIcon } from '../PanelIcon';
import styles from './TutorConsoleStack.module.css';

interface Props {
  recorder: ReturnType<typeof useVoiceRecorder>;
  pttAvailable: boolean;
  speaking: boolean;
  interruptState: InterruptButtonState;
  onInterrupt: () => void;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
}

export function TutorConsoleStack({ recorder, pttAvailable, speaking, interruptState, onInterrupt, sidebarCollapsed, onExpandSidebar }: Props) {
  return (
    <div className={styles.stack}>
      <MediaConsole recorder={recorder} pttAvailable={pttAvailable} speaking={speaking} />
      {interruptState !== 'hidden' && (
        <InterruptButton enabled={interruptState === 'enabled'} onInterrupt={onInterrupt} />
      )}
      {sidebarCollapsed && (
        <button
          className={styles['expand-btn']}
          onClick={onExpandSidebar}
          aria-label="Show sidebar"
          title="Show sidebar"
        >
          <PanelIcon className={styles['expand-icon']} />
        </button>
      )}
    </div>
  );
}
