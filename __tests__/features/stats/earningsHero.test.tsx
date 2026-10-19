/**
 * UI-R17 round 1 (docs/design/screens/driver-earnings.md §1.1, §2): the Earnings period hero
 * (one big number, the fares − commission = you keep equation, equal-column stats) and the
 * amount-owed card from GET /wallet. Only server figures: no rate until BE-123 sends one, no
 * Online stat until BE-124 does. English and Roman Urdu; loading, zero, error, negative net.
 */
import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { EarningsHero } from '../../../src/features/stats/components/EarningsHero';
import { EarningsWalletCard } from '../../../src/features/stats/components/EarningsWalletCard';
import { heroContent, owedCardState } from '../../../src/features/stats/heroText';
import { toDriverEarnings } from '../../../src/features/stats/api';
import DriverEarningsScreen from '../../../src/features/stats/screens/DriverEarningsScreen';
import type { EarningsTotals } from '../../../src/features/stats/types';
import { toWallet } from '../../../src/features/wallet/api';
import { setLocale } from '../../../src/i18n';
import { darkColors, lightColors } from '../../../src/theme';
import { envelope, rawWallet } from '../../../test-utils/walletFixtures';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useIsFocused: () => true,
}));

const MINUS = '−';

const totals = (overrides: Partial<EarningsTotals> = {}): EarningsTotals => ({
  trips: 4,
  grossFares: 1310,
  commission: 262,
  earnings: 1048,
  distanceKm: 23.4,
  durationMinutes: 80,
  commissionRate: null,
  commissionAmount: null,
  bookingFees: null,
  onlineMinutes: null,
  ...overrides,
});

const rawEarnings = (period: string, totalsRaw: Record<string, unknown>) => ({
  period,
  timezone: 'Asia/Karachi',
  from: '2026-10-19T00:00:00+05:00',
  to: period === 'day' ? '2026-10-19T23:59:59+05:00' : '2026-10-25T23:59:59+05:00',
  currency: 'PKR',
  totals: totalsRaw,
  series: [],
  rides: [],
  pagination: { current_page: 1, last_page: 1, total: 0 },
});

const hero = (t: EarningsTotals, period: 'day' | 'week' | 'month' = 'day') => (
  <ThemeProvider>
    <EarningsHero totals={t} currency="PKR" period={period} from="2026-10-19T00:00:00+05:00" to="2026-10-25T23:59:59+05:00" />
  </ThemeProvider>
);

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockScheme.mockReturnValue('light');
});
afterEach(() => {
  mock.restore();
  setLocale('en');
});

