import type { RideResource } from '../../../services/rideService';
import { readNumberOrNull, readText } from '../../../core/api/read';
import { t } from '../../../i18n';
import { firstNameOf, formatDistance, formatMoney, formatTime } from '../../../utils/format';
import { driverSplitOf } from '../../fare/api';
import { formatRate } from '../../fare/format';
import { isParcelRide, parcelOf } from '../../parcel/api';
import type { ParcelView } from '../../parcel/types';
import { tripFareOf, tripStopsOf } from '../../active-ride/trip/tripModel';
import { cancelledByOf } from '../../active-ride/stage';
import { DRIVER_RIDE_COPY as COPY } from '../copy';
import { toRideSummary, type DriverRideStep } from '../steps';

/**
 * The driver trip sheet's words and numbers (UI-R13: driver-to-pickup DP2, driver-trip-in-progress
 * DT2, driver-trip-complete DC1), as pure functions of the ride the ~8 s poll already reads.
 * Nothing is estimated on the device: the ETA and its distance are the server's BE-128 `eta`, and
 * only for the point the driver is heading to now (BE-128 has no stop target, so the tile is
 * hidden while a stop is next). Money is the server's split (BE-84).
 */

/** The RideProgress step per driver step (TS4): to pickup 2, arrived 3, on trip 4 (0-based). */
const STEP_PROGRESS: Partial<Record<DriverRideStep, number>> = { to_pickup: 1, at_pickup: 2, on_trip: 3 };
export const driverProgressStep = (step: DriverRideStep): number | null => STEP_PROGRESS[step] ?? null;

/** The rider's (or sender's) first name, or null. */
export const riderNameOf = (ride: RideResource | null | undefined): string | null => firstNameOf(readText(ride?.passenger?.name));

export type DriverEta = { minutes: number; distanceKm: number | null };

/**
 * The server ETA to the current target: the pickup while heading there, the drop-off once no
 * stop is left. Null otherwise (arrived, a stop next, no `eta`), so the tile and the distance hide.
 */
export const driverEtaOf = (ride: RideResource | null | undefined, step: DriverRideStep): DriverEta | null => {
  const eta = ride?.eta;
  if (!ride || !eta || typeof eta !== 'object') return null;
  const minutes = readNumberOrNull(eta.minutes);
  if (minutes === null || minutes < 0) return null;
  const stopNext = tripStopsOf(ride).some((stop) => !stop.done);
  const wanted = step === 'to_pickup' ? 'pickup' : step === 'on_trip' && !stopNext ? 'dropoff' : null;
  if (wanted === null || eta.target !== wanted) return null;
  const km = readNumberOrNull(eta.distance_km);
  return { minutes: Math.max(1, Math.ceil(minutes)), distanceKm: km !== null && km >= 0 ? km : null };
};

export type DriverTarget = {
  kind: 'pickup' | 'stop' | 'dropoff';
  label: string;
  address: string;
  /** The stop's number (1-based) and how many stops the ride has. */
  stop: { n: number; total: number } | null;
};

/** Where the driver is heading now (TS6.1): the pickup, the next stop, or the drop-off. */
export const driverTargetOf = (ride: RideResource | null | undefined, step: DriverRideStep): DriverTarget | null => {
  if (!ride) return null;
  if (step === 'to_pickup' || step === 'at_pickup') return { kind: 'pickup', label: COPY.pickup, address: ride.pickup_address, stop: null };
  if (step !== 'on_trip') return null;
  const stops = tripStopsOf(ride);
  const next = stops.find((stop) => !stop.done);
  if (next) {
    return { kind: 'stop', label: COPY.stopOf(next.n, stops.length), address: next.address, stop: { n: next.n, total: stops.length } };
  }
  return { kind: 'dropoff', label: COPY.dropoff, address: ride.dropoff_address, stop: null };
};

export type DriverTripHeaderModel = {
  title: string;
  subtitle: string | null;
  tone: 'textSecondary' | 'warning';
  icon: 'offline' | null;
  /** The ETA tile's minutes; null hides it. */
  etaMinutes: number | null;
};

export type DriverHeaderInput = {
  step: DriverRideStep;
  ride: RideResource | null;
  offline: boolean;
  weakGps: boolean;
};

const parcelTripTitle = (parcel: ParcelView | null): string =>
  parcel?.status === 'returning' ? COPY.returnParcelTitle : COPY.deliverParcelTitle;

