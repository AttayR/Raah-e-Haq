/**
 * UI-R4 (DESIGN_SYSTEM §8.1): passenger Activity tab: "Activity" title, Rides | Wallet.
 * UI-R15: the title sits in the bar, the segments and ride filters stay pinned, a slim summary
 * strip (GET /me/stats) sits over the ride history (GET /rides) grouped by day;
 * Wallet = the cash-only wallet (GET /wallet + ledger). The hidden segment never fetches; a
 * `segment` param (a "ride completed" notification) selects it.
 */
import React from 'react';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { apiClient } from '../../src/services/api';
import ActivityScreen from '../../src/features/activity/ActivityScreen';
import { makeRide, makeStore, page } from '../../test-utils/rideFixtures';
import { envelope, pageInfo, rawWallet } from '../../test-utils/walletFixtures';

const mockNavigate = jest.fn();
let mockParams: { segment?: 'rides' | 'wallet' } | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ key: 'Activity-1', name: 'Activity', params: mockParams }),
  useIsFocused: () => true,
}));

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const renderActivity = async () => {
  render(
    <Provider store={makeStore()}>
      <ThemeProvider>
        <ActivityScreen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockParams = undefined;
  mockNavigate.mockClear();
  mock.onGet('/me/stats').reply(200, {
    success: true,
    data: {
      role: 'passenger',
      currency: 'PKR',
      total_rides: 4,
      rating: null,
      total_distance_km: 12.5,
      total_spent: 1250,
    },
  });
  mock.onGet('/rides').reply(200, page([makeRide({ id: 61, status: 'completed', dropoff_address: 'Liberty Market' })]));
  mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: 0 })));
  mock.onGet('/wallet/transactions').reply(200, envelope([], pageInfo(1, 1, 0)));
});

afterEach(() => {
  mock.restore();
});

describe('Activity tab', () => {
  it('opens on Rides: title, segments, stats and the rides from GET /rides; the wallet is not loaded', async () => {
    await renderActivity();
    // UI-R15: one title, in the bar (no empty band, no second collapsing copy).
    expect(screen.getAllByText('Activity')).toHaveLength(1);
    expect(screen.getByTestId('activity-header-title')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Activity, Rides' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    // The slim strip: server values, short labels, one accessible cell per figure.
    expect(screen.getByTestId('activity-summary')).toBeTruthy();
    expect(screen.getByLabelText('Rides, 4')).toBeTruthy();
    expect(screen.getByLabelText('Rating, New')).toBeTruthy();
    expect(screen.getByLabelText('Distance, 12.5 km')).toBeTruthy();
    expect(screen.getByLabelText('Spent, Rs 1,250')).toBeTruthy();
    expect(screen.queryByTestId('home-stats')).toBeNull();
    expect(screen.getByText('Liberty Market')).toBeTruthy();
    expect(mock.history.get.filter(r => r.url === '/wallet')).toHaveLength(0);
    // The history filter sits under the segments as chips, not a second segmented control.
    expect(screen.getByRole('radio', { name: 'Show, Cancelled' })).toBeTruthy();
    fireEvent.press(screen.getByTestId('ride-history-row-61'));
    expect(mockNavigate).toHaveBeenCalledWith('RideDetails', expect.objectContaining({ rideId: 61 }));
  });

  it('Wallet shows the cash-only wallet from GET /wallet', async () => {
    await renderActivity();
    fireEvent.press(screen.getByRole('radio', { name: 'Activity, Wallet' }));
    await flush();
    expect(mock.history.get.filter(r => r.url === '/wallet')).toHaveLength(1);
    expect(screen.getByTestId('wallet-cash-only')).toBeTruthy();
    expect(screen.queryByTestId('activity-summary')).toBeNull();
    expect(screen.queryByTestId('ride-history-filter')).toBeNull();
  });

  it('no rides yet: no summary strip, and the empty state offers to book a ride', async () => {
    mock.onGet('/me/stats').reply(200, {
      success: true,
      data: { role: 'passenger', currency: 'PKR', total_rides: 0, rating: null, total_distance_km: 0, total_spent: 0 },
    });
    mock.onGet('/rides').reply(200, page([]));
    await renderActivity();
    expect(screen.queryByTestId('activity-summary')).toBeNull();
    expect(screen.getByText('No rides yet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ride-history-empty-book'));
    expect(mockNavigate).toHaveBeenCalledWith('Booking');
  });

  it('pull to refresh re-reads the rides and the summary', async () => {
    await renderActivity();
    const before = mock.history.get.filter(r => r.url === '/me/stats').length;
    await act(async () => {
      screen.getByTestId('ride-history-list').props.refreshControl.props.onRefresh();
    });
    await flush();
    expect(mock.history.get.filter(r => r.url === '/me/stats').length).toBeGreaterThan(before);
  });

  it('a segment param selects Wallet on arrival', async () => {
    mockParams = { segment: 'wallet' };
    await renderActivity();
    expect(screen.getByRole('radio', { name: 'Activity, Wallet' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(mock.history.get.filter(r => r.url === '/rides')).toHaveLength(0);
  });
});
