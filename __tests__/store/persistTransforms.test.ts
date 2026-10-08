import reducer, { AuthState } from '../../src/store/slices/apiAuthSlice';
import { sendOtp } from '../../src/store/thunks/apiThunks';
import {
  stripOtpTransform,
  clearApiAuthTransientTransform,
  clearFirebaseAuthTransientTransform,
} from '../../src/store/persistTransforms';
import firebaseAuthReducer from '../../src/store/slices/authSlice';

const withOtp = (): AuthState =>
  reducer(undefined, sendOtp.fulfilled({ phone: '+923001234567', expires_in: 60 }, 'req', '+923001234567'));

describe('stripOtpTransform (T-101, INF-05)', () => {
  it('never writes OTP state to storage', () => {
    const state = withOtp();
    expect(state.otpData).not.toBeNull();

    const stored = stripOtpTransform.in(state, 'apiAuth', { apiAuth: state });
    expect(stored.otpData).toBeNull();
    expect(stored.isOtpSent).toBe(false);
  });

  it('discards OTP state an older build left in storage', () => {
    const legacy = { ...withOtp(), otpData: { phone: '+923001234567', otp_code: '482913', expires_in: 300 } };
    const restored = stripOtpTransform.out(legacy, 'apiAuth', { apiAuth: legacy });
    expect(restored.otpData).toBeNull();
    expect(JSON.stringify(restored)).not.toContain('482913');
  });
});

describe('transient auth transforms (T-103, AUTH-16)', () => {
  const failedApiAuth = (): AuthState => ({
    ...reducer(undefined, { type: '@@INIT' }),
    status: 'failed',
    error: 'Invalid credentials',
    isInitialized: true,
  });

  it('runs for the apiAuth key and never writes error, failed status or isInitialized', () => {
    const stored = clearApiAuthTransientTransform.in(failedApiAuth(), 'apiAuth', {});
    expect(stored.error).toBeNull();
    expect(stored.status).toBe('idle');
    expect(stored.isInitialized).toBe(false);
  });

  it('cleans what an older build stored, so the splash runs and no stale error shows', () => {
    const restored = clearApiAuthTransientTransform.out({ ...failedApiAuth(), status: 'loading' }, 'apiAuth', {});
    expect(restored.error).toBeNull();
    expect(restored.status).toBe('idle');
    expect(restored.isInitialized).toBe(false);
  });

  it('keeps the signed-in session itself', () => {
    const state = { ...failedApiAuth(), status: 'succeeded' as const, isAuthenticated: true, token: 't' };
    const restored = clearApiAuthTransientTransform.out(state, 'apiAuth', {});
    expect(restored.isAuthenticated).toBe(true);
    expect(restored.token).toBe('t');
    expect(restored.status).toBe('succeeded');
  });

  it('clears the legacy auth slice error and loading status', () => {
    const legacy = { ...firebaseAuthReducer(undefined, { type: '@@INIT' }), status: 'loading' as const, error: 'x' };
    const restored = clearFirebaseAuthTransientTransform.out(legacy, 'auth', {});
    expect(restored.error).toBeNull();
    expect(restored.status).toBe('idle');
  });

  it('leaves other slice keys alone (createTransform checks the whitelist per key)', () => {
    const state = failedApiAuth();
    expect(clearApiAuthTransientTransform.out(state, 'user', {})).toBe(state);
  });
});
