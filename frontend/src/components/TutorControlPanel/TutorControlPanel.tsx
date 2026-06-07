import { useEffect, useRef, useState } from 'react';
import { TutorPhase, TutorTranscriptEntry } from '../../types/tutor.types';
import { ToggleSetting } from '../ToggleSetting/ToggleSetting';
import { BackButton } from '../BackButton';
import styles from './TutorControlPanel.module.css';

interface Props {
  phase: TutorPhase;
  sessionId: string | null;
  transcript: TutorTranscriptEntry[];
  micSelected: boolean;
  bankOnly: boolean;
  onBankOnlyChange: (v: boolean) => void;
  onStart: () => void;
  onBack: () => void;
}

interface TranslateResponse {
  translatedText: string;
}

const BANK_HINTS: readonly { label: string; say: string }[] = [
  { label: 'Skip question', say: 'say "skip"' },
  { label: 'Skip category', say: 'say "skip category"' },
  { label: 'List topics', say: 'say "what topics"' },
  { label: 'Jump to a topic', say: 'say a topic name or number' },
];

const BANK_TOPICS: readonly string[] = [
  'MAGÁRÓL',
  'CSALÁD',
  'Tanulás',
  'Munkahely',
  'Katonaság',
  'hobbi',
  'Tervei',
  'Utazás',
  'Nyelvtudás',
  'Magyarország',
  'Jogosítvány/ vezetői engedély',
  'állampolgárság',
  'Napirend',
  'Időjárás',
  'general',
  'Lakóhely',
];

export function TutorControlPanel({ phase, sessionId, transcript, micSelected, bankOnly, onBankOnlyChange, onStart, onBack }: Props) {
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
      <div className={styles['start-wrap']}>
        {bankOnly && (
          <div className={styles.hints}>
            <span className={styles['hints-title']}>Bank-only mode tips</span>
            {BANK_HINTS.map((h) => (
              <div className={styles['hint-row']} key={h.label}>
                <span className={styles['hint-label']}>{h.label}</span>
                <span className={styles['hint-say']}>{h.say}</span>
              </div>
            ))}
          </div>
        )}
        {bankOnly && (
          <div className={styles.topics}>
            <span className={styles['topics-title']}>Topics</span>
            {BANK_TOPICS.map((name, i) => (
              <div className={styles['topic-row']} key={name}>
                <span className={styles['topic-num']}>{i + 1}</span>
                <span className={styles['topic-name']}>{name}</span>
              </div>
            ))}
          </div>
        )}
        {!micSelected && <span className={styles.warning}>Select a microphone first</span>}
        <ToggleSetting label="Bank-only mode" checked={bankOnly} onChange={onBankOnlyChange} />
        <button
          onClick={onStart}
          disabled={!micSelected}
          className={styles['start-btn']}
        >
          Start Tutor
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles['header-row']}>
        <BackButton onClick={onBack} />
      </div>
      <div className={styles.controls}>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={styles['link-btn']}
        >
          {showHistory ? 'Hide' : 'Show'} transcript ({transcript.length})
        </button>
        <div className={styles['status-slot']}>
          {phase === 'thinking' && (
            <div className={styles['status-row']}>
              <div className={`${styles.spinner} animate-spin`} />
              <span className={styles.label}>Thinking...</span>
            </div>
          )}
          {phase === 'speaking' && (
            <div className={styles['status-row']}>
              <div className={styles.bars}>
                <div className={`${styles.bar} animate-bounce`} />
                <div className={`${styles.bar} animate-bounce`} />
                <div className={`${styles.bar} animate-bounce`} />
              </div>
              <span className={styles.label}>Speaking...</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setHideTutor((v) => !v)}
          className={styles['link-btn']}
        >
          {hideTutor ? 'Show' : 'Hide'} tutor
        </button>
      </div>

      {showHistory && (
        <div ref={transcriptRef} className={`scrollbar-milky ${styles.transcript}`}>
          {transcript.length === 0 && <div className={styles.empty}>No turns yet.</div>}
          {transcript.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            const showEn = isAssistant && englishIdxs.has(i);
            const loading = loadingIdxs.has(i);
            const en = translations[i] ?? m.textEn;
            const body = showEn ? (en ?? '') : m.text;
            return (
              <div
                key={i}
                className={`${styles.bubble} ${m.role === 'user' ? styles['bubble--user'] : styles['bubble--assistant']}`}
              >
                <span className={styles.role}>{m.role === 'user' ? 'You:' : 'Tutor:'}</span>
                {isAssistant && m.text && (
                  <button
                    onClick={() => toggleLang(i, m.text)}
                    className={styles.chip}
                    disabled={loading}
                  >
                    {showEn ? 'HU' : 'EN'}
                  </button>
                )}
                <span className={isAssistant && hideTutor ? styles.blur : ''}>
                  {showEn && loading && !en ? (
                    <span className={styles.translating}>
                      <span className={`${styles['spinner-inline']} animate-spin`} />
                      <span className={styles['translating-label']}>translating...</span>
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
