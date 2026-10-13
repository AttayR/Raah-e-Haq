/** BE-09 / BE-08 response bodies for tests (fake local data only). */

export const rawWallet = (overrides: Record<string, unknown> = {}) => ({
  balance: 0,
  currency: 'PKR',
  status: 'active',
  commission_owed: 0,
  available_balance: 0,
  total_spent: 15230,
  total_earnings: 0,
  pending_settlements: [],
  payment_methods: ['cash'],
  can_top_up: false,
  can_request_payout: false,
  can_settle_commission: false,
  updated_at: '2026-10-11T09:00:00+00:00',
  ...overrides,
});

export const rawTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: 812,
  reference: 'TXN-01JATEST',
  type: 'commission_due',
  label: 'Platform Commission',
  direction: 'debit',
  amount: 58,
  gross_amount: 58,
  fee: 0,
  net_amount: 58,
  balance_change: -58,
  balance_after: -116,
  currency: 'PKR',
  status: 'completed',
  payment_method: 'cash',
  description: 'Platform commission for ride RH-TEST1',
  ride: { id: 7, ride_id: 'RH-TEST1', status: 'completed', vehicle_type: 'car', completed_at: '2026-10-11T08:55:00+00:00' },
  settlement_id: null,
  reverses_id: null,
  reversed: false,
  created_at: '2026-10-11T09:00:00+00:00',
  ...overrides,
});

export const rawSettlement = (overrides: Record<string, unknown> = {}) => ({
  id: 3,
  kind: 'commission_payment',
  amount: 116,
  currency: 'PKR',
  method: 'bank_transfer',
  reference: 'IBFT-123',
  note: null,
  status: 'pending',
  review_note: null,
  reviewed_at: null,
  transaction_id: null,
  created_at: '2026-10-11T10:00:00+00:00',
  ...overrides,
});

export const envelope = (data: unknown, pagination?: Record<string, number>) => ({
  success: true,
  message: 'OK',
  data,
  ...(pagination ? { pagination } : {}),
});

export const pageInfo = (current: number, last: number, total = last * 20) => ({
  current_page: current,
  last_page: last,
  per_page: 20,
  total,
});

/** BE-74 GET /wallet `top_up` (local fake gateway, fake numbers only). */
export const rawTopUpConfig = (overrides: Record<string, unknown> = {}) => ({
  providers: [{ id: 'fake', name: 'Test gateway', methods: ['mwallet', 'card'] }],
  min_amount: 100,
  max_amount: 25000,
  daily_cap: 50000,
  daily_remaining: 49500,
  currency: 'PKR',
  ...overrides,
});

/** BE-74 top-up (`TU` + next_action). */
export const rawTopUp = (overrides: Record<string, unknown> = {}) => ({
  id: 'top_01k7testtesttesttesttestte',
  provider: 'fake',
  method: 'mwallet',
  amount: 500,
  currency: 'PKR',
  status: 'pending',
  mobile_number: '0300*****67',
  failure: null,
  transaction_id: null,
  created_at: '2026-10-13T09:00:00+00:00',
  expires_at: '2026-10-13T09:15:00+00:00',
  completed_at: null,
  next_action: {
    type: 'poll',
    poll_interval_seconds: 3,
    message: 'Approve the payment in your Test gateway app or the prompt on your phone.',
  },
  ...overrides,
});
