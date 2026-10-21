/**
 * T-501: ride history and ride details from the API for both roles. GET /rides is mapped in
 * one place (no phone, first names only), the list has loading / error / empty states, a
 * status filter and infinite scroll, tapping a ride opens RideDetails (the old "Details" button
 * did nothing and the rides were demo data), and the details screen shows the right side of
 * the ride per role and status, with "Message" only inside the chat read window.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient, type User } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { rideHistoryApi, toRide } from '../../../src/features/ride-history/api';
import { canOpenChat, CHAT_READ_WINDOW_HOURS, groupRidesByDay, receiptShareText, rideAmountText } from '../../../src/features/ride-history/format';
import { staticMapRegion } from '../../../src/features/ride-history/components/RideStaticMap';
import { shortMaskedPhone } from '../../../src/features/parcel/format';
import { Share, StyleSheet } from 'react-native';
import { LightTheme } from '../../../src/theme';
import { ReceiptCard, receiptPaymentStatus } from '../../../src/features/ride-history/components/RideDetailsSections';
import RideHistoryScreen from '../../../src/features/ride-history/screens/RideHistoryScreen';
import RideDetailsScreen from '../../../src/features/ride-history/screens/RideDetailsScreen';
import type { Ride } from '../../../src/features/ride-history/types';
import { envelope, pageInfo } from '../../../test-utils/walletFixtures';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ key: 'test', name: 'RideDetails', params: mockParams }),
  useIsFocused: () => true,
}));

const DRIVER_PHONE = '+923001112233';
const PASSENGER_PHONE = '+923004445566';

/** A RideResource as GET /rides returns it (fake local data). */
const rawRide = (overrides: Record<string, unknown> = {}) => ({
  id: 41,
  ride_id: 'RH-TEST41',
  passenger_id: 7,
  driver_id: 9,
  pickup_address: 'Iqbal Town, Lahore',
  dropoff_address: 'Liberty Market, Lahore',
  status: 'completed',
  vehicle_type: 'car',
  base_fare: '100.00',
  distance_fare: '250.00',
  time_fare: '70.00',
  min_fare_adjustment: '0.00',
  total_fare: '470.00',
  fare_breakdown: { base: 100, distance: 250, time: 70, stops: 50, min_fare_adjustment: 0, total: 470 },
  driver_earnings: '376.00',
  platform_commission: '94.00',
  distance_km: '6.40',
  duration_minutes: 18,
  payment_method: 'cash',
  payment_status: 'paid',
  stops: [
    { id: 3, address: 'Second stop', stop_order: 2, status: 'completed' },
    { id: 2, address: 'First stop', stop_order: 1, status: 'completed' },
  ],
  passenger: { id: 7, name: 'Ayesha', first_name: 'Ayesha', profile_image_url: null, rating: 4.9, phone: PASSENGER_PHONE },
  driver: { id: 9, name: 'Bilal Ahmed Khan', profile_image_url: null, rating: 4.7, vehicle_type: 'car', phone: DRIVER_PHONE },
  vehicle: { id: 4, vehicle_type: 'car', make: 'Toyota', model: 'Corolla', color: 'White', license_plate: 'LEA-1234' },
  requested_at: '2026-10-10T09:00:00+05:00',
  accepted_at: '2026-10-10T09:01:00+05:00',
  arrived_at: '2026-10-10T09:06:00+05:00',
  started_at: '2026-10-10T09:08:00+05:00',
  completed_at: '2026-10-10T09:26:00+05:00',
  cancelled_at: null,
  cancellation_reason: null,
  cancellation_note: null,
  created_at: '2026-10-10T09:00:00+05:00',
  ...overrides,
});

const ride = (overrides: Record<string, unknown> = {}): Ride => toRide(rawRide(overrides))!;

const user = (role: 'passenger' | 'driver'): User => ({
  id: role === 'driver' ? 9 : 7,
  name: 'Test User',
  email: 'user@example.test',
  phone: null,
  status: 'active',
  role,
  roles: [role],
});

const show = (Component: React.ComponentType, role: 'passenger' | 'driver' = 'passenger') => {
  const initial = rootReducer(undefined, { type: '@@init' });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...initial, apiAuth: { ...initial.apiAuth, user: user(role) } },
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <Component />
      </ThemeProvider>
    </Provider>,
  );
};

