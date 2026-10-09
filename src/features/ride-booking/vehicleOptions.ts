import type { VehicleOption } from '../../components/passenger/VehicleOptions';
import type { VehicleTypeKey } from '../../services/rideService';
import type { FareEstimate, FareEstimates, VehicleType } from './api';
import { BOOKING_COPY } from './copy';

/** Artwork per catalogue key (the server's `icon` is the key itself, BE-05). */
const VEHICLE_ICONS: Record<VehicleTypeKey, string> = {
  car: '🚗',
  bike: '🏍️',
  rickshaw: '🛺',
  van: '🚐',
};

export const vehicleIcon = (key: VehicleTypeKey): string => VEHICLE_ICONS[key];

/** "Rs 250" for PKR, otherwise the currency code. Whole units, as the server quotes them. */
export const formatFare = (amount: number, currency = 'PKR'): string =>
  `${currency === 'PKR' ? 'Rs' : currency} ${Math.round(amount)}`;

/**
 * The vehicle list: one option per catalogue entry, priced from the matching estimate (by
 * vehicle_type). No local multipliers: a type without a quote shows no price.
 */
export const toVehicleOptions = (types: ReadonlyArray<VehicleType>, estimates: FareEstimates | null): VehicleOption[] =>
  types.map((type) => {
    const quote = estimates?.estimates.find((e) => e.vehicle_type === type.key);
    return {
      id: type.key,
      name: type.label,
      desc: BOOKING_COPY.seats(type.capacity),
      price: quote ? formatFare(quote.fare, quote.currency) : BOOKING_COPY.fareUnavailable,
      icon: vehicleIcon(type.key),
    };
  });

/** FareDetails rows from the server breakdown (they add up to the quoted fare). */
export const fareBreakdownRows = (
  quote: FareEstimate,
  route: Pick<FareEstimates, 'distance_km' | 'duration_min'>,
): { label: string; value: string }[] => {
  const money = (n: number) => formatFare(n, quote.currency);
  const b = quote.breakdown;
  return [
    { label: BOOKING_COPY.breakdownBase, value: money(b.base) },
    { label: BOOKING_COPY.breakdownDistance(route.distance_km), value: money(b.distance) },
    { label: BOOKING_COPY.breakdownTime(route.duration_min), value: money(b.time) },
    ...(b.stops > 0 ? [{ label: BOOKING_COPY.breakdownStops, value: money(b.stops) }] : []),
    ...(b.min_fare_adjustment > 0 ? [{ label: BOOKING_COPY.breakdownMinimum, value: money(b.min_fare_adjustment) }] : []),
  ];
};
