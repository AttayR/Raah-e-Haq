/**
 * UI-R4 (DESIGN_SYSTEM §8.1, §8.3; owner decision 2026-10-11): passenger Home is the full map
 * with the "Where to?" sheet. Opens at peek 170 (ride-only heading; UI-R20), snaps peek → half → full, map controls fade at
 * full; "Where to?" pushes Booking; recent rides come from GET /rides; avatar opens Profile; no
 * notifications bell (the Inbox tab carries the badge).
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Provider } from 'react-redux';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { apiClient } from '../../src/services/api';
import PassengerHomeScreen from '../../src/screens/Passenger/PassengerHomeScreen';
import { toHomeRecentRides } from '../../src/features/ride-history/recentRides';
import { makeRide, makeStore, page } from '../../test-utils/rideFixtures';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));

const flat = (style: StyleProp<ViewStyle>): ViewStyle => StyleSheet.flatten(style) ?? {};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

/** The sheet's container is the absolute-fill parent of the sheet. */
const layoutSheet = (height: number) =>
  act(() => {
    fireEvent(screen.getByTestId('home-sheet').parent!.parent!, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 393, height } },
    });
  });

const renderHome = async () => {
  render(
    <Provider store={makeStore()}>
      <ThemeProvider>
        <PassengerHomeScreen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('map-first Home', () => {
  it('opens with the greeting, the tagline and "Where to?" (no service row while no parcel tier is known); snaps half → full and the map controls fade at full', async () => {
    mock.onGet('/rides').reply(200, page([]));
    await renderHome();
    // Safe-area mock: zero insets, so full = 874 − 0 − 8.
    await layoutSheet(874);
    // UI-R20b: no parcel tier known (the catalogue is not mocked here): no service row, and the
    // ride-only heading is retired (the tagline says "within the city").
    expect(screen.queryByTestId('home-service-row')).toBeNull();
    expect(screen.getByTestId('home-greeting')).toBeTruthy();
    expect(screen.getByTestId('home-tagline')).toHaveTextContent('Fixed fares, within the city');
    expect(screen.getByTestId('home-where-to')).toBeTruthy();
    expect(screen.getByTestId('home-controls').props.pointerEvents).toBe('box-none');

    const handle = screen.getByTestId('home-sheet-handle');
    expect(handle.props.accessibilityLabel).toBe('Where to sheet');
    expect(flat(screen.getByTestId('home-sheet').props.style).height).toBe(866);
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    expect(screen.getByTestId('home-sheet-scroll').props.scrollEnabled).toBe(true);
    // At full the map controls step aside (§8.3).
    expect(screen.getByTestId('home-controls', { includeHiddenElements: true }).props.pointerEvents).toBe('none');
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } }));
    expect(screen.getByTestId('home-controls').props.pointerEvents).toBe('box-none');
  });

  it('"Where to?" pushes Booking, Saved places opens its screen, the avatar opens Profile; no bell', async () => {
    mock.onGet('/rides').reply(200, page([]));
    await renderHome();
    fireEvent.press(screen.getByTestId('home-where-to'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking');
    fireEvent.press(screen.getByTestId('home-saved-places'));
    expect(mockNavigate).toHaveBeenLastCalledWith('FavoriteLocations');
    fireEvent.press(screen.getByRole('button', { name: 'Open your profile' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('Profile');
    expect(screen.queryByLabelText(/notifications/i)).toBeNull();
    // No rides yet: no recent rides section, no invented rows.
    expect(screen.queryByTestId('home-recent-rides')).toBeNull();
  });

  it('saved places are chips from GET /saved-places: a tap books a ride there, "+ Add" opens the form (T-516)', async () => {
    mock.onGet('/rides').reply(200, page([]));
    mock.onGet('/saved-places').reply(200, {
      success: true,
      data: {
        places: [
          { id: 1, label: 'home', name: null, address: 'House 1, DHA Phase 5, Lahore', lat: 31.46, lng: 74.4, place_id: null, sort_order: 0, updated_at: null },
          { id: 5, label: 'other', name: 'Gym', address: 'Main Boulevard, Lahore', lat: 31.52, lng: 74.34, place_id: null, sort_order: 1, updated_at: null },
        ],
        max_other: 10,
      },
    });
    await renderHome();
    expect(screen.getByTestId('home-saved-place-1')).toHaveTextContent(/Home/);
    expect(screen.getByTestId('home-saved-place-5')).toHaveTextContent(/Gym/);
    expect(screen.queryByText('Work')).toBeNull();

    fireEvent.press(screen.getByTestId('home-saved-place-5'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', {
      destination: { latitude: 31.52, longitude: 74.34, address: 'Main Boulevard, Lahore' },
    });
    fireEvent.press(screen.getByTestId('home-saved-place-add'));
    expect(mockNavigate).toHaveBeenLastCalledWith('SavedPlaceEditor', {
      taken: { home: 'House 1, DHA Phase 5, Lahore' },
      otherFull: false,
    });
  });

  it('when the saved places fail to load the row offers only the list (UI-R9: no "Add home" guess)', async () => {
    mock.onGet('/rides').reply(200, page([]));
    mock.onGet('/saved-places').reply(500, { success: false, message: 'Server error' });
    await renderHome();
    expect(screen.queryByTestId(/^home-saved-place-\d+$/)).toBeNull();
    expect(screen.queryByTestId('home-saved-place-add')).toBeNull();
    expect(screen.getByTestId('home-saved-places')).toBeTruthy();
  });

  it('recent rides come from GET /rides; a row opens its details and "See all" opens Activity › Rides', async () => {
    mock
      .onGet('/rides')
      .reply(
        200,
        page([
          makeRide({ id: 61, status: 'completed', dropoff_address: 'Liberty Market' }),
          makeRide({ id: 62, status: 'accepted', dropoff_address: 'In progress' }),
        ]),
      );
    await renderHome();
    expect(screen.getByTestId('home-recent-ride-61')).toHaveTextContent(/Liberty Market/);
    // UI-R9: its drop-off is also a recent destination chip; a tap books a ride there.
    fireEvent.press(screen.getByTestId('home-recent-place-0'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', {
      destination: { latitude: 31.48, longitude: 74.3, address: 'Liberty Market' },
    });
    // T-536 (PERF-19): one small page for the card, not the 20-ride history page.
    const ridesGet = mock.history.get.find((r) => r.url === '/rides');
    expect(ridesGet?.params).toMatchObject({ page: 1, per_page: 4 });
    // A ride still in progress is the booking screen's, not a "recent" ride.
    expect(screen.queryByText('In progress')).toBeNull();
    fireEvent.press(screen.getByTestId('home-recent-ride-61'));
    expect(mockNavigate).toHaveBeenLastCalledWith('RideDetails', expect.objectContaining({ rideId: 61 }));
    fireEvent.press(screen.getByRole('button', { name: 'See all rides' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('PassengerTabs', {
      screen: 'Activity',
      params: { segment: 'rides' },
    });
  });
});

describe('toHomeRecentRides', () => {
  it('keeps the last three finished rides with the passenger fare', () => {
    const rows = toHomeRecentRides(
      [1, 2, 3, 4].map(id => ({
        id,
        status: 'completed',
        pickupAddress: `A${id}`,
        dropoffAddress: `B${id}`,
      })) as unknown as Parameters<typeof toHomeRecentRides>[0],
    );
    expect(rows.map(row => row.id)).toEqual(['1', '2', '3']);
    expect(rows[0]).toMatchObject({ from: 'A1', to: 'B1', status: 'completed' });
  });
});
