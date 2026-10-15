import { useEffect, useState } from 'react';
import type { RideResource } from '../../services/rideService';
import { toFarePolicy } from '../fare/api';
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
 * The no-show fee the passenger would pay, only while fees are on (BE-85 `fare_policy`); null
 * otherwise, so the sheet never promises a charge the server will not make.
 */
export const noShowFeeOf = (ride: Pick<RideResource, 'fare_policy'> | null | undefined): number | null => {
  const policy = toFarePolicy(ride?.fare_policy);
  return policy && policy.feesEnabled && policy.cancelFee > 0 ? policy.cancelFee : null;
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
