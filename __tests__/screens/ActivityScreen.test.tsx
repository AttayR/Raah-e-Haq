/**
 * UI-R4 (DESIGN_SYSTEM §8.1): passenger Activity tab: large "Activity" title, Rides | Wallet.
 * Rides = ride stats (GET /me/stats, moved from Home) over the ride history (GET /rides);
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
    expect(screen.getAllByText('Activity').length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: 'Activity, Rides' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('home-stats')).toBeTruthy();
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
    expect(screen.queryByTestId('home-stats')).toBeNull();
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
