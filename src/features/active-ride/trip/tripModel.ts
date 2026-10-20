import type { DriverLocation, RideResource } from '../../../services/rideService';
import { readNumberOrNull } from '../../../core/api/read';
import { componentTokens } from '../../../theme';
import { t } from '../../../i18n';
import { formatDistance, formatDuration, formatMoney, formatTime } from '../../../utils/format';
import { cancellationFeeText } from '../../fare/format';
import { isParcelRide } from '../../parcel/api';
import { parcelStatusText } from '../../parcel/rules';
import type { ParcelView } from '../../parcel/types';
import { ACTIVE_RIDE_COPY } from '../copy';
import { cancelledByOf, driverCardOf, type PassengerRideStage } from '../stage';

/**
 * The passenger trip sheet's words and numbers (UI-R12: passenger-driver-assigned PA2,
 * passenger-trip-in-progress PT2, passenger-trip-complete PR2/PR5), as pure functions of the ride
 * the poll already reads. Nothing is estimated on the device: the ETA is the server's BE-128
 * `eta`, hidden when it is missing (never `estimated_arrival`).
 */

/** The trip stages that use the trip sheet (searching keeps the booking sheet). */
export const TRIP_STAGES: ReadonlyArray<PassengerRideStage> = ['driver_en_route', 'driver_arrived', 'in_trip', 'completed', 'cancelled'];
export const isTripStage = (stage: PassengerRideStage | null | undefined): stage is PassengerRideStage =>
  !!stage && TRIP_STAGES.includes(stage);

/** The first comma-separated part of an address ("Liberty Market, Gulberg III, Lahore" → "Liberty Market"). */
export const shortPlace = (address: string | null | undefined): string => {
  const text = typeof address === 'string' ? address.trim() : '';
  const first = text.split(',')[0]?.trim() ?? '';
  return first || text;
};

/** The server ETA in minutes for this stage's target (BE-128), or null (hidden, never guessed). */
export const rideEtaMinutes = (ride: Pick<RideResource, 'eta'> | null | undefined, stage: PassengerRideStage): number | null => {
  const eta = ride?.eta;
  if (!eta || typeof eta !== 'object') return null;
  const minutes = readNumberOrNull(eta.minutes);
  if (minutes === null || minutes < 0) return null;
  const wanted = stage === 'driver_en_route' ? 'pickup' : stage === 'in_trip' ? 'dropoff' : null;
  return wanted !== null && eta.target === wanted ? Math.max(1, Math.ceil(minutes)) : null;
};

/** Seconds since the driver's position was last seen (GET /rides/{id}/driver-location), or null. */
export const locationAgeSeconds = (location: Pick<DriverLocation, 'last_seen_at'> | null | undefined, now: number): number | null => {
  const at = location?.last_seen_at ? Date.parse(location.last_seen_at) : NaN;
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 1000)) : null;
};

/** The ride's stops in order with their number (1-based) and state for the trip sheet. */
export type TripStop = { id: number; n: number; address: string; done: boolean };
export const tripStopsOf = (ride: Pick<RideResource, 'stops'> | null | undefined): TripStop[] =>
  [...(ride?.stops ?? [])]
    .filter((stop) => stop.status !== 'cancelled')
    .sort((a, b) => a.stop_order - b.stop_order)
    .map((stop, i) => ({ id: stop.id, n: i + 1, address: stop.address, done: stop.status !== 'active' }));

export type TripHeader = {
  title: string;
  subtitle: string | null;
  tone: 'textSecondary' | 'textMuted' | 'warning';
  icon: 'offline' | null;
  /** The ETA tile's minutes; null hides it. */
  etaMinutes: number | null;
};

export type TripHeaderInput = {
  stage: PassengerRideStage;
  ride: RideResource | null;
  parcel: ParcelView | null;
  offline: boolean;
  /** Seconds since the driver's last position (null: unknown, not shown). */
  locationAge: number | null;
  now: number;
};

const toNumber = (value: unknown): number | null => readNumberOrNull(value);

/** T-561: the sender hands the parcel over and pays the locked (else quoted) fare at the pickup. */
export const handOverText = (ride: RideResource | null): string => {
  const fare = toNumber(ride?.accepted_fare) ?? toNumber(ride?.total_fare);
  return fare !== null ? t('parcel.senderHandOver', { amount: formatMoney(fare) }) : t('parcel.senderHandOverNoFare');
};

const CANCELLED_BY = (): Record<'passenger' | 'driver' | 'system', string> => ({
  passenger: ACTIVE_RIDE_COPY.cancelledByPassenger,
  driver: ACTIVE_RIDE_COPY.cancelledByDriver,
  system: ACTIVE_RIDE_COPY.cancelledBySystem,
});

/** T-580: a cancelled parcel says "delivery", whoever cancelled it. */
const PARCEL_CANCELLED_BY = (): Record<'passenger' | 'driver' | 'system', string> => ({
  passenger: t('parcel.senderCancelledByYou'),
  driver: t('parcel.senderCancelledByRider'),
  system: t('parcel.senderCancelledBySystem'),
});

