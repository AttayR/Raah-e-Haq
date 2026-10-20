/**
 * T-521: the fare-fairness readers and rules. Before, the app ignored the BE-82/83/85 fields: no
 * offer band, no fare lock, no cancel preview, no report, and a 422 offer refusal or a 403
 * PASSENGER_BALANCE_OWED fell through as a generic error.
 */
import { AxiosError, AxiosHeaders } from 'axios';
import {
  buildOverchargeBody,
  driverSplitOf,
  fareExtrasOf,
  fareLockOf,
  offerBandFromExtra,
  toCancellationPreview,
  toFareNotice,
  toFarePolicy,
  toOfferBand,
  toOverchargeState,
} from '../../../src/features/fare/api';
import { canStepOffer, clampOffer, offerDifference, offeredFareFor, stepOffer } from '../../../src/features/fare/offer';
import {
  cancelPreviewText,
  cancellationFeeText,
  farePolicyLines,
  formatClock,
  reportStatusText,
  waitingDetail,
} from '../../../src/features/fare/format';
import { toApiError, toThunkRejection } from '../../../src/core/api/errors';
import { classifyRideRequestFailure } from '../../../src/features/ride-booking/rideRequestFailure';
import { cancelConfirmBody } from '../../../src/features/active-ride/cancel';
import { showBalanceOwed } from '../../../src/features/active-ride/hooks';
import { buildRideRequest } from '../../../src/features/ride-booking/buildRideRequest';
import { dialog, dialogStore } from '../../../src/core/dialog';
import type { FarePolicy, OfferBand } from '../../../src/features/fare/types';

const band: OfferBand = { min: 130, max: 180, step: 10, serverFare: 152 };
const policy: FarePolicy = {
  feesEnabled: true,
  freeWaitMin: 3,
  waitPerMin: 3,
  maxWaitBilledMinutes: 15,
  cancelFee: 50,
  freeCancelMinutes: 5,
  noShowWaitMinutes: 5,
};

const axiosError = (status: number, data: unknown): AxiosError => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', 'ERR', config, null, { status, statusText: '', headers: {}, config, data });
};

describe('offer stepper bounds (BE-83)', () => {
  it('steps by the band step and never leaves min..max', () => {
    expect(stepOffer(band, 152, 1)).toBe(162);
    expect(stepOffer(band, 172, 1)).toBe(180);
    expect(stepOffer(band, 180, 1)).toBe(180);
    expect(stepOffer(band, 142, -1)).toBe(132);
    expect(stepOffer(band, 132, -1)).toBe(130);
    expect(stepOffer(band, 130, -1)).toBe(130);
  });

  it('disables the button at the edge it would pass', () => {
    expect(canStepOffer(band, 180, 1)).toBe(false);
    expect(canStepOffer(band, 180, -1)).toBe(true);
    expect(canStepOffer(band, 130, -1)).toBe(false);
    expect(canStepOffer(band, 152, 1)).toBe(true);
  });

  it('clamps and rounds anything to a whole rupee inside the band', () => {
    expect(clampOffer(band, 500)).toBe(180);
    expect(clampOffer(band, 1)).toBe(130);
    expect(clampOffer(band, 151.6)).toBe(152);
    expect(clampOffer(band, Number.NaN)).toBe(152);
  });

  it('sends offered_fare only when it differs from the server fare (and only with a band)', () => {
    expect(offeredFareFor(band, 152)).toBeNull();
    expect(offeredFareFor(band, 170)).toBe(170);
    expect(offeredFareFor(null, 170)).toBeNull();
    expect(offerDifference(band, 140)).toBe(-12);
    expect(offerDifference(band, 152)).toBe(0);
  });
});

