/** T-113 (AUTH-18): a disabled BrandButton looks disabled (theme disabledFill/disabledText). */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BrandButton from '../../src/components/BrandButton';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { LightTheme } from '../../src/theme';

const renderButton = (disabled: boolean, onPress = jest.fn()) => {
  render(
    <ThemeProvider>
      <BrandButton title="Verify Code" onPress={onPress} disabled={disabled} textStyle={{ color: '#ffffff' }} />
    </ThemeProvider>,
  );
  return onPress;
};

describe('BrandButton', () => {
  it('disabled: disabled fill and label, reported as disabled, does not press', () => {
    const onPress = renderButton(true);
    const button = screen.getByRole('button', { name: 'Verify Code' });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(LightTheme.colors.disabledFill);
    expect(StyleSheet.flatten(screen.getByText('Verify Code').props.style).color).toBe(LightTheme.colors.disabledText);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('enabled: the variant fill and the caller label colour', () => {
    const onPress = renderButton(false);
    const button = screen.getByRole('button', { name: 'Verify Code' });
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(LightTheme.colors.primary);
    expect(StyleSheet.flatten(screen.getByText('Verify Code').props.style).color).toBe('#ffffff');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
