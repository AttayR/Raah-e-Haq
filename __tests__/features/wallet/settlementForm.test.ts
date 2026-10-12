/**
 * T-508: the "Pay commission" form is checked like the server checks POST /wallet/settlements:
 * amount ≥ Rs 1 and ≤ commission owed, a reference for bank transfers in the allowed characters.
 */
import { validateSettlementForm, type SettlementFormValues } from '../../../src/features/wallet/settlementForm';

const values = (overrides: Partial<SettlementFormValues> = {}): SettlementFormValues => ({
  amount: '116',
  method: 'cash',
  reference: '',
  note: '',
  ...overrides,
});

describe('validateSettlementForm', () => {
  it('accepts the owed amount in cash and builds the request', () => {
    expect(validateSettlementForm(values(), 116)).toEqual({
      ok: true,
      request: { kind: 'commission_payment', amount: 116, method: 'cash' },
    });
  });

  it('accepts a partial payment with decimals, trims reference and note', () => {
    const result = validateSettlementForm(
      values({ amount: '50.5', method: 'bank_transfer', reference: ' IBFT-123 ', note: '  paid at branch ' }),
      116,
    );
    expect(result).toEqual({
      ok: true,
      request: { kind: 'commission_payment', amount: 50.5, method: 'bank_transfer', reference: 'IBFT-123', note: 'paid at branch' },
    });
  });

  it('refuses more than is owed', () => {
    const result = validateSettlementForm(values({ amount: '116.01' }), 116);
    expect(result).toEqual({ ok: false, errors: { amount: 'You owe Rs 116. Enter that amount or less.' } });
  });

  it('refuses zero, empty and malformed amounts', () => {
    expect(validateSettlementForm(values({ amount: '0' }), 116)).toMatchObject({ ok: false, errors: { amount: 'The amount must be at least Rs 1.' } });
    // The server minimum is 1 (POST /wallet/settlements amount: 1–500000).
    expect(validateSettlementForm(values({ amount: '0.5' }), 116)).toMatchObject({ ok: false, errors: { amount: 'The amount must be at least Rs 1.' } });
    expect(validateSettlementForm(values({ amount: '1' }), 116)).toMatchObject({ ok: true });
    expect(validateSettlementForm(values({ amount: '' }), 116)).toMatchObject({ ok: false, errors: { amount: 'Enter the amount you paid.' } });
    expect(validateSettlementForm(values({ amount: '12.345' }), 116)).toMatchObject({ ok: false, errors: { amount: expect.any(String) } });
    expect(validateSettlementForm(values({ amount: '-5' }), 116)).toMatchObject({ ok: false });
  });

  it('refuses when nothing is owed', () => {
    expect(validateSettlementForm(values({ amount: '10' }), 0)).toMatchObject({
      ok: false,
      errors: { amount: 'You owe no commission right now.' },
    });
  });

  it('requires a valid reference for bank transfers only', () => {
    expect(validateSettlementForm(values({ method: 'bank_transfer' }), 116)).toMatchObject({
      ok: false,
      errors: { reference: 'Enter the bank transfer reference.' },
    });
    expect(validateSettlementForm(values({ method: 'bank_transfer', reference: 'IBFT<script>' }), 116)).toMatchObject({
      ok: false,
      errors: { reference: expect.stringMatching(/letters, numbers/) },
    });
    expect(validateSettlementForm(values({ reference: 'x'.repeat(101) }), 116)).toMatchObject({
      ok: false,
      errors: { reference: 'Use 100 characters or fewer.' },
    });
    expect(validateSettlementForm(values({ reference: 'RCPT 12/3#a_b:c.d' }), 116)).toMatchObject({ ok: true });
  });

  it('limits the note to 500 characters', () => {
    expect(validateSettlementForm(values({ note: 'n'.repeat(501) }), 116)).toMatchObject({
      ok: false,
      errors: { note: 'Use 500 characters or fewer.' },
    });
  });
});
