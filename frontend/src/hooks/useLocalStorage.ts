import { useState, useCallback } from 'react';
import { readStorage, writeStorage, type StorageKey } from '../utils/storage';

export function useLocalStorage<T>(
  key: StorageKey,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));

  const setStoredValue = useCallback(
    (next: T) => {
      setValue(next);
      writeStorage(key, next);
    },
    [key],
  );

  return [value, setStoredValue];
}
