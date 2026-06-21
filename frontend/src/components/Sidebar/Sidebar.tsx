import { useState } from 'react';
import { Message } from '../../types/message.types';
import { InterruptButtonState } from '../../types/tutor.types';
import { MainMenu } from '../MainMenu';
import { QuizMode } from '../QuizMode';
import { TutorMode } from '../TutorMode';
import styles from './Sidebar.module.css';

export type Mode = 'quiz' | 'tutor';

interface VoiceRecorderInput {
  isRecording: boolean;
  selectedDeviceId: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

interface Props {
  recorder: VoiceRecorderInput;
  onMessage: (m: Message | null) => void;
  onAudioEndRef: (cb: () => void) => void;
  onPttAvailableChange: (v: boolean) => void;
  onSpeakingChange: (v: boolean) => void;
  onInterruptRef?: (cb: () => void) => void;
  onInterruptStateChange?: (s: InterruptButtonState) => void;
}

export function Sidebar({ recorder, onMessage, onAudioEndRef, onPttAvailableChange, onSpeakingChange, onInterruptRef, onInterruptStateChange }: Props) {
  const [mode, setMode] = useState<Mode>('tutor');
  const [sessionActive, setSessionActive] = useState(false);

  return (
    <aside className={styles.aside}>
      {!sessionActive && <MainMenu mode={mode} onModeChange={setMode} />}

      {mode === 'quiz' && (
        <QuizMode
          recorder={recorder}
          onMessage={onMessage}
          onAudioEndRef={onAudioEndRef}
          onPttAvailableChange={onPttAvailableChange}
          onActiveChange={setSessionActive}
          onSpeakingChange={onSpeakingChange}
        />
      )}
      {mode === 'tutor' && (
        <TutorMode
          recorder={recorder}
          onMessage={onMessage}
          onAudioEndRef={onAudioEndRef}
          onPttAvailableChange={onPttAvailableChange}
          onActiveChange={setSessionActive}
          onSpeakingChange={onSpeakingChange}
          onInterruptRef={onInterruptRef}
          onInterruptStateChange={onInterruptStateChange}
        />
      )}
    </aside>
  );
}