describe('EarningsHero (§1.1)', () => {
  it('shows the big net, the three-row equation without a rate, and Trips + Distance only', async () => {
    render(hero(totals()));
    expect((await screen.findByTestId('earnings-total')).props.children).toBe('Rs 1,048');
    expect(screen.getByTestId('earnings-period-caption').props.children).toBe('Mon, 19 Oct');
    expect(screen.getByTestId('earnings-fares').props.children).toBe('Rs 1,310');
    expect(screen.getByTestId('earnings-commission').props.children).toBe(`${MINUS} Rs 262`);
    expect(screen.getByTestId('earnings-net').props.children).toBe('Rs 1,048');
    // The headline says "You keep" once; the equation's total row is "Net".
    expect(screen.getAllByText('You keep')).toHaveLength(1);
    expect(screen.getByText('Net')).toBeTruthy();
    // BE-123 absent: "Commission" with no percentage.
    expect(screen.getByText('Commission')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByTestId('earnings-booking-fee')).toBeNull();
    // BE-124 absent: no Online column (never 0, never a dash); two equal cells.
    expect(screen.queryByTestId('earnings-online')).toBeNull();
    expect(screen.getByTestId('earnings-trips').props.children).toBe('4');
    expect(screen.getByTestId('earnings-distance').props.children).toBe('23.4 km');
    expect(screen.getByLabelText('Trips: 4')).toBeTruthy();
    expect(screen.getByLabelText('Fares collected Rs 1,310, minus commission Rs 262, you keep Rs 1,048')).toBeTruthy();
    expect(screen.getByLabelText('You keep Rs 1,048, Mon, 19 Oct')).toBeTruthy();
  });

  it('shows the rate, a booking-fee row and Online only when the server sends them (BE-123, BE-124)', async () => {
    render(hero(totals({ commissionRate: 12.5, commissionAmount: 162, bookingFees: 100, onlineMinutes: 125 }), 'week'));
    expect(await screen.findByText('Commission 12.5%')).toBeTruthy();
    expect(screen.getByTestId('earnings-commission').props.children).toBe(`${MINUS} Rs 162`);
    expect(screen.getByTestId('earnings-booking-fee').props.children).toBe(`${MINUS} Rs 100`);
    expect(screen.getByTestId('earnings-online').props.children).toBe('2 h 05 min');
    expect(screen.getByTestId('earnings-period-caption').props.children).toBe('19 Oct – 25 Oct');
    expect(
      screen.getByLabelText('Fares collected Rs 1,310, minus commission 12.5 percent Rs 162, minus booking fee Rs 100, you keep Rs 1,048'),
    ).toBeTruthy();
  });

  it('zero trips: Rs 0, a no-trips line instead of the equation, Trips 0 and 0 km', async () => {
    render(hero(totals({ trips: 0, grossFares: 0, commission: 0, earnings: 0, distanceKm: 0 }), 'month'));
    expect((await screen.findByTestId('earnings-total')).props.children).toBe('Rs 0');
    expect(screen.getByText('No trips this month yet.')).toBeTruthy();
    expect(screen.queryByTestId('earnings-breakdown')).toBeNull();
    expect(screen.getByTestId('earnings-trips').props.children).toBe('0');
    expect(screen.getByTestId('earnings-distance').props.children).toBe('0 km');
  });

  it('negative net keeps its sign in the same colour (never clamped)', async () => {
    render(hero(totals({ trips: 1, grossFares: 0, commission: 40, earnings: -40 })));
    expect((await screen.findByTestId('earnings-total')).props.children).toBe(`${MINUS}Rs 40`);
    const style = StyleSheet.flatten(screen.getByTestId('earnings-total').props.style);
    expect(style.color).toBe(lightColors.heroText);
  });

  it('dark mode: white big number on the primarySoft fill', async () => {
    mockScheme.mockReturnValue('dark');
    render(hero(totals()));
    const total = await screen.findByTestId('earnings-total');
    expect(StyleSheet.flatten(total.props.style).color).toBe('#FFFFFF');
    expect(StyleSheet.flatten(screen.getByTestId('earnings-hero').props.style).backgroundColor).toBe(darkColors.heroFill);
    expect(darkColors.heroFill).toBe(darkColors.primarySoft);
  });

  it('Roman Urdu copy', async () => {
    setLocale('ur-Latn');
    render(hero(totals({ onlineMinutes: 45 })));
    expect(await screen.findAllByText('Aap ki kamai')).toHaveLength(1);
    expect(screen.getByText('Bacha')).toBeTruthy();
    expect(screen.getByText('Wusool kiya gaya kiraya')).toBeTruthy();
    expect(screen.getByText('Online waqt')).toBeTruthy();
    expect(screen.getByText('Faasla')).toBeTruthy();
    expect(heroContent(totals({ trips: 0 }), 'PKR', 'week').noTrips).toBe('Is hafte abhi koi trip nahi.');
  });

  it('is memoised: same props do not re-render', () => {
    expect((EarningsHero as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('parses BE-123 / BE-124 totals only when sent', () => {
    const sent = toDriverEarnings(
      rawEarnings('day', { trips: 1, commission: 30, commission_rate: 20, commission_amount: 30, booking_fees: 0, online_minutes: 60 }),
      'day',
    );
    expect(sent.totals).toMatchObject({ commissionRate: 20, commissionAmount: 30, bookingFees: 0, onlineMinutes: 60 });
    const absent = toDriverEarnings(rawEarnings('day', { trips: 1, commission: 30 }), 'day');
    expect(absent.totals).toMatchObject({ commissionRate: null, commissionAmount: null, bookingFees: null, onlineMinutes: null });
  });
});

describe('amount owed card (§2)', () => {
  const card = () =>
    render(
      <ThemeProvider>
        <EarningsWalletCard visible onOpenWallet={() => mockNavigate('Wallet')} onPay={(amount) => mockNavigate('AddMoney', { amount })} />
      </ThemeProvider>,
    );
  const providers = { top_up: { providers: [{ id: 'jazzcash', name: 'JazzCash', methods: ['mwallet'] }, { id: 'easypaisa', name: 'Easypaisa', methods: ['mwallet'] }], min_amount: 100, max_amount: 50000, daily_cap: 100000, daily_remaining: 100000, currency: 'PKR' } };

  it('loading shows a skeleton, not placeholder text', async () => {
    mock.onGet('/wallet').reply(() => new Promise(() => undefined));
    card();
    expect(await screen.findByTestId('earnings-owed-loading', { includeHiddenElements: true })).toBeTruthy();
  });

  it('owed with top-up: amount, provider caption, Pay prefilled and Wallet', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -360, amount_owed: 360, commission_owed: 360, can_top_up: true, ...providers })));
    card();
    expect((await screen.findByTestId('earnings-owed-amount')).props.children).toBe('Rs 360');
    expect(screen.getByText('You owe Raah-e-Haq')).toBeTruthy();
    expect(screen.getByText('Commission from your cash trips. Pay with JazzCash or Easypaisa.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('earnings-owed-pay'));
    expect(mockNavigate).toHaveBeenCalledWith('AddMoney', { amount: 360 });
    fireEvent.press(screen.getByTestId('earnings-owed-wallet'));
    expect(mockNavigate).toHaveBeenCalledWith('Wallet');
  });

  it('owed without top-up: no Pay button, no provider sentence', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -50, amount_owed: 50 })));
    card();
    expect(await screen.findByTestId('earnings-owed')).toBeTruthy();
    expect(screen.queryByTestId('earnings-owed-pay')).toBeNull();
    expect(screen.getByText('Commission from your cash trips.')).toBeTruthy();
  });

  it('calm states: credit and nothing owed open Wallet', async () => {
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: 200 })));
    card();
    expect(await screen.findByText('Wallet credit Rs 200')).toBeTruthy();
    fireEvent.press(screen.getByTestId('earnings-wallet'));
    expect(mockNavigate).toHaveBeenCalledWith('Wallet');
    expect(owedCardState(toWallet(rawWallet()), false)).toEqual({ kind: 'settled' });
  });

  it('on hold: owed layout without Pay', () => {
    const state = owedCardState(toWallet(rawWallet({ status: 'suspended', balance: -80, amount_owed: 80, can_top_up: true })), false);
    expect(state).toEqual({ kind: 'onHold', amount: 'Rs 80', body: 'Your wallet is on hold. Contact support.' });
  });

  it('Roman Urdu owed copy', async () => {
    setLocale('ur-Latn');
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -360, amount_owed: 360, can_top_up: true, ...providers })));
    card();
    expect(await screen.findByText('Aap ne Raah-e-Haq ko dena hai')).toBeTruthy();
    expect(screen.getByText('Cash trips ka commission. JazzCash ya Easypaisa se ada karein.')).toBeTruthy();
    expect(screen.getByText('Rs 360 ada karein')).toBeTruthy();
  });
});

