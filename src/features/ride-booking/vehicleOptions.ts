import type { FareBreakdownInput } from '../../components/ui';
import { vehicleMeta } from '../../components/ui';
import type { VehicleTypeKey } from '../../services/rideService';
import type { FareEstimate, FareEstimates, VehicleType } from './api';
import { formatMoney } from '../../utils/format';

/** One row of the vehicle list (VehicleOptionCard props), built only from server data. */
export type VehicleOption = {
  id: VehicleTypeKey;
  name: string;
  /** "4 seats" (a pickup ETA joins it once the server sends one, T-310). */
  meta: string | null;
  /** The quoted fare, or null while there is no quote. */
  fare: string | null;
  /** The estimate is in but has no quote for this type: it cannot be booked. */
  unavailable: boolean;
};

/** The app-wide money format (`Rs 1,250`, src/utils/format); kept as the booking flow's name. */
export const formatFare = (amount: number, currency = 'PKR'): string => formatMoney(amount, currency);

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
      meta: vehicleMeta(type.capacity),
      fare: quote ? formatFare(quote.fare, quote.currency) : null,
      unavailable: !!estimates && !quote,
    };
  });

/**
 * The quote's server breakdown in the kit FareBreakdown shape (it adds up to the quoted fare).
 * `offerAdjustment` is the passenger's offer less the server fare (BE-83), so the rows add up to
 * the offer instead.
 */
export const quoteBreakdown = (quote: FareEstimate, offerAdjustment = 0): FareBreakdownInput => ({
  base: quote.breakdown.base,
  distance: quote.breakdown.distance,
  time: quote.breakdown.time,
  stops: quote.breakdown.stops,
  minFareAdjustment: quote.breakdown.min_fare_adjustment,
  bookingFee: quote.breakdown.booking_fee,
  offerAdjustment,
});
