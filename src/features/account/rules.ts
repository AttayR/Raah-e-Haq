import type { DriverVehicle } from '../driver-profile/types';
import { APP_BUILD, APP_VERSION, IS_DEBUG_BUILD } from '../../config/env';
import { t } from '../../i18n';

/** Whether a `YYYY-MM-DD` (or ISO) licence expiry lies before today (local date). */
export const licenceExpired = (expiry: string | null | undefined, now: Date = new Date()): boolean => {
  if (!expiry) return false;
  const plain = /^(\d{4})-(\d{2})-(\d{2})/.exec(expiry);
  if (!plain) return false;
  const end = new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
  if (Number.isNaN(end.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return end.getTime() < today.getTime();
};

/**
 * Vehicle & documents needs the driver (shared-settings §4.1, shared-profile §P5): a vehicle the
 * reviewers rejected, or a licence past its expiry. `vehicles` null means "not known" (nothing
 * cached): only the licence counts then.
 */
export const documentsNeedAction = (
  vehicles: ReadonlyArray<Pick<DriverVehicle, 'status'>> | null,
  licenceExpiry: string | null | undefined,
  now: Date = new Date(),
): boolean => (vehicles ?? []).some((vehicle) => vehicle.status === 'rejected') || licenceExpired(licenceExpiry, now);

/** "Raah-e-Haq 0.0.1 (42) · Debug" (shared-settings §8). */
export const versionLine = (
  version: string = APP_VERSION,
  build: string | null = APP_BUILD,
  debug: boolean = IS_DEBUG_BUILD,
): string => {
  const base = build ? t('account.version', { version, build }) : t('account.versionNoBuild', { version });
  return debug ? `${base} · ${t('account.debugSuffix')}` : base;
};
