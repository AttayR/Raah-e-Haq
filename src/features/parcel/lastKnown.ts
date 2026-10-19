import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../core/logging/logger';

/**
 * UI-R20 (passenger-home § Services S7): whether the parcel tier was on at the last successful
 * catalogue read, kept on the device so Home's first frame after a cold start shows the right
 * header (service row or the ride-only heading) without waiting for the network. Not personal
 * data; kept across sign-out. `'1'` on, `'0'` off.
 */
export const PARCEL_TILE_STORAGE_KEY = 'rh.home.parcelTile';

let lastKnown: boolean | null = null;
/** A live catalogue answered this session: a slow storage read must not overwrite it. */
let answered = false;
let pendingRestore: Promise<void> | null = null;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'unknown');

/** The last known value: this session's catalogue, else the stored one; null when never known. */
export const lastKnownParcelTile = (): boolean | null => lastKnown;

/**
 * Reads the stored value once. App start runs it in the same pass as the language read
 * (LanguageGate), so Home never waits on it. Never rejects.
 */
export function restoreParcelTile(): Promise<void> {
  if (!pendingRestore) {
    pendingRestore = (async () => {
      try {
        const stored = await AsyncStorage.getItem(PARCEL_TILE_STORAGE_KEY);
        if (!answered && (stored === '1' || stored === '0')) lastKnown = stored === '1';
      } catch (error) {
        logger.debug('[parcel] could not read the last known parcel tier', { error: errorMessage(error) });
      }
    })();
  }
  return pendingRestore;
}

/** A catalogue read succeeded: keep its answer, and store it only when it changed. */
export function rememberParcelTile(available: boolean): void {
  answered = true;
  if (lastKnown === available) return;
  lastKnown = available;
  AsyncStorage.setItem(PARCEL_TILE_STORAGE_KEY, available ? '1' : '0').catch((error: unknown) => {
    logger.debug('[parcel] could not store the last known parcel tier', { error: errorMessage(error) });
  });
}

/** Test helper: forget what is known (module state survives between tests). */
export const resetParcelTileForTests = (): void => {
  lastKnown = null;
  answered = false;
  pendingRestore = null;
};
