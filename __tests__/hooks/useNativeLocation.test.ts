/**
 * T-315 (QA 2026-10-11-regression): useNativeLocation showed a blocking "Location Error"
 * alert, also while its screen was covered (it popped over the chat thread, and again). It
 * now never alerts: the failure is returned as `error` for the screen to render inline, and
 * no lookup starts while the screen is not focused.
 */
import { Alert, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { useNativeLocation } from '../../src/hooks/useNativeLocation';
import { permissionPrimer } from '../../src/features/permissions/primer';

const geo = Geolocation as jest.Mocked<typeof Geolocation>;
type Success = Parameters<typeof Geolocation.getCurrentPosition>[0];
type Failure = NonNullable<Parameters<typeof Geolocation.getCurrentPosition>[1]>;

const position = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude, accuracy: 5, altitude: null, heading: null, speed: null, altitudeAccuracy: null }, timestamp: 0 }) as unknown as Parameters<Success>[0];
const failure = (code: number) => ({ code, message: 'fake', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as Parameters<Failure>[0];

/** Every getCurrentPosition call answers with `answer` (the services check and the lookup). */
const answerWith = (answer: (ok: Success, fail: Failure | undefined) => void) => {
  geo.getCurrentPosition.mockImplementation((ok, fail) => answer(ok, fail));
};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  geo.getCurrentPosition.mockReset();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe('useNativeLocation (T-315)', () => {
  it('a timeout becomes error "unavailable", with no alert', async () => {
    answerWith((_ok, fail) => fail?.(failure(3)));
    const { result } = renderHook(() => useNativeLocation());
    await flush();
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.error).toBe('unavailable');
    expect(result.current.isLoading).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('refused access becomes error "disabled" (iOS cannot ask again), with no alert', async () => {
    answerWith((_ok, fail) => fail?.(failure(1)));
    const { result } = renderHook(() => useNativeLocation());
    await flush();
    expect(result.current.error).toBe('disabled');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a retry that fails again stays inline (no alert), and a later success clears the error', async () => {
    answerWith((_ok, fail) => fail?.(failure(3)));
    const { result } = renderHook(() => useNativeLocation());
    await flush();
    await act(async () => {
      await result.current.requestLocationPermission();
    });
    expect(result.current.error).toBe('unavailable');
    answerWith((ok) => ok(position(31.52, 74.35)));
    await act(async () => {
      await result.current.requestLocationPermission();
    });
    expect(result.current.currentLocation).toEqual({ latitude: 31.52, longitude: 74.35 });
    expect(result.current.error).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does not look up the position while the screen is not focused, then does once focused', async () => {
    answerWith((ok) => ok(position(31.52, 74.35)));
    const { result, rerender } = renderHook(({ active }: { active: boolean }) => useNativeLocation({ active }), {
      initialProps: { active: false },
    });
    await flush();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.currentLocation).toBeNull();

    rerender({ active: true });
    await flush();
    expect(result.current.currentLocation).toEqual({ latitude: 31.52, longitude: 74.35 });
  });

  it('a failure while unfocused shows nothing and is not retried until the screen is back', async () => {
    answerWith((_ok, fail) => fail?.(failure(3)));
    const { result, rerender } = renderHook(({ active }: { active: boolean }) => useNativeLocation({ active }), {
      initialProps: { active: true },
    });
    await flush();
    const calls = geo.getCurrentPosition.mock.calls.length;
    rerender({ active: false });
    await flush();
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(calls);
    expect(alertSpy).not.toHaveBeenCalled();

    // Focused again without a location: one more try (not a loop).
    answerWith((ok) => ok(position(31.5, 74.3)));
    rerender({ active: true });
    await flush();
    expect(result.current.currentLocation).toEqual({ latitude: 31.5, longitude: 74.3 });
    const afterRetry = geo.getCurrentPosition.mock.calls.length;
    rerender({ active: true });
    await flush();
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(afterRetry);
  });
});

describe('useNativeLocation pre-prompt (UI-R8)', () => {
  const native = NativeModules as { RHPermissions?: { locationStatus: () => Promise<string> } };
  let release: () => void;

  beforeEach(async () => {
    permissionPrimer.reset();
    await AsyncStorage.clear();
    native.RHPermissions = { locationStatus: jest.fn(() => Promise.resolve('notDetermined')) };
    release = permissionPrimer.registerHost();
  });

  afterEach(() => {
    release();
    delete native.RHPermissions;
  });

  const settle = async () => {
    for (let i = 0; i < 4; i += 1) await flush();
  };

  it('iOS has not asked yet: the page comes first; "Not now" leaves the OS unasked and shows "Turn on"', async () => {
    answerWith((ok) => ok(position(31.52, 74.35)));
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    expect(permissionPrimer.current()).toBe('locationPassenger');
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();

    act(() => permissionPrimer.answer('later'));
    await settle();
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.error).toBe('denied');
    expect(result.current.permissionStatus.canAskAgain).toBe(true);

    // The screen's "Turn on" tap asks the OS directly (no page again).
    await act(async () => {
      await result.current.requestLocationPermission();
    });
    expect(geo.getCurrentPosition).toHaveBeenCalled();
    expect(result.current.currentLocation).toEqual({ latitude: 31.52, longitude: 74.35 });
  });

  it('T-580: "Don\'t Allow" on the OS prompt keeps the denied state, now for Settings', async () => {
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('later'));
    await settle();
    expect(result.current.permissionStatus.canAskAgain).toBe(true);

    // The OS prompt is refused; the lookup ends with a timeout rather than PERMISSION_DENIED.
    native.RHPermissions = { locationStatus: jest.fn(() => Promise.resolve('denied')) };
    answerWith((_ok, fail) => fail?.(failure(3)));
    await act(async () => {
      await result.current.requestLocationPermission();
    });
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.error).toBe('denied');
    expect(result.current.permissionStatus.canAskAgain).toBe(false);
  });

  // RHPermissions reports 'granted' for any "while using"/"always" authorization; any value that
  // is not denied/restricted must leave a timeout as a retryable "unavailable".
  it.each(['granted', 'authorizedWhenInUse'])('T-580: a timeout with access %s stays "unavailable", not "denied"', async (status) => {
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('later'));
    await settle();

    native.RHPermissions = { locationStatus: jest.fn(() => Promise.resolve(status)) };
    answerWith((_ok, fail) => fail?.(failure(3)));
    await act(async () => {
      await result.current.requestLocationPermission();
    });
    expect(result.current.error).toBe('unavailable');
    expect(result.current.permissionStatus.canAskAgain).toBe(true);
  });

  it('"Continue" goes on to the lookup (which shows the OS prompt)', async () => {
    answerWith((ok) => ok(position(31.5, 74.3)));
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    act(() => permissionPrimer.answer('continue'));
    await settle();
    expect(result.current.currentLocation).toEqual({ latitude: 31.5, longitude: 74.3 });
  });

  it('already answered by the OS: no page', async () => {
    native.RHPermissions = { locationStatus: jest.fn(() => Promise.resolve('granted')) };
    answerWith((ok) => ok(position(31.5, 74.3)));
    const { result } = renderHook(() => useNativeLocation());
    await settle();
    expect(permissionPrimer.current()).toBeNull();
    expect(result.current.currentLocation).toEqual({ latitude: 31.5, longitude: 74.3 });
  });
});
