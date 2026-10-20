import { useCallback, useRef, useState } from 'react';

/**
 * Keeps the last non-null `value` after it turns null, until `clear()` (UI-R11 D7: the request
 * sheet slides out showing what it showed, then unmounts). `value` is the live value while there
 * is one, else the remembered one. A ref, not state: the value may be a fresh object every
 * render, and remembering it must not render again.
 */
export function useLingering<T>(value: T | null): {
  value: T | null;
  clear: () => void;
} {
  const last = useRef<T | null>(value);
  if (value !== null) last.current = value;
  const [, setCleared] = useState(0);
  const clear = useCallback(() => {
    last.current = null;
    setCleared(n => n + 1);
  }, []);
  return { value: value ?? last.current, clear };
}
