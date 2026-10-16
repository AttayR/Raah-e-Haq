import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Whether a booking search field is focused, so the sheet drops its extras and the suggestions
 * get the room (compact mode). T-553 (QA 2026-10-16): it stayed true after a suggestion pick or
 * Back, because the focused field unmounted with its step and never reported the blur. It now
 * resets when the step changes (`resetKey`) and when the keyboard hides.
 */
export const useSearchFocus = (resetKey: string) => {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setFocused(false);
  }, [resetKey]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setFocused(false));
    return () => sub.remove();
  }, []);

  return [focused, setFocused] as const;
};
