// Typed key registry — no magic strings.
export const StorageKeys = {
  micDeviceId: 'agi.micDeviceId',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export function readStorage<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Swallow quota / private-mode errors.
  }
}

export function removeStorage(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Swallow private-mode errors.
  }
}
