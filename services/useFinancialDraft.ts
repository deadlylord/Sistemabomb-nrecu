import { useCallback, useMemo, useState } from 'react';

// Drafts survive a closed window. Scope includes user, company and store; IDs
// are generated once per row so a retry reuses its audit receipt.
export function useFinancialDraft<T>(key: string, initial: T): [T, (value: T | ((previous: T) => T)) => void] {
  const restored = useMemo(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; }
  }, [key]);
  const [state, setState] = useState({ key, value: restored });
  const value = state.key === key ? state.value : restored;
  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    setState(previous => {
      const base = previous.key === key ? previous.value : restored;
      const value = typeof next === 'function' ? (next as (value: T) => T)(base) : next;
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Saving still works when browser storage is unavailable. */ }
      return { key, value };
    });
  }, [key, restored]);
  return [value, setValue];
}
