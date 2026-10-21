/**
 * T-580: the booking location gate (useBookingLocationGate). Refused or switched-off access keeps
 * the map (no full-screen wait) and its Banner action asks the OS while it can, else opens
 * Settings; a ride always wins over the wait state.
 */
import { renderHook } from '@testing-library/react-native';
import { useBookingLocationGate } from '../../../src/features/ride-booking/useBookingLocationGate';
import { useNativeLocation } from '../../../src/hooks/useNativeLocation';

jest.mock('../../../src/hooks/useNativeLocation', () => ({ useNativeLocation: jest.fn() }));

const mocked = useNativeLocation as jest.MockedFunction<typeof useNativeLocation>;
const request = jest.fn(() => Promise.resolve(false));
const openSettings = jest.fn();

const locationAs = (error: 'denied' | 'disabled' | 'unavailable' | null, canAskAgain: boolean) => {
  mocked.mockReturnValue({
    currentLocation: null,
    isLoading: false,
    error,
    permissionStatus: { isGranted: false, canAskAgain, isLocationEnabled: false },
    requestLocationPermission: request,
    refreshLocation: jest.fn(() => Promise.resolve()),
    getCurrentLocation: jest.fn(() => Promise.resolve(null)),
    openSettings,
  });
};

beforeEach(() => {
  request.mockClear();
  openSettings.mockClear();
});

it('refused, the OS can still ask: map stays, the action asks', () => {
  locationAs('denied', true);
  const { result } = renderHook(() => useBookingLocationGate({ active: true, rideShown: false }));
  expect(result.current.wait).toBeNull();
  expect(result.current.refused).toBe(true);
  result.current.askOrSettings();
  expect(request).toHaveBeenCalled();
  expect(openSettings).not.toHaveBeenCalled();
});

it.each([
  ['denied', false],
  ['disabled', true],
] as const)('%s (canAskAgain %s): the action opens Settings', (error, canAskAgain) => {
  locationAs(error, canAskAgain);
  const { result } = renderHook(() => useBookingLocationGate({ active: true, rideShown: false }));
  result.current.askOrSettings();
  expect(openSettings).toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it('T-712: no fix with access granted (canAskAgain false): the action looks again, not Settings', () => {
  locationAs('unavailable', false);
  const { result } = renderHook(() => useBookingLocationGate({ active: true, rideShown: false }));
  result.current.askOrSettings();
  expect(request).toHaveBeenCalled();
  expect(openSettings).not.toHaveBeenCalled();
});

it('no fix (not refused): the full-screen wait with Try again; a ride wins over it', () => {
  locationAs('unavailable', false);
  const { result, rerender } = renderHook(
    ({ rideShown }: { rideShown: boolean }) => useBookingLocationGate({ active: true, rideShown }),
    { initialProps: { rideShown: false } },
  );
  expect(result.current.refused).toBe(false);
  expect(result.current.wait?.reason).toBe('unavailable');
  result.current.wait?.onRetry();
  expect(request).toHaveBeenCalled();
  rerender({ rideShown: true });
  expect(result.current.wait).toBeNull();
});
