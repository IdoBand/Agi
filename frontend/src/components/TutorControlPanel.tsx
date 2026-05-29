import { useEffect, useRef, useState } from 'react';
import { TutorPhase, TutorTranscriptEntry } from '../types/tutor.types';
import { ToggleSetting } from './ToggleSetting/ToggleSetting';
import styles from './TutorControlPanel.module.css';

interface Props {
  phase: TutorPhase;
  sessionId: string | null;
  transcript: TutorTranscriptEntry[];
  micSelected: boolean;
  bankOnly: boolean;
  onBankOnlyChange: (v: boolean) => void;
  onStart: () => void;
  onReset: () => void;
}

interface TranslateResponse {
  translatedText: string;
}

export function TutorControlPanel({ phase, sessionId, transcript, micSelected, bankOnly, onBankOnlyChange, onStart, onReset }: Props) {
  const [showHistory, setShowHistory] = useState(true);
  const [hideTutor, setHideTutor] = useState(false);
  const [englishIdxs, setEnglishIdxs] = useState<Set<number>>(new Set());
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [loadingIdxs, setLoadingIdxs] = useState<Set<number>>(new Set());
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showHistory && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, showHistory]);

  useEffect(() => {
    if (transcript.length === 0) {
      if (englishIdxs.size > 0) setEnglishIdxs(new Set());
      if (Object.keys(translations).length > 0) setTranslations({});
    }
  }, [transcript.length, englishIdxs.size, translations]);

  const fetchTranslation = async (i: number, text: string): Promise<void> => {
    setLoadingIdxs((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
    try {
      const res = await fetch('/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang: 'en', sourceLang: 'hu' }),
      });
      if (!res.ok) throw new Error(`translate failed: ${res.status}`);
      const data = (await res.json()) as TranslateResponse;
      setTranslations((prev) => ({ ...prev, [i]: data.translatedText }));
    } catch (err) {
      console.error('[tutor] translate error', err);
    } finally {
      setLoadingIdxs((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
    }
  };

  const toggleLang = (i: number, text: string) => {
    const willShowEn = !englishIdxs.has(i);
    setEnglishIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    if (willShowEn && !translations[i] && !loadingIdxs.has(i)) {
      void fetchTranslation(i, text);
    }
  };

  if (!sessionId) {
    return (
      <div className="mt-auto flex flex-col items-center gap-2 w-full">
        {!micSelected && <span className="text-yellow-400 text-sm">Select a microphone first</span>}
        <ToggleSetting label="Bank-only mode" checked={bankOnly} onChange={onBankOnlyChange} />
        <button
          onClick={onStart}
          disabled={!micSelected}
          className={`px-8 py-3 rounded-full shadow-lg text-lg font-medium transition-colors ${
            micSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Start Tutor
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center text-sm gap-2">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="text-gray-300 hover:text-white underline"
        >
          {showHistory ? 'Hide' : 'Show'} transcript ({transcript.length})
        </button>
        <div className="flex-1 flex items-center justify-center min-h-[1.5rem]">
          {phase === 'thinking' && (
            <div className="flex items-center gap-3 text-white">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">Thinking...</span>
            </div>
          )}
          {phase === 'speaking' && (
            <div className="flex items-center gap-3 text-white">
              <div className="flex gap-1">
                <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="font-medium">Speaking...</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setHideTutor((v) => !v)}
          className="text-gray-300 hover:text-white underline"
        >
          {hideTutor ? 'Show' : 'Hide'} tutor
        </button>
        <button onClick={onReset} className="text-red-300 hover:text-red-200 underline">
          Reset session
        </button>
      </div>

      {showHistory && (
        <div ref={transcriptRef} className="scrollbar-milky flex-1 min-h-0 overflow-y-auto bg-white/10 rounded p-2 text-sm text-gray-100 flex flex-col gap-2">
          {transcript.length === 0 && <div className="text-gray-400 italic">No turns yet.</div>}
          {transcript.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            const showEn = isAssistant && englishIdxs.has(i);
            const loading = loadingIdxs.has(i);
            const en = translations[i] ?? m.textEn;
            const body = showEn ? (en ?? '') : m.text;
            return (
              <div
                key={i}
                className={`px-2 py-1 rounded ${
                  m.role === 'user' ? 'bg-blue-700/40 text-blue-100' : 'bg-white/15 text-gray-100'
                }`}
              >
                <span className="font-bold mr-1">{m.role === 'user' ? 'You:' : 'Tutor:'}</span>
                {isAssistant && m.text && (
                  <button
                    onClick={() => toggleLang(i, m.text)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-200 ml-1 mr-1 align-middle"
                    disabled={loading}
                  >
                    {showEn ? 'HU' : 'EN'}
                  </button>
                )}
                <span className={isAssistant && hideTutor ? styles.blur : ''}>
                  {showEn && loading && !en ? (
                    <span className="inline-flex items-center gap-1 align-middle">
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      <span className="italic text-gray-400">translating...</span>
                    </span>
                  ) : (
                    body
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