/** Every piece of text on screen, joined, to prove a value is not shown anywhere. */
const allText = (): string =>
  screen
    .UNSAFE_root.findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string)
    .join('\n');

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockParams = {};
});

afterEach(() => {
  mock.restore();
});

describe('GET /rides mapping', () => {
  it('maps a RideResource: statuses, stops in order, fare breakdown, first names, never a phone', () => {
    const r = ride();
    expect(r).toMatchObject({
      id: 41,
      rideCode: 'RH-TEST41',
      status: 'completed',
      totalFare: 470,
      driverEarnings: 376,
      platformCommission: 94,
      distanceKm: 6.4,
      durationMinutes: 18,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      fareBreakdown: { base: 100, distance: 250, time: 70, stops: 50, minFareAdjustment: 0, total: 470 },
      vehicle: { make: 'Toyota', model: 'Corolla', color: 'White', licensePlate: 'LEA-1234' },
    });
    expect(r.stops.map((s) => s.address)).toEqual(['First stop', 'Second stop']);
    // T-519: first name only, through the same helper as the live ride card and the rating sheet.
    expect(r.driver?.name).toBe('Bilal');
    expect(r.passenger?.name).toBe('Ayesha');
    expect(JSON.stringify(r)).not.toContain(DRIVER_PHONE);
    expect(JSON.stringify(r)).not.toContain(PASSENGER_PHONE);
  });

  it('reads legacy and missing fields safely', () => {
    const r = toRide({ id: '5', status: 'ongoing', payment_method: null, fare_breakdown: null, driver: null, vehicle: null })!;
    expect(r).toMatchObject({ id: 5, status: 'started', paymentMethod: 'cash', fareBreakdown: null, driver: null, vehicle: null });
    expect(toRide({ status: 'completed' })).toBeNull();
    expect(toRide({ id: 6, cancellation_reason: 'surprise' })?.cancellationReason).toBe('other');
  });

  it('sends page, per_page and the status filter, and reads the pagination', async () => {
    mock.onGet('/rides').reply(200, envelope([rawRide()], pageInfo(1, 3, 41)));
    const page = await rideHistoryApi.listRides({ page: 1, filter: 'cancelled' });
    expect(mock.history.get[0].params).toEqual({ page: 1, per_page: 20, status: 'cancelled' });
    expect(page).toMatchObject({ page: 1, lastPage: 3, total: 41 });
    await rideHistoryApi.listRides({ page: 2 });
    expect(mock.history.get[1].params).toEqual({ page: 2, per_page: 20 });
  });
});

