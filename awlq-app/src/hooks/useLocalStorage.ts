"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storageState, setStorageState] = useState<{ value: T; hydrated: boolean }>({
    value: initialValue,
    hydrated: false,
  });

  useEffect(() => {
    let nextValue = initialValue;

    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        nextValue = JSON.parse(raw) as T;
      }
    } catch {
      nextValue = initialValue;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageState({ value: nextValue, hydrated: true });
  }, [initialValue, key]);

  useEffect(() => {
    if (!storageState.hydrated) {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(storageState.value));
  }, [key, storageState.hydrated, storageState.value]);

  const setValue: Dispatch<SetStateAction<T>> = useCallback((next) => {
    setStorageState((prev) => {
      const value = typeof next === "function" ? (next as (current: T) => T)(prev.value) : next;
      return { ...prev, value };
    });
  }, []);

  return { value: storageState.value, setValue, hydrated: storageState.hydrated };
}
