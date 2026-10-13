import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { driverProfileApi } from './api';
import { DRIVER_PROFILE_COPY } from './copy';
import type { DriverVehicle } from './types';

/** The driver's vehicles (GET /profile/documents), read while the screen is focused. */
export const useMyVehicles = (enabled: boolean): RemoteData<DriverVehicle[]> =>
  useRemoteData({ fetch: driverProfileApi.getVehicles, fallbackError: DRIVER_PROFILE_COPY.vehicleFailed, enabled });