describe('ride format', () => {
  it('passenger sees the fare, driver the earnings, a cancelled ride "No charge"', () => {
    expect(rideAmountText(ride(), 'passenger')).toBe('Rs\u00A0470');
    expect(rideAmountText(ride(), 'driver')).toBe('Rs\u00A0376');
    expect(rideAmountText(ride({ status: 'cancelled' }), 'passenger')).toBe('No charge');
  });

  it('[T-543] a cancelled ride the passenger was charged for shows the fee, not "No charge"', () => {
    const charged = ride({ status: 'cancelled', cancellation_fee: '50.00', cancellation_charge_reason: 'no_show' });
    expect(rideAmountText(charged, 'passenger')).toBe('Rs\u00A050 fee');
    expect(rideAmountText(ride({ status: 'cancelled', cancellation_fee: 0 }), 'passenger')).toBe('No charge');
    // T-578: the driver sees the fee the passenger paid too (their share is credited separately).
    expect(rideAmountText(charged, 'driver')).toBe('Rs\u00A050 fee');
    expect(rideAmountText(ride({ status: 'cancelled', cancellation_fee: 0 }), 'driver')).toBe('No charge');
  });

  it('builds the receipt from the server breakdown; the driver also sees fee and earnings', async () => {
    const receipt = async (r: Ride, viewer: 'passenger' | 'driver') => {
      render(
        <ThemeProvider>
          <ReceiptCard ride={r} viewer={viewer} />
        </ThemeProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('ride-details-receipt-card')).toBeTruthy());
    };
    await receipt(ride(), 'passenger');
    for (const text of ['Base fare', 'Rs 100', 'Rs 250', 'Rs 70', 'Stops', 'Rs 50', 'Total', 'Rs 470']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText(/^Distance/)).toBeTruthy();
    expect(screen.getByText(/^Time/)).toBeTruthy();
    expect(screen.queryByText('Your earnings')).toBeNull();
    screen.unmount();

    await receipt(ride(), 'driver');
    expect(screen.getByText('Raah-e-Haq fee')).toBeTruthy();
    expect(screen.getByText('−Rs 94')).toBeTruthy();
    expect(screen.getByText('Your earnings')).toBeTruthy();
    expect(screen.getByText('Rs 376')).toBeTruthy();
    screen.unmount();

    await receipt(ride({ fare_breakdown: null }), 'passenger');
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Rs 470')).toBeTruthy();
    expect(screen.queryByText('Base fare')).toBeNull();
    screen.unmount();

    await receipt(ride({ status: 'cancelled' }), 'passenger');
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText('Base fare')).toBeNull();
  });

  it('[T-567] a cancelled ride with no fee says "No charge" as its payment status, never "Pending"', async () => {
    expect(receiptPaymentStatus(ride({ status: 'cancelled', payment_status: 'pending' }))).toBe('No charge');
    expect(receiptPaymentStatus(ride({ status: 'cancelled', payment_status: 'pending', cancellation_fee: 0 }))).toBe('No charge');
    // A cancel fee is still owed: the server's status stays.
    expect(receiptPaymentStatus(ride({ status: 'cancelled', payment_status: 'pending', cancellation_fee: '50.00' }))).toBe('Pending');
    expect(receiptPaymentStatus(ride())).toBe('Paid');
    expect(receiptPaymentStatus(ride({ payment_status: null }))).toBeNull();

    render(
      <ThemeProvider>
        <ReceiptCard
          ride={ride({ status: 'cancelled', payment_status: 'pending', ride_id: 'RIDE-01M56ZS5EGCN0X09WBNM5TW3K1' })}
          viewer="passenger"
        />
      </ThemeProvider>,
    );
    expect(within(await screen.findByTestId('ride-details-receipt-status')).getByText('No charge')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
    // T-567: the long ride code stays on one line and shrinks to fit (no wrapped last digit).
    const code = within(screen.getByTestId('ride-details-receipt-code')).getByText('RIDE-01M56ZS5EGCN0X09WBNM5TW3K1');
    expect(code.props.numberOfLines).toBe(1);
    expect(code.props.adjustsFontSizeToFit).toBe(true);
  });

  it('[T-567] a completed receipt keeps the ride code on one line too', async () => {
    render(
      <ThemeProvider>
        <ReceiptCard ride={ride({ ride_id: 'RIDE-01M56ZS5EGCN0X09WBNM5TW3K1' })} viewer="passenger" />
      </ThemeProvider>,
    );
    const code = await screen.findByText('RIDE-01M56ZS5EGCN0X09WBNM5TW3K1');
    expect(code.props.numberOfLines).toBe(1);
    expect(code.props.adjustsFontSizeToFit).toBe(true);
    // Other values keep their normal wrapping.
    expect(screen.getByText('Rs 470').props.numberOfLines).toBeUndefined();
  });

  it('the chat can be opened while active and for the read window after the ride ends', () => {
    const ended = new Date('2026-10-10T09:26:00+05:00').getTime();
    const hours = (h: number) => new Date(ended + h * 3600 * 1000);
    expect(canOpenChat(ride(), hours(1))).toBe(true);
    expect(canOpenChat(ride(), hours(CHAT_READ_WINDOW_HOURS + 0.1))).toBe(false);
    expect(canOpenChat(ride({ status: 'started', completed_at: null }), hours(100))).toBe(true);
    expect(canOpenChat(ride({ driver_id: null, status: 'cancelled', cancelled_at: '2026-10-10T09:26:00+05:00' }), hours(1))).toBe(false);
    expect(canOpenChat(ride({ status: 'requested', driver_id: null, completed_at: null }), hours(0))).toBe(false);
  });
});

