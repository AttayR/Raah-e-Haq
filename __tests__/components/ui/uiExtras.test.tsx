/**
 * T-604: UI primitives added beside the shared kit for the passenger Home and booking map
 * (Chip, SectionHeader, CarMarker), in light and dark; plus the glyphs added to Icon.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import { Chip } from '../../../src/components/ui/Chip';
import { SectionHeader } from '../../../src/components/ui/SectionHeader';
import { CarMarker, CarMarkerGlyph } from '../../../src/components/ui/CarMarker';
import { Icon } from '../../../src/components/ui/Icon';

let mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

describe.each([
  ['light', LightTheme],
  ['dark', DarkTheme],
] as const)('UI extras (%s)', (_mode, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('Chip: pressable with a 44 pt hit slop, tone colours, disabled blocks presses', () => {
    const onPress = jest.fn();
    const { getByRole, getByText, rerender } = render(<Chip label="Swap" icon="swap" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByRole('button').props.hitSlop).toEqual({ top: 6, bottom: 6 });
    expect(flat(getByText('Swap').props.style)).toMatchObject({ color: theme.colors.textSecondary });

    rerender(<Chip label="Cancel" tone="danger" onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flat(getByText('Cancel').props.style)).toMatchObject({ color: theme.colors.danger });
  });

  it('Chip without onPress is a static, selectable label', () => {
    const { queryByRole, getByText } = render(<Chip label="1. Pickup" selected />);
    expect(queryByRole('button')).toBeNull();
    expect(flat(getByText('1. Pickup').props.style)).toMatchObject({ color: theme.colors.onPrimarySoft });
  });

  it('SectionHeader: overline title and optional action', () => {
    const onAction = jest.fn();
    const { getByText, getByLabelText, rerender, queryByRole } = render(
      <SectionHeader title="Recent rides" actionLabel="See all" onAction={onAction} actionAccessibilityLabel="See all rides" />,
    );
    expect(flat(getByText('Recent rides').props.style)).toMatchObject({ textTransform: 'uppercase', color: theme.colors.textMuted });
    fireEvent.press(getByLabelText('See all rides'));
    expect(onAction).toHaveBeenCalled();
    rerender(<SectionHeader title="Offers" />);
    expect(queryByRole('button')).toBeNull();
  });

  it('car marker: driverMarker body with a surface ring, centred anchor, muted variant', () => {
    const { getByTestId, rerender } = render(<CarMarkerGlyph testID="car" />);
    expect(flat(getByTestId('car').props.style)).toMatchObject({
      backgroundColor: theme.colors.driverMarker,
      borderColor: theme.colors.surface,
      width: 32,
    });
    rerender(<CarMarkerGlyph testID="car" muted />);
    expect(flat(getByTestId('car').props.style)).toMatchObject({ opacity: 0.6 });
    const marker = render(<CarMarker testID="marker" coordinate={{ latitude: 31.5, longitude: 74.3 }} title="Available Driver" />);
    expect(marker.getByTestId('marker').props.anchor).toEqual({ x: 0.5, y: 0.5 });
  });

  it('Icon renders the glyphs added for the passenger screens', () => {
    const { getByText } = render(<Icon name="swap" />);
    expect(getByText('swap-vert')).toBeTruthy();
  });
});
