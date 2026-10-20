import {
  formatCalendarDate,
  formatGender,
  formatMonthYear,
} from '../../src/components/passenger/settings/format';

describe('passenger profile formatting (T-618)', () => {
  it('formatMonthYear', () => {
    expect(formatMonthYear('2026-03-15T08:00:00Z')).toBe('Mar 2026');
    expect(formatMonthYear(undefined)).toBeNull();
    expect(formatMonthYear('not a date')).toBeNull();
  });

  it('formatCalendarDate reads YYYY-MM-DD without a timezone shift', () => {
    expect(formatCalendarDate('1995-10-08')).toBe('8 Oct 1995');
    expect(formatCalendarDate('1995-01-01T00:00:00.000000Z')).toBe('1 Jan 1995');
    expect(formatCalendarDate('1995-13-01')).toBeNull();
    expect(formatCalendarDate('')).toBeNull();
    expect(formatCalendarDate('garbage')).toBeNull();
  });

  it('formatGender', () => {
    expect(formatGender('female')).toBe('Female');
    expect(formatGender('MALE')).toBe('Male');
    expect(formatGender('  ')).toBeNull();
    expect(formatGender(undefined)).toBeNull();
  });
});
