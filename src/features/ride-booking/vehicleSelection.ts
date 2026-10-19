import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../core/logging/logger';
import type { VehicleOption } from './vehicleOptions';

/** The tier the passenger last requested (passenger-vehicle-fare.md: the default selection). */
export const LAST_VEHICLE_KEY = 'booking_last_vehicle';

let cached: Promise<string | null> | null = null;

/** Read once per app run; later reads share the answer. */
export const readLastVehicle = (): Promise<string | null> => {
  if (!cached) {
    cached = AsyncStorage.getItem(LAST_VEHICLE_KEY).catch((e: unknown) => {
      logger.debug('last vehicle read failed', e);
      return null;
    });
  }
  return cached;
};

/** Remember the requested tier for the next booking (fire and forget). */
export const saveLastVehicle = (key: string | undefined): void => {
  if (!key) return;
  cached = Promise.resolve(key);
  AsyncStorage.setItem(LAST_VEHICLE_KEY, key).catch((e: unknown) => logger.debug('last vehicle save failed', e));
};

/** Sign-out: forget the last requested tier, stored and cached (the next user starts fresh). */
export const clearLastVehicle = async (): Promise<void> => {
  cached = Promise.resolve(null);
  await AsyncStorage.removeItem(LAST_VEHICLE_KEY);
};

/** Tests: forget the cached read. */
export const __resetLastVehicleForTests = (): void => {
  cached = null;
};

/**
 * The option to select when nothing bookable is selected: the last requested tier while it is
 * priced, else the first priced option in the server's order. Null while nothing is priced.
 */
export const defaultVehicleChoice = (
  options: ReadonlyArray<VehicleOption>,
  selected: string | undefined,
  lastUsed: string | null,
): string | null => {
  const priced = options.filter((o) => o.fare !== null && !o.unavailable);
  if (priced.length === 0) return null;
  if (selected && priced.some((o) => o.id === selected)) return null;
  const last = lastUsed ? priced.find((o) => o.id === lastUsed) : undefined;
  return (last ?? priced[0]).id;
};

/**
 * Keeps a bookable tier selected on the choose-ride sheet (UI-R10): once prices are in, the last
 * requested tier (else the first priced one) is selected, and a selection that lost its price on a
 * new estimate moves to a priced one. The passenger's own pick is never overridden while priced.
 */
export const useDefaultVehicle = (
  options: ReadonlyArray<VehicleOption>,
  selected: string | undefined,
  select: (key: string) => void,
): void => {
  const [lastUsed, setLastUsed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    readLastVehicle().then((value) => {
      if (live) setLastUsed(value);
    });
    return () => {
      live = false;
    };
  }, []);
  const next = lastUsed === undefined ? null : defaultVehicleChoice(options, selected, lastUsed);
  useEffect(() => {
    if (next) select(next);
  }, [next, select]);
};