/** DP2 / DT2: the status sentence, the subtitle and the ETA for the live steps. */
export const driverTripHeader = ({ step, ride, offline, weakGps }: DriverHeaderInput): DriverTripHeaderModel => {
  const name = riderNameOf(ride);
  const parcelRide = isParcelRide(ride);
  const parcel = parcelOf(ride);
  const fareValue = tripFareOf(ride);
  const fare = fareValue !== null ? formatMoney(fareValue) : null;
  const eta = driverEtaOf(ride, step);
  const distance = eta?.distanceKm !== null && eta?.distanceKm !== undefined ? formatDistance(eta.distanceKm) : null;
  const target = driverTargetOf(ride, step);

  let title: string = COPY.unknown;
  let subtitle: string | null = null;
  if (step === 'to_pickup') {
    title = name && !parcelRide ? COPY.pickUpName(name) : COPY.toPickup;
    subtitle = fare ? (distance ? COPY.awayCash(distance, fare) : COPY.fareCash(fare)) : distance;
  } else if (step === 'at_pickup') {
    title = parcelRide ? COPY.atPickupParcel : name ? COPY.waitingFor(name) : COPY.atPickup;
    subtitle = ride?.arrived_at ? COPY.arrivedAt(formatTime(ride.arrived_at)) : null;
  } else if (step === 'on_trip') {
    if (target?.stop) title = COPY.headToStop(target.stop.n);
    else if (parcelRide) title = parcelTripTitle(parcel);
    else title = name ? COPY.dropOffName(name) : COPY.headToDropoff;
    if (parcelRide) {
      // T-561: the sender paid at the pickup; nothing is collected at the end.
      subtitle = distance ? COPY.toGo(distance) : null;
    } else if (fare) {
      subtitle = distance ? (target?.stop ? COPY.toGoCash(distance, fare) : COPY.toGoCollect(distance, fare)) : COPY.collectAtDropoff(fare);
    }
  }

  if (offline) {
    return { title, subtitle: step === 'on_trip' ? COPY.offlineComplete : COPY.offlineWait, tone: 'warning', icon: 'offline', etaMinutes: null };
  }
  if (weakGps) return { title, subtitle: COPY.weakGps, tone: 'warning', icon: null, etaMinutes: eta?.minutes ?? null };
  return { title, subtitle, tone: 'textSecondary', icon: null, etaMinutes: eta?.minutes ?? null };
};

export type MoneyRow = { key: string; label: string; value: string; strong?: boolean };

/**
 * TS6.3: Fare → booking fee → commission ({rate}) → You keep, only for the fields the server sent
 * (BE-84); null when there is neither a fare nor a net. The caption says what to collect.
 */
export const driverMoneyOf = (ride: RideResource | null | undefined): { rows: MoneyRow[]; caption: string | null } | null => {
  if (!ride) return null;
  const split = driverSplitOf(ride);
  const fareValue = split?.fare ?? tripFareOf(ride);
  if (fareValue === null && !split) return null;
  const rows: MoneyRow[] = [];
  if (fareValue !== null) rows.push({ key: 'fare', label: t('driverFare.fare'), value: formatMoney(fareValue) });
  if (split) {
    if (split.bookingFee > 0) rows.push({ key: 'booking-fee', label: t('driverFare.bookingFee'), value: formatMoney(-split.bookingFee) });
    rows.push({ key: 'commission', label: t('driverFare.commission', { rate: formatRate(split.commissionRate) }), value: formatMoney(-Math.abs(split.commissionAmount)) });
    rows.push({ key: 'net', label: COPY.youKeep, value: formatMoney(split.driverNet), strong: true });
  }
  const caption = isParcelRide(ride) ? t('parcel.senderPaidAtPickup') : fareValue !== null ? COPY.collectCaption(formatMoney(fareValue)) : null;
  return { rows, caption };
};

export type DriverReceiptModel = {
  title: string;
  /** "{km} · {min}" when the server sent them. */
  metrics: string | null;
  caption: string;
  total: number | null;
  /** BE-84 `driver_net`, else `driver_earnings`. */
  net: number | null;
  /** The commission rate for "after {rate}% commission" (null: no split). */
  rate: string | null;
  cash: boolean;
  parcel: boolean;
};

/** DC1: the completed trip's money and words (server totals only). */
export const driverReceiptOf = (ride: RideResource): DriverReceiptModel => {
  const summary = toRideSummary(ride);
  const parcel = isParcelRide(ride);
  const cash = summary.paymentMethod === null || summary.paymentMethod === 'cash';
  const name = riderNameOf(ride);
  const title = parcel ? (parcelOf(ride)?.status === 'returned' ? t('parcel.summaryReturned') : t('parcel.summaryDelivered')) : COPY.summary;
  const caption = parcel
    ? t('parcel.summaryCollected')
    : !cash
      ? `${COPY.collectOther} ${summary.paymentMethod}`
      : name
        ? COPY.collectFrom(name)
        : COPY.collectCash;
  const metrics = [
    summary.distanceKm !== null ? formatDistance(summary.distanceKm) : null,
    summary.durationMinutes !== null ? `${summary.durationMinutes} ${COPY.minutes}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const split = driverSplitOf(ride);
  return {
    title,
    metrics: metrics || null,
    caption,
    total: summary.totalFare,
    net: summary.driverEarnings,
    rate: split ? formatRate(split.commissionRate) : null,
    cash,
    parcel,
  };
};

/**
 * The ended-ride card (DP6 "Passenger cancelled"): a rider cancel says so; T-563 a parcel refused
 * at the pickup (or cancelled) says that; anything else is "no longer assigned to you".
 */
export const driverCancelledCopy = (
  ride: Pick<RideResource, 'cancellation_reason'> | null,
  parcel: Pick<ParcelView, 'refusalReason'> | null,
): { title: string; body: string } => {
  if (parcel) {
    return parcel.refusalReason
      ? { title: t('parcel.driverRefusedTitle'), body: t('parcel.driverRefusedBody') }
      : { title: t('parcel.driverCancelledTitle'), body: t('parcel.driverCancelledBody') };
  }
  if (ride && cancelledByOf(ride) === 'passenger') return { title: COPY.riderCancelledTitle, body: COPY.riderCancelledBody };
  return { title: COPY.cancelled, body: COPY.cancelledBody };
};
