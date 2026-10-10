import { apiService } from '../../services/api';

/**
 * POST /tracking/update-location (BE-06, docs/api/CONTRACT_NOTES.md). Driver role only.
 * Body `{latitude, longitude, heading?, speed? (m/s), accuracy? (m)}`, all numbers; raw iOS -1
 * values are allowed (the server stores them as null). The driver comes from the token: never
 * send `driver_id` or `status`.
 * 201 on success; 409 `DRIVER_OFFLINE` when the server has the driver offline (nothing stored);
 * 429 with `retry_after` above 60 a minute.
 */
export const DRIVER_LOCATION_CODES = {
  driverOffline: 'DRIVER_OFFLINE',
} as const;

export interface DriverLocationBody {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export const driverLocationApi = {
  async post(body: DriverLocationBody): Promise<void> {
    await apiService.post<unknown>('/tracking/update-location', body);
  },
};
