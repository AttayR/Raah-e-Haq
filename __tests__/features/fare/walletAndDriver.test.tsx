/**
 * T-521: the wallet reads `amount_owed` and labels the new ledger types; a passenger who owes is
 * told so with a top-up; the driver's "amount owed" says it is not only commission. Driver side:
 * the request card marks a passenger offer, the cancel sheet warns about a strike (or, after the
 * wait, offers "Passenger didn't come" without one), the receipt splits fare → commission →
 * earnings, and a requeued cancel notification opens the live ride.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient, type User } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import WalletScreen from '../../../src/features/wallet/screens/WalletScreen';
import { toTransaction, toWallet } from '../../../src/features/wallet/api';
import { transactionIcon } from '../../../src/features/wallet/format';
import { CommissionCard } from '../../../src/features/wallet/components/CommissionCard';
import { IncomingRequestCard } from '../../../src/components/driver/IncomingRequestCard';
import { CancelReasonSheet } from '../../../src/components/driver/CancelReasonSheet';
import { DriverRidePanel } from '../../../src/components/driver/DriverRidePanel';
import { makeRide, makeRideRequest } from '../../../test-utils/rideFixtures';
import { useActiveRideActions } from '../../../src/features/active-ride/hooks';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { noShowAtOf, noShowFeeOf, useNoShowReady } from '../../../src/features/driver-ride/noShow';
import { cancellationChargeText, driverSplitRows } from '../../../src/features/ride-history/components/RideDetailsSections';
import { toRide } from '../../../src/features/ride-history/api';
import { earningsRideText } from '../../../src/features/stats/format';
import { toDriverEarnings } from '../../../src/features/stats/api';
import { resolveNotificationTarget } from '../../../src/features/notifications/routing';
import { toAppNotification } from '../../../src/features/notifications/api';
import { formatMoney } from '../../../src/utils/format';
import { envelope, pageInfo, rawTransaction, rawWallet } from '../../../test-utils/walletFixtures';
import { makePendingRequest } from '../../../test-utils/driverRequestFixtures';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useIsFocused: () => true,
}));

const topUp = {
  providers: [{ id: 'fake', name: 'Fake wallet', methods: ['mwallet'] }],
  min_amount: 100,
  max_amount: 5000,
  daily_cap: 10000,
  daily_remaining: 10000,
  currency: 'PKR',
};

const user = (role: 'passenger' | 'driver'): User => ({
  id: 7,
  name: 'Test User',
  email: 'user@example.test',
  phone: null,
  status: 'active',
  role,
  roles: [role],
});

const renderWallet = (role: 'passenger' | 'driver') => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user: user(role) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <WalletScreen />
      </ThemeProvider>
    </Provider>,
  );
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
});

afterEach(() => {
  mock.restore();
  jest.useRealTimers();
});

describe('wallet (BE-85 amount owed, new ledger types)', () => {
  it('reads amount_owed, falling back to the negative balance', () => {
    expect(toWallet(rawWallet({ balance: -200, amount_owed: 200 })).amountOwed).toBe(200);
    expect(toWallet(rawWallet({ balance: -80 })).amountOwed).toBe(80);
    expect(toWallet(rawWallet({ balance: 50 })).amountOwed).toBe(0);
  });

  it.each([
    ['cancellation_fee', 'Cancellation fee', 'close'],
    ['cancellation_compensation', 'Cancellation pay', 'clock'],
    ['cancellation_compensation_release', 'Cancellation pay (released)', 'clock'],
    ['fare_dispute_charge', 'Fare dispute recovery', 'dispute'],
    ['refund', 'Refund', 'refund'],
    // T-546 (BE-91): an admin's goodwill refund has its own type, shown as a refund.
    ['goodwill_refund', 'Refund', 'refund'],
  ])('%s has its own label and icon', (type, label, icon) => {
    const item = toTransaction(rawTransaction({ type, label: 'Server label' }));
    expect(item?.label).toBe(label);
    expect(item && transactionIcon(item)).toBe(icon);
  });

  it('T-546: a goodwill refund is a credit, so the "In" filter lists it with refunds', async () => {
    const goodwill = toTransaction(rawTransaction({ type: 'goodwill_refund', direction: 'credit', label: 'Refund' }));
    expect(goodwill?.direction).toBe('credit');
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: 100 })));
    mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1)));
    renderWallet('passenger');
    await waitFor(() => expect(screen.getByTestId('wallet-balance-card')).toBeTruthy());
    fireEvent.press(screen.getByText('Money in'));
    await waitFor(() =>
      expect(mock.history.get.some((r) => r.url === '/wallet/transactions' && r.params?.direction === 'credit')).toBe(true),
    );
  });

  it('keeps the server label for other types', () => {
    expect(toTransaction(rawTransaction({ type: 'commission_due', label: 'Platform Commission' }))?.label).toBe('Platform Commission');
  });

  it('a passenger who owes sees it with a top-up', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -200, amount_owed: 200, can_top_up: true, top_up: topUp })));
    mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1)));
    renderWallet('passenger');
    await waitFor(() => expect(screen.getByTestId('wallet-amount-owed')).toBeTruthy());
    screen.getByText('You owe Rs 200');
    fireEvent.press(screen.getByTestId('wallet-owed-top-up'));
    // T-543: Add money opens with the amount owed filled in.
    expect(mockNavigate).toHaveBeenCalledWith('AddMoney', { amount: 200 });
  });

  it('T-546 (BE-91): the booking block shows and prefills the error amount_owed, not the wallet debt', async () => {
    // A driver-passenger: the wallet owes Rs 900 in all (commission included), but only Rs 200
    // is passenger-side debt, which is what POST /rides reports.
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -900, amount_owed: 900 })));
    mock.onPost('/rides').reply(403, {
      success: false,
      message: 'You owe Rs 200. Top up your wallet to book a ride',
      error: { code: 'PASSENGER_BALANCE_OWED', message: 'You owe Rs 200. Top up your wallet to book a ride', amount_owed: 200, limit: 150 },
    });
    const onBalanceOwed = jest.fn();
    const store = configureStore({ reducer: rootReducer });
    const { result } = renderHook(() => useActiveRideActions({ onBalanceOwed }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    let refused: unknown = null;
    await act(async () => {
      await result.current.requestRide(makeRideRequest()).catch((error: unknown) => {
        refused = error;
      });
    });
    expect(refused).not.toBeNull();
    const current = dialogStore.getCurrent();
    expect(current).toMatchObject({ title: 'You owe Rs 200' });
    await act(async () => {
      if (current) dialog.answer(current.id, true);
    });
    await waitFor(() => expect(onBalanceOwed).toHaveBeenCalledWith(200));
    expect(mock.history.get.some((r) => r.url === '/wallet')).toBe(false);
  });

  it('no owed banner when nothing is owed', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: 0 })));
    mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1)));
    renderWallet('passenger');
    await waitFor(() => expect(screen.getByTestId('wallet-balance-card')).toBeTruthy());
    expect(screen.queryByTestId('wallet-amount-owed')).toBeNull();
  });

  it('the driver card says "Amount owed" and that it includes dispute recoveries', () => {
    render(
      <CommissionCard wallet={toWallet(rawWallet({ balance: -64, commission_owed: 64 }))} onPay={jest.fn()} onOpenReports={jest.fn()} onCancel={jest.fn()} cancellingId={null} />,
    );
    screen.getByText('Amount owed');
    screen.getByText(/plus any fare-dispute recoveries/);
  });
});

describe('driver request feed (BE-83 offers)', () => {
  it('marks a passenger offer with the app fare to compare', () => {
    render(
      <IncomingRequestCard
        request={makePendingRequest({ estimatedFare: 170, isOffer: true, serverFare: 152 })}
        accepting={false}
        disabled={false}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );
    screen.getByText('Passenger offer');
    screen.getByText('App fare Rs 152');
    expect(screen.getByTestId('incoming-request-fare').props.children).toBe('Rs 170');
  });

  it('no offer badge for a normal request', () => {
    render(<IncomingRequestCard request={makePendingRequest()} accepting={false} disabled={false} onAccept={jest.fn()} onReject={jest.fn()} />);
    expect(screen.queryByTestId('incoming-request-offer')).toBeNull();
  });
});

describe('driver cancel (BE-85 strikes and no-shows)', () => {
  it('warns that a cancel after accepting records a strike', () => {
    render(<CancelReasonSheet visible submitting={false} onSubmit={jest.fn()} onClose={jest.fn()} />);
    screen.getByTestId('cancel-reason-strike');
    screen.getByText('Why are you cancelling?');
  });

  it('[T-543] taps inside the sheet (strike warning, title, hint) never close it; only Keep ride does', () => {
    const onClose = jest.fn();
    const { rerender } = render(<CancelReasonSheet visible submitting={false} onSubmit={jest.fn()} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('cancel-reason-strike'));
    fireEvent.press(screen.getByText('Cancelling after accepting records a strike. Repeated strikes put your account under review.'));
    fireEvent.press(screen.getByText('Why are you cancelling?'));
    fireEvent(screen.getByTestId('cancel-reason-input'), 'focus');
    fireEvent.changeText(screen.getByTestId('cancel-reason-input'), 'Car broke down');
    // A poll re-render with the no-show pointer (the wait just ended) keeps the sheet and the note.
    rerender(<CancelReasonSheet visible noShowAvailable submitting={false} onSubmit={jest.fn()} onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('cancel-reason-sheet')).toBeTruthy();
    expect(screen.getByTestId('cancel-reason-input').props.value).toBe('Car broke down');
    fireEvent.press(screen.getByTestId('cancel-reason-keep'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Passenger didn\'t come": no strike, a note filled in, the fee only while fees are on', () => {
    const onSubmit = jest.fn();
    const { rerender } = render(<CancelReasonSheet visible mode="no_show" noShowFee={50} submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    expect(screen.queryByTestId('cancel-reason-strike')).toBeNull();
    screen.getByText("Passenger didn't come?");
    screen.getByText('The passenger is charged the Rs 50 no-show fee. Your share shows in your wallet once it is credited.');
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledWith('The passenger did not come to the pickup.');

    rerender(<CancelReasonSheet visible mode="no_show" noShowFee={null} submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    expect(screen.queryByTestId('cancel-reason-no-show-fee')).toBeNull();
  });

  it('after the wait, a normal cancel shows no strike warning but points to the no-show cancel', () => {
    render(<CancelReasonSheet visible noShowAvailable submitting={false} onSubmit={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByTestId('cancel-reason-strike')).toBeNull();
    screen.getByTestId('cancel-reason-no-show-pointer');
  });

  it('pickup footer: "Passenger didn\'t come" replaces Cancel, so it keeps two buttons (iPhone SE)', () => {
    const ride = makeRide({ status: 'arrived', driver_id: 5, passenger: { id: 9, name: 'Ayesha' } });
    const props = {
      ride,
      step: 'at_pickup' as const,
      pendingAction: null,
      canCall: false,
      canNavigate: false,
      onCall: jest.fn(),
      onNavigate: jest.fn(),
      onArrived: jest.fn(),
      onStart: jest.fn(),
      onComplete: jest.fn(),
      onCompleteStop: jest.fn(),
      onCancel: jest.fn(),
    };
    const { rerender } = render(<DriverRidePanel {...props} />);
    screen.getByTestId('driver-ride-cancel');
    expect(screen.queryByTestId('driver-ride-no-show')).toBeNull();
    const onNoShow = jest.fn();
    rerender(<DriverRidePanel {...props} onNoShow={onNoShow} />);
    expect(screen.queryByTestId('driver-ride-cancel')).toBeNull();
    fireEvent.press(screen.getByTestId('driver-ride-no-show'));
    expect(onNoShow).toHaveBeenCalledTimes(1);
    const footer = screen.getByTestId('driver-ride-footer');
    expect(within(footer).getAllByRole('button')).toHaveLength(2);
  });

  it('reads no_show_cancel_at and the fee (fees on only)', () => {
    expect(noShowAtOf({ no_show_cancel_at: '2026-10-15T10:05:00Z' })).toBe(Date.parse('2026-10-15T10:05:00Z'));
    expect(noShowAtOf({ no_show_cancel_at: null })).toBeNull();
    expect(noShowFeeOf({ fare_policy: { fees_enabled: true, cancel_fee: 50 } })).toBe(50);
    expect(noShowFeeOf({ fare_policy: { fees_enabled: false, cancel_fee: 0 } })).toBeNull();
  });

  it('offers the no-show cancel once the wait is over (one timeout, at the pickup only)', () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T10:04:00Z') });
    const ride = { no_show_cancel_at: '2026-10-15T10:05:00Z' };
    const { result, rerender } = renderHook(({ step }: { step: 'at_pickup' | 'to_pickup' }) => useNoShowReady(ride, step), {
      initialProps: { step: 'at_pickup' as 'at_pickup' | 'to_pickup' },
    });
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(61_000);
    });
    expect(result.current).toBe(true);
    rerender({ step: 'to_pickup' });
    expect(result.current).toBe(false);
  });
});

describe('driver split (BE-84) and cancel fees on ride details', () => {
  const raw = {
    id: 12,
    status: 'completed',
    total_fare: '400.00',
    fare: 400,
    booking_fee: 10,
    commission_rate: 12.5,
    commission_amount: 49,
    driver_net: 341,
    commission_final: true,
    fare_breakdown: { base: 300, distance: 60, time: 30, stops: 0, min_fare_adjustment: 0, booking_fee: 10, offer_adjustment: 0, waiting: 0, total: 400 },
  };

  it('fare → booking fee → commission at its rate → your earnings', () => {
    const ride = toRide(raw);
    expect(ride && driverSplitRows(ride).map((r) => [r.label, r.value])).toEqual([
      ['Booking fee (platform)', formatMoney(-10)],
      ['Commission (12.5%)', formatMoney(-49)],
      ['Your earnings', 'Rs 341'],
    ]);
  });

  it('older rides fall back to the stored platform fee and earnings', () => {
    const ride = toRide({ id: 13, status: 'completed', total_fare: 300, platform_commission: 60, driver_earnings: 240 });
    expect(ride && driverSplitRows(ride).map((r) => r.label)).toEqual(['Raah-e-Haq fee', 'Your earnings']);
  });

  it('a cancel fee is said from each side; nothing charged reads as before', () => {
    const charged = toRide({ id: 14, status: 'cancelled', cancellation_fee: '50.00', cancellation_charge_reason: 'no_show' });
    const free = toRide({ id: 15, status: 'cancelled', cancellation_fee: null });
    expect(charged && cancellationChargeText(charged, 'passenger')).toBe('A no-show fee of Rs 50 was charged to your wallet.');
    expect(charged && cancellationChargeText(charged, 'driver')).toBe(
      'The passenger was charged Rs 50 for this cancellation. Your share shows in your wallet once it is credited.',
    );
    expect(free && cancellationChargeText(free, 'passenger')).toBe('Cancelled rides are not charged.');
  });

  it('the earnings row says the commission rate and amount, with the route as its title', () => {
    const data = toDriverEarnings(
      {
        period: 'day',
        rides: [
          {
            id: 7,
            pickup_address: 'Gulberg, Lahore',
            dropoff_address: 'Liberty Market, Lahore',
            total_fare: 300,
            fare: 300,
            platform_commission: 60,
            driver_earnings: 240,
            driver_net: 240,
            commission_rate: 20,
            commission_amount: 60,
            booking_fee: 0,
          },
        ],
      },
      'day',
    );
    const text = earningsRideText(data.rides[0], (n) => formatMoney(n));
    expect(text.title).toBe('Gulberg → Liberty Market');
    expect(text.subtitle).toContain('Fare Rs 300 · commission 20% = Rs 60');
  });
});

describe('re-matching notification (BE-85)', () => {
  it('a requeued driver cancel opens the live ride; a final cancel opens history', () => {
    const item = toAppNotification({ id: 5, type: 'ride_cancelled', category: 'ride', data: { ride_id: 41, requeued: true } });
    expect(item?.data.requeued).toBe(true);
    expect(resolveNotificationTarget({ category: 'ride', type: 'ride_cancelled', rideId: 41, requeued: true }, 'passenger')).toEqual({
      kind: 'ride',
      rideId: 41,
    });
    expect(resolveNotificationTarget({ category: 'ride', type: 'ride_cancelled', rideId: 41 }, 'passenger')).toEqual({ kind: 'rideHistory' });
  });
});
