import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether a booking search field is focused, so the sheet drops its extras and the suggestions
 * get the room (compact mode). T-553 (QA 2026-10-16): it stayed true after a suggestion pick or
 * Back, because the focused field unmounted with its step and never reported the blur. It now
 * resets when the step changes (`resetKey`) and when the keyboard hides.
 * T-554: Android's hardware Back hides the keyboard but leaves the field focused, so tapping it
 * again opened the keyboard without a new focus event and the sheet stayed full. The field is
 * blurred when the keyboard hides, so the next tap focuses it (and compacts the sheet) again.
 * Only on Android and only when a booking search field was focused: the screen stays mounted
 * under Chat/SOS, so a blanket dismiss would blur unrelated inputs.
 */
export const useSearchFocus = (resetKey: string) => {
  const [focused, setFocusedState] = useState(false);
  const focusedRef = useRef(false);
  const setFocused = useCallback((next: boolean) => {
    focusedRef.current = next;
    setFocusedState(next);
  }, []);

  useEffect(() => {
    setFocused(false);
  }, [resetKey, setFocused]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      const searchWasFocused = focusedRef.current;
      setFocused(false);
      // Blurs the booking search field that Android Back left focused.
      if (searchWasFocused && Platform.OS === 'android') Keyboard.dismiss();
    });
    return () => sub.remove();
  }, [setFocused]);

  return [focused, setFocused] as const;
};
