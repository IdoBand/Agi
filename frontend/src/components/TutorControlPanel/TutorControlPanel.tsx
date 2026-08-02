import { useEffect, useRef, useState } from 'react';
import { TutorPhase, TutorTranscriptEntry } from '../../types/tutor.types';
import { ToggleSetting } from '../ToggleSetting/ToggleSetting';
import { BackButton } from '../BackButton';
import { PanelIcon } from '../PanelIcon';
import { TricolorSpinner } from '../TricolorSpinner';
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
  onReplay: (i: number, chunks: string[]) => void;
  replayingIdx: number | null;
  onCollapseSidebar: () => void;
}

function SpeakerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={styles['speaker-icon']}
    >
      <polygon points="3,9 7,9 12,4 12,20 7,15 3,15" />
      <path d="M16 8a5 5 0 0 1 0 8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.icon}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.icon}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="4" y1="4" x2="20" y2="20" />
    </svg>
  );
}

interface TranslateResponse {
  translatedText: string;
}

interface CategoriesResponse {
  categories: string[];
}

const BANK_HINTS: readonly { label: string; say: string }[] = [
  { label: 'Skip question', say: 'say "skip"' },
  { label: 'Skip category', say: 'say "skip category"' },
  { label: 'List topics', say: 'say "what topics"' },
  { label: 'Jump to a topic', say: 'say a topic name or number' },
];

export function TutorControlPanel({ phase, sessionId, transcript, micSelected, bankOnly, onBankOnlyChange, onStart, onBack, onReplay, replayingIdx, onCollapseSidebar }: Props) {
  const [hideTutor, setHideTutor] = useState(false);
  const [englishIdxs, setEnglishIdxs] = useState<Set<number>>(new Set());
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [loadingIdxs, setLoadingIdxs] = useState<Set<number>>(new Set());
  const [bankTopics, setBankTopics] = useState<string[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bankOnly) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/quiz/categories');
        if (!res.ok) throw new Error(`categories failed: ${res.status}`);
        const data = (await res.json()) as CategoriesResponse;
        if (!cancelled) setBankTopics(data.categories);
      } catch (err) {
        console.error('[tutor] categories error', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bankOnly]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

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
            {bankTopics.map((name, i) => (
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
        <div className={styles['status-slot']}>
          {phase === 'thinking' && (
            <div className={styles['status-row']}>
              <div className={`${styles.spinner} animate-spin`} />
              <span className={styles.label}>Thinking...</span>
            </div>
          )}
          {phase === 'speaking' && (
            <div className={styles['status-row']}>
              <TricolorSpinner variant="hungary" />
              <span className={styles.label}>{replayingIdx !== null ? 'Replaying...' : 'Speaking...'}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setHideTutor((v) => !v)}
          className={styles['icon-btn']}
          aria-label={hideTutor ? 'Show tutor text' : 'Hide tutor text'}
          title={hideTutor ? 'Show tutor text' : 'Hide tutor text'}
        >
          {hideTutor ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <button
          onClick={onCollapseSidebar}
          className={styles['icon-btn']}
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <PanelIcon className={styles.icon} />
        </button>
      </div>

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
              <span className={styles.role}>{m.role === 'user' ? 'Me:' : 'Tutor:'}</span>
              {isAssistant && m.audio?.length ? (
                <button
                  type="button"
                  onClick={() => onReplay(i, m.audio ?? [])}
                  className={`${styles.speaker} ${replayingIdx === i ? styles['speaker--active'] : ''}`}
                  disabled={phase === 'speaking' || !m.audio?.length}
                  aria-label={replayingIdx === i ? 'Replaying message' : 'Replay message'}
                  title={
                    phase === 'speaking'
                      ? replayingIdx === i
                        ? 'Replaying…'
                        : 'Tutor is speaking…'
                      : 'Replay message'
                  }
                >
                  <SpeakerIcon />
                </button>
              ) : null}
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
    </div>
  );
}
