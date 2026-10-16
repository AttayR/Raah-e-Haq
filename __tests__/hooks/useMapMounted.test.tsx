/**
 * T-535 (PERF-14): only one live Google Map per role. The Home/Drive tab map is unmounted once
 * a full-screen map route (Booking / DriverRide) covers it, after the push animation, and mounts
 * again as soon as the tab is uncovered. Other screens on top (Profile, …) keep it.
 */
import { act, renderHook } from '@testing-library/react-native';
import { MAP_RELEASE_DELAY_MS, useMapMounted } from '../../src/hooks/useMapMounted';

type Listener = () => void;
let mockFocused = true;
let mockStackRoutes: Array<{ name: string }> = [{ name: 'PassengerTabs' }];
let mockStateListeners: Listener[] = [];
const mockParent = {
  getState: () => ({ routes: mockStackRoutes }),
  addListener: (_type: 'state', cb: Listener) => {
    mockStateListeners.push(cb);
    return () => {
      mockStateListeners = mockStateListeners.filter(fn => fn !== cb);
    };
  },
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), getParent: () => mockParent }),
  useIsFocused: () => mockFocused,
}));

const ROUTES = ['Booking'] as const;

/** Changes the stack (and Home's focus) the way a push or pop does. */
const setStack = (names: string[]) => {
  mockStackRoutes = names.map(name => ({ name }));
  mockFocused = names.length === 1;
  mockStateListeners.forEach(fn => fn());
};

beforeEach(() => {
  jest.useFakeTimers();
  mockFocused = true;
  mockStackRoutes = [{ name: 'PassengerTabs' }];
  mockStateListeners = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useMapMounted (T-535)', () => {
  it('releases the map after the push animation while Booking covers it, and brings it back at once', () => {
    const { result, rerender } = renderHook(() => useMapMounted(ROUTES));
    expect(result.current).toBe(true);

    act(() => setStack(['PassengerTabs', 'Booking']));
    rerender({});
    // Still there while Booking slides in over it.
    expect(result.current).toBe(true);
    act(() => {
      jest.advanceTimersByTime(MAP_RELEASE_DELAY_MS);
    });
    expect(result.current).toBe(false);

    // The ride chat over Booking: Home stays released.
    act(() => setStack(['PassengerTabs', 'Booking', 'RideChat']));
    rerender({});
    expect(result.current).toBe(false);

    act(() => setStack(['PassengerTabs']));
    rerender({});
    expect(result.current).toBe(true);
  });

  it('keeps the map under a screen without a map (Profile)', () => {
    const { result, rerender } = renderHook(() => useMapMounted(ROUTES));
    act(() => setStack(['PassengerTabs', 'Profile']));
    rerender({});
    act(() => {
      jest.advanceTimersByTime(MAP_RELEASE_DELAY_MS * 2);
    });
    expect(result.current).toBe(true);
  });

  it('a quick back before the delay never unmounts it', () => {
    const { result, rerender } = renderHook(() => useMapMounted(ROUTES));
    act(() => setStack(['PassengerTabs', 'Booking']));
    rerender({});
    act(() => {
      jest.advanceTimersByTime(MAP_RELEASE_DELAY_MS / 2);
    });
    act(() => setStack(['PassengerTabs']));
    rerender({});
    act(() => {
      jest.advanceTimersByTime(MAP_RELEASE_DELAY_MS);
    });
    expect(result.current).toBe(true);
  });

  it('removes its stack listener on unmount', () => {
    const { unmount } = renderHook(() => useMapMounted(ROUTES));
    expect(mockStateListeners).toHaveLength(1);
    unmount();
    expect(mockStateListeners).toHaveLength(0);
  });
});
