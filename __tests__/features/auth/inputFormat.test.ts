/**
 * T-206: the registration number-pad inputs (no "-" key on iOS) get their separators
 * inserted as the user types digits; deleting a digit never leaves a stuck trailing dash.
 */
import { formatCnicInput, formatIsoDateInput } from '../../../src/features/auth/registration/inputFormat';

describe('formatIsoDateInput', () => {
  it('inserts the dashes as digits are typed', () => {
    const typed = '19900115'.split('').reduce<string[]>((acc, digit) => {
      const prev = acc.length ? acc[acc.length - 1] : '';
      return [...acc, formatIsoDateInput(prev + digit)];
    }, []);
    expect(typed).toEqual(['1', '19', '199', '1990', '1990-0', '1990-01', '1990-01-1', '1990-01-15']);
  });

  it('backspace removes a digit and the dash before it, never leaving a trailing dash', () => {
    // The input deletes the last character: "1990-01" -> "1990-0" -> "1990-" -> ...
    expect(formatIsoDateInput('1990-01-1')).toBe('1990-01-1');
    expect(formatIsoDateInput('1990-01-')).toBe('1990-01');
    expect(formatIsoDateInput('1990-0')).toBe('1990-0');
    expect(formatIsoDateInput('1990-')).toBe('1990');
    expect(formatIsoDateInput('')).toBe('');
  });

  it('keeps digits only and stops at 8 digits (10 characters)', () => {
    expect(formatIsoDateInput('1990-01-15')).toBe('1990-01-15');
    expect(formatIsoDateInput('1990/01/15')).toBe('1990-01-15');
    expect(formatIsoDateInput('1990.01.15')).toBe('1990-01-15');
    expect(formatIsoDateInput('199001159999')).toBe('1990-01-15');
    expect(formatIsoDateInput('abc')).toBe('');
    expect(formatIsoDateInput(undefined)).toBe('');
    expect(formatIsoDateInput(null)).toBe('');
  });

  it('formats a pasted value with or without dashes', () => {
    expect(formatIsoDateInput('20000229')).toBe('2000-02-29');
    expect(formatIsoDateInput(' 2000-02-29 ')).toBe('2000-02-29');
  });
});

describe('formatCnicInput', () => {
  it('formats as 00000-0000000-0 and stops at 13 digits', () => {
    expect(formatCnicInput('35202')).toBe('35202');
    expect(formatCnicInput('352021')).toBe('35202-1');
    expect(formatCnicInput('352021234567')).toBe('35202-1234567');
    expect(formatCnicInput('3520212345671')).toBe('35202-1234567-1');
    expect(formatCnicInput('35202123456719')).toBe('35202-1234567-1');
    expect(formatCnicInput('35202-1234567-')).toBe('35202-1234567');
    expect(formatCnicInput('')).toBe('');
  });
});
