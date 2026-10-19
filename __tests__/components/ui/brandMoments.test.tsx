/**
 * UI-R21 navy + saffron brand system (DESIGN_SYSTEM §1.2, §1.7, §1.8): the new kit BrandBar,
 * FareTag and PromoCard in light and dark, their placements (auth hero, Wallet balance card,
 * Earnings hero, Choose a ride, promo notification tile) and the saffron rules (never text on a
 * light surface, words stay `textPrimary`/`textSecondary`).
 */
import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BrandBar, FareTag, PromoCard, iconGlyphs } from '../../../src/components/ui';
import AuthIntro from '../../../src/features/auth/components/AuthIntro';
import { BalanceCard } from '../../../src/features/wallet/components/BalanceCard';
import { EarningsHero } from '../../../src/features/stats/components/EarningsHero';
import { SelectedFare } from '../../../src/features/ride-booking/components/BookingChoices';
import type { FareEstimate } from '../../../src/features/ride-booking/api';
import type { FareOffer } from '../../../src/features/fare/hooks';
import { notificationTone } from '../../../src/features/notifications/format';
import { toWallet } from '../../../src/features/wallet/api';
import { rawWallet } from '../../../test-utils/walletFixtures';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import { AA_NON_TEXT, AA_TEXT, contrastRatio, darkColors, lightColors, radius } from '../../../src/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

