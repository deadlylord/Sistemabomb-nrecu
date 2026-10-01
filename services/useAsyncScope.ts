import { useEffect, useRef } from 'react';

// Render-time invalidation handles A -> B -> A; cleanup handles unmounting.
// Separate hook instances allow independent chat and insight requests.
export function useAsyncScope(key: string) {
  const context = useRef({ key, active: true, request: 0 });
  if (context.current.key !== key) context.current = { key, active: true, request: 0 };
  useEffect(() => {
    const current = context.current;
    current.active = true;
    return () => { current.active = false; };
  }, [key]);
  return () => {
    const started = context.current;
    const request = ++started.request;
    return () => context.current === started && started.active && started.request === request;
  };
}
