let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

// Must be invoked from a user-gesture handler so the browser allows resume.
export function ensureAudioContextRunning(): void {
  const c = getAudioContext();
  if (c.state === 'suspended') {
    void c.resume();
  }
}
