import type { OfferBand } from './types';

/**
 * "Offer your fare" (BE-83, like inDrive within a band): the passenger moves the offer with - / +
 * by the band's `step`, never outside `min`..`max`. Any whole rupee in the band is accepted by
 * the server, so a value off the step grid (the server fare itself, Rs 152) is fine.
 */

export type OfferDirection = 1 | -1;

/** A whole-rupee offer inside the band. */
export const clampOffer = (band: OfferBand, value: number): number => {
  const n = Number.isFinite(value) ? Math.round(value) : band.serverFare;
  return Math.min(band.max, Math.max(band.min, n));
};

/** The offer one step up or down, stopping at the band's edge. */
export const stepOffer = (band: OfferBand, value: number, direction: OfferDirection): number =>
  clampOffer(band, clampOffer(band, value) + direction * band.step);

/** False at the edge the button would move past (the button is disabled there). */
export const canStepOffer = (band: OfferBand, value: number, direction: OfferDirection): boolean => {
  const current = clampOffer(band, value);
  return direction === 1 ? current < band.max : current > band.min;
};

/**
 * What POST /rides gets as `offered_fare`: the offer when it differs from the server fare, else
 * nothing (the server fare is the default; no band means offers are off).
 */
export const offeredFareFor = (band: OfferBand | null, value: number | null): number | null => {
  if (!band || value === null) return null;
  const offer = clampOffer(band, value);
  return offer === band.serverFare ? null : offer;
};

/** The signed difference to the server fare ("+Rs 20" / "−Rs 10"), 0 without an offer. */
export const offerDifference = (band: OfferBand | null, value: number | null): number => {
  const offer = offeredFareFor(band, value);
  return band && offer !== null ? offer - band.serverFare : 0;
};
