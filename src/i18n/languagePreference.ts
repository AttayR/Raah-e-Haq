import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../core/logging/logger';
import { getLocale, isLocale, setLocale, subscribeLocale, type Locale } from './index';

/** AsyncStorage key of the chosen language (per device, not per account), like `rh.appearance`. */
export const LANGUAGE_STORAGE_KEY = 'rh.language';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'unknown');

/** Set once the user picks a language, so a slow storage read cannot overwrite the choice. */
let userChose = false;
/**
 * Set when the app opened before the stored language was read (LanguageGate timeout) and the
 * user then touched it: switching the language under them would be jarring, so a late read is
 * dropped (it applies on the next launch).
 */
let lateRestoreClosed = false;
let pendingRestore: Promise<Locale | null> | null = null;

/** The stored language, or null when none is stored, it is unknown, or storage fails. */
export async function readStoredLanguage(): Promise<Locale | null> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch (error) {
    logger.debug('[i18n] could not read the language preference', { error: errorMessage(error) });
    return null;
  }
}

/**
 * Reads the stored language once and makes it active (unless the user already picked one).
 * App.tsx starts it at load so it runs alongside the appearance read; LanguageGate awaits it.
 */
export function restoreStoredLanguage(): Promise<Locale | null> {
  if (!pendingRestore) {
    pendingRestore = readStoredLanguage().then(stored => {
      if (stored && !userChose && !lateRestoreClosed) {
        setLocale(stored);
      }
      return stored;
    });
  }
  return pendingRestore;
}

/** Drops a stored-language read that has not finished yet (see `lateRestoreClosed`). */
export const closeLateLanguageRestore = (): void => {
  lateRestoreClosed = true;
};

/** Switches the language now and persists it; a failed save keeps the choice for this session. */
export function changeLanguage(locale: Locale): void {
  userChose = true;
  setLocale(locale);
  (async () => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    } catch (error) {
      logger.debug('[i18n] could not save the language preference', { error: errorMessage(error) });
    }
  })();
}

/** The active language; the component re-renders when it changes. */
export const useLocale = (): Locale => useSyncExternalStore(subscribeLocale, getLocale, getLocale);

/** Test helper: forget the restore and the user's choice (module state survives between tests). */
export const resetLanguagePreferenceForTests = (): void => {
  userChose = false;
  lateRestoreClosed = false;
  pendingRestore = null;
  setLocale('en');
};
