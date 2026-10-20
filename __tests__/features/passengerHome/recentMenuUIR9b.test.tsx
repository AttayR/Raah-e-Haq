/**
 * UI-R9b (passenger-home Interactions): long press on a recent destination chip opens "Save as
 * Home / Save as Work / Save place / Remove from recents". Saving opens the saved-place form with
 * the recent's location (nothing is written before Save there; a saved Home / Work is edited, a
 * replace); Remove hides it on this phone only (no request), on Home and in the search, until
 * sign-out. The kit Chip gets the long press and a screen-reader `longpress` action.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Chip } from '../../../src/components/ui/Chip';
import { SavedPlaceChips } from '../../../src/features/saved-places/components/SavedPlaceChips';
import {
  RecentPlaceMenu,
  editorParamsForRecent,
  useRecentPlaceMenu,
} from '../../../src/features/passenger-home/components/RecentPlaceMenu';
import {
  HIDDEN_RECENTS_KEY,
  __resetHiddenRecentsForTests,
  clearHiddenRecents,
  hideRecent,
  loadHiddenRecents,
  useHiddenRecents,
} from '../../../src/features/passenger-home/hiddenRecents';
import { recentDestinations, type RecentDestination } from '../../../src/features/passenger-home/recentDestinations';
import { toRide } from '../../../src/features/ride-history/api';
import type { Ride } from '../../../src/features/ride-history/types';
import type { SavedPlace } from '../../../src/features/saved-places/types';
import { toast } from '../../../src/core/toast';
import { makeRide } from '../../../test-utils/rideFixtures';

jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const recent: RecentDestination = {
  key: 'emporium mall, johar town, lahore',
  title: 'Emporium Mall',
  subtitle: 'Johar Town, Lahore',
  place: { latitude: 31.46, longitude: 74.26, address: 'Emporium Mall, Johar Town, Lahore' },
};
const place = (over: Partial<SavedPlace>): SavedPlace => ({
  id: 1,
  label: 'home',
  name: null,
  address: 'House 1, DHA Phase 5, Lahore',
  lat: 31.4,
  lng: 74.4,
  placeId: null,
  sortOrder: 0,
  updatedAt: null,
  ...over,
});
const location = { address: 'Emporium Mall, Johar Town, Lahore', lat: 31.46, lng: 74.26, placeId: null };

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

beforeEach(async () => {
  __resetHiddenRecentsForTests();
  await AsyncStorage.clear();
});

describe('kit Chip long press', () => {
  it('a long press and the screen-reader longpress action call onLongPress; tap still presses', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    render(<Chip label="Emporium Mall" onPress={onPress} onLongPress={onLongPress} longPressLabel="More options" testID="c" />);
    const chip = screen.getByTestId('c');
    expect(chip.props.accessibilityActions).toEqual([{ name: 'longpress', label: 'More options' }]);
    expect(chip.props.accessibilityHint).toBe('More options');
    fireEvent(chip, 'longPress');
    fireEvent(chip, 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
    expect(onLongPress).toHaveBeenCalledTimes(2);
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('without onLongPress: no action, no hint', () => {
    render(<Chip label="Home" onPress={jest.fn()} testID="c" />);
    expect(screen.getByTestId('c').props.accessibilityActions).toBeUndefined();
  });
});

describe('Home recent chips', () => {
  it('a long press on a recent opens its menu', () => {
    const onRecentLongPress = jest.fn();
    render(
      <SavedPlaceChips places={[]} onPlace={jest.fn()} recents={[recent]} onRecent={jest.fn()} onRecentLongPress={onRecentLongPress} onAdd={jest.fn()} onOpenAll={jest.fn()} />,
    );
    fireEvent(screen.getByTestId('home-recent-place-0'), 'longPress');
    expect(onRecentLongPress).toHaveBeenCalledWith(recent);
  });
});

describe('the menu', () => {
  it('lists the four actions; Save place is dimmed at the cap; the choice arrives after it closes', async () => {
    const onClose = jest.fn();
    render(<RecentPlaceMenu recent={recent} otherFull onClose={onClose} />);
    await flush();
    expect(screen.getByText('Save as Home')).toBeTruthy();
    expect(screen.getByText('Save as Work')).toBeTruthy();
    expect(screen.getByTestId('recent-place-menu-place')).toBeDisabled();
    fireEvent.press(screen.getByTestId('recent-place-menu-remove'));
    await flush();
    expect(onClose).toHaveBeenCalledWith(recent, 'remove');
  });

  it('T-565: always mounted; closed shows no menu, opening and closing keep the last recent for the slide-out', async () => {
    const onClose = jest.fn();
    const { rerender } = render(<RecentPlaceMenu recent={null} otherFull={false} onClose={onClose} />);
    await flush();
    expect(screen.queryByText('Save as Home')).toBeNull();
    rerender(<RecentPlaceMenu recent={recent} otherFull={false} onClose={onClose} />);
    await flush();
    expect(screen.getByText('Save as Home')).toBeTruthy();
    fireEvent.press(screen.getByTestId('recent-place-menu-home'));
    await flush();
    expect(onClose).toHaveBeenCalledWith(recent, 'home');
    rerender(<RecentPlaceMenu recent={null} otherFull={false} onClose={onClose} />);
    await flush();
    expect(screen.queryByText('Save as Home')).toBeNull();
  });

  it('editor params: a new Home / Work / place with the location, or the saved Home edited (replace)', () => {
    expect(editorParamsForRecent(recent, 'home', [], 10)).toEqual({ label: 'home', location, taken: {}, otherFull: false });
    const home = place({});
    expect(editorParamsForRecent(recent, 'home', [home], 10)).toEqual({ place: home, location });
    expect(editorParamsForRecent(recent, 'work', [home], 10)).toEqual({
      label: 'work',
      location,
      taken: { home: home.address },
      otherFull: false,
    });
    expect(editorParamsForRecent(recent, 'place', [place({ id: 2, label: 'other', name: 'Gym' })], 1)).toMatchObject({ label: 'other', otherFull: true });
  });

  it('the hook: Save opens the form, Remove hides the recent with a toast and no request', async () => {
    const navigate = jest.fn();
    const success = jest.spyOn(toast, 'success');
    const { result } = renderHook(() => useRecentPlaceMenu({ navigate }, [], 10));
    act(() => result.current.open(recent));
    expect(result.current.recent).toBe(recent);
    act(() => result.current.onClose(recent, 'work'));
    expect(result.current.recent).toBeNull();
    expect(navigate).toHaveBeenCalledWith('SavedPlaceEditor', expect.objectContaining({ label: 'work', location }));
    act(() => result.current.onClose(recent, 'remove'));
    expect(success).toHaveBeenCalledWith('Removed from recents');
    expect(navigate).toHaveBeenCalledTimes(1);
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem(HIDDEN_RECENTS_KEY)) ?? '[]')).toEqual([recent.key]);
    success.mockRestore();
  });
});

describe('hidden recents', () => {
  const ride = (id: number, over: Record<string, unknown>): Ride => toRide(makeRide({ id, status: 'completed', ...over })) as Ride;
  const rides = [
    ride(1, { dropoff_address: 'Emporium Mall, Johar Town, Lahore', dropoff_latitude: 31.46, dropoff_longitude: 74.26 }),
    ride(2, { dropoff_address: 'Liberty Market, Gulberg III, Lahore', dropoff_latitude: 31.51, dropoff_longitude: 74.34 }),
  ];

  it('a hidden recent leaves the list and the next one moves up', () => {
    expect(recentDestinations(rides, [], 1).map((r) => r.title)).toEqual(['Emporium Mall']);
    expect(recentDestinations(rides, [], 1, new Set([recent.key])).map((r) => r.title)).toEqual(['Liberty Market']);
  });

  it('the hook follows changes; stored keys load at start; sign-out clears them', async () => {
    await AsyncStorage.setItem(HIDDEN_RECENTS_KEY, JSON.stringify(['a, lahore']));
    const { result } = renderHook(() => useHiddenRecents());
    await act(async () => {
      await loadHiddenRecents();
    });
    expect([...result.current]).toEqual(['a, lahore']);
    act(() => hideRecent('b, lahore'));
    expect([...result.current]).toEqual(['a, lahore', 'b, lahore']);
    await act(async () => {
      await clearHiddenRecents();
    });
    expect(result.current.size).toBe(0);
    expect(await AsyncStorage.getItem(HIDDEN_RECENTS_KEY)).toBeNull();
  });

  it('review: a first read answering after a sign-out cleared the keys never brings them back', async () => {
    let answer: (raw: string | null) => void = () => undefined;
    const getItem = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const { result } = renderHook(() => useHiddenRecents());
    await act(async () => {
      await clearHiddenRecents();
    });
    await act(async () => {
      answer(JSON.stringify(['old user, lahore']));
      await Promise.resolve();
    });
    expect(result.current.size).toBe(0);
    getItem.mockRestore();
  });
});
