import { t } from '../../i18n';
import { formatMoney } from '../../utils/format';
import { vehicleLabel } from '../ride-history/copy';
import type { AutoAcceptSettings, StepperLimits } from './api';

/**
 * Pure helpers for the auto-accept row, sheet and takeover (T-587, map-vehicles.md §7). Every
 * range comes from the server's `limits`.
 */

/** Decimals of a step (0.5 → 1, 10 → 0), so stepped values never drift (0.1 + 0.2). */
const decimalsOf = (step: number): number => {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
};

const roundTo = (value: number, decimals: number): number => Number(value.toFixed(decimals));

/** The value moved one step in `direction` within the limits (snapped to the step grid). */
export const stepValue = (value: number, limits: StepperLimits, direction: 1 | -1): number => {
  const decimals = decimalsOf(limits.step);
  const steps = Math.round((value - limits.min) / limits.step) + direction;
  const next = roundTo(limits.min + steps * limits.step, decimals);
  return Math.min(limits.max, Math.max(limits.min, next));
};

/** The stepper button in `direction` is enabled (not at the limit). */
export const canStep = (value: number, limits: StepperLimits, direction: 1 | -1): boolean =>
  direction === 1 ? value < limits.max : value > limits.min;

/** A value inside the limits (a saved value from before the limits changed is clamped). */
export const clampToLimits = (value: number, limits: StepperLimits): number =>
  Math.min(limits.max, Math.max(limits.min, value));

/** "2.5" / "2.0" when the step is fractional (§7.2: one decimal only then), else "2". */
export const formatPickupKm = (km: number, step: number): string =>
  decimalsOf(step) > 0 ? km.toFixed(1) : String(Math.round(km));

/** "Car, Car AC" in the active language. */
export const tierListText = (tiers: readonly string[]): string =>
  tiers.map((tier) => vehicleLabel(tier) ?? tier).join(', ');

/** The driver saved settings at least once (a minimum fare is stored). */
export const hasSavedSettings = (settings: AutoAcceptSettings): boolean => settings.minFare !== null;

/**
 * The Drive sheet row subtitle (§7.1 table). `online` counts the driver as online (also on a
 * ride). A server refusal shows the server's message.
 */
export const autoAcceptSubtitle = (settings: AutoAcceptSettings, online: boolean): string => {
  if (!settings.available && settings.unavailableMessage) {
    return settings.unavailableMessage;
  }
  const km = formatPickupKm(settings.maxPickupKm, settings.limits.maxPickupKm.step);
  const fare = formatMoney(settings.minFare ?? settings.limits.minFare.min);
  if (settings.enabled && settings.paused) {
    // A simulated ping or an implausible jump paused it (BE-120); the server's reason when sent.
    return settings.unavailableMessage ?? t('autoAccept.subtitlePaused');
  }
  if (settings.enabled) {
    return online
      ? t('autoAccept.subtitleOnOnline', { fare, km, tiers: tierListText(settings.effectiveTiers) })
      : t('autoAccept.subtitleOnOffline');
  }
  return hasSavedSettings(settings) ? t('autoAccept.subtitleOffSaved', { fare, km }) : t('autoAccept.subtitleNeverSet');
};

export interface AssignmentWatch {
  /** The driver was online with no ride before this ride appeared. */
  wasOnlineIdle: boolean;
  /** Auto-accept was on. */
  autoAcceptOn: boolean;
  /** The ride the driver accepted with their own tap, if any. */
  ownAcceptedRideId: number | null;
}

/**
 * Whether a ride that just appeared on the driver (restored after GET /driver/status said
 * `on_ride`) was accepted for them: it came while they were online and idle with auto-accept
 * on, it is still `accepted`, and it is not the ride they tapped Accept on.
 */
export const isAutoAssignedRide = (
  ride: { id: number; status: string },
  watch: AssignmentWatch,
): boolean =>
  watch.wasOnlineIdle && watch.autoAcceptOn && ride.status === 'accepted' && ride.id !== watch.ownAcceptedRideId;
