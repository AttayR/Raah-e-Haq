import OtpService, {
  OTP_LENGTH,
  formatCountdown,
  formatPkPhoneInput,
  sanitizeOtpInput,
  secondsUntil,
} from '../../src/services/otpService';

const phone = '+923001234567';

describe('otpService (T-101)', () => {
  it('keeps only digits from pasted or autofilled codes, capped at 6', () => {
    expect(OTP_LENGTH).toBe(6);
    expect(sanitizeOtpInput('123456')).toBe('123456');
    expect(sanitizeOtpInput(' 123 456 ')).toBe('123456');
    expect(sanitizeOtpInput('123-456')).toBe('123456');
    expect(sanitizeOtpInput('Your code is 123456')).toBe('123456');
    expect(sanitizeOtpInput('1234567')).toBe('123456');
    expect(sanitizeOtpInput('')).toBe('');
  });

  it('accepts a pasted 6-digit code with spaces (it used to fail the 4-6 digit check)', () => {
    expect(OtpService.validateOtpData({ phone, otp_code: '123 456' })).toEqual({ isValid: true });
    expect(OtpService.validateOtpData({ phone, otp_code: ' 123456\n' })).toEqual({ isValid: true });
  });

  it('requires exactly 6 digits, as the backend does', () => {
    expect(OtpService.validateOtpData({ phone, otp_code: '' }).error).toBe('OTP code is required');
    expect(OtpService.validateOtpData({ phone, otp_code: '1234' }).error).toBe('OTP code must be 6 digits');
    expect(OtpService.validateOtpData({ phone, otp_code: '12345' }).isValid).toBe(false);
  });

  it('counts whole seconds to a deadline and formats countdowns', () => {
    expect(secondsUntil(null, 0)).toBe(0);
    expect(secondsUntil(60_000, 0)).toBe(60);
    expect(secondsUntil(60_000, 59_001)).toBe(1);
    expect(secondsUntil(60_000, 61_000)).toBe(0);
    expect(formatCountdown(59)).toBe('59s');
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(3700)).toBe('1:01:40');
  });
});

describe('formatPkPhoneInput (T-113, moved from PhoneAuthScreen)', () => {
  it.each([
    ['+92', '+92'],
    ['+923001234567', '+923001234567'],
    ['+9230012345679', '+923001234567'],
    ['03001234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['3001234567', '+923001234567'],
    ['', '+92'],
  ])('%s -> %s', (input, expected) => {
    expect(formatPkPhoneInput(input)).toBe(expected);
  });
});
