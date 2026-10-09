/** T-113 (AUTH-18): a disabled BrandButton looks disabled (theme disabledFill/disabledText). */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import BrandButton, { brandButtonColors, type BrandButtonVariant } from '../../src/components/BrandButton';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../src/theme';

/** WCAG 2.1 contrast of two opaque #rrggbb colours. */
const luminance = (hex: string): number => {
  const raw = hex.replace('#', '').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(raw.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const VARIANTS: BrandButtonVariant[] = ['primary', 'secondary', 'success', 'warning'];

// ThemeProvider holds its children until the stored appearance is read (T-601).
const renderButton = async (disabled: boolean, onPress = jest.fn()) => {
  render(
    <ThemeProvider>
      <BrandButton title="Verify Code" onPress={onPress} disabled={disabled} textStyle={{ color: '#ffffff' }} />
    </ThemeProvider>,
  );
  await act(async () => {});
  return onPress;
};

describe('BrandButton', () => {
  it('disabled: disabled fill and label, reported as disabled, does not press', async () => {
    const onPress = await renderButton(true);
    const button = screen.getByRole('button', { name: 'Verify Code' });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(LightTheme.colors.disabledFill);
    expect(StyleSheet.flatten(screen.getByText('Verify Code').props.style).color).toBe(LightTheme.colors.disabledText);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('enabled: the variant fill and the caller label colour', async () => {
    const onPress = await renderButton(false);
    const button = screen.getByRole('button', { name: 'Verify Code' });
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(LightTheme.colors.primary);
    expect(StyleSheet.flatten(screen.getByText('Verify Code').props.style).color).toBe('#ffffff');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('BrandButton variant colours (T-601)', () => {
  it.each(
    VARIANTS.flatMap(variant => [
      ['light', variant, LightTheme] as const,
      ['dark', variant, DarkTheme] as const,
    ]),
  )('%s %s: label on fill >= 4.5:1', (_mode, variant, theme) => {
    const { fill, label } = brandButtonColors(theme.colors, variant);
    expect(contrast(label, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('secondary is the soft navy button, not saffron', () => {
    expect(brandButtonColors(LightTheme.colors, 'secondary')).toEqual({
      fill: LightTheme.colors.primarySoft,
      label: LightTheme.colors.onPrimarySoft,
    });
  });

  it('renders the variant fill and label when the caller sets no colour', async () => {
    render(
      <ThemeProvider>
        <BrandButton title="Resend" variant="success" />
      </ThemeProvider>,
    );
    await act(async () => {});
    const { fill, label } = brandButtonColors(LightTheme.colors, 'success');
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Resend' }).props.style).backgroundColor).toBe(fill);
    expect(StyleSheet.flatten(screen.getByText('Resend').props.style).color).toBe(label);
  });
});
