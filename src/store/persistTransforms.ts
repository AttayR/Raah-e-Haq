import { createTransform } from 'redux-persist';
import type { AuthState } from './slices/apiAuthSlice';

/**
 * OTP state is per-session and must never reach AsyncStorage (AUTH-02, INF-05).
 * Inbound: dropped before apiAuth is written. Outbound: anything an older build stored is
 * discarded on rehydrate.
 */
const withoutOtp = (state: AuthState): AuthState =>
  state ? { ...state, otpData: null, isOtpSent: false } : state;

export const stripOtpTransform = createTransform<AuthState, AuthState>(withoutOtp, withoutOtp, {
  whitelist: ['apiAuth'],
});
