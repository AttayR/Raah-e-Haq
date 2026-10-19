import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The Request button's tap (T-574). Switching to the ride panel is a heavy render, and on a slow
 * phone the tap showed nothing for about a second. `confirm` first shows the button's loading
 * state; the request itself starts two frames later, once that state is on screen. A second tap
 * in between sends nothing.
 */
export const useConfirmRequest = (start: () => void): { confirming: boolean; confirm: () => void } => {
  const [confirming, setConfirming] = useState(false);
  const pendingRef = useRef(false);
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    if (!confirming) return undefined;
    let second: number | null = null;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        second = null;
        pendingRef.current = false;
        setConfirming(false);
        startRef.current();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      if (second !== null) cancelAnimationFrame(second);
    };
  }, [confirming]);

  const confirm = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setConfirming(true);
  }, []);

  return { confirming, confirm };
};
