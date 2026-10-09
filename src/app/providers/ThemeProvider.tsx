import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, LightTheme, type AppTheme, type ColorMode } from '../../theme';
import { logger } from '../../core/logging/logger';

/** User appearance preference (Settings -> Appearance, DESIGN_SYSTEM §1.6). */
export type AppearancePreference = 'system' | 'light' | 'dark';

/** AsyncStorage key of the persisted preference (per device, not per account). */
export const APPEARANCE_STORAGE_KEY = 'rh.appearance';

/**
 * Children are held (the splash stays up) until the stored preference is read, so a forced
 * Light/Dark choice never flashes the system scheme on cold start. A slow read never blocks
 * startup longer than this.
 */
export const APPEARANCE_READ_TIMEOUT_MS = 500;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'unknown');

const isPreference = (value: unknown): value is AppearancePreference =>
  value === 'system' || value === 'light' || value === 'dark';

/** The colour mode to render for a preference and the current system scheme. */
export const resolveColorMode = (
  preference: AppearancePreference,
  system: string | null | undefined,
): ColorMode => {
  if (preference !== 'system') {
    return preference;
  }
  return system === 'dark' ? 'dark' : 'light';
};

type ThemeContextValue = {
  theme: AppTheme;
  /** The stored preference ('system' until the user picks one). */
  scheme: AppearancePreference;
  /** Changes and persists the preference. */
  setScheme: (preference: AppearancePreference) => void;
};

const ThemeCtx = createContext<ThemeContextValue>({
  theme: LightTheme,
  scheme: 'system',
  setScheme: () => {},
});

export function ThemeProvider({ children }: React.PropsWithChildren) {
  // useColorScheme subscribes to Appearance changes, so a system switch re-renders the tree.
  const systemScheme = useColorScheme();
  const [scheme, setSchemeState] = useState<AppearancePreference>('system');
  // Set once the user picks a preference, so a slow storage read cannot overwrite it.
  const userChose = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        logger.debug('[theme] appearance preference read timed out', { timeoutMs: APPEARANCE_READ_TIMEOUT_MS });
        setReady(true);
      }
    }, APPEARANCE_READ_TIMEOUT_MS);
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
        // Applied even after the timeout: a late read still restores the user's choice.
        if (active && !userChose.current && isPreference(stored)) {
          setSchemeState(stored);
        }
      } catch (error) {
        // Storage unavailable: keep following the system scheme.
        logger.debug('[theme] could not read appearance preference', { error: errorMessage(error) });
      } finally {
        if (active) {
          clearTimeout(timer);
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const setScheme = useCallback((preference: AppearancePreference) => {
    userChose.current = true;
    setSchemeState(preference);
    (async () => {
      try {
        await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
      } catch (error) {
        // Not persisted; the choice still applies for this session.
        logger.debug('[theme] could not save appearance preference', { error: errorMessage(error) });
      }
    })();
  }, []);

  const mode = resolveColorMode(scheme, systemScheme);
  const value = useMemo(() => ({ theme: themes[mode], scheme, setScheme }), [mode, scheme, setScheme]);

  return <ThemeCtx.Provider value={value}>{ready ? children : null}</ThemeCtx.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeCtx);
}

/** @deprecated alias of `useAppTheme`. */
export const useTheme = useAppTheme;
