/**
 * T-315 (QA 2026-10-11-regression): useNativeLocation showed a blocking "Location Error"
 * alert, also while its screen was covered (it popped over the chat thread, and again). It
 * now never alerts: the failure is returned as `error` for the screen to render inline, and
 * no lookup starts while the screen is not focused.
 */
import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { useNativeLocation } from '../../src/hooks/useNativeLocation';

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