describe('fare readers', () => {
  it('a band is usable only when the server fare is inside it', () => {
    expect(toOfferBand({ min: 130, max: 180, step: 10, server_fare: 152 })).toEqual(band);
    expect(toOfferBand({ min: '130', max: '180', step: 0, server_fare: '152' })).toEqual({ ...band, step: 1 });
    expect(toOfferBand({ min: 200, max: 180, step: 10, server_fare: 190 })).toBeNull();
    expect(toOfferBand({ min: 130, max: 180, step: 10, server_fare: 400 })).toBeNull();
    expect(toOfferBand(null)).toBeNull();
  });

  it('a fuel notice needs a note; the terms default to zero charges', () => {
    expect(toFareNotice({ percent: 10, note: '  Fares updated  ', effective_from: null })).toEqual({ percent: 10, note: 'Fares updated', effectiveFrom: null });
    expect(toFareNotice({ percent: 10, note: '' })).toBeNull();
    expect(toFarePolicy({ fees_enabled: false })).toMatchObject({ feesEnabled: false, cancelFee: 0, waitPerMin: 0 });
  });

  it('the fare lock needs fare_locked and an amount', () => {
    expect(fareLockOf({ fare_locked: true, accepted_fare: '152.00', fare_locked_at: '2026-10-15T10:00:00Z' })).toEqual({
      acceptedFare: 152,
      lockedAt: '2026-10-15T10:00:00Z',
    });
    expect(fareLockOf({ fare_locked: false, accepted_fare: '152.00' })).toBeNull();
    expect(fareLockOf({ fare_locked: true, accepted_fare: null })).toBeNull();
  });

  it('reads the cancel preview, the report state and the driver split', () => {
    expect(toCancellationPreview({ fee_now: 50, free_until: null, reason: 'late_cancel' })).toEqual({ feeNow: 50, freeUntil: null, reason: 'late_cancel' });
    expect(toOverchargeState({ can_report: true, report: null })).toEqual({ canReport: true, report: null });
    expect(
      toOverchargeState({
        can_report: false,
        report: { id: 4, kind: 'asked_for_more', status: 'upheld', asked_amount: '400.00', fare: '152.00', refund_amount: '50.00', created_at: 'x', resolved_at: null },
      })?.report,
    ).toEqual({ id: 4, status: 'upheld', askedAmount: 400, fare: 152, refundAmount: 50, createdAt: 'x', resolvedAt: null });
    expect(toOverchargeState(undefined)).toBeNull();
    expect(driverSplitOf({ fare: 400, booking_fee: 0, commission_rate: 12.5, commission_amount: 50, driver_net: 350, commission_final: true })).toEqual({
      fare: 400,
      bookingFee: 0,
      commissionRate: 12.5,
      commissionAmount: 50,
      driverNet: 350,
      final: true,
    });
    // Passengers never get the split.
    expect(driverSplitOf({ booking_fee: 0 })).toBeNull();
    expect(fareExtrasOf({ booking_fee: '10.00', offer_adjustment: -20, waiting: 6 })).toEqual({ bookingFee: 10, offerAdjustment: -20, waiting: 6 });
  });

  it('builds the report body from the filled fields only', () => {
    expect(buildOverchargeBody({})).toEqual({});
    expect(buildOverchargeBody({ askedAmount: 400, note: '  asked for more  ' })).toEqual({ asked_amount: 400, note: 'asked for more' });
    expect(buildOverchargeBody({ askedAmount: 0, note: '   ' })).toEqual({});
  });
});

describe('text', () => {
  it('terms only while fees are on', () => {
    expect(farePolicyLines(policy)).toEqual([
      '3 min free waiting at the pickup, then Rs 3 a minute.',
      'Free to cancel for 5 min after a driver accepts, then Rs 50.',
    ]);
    expect(farePolicyLines({ ...policy, feesEnabled: false })).toEqual([]);
    expect(farePolicyLines(null)).toEqual([]);
  });

  it('the cancel preview: costs now, free until a time, or free', () => {
    expect(cancelPreviewText({ feeNow: 50, freeUntil: null, reason: 'late_cancel' })).toBe('Cancelling now costs Rs 50. It is charged to your wallet.');
    expect(cancelPreviewText({ feeNow: 0, freeUntil: '2026-10-15T13:05:00+05:00', reason: null })).toMatch(/^Free to cancel until \d{1,2}:05 (AM|PM)\.$/);
    expect(cancelPreviewText({ feeNow: 0, freeUntil: null, reason: null })).toBe('Cancelling now is free.');
    expect(cancelPreviewText(null)).toBeNull();
    expect(cancelConfirmBody({ cancellation_preview: { fee_now: 50, free_until: null, reason: 'late_cancel' } })).toBe(
      'Your driver is already on the way. Cancelling now costs Rs 50. It is charged to your wallet.',
    );
    expect(cancelConfirmBody(null)).toBe('Your driver is already on the way.');
  });

  it('the waiting timer: free time left, then the rate', () => {
    expect(formatClock(125)).toBe('2:05');
    expect(waitingDetail(policy, 60)).toBe('Free waiting: 2:00 left');
    expect(waitingDetail(policy, 200)).toBe('Waiting fee: Rs 3 a minute after 3 min (up to 15 min)');
  });

  it('report status and the cancel-fee sentence', () => {
    const report = { id: 1, status: 'open' as const, askedAmount: null, fare: 152, refundAmount: 0, createdAt: null, resolvedAt: null };
    expect(reportStatusText(report)).toBe('Received. We are looking into it.');
    expect(reportStatusText({ ...report, status: 'upheld', refundAmount: 50 })).toBe('Upheld. Rs 50 was refunded to your wallet.');
    expect(reportStatusText({ ...report, status: 'rejected' })).toBe('Reviewed. No action was taken.');
    expect(cancellationFeeText(50, 'no_show')).toBe('A no-show fee of Rs 50 was charged to your wallet.');
    expect(cancellationFeeText(50, 'late_cancel')).toBe('A cancellation fee of Rs 50 was charged to your wallet.');
    expect(cancellationFeeText(0, null)).toBeNull();
  });
});

