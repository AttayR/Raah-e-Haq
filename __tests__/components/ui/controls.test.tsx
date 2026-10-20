/**
 * UI-R2 kit controls (DESIGN_SYSTEM §5.4–5.13): Button variants/sizes/states, haptics, IconButton,
 * Switch, Checkbox, Radio, SegmentedControl, Chip, Badge count/dot and Avatar fallbacks, in light
 * and dark, with roles, labels and 44pt targets.
 */
import React from 'react';
import { StyleSheet, Switch as RNSwitch, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
  IconButton,
  ListItem,
  Radio,
  SegmentedControl,
  Switch,
  formatBadgeCount,
  iconGlyphs,
  type ButtonVariant,
} from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const trigger = HapticFeedback.trigger as jest.Mock;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

type FlatStyle = ViewStyle & TextStyle;
const flat = (style: StyleProp<FlatStyle>): FlatStyle => StyleSheet.flatten(style) ?? {};

beforeEach(() => trigger.mockClear());

const MODES: Array<['light' | 'dark', AppTheme]> = [
  ['light', LightTheme],
  ['dark', DarkTheme],
];

describe.each(MODES)('Button (%s)', (mode, theme) => {
  const SPEC: Array<[ButtonVariant, string, keyof AppTheme['colors']]> = [
    ['primary', theme.colors.primary, 'onPrimary'],
    ['secondary', theme.colors.primarySoft, 'onPrimarySoft'],
    ['outline', 'transparent', 'primaryText'],
    ['ghost', 'transparent', 'primaryText'],
    ['destructive', theme.colors.dangerFill, 'onPrimary'],
    ['destructiveSoft', theme.colors.dangerSoft, 'danger'],
  ];

  it.each(SPEC)('%s: fill and label tokens, pill radius', async (variant, fill, text) => {
    await renderThemed(<Button label="Go" variant={variant} onPress={jest.fn()} />, mode);
    const button = flat(screen.getByRole('button', { name: 'Go' }).props.style);
    expect(button.backgroundColor).toBe(fill);
    expect(button.borderRadius).toBe(999);
    expect(flat(screen.getByText('Go').props.style).color).toBe(theme.colors[text]);
  });

  it.each([
    ['primary', 'primaryPressed'],
    ['secondary', 'primarySoftPressed'],
    ['outline', 'surfacePressed'],
    ['ghost', 'surfacePressed'],
    ['destructive', 'dangerPressed'],
    ['destructiveSoft', 'dangerSoftPressed'],
  ] as const)('pressed %s takes %s while held, then restores', async (variant, token) => {
    await renderThemed(<Button label="Go" variant={variant} onPress={jest.fn()} testID="b" />, mode);
    const rest = flat(screen.getByTestId('b').props.style).backgroundColor;
    fireEvent(screen.getByTestId('b'), 'pressIn');
    expect(flat(screen.getByTestId('b').props.style).backgroundColor).toBe(theme.colors[token]);
    fireEvent(screen.getByTestId('b'), 'pressOut');
    expect(flat(screen.getByTestId('b').props.style).backgroundColor).toBe(rest);
  });
});

