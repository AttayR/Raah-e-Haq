import { useEffect, useState } from 'react';
import type { RideResource } from '../../services/rideService';
import type { DriverRideStep } from './steps';

/**
 * "Passenger didn't come" (BE-85): after waiting `no_show_wait_minutes` at the pickup, the
 * driver's cancel ends the ride as a no-show with no strike. The server sends `no_show_cancel_at`
 * to the ride's driver once they arrived.
 */

/** Which cancel the driver is confirming: a normal one (a strike) or a passenger no-show. */
export type DriverCancelMode = 'strike' | 'no_show';

/** Epoch ms of `no_show_cancel_at`, or null (not arrived, older server, unreadable). */
export const noShowAtOf = (ride: Pick<RideResource, 'no_show_cancel_at'> | null | undefined): number | null => {
  const iso = ride?.no_show_cancel_at;
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * BE-109 (T-577): the no-show fee the server would really charge now, from the driver-only
 * `no_show_preview`: the fee when `fee_applies` (> 0), 0 when no fee would be charged (a daily
 * cap, an unverified arrival, fees off), null when not known (an older server without the key,
 * or not arrived yet). `fare_policy.cancel_fee` is only the rate card, never a promise.
 */
export const noShowFeeOf = (ride: Pick<RideResource, 'no_show_preview'> | null | undefined): number | null => {
  const preview = ride?.no_show_preview;
  if (preview === null || typeof preview !== 'object') return null;
  const fee = typeof preview.fee === 'string' ? Number(preview.fee) : preview.fee;
  return preview.fee_applies === true && typeof fee === 'number' && Number.isFinite(fee) && fee > 0 ? fee : 0;
};

/**
 * BE-109: what the cancel really charged (`cancellation_fee` on the POST /rides/{id}/cancel
 * answer, "0.00" when a cap made it free): the rupees when above 0, else null.
 */
export const chargedCancelFeeOf = (ride: Pick<RideResource, 'cancellation_fee'> | null | undefined): number | null => {
  const raw = ride?.cancellation_fee;
  const fee = typeof raw === 'string' ? Number(raw) : raw;
  return typeof fee === 'number' && Number.isFinite(fee) && fee > 0 ? fee : null;
};

/**
 * True once the driver may cancel as a no-show: at the pickup and past `no_show_cancel_at`. One
 * timeout fires at that moment (no ticking); it is cleared when the time or the ride changes and
 * on unmount.
 */
export const useNoShowReady = (ride: Pick<RideResource, 'no_show_cancel_at'> | null, step: DriverRideStep): boolean => {
  const at = step === 'at_pickup' ? noShowAtOf(ride) : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === null) return undefined;
    const wait = at - Date.now();
    if (wait <= 0) {
      setNow(Date.now());
      return undefined;
    }
    const timer = setTimeout(() => setNow(Date.now()), wait + 250);
    return () => clearTimeout(timer);
  }, [at]);
  return at !== null && now >= at;
};
