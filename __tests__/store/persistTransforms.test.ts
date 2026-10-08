import reducer, { AuthState } from '../../src/store/slices/apiAuthSlice';
import { sendOtp } from '../../src/store/thunks/apiThunks';
import { stripOtpTransform } from '../../src/store/persistTransforms';

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
