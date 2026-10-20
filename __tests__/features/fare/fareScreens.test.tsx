/**
 * T-521 on screen: the passenger's trip panel shows the fare lock, the waiting timer (fees on and
 * a verified arrival only), "Finding another driver" after a re-match, the cancel fee, and the
 * "Driver asked for more?" report (POST /rides/{id}/report-overcharge with its refusals). The
 * offer hook resets per quote and takes the server's band after a 422.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { OverchargeReportSection, parseAskedAmount } from '../../../src/features/fare/components/OverchargeReport';
import { reportRefusal, useFareOffer } from '../../../src/features/fare/hooks';
import { toast } from '../../../src/core/toast';
import type { RideResource } from '../../../src/services/rideService';
import type { OfferBand } from '../../../src/features/fare/types';
import { makeRide } from '../../../test-utils/rideFixtures';
import { layout } from '../../../src/theme';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  jest.spyOn(toast, 'success').mockImplementation(() => '');
  jest.spyOn(toast, 'info').mockImplementation(() => '');
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const panel = (ride: RideResource) => (
  <ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={jest.fn()} onDone={jest.fn()} />
);

const withDriver = (overrides: Partial<RideResource>): RideResource =>
  makeRide({ driver_id: 5, driver: { id: 5, name: 'Ali', rating: 4.9 }, ...overrides });

const feesOn = {
  fees_enabled: true,
  free_wait_min: 3,
  wait_per_min: 3,
  max_wait_billed_minutes: 15,
  cancel_fee: 50,
  free_cancel_minutes: 5,
  no_show_wait_minutes: 5,
};

describe('trip panel (passenger)', () => {
  it('shows the fare with the orange "Fixed fare" tag once a driver accepted (UI-R12 TS6.2)', () => {
    const { getByText, getByTestId } = render(panel(withDriver({ status: 'accepted', fare_locked: true, accepted_fare: '152.00' })));
    expect(getByTestId('trip-fare-row-amount')).toHaveTextContent('Rs 152');
    getByText('Fixed fare');
    expect(getByTestId('trip-fare-row-tag')).toBeTruthy();
    expect(getByTestId('trip-fare-row').props.accessibilityLabel).toBe('Your fare is locked at Rs 152. Pay only this amount.');
  });

  it('no fixed-fare tag while searching or for a ride accepted before the lock existed', () => {
    const { queryByTestId, rerender } = render(panel(makeRide({ status: 'requested', fare_locked: false })));
    expect(queryByTestId('trip-fare-row')).toBeNull();
    rerender(panel(withDriver({ status: 'accepted' })));
    expect(queryByTestId('trip-fare-row-tag')).toBeNull();
  });

  it('ticks a waiting timer after a verified arrival while fees are on', () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T10:01:00Z') });
    const ride = withDriver({ status: 'arrived', arrived_at: '2026-10-15T10:00:00Z', arrival_verified: true, fare_policy: feesOn });
    const { getByTestId } = render(panel(ride));
    expect(getByTestId('waiting-timer-clock').props.children).toBe('Waiting 1:00');
    expect(getByTestId('waiting-timer-detail').props.children).toBe('Free waiting: 2:00 left');
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(getByTestId('waiting-timer-clock').props.children).toBe('Waiting 1:05');
  });

  it('no waiting timer while fees are off or the arrival is not verified', () => {
    const base = { status: 'arrived' as const, arrived_at: '2026-10-15T10:00:00Z' };
    const { queryByTestId, rerender } = render(
      panel(withDriver({ ...base, arrival_verified: true, fare_policy: { ...feesOn, fees_enabled: false } })),
    );
    expect(queryByTestId('waiting-timer')).toBeNull();
    rerender(panel(withDriver({ ...base, arrival_verified: false, fare_policy: feesOn })));
    expect(queryByTestId('waiting-timer')).toBeNull();
  });

  it('a restored ride back in the queue says it is finding another driver (BE-85 requeue_count)', () => {
    const { getByText } = render(panel(makeRide({ status: 'requested', requeue_count: 1 })));
    getByText('Finding another driver');
    getByText("Your driver cancelled. We're asking other drivers nearby.");
  });

  it('a cancelled ride with a late-cancel fee says what was charged', () => {
    const ride = makeRide({ status: 'cancelled', cancellation_reason: 'passenger', cancellation_fee: '50.00', cancellation_charge_reason: 'late_cancel' });
    const { getByTestId } = render(panel(ride));
    expect(getByTestId('active-ride-subtitle').props.children).toBe(
      'You cancelled this ride. A cancellation fee of Rs 50 was charged to your wallet.',
    );
  });
});

describe('"Driver asked for more?" (BE-82)', () => {
  const report = { id: 3, kind: 'asked_for_more', status: 'open', asked_amount: 400, fare: 152, refund_amount: 0, created_at: '2026-10-15T10:00:00Z', resolved_at: null };

  it('[T-543] the report sheet has the side gutter on its header and fields', () => {
    const { getByTestId } = render(
      <OverchargeReportSection rideId={41} state={{ canReport: true, report: null }} fare={152} />,
    );
    fireEvent.press(getByTestId('overcharge-button'));
    expect(StyleSheet.flatten(getByTestId('overcharge-form-header').props.style)).toMatchObject({ paddingHorizontal: layout.gutter });
    expect(StyleSheet.flatten(getByTestId('overcharge-form-fields').props.style)).toMatchObject({ paddingHorizontal: layout.gutter });
  });

  it('reports with the amount and note, then shows the status instead of the button', async () => {
    mock.onPost('/rides/41/report-overcharge').reply(201, {
      success: true,
      message: 'Thank you. Pay only Rs 152, the fare in the app.',
      data: { report, pay_only: 152 },
    });
    const onReported = jest.fn();
    const { getByTestId, queryByTestId, getByText } = render(
      <OverchargeReportSection rideId={41} state={{ canReport: true, report: null }} fare={152} onReported={onReported} />,
    );
    fireEvent.press(getByTestId('overcharge-button'));
    getByText('The fare in the app is Rs 152. Pay only that. Tell us what happened and we will look into it.');
    fireEvent.changeText(getByTestId('overcharge-amount'), '400');
    fireEvent.changeText(getByTestId('overcharge-note'), 'Asked for 400 at the drop-off');
    await act(async () => {
      fireEvent.press(getByTestId('overcharge-submit'));
    });

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ asked_amount: 400, note: 'Asked for 400 at the drop-off' });
    expect(toast.success).toHaveBeenCalledWith('Report sent. Pay only Rs 152.');
    expect(onReported).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(queryByTestId('overcharge-button')).toBeNull());
    expect(getByTestId('overcharge-status-text').props.children).toBe('Received. We are looking into it.');
  });

  it('re-match: once the server stops offering the button, a later can_report true shows it again', async () => {
    mock.onPost('/rides/41/report-overcharge').reply(201, { success: true, message: 'Thanks', data: { report, pay_only: 152 } });
    const mapped = { id: 3, status: 'open' as const, askedAmount: 400, fare: 152, refundAmount: 0, createdAt: null, resolvedAt: null };
    const { getByTestId, queryByTestId, rerender } = render(
      <OverchargeReportSection rideId={41} state={{ canReport: true, report: null }} fare={152} />,
    );
    fireEvent.press(getByTestId('overcharge-button'));
    await act(async () => {
      fireEvent.press(getByTestId('overcharge-submit'));
    });
    await waitFor(() => expect(queryByTestId('overcharge-button')).toBeNull());
    // The ride is read again: the first driver was reported.
    rerender(<OverchargeReportSection rideId={41} state={{ canReport: false, report: mapped }} fare={152} />);
    expect(queryByTestId('overcharge-button')).toBeNull();
    // A driver cancel re-matched the ride; the next driver can be reported separately.
    rerender(<OverchargeReportSection rideId={41} state={{ canReport: true, report: mapped }} fare={152} />);
    getByTestId('overcharge-button');
    getByTestId('overcharge-status');
  });

  it('refuses an amount that is not whole rupees before sending', () => {
    const { getByTestId, getByText } = render(<OverchargeReportSection rideId={41} state={{ canReport: true, report: null }} fare={152} />);
    fireEvent.press(getByTestId('overcharge-button'));
    fireEvent.changeText(getByTestId('overcharge-amount'), '12.5');
    fireEvent.press(getByTestId('overcharge-submit'));
    getByText('Enter a whole amount in rupees, like 400.');
    expect(mock.history.post).toHaveLength(0);
    expect(parseAskedAmount('')).toEqual({ ok: true, value: undefined });
    expect(parseAskedAmount('1,200')).toEqual({ ok: true, value: 1200 });
    expect(parseAskedAmount('0')).toEqual({ ok: false });
  });

  it.each([
    ['REPORT_WINDOW_CLOSED', 'Reports can be sent up to 24 hours after the ride.'],
    ['ALREADY_REPORTED', 'You have already reported this driver for this ride.'],
    ['NO_DRIVER', 'There is no driver on this ride to report.'],
  ])('409 %s: says why, hides the button and re-reads the ride', async (code, text) => {
    mock.onPost('/rides/41/report-overcharge').reply(409, { success: false, error: { code, message: 'Conflict' } });
    const onReported = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <OverchargeReportSection rideId={41} state={{ canReport: true, report: null }} fare={152} onReported={onReported} />,
    );
    fireEvent.press(getByTestId('overcharge-button'));
    await act(async () => {
      fireEvent.press(getByTestId('overcharge-submit'));
    });
    expect(toast.info).toHaveBeenCalledWith(text);
    expect(onReported).toHaveBeenCalledWith(null);
    await waitFor(() => expect(queryByTestId('overcharge-button')).toBeNull());
  });

  it('a 422 field message stays in the sheet', async () => {
    mock.onPost('/rides/41/report-overcharge').reply(422, { message: 'Invalid', errors: { asked_amount: ['The asked amount must be at least 1.'] } });
    const { getByTestId, getByText } = render(<OverchargeReportSection rideId={41} state={{ canReport: true, report: null }} fare={152} />);
    fireEvent.press(getByTestId('overcharge-button'));
    await act(async () => {
      fireEvent.press(getByTestId('overcharge-submit'));
    });
    getByText('The asked amount must be at least 1.');
    getByTestId('overcharge-button');
  });

  it('shows an upheld report with its refund, and nothing when the server sent no report state', () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <OverchargeReportSection
        rideId={41}
        state={{ canReport: false, report: { id: 3, status: 'upheld', askedAmount: 400, fare: 152, refundAmount: 50, createdAt: null, resolvedAt: null } }}
        fare={152}
      />,
    );
    expect(getByTestId('overcharge-status-text').props.children).toBe('Upheld. Rs 50 was refunded to your wallet.');
    expect(queryByTestId('overcharge-button')).toBeNull();
    rerender(<OverchargeReportSection rideId={41} state={null} fare={152} />);
    expect(queryByTestId('overcharge')).toBeNull();
  });

  it('reportRefusal: an unknown failure gets our copy, never raw server text', () => {
    expect(reportRefusal(new Error('boom')).message).toBe("Couldn't send the report. Please try again.");
  });
});

describe('useFareOffer', () => {
  const band: OfferBand = { min: 130, max: 180, step: 10, serverFare: 152 };

  it('starts at the server fare, resets for a new quote, and takes the server band after a 422', () => {
    const { result, rerender } = renderHook(({ quote }: { quote: OfferBand | null }) => useFareOffer(quote), {
      initialProps: { quote: band },
    });
    expect(result.current.value).toBe(152);
    act(() => result.current.step(1));
    expect(result.current.offeredFare).toBe(162);

    rerender({ quote: { ...band, serverFare: 160, max: 190 } });
    expect(result.current.value).toBe(160);
    expect(result.current.offeredFare).toBeNull();

    act(() => result.current.step(1));
    act(() => {
      expect(result.current.applyBand({ min: 140, max: 165, step: 5, serverFare: 160 })).toBe(true);
    });
    expect(result.current.band).toEqual({ min: 140, max: 165, step: 5, serverFare: 160 });
    expect(result.current.value).toBe(165);
    expect(result.current.applyBand(null)).toBe(false);

    rerender({ quote: null });
    expect(result.current.band).toBeNull();
    expect(result.current.offeredFare).toBeNull();
  });
});