describe('Button sizes, states and haptics', () => {
  it.each([
    ['lg', 56, 8, 0],
    ['md', 48, 8, 0],
    ['sm', 36, 6, 4],
  ] as const)('%s: height %i, icon gap %i, target ≥ 44 (slop %i)', async (size, height, gap, slop) => {
    await renderThemed(
      <Button label="Next" size={size} leadingIcon="car" trailingIcon="chevronEnd" onPress={jest.fn()} testID="b" />,
    );
    const button = screen.getByTestId('b');
    expect(flat(button.props.style).minHeight).toBe(height);
    expect(height + 2 * (button.props.hitSlop?.top ?? 0)).toBeGreaterThanOrEqual(44);
    expect(button.props.hitSlop?.top ?? 0).toBe(slop);
    expect(flat(screen.getByTestId('b-content').props.style).gap).toBe(gap);
  });

  it('carries a scale transform for press feedback', async () => {
    await renderThemed(<Button label="Go" onPress={jest.fn()} testID="b" />);
    expect(flat(screen.getByTestId('b').props.style).transform).toEqual([{ scale: 1 }]);
  });

  it('fires the opted-in haptic once per press, then calls onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Request ride" haptic="impactLight" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Request ride' }));
    expect(trigger).toHaveBeenCalledWith('impactLight', expect.any(Object));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no haptic without the prop; disabled and loading never press or buzz', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <>
        <Button label="Plain" onPress={onPress} />
        <Button label="Off" haptic="impactLight" disabled onPress={onPress} />
        <Button label="Busy" haptic="impactLight" loading onPress={onPress} testID="busy" />
      </>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Plain' }));
    expect(trigger).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Off' }));
    fireEvent.press(screen.getByTestId('busy'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(trigger).not.toHaveBeenCalled();
    expect(screen.getByTestId('busy').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('loading keeps the label row laid out (opacity 0) under a centred spinner, so the size never changes', async () => {
    await renderThemed(<Button label="Request ride" loading fullWidth={false} onPress={jest.fn()} testID="b" />);
    const content = screen.getByTestId('b-content', { includeHiddenElements: true });
    expect(flat(content.props.style).opacity).toBe(0);
    expect(screen.getByText('Request ride', { includeHiddenElements: true })).toBeTruthy();
    const spinnerSlot = screen.getByTestId('b-spinner').parent?.parent;
    expect(flat(spinnerSlot?.props.style)).toMatchObject({ position: 'absolute', alignItems: 'center', justifyContent: 'center' });
  });
});

describe('IconButton', () => {
  it('tonal presses to surfaceAltPressed, plain to surfacePressed', async () => {
    await renderThemed(
      <>
        <IconButton icon="close" variant="tonal" accessibilityLabel="Tonal" onPress={jest.fn()} />
        <IconButton icon="close" accessibilityLabel="Plain" onPress={jest.fn()} />
      </>,
    );
    fireEvent(screen.getByRole('button', { name: 'Tonal' }), 'pressIn');
    fireEvent(screen.getByRole('button', { name: 'Plain' }), 'pressIn');
    expect(flat(screen.getByRole('button', { name: 'Tonal' }).props.style).backgroundColor).toBe(
      LightTheme.colors.surfaceAltPressed,
    );
    expect(flat(screen.getByRole('button', { name: 'Plain' }).props.style).backgroundColor).toBe(
      LightTheme.colors.surfacePressed,
    );
  });

  it('floating is 48 visual (target met), plain 40 + 2 slop; disabled does not press', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <>
        <IconButton icon="locate" variant="floating" accessibilityLabel="Locate" onPress={onPress} />
        <IconButton icon="close" accessibilityLabel="Close" onPress={onPress} disabled />
      </>,
      'dark',
    );
    const floating = screen.getByRole('button', { name: 'Locate' });
    // UI-R20b (passenger-home V9): dark floating controls sit on `surfaceRaised` with a 1pt border, no shadow.
    expect(flat(floating.props.style)).toMatchObject({
      width: 48,
      backgroundColor: DarkTheme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: DarkTheme.colors.border,
    });
    expect(flat(floating.props.style).elevation).toBeUndefined();
    expect(floating.props.hitSlop).toBe(0);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.props.hitSlop).toBe(2);
    fireEvent.press(close);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe.each(MODES)('Switch, Checkbox, Radio (%s)', (mode, theme) => {
  it('switch: kit-drawn (no native UISwitch), role, label, state, 51x31 track in a 64x44 slot', async () => {
    const onValueChange = jest.fn();
    await renderThemed(<Switch value={false} onValueChange={onValueChange} accessibilityLabel="Sound alerts" testID="s" />, mode);
    // iOS 26 drew the native UISwitch wider than the 51x31 view RN painted behind it (owner bug
    // 2026-10-14): no native switch host may be rendered.
    expect(screen.UNSAFE_queryAllByType(RNSwitch)).toHaveLength(0);
    const sw = screen.getByRole('switch', { name: 'Sound alerts' });
    expect(sw.props.accessibilityState).toEqual({ checked: false, disabled: false });
    expect(flat(sw.props.style)).toMatchObject({ minWidth: 64, minHeight: 44, alignItems: 'flex-end' });
    expect(flat(screen.getByTestId('s-track').props.style)).toMatchObject({ width: 51, height: 31, borderRadius: 999 });
    const thumb = flat(screen.getByTestId('s-thumb').props.style);
    expect(thumb).toMatchObject({ width: 27, height: 27, backgroundColor: theme.colors.onPrimary });
    expect(thumb.backgroundColor).toBe('#FFFFFF');
  });

  it('switch: track is borderStrong off and primary on, from the theme (no hardcoded colour)', async () => {
    await renderThemed(<Switch value={false} onValueChange={jest.fn()} accessibilityLabel="Off" testID="off" />, mode);
    expect(flat(screen.getByTestId('off-track').props.style).backgroundColor).toBe(theme.colors.borderStrong);
    expect(flat(screen.getByTestId('off-fill').props.style)).toMatchObject({ backgroundColor: theme.colors.primary, opacity: 0 });
    screen.unmount();
    await renderThemed(<Switch value onValueChange={jest.fn()} accessibilityLabel="On" testID="on" />, mode);
    expect(flat(screen.getByTestId('on-fill').props.style)).toMatchObject({ backgroundColor: theme.colors.primary, opacity: 1 });
    expect(screen.getByTestId('on').props.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  it('switch source draws every colour from the theme (no hex or rgb literals)', () => {
    const { readFileSync } = jest.requireActual<{ readFileSync: (file: string, encoding: 'utf8') => string }>('fs');
    const source = readFileSync('src/components/ui/Switch.tsx', 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(source).not.toMatch(/(ios_backgroundColor|trackColor|thumbColor)=/);
  });

  it('switch: a press flips the value once and fires the selection haptic', async () => {
    const onValueChange = jest.fn();
    await renderThemed(<Switch value onValueChange={onValueChange} accessibilityLabel="Chat" testID="s" />, mode);
    fireEvent.press(screen.getByTestId('s'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(false);
    expect(trigger).toHaveBeenCalledWith('selection', expect.anything());
  });

  it('switch: disabled blocks presses and dims to 0.4, but not twice inside a disabled ListItem', async () => {
    const onValueChange = jest.fn();
    await renderThemed(<Switch value onValueChange={onValueChange} accessibilityLabel="Chat" disabled testID="s" />, mode);
    const sw = screen.getByTestId('s');
    expect(sw.props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(flat(sw.props.style).opacity).toBe(0.4);
    fireEvent.press(sw);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
    screen.unmount();

    await renderThemed(
      <ListItem
        title="Chat"
        disabled
        onPress={jest.fn()}
        trailing={<Switch value={false} onValueChange={onValueChange} accessibilityLabel="Chat" disabled testID="row-s" />}
        testID="row"
      />,
      mode,
    );
    expect(flat(screen.getByTestId('row').props.style).opacity).toBe(0.4);
    expect(flat(screen.getByTestId('row-s').props.style).opacity).toBeUndefined();
  });

  it('checkbox: role, checked state, toggles, 44pt row, primary fill when checked', async () => {
    const onChange = jest.fn();
    await renderThemed(<Checkbox label="I agree" checked onChange={onChange} testID="c" />, mode);
    const row = screen.getByRole('checkbox', { name: 'I agree' });
    expect(row.props.accessibilityState).toMatchObject({ checked: true });
    expect(flat(row.props.style).minHeight).toBe(44);
    fireEvent.press(row);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.getByText(iconGlyphs.checkMark)).toBeTruthy();
  });

  it('bare checkbox gets slop to 44; disabled blocks presses', async () => {
    const onChange = jest.fn();
    await renderThemed(<Checkbox accessibilityLabel="Select" checked={false} onChange={onChange} disabled />, mode);
    const box = screen.getByRole('checkbox', { name: 'Select' });
    expect(box.props.hitSlop).toBe(10);
    fireEvent.press(box);
    expect(onChange).not.toHaveBeenCalled();
    expect(flat(box.props.style).opacity).toBe(0.4);
  });

  it('radio: role, selected state, onSelect; pressing the selected one is a no-op', async () => {
    const onSelect = jest.fn();
    const onSelectCash = jest.fn();
    await renderThemed(
      <>
        <Radio label="Cash" selected onSelect={onSelectCash} />
        <Radio label="Wallet" selected={false} onSelect={onSelect} />
      </>,
      mode,
    );
    expect(screen.getByRole('radio', { name: 'Cash' }).props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getByRole('radio', { name: 'Wallet' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('radio', { name: 'Cash' }));
    expect(onSelectCash).not.toHaveBeenCalled();
  });
});

describe('selection haptics (§6.11)', () => {
  it('segmented control: selection haptic on change, nothing on re-tap', async () => {
    const onChange = jest.fn();
    await renderThemed(
      <SegmentedControl
        accessibilityLabel="Sign in with"
        value="phone"
        onChange={onChange}
        options={[
          { value: 'phone', label: 'Phone' },
          { value: 'email', label: 'Email' },
        ]}
      />,
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Sign in with, Phone' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('radio', { name: 'Sign in with, Email' }));
    expect(onChange).toHaveBeenCalledWith('email');
    expect(trigger).toHaveBeenCalledWith('selection', expect.any(Object));
    expect(flat(screen.getByRole('radio', { name: 'Sign in with, Email' }).props.style).minHeight).toBe(44);
  });

  it('chip: selectable chips buzz and show a tick; action chips do not buzz', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <>
        <Chip label="Home" icon="home" selected onPress={onPress} />
        <Chip label="Swap" icon="swap" onPress={onPress} />
      </>,
      'dark',
    );
    expect(screen.getByText(iconGlyphs.checkMark)).toBeTruthy();
    expect(screen.queryByText(iconGlyphs.home)).toBeNull();
    expect(flat(screen.getByText('Home').props.style).color).toBe(DarkTheme.colors.onPrimarySoft);
    fireEvent.press(screen.getByRole('button', { name: 'Swap' }));
    expect(trigger).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Home' }));
    expect(trigger).toHaveBeenCalledWith('selection', expect.any(Object));
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Home' }).props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe.each(MODES)('Chip pressed fills (%s)', (mode, theme) => {
  it.each([
    ['default', {}, 'surfaceAltPressed'],
    ['selected', { selected: true }, 'primarySoftPressed'],
    ['danger', { tone: 'danger' as const }, 'dangerSoftPressed'],
  ] as const)('%s chip presses to its pressed token', async (_name, props, token) => {
    await renderThemed(<Chip label="Chip" onPress={jest.fn()} {...props} />, mode);
    fireEvent(screen.getByRole('button', { name: 'Chip' }), 'pressIn');
    expect(flat(screen.getByRole('button', { name: 'Chip' }).props.style).backgroundColor).toBe(theme.colors[token]);
  });
});

describe('Badge', () => {
  it('count: dangerFill pill with white numerals, 99+ cap, nothing at zero, host label', async () => {
    expect(formatBadgeCount(7)).toBe('7');
    expect(formatBadgeCount(150)).toBe('99+');
    await renderThemed(
      <>
        <Badge variant="count" count={150} accessibilityLabel="150 unread" testID="many" />
        <Badge variant="count" count={0} testID="none" />
      </>,
      'dark',
    );
    expect(flat(screen.getByTestId('many').props.style)).toMatchObject({
      backgroundColor: DarkTheme.colors.dangerFill,
      minHeight: 18,
      minWidth: 18,
    });
    expect(flat(screen.getByText('99+').props.style).color).toBe('#FFFFFF');
    expect(screen.queryByTestId('none')).toBeNull();
    expect(screen.getByLabelText('150 unread')).toBeTruthy();
  });

  it('dot: 8pt danger with a 2pt surface ring; labelled when given a label', async () => {
    await renderThemed(<Badge variant="dot" accessibilityLabel="Unread" testID="dot" />);
    expect(flat(screen.getByTestId('dot').props.style)).toMatchObject({
      width: 12,
      borderWidth: 2,
      backgroundColor: LightTheme.colors.danger,
      borderColor: LightTheme.colors.surface,
    });
    expect(screen.getByLabelText('Unread')).toBeTruthy();
  });
});

describe('Avatar fallbacks', () => {
  it('a photo that fails to load falls back to initials; a new URL retries', async () => {
    mockScheme.mockReturnValue('light');
    const view = render(
      <ThemeProvider>
        <Avatar name="Sana Malik" uri="https://example.test/a.png" testID="av" />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.queryByText('SM')).toBeNull();
    fireEvent(screen.getByTestId('av-photo'), 'error');
    expect(screen.getByText('SM')).toBeTruthy();
    view.rerender(
      <ThemeProvider>
        <Avatar name="Sana Malik" uri="https://example.test/b.png" testID="av" />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('av-photo')).toBeTruthy();
  });

  it.each([
    [32, 13],
    [48, 13],
    [56, 17],
    [72, 17],
    [96, 22],
  ] as const)('initials at %i use a %ipt style', async (size, fontSize) => {
    await renderThemed(<Avatar name="Ayesha Khan" size={size} />);
    expect(flat(screen.getByText('AK').props.style).fontSize).toBe(fontSize);
  });

  it('no photo and no name shows a person glyph, never an empty circle', async () => {
    await renderThemed(<Avatar uri="  " size={56} testID="av" />, 'dark');
    expect(screen.getByText(iconGlyphs.account)).toBeTruthy();
    expect(flat(screen.getByTestId('av').props.style).backgroundColor).toBe(DarkTheme.colors.primarySoft);
  });
});
