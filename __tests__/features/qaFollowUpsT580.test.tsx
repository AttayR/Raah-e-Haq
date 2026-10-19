/**
 * T-580 (QA 2026-10-19 follow-ups): the live cancelled-parcel panel says "delivery" whoever
 * cancelled; the "Cancellation" header and the fare step's vehicle line are real Roman Urdu (no
 * "Gaari: Gaari"); and the account-status hero does not drop under a pull spinner when the
 * "Check status" button (not a pull) runs the check.
 */
import React from 'react';
import { RefreshControl } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ActiveRidePanel from '../../src/features/active-ride/components/ActiveRidePanel';
import { advanceRideStage, type PassengerRideStageState } from '../../src/features/active-ride/stage';
import { AccountStatusLayout } from '../../src/features/auth/components/AccountStatusLayout';
import { accountStatusView } from '../../src/features/auth/accountStatus';
import { BOOKING_COPY } from '../../src/features/ride-booking/copy';
import { RIDE_HISTORY_COPY } from '../../src/features/ride-history/copy';
import { setLocale } from '../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import '../../src/i18n/copy-ur-Latn';
import type { RideResource } from '../../src/services/rideService';
import { makeRide } from '../../test-utils/rideFixtures';

const noop = () => undefined;

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const parcel = (overrides: Partial<RideResource>) =>
  makeRide({ vehicle_type: 'parcel', is_parcel: true, ...overrides } as Partial<RideResource>);

afterEach(() => {
  resetLanguagePreferenceForTests();
});

describe('5. live cancelled-parcel panel', () => {
  const subtitle = () => screen.getByTestId('active-ride-subtitle').props.children;

  it.each([
    ['passenger', 'You cancelled this delivery.', 'Aap ne ye delivery cancel ki.'],
    ['driver', 'Your rider cancelled this delivery.', 'Aap ke rider ne ye delivery cancel ki.'],
    ['system', 'This delivery was cancelled.', 'Ye delivery cancel ho gayi.'],
  ])('cancelled by %s: delivery wording in English and Roman Urdu', (reason, en, ur) => {
    const ride = parcel({ status: 'cancelled', cancellation_reason: reason });
    const { rerender } = render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} onDone={noop} />);
    expect(subtitle()).toBe(en);
    act(() => setLocale('ur-Latn'));
    rerender(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} onDone={noop} />);
    expect(subtitle()).toBe(ur);
  });

  it('a car ride keeps the ride wording', () => {
    const ride = makeRide({ status: 'cancelled', cancellation_reason: 'passenger' });
    render(<ActiveRidePanel stageState={stateOf(ride)} ride={ride} onCancel={noop} onDone={noop} />);
    expect(subtitle()).toBe('You cancelled this ride.');
  });
});

describe('8. Roman Urdu leftovers', () => {
  it('the "Cancellation" header is translated', () => {
    act(() => setLocale('ur-Latn'));
    expect(RIDE_HISTORY_COPY.cancellation).not.toBe('Cancellation');
  });

  it('the fare step does not read "Gaari: Gaari"', () => {
    act(() => setLocale('ur-Latn'));
    expect(BOOKING_COPY.reviewMeta('Gaari')).toBe('Gaari chuni gayi');
    act(() => setLocale('en'));
    expect(BOOKING_COPY.reviewMeta('Car')).toBe('Vehicle: Car');
  });
});

describe('8. account status: Check status does not shift the hero', () => {
  const view = accountStatusView({ role: 'passenger', status: 'pending', rejection_reason: null }, false);
  const layout = (checking: boolean, onCheckStatus: () => void = noop) => (
    <AccountStatusLayout
      view={view}
      name="Saad"
      checking={checking}
      error={null}
      isLoggingOut={false}
      onCheckStatus={onCheckStatus}
      onSignOut={noop}
    />
  );

  it('a button check shows no pull spinner; a pull shows it until the check ends', () => {
    // Like useCheckAccountStatus: a check sets `checking` in the same event that started it.
    let finish: () => void = noop;
    function Harness() {
      const [checking, setChecking] = React.useState(false);
      finish = () => setChecking(false);
      return layout(checking, () => setChecking(true));
    }
    const { UNSAFE_getByType } = render(<Harness />);
    const refreshing = () => UNSAFE_getByType(RefreshControl).props.refreshing;

    fireEvent.press(screen.getByTestId('account-status-check'));
    expect(refreshing()).toBe(false);
    act(() => finish());

    act(() => UNSAFE_getByType(RefreshControl).props.onRefresh());
    expect(refreshing()).toBe(true);
    act(() => finish());
    expect(refreshing()).toBe(false);

    // The next button check after a pull: still no spinner.
    fireEvent.press(screen.getByTestId('account-status-check'));
    expect(refreshing()).toBe(false);
  });

  it('a pull that starts no check leaves no pull state behind for the next button check', () => {
    const { rerender, UNSAFE_getByType } = render(layout(false));
    // onCheckStatus does nothing (a check was already running): checking stays false.
    act(() => UNSAFE_getByType(RefreshControl).props.onRefresh());
    rerender(layout(false));
    rerender(layout(true));
    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  });

  it('the button still runs the check', () => {
    const onCheck = jest.fn();
    render(layout(false, onCheck));
    fireEvent.press(screen.getByTestId('account-status-check'));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });
});