describe('RideHistoryScreen', () => {
  it('UI-R15: groups rides by local day (Today / Yesterday / date), keeping the order', () => {
    const now = new Date(2026, 9, 18, 15, 0);
    const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString();
    const sections = groupRidesByDay(
      [
        ride({ id: 1, completed_at: at(18, 14) }),
        ride({ id: 2, completed_at: at(18, 9) }),
        ride({ id: 3, completed_at: at(17, 20) }),
        ride({ id: 4, status: 'cancelled', completed_at: null, cancelled_at: at(28, 9).replace('2026-10', '2026-09') }),
      ],
      now,
    );
    expect(sections.map((s) => s.title)).toEqual(['Today', 'Yesterday', expect.stringMatching(/^\w{3}, \d{1,2} \w{3}$/)]);
    expect(sections.map((s) => s.data.map((r) => r.id))).toEqual([[1, 2], [3], [4]]);
    expect(groupRidesByDay([ride({ id: 5, completed_at: 'not a date', requested_at: null, created_at: null })], now)[0].title).toBe('');
  });

  it('UI-R15: dense row: day header, time and vehicle, a status pill only when not simply completed', async () => {
    const today = new Date();
    today.setHours(9, 26, 0, 0);
    mock.onGet('/rides').reply(
      200,
      envelope(
        [
          rawRide({ completed_at: today.toISOString() }),
          rawRide({ id: 42, status: 'cancelled', completed_at: null, cancelled_at: today.toISOString() }),
        ],
        pageInfo(1, 1, 2),
      ),
    );
    show(RideHistoryScreen);
    expect(await screen.findByTestId('ride-history-row-41')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
    expect(screen.getAllByText('9:26 AM')).toHaveLength(2);
    expect(screen.getAllByText(' · Car')).toHaveLength(2);
    expect(screen.queryByTestId('ride-history-row-41-status')).toBeNull();
    expect(screen.getByTestId('ride-history-row-42-status')).toBeTruthy();
    // The filter chips sit outside the scrolling list (pinned), with the hairline under them.
    expect(screen.getByTestId('ride-history-filter')).toBeTruthy();
    expect(screen.getByTestId('ride-history-hairline', { includeHiddenElements: true })).toBeTruthy();
  });

  it('UI-R15: the driver empty state has no "Book a ride" action', async () => {
    mock.onGet('/rides').reply(200, envelope([], pageInfo(1, 1, 0)));
    show(RideHistoryScreen, 'driver');
    expect(await screen.findByText('No trips yet')).toBeTruthy();
    expect(screen.queryByTestId('ride-history-empty-book')).toBeNull();
  });

  it('shows loading, then the rides from the API (no demo rides); a tap opens RideDetails', async () => {
    let respond: (value: [number, unknown]) => void = () => undefined;
    mock.onGet('/rides').reply(() => new Promise((resolve) => (respond = resolve)));
    show(RideHistoryScreen);
    expect(await screen.findByTestId('ride-history-loading')).toBeTruthy();
    respond([200, envelope([rawRide(), rawRide({ id: 42, status: 'cancelled', cancelled_at: '2026-10-09T10:00:00+05:00' })], pageInfo(1, 1, 2))]);
    expect(await screen.findByTestId('ride-history-row-41')).toBeTruthy();
    expect(screen.queryByText('Johar Town')).toBeNull();
    expect(screen.getAllByText('Iqbal Town, Lahore')).toHaveLength(2);
    expect(screen.getAllByText('+2 stops')).toHaveLength(2);
    expect(screen.getByTestId('ride-history-row-41-amount').props.children).toBe('Rs\u00A0470');
    expect(screen.getByTestId('ride-history-row-42-amount').props.children).toBe('No charge');
    expect(screen.getByTestId('ride-history-end')).toBeTruthy();

    fireEvent.press(screen.getByTestId('ride-history-row-41'));
    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', { rideId: 41, ride: expect.objectContaining({ id: 41 }) });
  });

  it('each row shows the icon of its own vehicle type: bike, rickshaw, car (T-524)', async () => {
    mock.onGet('/rides').reply(
      200,
      envelope(
        [rawRide(), rawRide({ id: 42, vehicle_type: 'bike' }), rawRide({ id: 43, vehicle_type: 'rickshaw' })],
        pageInfo(1, 1, 3),
      ),
    );
    show(RideHistoryScreen);
    const glyph = async (id: number) => (await screen.findByTestId(`ride-history-row-${id}-vehicle-icon`)).props.children;
    expect(await glyph(41)).toBe('car-side');
    expect(await glyph(42)).toBe('motorbike');
    expect(await glyph(43)).toBe('rickshaw');
  });

  it('a driver sees their earnings on each ride', async () => {
    mock.onGet('/rides').reply(200, envelope([rawRide()], pageInfo(1, 1, 1)));
    show(RideHistoryScreen, 'driver');
    expect((await screen.findByTestId('ride-history-row-41-amount')).props.children).toBe('Rs\u00A0376');
  });

  it('shows the error state with retry', async () => {
    mock.onGet('/rides').replyOnce(500, {});
    mock.onGet('/rides').reply(200, envelope([rawRide()], pageInfo(1, 1, 1)));
    show(RideHistoryScreen);
    await waitFor(() => expect(screen.getByTestId('ride-history-error')).toBeTruthy());
    fireEvent.press(screen.getByTestId('ride-history-error-retry'));
    expect(await screen.findByTestId('ride-history-row-41')).toBeTruthy();
  });

  it('shows the empty state per role and per filter', async () => {
    mock.onGet('/rides').reply(200, envelope([], pageInfo(1, 1, 0)));
    show(RideHistoryScreen, 'driver');
    expect(await screen.findByText('No trips yet')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Show, Cancelled' }));
    expect(await screen.findByText('No cancelled rides')).toBeTruthy();
    expect(mock.history.get[1].params).toMatchObject({ status: 'cancelled' });
  });

  it('loads the next page on scroll and keeps rides already shown', async () => {
    mock.onGet('/rides').reply((config) => {
      const { page } = config.params as { page: number };
      return page === 1
        ? [200, envelope([rawRide({ id: 1 }), rawRide({ id: 2 })], pageInfo(1, 2, 3))]
        : [200, envelope([rawRide({ id: 2 }), rawRide({ id: 3 })], pageInfo(2, 2, 3))];
    });
    show(RideHistoryScreen);
    expect(await screen.findByTestId('ride-history-row-2')).toBeTruthy();
    expect(screen.queryByTestId('ride-history-end')).toBeNull();
    act(() => {
      screen.getByTestId('ride-history-list').props.onEndReached();
    });
    expect(await screen.findByTestId('ride-history-row-3')).toBeTruthy();
    expect(screen.getAllByTestId('ride-history-row-2')).toHaveLength(1);
    expect(mock.history.get[1].params).toMatchObject({ page: 2 });
  });
});

describe('RideDetailsScreen', () => {
  it('passenger, completed: driver first name and car, receipt, Message inside the window, no phone', async () => {
    const now = new Date('2026-10-10T12:00:00+05:00');
    jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] });
    try {
      mockParams = { rideId: 41 };
      let respond: (value: [number, unknown]) => void = () => undefined;
      mock.onGet('/rides/41').reply(() => new Promise((resolve) => (respond = resolve)));
      show(RideDetailsScreen);
      expect(await screen.findByTestId('ride-details-loading')).toBeTruthy();
      respond([200, envelope(rawRide())]);
      expect((await screen.findByTestId('ride-details-amount')).props.children).toBe('Rs\u00A0470');
      expect(screen.queryByTestId('ride-details-you-keep')).toBeNull();
      expect(screen.getByTestId('ride-details-person-name').props.children).toBe('Bilal');
      expect(screen.getByTestId('ride-details-person-subtitle').props.children).toBe('Toyota Corolla');
      expect(screen.getByTestId('ride-details-person-subtitle-color').props.children).toBe('White');
      // UI-R5: the plate sits in the PersonCard plate pill.
      expect(screen.getByTestId('ride-details-person-plate').props.children).toBe('LEA-1234');
      expect(screen.getByText('First stop')).toBeTruthy();
      expect(screen.getByTestId('ride-details-metrics').props.children).toBe('6.4 km · 18 min');
      expect(screen.getByTestId('ride-details-receipt-total')).toBeTruthy();
      expect(screen.queryByTestId('ride-details-receipt-fee')).toBeNull();
      expect(screen.getByText('RH-TEST41')).toBeTruthy();
      expect(screen.getByTestId('ride-details-step-completed')).toBeTruthy();
      expect(screen.queryByTestId('ride-details-cancellation')).toBeNull();
      expect(allText()).not.toContain(DRIVER_PHONE);
      expect(allText()).not.toContain('Khan');

      fireEvent.press(screen.getByTestId('ride-details-message'));
      expect(mockNavigate).toHaveBeenCalledWith('RideChat', { rideId: 41 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('driver: passenger first name, "Rider", fee and earnings; no Message after the window; no phone', async () => {
    mockParams = { rideId: 41 };
    // completed_at is days ago in real time, so the chat window is over.
    mock.onGet('/rides/41').reply(200, envelope(rawRide({ completed_at: '2026-01-01T09:26:00+05:00' })));
    show(RideDetailsScreen, 'driver');
    // T-707: the hero is the cash the rider paid (it sits on the cash line); the net is "You keep".
    expect((await screen.findByTestId('ride-details-amount')).props.children).toBe('Rs\u00A0470');
    expect(screen.getByTestId('ride-details-you-keep')).toHaveTextContent(/^You keep/);
    expect(screen.getByTestId('ride-details-you-keep-amount').props.children).toBe('Rs\u00A0376');
    expect(screen.getByTestId('ride-details-person-name').props.children).toBe('Ayesha');
    // UI-R5 PersonCard: the passenger shape has no vehicle line (the card title says "Your passenger").
    expect(screen.queryByTestId('ride-details-person-subtitle')).toBeNull();
    expect(screen.queryByTestId('ride-details-person-plate')).toBeNull();
    expect(screen.getByTestId('ride-details-receipt-fee')).toBeTruthy();
    expect(screen.getByTestId('ride-details-receipt-earned')).toBeTruthy();
    expect(screen.queryByTestId('ride-details-message')).toBeNull();
    expect(allText()).not.toContain(PASSENGER_PHONE);
    // T-543: the header (and Back) sits above the scrolling content, so it never scrolls away.
    expect(screen.getByTestId('ride-details-back')).toBeTruthy();
    expect(within(screen.getByTestId('ride-details-scroll')).queryByTestId('ride-details-back')).toBeNull();
    expect(within(screen.getByTestId('ride-details-scroll')).getByTestId('ride-details-amount')).toBeTruthy();
  });

  it('cancelled: who cancelled and the note, "No charge", no fare lines', async () => {
    const cancelled = rawRide({
      status: 'cancelled',
      completed_at: null,
      started_at: null,
      cancelled_at: '2026-01-01T09:05:00+05:00',
      cancellation_reason: 'driver',
      cancellation_note: 'Car broke down',
    });
    mockParams = { rideId: 41, ride: toRide(cancelled) };
    mock.onGet('/rides/41').reply(200, envelope(cancelled));
    show(RideDetailsScreen);
    // The row passed from the list shows at once.
    expect((await screen.findByTestId('ride-details-amount')).props.children).toBe('No charge');
    expect(screen.getByText('The driver cancelled this ride.')).toBeTruthy();
    expect(screen.getByTestId('ride-details-cancellation-note').props.children).toBe('Note: Car broke down');
    expect(screen.queryByTestId('ride-details-receipt-total')).toBeNull();
    expect(screen.getByTestId('ride-details-step-cancelled')).toBeTruthy();
    await waitFor(() => expect(mock.history.get).toHaveLength(1));
  });

  it("BE-105: the women's-safety report entry follows ride.safety_report (button, then status after reopening)", async () => {
    mockParams = { rideId: 41 };
    mock.onGet('/rides/41').replyOnce(200, envelope(rawRide({ safety_report: { can_report: true, report: null } })));
    show(RideDetailsScreen);
    expect(await screen.findByTestId('ride-details-safety-report-button')).toBeTruthy();
    screen.unmount();

    // Reopened after reporting: no button, the report and its status instead.
    mock.onGet('/rides/41').replyOnce(
      200,
      envelope(rawRide({ safety_report: { can_report: false, report: { category: 'women_safety', status: 'open', created_at: '2026-01-01T10:00:00+05:00' } } })),
    );
    show(RideDetailsScreen);
    expect(await screen.findByTestId('ride-details-safety-report-status')).toHaveTextContent("Women's-safety report sent · Received");
    expect(screen.queryByTestId('ride-details-safety-report-button')).toBeNull();
    screen.unmount();

    // Outside the window (or no driver): the server says no, nothing shows; no block, nothing either.
    mock.onGet('/rides/41').replyOnce(200, envelope(rawRide({ safety_report: { can_report: false, report: null } })));
    show(RideDetailsScreen);
    expect(await screen.findByTestId('ride-details-summary')).toBeTruthy();
    await waitFor(() => expect(mock.history.get).toHaveLength(3));
    expect(screen.queryByTestId('ride-details-safety-report-button')).toBeNull();
    expect(screen.queryByTestId('ride-details-safety-report-sent')).toBeNull();
  });

  it('403/404: "This ride isn\'t available" with Back', async () => {
    mockParams = { rideId: 99 };
    mock.onGet('/rides/99').reply(403, { success: false, error: { code: 'FORBIDDEN', message: 'You are not allowed to view this ride' } });
    show(RideDetailsScreen);
    expect(await screen.findByTestId('ride-details-unavailable')).toBeTruthy();
    fireEvent.press(screen.getByText('Back', { exact: true }));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('a server error shows the error state with retry', async () => {
    mockParams = { rideId: 41 };
    mock.onGet('/rides/41').replyOnce(500, {});
    mock.onGet('/rides/41').reply(200, envelope(rawRide()));
    show(RideDetailsScreen);
    await waitFor(() => expect(screen.getByTestId('ride-details-error')).toBeTruthy());
    fireEvent.press(screen.getByTestId('ride-details-error-retry'));
    expect(await screen.findByTestId('ride-details-summary')).toBeTruthy();
  });
});

describe('UI-R15 review fixes', () => {
  it('an in-progress ride shows its status pill only ("Finding driver"), no amount', async () => {
    mock.onGet('/rides').reply(200, envelope([rawRide({ id: 51, status: 'requested', completed_at: null })], pageInfo(1, 1, 1)));
    show(RideHistoryScreen);
    expect(await screen.findByTestId('ride-history-row-51')).toBeTruthy();
    expect(within(screen.getByTestId('ride-history-row-51-status')).getByText('Finding driver')).toBeTruthy();
    expect(screen.queryByTestId('ride-history-row-51-amount')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('ride-history-row-51-time').props.style)).toEqual(expect.objectContaining({ flexShrink: 0 }));
  });

  it('reads the pickup and drop-off points; 0,0 and missing values are no point', () => {
    const withPoints = ride({ pickup_latitude: '31.5204', pickup_longitude: '74.3587', dropoff_latitude: 31.51, dropoff_longitude: 74.35 });
    expect(withPoints.pickupLocation).toEqual({ latitude: 31.5204, longitude: 74.3587 });
    expect(withPoints.dropoffLocation).toEqual({ latitude: 31.51, longitude: 74.35 });
    expect(ride({ pickup_latitude: 0, pickup_longitude: 0 }).pickupLocation).toBeNull();
    expect(ride().dropoffLocation).toBeNull();
    expect(staticMapRegion([])).toBeNull();
    const pickup = withPoints.pickupLocation;
    const dropoff = withPoints.dropoffLocation;
    if (!pickup || !dropoff) throw new Error('points expected');
    const region = staticMapRegion([pickup, dropoff]);
    expect(region?.latitude).toBeCloseTo(31.5152, 4);
    expect(region?.latitudeDelta).toBeGreaterThanOrEqual(0.01);
  });

  it('the receipt shows a static map with both pins from the ride itself (one request)', async () => {
    mockParams = { rideId: 41 };
    mock.onGet('/rides/41').reply(
      200,
      envelope(rawRide({ pickup_latitude: 31.52, pickup_longitude: 74.35, dropoff_latitude: 31.51, dropoff_longitude: 74.34 })),
    );
    show(RideDetailsScreen);
    const map = await screen.findByTestId('ride-details-map');
    expect(map.props.pointerEvents).toBe('none');
    expect(screen.getByTestId('ride-details-map-pickup', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('ride-details-map-dropoff', { includeHiddenElements: true })).toBeTruthy();
    expect(mock.history.get).toHaveLength(1);
  });

  it('without coordinates the receipt shows the map fallback block', async () => {
    mockParams = { rideId: 41 };
    mock.onGet('/rides/41').reply(200, envelope(rawRide()));
    show(RideDetailsScreen);
    expect(await screen.findByTestId('ride-details-map-fallback')).toBeTruthy();
  });

  it('Share sends a text receipt with no names or phone numbers', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    mockParams = { rideId: 41 };
    mock.onGet('/rides/41').reply(200, envelope(rawRide()));
    show(RideDetailsScreen);
    fireEvent.press(await screen.findByTestId('ride-details-share'));
    expect(share).toHaveBeenCalledTimes(1);
    const content = share.mock.calls[0][0];
    const message = 'message' in content && content.message ? content.message : '';
    expect(message).toContain('Raah-e-Haq ride receipt');
    expect(message).toContain('From: Iqbal Town, Lahore');
    expect(message).toContain('To: Liberty Market, Lahore');
    expect(message).toContain('Total: Rs\u00A0470');
    expect(message).toContain('RH-TEST41');
    [DRIVER_PHONE, PASSENGER_PHONE, 'Bilal', 'Ayesha', 'LEA-1234'].forEach((secret) => {
      expect(message).not.toContain(secret);
    });
    share.mockRestore();
  });

  it('a cancelled ride receipt text says "No charge", not a total', () => {
    const text = receiptShareText(ride({ status: 'cancelled', completed_at: null, cancelled_at: '2026-10-10T09:10:00+05:00' }), 'passenger');
    expect(text).toContain('No charge');
    expect(text).not.toContain('Total:');
  });

  it('a masked phone shows its last two digits only', () => {
    expect(shortMaskedPhone('+92300*****67')).toBe('•••• 67');
    expect(shortMaskedPhone('**********09')).toBe('•••• 09');
    expect(shortMaskedPhone('*****')).toBeNull();
    expect(shortMaskedPhone(null)).toBeNull();
  });
});

describe('UI-R15 re-review fixes', () => {
  it('a charged cancellation fee reads in textPrimary on the row; "No charge" stays muted', async () => {
    mock.onGet('/rides').reply(
      200,
      envelope(
        [
          rawRide({ id: 61, status: 'cancelled', completed_at: null, cancelled_at: '2026-10-10T09:10:00+05:00', cancellation_fee: '30.00' }),
          rawRide({ id: 62, status: 'cancelled', completed_at: null, cancelled_at: '2026-10-10T09:00:00+05:00' }),
        ],
        pageInfo(1, 1, 2),
      ),
    );
    show(RideHistoryScreen);
    const fee = await screen.findByTestId('ride-history-row-61-amount');
    expect(fee.props.children).toBe('Rs\u00A030 fee');
    expect(StyleSheet.flatten(fee.props.style).color).toBe(LightTheme.colors.textPrimary);
    const free = screen.getByTestId('ride-history-row-62-amount');
    expect(free.props.children).toBe('No charge');
    expect(StyleSheet.flatten(free.props.style).color).toBe(LightTheme.colors.textMuted);
  });

  it('a cancelled ride with a fee shows the fee as the amount with a "Cancellation fee" label', async () => {
    mockParams = { rideId: 41 };
    mock.onGet('/rides/41').reply(
      200,
      envelope(rawRide({ status: 'cancelled', completed_at: null, cancelled_at: '2026-10-10T09:10:00+05:00', cancellation_fee: '30.00' })),
    );
    show(RideDetailsScreen);
    const amount = await screen.findByTestId('ride-details-amount');
    expect(amount.props.children).toBe('Rs\u00A030');
    expect(StyleSheet.flatten(amount.props.style).color).toBe(LightTheme.colors.textPrimary);
    expect(screen.getByTestId('ride-details-fee-label').props.children).toBe('Cancellation fee');
  });
});
