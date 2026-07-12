import { useEffect, useRef, useState } from 'react';
import { AVATAR_PROFILES, getAvatarProfile } from '../../utils/avatarProfiles';
import styles from './AvatarPicker.module.css';

interface Props {
  avatarId: string;
  onAvatarChange: (id: string) => void;
}

export function AvatarPicker({ avatarId, onAvatarChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const current = getAvatarProfile(avatarId);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.header}>Select your tutor</div>
      <button onClick={() => setOpen((v) => !v)} className={styles.trigger}>
        <span>{current.label}</span>
        <span className={`${styles.caret} ${open ? styles['caret--open'] : ''}`}>▾</span>
      </button>
      {open && (
        <div className={`${styles.menu} scrollbar-milky`}>
          {Object.values(AVATAR_PROFILES).map((profile) => (
            <button
              key={profile.id}
              onClick={() => {
                onAvatarChange(profile.id);
                setOpen(false);
              }}
              className={`${styles['menu-item']} ${profile.id === avatarId ? styles['menu-item--selected'] : ''}`}
            >
              {profile.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