describe('POST /rides refusals (BE-83 offer band, BE-85 balance owed)', () => {
  it('keeps the nested offer_band numbers and classifies the out-of-band 422', () => {
    const error = axiosError(422, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { offered_fare: ['Offer a fare between Rs 130 and Rs 180.'] },
        offer_band: { min: 130, max: 180, step: 10, server_fare: 152, down_percent: 20, up_percent: 20 },
      },
    });
    expect(offerBandFromExtra(toApiError(error).extra)).toEqual(band);
    expect(classifyRideRequestFailure(toThunkRejection(error, 'x'), 'x')).toEqual({
      kind: 'offer_out_of_band',
      message: 'Offer a fare between Rs 130 and Rs 180.',
      band,
    });
  });

  it('offers switched off: a 422 offered_fare without a band', () => {
    const error = axiosError(422, {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: { offered_fare: ['Offers are off.'] }, offer_band: null },
    });
    expect(classifyRideRequestFailure(toThunkRejection(error, 'x'), 'x')).toEqual({ kind: 'offer_out_of_band', message: 'Offers are off.', band: null });
  });

  it('PASSENGER_BALANCE_OWED carries the amount and the limit', () => {
    const error = axiosError(403, {
      success: false,
      message: 'You owe Rs 200. Top up to book.',
      error: { code: 'PASSENGER_BALANCE_OWED', message: 'You owe Rs 200. Top up to book.', amount_owed: 200, limit: 150 },
    });
    expect(classifyRideRequestFailure(toThunkRejection(error, 'x'), 'x')).toEqual({
      kind: 'balance_owed',
      message: 'You owe Rs 200. Top up to book.',
      amountOwed: 200,
      limit: 150,
    });
  });
});

describe('POST /rides body (BE-83)', () => {
  const input = {
    pickup: { latitude: 31.52, longitude: 74.35, address: 'Fake Pickup Street' },
    dropoff: { latitude: 31.48, longitude: 74.3, address: 'Fake Dropoff Road' },
    vehicleType: 'car',
  };

  it('carries offered_fare only for a whole-rupee offer', () => {
    const offered = buildRideRequest({ ...input, offeredFare: 170 });
    expect(offered.ok && offered.request.offered_fare).toBe(170);
    const none = buildRideRequest({ ...input, offeredFare: null });
    expect(none.ok && 'offered_fare' in none.request).toBe(false);
    const fractional = buildRideRequest({ ...input, offeredFare: 170.5 });
    expect(fractional.ok && 'offered_fare' in fractional.request).toBe(false);
  });
});

describe('balance owed on book (BE-85)', () => {
  it('asks "You owe Rs 200" with Top up, which opens the top-up', async () => {
    const onTopUp = jest.fn();
    const shown = showBalanceOwed({ message: 'You owe Rs 200. Top up to book.', amountOwed: 200 }, onTopUp);
    const current = dialogStore.getCurrent();
    expect(current).toMatchObject({ title: 'You owe Rs 200', confirmLabel: 'Top up', cancelLabel: 'Not now' });
    if (current) dialog.answer(current.id, true);
    await shown;
    expect(onTopUp).toHaveBeenCalledTimes(1);
    // T-543: the amount owed goes with it, to prefill Add money.
    expect(onTopUp).toHaveBeenCalledWith(200);
  });

  it('"Not now" does not open the top-up', async () => {
    const onTopUp = jest.fn();
    const shown = showBalanceOwed({ message: 'You owe Rs 200.', amountOwed: 200 }, onTopUp);
    const current = dialogStore.getCurrent();
    if (current) dialog.answer(current.id, false);
    await shown;
    expect(onTopUp).not.toHaveBeenCalled();
  });
});
