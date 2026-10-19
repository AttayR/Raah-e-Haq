/** Shared test fixtures (not a test file). GET /driver/auto-accept `data` as the local backend sends it. */
import { toAutoAcceptSettings, type AutoAcceptSettings } from '../src/features/driver-auto-accept/api';

export const autoAcceptData = (overrides: Record<string, unknown> = {}) => ({
  enabled: false,
  min_fare: null,
  max_pickup_km: 2,
  tiers: null,
  effective_tiers: ['car', 'car_ac'],
  eligible_tiers: ['car', 'car_ac'],
  women_passengers_only: null,
  available: true,
  unavailable_code: null,
  unavailable_message: null,
  paused: false,
  limits: { min_fare: { min: 0, max: 5000, step: 10 }, max_pickup_km: { min: 0.5, max: 3, step: 0.5, default: 2 } },
  window_seconds: 15,
  ...overrides,
});

export const makeAutoAcceptSettings = (overrides: Record<string, unknown> = {}): AutoAcceptSettings => {
  const mapped = toAutoAcceptSettings(autoAcceptData(overrides));
  if (!mapped) throw new Error('auto-accept fixture did not map');
  return mapped;
};
