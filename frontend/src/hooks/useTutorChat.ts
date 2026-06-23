import { useCallback, useEffect, useRef, useState } from 'react';
import { Message } from '../types/message.types';
import { InterruptButtonState, TutorPhase, TutorTranscriptEntry, TurnEvent } from '../types/tutor.types';
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
  interrupt: () => void;
  replayMessage: (i: number, chunks: string[]) => void;
  replayingIdx: number | null;
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
  onInterruptStateChange?: (s: InterruptButtonState) => void,
): UseTutorChatReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bankOnly, setBankOnly] = useState<boolean>(true);
  const [phase, setPhase] = useState<TutorPhase>('idle');
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [transcript, setTranscript] = useState<TutorTranscriptEntry[]>([]);
  const [turnDone, setTurnDone] = useState<boolean>(false);
  const [replayingIdx, setReplayingIdx] = useState<number | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const playingRef = useRef<boolean>(false);
  const turnDoneRef = useRef<boolean>(false);
  const replayingIdxRef = useRef<number | null>(null);
  const phaseRef = useRef<TutorPhase>('idle');
  const playSeqRef = useRef<number>(0);

  const { isRecording, selectedDeviceId, startRecording, stopRecording } = recorder;

  // Mirror phase into a ref so replay guards can read it without stale closures.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Write both the ref and the state so reads never observe a half-updated value.
  const setReplaying = useCallback((idx: number | null) => {
    replayingIdxRef.current = idx;
    setReplayingIdx(idx);
  }, []);

  const startSession = useCallback(() => {
    setSessionId(newSessionId());
    setTranscript([]);
    setCurrentMessage(null);
    turnDoneRef.current = false;
    setTurnDone(false);
    setReplaying(null);
    setPhase('listening');
  }, [setReplaying]);

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
    setTurnDone(false);
    setReplaying(null);
    setSessionId(null);
    setTranscript([]);
    setCurrentMessage(null);
    setPhase('idle');
  }, [sessionId, setReplaying]);

  const interrupt = useCallback(() => {
    if (!turnDoneRef.current) return;
    audioQueueRef.current = [];
    playingRef.current = false;
    turnDoneRef.current = false;
    setTurnDone(false);
    setReplaying(null);
    setCurrentMessage(null);
    setPhase('listening');
  }, [setReplaying]);

  const playNext = useCallback(() => {
    const next = audioQueueRef.current.shift();
    if (!next) {
      playingRef.current = false;
      // Fix B: a replay has no streaming producer, so an empty queue means it
      // finished — finalize unconditionally before the live turnDone branch.
      if (replayingIdxRef.current !== null) {
        setReplaying(null);
        setCurrentMessage(null);
        setPhase('listening');
        return;
      }
      if (turnDoneRef.current) {
        setCurrentMessage(null);
        setPhase('listening');
      }
      return;
    }
    playingRef.current = true;
    // Fix A: stamp a fresh playId so the Avatar re-runs its effect even when two
    // consecutive sentences produced byte-identical base64.
    setCurrentMessage({ role: 'assistant', content: '', audio: next, playId: ++playSeqRef.current });
  }, [setReplaying]);

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

  // Replay a finished assistant message by feeding its retained chunks back
  // through the existing queue/Avatar pipeline. `chunks` is passed in to avoid a
  // stale `transcript` closure.
  const replayMessage = useCallback(
    (i: number, chunks: string[]) => {
      if (phaseRef.current !== 'listening') return;
      if (replayingIdxRef.current !== null) return;
      if (!chunks?.length) return;
      // User gesture (button click): wake the WebAudio graph, mirroring T-key.
      ensureAudioContextRunning();
      audioQueueRef.current = [...chunks];
      playingRef.current = false;
      // Treat replay like a completed-stream speaking turn (interrupt + N work).
      turnDoneRef.current = true;
      setTurnDone(true);
      setReplaying(i);
      setPhase('speaking');
      playNext();
    },
    [playNext, setReplaying]
  );

  const sendTurn = useCallback(
    async (blob: Blob, sid: string) => {
      if (inFlightRef.current) inFlightRef.current.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      audioQueueRef.current = [];
      playingRef.current = false;
      turnDoneRef.current = false;
      setTurnDone(false);
      setReplaying(null);
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
              const chunk = payload.base64;
              // Retain the chunk on the latest assistant entry for replay. Guard
              // against out-of-order events: skip if the tail isn't assistant.
              setTranscript((t) => {
                const next = [...t];
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role === 'assistant') {
                    next[i] = { ...next[i], audio: [...(next[i].audio ?? []), chunk] };
                    break;
                  }
                  if (next[i].role === 'user') break;
                }
                return next;
              });
              enqueueAudio(chunk);
            } else if (payload.type === 'done') {
              turnDoneRef.current = true;
              setTurnDone(true);
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
        turnDoneRef.current = false;
        setTurnDone(false);
        setReplaying(null);
        setCurrentMessage(null);
        setPhase('listening');
      } finally {
        if (inFlightRef.current === controller) inFlightRef.current = null;
        void userText;
        void assistantText;
      }
    },
    [enqueueAudio, bankOnly, setReplaying]
  );

  useEffect(() => {
    if (!onPttAvailableChange) return;
    const available = active && !!sessionId && phase === 'listening' && !!selectedDeviceId && !isRecording;
    onPttAvailableChange(available);
    return () => onPttAvailableChange(false);
  }, [active, sessionId, phase, selectedDeviceId, isRecording, onPttAvailableChange]);

  useEffect(() => {
    if (!onInterruptStateChange) return;
    const s: InterruptButtonState = !sessionId
      ? 'hidden'
      : phase === 'speaking' && turnDone
        ? 'enabled'
        : 'disabled';
    onInterruptStateChange(s);
    return () => onInterruptStateChange('hidden');
  }, [sessionId, phase, turnDone, onInterruptStateChange]);

  // N-key interrupt (fast-forward past trailing TTS once `done` arrived)
  useEffect(() => {
    if (!active || !sessionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() !== 'n' || e.repeat) return;
      if (!turnDoneRef.current || phase !== 'speaking') return;
      e.preventDefault();
      interrupt();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, sessionId, phase, interrupt]);

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
    interrupt,
    replayMessage,
    replayingIdx,
  };
}