describe('Earnings screen order and period switch', () => {
  it('owed card sits right under the hero; switching period keeps the old hero (dimmed) until the new one lands', async () => {
    let replyWeek: (value: [number, unknown]) => void = () => undefined;
    const week = new Promise<[number, unknown]>((resolve) => (replyWeek = resolve));
    mock.onGet('/driver/earnings').reply((config) => {
      const { period } = config.params as { period: string };
      if (period === 'week') return week;
      return [200, envelope(rawEarnings('day', { trips: 2, gross_fares: 400, commission: 80, earnings: 320 }))];
    });
    mock.onGet('/wallet').reply(200, envelope(rawWallet({ balance: -116, amount_owed: 116 })));
    render(
      <ThemeProvider>
        <DriverEarningsScreen />
      </ThemeProvider>,
    );
    expect((await screen.findByTestId('earnings-total')).props.children).toBe('Rs 320');
    await screen.findByTestId('earnings-owed');
    fireEvent.press(screen.getByRole('radio', { name: 'Period, This week' }));
    // No skeleton flash: the old hero stays while the week loads.
    expect(screen.queryByTestId('earnings-loading', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('earnings-total').props.children).toBe('Rs 320');
    replyWeek([200, envelope(rawEarnings('week', { trips: 5, gross_fares: 1000, commission: 200, earnings: 800 }))]);
    await waitFor(() => expect(screen.getByTestId('earnings-total').props.children).toBe('Rs 800'));
  });
});
