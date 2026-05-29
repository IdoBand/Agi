import { useCallback, useEffect, useRef, useState } from 'react';
import { Message } from '../types/message.types';
import { TutorPhase, TutorTranscriptEntry, TurnEvent } from '../types/tutor.types';
import { ensureAudioContextRunning } from '../utils/audioContext';

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
  bankOnly: boolean;
  setBankOnly: (v: boolean) => void;
  startSession: () => void;
  resetSession: () => Promise<void>;
  onAssistantAudioEnd: () => void;
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface SSEMessage {
  event: string;
  data: string;
}

function parseSseChunk(buffer: string): { messages: SSEMessage[]; remainder: string } {
  const messages: SSEMessage[] = [];
  let idx = 0;
  while (true) {
    const sep = buffer.indexOf('\n\n', idx);
    if (sep === -1) break;
    const raw = buffer.slice(idx, sep);
    idx = sep + 2;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    messages.push({ event, data: dataLines.join('\n') });
  }
  return { messages, remainder: buffer.slice(idx) };
}

export function useTutorChat(
  recorder: VoiceRecorderInput,
  active: boolean,
  onPttAvailableChange?: (v: boolean) => void,
): UseTutorChatReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bankOnly, setBankOnly] = useState<boolean>(false);
  const [phase, setPhase] = useState<TutorPhase>('idle');
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [transcript, setTranscript] = useState<TutorTranscriptEntry[]>([]);
  const inFlightRef = useRef<AbortController | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const playingRef = useRef<boolean>(false);
  const turnDoneRef = useRef<boolean>(false);

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
    audioQueueRef.current = [];
    playingRef.current = false;
    turnDoneRef.current = false;
    setSessionId(null);
    setTranscript([]);
    setCurrentMessage(null);
    setPhase('idle');
  }, [sessionId]);

  const playNext = useCallback(() => {
    const next = audioQueueRef.current.shift();
    if (!next) {
      playingRef.current = false;
      if (turnDoneRef.current) {
        setCurrentMessage(null);
        setPhase('listening');
      }
      return;
    }
    playingRef.current = true;
    setCurrentMessage({ role: 'assistant', content: '', audio: next });
  }, []);

  const enqueueAudio = useCallback(
    (base64: string) => {
      if (!base64) return;
      audioQueueRef.current.push(base64);
      if (!playingRef.current) {
        setPhase('speaking');
        playNext();
      }
    },
    [playNext]
  );

  const onAssistantAudioEnd = useCallback(() => {
    playNext();
  }, [playNext]);

  const sendTurn = useCallback(
    async (blob: Blob, sid: string) => {
      if (inFlightRef.current) inFlightRef.current.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      audioQueueRef.current = [];
      playingRef.current = false;
      turnDoneRef.current = false;
      setPhase('thinking');

      const turnAt = Date.now();
      let userText = '';
      let assistantText = '';

      try {
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        fd.append('sessionId', sid);
        fd.append('bankOnly', String(bankOnly));
        const res = await fetch('/tutor/turn', { method: 'POST', body: fd, signal: controller.signal });
        if (!res.ok) throw new Error(`tutor turn failed: ${res.status}`);
        if (!res.body) throw new Error('no response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) return;
          buffer += decoder.decode(value, { stream: true });
          const { messages, remainder } = parseSseChunk(buffer);
          buffer = remainder;
          for (const msg of messages) {
            let payload: TurnEvent;
            try {
              payload = JSON.parse(msg.data) as TurnEvent;
            } catch {
              continue;
            }
            if (payload.type === 'transcript') {
              userText = payload.text;
              setTranscript((t) => [...t, { role: 'user', text: payload.text, at: turnAt }]);
              setTranscript((t) => [...t, { role: 'assistant', text: '', at: Date.now() }]);
            } else if (payload.type === 'sentence') {
              const sep = assistantText.length === 0 ? '' : ' ';
              assistantText += sep + payload.hu;
              const accumulated = assistantText;
              setTranscript((t) => {
                const next = [...t];
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role === 'assistant') {
                    next[i] = { ...next[i], text: accumulated };
                    break;
                  }
                }
                return next;
              });
            } else if (payload.type === 'audio') {
              enqueueAudio(payload.base64);
            } else if (payload.type === 'done') {
              turnDoneRef.current = true;
              if (payload.fullHu && payload.fullHu !== assistantText) {
                const finalText = payload.fullHu;
                setTranscript((t) => {
                  const next = [...t];
                  for (let i = next.length - 1; i >= 0; i--) {
                    if (next[i].role === 'assistant') {
                      next[i] = { ...next[i], text: finalText };
                      break;
                    }
                  }
                  return next;
                });
              }
            }
          }
        }

        if (!playingRef.current && audioQueueRef.current.length === 0) {
          setCurrentMessage(null);
          setPhase('listening');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[tutor] turn error', err);
        audioQueueRef.current = [];
        playingRef.current = false;
        setCurrentMessage(null);
        setPhase('listening');
      } finally {
        if (inFlightRef.current === controller) inFlightRef.current = null;
        void userText;
        void assistantText;
      }
    },
    [enqueueAudio, bankOnly]
  );

  useEffect(() => {
    if (!onPttAvailableChange) return;
    const available = active && !!sessionId && phase === 'listening' && !!selectedDeviceId && !isRecording;
    onPttAvailableChange(available);
    return () => onPttAvailableChange(false);
  }, [active, sessionId, phase, selectedDeviceId, isRecording, onPttAvailableChange]);

  // T-key push-to-talk
  useEffect(() => {
    if (!active || !sessionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() !== 't' || e.repeat) return;
      if (phase !== 'listening') return;
      if (!selectedDeviceId || isRecording) return;
      e.preventDefault();
      // Wake the WebAudio graph on this user gesture so the avatar's analyser
      // can play through it without being silenced by autoplay policy.
      ensureAudioContextRunning();
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
    bankOnly,
    setBankOnly,
    startSession,
    resetSession,
    onAssistantAudioEnd,
  };
}
