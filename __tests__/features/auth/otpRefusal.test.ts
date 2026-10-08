/** T-111: OTP screens branch on the BE-28 `code`, not on status heuristics. */
import { classifyOtpRefusal, isGlobalOtpRefusal } from '../../../src/features/auth/otpRefusal';

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

describe('isGlobalOtpRefusal (T-113, AUTH-18)', () => {
  it.each(['sms_unavailable', 'busy', 'otp_ip_limit'])('%s holds every number', code => {
    expect(isGlobalOtpRefusal({ code })).toBe(true);
  });

  it.each(['otp_cooldown', 'otp_send_limit', 'code_exhausted', 'otp_verify_limit', 'rate_limited', undefined])(
    '%s holds only the typed number',
    code => {
      expect(isGlobalOtpRefusal({ kind: 'rate_limited', code })).toBe(false);
    },
  );

  it('handles a missing refusal', () => {
    expect(isGlobalOtpRefusal(undefined)).toBe(false);
  });
});
