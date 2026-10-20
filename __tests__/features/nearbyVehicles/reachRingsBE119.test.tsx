/**
 * BE-119 app follow-up (passenger-finding-driver.md § Request reach, Phase 2): while a ride is
 * searched, the nearby markers the request was sent to stay at full opacity and the other fine
 * markers dim to 0.45; markers whose driver opened the offer get the 2 pt success ring. Only when
 * the ride's `reach.epoch` equals the drawn nearby answer's `meta.fine_epoch`; women mode shows
 * nothing on the map. A ride read without matching ids keeps the last set until a new nearby
 * answer arrives. No request of its own.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { LightTheme, componentTokens, type AppTheme } from '../../../src/theme';
import { NearbyVehicleMarkers } from '../../../src/features/nearby-vehicles';
import { nearbyReachMark } from '../../../src/features/nearby-vehicles/NearbyVehicleMarkers';
import { reachMarksFor, reachOf } from '../../../src/features/active-ride/reach';
import type { NearbyDriver, RideResource } from '../../../src/services/rideService';
import type { NearbyDriversResultState } from '../../../src/hooks/useNearbyDrivers';
import { useBookingNearby } from '../../../src/features/ride-booking/useBookingNearby';
import { makeRide } from '../../../test-utils/rideFixtures';

const mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

let mockNearby: NearbyDriversResultState;
const mockUseNearbyDrivers = jest.fn((..._args: unknown[]) => mockNearby);
jest.mock('../../../src/hooks/useNearbyDrivers', () => ({
  useNearbyDrivers: (...args: unknown[]) => mockUseNearbyDrivers(...args),
}));
jest.mock('../../../src/components/ui/Banner', () => ({ useIsOffline: () => false }));

const m = componentTokens.ride.vehicleMarker;

const driver = (id: string, i: number, over: Partial<NearbyDriver> = {}): NearbyDriver => ({
  id,
  precision: 'fine',
  vehicle_type: 'car',
  distance_km: i / 10,
  estimated_arrival_min: 3,
  location: { latitude: 31.5 + i * 0.003, longitude: 74.3 },
  heading: 0,
  ...over,
});

const searchingRide = (reach: unknown, over: Partial<RideResource> = {}): RideResource =>
  makeRide({ id: 9, status: 'requested', requested_at: new Date().toISOString(), reach, ...over });

const reachBody = (epoch: string | null, sentIds: string[], viewingIds: string[] = []) => ({
  sent: sentIds.length,
  viewing: viewingIds.length,
  sent_ids: sentIds,
  viewing_ids: viewingIds,
  epoch,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('reach ids and epoch', () => {
  it('reads sent_ids / viewing_ids / epoch; women mode has no ids and no epoch', () => {
    expect(reachOf(searchingRide({ sent: 2, viewing: 1, sent_ids: ['a', 'b', 'a', 7], viewing_ids: ['b'], epoch: 'e1' }))).toEqual({
      sent: 2, viewing: 1, sentIds: ['a', 'b'], viewingIds: ['b'], epoch: 'e1',
    });
    // Women mode: null counts; any ids the body might carry are ignored.
    expect(reachOf(searchingRide({ sent: null, viewing: null, sent_ids: ['a'], viewing_ids: ['a'], epoch: 'e1' }))).toEqual({
      sent: null, viewing: null, sentIds: [], viewingIds: [], epoch: null,
    });
    // No epoch: ids cannot be placed on any answer.
    expect(reachOf(searchingRide({ sent: 2, viewing: 0, sent_ids: ['a'] }))).toMatchObject({ sentIds: [], epoch: null });
  });

  it('marks apply only when the epochs match', () => {
    const reach = reachOf(searchingRide(reachBody('e1', ['a'], ['b'])));
    expect(reachMarksFor(reach, 'e2')).toBeNull();
    expect(reachMarksFor(reach, null)).toBeNull();
    const marks = reachMarksFor(reach, 'e1');
    expect(marks && [...marks.sent].sort()).toEqual(['a', 'b']);
    expect(marks && [...marks.viewing]).toEqual(['b']);
    expect(reachMarksFor(reachOf(searchingRide({ sent: null, viewing: null })), 'e1')).toBeNull();
  });

  it('per marker: viewing rings, an unsent fine marker dims, a coarse one is never dimmed', () => {
    const marks = { sent: new Set(['a', 'b']), viewing: new Set(['b']) };
    expect(nearbyReachMark('a', true, marks)).toBeNull();
    expect(nearbyReachMark('b', true, marks)).toBe('viewing');
    expect(nearbyReachMark('c', true, marks)).toBe('unsent');
    expect(nearbyReachMark('c', false, marks)).toBeNull();
    expect(nearbyReachMark('c', true, null)).toBeNull();
  });
});

describe('NearbyVehicleMarkers with reach marks', () => {
  const drivers = [driver('a', 1), driver('b', 2), driver('c', 3), driver('k', 4, { precision: 'coarse' })];

  it('rings the viewing marker, dims the unsent fine marker, leaves sent and coarse ones alone', async () => {
    const marks = { sent: new Set(['a', 'b']), viewing: new Set(['b']) };
    render(<NearbyVehicleMarkers drivers={drivers} reachMarks={marks} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('nearby-driver-b-viewing')).toBeTruthy();
    expect(screen.queryByTestId('nearby-driver-a-viewing')).toBeNull();
    expect(screen.getByTestId('nearby-driver-a').props.opacity).toBeCloseTo(1);
    expect(screen.getByTestId('nearby-driver-c').props.opacity).toBeCloseTo(m.reachUnsentOpacity);
    expect(screen.getByTestId('nearby-driver-k').props.opacity).toBeCloseTo(1);
  });

  it('without marks every vehicle draws as usual', async () => {
    render(<NearbyVehicleMarkers drivers={drivers} reachMarks={null} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId('nearby-driver-b-viewing')).toBeNull();
    expect(screen.getByTestId('nearby-driver-c').props.opacity).toBeCloseTo(1);
  });
});

describe('useBookingNearby reach marks', () => {
  const nearbyState = (fineEpoch: string | null): NearbyDriversResultState => ({
    drivers: [driver('a', 1), driver('b', 2)],
    status: 'ready',
    error: null,
    counts: null,
    freshAt: 1,
    failures: 0,
    listTier: null,
    fineEpoch,
    retry: jest.fn(),
  });
  const props = (ride: RideResource, searching = true) => ({
    center: { latitude: 31.5, longitude: 74.3 },
    focused: true,
    ride,
    requesting: true,
    rideEnded: false,
    searching,
    choosing: false,
    selectedTier: 'car',
    chipShown: false,
  });

  it('keeps the matching set between polls until a new nearby answer, then drops it; one object per change', () => {
    mockNearby = nearbyState('e1');
    const { result, rerender } = renderHook((p: ReturnType<typeof props>) => useBookingNearby(p), {
      initialProps: props(searchingRide(reachBody('e1', ['a'], ['b']))),
    });
    const first = result.current.reachMarks;
    expect(first && [...first.viewing]).toEqual(['b']);

    // The same reach on the next ride poll: the same object (the memoised map skips it).
    rerender(props(searchingRide(reachBody('e1', ['a'], ['b']))));
    expect(result.current.reachMarks).toBe(first);

    // A ride read without ids (nearby read was over 30 s before it): kept, no flicker.
    rerender(props(searchingRide({ sent: 2, viewing: 1, sent_ids: [], viewing_ids: [], epoch: null })));
    expect(result.current.reachMarks).toBe(first);

    // A new nearby answer arrives before the ride poll names it: the old ids no longer apply.
    mockNearby = nearbyState('e2');
    rerender(props(searchingRide({ sent: 2, viewing: 1, sent_ids: [], viewing_ids: [], epoch: null })));
    expect(result.current.reachMarks).toBeNull();

    // The next ride poll names the new answer.
    rerender(props(searchingRide(reachBody('e2', ['a', 'b'], ['a', 'b']))));
    expect(result.current.reachMarks && [...result.current.reachMarks.viewing].sort()).toEqual(['a', 'b']);
  });

  it('women mode and the end of the search show no marks', () => {
    mockNearby = nearbyState('e1');
    const { result, rerender } = renderHook((p: ReturnType<typeof props>) => useBookingNearby(p), {
      initialProps: props(searchingRide(reachBody('e1', ['a'], ['b']))),
    });
    expect(result.current.reachMarks).not.toBeNull();
    rerender(props(searchingRide({ sent: null, viewing: null, sent_ids: [], viewing_ids: [], epoch: null })));
    expect(result.current.reachMarks).toBeNull();
    rerender(props(searchingRide(reachBody('e1', ['a'], ['b'])), false));
    expect(result.current.reachMarks).toBeNull();
  });

  it('adds no read of its own: the nearby hook is asked with its usual options', () => {
    mockNearby = nearbyState('e1');
    mockUseNearbyDrivers.mockClear();
    renderHook(() => useBookingNearby(props(searchingRide(reachBody('e1', ['a'], ['b'])))));
    expect(mockUseNearbyDrivers).toHaveBeenCalled();
    for (const call of mockUseNearbyDrivers.mock.calls) {
      expect(Object.keys(call[1] as object).sort()).toEqual(['enabled', 'refreshKey', 'tier']);
    }
  });
});
