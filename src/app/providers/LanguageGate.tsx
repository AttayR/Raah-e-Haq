import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { closeLateLanguageRestore, restoreStoredLanguage } from '../../i18n/languagePreference';
import { logger } from '../../core/logging/logger';
import { restoreParcelTile } from '../../features/parcel/lastKnown';
// Registers the Roman Urdu translations of the feature copy objects (T-523).
import '../../i18n/copy-ur-Latn';

/**
 * Like the appearance read (ThemeProvider), a slow language read never holds startup longer
 * than this.
 */
export const LANGUAGE_READ_TIMEOUT_MS = 500;

type LanguageGateProps = React.PropsWithChildren<{
  /** Shown while the stored language is read (the app passes its splash). Default: nothing. */
  fallback?: React.ReactNode;
}>;

type GateState = 'reading' | 'ready' | 'timedOut';

/**
 * Holds the app (the splash stays up) until the stored language is active, so a Roman Urdu user
 * never sees an English first frame (T-523). After the timeout the app opens in English; a late
 * read still applies, unless the user has touched the app by then (it would switch the language
 * under them mid-tap or mid-typing), in which case it applies on the next launch.
 */
export function LanguageGate({ children, fallback = null }: LanguageGateProps) {
  const [state, setState] = useState<GateState>('reading');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        logger.debug('[i18n] language preference read timed out', { timeoutMs: LANGUAGE_READ_TIMEOUT_MS });
        setState('timedOut');
      }
    }, LANGUAGE_READ_TIMEOUT_MS);
    // UI-R20 (passenger-home S7): the last known parcel tier is read in the same pass, so Home's
    // first frame already shows the right header. It never rejects and never holds the app alone.
    Promise.all([restoreStoredLanguage(), restoreParcelTile()]).finally(() => {
      if (active) {
        clearTimeout(timer);
        setState(current => (current === 'reading' ? 'ready' : current));
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (state === 'reading') {
    return <>{fallback}</>;
  }
  if (state === 'timedOut') {
    // Decided once, when the gate opens, so this wrapper never appears or goes later.
    return (
      <View style={styles.fill} onTouchStart={closeLateLanguageRestore} testID="language-gate-late">
        {children}
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
