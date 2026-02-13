import { useState, useCallback, useEffect } from 'react';
import { Message } from '../types/message.types';
import { QuizPhase, QuizQuestion, QuizEvaluateResponse } from '../types/quiz.types';

interface VoiceRecorderInput {
  isRecording: boolean;
  selectedDeviceId: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

interface UseQuizReturn {
  phase: QuizPhase;
  currentMessage: Message | null;
  isRecording: boolean;
  currentIndex: number;
  totalQuestions: number;
  result: QuizEvaluateResponse | null;
  score: number;
  currentQuestionText: string;
  startQuiz: () => void;
  sendAnswer: () => void;
  nextQuestion: () => void;
  onQuestionAudioEnd: () => void;
}

export function useQuiz(recorder: VoiceRecorderInput): UseQuizReturn {
  const [phase, setPhase] = useState<QuizPhase>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<QuizEvaluateResponse | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [score, setScore] = useState(0);

  const { isRecording, selectedDeviceId, startRecording: recorderStart, stopRecording: recorderStop } = recorder;

  const playQuestion = useCallback((question: QuizQuestion) => {
    setCurrentMessage({
      role: 'assistant',
      content: question.text,
      audio: question.audio,
      lipsync: question.lipsync,
      facialExpression: question.facialExpression,
    });
    setPhase('asking');
  }, []);

  const startQuiz = useCallback(async () => {
    setPhase('loading');
    setScore(0);
    setCurrentIndex(0);
    setResult(null);
    setRecordedBlob(null);

    try {
      const res = await fetch('/quiz/start/test');
      if (!res.ok) throw new Error('Failed to start quiz');
      const data = await res.json();
      const qs: QuizQuestion[] = data.questions;
      setQuestions(qs);
      playQuestion(qs[0]);
    } catch (err) {
      console.error('Quiz start error:', err);
      setPhase('idle');
    }
  }, [playQuestion]);

  const onQuestionAudioEnd = useCallback(() => {
    setCurrentMessage(null);
    setPhase('listening');
  }, []);

  // T key handling for quiz recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() !== 't') return;
      if (e.repeat) return;

      if (phase === 'listening' || phase === 'recorded') {
        if (!isRecording && selectedDeviceId) {
          e.preventDefault();
          setRecordedBlob(null);
          recorderStart();
        }
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 't') return;
      if (!isRecording) return;

      e.preventDefault();
      const blob = await recorderStop();
      if (blob) {
        setRecordedBlob(blob);
        setPhase('recorded');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [phase, isRecording, selectedDeviceId, recorderStart, recorderStop]);

  const sendAnswer = useCallback(async () => {
    if (!recordedBlob || !questions[currentIndex]) return;

    setPhase('evaluating');
    try {
      const formData = new FormData();
      formData.append('audio', recordedBlob, 'recording.webm');
      formData.append('questionText', questions[currentIndex].text);
      formData.append('correctAnswer', questions[currentIndex].answer);

      const res = await fetch('/quiz/evaluate', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to evaluate answer');
      const data: QuizEvaluateResponse = await res.json();
      setResult(data);
      if (data.correct) setScore((s) => s + 1);
      setPhase('result');
    } catch (err) {
      console.error('Quiz evaluate error:', err);
      setPhase('recorded');
    }
  }, [recordedBlob, questions, currentIndex]);

  const nextQuestion = useCallback(() => {
    const nextIdx = currentIndex + 1;
    setResult(null);
    setRecordedBlob(null);

    if (nextIdx < questions.length) {
      setCurrentIndex(nextIdx);
      playQuestion(questions[nextIdx]);
    } else {
      setCurrentMessage(null);
      setPhase('finished');
    }
  }, [currentIndex, questions, playQuestion]);

  return {
    phase,
    currentMessage,
    isRecording,
    currentIndex,
    totalQuestions: questions.length,
    result,
    score,
    currentQuestionText: questions[currentIndex]?.text ?? '',
    startQuiz,
    sendAnswer,
    nextQuestion,
    onQuestionAudioEnd,
  };
}
