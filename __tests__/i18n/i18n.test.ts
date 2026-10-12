/** UI-R1: i18n scaffold (DESIGN_SYSTEM §7, §12.8). */
import { en, getLocale, interpolate, localeTag, strings, t } from '../../src/i18n';

describe('i18n', () => {
  it('returns English strings by dot path', () => {
    expect(getLocale()).toBe('en');
    expect(t('common.tryAgain')).toBe('Try again');
    expect(t('kitGallery.title')).toBe(en.kitGallery.title);
  });

  it('fills {placeholders} and leaves unknown ones as written', () => {
    expect(t('kitGallery.modeLabel', { mode: 'dark' })).toBe('Mode: dark');
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(interpolate('plain')).toBe('plain');
  });

  it('exposes the table for non-string entries and the en-PK locale tag', () => {
    expect(strings().format.monthsShort).toHaveLength(12);
    expect(strings().format.weekdaysShort).toHaveLength(7);
    expect(strings().format.currencyPKR).toBe('Rs');
    expect(localeTag()).toBe('en-PK');
  });
});
