import { useEffect, useRef, useState } from 'react';
import { TutorPhase, TutorTranscriptEntry } from '../types/tutor.types';

interface Props {
  phase: TutorPhase;
  sessionId: string | null;
  transcript: TutorTranscriptEntry[];
  micSelected: boolean;
  onStart: () => void;
  onReset: () => void;
}

export function TutorControlPanel({ phase, sessionId, transcript, micSelected, onStart, onReset }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [englishIdxs, setEnglishIdxs] = useState<Set<number>>(new Set());
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showHistory && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, showHistory]);

  useEffect(() => {
    if (transcript.length === 0 && englishIdxs.size > 0) {
      setEnglishIdxs(new Set());
    }
  }, [transcript.length, englishIdxs.size]);

  const toggleLang = (i: number) => {
    setEnglishIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        <button
          onClick={onStart}
          disabled={!micSelected}
          className={`px-8 py-3 rounded-full shadow-lg text-lg font-medium transition-colors ${
            micSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Start Tutor
        </button>
        {!micSelected && <span className="text-yellow-400 text-sm">Select a microphone first</span>}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="text-gray-300 hover:text-white underline"
        >
          {showHistory ? 'Hide' : 'Show'} transcript ({transcript.length})
        </button>
        <button onClick={onReset} className="text-red-300 hover:text-red-200 underline">
          Reset session
        </button>
      </div>

      {showHistory && (
        <div ref={transcriptRef} className="flex-1 min-h-0 overflow-y-auto bg-black/30 rounded p-2 text-sm flex flex-col gap-2">
          {transcript.length === 0 && <div className="text-gray-400 italic">No turns yet.</div>}
          {transcript.map((m, i) => {
            const hasEn = m.role === 'assistant' && !!m.textEn;
            const showEn = hasEn && englishIdxs.has(i);
            const body = showEn ? m.textEn! : m.text;
            return (
              <div
                key={i}
                className={`px-2 py-1 rounded ${
                  m.role === 'user' ? 'bg-blue-700/40 text-blue-100' : 'bg-white/15 text-gray-100'
                }`}
              >
                <span className="font-bold mr-1">{m.role === 'user' ? 'You:' : 'Tutor:'}</span>
                {hasEn && (
                  <button
                    onClick={() => toggleLang(i)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 ml-1 mr-1 align-middle"
                  >
                    {showEn ? 'HU' : 'EN'}
                  </button>
                )}
                {body}
              </div>
            );
          })}
        </div>
      )}

      <div className="animate-fadeIn">
        {phase === 'thinking' && (
          <div className="flex items-center justify-center gap-3 text-white">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Thinking...</span>
          </div>
        )}
        {phase === 'speaking' && (
          <div className="flex items-center justify-center gap-3 text-white">
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="font-medium">Speaking...</span>
          </div>
        )}
      </div>
    </div>
  );
}
