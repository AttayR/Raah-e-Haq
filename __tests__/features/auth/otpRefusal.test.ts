/** T-111: OTP screens branch on the BE-28 `code`, not on status heuristics. */
import { classifyOtpRefusal } from '../../../src/features/auth/otpRefusal';

describe('classifyOtpRefusal (T-111, BE-28)', () => {
  it.each([
    ['code_exhausted', 'burned'],
    ['otp_cooldown', 'cooldown'],
    ['otp_send_limit', 'cooldown'],
    ['rate_limited', 'cooldown'],
    ['otp_ip_limit', 'limit'],
    ['otp_verify_limit', 'limit'],
    ['sms_unavailable', 'unavailable'],
    ['busy', 'unavailable'],
  ] as const)('%s -> %s', (code, action) => {
    expect(classifyOtpRefusal({ kind: code === 'sms_unavailable' || code === 'busy' ? 'server' : 'rate_limited', code })).toBe(action);
  });

  it('code_exhausted is burned whether or not it carries retry_after (the old heuristic missed it)', () => {
    expect(classifyOtpRefusal({ kind: 'rate_limited', code: 'code_exhausted' })).toBe('burned');
  });

  it('a 429 without a code is a cooldown; other refusals are not', () => {
    expect(classifyOtpRefusal({ kind: 'rate_limited' })).toBe('cooldown');
    expect(classifyOtpRefusal({ kind: 'auth' })).toBe('other');
    expect(classifyOtpRefusal({ kind: 'forbidden', code: 'ACCOUNT_SUSPENDED' })).toBe('other');
    expect(classifyOtpRefusal({ kind: 'server' })).toBe('other');
    expect(classifyOtpRefusal(undefined)).toBe('other');
  });
});
