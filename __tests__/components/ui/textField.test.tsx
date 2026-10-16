/**
 * UI-R2 TextField (DESIGN_SYSTEM §5.6): label/helper/error, focus and error borders, phone (+92
 * prefix, formatting, paste), password show/hide, search clear, disabled, multiline; and the OTP
 * input (boxes, auto-advance, paste, completion, error), in light and dark.
 */
import React, { useState } from 'react';
import {
  AccessibilityInfo,
  InputAccessoryView,
  Keyboard,
  StyleSheet,
  useColorScheme,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import {
  OtpInput,
  TextField,
  formatNationalPhone,
  sanitizeOtp,
  toNationalDigits,
} from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

type FlatStyle = ViewStyle & TextStyle;
const flat = (style: StyleProp<FlatStyle>): FlatStyle => StyleSheet.flatten(style) ?? {};

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
beforeEach(() => announce.mockClear());

// OTP boxes are hidden from screen readers (the one input is read instead), so query them explicitly.
const HIDDEN = { includeHiddenElements: true } as const;

const MODES: Array<['light' | 'dark', AppTheme]> = [
  ['light', LightTheme],
  ['dark', DarkTheme],
];

describe('phone helpers', () => {
  it.each([
    ['3001234567', '3001234567'],
    ['03001234567', '3001234567'],
    ['+92 300 1234567', '3001234567'],
    ['0092 300 1234567', '3001234567'],
    ['923001234567', '3001234567'],
    ['0300-123 4567', '3001234567'],
    ['300123456789', '3001234567'],
    ['30', '30'],
  ])('%s → %s', (input, digits) => expect(toNationalDigits(input)).toBe(digits));

  it('formats 3xx xxxxxxx as it grows', () => {
    expect(formatNationalPhone('300')).toBe('300');
    expect(formatNationalPhone('3001')).toBe('300 1');
    expect(formatNationalPhone('3001234567')).toBe('300 1234567');
  });
});

describe.each(MODES)('TextField (%s)', (mode, theme) => {
  it('label, helper as hint, 52pt surfaceAlt field with an idle 1pt borderStrong boundary', async () => {
    await renderThemed(
      <TextField label="Full name" helper="As on your CNIC" value="" onChangeText={jest.fn()} testID="f" />,
      mode,
    );
    expect(screen.getByText('Full name')).toBeTruthy();
    expect(screen.getByText('As on your CNIC')).toBeTruthy();
    const input = screen.getByLabelText('Full name');
    expect(input.props.accessibilityHint).toBe('As on your CNIC');
    expect(input.props.maxFontSizeMultiplier).toBe(1.3);
    expect(flat(screen.getByTestId('f-field').props.style)).toMatchObject({
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surfaceAlt,
    });
    // Single-line inputs centre on size alone (no lineHeight); inset = 16 − 1.
    const inputStyle = flat(screen.getByTestId('f-input').props.style);
    expect(inputStyle.lineHeight).toBeUndefined();
    expect(inputStyle).toMatchObject({ fontSize: 16, paddingHorizontal: 15 });
  });

  it('focus: 2pt focusRing border and surface fill; blur restores', async () => {
    await renderThemed(<TextField label="Name" value="" onChangeText={jest.fn()} testID="f" />, mode);
    fireEvent(screen.getByTestId('f-input'), 'focus');
    expect(flat(screen.getByTestId('f-field').props.style)).toMatchObject({
      borderColor: theme.colors.focusRing,
      borderWidth: 2,
      backgroundColor: theme.colors.surface,
    });
    // 16 − 2: the text does not move when the border thickens.
    expect(flat(screen.getByTestId('f-input').props.style).paddingHorizontal).toBe(14);
    fireEvent(screen.getByTestId('f-input'), 'blur');
    expect(flat(screen.getByTestId('f-field').props.style)).toMatchObject({
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
    });
  });

  it('error: danger border (even when focused), message, read with the label', async () => {
    await renderThemed(
      <TextField label="Mobile number" value="" onChangeText={jest.fn()} error="Enter a valid mobile number" testID="f" />,
      mode,
    );
    fireEvent(screen.getByTestId('f-input'), 'focus');
    expect(flat(screen.getByTestId('f-field').props.style)).toMatchObject({ borderColor: theme.colors.danger, borderWidth: 2 });
    expect(flat(screen.getByTestId('f-error').props.style).color).toBe(theme.colors.danger);
    expect(announce).toHaveBeenCalledWith('Error: Enter a valid mobile number');
    expect(screen.getByLabelText('Mobile number, Error: Enter a valid mobile number')).toBeTruthy();
  });
});

describe('TextField variants', () => {
  it('phone: +92 prefix, formatted value, digits keypad, pasted numbers normalised', async () => {
    const onChangeText = jest.fn();
    await renderThemed(<TextField variant="phone" label="Mobile" value="3001234567" onChangeText={onChangeText} testID="p" />);
    expect(screen.getByText('+92')).toBeTruthy();
    expect(screen.getByLabelText('Pakistan, plus 92')).toBeTruthy();
    const input = screen.getByTestId('p-input');
    expect(input.props.value).toBe('300 1234567');
    expect(input.props.keyboardType).toBe('phone-pad');
    expect(input.props.textContentType).toBe('telephoneNumber');
    expect(input.props.maxLength).toBeUndefined();
    fireEvent.changeText(input, '+92 321 7654321');
    expect(onChangeText).toHaveBeenLastCalledWith('3217654321');
  });

  it('password: hidden by default, labelled 44pt toggle reveals and hides', async () => {
    await renderThemed(<TextField variant="password" label="Password" value="abc" onChangeText={jest.fn()} testID="pw" />);
    expect(screen.getByTestId('pw-input').props.secureTextEntry).toBe(true);
    const show = screen.getByRole('button', { name: 'Show password' });
    expect(show.props.hitSlop).toBe(2);
    fireEvent.press(show);
    expect(screen.getByTestId('pw-input').props.secureTextEntry).toBe(false);
    fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByTestId('pw-input').props.secureTextEntry).toBe(true);
  });

  it('search: exactly 40pt pill, 32pt clear with 6pt slop (44 target) empties the text', async () => {
    function Harness() {
      const [q, setQ] = useState('Liberty');
      return <TextField variant="search" value={q} onChangeText={setQ} accessibilityLabel="Search" testID="s" />;
    }
    await renderThemed(<Harness />);
    expect(flat(screen.getByTestId('s-field').props.style)).toMatchObject({ height: 40, borderRadius: 999 });
    const clear = screen.getByRole('button', { name: 'Clear text' });
    expect(flat(clear.props.style).width).toBe(32);
    expect(clear.props.hitSlop).toBe(6);
    fireEvent.press(clear);
    expect(screen.getByTestId('s-input').props.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear text' })).toBeNull();
  });

  it('disabled: not editable, 0.5 opacity, no clear button', async () => {
    await renderThemed(<TextField label="Name" value="Ali" clearable disabled onChangeText={jest.fn()} testID="d" />);
    expect(screen.getByTestId('d-input').props.editable).toBe(false);
    expect(flat(screen.getByTestId('d').props.style).opacity).toBe(0.5);
    expect(screen.queryByRole('button', { name: 'Clear text' })).toBeNull();
  });

  it('multiline: 96pt minimum, text aligned to the top', async () => {
    await renderThemed(<TextField label="Note" value="" multiline onChangeText={jest.fn()} testID="m" />);
    expect(flat(screen.getByTestId('m-field').props.style).minHeight).toBe(96);
    expect(flat(screen.getByTestId('m-input').props.style)).toMatchObject({ textAlignVertical: 'top', lineHeight: 24 });
  });
});

describe('OtpInput', () => {
  it('keeps digits only and caps the length', () => {
    expect(sanitizeOtp('Code: 123 456 7')).toBe('123456');
    expect(sanitizeOtp('12a3', 4)).toBe('123');
  });

  it('boxes are 48×56; typing advances; paste fills and completes once', async () => {
    const onComplete = jest.fn();
    function Harness() {
      const [code, setCode] = useState('');
      return <OtpInput value={code} onChange={setCode} onComplete={onComplete} testID="otp" />;
    }
    await renderThemed(<Harness />);
    const input = screen.getByLabelText('Verification code, 6 digits');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.keyboardType).toBe('number-pad');
    expect(flat(screen.getByTestId('otp-box-0', HIDDEN).props.style)).toMatchObject({
      width: 48,
      height: 56,
      borderWidth: 1,
      borderColor: LightTheme.colors.borderStrong,
    });
    // The capture input draws no glyphs of its own (no ghost digits behind the boxes).
    expect(flat(input.props.style)).toMatchObject({ color: 'transparent', opacity: 0.02 });
    expect(input.props.caretHidden).toBe(true);

    fireEvent(input, 'focus');
    fireEvent.changeText(input, '12');
    expect(flat(screen.getByTestId('otp-box-2', HIDDEN).props.style)).toMatchObject({
      borderColor: LightTheme.colors.focusRing,
      borderWidth: 2,
    });
    expect(screen.getByText('2', HIDDEN)).toBeTruthy();

    fireEvent.changeText(input, 'Your code is 654 321');
    expect(screen.getByTestId('otp-input').props.value).toBe('654321');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('654321');
    fireEvent.changeText(input, '6543210');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('error: every box danger, message read with the field (dark)', async () => {
    await renderThemed(<OtpInput value="111111" onChange={jest.fn()} error="That code is not correct" testID="otp" />, 'dark');
    for (let i = 0; i < 6; i += 1) {
      expect(flat(screen.getByTestId(`otp-box-${i}`, HIDDEN).props.style).borderColor).toBe(DarkTheme.colors.danger);
    }
    expect(screen.getByLabelText('Verification code, 6 digits, Error: That code is not correct')).toBeTruthy();
  });

  it('fits a 375pt iPhone SE row: 6×48 + 5×8 ≤ 343', () => {
    expect(6 * 48 + 5 * 8).toBeLessThanOrEqual(375 - 32);
  });
});

describe('TextField doneBar (T-548)', () => {
  it('each field with doneBar gets its own iOS Done bar by a unique id; fields without it get none', async () => {
    await renderThemed(
      <>
        <TextField value="" onChangeText={() => {}} label="Date of birth" keyboardType="number-pad" doneBar testID="dob" />
        <TextField value="" onChangeText={() => {}} label="Address" testID="address" />
        <TextField value="" onChangeText={() => {}} label="About you" multiline doneBar testID="bio" />
      </>,
    );
    const dobId = screen.getByTestId('dob-input').props.inputAccessoryViewID;
    const bioId = screen.getByTestId('bio-input').props.inputAccessoryViewID;
    expect(dobId).toBeTruthy();
    expect(bioId).toBeTruthy();
    // Fabric attaches an InputAccessoryView to only the first input with its id: never share one.
    expect(bioId).not.toBe(dobId);
    expect(screen.getByTestId('address-input').props.inputAccessoryViewID).toBeUndefined();
    const bars = screen.UNSAFE_getAllByType(InputAccessoryView).map(bar => bar.props.nativeID);
    expect(bars).toEqual([dobId, bioId]);
    expect(screen.queryByTestId('address-done')).toBeNull();
  });

  it('the bar reads "Done" as a button and closes the keyboard; doneBar overrides inputAccessoryViewID', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    await renderThemed(
      <TextField value="" onChangeText={() => {}} label="About you" multiline doneBar inputAccessoryViewID="shared" testID="bio" />,
    );
    expect(screen.getByTestId('bio-input').props.inputAccessoryViewID).not.toBe('shared');
    const done = screen.getByTestId('bio-done');
    expect(done.props.accessibilityRole).toBe('button');
    expect(done.props.accessibilityLabel).toBe('Done');
    fireEvent.press(done);
    expect(dismiss).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
  });

  it('a field without doneBar passes its own inputAccessoryViewID through', async () => {
    await renderThemed(<TextField value="" onChangeText={() => {}} label="Amount" inputAccessoryViewID="amountDone" testID="amount" />);
    expect(screen.getByTestId('amount-input').props.inputAccessoryViewID).toBe('amountDone');
    expect(screen.UNSAFE_queryAllByType(InputAccessoryView)).toHaveLength(0);
  });
});
