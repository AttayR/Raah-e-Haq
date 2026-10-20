import { CACHE_NAMES, CACHE_TTL } from '../../core/api/queryCache';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { driverProfileApi } from './api';
import { DRIVER_PROFILE_COPY } from './copy';
import type { DriverVehicle } from './types';

const VEHICLES_CACHE = { name: CACHE_NAMES.profileVehicles, ttlMs: CACHE_TTL.profileVehicles } as const;

/**
 * The driver's vehicles (GET /profile/documents), read while the screen is focused, at most once
 * a minute across Profile and Vehicle & documents (UI-R17); pull to refresh always asks.
 */
export const useMyVehicles = (enabled: boolean): RemoteData<DriverVehicle[]> =>
  useRemoteData({ fetch: driverProfileApi.getVehicles, fallbackError: DRIVER_PROFILE_COPY.vehicleFailed, enabled, cache: VEHICLES_CACHE });
