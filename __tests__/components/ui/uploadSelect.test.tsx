/**
 * UI-R7 kit: UploadTile (empty, filled with replace or remove, required marker, error, disabled)
 * and SelectField (placeholder, opens a sheet of options, picks one, error), light and dark.
 */
import React from 'react';
import { Keyboard, StyleSheet, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../../src/theme';
import { SelectField, UploadTile } from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  const result = render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
  return result;
};

/** The Pressable's style for its idle state. */
const idleStyle = (testID: string): ViewStyle => {
  const style = screen.getByTestId(testID).props.style as StyleProp<ViewStyle>;
  return StyleSheet.flatten(style) ?? {};
};

describe('UploadTile', () => {
  it('empty: dashed borderStrong, "Add photo", the formats hint; tapping picks', async () => {
    const onPress = jest.fn();
    await renderThemed(<UploadTile label="CNIC front" onPress={onPress} testID="tile" />);
    expect(screen.getByText('CNIC front')).toBeTruthy();
    expect(screen.getByText('Add photo')).toBeTruthy();
    expect(screen.getByText('JPG or PNG, clear and readable')).toBeTruthy();
    expect(idleStyle('tile')).toMatchObject({ borderStyle: 'dashed', borderColor: LightTheme.colors.borderStrong });
    expect(screen.getByTestId('tile').props.accessibilityLabel).toBe('CNIC front, no photo yet');
    fireEvent.press(screen.getByTestId('tile'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('tile-replace')).toBeNull();
  });

  it('filled: shows the photo and a replace button that picks again', async () => {
    const onPress = jest.fn();
    await renderThemed(<UploadTile label="CNIC back" uri="file:///cnic.jpg" onPress={onPress} testID="tile" />);
    expect(screen.queryByText('Add photo')).toBeNull();
    expect(screen.getByTestId('tile').props.accessibilityLabel).toBe('CNIC back, photo added');
    fireEvent.press(screen.getByTestId('tile-replace'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tile-replace').props.accessibilityLabel).toBe('Replace CNIC back');
  });

  it('filled with onRemove: the corner button removes instead, with its own test id', async () => {
    const onRemove = jest.fn();
    await renderThemed(
      <UploadTile label="Front" shape="square" uri="file:///front.jpg" onPress={jest.fn()} onRemove={onRemove} testID="slot" removeTestID="slot-x" />,
    );
    fireEvent.press(screen.getByTestId('slot-x'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('slot-x').props.accessibilityLabel).toBe('Remove Front');
    // Square tiles put the side under the tile.
    expect(screen.getByText('Front')).toBeTruthy();
  });

  it('required adds a separate "*"; an error turns the border danger and is read with the label', async () => {
    await renderThemed(
      <UploadTile label="Driving licence front" required error="The license image field is required." onPress={jest.fn()} testID="tile" />,
      'dark',
    );
    expect(screen.getByText('*')).toBeTruthy();
    expect(screen.getByTestId('tile-error')).toHaveTextContent('The license image field is required.');
    expect(idleStyle('tile')).toMatchObject({ borderColor: DarkTheme.colors.danger, borderStyle: 'solid' });
    expect(screen.getByTestId('tile').props.accessibilityLabel).toBe(
      'Driving licence front, no photo yet, required, Error: The license image field is required.',
    );
  });

  it('disabled: no press while the picker is open', async () => {
    const onPress = jest.fn();
    await renderThemed(<UploadTile label="CNIC front" onPress={onPress} disabled testID="tile" />);
    fireEvent.press(screen.getByTestId('tile'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('tile').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('SelectField', () => {
  const options = [
    { value: '2027', label: '2027' },
    { value: '2026', label: '2026' },
  ];

  it('shows the placeholder, opens a sheet of options and picks one', async () => {
    const onChange = jest.fn();
    await renderThemed(<SelectField label="Year" value="" options={options} onChange={onChange} testID="year" />);
    expect(screen.getByText('Select')).toBeTruthy();
    expect(screen.queryByTestId('year-sheet')).toBeNull();

    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    fireEvent.press(screen.getByTestId('year-field'));
    // T-560: the keyboard of a field above is closed before the modal sheet opens.
    expect(dismiss).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
    expect(screen.getByTestId('year-option-2026')).toBeTruthy();
    fireEvent.press(screen.getByTestId('year-option-2026'));
    expect(onChange).toHaveBeenCalledWith('2026');
    // Closed through the sheet's own close animation, then unmounted.
    await act(async () => {});
    expect(screen.queryByTestId('year-option-2026')).toBeNull();
  });

  it('shows the chosen label, marks it selected in the sheet and shows an error', async () => {
    await renderThemed(
      <SelectField label="Year" value="2027" options={options} onChange={jest.fn()} error="Vehicle year is required" testID="year" />,
      'dark',
    );
    expect(screen.getByTestId('year-field').props.accessibilityLabel).toBe('Year, 2027, Error: Vehicle year is required');
    expect(screen.getByTestId('year-error')).toHaveTextContent('Vehicle year is required');
    expect(idleStyle('year-field')).toMatchObject({ borderColor: DarkTheme.colors.danger });
    fireEvent.press(screen.getByTestId('year-field'));
    expect(screen.getByTestId('year-option-2027').props.accessibilityLabel).toBe('2027, selected');
  });

  it('disabled: does not open', async () => {
    await renderThemed(<SelectField label="Year" value="" options={options} onChange={jest.fn()} disabled testID="year" />);
    fireEvent.press(screen.getByTestId('year-field'));
    expect(screen.queryByTestId('year-option-2027')).toBeNull();
  });
});
