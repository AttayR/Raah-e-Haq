/**
 * T-564: one required marker for every form control. FieldLabel puts a `danger` " *" after the
 * label (nested, so it wraps with it); TextField, SelectField and UploadTile use it through
 * `required`, add "required" to the spoken name, and the SelectField sheet title never has a "*".
 */
import React from 'react';
import { StyleSheet, TextInput, useColorScheme, type StyleProp, type TextStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../../src/theme';
import { FieldLabel, SelectField, TextField, UploadTile } from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark') => {
  mockScheme.mockReturnValue(mode);
  const result = render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
  return result;
};

const colorOf = (testID: string) =>
  (StyleSheet.flatten(screen.getByTestId(testID).props.style as StyleProp<TextStyle>) ?? {}).color;

describe.each([
  ['light', LightTheme],
  ['dark', DarkTheme],
] as const)('FieldLabel (%s)', (mode, theme) => {
  it('required: label in textSecondary, the "*" in danger, read as "required"', async () => {
    await renderThemed(
      <FieldLabel required testID="label">
        Full name
      </FieldLabel>,
      mode,
    );
    expect(screen.getByText('Full name *')).toBeTruthy();
    expect(colorOf('label')).toBe(theme.colors.textSecondary);
    expect(colorOf('label-required')).toBe(theme.colors.danger);
    expect(screen.getByTestId('label').props.accessibilityLabel).toBe('Full name, required');
  });

  it('optional: no "*" and no extra spoken text', async () => {
    await renderThemed(<FieldLabel testID="label">Email</FieldLabel>, mode);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.queryByTestId('label-required')).toBeNull();
    expect(screen.getByTestId('label').props.accessibilityLabel).toBeUndefined();
  });
});

describe('required marker on the kit controls', () => {
  it('TextField: the same danger "*", and "required" in the field name', async () => {
    await renderThemed(<TextField label="Bank name" required value="" onChangeText={jest.fn()} testID="bank" />, 'light');
    expect(screen.getByText('Bank name *')).toBeTruthy();
    expect(screen.getByText('*').props.style).toEqual(expect.arrayContaining([{ color: LightTheme.colors.danger }]));
    expect(screen.UNSAFE_getByType(TextInput).props.accessibilityLabel).toBe('Bank name, required');
  });

  it('SelectField: "*" on the field label only; the sheet title is the bare name', async () => {
    await renderThemed(
      <SelectField
        label="Licence type"
        required
        value=""
        options={[{ value: 'ltv', label: 'LTV' }]}
        onChange={jest.fn()}
        testID="licence"
      />,
      'dark',
    );
    expect(screen.getByText('Licence type *')).toBeTruthy();
    expect(screen.getByText('*').props.style).toEqual(expect.arrayContaining([{ color: DarkTheme.colors.danger }]));
    expect(screen.getByTestId('licence-field').props.accessibilityLabel).toBe('Licence type, required');
    fireEvent.press(screen.getByTestId('licence-field'));
    await act(async () => {});
    expect(screen.getByRole('header', { name: 'Licence type' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: /\*/ })).toBeNull();
  });

  it('UploadTile: the same nested "*" as the text fields', async () => {
    await renderThemed(<UploadTile label="CNIC front" required onPress={jest.fn()} testID="tile" />, 'light');
    expect(screen.getByText('CNIC front *')).toBeTruthy();
    expect(screen.getByText('*').props.style).toEqual(expect.arrayContaining([{ color: LightTheme.colors.danger }]));
  });
});
