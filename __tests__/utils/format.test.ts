/** UI-R1: one money/distance/duration/date format for both roles (DESIGN_SYSTEM §2, §7). */
import {
  MINUS,
  firstNameOf,
  formatSignedMoney,
  formatDistance,
  formatDuration,
  formatMoney,
  formatRelativeDate,
  formatTime,
} from '../../src/utils/format';

describe('formatMoney', () => {
  it('prints Rs with a thousands separator and no decimals for whole amounts', () => {
    expect(formatMoney(1200)).toBe('Rs 1,200');
    expect(formatMoney(1250)).toBe('Rs 1,250');
    expect(formatMoney(0)).toBe('Rs 0');
    expect(formatMoney(150)).toBe('Rs 150');
    expect(formatMoney(1234567)).toBe('Rs 1,234,567');
  });

  it('shows two decimals only for a non-zero fraction', () => {
    expect(formatMoney(412.5)).toBe('Rs 412.50');
    expect(formatMoney(1250.05)).toBe('Rs 1,250.05');
    expect(formatMoney(99.999)).toBe('Rs 100');
    expect(formatMoney(10.001)).toBe('Rs 10');
  });

  it('accepts numeric strings as the API sends them', () => {
    expect(formatMoney('412.50')).toBe('Rs 412.50');
    expect(formatMoney('1200')).toBe('Rs 1,200');
  });

  it('maps PKR (or no currency) to Rs and never prints PKR, $ or ₨', () => {
    expect(formatMoney(1250, 'PKR')).toBe('Rs 1,250');
    expect(formatMoney(1250, 'pkr')).toBe('Rs 1,250');
    expect(formatMoney(1250, null)).toBe('Rs 1,250');
    expect(formatMoney(1250, '₨')).toBe('Rs 1,250');
    expect(formatMoney(1250, 'PKR')).not.toMatch(/PKR|\$|₨/);
  });

  it('keeps another currency code from the API as sent', () => {
    expect(formatMoney(20, 'usd')).toBe('USD 20');
  });

  it('signs negative amounts before the label', () => {
    expect(formatMoney(-50)).toBe('\u2212Rs 50');
    expect(MINUS).toBe('\u2212');
    expect(formatMoney(-0.001)).toBe('Rs 0');
  });

  it('returns empty for missing or invalid values so the caller shows its empty state', () => {
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
    expect(formatMoney('')).toBe('');
    expect(formatMoney('abc')).toBe('');
    expect(formatMoney(Number.NaN)).toBe('');
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('formatSignedMoney', () => {
  it('signs credits with + and debits with U+2212, zero unsigned', () => {
    expect(formatSignedMoney(500)).toBe('+Rs 500');
    expect(formatSignedMoney(-50)).toBe('\u2212Rs 50');
    expect(formatSignedMoney(0)).toBe('Rs 0');
    expect(formatSignedMoney(-0.001)).toBe('Rs 0');
    expect(formatSignedMoney('1250.5', 'PKR')).toBe('+Rs 1,250.50');
    expect(formatSignedMoney(-1200)).not.toContain('-');
  });

  it('returns empty for missing or invalid values', () => {
    expect(formatSignedMoney(null)).toBe('');
    expect(formatSignedMoney('x')).toBe('');
  });
});

describe('formatDistance', () => {
  it('uses one decimal under 10 km and none from 10 km', () => {
    expect(formatDistance(3.42)).toBe('3.4 km');
    expect(formatDistance(0.4)).toBe('0.4 km');
    expect(formatDistance(0.04)).toBe('0.1 km');
    expect(formatDistance(0.001)).toBe('0.1 km');
    expect(formatDistance(0)).toBe('0.0 km');
    expect(formatDistance(9.94)).toBe('9.9 km');
    expect(formatDistance(9.96)).toBe('10 km');
    expect(formatDistance(12.6)).toBe('13 km');
    expect(formatDistance(1234)).toBe('1,234 km');
    expect(formatDistance('6.4')).toBe('6.4 km');
  });

  it('returns empty for missing, invalid or negative values', () => {
    expect(formatDistance(null)).toBe('');
    expect(formatDistance('x')).toBe('');
    expect(formatDistance(-1)).toBe('');
  });
});

describe('formatDuration', () => {
  it('prints minutes, then hours with padded minutes', () => {
    expect(formatDuration(7)).toBe('7 min');
    expect(formatDuration(0.2)).toBe('1 min');
    expect(formatDuration(59.4)).toBe('59 min');
    expect(formatDuration(65)).toBe('1 h 05 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(135)).toBe('2 h 15 min');
  });

  it('returns empty for missing or invalid values', () => {
    expect(formatDuration(undefined)).toBe('');
    expect(formatDuration(-3)).toBe('');
  });
});

describe('formatRelativeDate and formatTime', () => {
  const now = new Date(2026, 9, 11, 14, 30); // Sun, 11 Oct 2026, 2:30 PM local

  it('says Today and Yesterday by local calendar day', () => {
    expect(formatRelativeDate(new Date(2026, 9, 11, 0, 5), now)).toBe('Today');
    expect(formatRelativeDate(new Date(2026, 9, 10, 23, 59), now)).toBe('Yesterday');
  });

  it('uses "Mon, 28 Sep" this year and adds the year otherwise', () => {
    expect(formatRelativeDate(new Date(2026, 8, 28, 9, 0), now)).toBe('Mon, 28 Sep');
    expect(formatRelativeDate(new Date(2025, 8, 28, 9, 0), now)).toBe('Sun, 28 Sep 2025');
  });

  it('accepts ISO strings and timestamps, and returns empty for invalid input', () => {
    expect(formatRelativeDate(new Date(2026, 9, 11, 8).toISOString(), now)).toBe('Today');
    expect(formatRelativeDate(new Date(2026, 9, 10, 8).getTime(), now)).toBe('Yesterday');
    expect(formatRelativeDate('not a date', now)).toBe('');
    expect(formatRelativeDate(null, now)).toBe('');
  });

  it('formats 12-hour time', () => {
    expect(formatTime(now)).toBe('2:30 PM');
    expect(formatTime(new Date(2026, 9, 11, 0, 7))).toBe('12:07 AM');
    expect(formatTime(new Date(2026, 9, 11, 12, 0))).toBe('12:00 PM');
    expect(formatTime(undefined)).toBe('');
  });
});

describe('firstNameOf (T-519)', () => {
  it('shows a person by the first word of the server name, everywhere', () => {
    expect(firstNameOf('Test Driver')).toBe('Test');
    expect(firstNameOf('  Bilal   Ahmed Khan ')).toBe('Bilal');
    expect(firstNameOf('Ayesha')).toBe('Ayesha');
  });

  it('is null without a usable name (the caller shows its fallback)', () => {
    expect(firstNameOf('')).toBeNull();
    expect(firstNameOf('   ')).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf(42)).toBeNull();
  });
});