afterEach(() => setLocale('en'));

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('brand kit in %s mode', (mode, c) => {
  it('BrandBar: a 24×4 accent pill, start-aligned and hidden from screen readers', async () => {
    await renderThemed(<BrandBar />, mode);
    const bar = screen.getByTestId('brand-bar', { includeHiddenElements: true });
    expect(flat(bar.props.style)).toMatchObject({
      width: 24,
      height: 4,
      borderRadius: radius.pill,
      alignSelf: 'flex-start',
      backgroundColor: c.accent,
    });
    expect(bar.props.accessibilityElementsHidden).toBe(true);
    expect(bar.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.queryByTestId('brand-bar')).toBeNull();
  });

  it('FareTag fixed: accentSoft pill, lock glyph in accentStrong, words in textPrimary', async () => {
    await renderThemed(<FareTag />, mode);
    const tag = screen.getByTestId('fare-tag');
    expect(flat(tag.props.style)).toMatchObject({ backgroundColor: c.accentSoft, borderRadius: radius.pill, minHeight: 24 });
    expect(tag.props.accessibilityLabel).toBe('Fixed fare');
    const icon = screen.getByTestId('fare-tag-icon');
    expect(icon.props.children).toBe(iconGlyphs.lock);
    expect(icon.props.color).toBe(c.accentStrong);
    expect(flat(screen.getByText('Fixed fare').props.style)).toMatchObject({ color: c.textPrimary, fontSize: 13, fontWeight: '600' });
  });

  it('FareTag offer: hand-coin glyph and "Your offer"', async () => {
    await renderThemed(<FareTag kind="offer" />, mode);
    expect(screen.getByTestId('fare-tag-icon').props.children).toBe('hand-coin-outline');
    expect(screen.getByText('Your offer')).toBeTruthy();
  });

  it('PromoCard: accentSoft card, 40 accent disc with an onAccent tag glyph, press handler', async () => {
    const onPress = jest.fn();
    await renderThemed(<PromoCard title="20% off" description="This weekend" meta="Valid until Sunday" onPress={onPress} testID="promo" />, mode);
    const card = screen.getByTestId('promo');
    expect(flat(card.props.style)).toMatchObject({ backgroundColor: c.accentSoft, borderRadius: radius.lg, minHeight: 120 });
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('20% off. This weekend');
    expect(flat(screen.getByTestId('promo-disc').props.style)).toMatchObject({ width: 40, height: 40, backgroundColor: c.accent });
    expect(screen.getByText(iconGlyphs.promo)).toBeTruthy();
    expect(flat(screen.getByText('This weekend').props.style)).toMatchObject({ color: c.textSecondary });
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('PromoCard invite without onPress: gift glyph, not a button', async () => {
    await renderThemed(<PromoCard kind="invite" title="Invite a friend" testID="invite" />, mode);
    expect(screen.getByTestId('invite').props.accessibilityRole).toBeUndefined();
    expect(screen.getByText('gift-outline')).toBeTruthy();
  });
});

describe('placements (§1.8)', () => {
  it('auth hero: logo → 16 → BrandBar → 12 → title; no bar unless asked', async () => {
    await renderThemed(<AuthIntro logo brandBar title="Welcome back" testID="intro" />);
    expect(flat(screen.getByTestId('intro').props.style)).toMatchObject({ gap: 16 });
    const bar = screen.getByTestId('intro-brand-bar', { includeHiddenElements: true });
    // titleBlock gap 8 + bar margin 4 = 12.
    expect(flat(bar.props.style)).toMatchObject({ marginBottom: 4 });
    screen.unmount();
    await renderThemed(<AuthIntro title="Enter the code" testID="plain" />);
    expect(screen.queryByTestId('plain-brand-bar', { includeHiddenElements: true })).toBeNull();
  });

  it('Wallet balance card carries the BrandBar above "Wallet balance"', async () => {
    const wallet = toWallet(rawWallet());
    await renderThemed(<BalanceCard wallet={wallet} isDriver={false} />, 'dark');
    expect(screen.getByTestId('wallet-brand-bar', { includeHiddenElements: true })).toBeTruthy();
    // On dark `primarySoft` (= heroFill) the bar is 4.28:1.
    expect(contrastRatio(darkColors.accent, darkColors.primarySoft)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('Earnings hero carries the BrandBar 8 above "You keep"', async () => {
    await renderThemed(
      <EarningsHero
        totals={{
          trips: 1,
          grossFares: 500,
          commission: 50,
          earnings: 450,
          distanceKm: 4,
          durationMinutes: 15,
          commissionRate: null,
          commissionAmount: null,
          bookingFees: null,
          onlineMinutes: null,
        }}
        currency="PKR"
        period="day"
        from="2026-10-19T00:00:00+05:00"
        to="2026-10-19T23:59:59+05:00"
      />,
    );
    const bar = screen.getByTestId('earnings-brand-bar', { includeHiddenElements: true });
    expect(flat(bar.props.style)).toMatchObject({ marginBottom: 8, backgroundColor: lightColors.accent });
  });

  const quote: FareEstimate = {
    vehicle_type: 'car',
    fare: 230,
    currency: 'PKR',
    breakdown: { base: 50, distance: 150, time: 30, stops: 0, min_fare_adjustment: 0, booking_fee: 0 },
    offer_band: { min: 190, max: 270, step: 10, serverFare: 230 },
    fare_policy: null,
  };
  const offer = (value: number): FareOffer => ({
    band: { min: 190, max: 270, step: 10, serverFare: 230 },
    value,
    offeredFare: value === 230 ? null : value,
    step: jest.fn(),
    reset: jest.fn(),
    applyBand: jest.fn(() => true),
  });

  it('Choose a ride: FareTag "Fixed fare" at the quote, "Your offer" once moved, Roman Urdu copy', async () => {
    await renderThemed(<SelectedFare quote={quote} distanceKm={5} durationMin={12} offer={offer(230)} />);
    expect(screen.getByTestId('fare-lock-note').props.accessibilityLabel).toBe('Fixed fare');
    screen.unmount();
    await renderThemed(<SelectedFare quote={quote} distanceKm={5} durationMin={12} offer={offer(250)} />);
    expect(screen.getByTestId('fare-lock-note').props.accessibilityLabel).toBe('Your offer');
    screen.unmount();
    setLocale('ur-Latn');
    await renderThemed(<SelectedFare quote={quote} distanceKm={5} durationMin={12} offer={offer(250)} />);
    expect(screen.getByText('Aap ki offer')).toBeTruthy();
    screen.unmount();
    await renderThemed(<FareTag />);
    expect(screen.getByText('Tay shuda kiraya')).toBeTruthy();
  });

  it('promo notification tile: accentSoft / accentStrong, ≥3:1 in both modes', () => {
    const tone = notificationTone('promo');
    expect(tone).toMatchObject({ tile: 'accentSoft', glyph: 'accentStrong' });
    for (const colors of [lightColors, darkColors]) {
      expect(contrastRatio(colors[tone.glyph], colors[tone.tile])).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });
});

describe('saffron rules (§1.2)', () => {
  it('accent is never text on a light surface: it fails 4.5:1 there, so only glyphs, shapes and fills', () => {
    expect(contrastRatio(lightColors.accent, lightColors.surface)).toBeLessThan(AA_TEXT);
    expect(contrastRatio(lightColors.accent, lightColors.surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(lightColors.onAccent, lightColors.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('dropoff square edge keeps the light rail ≥3:1 where accent alone would not', () => {
    expect(contrastRatio(lightColors.accent, lightColors.surfaceAlt)).toBeLessThan(AA_NON_TEXT);
    expect(contrastRatio(lightColors.dropoffPinEdge, lightColors.surfaceAlt)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
