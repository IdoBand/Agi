import { useCallback, useEffect, useRef, useState } from 'react';
import { Message } from '../types/message.types';
import { TutorPhase, TutorTranscriptEntry, TutorTurnResponse } from '../types/tutor.types';

interface VoiceRecorderInput {
  isRecording: boolean;
  selectedDeviceId: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

export interface UseTutorChatReturn {
  phase: TutorPhase;
  currentMessage: Message | null;
  isRecording: boolean;
  transcript: TutorTranscriptEntry[];
  sessionId: string | null;
  startSession: () => void;
  resetSession: () => Promise<void>;
  onAssistantAudioEnd: () => void;
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useTutorChat(recorder: VoiceRecorderInput, active: boolean): UseTutorChatReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<TutorPhase>('idle');
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [transcript, setTranscript] = useState<TutorTranscriptEntry[]>([]);
  const inFlightRef = useRef<AbortController | null>(null);

  const { isRecording, selectedDeviceId, startRecording, stopRecording } = recorder;

  const startSession = useCallback(() => {
    setSessionId(newSessionId());
    setTranscript([]);
    setCurrentMessage(null);
    setPhase('listening');
  }, []);

  const resetSession = useCallback(async () => {
    if (inFlightRef.current) {
      inFlightRef.current.abort();
      inFlightRef.current = null;
    }
    if (sessionId) {
      try {
        await fetch('/tutor/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // ignore
      }
    }
    setSessionId(null);
    setTranscript([]);
    setCurrentMessage(null);
    setPhase('idle');
  }, [sessionId]);

  const sendTurn = useCallback(
    async (blob: Blob, sid: string) => {
      if (inFlightRef.current) inFlightRef.current.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      setPhase('thinking');

      try {
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        fd.append('sessionId', sid);
        const res = await fetch('/tutor/turn', { method: 'POST', body: fd, signal: controller.signal });
        if (!res.ok) throw new Error(`tutor turn failed: ${res.status}`);
        const data: TutorTurnResponse = await res.json();
        if (controller.signal.aborted) return;

        setTranscript((t) => [
          ...t,
          { role: 'user', text: data.userTranscript, at: Date.now() },
          { role: 'assistant', text: data.content, textEn: data.contentEn, at: Date.now() },
        ]);
        setCurrentMessage({
          role: 'assistant',
          content: data.content,
          audio: data.audio,
          lipsync: data.lipsync,
          facialExpression: data.facialExpression,
        });
        setPhase('speaking');
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[tutor] turn error', err);
        setPhase('listening');
      } finally {
        if (inFlightRef.current === controller) inFlightRef.current = null;
      }
    },
    []
  );

  const onAssistantAudioEnd = useCallback(() => {
    setCurrentMessage(null);
    setPhase('listening');
  }, []);

  // T-key push-to-talk
  useEffect(() => {
    if (!active || !sessionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() !== 't' || e.repeat) return;
      if (phase !== 'listening') return;
      if (!selectedDeviceId || isRecording) return;
      e.preventDefault();
      setPhase('recording');
      startRecording();
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 't') return;
      if (!isRecording) return;
      e.preventDefault();
      const blob = await stopRecording();
      if (blob && sessionId) {
        sendTurn(blob, sessionId);
      } else {
        setPhase('listening');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [active, sessionId, phase, isRecording, selectedDeviceId, startRecording, stopRecording, sendTurn]);

  return {
    phase,
    currentMessage,
    isRecording,
    transcript,
    sessionId,
    startSession,
    resetSession,
    onAssistantAudioEnd,
  };
}
