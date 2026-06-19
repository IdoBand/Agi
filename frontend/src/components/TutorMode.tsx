import { useEffect } from 'react';
import { Message } from '../types/message.types';
import { InterruptButtonState } from '../types/tutor.types';
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
  onActiveChange: (v: boolean) => void;
  onSpeakingChange: (v: boolean) => void;
  onInterruptRef?: (cb: () => void) => void;
  onInterruptStateChange?: (s: InterruptButtonState) => void;
}

export function TutorMode({ recorder, onMessage, onAudioEndRef, onPttAvailableChange, onActiveChange, onSpeakingChange, onInterruptRef, onInterruptStateChange }: Props) {
  const tutor = useTutorChat(recorder, true, onPttAvailableChange, onInterruptStateChange);

  useEffect(() => {
    onActiveChange(tutor.sessionId !== null);
  }, [tutor.sessionId, onActiveChange]);

  useEffect(() => {
    onSpeakingChange(tutor.phase === 'speaking');
  }, [tutor.phase, onSpeakingChange]);

  useEffect(() => {
    onMessage(tutor.currentMessage);
  }, [tutor.currentMessage, onMessage]);

  useEffect(() => {
    onAudioEndRef(tutor.onAssistantAudioEnd);
  }, [tutor.onAssistantAudioEnd, onAudioEndRef]);

  useEffect(() => {
    onInterruptRef?.(tutor.interrupt);
  }, [tutor.interrupt, onInterruptRef]);

  return (
    <TutorControlPanel
      phase={tutor.phase}
      sessionId={tutor.sessionId}
      transcript={tutor.transcript}
      micSelected={!!recorder.selectedDeviceId}
      bankOnly={tutor.bankOnly}
      onBankOnlyChange={tutor.setBankOnly}
      onStart={tutor.startSession}
      onBack={tutor.resetSession}
    />
  );
}
