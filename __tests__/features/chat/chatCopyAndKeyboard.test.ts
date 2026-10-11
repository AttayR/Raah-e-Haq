/**
 * T-512: the read-only notice's time carries its day when it isn't today, and the thread's
 * KeyboardAvoidingView offsets by the top safe-area inset on iOS (its onLayout frame is
 * relative to the Screen's SafeAreaView, so without the offset the keyboard covered the
 * composer). Android keeps adjustResize, so the KAV is off there.
 */
import { formatChatDayTime, formatChatTime } from '../../../src/features/chat/copy';
import { chatKeyboardAvoidingProps } from '../../../src/features/chat/keyboard';

// Local times, so the expectations hold in any time zone.
const now = new Date(2026, 9, 11, 21, 40);
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).toISOString();

describe('formatChatDayTime', () => {
  it('is just the time today', () => {
    expect(formatChatDayTime(at(2026, 9, 11, 23, 5), now)).toBe('11:05 PM');
  });

  it('says tomorrow / yesterday next to today', () => {
    expect(formatChatDayTime(at(2026, 9, 12, 12, 16), now)).toBe('tomorrow at 12:16 PM');
    expect(formatChatDayTime(at(2026, 9, 10, 9, 0), now)).toBe('yesterday at 9:00 AM');
  });

  it('uses a short date further out, with the year only when it differs', () => {
    expect(formatChatDayTime(at(2026, 9, 14, 0, 30), now)).toBe('14 Oct at 12:30 AM');
    expect(formatChatDayTime(at(2027, 0, 2, 8, 0), now)).toBe('2 Jan 2027 at 8:00 AM');
  });

  it('crosses a month end as tomorrow', () => {
    expect(formatChatDayTime(at(2026, 10, 1, 7, 0), new Date(2026, 9, 31, 22, 0))).toBe('tomorrow at 7:00 AM');
  });

  it('is empty for a missing or bad time', () => {
    expect(formatChatDayTime(null, now)).toBe('');
    expect(formatChatDayTime('not a date', now)).toBe('');
  });

  it('leaves the bubble/list time format alone', () => {
    expect(formatChatTime(at(2026, 9, 12, 12, 16))).toBe('12:16 PM');
  });
});

describe('chatKeyboardAvoidingProps', () => {
  it('pads on iOS, offset by the top safe-area inset (SE 20, Pro Max 59)', () => {
    expect(chatKeyboardAvoidingProps('ios', 20)).toEqual({ behavior: 'padding', enabled: true, keyboardVerticalOffset: 20 });
    expect(chatKeyboardAvoidingProps('ios', 59)).toEqual({ behavior: 'padding', enabled: true, keyboardVerticalOffset: 59 });
  });

  it('is off on Android (adjustResize resizes the window)', () => {
    expect(chatKeyboardAvoidingProps('android', 24)).toEqual({ behavior: undefined, enabled: false, keyboardVerticalOffset: 0 });
  });
});
