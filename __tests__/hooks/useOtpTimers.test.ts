import { act, renderHook } from '@testing-library/react-native';
import { useOtpTimers } from '../../src/hooks/useOtpTimers';

const tick = (seconds: number) =>
  act(() => {
    jest.advanceTimersByTime(seconds * 1000);
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useOtpTimers (T-101, BE-16)', () => {
  it('uses the server expires_in, not a hardcoded 300 s, and starts a 60 s resend cooldown', () => {
    const { result } = renderHook(() => useOtpTimers());
    expect(result.current.isExpired).toBe(false);

    act(() => result.current.codeSent(45));
    expect(result.current.expiresIn).toBe(45);
    expect(result.current.resendIn).toBe(60);

    tick(44);
    expect(result.current.expiresIn).toBe(1);
    expect(result.current.isExpired).toBe(false);

    tick(1);
    expect(result.current.expiresIn).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.resendIn).toBe(15);

    tick(15);
    expect(result.current.resendIn).toBe(0);
  });

  it('falls back to 60 s when expires_in is missing', () => {
    const { result } = renderHook(() => useOtpTimers());
    act(() => result.current.codeSent(undefined));
    expect(result.current.expiresIn).toBe(60);
  });

  it('blocks resending for retry_after seconds after a 429', () => {
    const { result } = renderHook(() => useOtpTimers());
    act(() => result.current.blockResend(600));
    expect(result.current.resendIn).toBe(600);
    expect(result.current.isExpired).toBe(false);
    tick(599);
    expect(result.current.resendIn).toBe(1);
  });

  it('expireCode marks the current code expired', () => {
    const { result } = renderHook(() => useOtpTimers());
    act(() => result.current.codeSent(60));
    act(() => result.current.expireCode());
    expect(result.current.isExpired).toBe(true);
  });

  it('stops ticking on unmount', () => {
    const { result, unmount } = renderHook(() => useOtpTimers());
    act(() => result.current.codeSent(60));
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
