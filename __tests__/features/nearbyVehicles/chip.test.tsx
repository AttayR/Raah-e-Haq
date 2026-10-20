/**
 * T-586 (map-vehicles.md §4, §2.4): the map count chip's copy (en + Roman Urdu), states, retry,
 * offline, and the data-age levels behind it.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useNetInfo } from '@react-native-community/netinfo';
import { setLocale } from '../../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../../src/i18n/languagePreference';
import { nearbyChipContent } from '../../../src/features/nearby-vehicles/chipText';
import { NearbyCountChip, nearbyFreshness, useNearbyFreshness, type NearbyFreshness } from '../../../src/features/nearby-vehicles';
import type { NearbyDriversState } from '../../../src/hooks/useNearbyDrivers';
import type { NearbyDriver } from '../../../src/services/rideService';

const driver = (id: string, vehicle_type: NearbyDriver['vehicle_type'] = 'car'): NearbyDriver => ({
  id,
  vehicle_type,
  distance_km: 1,
  estimated_arrival_min: 3,
  location: { latitude: 31.5, longitude: 74.3 },
  heading: null,
});

const text = (status: NearbyDriversState['status'], tier: string | null, n: number, online: number | null, failed = false) => {
  const c = nearbyChipContent({ status, failed, tier, counts: { n, online } });
  return c ? [c.primary, c.secondary].filter(Boolean).join(' · ') : null;
};

afterEach(() => {
  resetLanguagePreferenceForTests();
  (useNetInfo as jest.Mock).mockImplementation(() => ({ isConnected: true, isInternetReachable: true }));
});

describe('chip copy (§4)', () => {
  it('English: Home, Choose ride, loading, none and error', () => {
    expect(text('ready', null, 12, 12)).toBe('12 drivers online near you');
    expect(text('ready', null, 1, 1)).toBe('1 driver online near you');
    expect(text('ready', null, 0, 0)).toBe('No drivers online near you right now');
    expect(text('loading', null, 0, null)).toBe('Finding drivers nearby…');
    expect(text('ready', 'car', 7, 31)).toBe('7 cars nearby · 31 online');
    expect(text('ready', 'car_ac', 1, 31)).toBe('1 AC car nearby · 31 online');
    expect(text('ready', 'bike', 0, 5)).toBe('No bikes nearby right now · 5 online');
    expect(text('ready', 'van', 0, 0)).toBe('No vans nearby right now');
    // No server counts: the online part is hidden.
    expect(text('ready', 'rickshaw', 3, null)).toBe('3 rickshaws nearby');
    expect(text('loading', 'parcel', 0, null)).toBe('Finding parcel riders nearby…');
    expect(text('ready', 'car', 7, 31, true)).toBe("Couldn't load nearby drivers");
    expect(text('idle', null, 0, null)).toBeNull();
  });

  it('Roman Urdu', () => {
    setLocale('ur-Latn');
    expect(text('ready', null, 12, 12)).toBe('12 drivers aap ke qareeb online hain');
    expect(text('ready', null, 1, 1)).toBe('1 driver aap ke qareeb online hai');
    expect(text('ready', null, 0, 0)).toBe('Abhi aap ke qareeb koi driver online nahi');
    expect(text('ready', 'car', 7, 31)).toBe('7 gaariyan qareeb · 31 online');
    expect(text('ready', 'car', 0, 31)).toBe('Abhi qareeb koi gaari nahi · 31 online');
    expect(text('ready', 'car_ac', 0, 0)).toBe('Abhi qareeb koi AC gaari nahi');
    expect(text('loading', 'car', 0, null)).toBe('Qareeb gaariyan dhoond rahe hain…');
    expect(text('ready', null, 0, 0, true)).toBe('Qareeb drivers load nahi ho sake');
  });
});

describe('data age (§2.4)', () => {
  it('stale after 2 failures or 30 s, gone after 90 s', () => {
    expect(nearbyFreshness(null, 5, 1000)).toBe('fresh');
    expect(nearbyFreshness(0, 0, 29_999)).toBe('fresh');
    expect(nearbyFreshness(0, 1, 10_000)).toBe('fresh');
    expect(nearbyFreshness(0, 2, 10_000)).toBe('stale');
    expect(nearbyFreshness(0, 0, 30_000)).toBe('stale');
    expect(nearbyFreshness(0, 0, 90_000)).toBe('gone');
  });

  it('the hook re-evaluates with one timer at each threshold', () => {
    jest.useFakeTimers();
    const freshAt = Date.now();
    const { result } = renderHook(() => useNearbyFreshness({ freshAt, failures: 0 }));
    expect(result.current).toBe('fresh');
    act(() => {
      jest.advanceTimersByTime(30_001);
    });
    expect(result.current).toBe('stale');
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('gone');
    jest.useRealTimers();
  });
});

describe('NearbyCountChip', () => {
  const Chip = ({ state, freshness = 'fresh', tier = null }: { state: NearbyDriversState & { retry?: () => void }; freshness?: NearbyFreshness; tier?: string | null }) => {
    const sheet = useSharedValue(120);
    return <NearbyCountChip state={state} freshness={freshness} tier={tier} sheetHeight={sheet} />;
  };

  it('renders the count with a text role and the visible text as its label', () => {
    render(<Chip state={{ drivers: [driver('a'), driver('b', 'bike')], status: 'ready', error: null }} tier="car" />);
    const chip = screen.getByTestId('nearby-drivers-status');
    expect(chip.props.accessibilityRole).toBe('text');
    expect(chip.props.accessibilityLabel).toBe('1 car nearby');
    expect(screen.getByText('1 car nearby')).toBeTruthy();
  });

  it('shows the server total online as the second part', () => {
    render(<Chip state={{ drivers: [driver('a')], status: 'ready', error: null, counts: { byTier: { car: 4 }, onlineTotal: 9 } }} tier="car" />);
    // T-586 part 2: one run of text (no gap before the dot); the online part is a nested span.
    expect(screen.getByText('4 cars nearby · 9 online')).toBeTruthy();
    expect(screen.getByTestId('nearby-drivers-status-online').props.children).toBe(' · 9 online');
  });

  it('error (first read failed, or the list is 90 s old): danger text, tap retries', () => {
    const retry = jest.fn();
    const { rerender } = render(<Chip state={{ drivers: [], status: 'error', error: 'x', retry }} />);
    fireEvent.press(screen.getByRole('button', { name: "Couldn't load nearby drivers" }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<Chip state={{ drivers: [driver('a')], status: 'ready', error: null, retry }} freshness="gone" />);
    expect(screen.getByRole('button', { name: "Couldn't load nearby drivers" })).toBeTruthy();
  });

  it('is hidden offline (the offline banner speaks) and while idle', () => {
    (useNetInfo as jest.Mock).mockImplementation(() => ({ isConnected: false, isInternetReachable: false }));
    const { rerender } = render(<Chip state={{ drivers: [driver('a')], status: 'ready', error: null }} />);
    expect(screen.queryByTestId('nearby-drivers-status')).toBeNull();
    (useNetInfo as jest.Mock).mockImplementation(() => ({ isConnected: true, isInternetReachable: true }));
    rerender(<Chip state={{ drivers: [], status: 'idle', error: null }} />);
    expect(screen.queryByTestId('nearby-drivers-status')).toBeNull();
  });

  it('announces a category change (loading → ready), not every count change', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { rerender } = render(<Chip state={{ drivers: [], status: 'loading', error: null }} />);
    expect(announce).not.toHaveBeenCalled();
    rerender(<Chip state={{ drivers: [driver('a'), driver('b')], status: 'ready', error: null }} />);
    expect(announce).toHaveBeenCalledWith('2 drivers online near you');
    rerender(<Chip state={{ drivers: [driver('a'), driver('b'), driver('c')], status: 'ready', error: null }} />);
    expect(announce).toHaveBeenCalledTimes(1);
    announce.mockRestore();
  });
});
