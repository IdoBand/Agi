import { useState, useCallback, useEffect, useRef } from 'react';
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
  currentEnglishTranslation: string;
  isAudioPlaying: boolean;
  hasRecordedAnswer: boolean;
  evaluationStartTime: number | null;
  startQuiz: () => void;
  sendAnswer: () => void;
  nextQuestion: () => void;
  onQuestionAudioEnd: () => void;
  replayQuestionAudio: () => void;
  playRecordedAnswer: () => void;
}

export function useQuiz(recorder: VoiceRecorderInput): UseQuizReturn {
  const [phase, setPhase] = useState<QuizPhase>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<QuizEvaluateResponse | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [score, setScore] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [evaluationStartTime, setEvaluationStartTime] = useState<number | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const phaseBeforeReplayRef = useRef<QuizPhase | null>(null);

  const { isRecording, selectedDeviceId, startRecording: recorderStart, stopRecording: recorderStop } = recorder;

  const stopPlaybackAudio = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.removeAttribute('src');
      playbackAudioRef.current = null;
    }
  }, []);

  const playAudioFromBlob = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    playbackAudioRef.current = audio;
    setIsAudioPlaying(true);
    const cleanup = () => {
      setIsAudioPlaying(false);
      URL.revokeObjectURL(url);
      playbackAudioRef.current = null;
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    audio.play();
  }, []);

  const playQuestion = useCallback((question: QuizQuestion) => {
    setCurrentMessage({
      role: 'assistant',
      content: question.text,
      audio: question.audio,
      lipsync: question.lipsync,
      facialExpression: question.facialExpression,
    });
    setIsAudioPlaying(true);
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
    const restorePhase = phaseBeforeReplayRef.current;
    phaseBeforeReplayRef.current = null;
    setCurrentMessage(null);
    setIsAudioPlaying(false);
    setPhase(restorePhase ?? 'listening');
  }, []);

  const replayQuestionAudio = useCallback(() => {
    if (isAudioPlaying) return;
    const q = questions[currentIndex];
    if (!q) return;
    phaseBeforeReplayRef.current = phase;
    playQuestion(q);
  }, [isAudioPlaying, questions, currentIndex, phase, playQuestion]);

  const playRecordedAnswer = useCallback(() => {
    if (isAudioPlaying || !recordedBlob) return;
    stopPlaybackAudio();
    playAudioFromBlob(recordedBlob);
  }, [isAudioPlaying, recordedBlob, stopPlaybackAudio, playAudioFromBlob]);

  // T key handling for quiz recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() !== 't') return;
      if (e.repeat) return;

      if (phase === 'listening' || phase === 'recorded') {
        if (!isRecording && selectedDeviceId) {
          e.preventDefault();
          stopPlaybackAudio();
          setIsAudioPlaying(false);
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
  }, [phase, isRecording, selectedDeviceId, recorderStart, recorderStop, stopPlaybackAudio]);

  const sendAnswer = useCallback(async () => {
    if (!recordedBlob || !questions[currentIndex]) return;

    stopPlaybackAudio();
    setIsAudioPlaying(false);
    setPhase('evaluating');
    setEvaluationStartTime(Date.now());
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
      setEvaluationStartTime(null);
      setPhase('result');
    } catch (err) {
      console.error('Quiz evaluate error:', err);
      setEvaluationStartTime(null);
      setPhase('recorded');
    }
  }, [recordedBlob, questions, currentIndex, stopPlaybackAudio]);

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
    currentEnglishTranslation: questions[currentIndex]?.englishTranslation ?? '',
    isAudioPlaying,
    hasRecordedAnswer: !!recordedBlob,
    evaluationStartTime,
    startQuiz,
    sendAnswer,
    nextQuestion,
    onQuestionAudioEnd,
    replayQuestionAudio,
    playRecordedAnswer,
  };
}
