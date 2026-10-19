/**
 * UI-R20 ServiceTile (passenger-home § Services S2/S3, DESIGN_SYSTEM §8.3): both tones, the
 * active (Ride) and plain (Parcel) fills in light and dark, pressed fills, the press handler,
 * the accessible name and hint, and the S3 contrast pairs.
 */
import React from 'react';
import { StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { ServiceTile, type ServiceTileProps } from '../../../src/components/ui';
import { AA_NON_TEXT, AA_TEXT, DarkTheme, LightTheme, borderWidth, contrastRatio, radius } from '../../../src/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

type FlatStyle = ViewStyle & TextStyle;
const flat = (style: StyleProp<FlatStyle>): FlatStyle => StyleSheet.flatten(style) ?? {};

const tile = (props: Partial<ServiceTileProps> = {}) => (
  <ServiceTile
    icon="rides"
    title="Ride"
    subtitle="Within the city"
    accessibilityLabel="Ride. You travel, within the city."
    accessibilityHint="Opens Where to?"
    onPress={jest.fn()}
    testID="tile"
    {...props}
  />
);

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

describe.each([
  ['light', LightTheme],
  ['dark', DarkTheme],
] as const)('ServiceTile (%s)', (mode, theme) => {
  const c = theme.colors;

  it('active primary tile: primarySoft fill, 2pt primary border, navy disc, radius lg', async () => {
    await renderThemed(tile({ active: true }), mode);
    const style = flat(screen.getByTestId('tile').props.style);
    expect(style.backgroundColor).toBe(c.primarySoft);
    expect(style.borderColor).toBe(c.primary);
    expect(style.borderWidth).toBe(borderWidth.focus);
    expect(style.borderRadius).toBe(radius.lg);
    // 12 from the outer edge: 2 of border + 10 inside it.
    expect(style.padding).toBe(10);
    expect(flat(screen.getByTestId('tile-disc').props.style).backgroundColor).toBe(c.primary);
  });

  it('plain accent tile: surfaceAlt fill, border equal to the fill, saffron disc', async () => {
    await renderThemed(tile({ tone: 'accent', icon: 'parcel', title: 'Parcel' }), mode);
    const style = flat(screen.getByTestId('tile').props.style);
    expect(style.backgroundColor).toBe(c.surfaceAlt);
    expect(style.borderColor).toBe(c.surfaceAlt);
    expect(style.borderWidth).toBe(borderWidth.focus);
    expect(flat(screen.getByTestId('tile-disc').props.style).backgroundColor).toBe(c.accent);
  });

  it('pressed fills: primarySoftPressed (active) and surfaceAltPressed (plain)', async () => {
    await renderThemed(
      <>
        {tile({ active: true })}
        {tile({ testID: 'plain', previewPressed: true })}
      </>,
      mode,
    );
    fireEvent(screen.getByTestId('tile'), 'pressIn');
    expect(flat(screen.getByTestId('tile').props.style).backgroundColor).toBe(c.primarySoftPressed);
    fireEvent(screen.getByTestId('tile'), 'pressOut');
    expect(flat(screen.getByTestId('tile').props.style).backgroundColor).toBe(c.primarySoft);
    expect(flat(screen.getByTestId('plain').props.style).backgroundColor).toBe(c.surfaceAltPressed);
  });

  it('S3 contrast: glyphs and text pass AA on their fills', () => {
    expect(contrastRatio(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(c.primary, c.surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    for (const fill of [c.primarySoft, c.surfaceAlt]) {
      expect(contrastRatio(c.textPrimary, fill)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(c.textSecondary, fill)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe('ServiceTile behaviour', () => {
  it('is one button with the spoken name and hint (not title + subtitle), and presses once', async () => {
    const onPress = jest.fn();
    await renderThemed(tile({ onPress }));
    const button = screen.getByRole('button', { name: 'Ride. You travel, within the city.' });
    expect(button.props.accessibilityHint).toBe('Opens Where to?');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('title is one line in h3, subtitle up to two lines in bodySmall textSecondary', async () => {
    await renderThemed(tile());
    const title = screen.getByText('Ride');
    const subtitle = screen.getByText('Within the city');
    expect(title.props.numberOfLines).toBe(1);
    expect(subtitle.props.numberOfLines).toBe(2);
    expect(flat(title.props.style).fontSize).toBe(20);
    expect(flat(subtitle.props.style).fontSize).toBe(14);
    expect(flat(subtitle.props.style).color).toBe(LightTheme.colors.textSecondary);
  });
});
