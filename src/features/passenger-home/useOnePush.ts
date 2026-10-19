import { useCallback, useEffect, useRef } from 'react';

/** A second tap within this long of a push is ignored (passenger-home § Services S8). */
export const ONE_PUSH_MS = 600;

/**
 * One push per tap (S8): `once(push)` runs `push` unless another one ran less than ONE_PUSH_MS
 * ago and the screen is still focused (a double tap on a tile or "Where to?" opened two screens).
 * Released when the screen loses focus (the push landed) or after ONE_PUSH_MS. Stable.
 */
export function useOnePush(focused: boolean): (push: () => void) => void {
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = useCallback(() => {
    busy.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    if (!focused) release();
  }, [focused, release]);
  useEffect(() => release, [release]);

  return useCallback(
    (push: () => void) => {
      if (busy.current) return;
      busy.current = true;
      timer.current = setTimeout(release, ONE_PUSH_MS);
      push();
    },
    [release],
  );
}