/** Who cancelled, and the BE-85 fee line when the passenger was charged. */
export const cancelledSubtitle = (ride: RideResource | null, parcel: ParcelView | null): string => {
  if (!ride) return ACTIVE_RIDE_COPY.cancelledBySystem;
  const by = cancelledByOf(ride);
  const outcome = parcel?.refusalReason ? t('parcel.senderRefused') : isParcelRide(ride) ? PARCEL_CANCELLED_BY()[by] : CANCELLED_BY()[by];
  const fee = cancellationFeeText(toNumber(ride.cancellation_fee), ride.cancellation_charge_reason ?? null);
  return fee ? `${outcome} ${fee}` : outcome;
};

/** "6:12 PM · 8.4 km · 23 min"; the parts the API lacks are dropped (PR2). */
export const receiptSubtitle = (ride: RideResource | null): string | null => {
  if (!ride) return null;
  const km = toNumber(ride.distance_km);
  const min = toNumber(ride.duration_minutes);
  const parts = [
    ride.completed_at ? formatTime(ride.completed_at) : '',
    km !== null && km > 0 ? formatDistance(km) : '',
    min !== null && min > 0 ? formatDuration(min) : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
};

/** "{driver first name} · {plate}" (the trip subtitle without an ETA). */
const driverAndPlate = (ride: RideResource | null): string | null => {
  if (!ride) return null;
  const card = driverCardOf(ride);
  const parts = [card.name, card.plate].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' · ') : null;
};

const STALE_AFTER = componentTokens.tripSheet.staleLocationSeconds;

/**
 * Title, subtitle (and its tone) and ETA of the trip sheet's status header for one stage. A
 * driver position older than 60 s or being offline replaces the subtitle and hides the ETA.
 */
export const passengerTripHeader = ({ stage, ride, parcel, offline, locationAge, now }: TripHeaderInput): TripHeader => {
  const live = stage === 'driver_en_route' || stage === 'driver_arrived' || stage === 'in_trip';
  const stale = live && stage !== 'driver_arrived' && locationAge !== null && locationAge > STALE_AFTER;
  let title: string;
  let subtitle: string | null = null;
  let etaMinutes = rideEtaMinutes(ride, stage);
  switch (stage) {
    case 'driver_en_route':
      title = parcel ? parcelStatusText(parcel.status) : ACTIVE_RIDE_COPY.driverEnRouteTitle;
      subtitle = ride ? ACTIVE_RIDE_COPY.meetAt(shortPlace(ride.pickup_address)) : null;
      break;
    case 'driver_arrived':
      title = parcel ? parcelStatusText(parcel.status) : ACTIVE_RIDE_COPY.driverArrivedTitle;
      subtitle = parcel ? handOverText(ride) : ride ? ACTIVE_RIDE_COPY.meetDriverAt(shortPlace(ride.pickup_address)) : null;
      etaMinutes = null;
      break;
    case 'in_trip': {
      const next = tripStopsOf(ride).find((stop) => !stop.done) ?? null;
      if (parcel) {
        title = parcelStatusText(parcel.status);
      } else if (next) {
        title = ACTIVE_RIDE_COPY.headingToStop(next.n);
      } else {
        title = ACTIVE_RIDE_COPY.headingTo(shortPlace(ride?.dropoff_address));
      }
      // BE-128 targets the final drop-off only: with a stop still ahead its number would mislead.
      if (next) etaMinutes = null;
      subtitle = next
        ? shortPlace(next.address)
        : etaMinutes !== null
          ? ACTIVE_RIDE_COPY.arrivingAt(formatTime(new Date(now + etaMinutes * 60_000)))
          : driverAndPlate(ride);
      break;
    }
    case 'completed':
      title = parcel ? parcelStatusText(parcel.status) : ACTIVE_RIDE_COPY.arrivedTitle;
      // T-574: a parcel was sent, not ridden.
      subtitle = isParcelRide(ride) ? t('parcel.senderCompleted') : receiptSubtitle(ride);
      etaMinutes = null;
      break;
    case 'cancelled':
      // UI-R12 r3: a parcel was a delivery, not a ride.
      title = isParcelRide(ride) ? t('parcel.cancelledTitle') : ACTIVE_RIDE_COPY.cancelledTitle;
      subtitle = cancelledSubtitle(ride, parcel);
      etaMinutes = null;
      break;
    default:
      title = ACTIVE_RIDE_COPY.findingTitle;
      etaMinutes = null;
  }
  if (live && offline) {
    return { title, subtitle: ACTIVE_RIDE_COPY.offlineLastUpdate, tone: 'warning', icon: 'offline', etaMinutes: null };
  }
  if (stale && locationAge !== null) {
    const minutes = Math.max(1, Math.floor(locationAge / 60));
    return { title, subtitle: ACTIVE_RIDE_COPY.locationStale(minutes), tone: 'textMuted', icon: null, etaMinutes: null };
  }
  return { title, subtitle, tone: 'textSecondary', icon: null, etaMinutes };
};

/** The fare the passenger pays on the trip: `accepted_fare`, else `total_fare` (TS6.2). */
export const tripFareOf = (ride: Pick<RideResource, 'accepted_fare' | 'total_fare'> | null | undefined): number | null =>
  toNumber(ride?.accepted_fare) ?? toNumber(ride?.total_fare);
