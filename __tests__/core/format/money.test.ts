/**
 * T-508: one money format for the whole app ("Rs 1,234"), safe for the BE-09 number shapes
 * (58, 58.5, negatives), plus the amount-field parser used by the settlement form.
 */
import { MINUS, formatMoney, moneyInputText, parseMoneyInput } from '../../../src/core/format/money';

describe('formatMoney', () => {
  it('groups thousands and shows "Rs" for PKR', () => {
    expect(formatMoney(0)).toBe('Rs\u00A00');
    expect(formatMoney(58)).toBe('Rs\u00A058');
    expect(formatMoney(1234)).toBe('Rs\u00A01,234');
    expect(formatMoney(1234567)).toBe('Rs\u00A01,234,567');
    expect(formatMoney(500, { currency: 'pkr' })).toBe('Rs\u00A0500');
  });

  it('shows two decimals only for fractional amounts', () => {
    expect(formatMoney(58.5)).toBe('Rs\u00A058.50');
    expect(formatMoney(1200.05)).toBe('Rs\u00A01,200.05');
    expect(formatMoney(99.999)).toBe('Rs\u00A0100');
  });

  it('signs: auto (negatives), always (ledger), never (absolute)', () => {
    expect(formatMoney(-116)).toBe(`${MINUS}Rs\u00A0116`);
    expect(formatMoney(500, { sign: 'always' })).toBe('+Rs\u00A0500');
    expect(formatMoney(-58, { sign: 'always' })).toBe(`${MINUS}Rs\u00A058`);
    expect(formatMoney(-58, { sign: 'never' })).toBe('Rs\u00A058');
    // No "-Rs 0" from rounding.
    expect(formatMoney(-0.001, { sign: 'always' })).toBe('Rs\u00A00');
  });

  it('other currencies keep their code; bad input is Rs 0', () => {
    expect(formatMoney(10, { currency: 'USD' })).toBe('USD\u00A010');
    expect(formatMoney(Number.NaN)).toBe('Rs\u00A00');
  });
});

describe('parseMoneyInput / moneyInputText', () => {
  it('accepts digits with up to two decimals and grouping commas', () => {
    expect(parseMoneyInput('116')).toBe(116);
    expect(parseMoneyInput(' 1,200.5 ')).toBe(1200.5);
    expect(parseMoneyInput('0.25')).toBe(0.25);
  });

  it('rejects anything else', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('12.345')).toBeNull();
    expect(parseMoneyInput('-5')).toBeNull();
    expect(parseMoneyInput('Rs 50')).toBeNull();
    expect(parseMoneyInput('1e3')).toBeNull();
  });

  it('pre-fills an input without currency or grouping', () => {
    expect(moneyInputText(116)).toBe('116');
    expect(moneyInputText(58.5)).toBe('58.5');
    expect(moneyInputText(1200.05)).toBe('1200.05');
    expect(moneyInputText(-3)).toBe('0');
  });
});
