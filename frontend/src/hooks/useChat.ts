import { useState, useCallback, useEffect } from 'react';
import { useVoiceRecorder } from './useVoiceRecorder';
import { Message, ChatResponse } from '../types/message.types';

interface UseChatReturn {
  messages: Message[];
  currentMessage: Message | null;
  isRecording: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string) => void;
  startRecording: () => void;
  stopRecordingAndSend: () => void;
  onAudioEnd: () => void;
  clearMessages: () => void;
  playTestLipsync: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isRecording, devices, selectedDeviceId, setSelectedDeviceId, startRecording, stopRecording } = useVoiceRecorder();

  // Handle T key for push-to-talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key.toLowerCase() === 't' && !isPlaying && !isRecording && !isLoading && selectedDeviceId) {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't' && isRecording) {
        e.preventDefault();
        stopRecordingAndSend();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, isRecording, isLoading, selectedDeviceId, startRecording]);

  const stopRecordingAndSend = useCallback(async () => {
    try {
      const audioBlob = await stopRecording();

      if (!audioBlob) {
        return;
      }

      setIsLoading(true);
      setError(null);

      // Create form data with audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Send to backend
      const response = await fetch('/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data: ChatResponse = await response.json();

      // Add user message (we don't know the transcription, but that's okay)
      const userMessage: Message = {
        role: 'user',
        content: '(voice message)',
      };

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.text,
        audio: data.audio,
        lipsync: data.lipsync,
        facialExpression: data.facialExpression,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setCurrentMessage(assistantMessage);
      setIsPlaying(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [stopRecording]);

  const onAudioEnd = useCallback(() => {
    setIsPlaying(false);
    setCurrentMessage(null);
  }, []);

  const clearMessages = useCallback(async () => {
    try {
      await fetch('/chat/clear', { method: 'POST' });
      setMessages([]);
      setCurrentMessage(null);
    } catch (err) {
      console.error('Failed to clear messages:', err);
    }
  }, []);

  const playTestLipsync = useCallback(async () => {
    try {
      const [audioRes, lipsyncRes] = await Promise.all([
        fetch('/lipsync-test/20a01544-48fa-4ab6-8365-bfe7084a7bd7.mp3'),
        fetch('/lipsync-test/e76fe7d0-ab79-45a6-ac52-88a9f3c48865.json'),
      ]);

      const audioBlob = await audioRes.blob();
      const audioBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioBlob);
      });

      const lipsync = await lipsyncRes.json();

      setCurrentMessage({
        role: 'assistant',
        content: 'Test',
        audio: audioBase64,
        lipsync,
        facialExpression: 'smile',
      });
      setIsPlaying(true);
    } catch (err) {
      console.error('Test lipsync error:', err);
    }
  }, []);

  return {
    messages,
    currentMessage,
    isRecording,
    isLoading,
    isPlaying,
    error,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    startRecording,
    stopRecordingAndSend,
    onAudioEnd,
    clearMessages,
    playTestLipsync,
  };
}
