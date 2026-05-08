import { useEffect } from 'react';
import { Message } from '../types/message.types';
import { useTutorChat } from '../hooks/useTutorChat';
import { TutorControlPanel } from './TutorControlPanel';

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
}

export function TutorChatMode({ recorder, onMessage, onAudioEndRef, onPttAvailableChange }: Props) {
  const tutor = useTutorChat(recorder, true, onPttAvailableChange);

  useEffect(() => {
    onMessage(tutor.currentMessage);
  }, [tutor.currentMessage, onMessage]);

  useEffect(() => {
    onAudioEndRef(tutor.onAssistantAudioEnd);
  }, [tutor.onAssistantAudioEnd, onAudioEndRef]);

  return (
    <div className="mt-auto">
      <TutorControlPanel
        phase={tutor.phase}
        sessionId={tutor.sessionId}
        transcript={tutor.transcript}
        micSelected={!!recorder.selectedDeviceId}
        onStart={tutor.startSession}
        onReset={tutor.resetSession}
      />
    </div>
  );
}
