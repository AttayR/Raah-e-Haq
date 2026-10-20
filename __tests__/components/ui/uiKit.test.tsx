/**
 * Minimal UI kit (T-605 / T-618 driver side): variants, states, press handlers, light and dark
 * tokens, and no fixed widths that would overflow a 375pt iPhone SE.
 */
import React from 'react';
import { StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme, MAX_FONT_SIZE_MULTIPLIER } from '../../../src/theme';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  IconButton,
  ListGroup,
  ListItem,
  SegmentedControl,
  StatTile,
  initialsOf,
} from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  // ThemeProvider holds its children until the stored appearance is read (T-601).
  await act(async () => {});
};

type FlatStyle = ViewStyle & TextStyle;
const flat = (style: StyleProp<FlatStyle>): FlatStyle => StyleSheet.flatten(style) ?? {};

describe('AppText', () => {
  it('applies the type style, the colour token and the 1.3x font cap', async () => {
    await renderThemed(<AppText variant="h3" color="textSecondary">Hello</AppText>);
    const text = screen.getByText('Hello');
    expect(flat(text.props.style)).toMatchObject({ fontSize: 20, color: LightTheme.colors.textSecondary });
    expect(text.props.maxFontSizeMultiplier).toBe(MAX_FONT_SIZE_MULTIPLIER);
  });

  it('uses the dark token in dark mode', async () => {
    await renderThemed(<AppText>Dark</AppText>, 'dark');
    expect(flat(screen.getByText('Dark').props.style).color).toBe(DarkTheme.colors.textPrimary);
  });
});

describe('Button', () => {
  it.each([
    ['primary', 'primary'],
    ['secondary', 'primarySoft'],
    ['destructive', 'dangerFill'],
  ] as const)('%s fills with %s', async (variant, token) => {
    await renderThemed(<Button label="Go" variant={variant} onPress={jest.fn()} />);
    expect(flat(screen.getByRole('button', { name: 'Go' }).props.style).backgroundColor).toBe(
      LightTheme.colors[token],
    );
  });

  it('outline and ghost are transparent; outline has a borderStrong border', async () => {
    await renderThemed(
      <>
        <Button label="Outline" variant="outline" onPress={jest.fn()} />
        <Button label="Ghost" variant="ghost" onPress={jest.fn()} />
      </>,
    );
    const outline = flat(screen.getByRole('button', { name: 'Outline' }).props.style);
    expect(outline).toMatchObject({ backgroundColor: 'transparent', borderColor: LightTheme.colors.borderStrong });
    expect(flat(screen.getByRole('button', { name: 'Ghost' }).props.style).borderWidth).toBeUndefined();
  });

  it('presses, and lg is the 56pt driving-screen height', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Go online" size="lg" leadingIcon="power" onPress={onPress} testID="b" />);
    fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flat(screen.getByTestId('b').props.style).minHeight).toBe(56);
  });

  it.each(['light', 'dark'] as const)(
    'disabled (%s, T-545): solid fillDisabled + textDisabled label, no opacity, reported disabled, no press',
    async (mode) => {
      const onPress = jest.fn();
      const theme = mode === 'dark' ? DarkTheme : LightTheme;
      await renderThemed(<Button label="Go" disabled onPress={onPress} testID="b" />, mode);
      const button = screen.getByTestId('b');
      expect(button.props.accessibilityState).toMatchObject({ disabled: true });
      expect(flat(button.props.style).opacity).toBeUndefined();
      expect(flat(button.props.style).backgroundColor).toBe(theme.colors.fillDisabled);
      expect(flat(screen.getByText('Go').props.style).color).toBe(theme.colors.textDisabled);
      fireEvent.press(button);
      expect(onPress).not.toHaveBeenCalled();
    },
  );

  it('disabled ghost/outline: no fill, textDisabled label, outline border softens to border', async () => {
    await renderThemed(
      <>
        <Button label="Ghost" variant="ghost" disabled onPress={jest.fn()} testID="g" />
        <Button label="Outline" variant="outline" disabled onPress={jest.fn()} testID="o" />
      </>,
      'dark',
    );
    expect(flat(screen.getByTestId('g').props.style).backgroundColor).toBe('transparent');
    expect(flat(screen.getByText('Ghost').props.style).color).toBe(DarkTheme.colors.textDisabled);
    expect(flat(screen.getByTestId('o').props.style).borderColor).toBe(DarkTheme.colors.border);
  });

  it('loading keeps the live fill (not the disabled one)', async () => {
    await renderThemed(<Button label="Go" loading onPress={jest.fn()} testID="b" />, 'dark');
    expect(flat(screen.getByTestId('b').props.style).backgroundColor).toBe(DarkTheme.colors.primary);
  });

  it('loading: spinner instead of the label, busy, no press', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Go" loading onPress={onPress} testID="b" />);
    expect(screen.getByTestId('b-spinner')).toBeTruthy();
    expect(screen.queryByText('Go')).toBeNull();
    expect(screen.getByTestId('b').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(screen.getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Card', () => {
  it('elevated: shadow in light, 1pt border (no shadow) in dark', async () => {
    await renderThemed(<Card testID="c" />);
    expect(flat(screen.getByTestId('c').props.style)).toMatchObject({ backgroundColor: LightTheme.colors.surface });
    expect(flat(screen.getByTestId('c').props.style).borderWidth).toBeUndefined();
    screen.unmount();
    await renderThemed(<Card testID="c" />, 'dark');
    expect(flat(screen.getByTestId('c').props.style)).toMatchObject({
      backgroundColor: DarkTheme.colors.surface,
      borderWidth: 1,
      borderColor: DarkTheme.colors.border,
      shadowOpacity: 0,
    });
  });
});

describe('ListItem / ListGroup', () => {
  it('pressable row: chevron, accessible name with subtitle, press handler', async () => {
    const onPress = jest.fn();
    await renderThemed(<ListItem icon="account" title="Profile" subtitle="Edit" onPress={onPress} testID="row" />);
    const row = screen.getByRole('button', { name: 'Profile, Edit' });
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('chevron-right')).toBeTruthy();
    expect(flat(row.props.style).minHeight).toBe(72);
  });

  it('destructive row: danger label, no chevron; disabled does not press', async () => {
    const onPress = jest.fn();
    await renderThemed(<ListItem icon="logout" title="Sign out" destructive disabled onPress={onPress} />);
    expect(flat(screen.getByText('Sign out').props.style).color).toBe(LightTheme.colors.danger);
    expect(screen.queryByText('chevron-right')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('group renders a header and a divider between rows', async () => {
    await renderThemed(
      <ListGroup title="Account" testID="g">
        <ListItem title="A" />
        <ListItem title="B" />
      </ListGroup>,
    );
    expect(screen.getByRole('header', { name: 'Account' })).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('text flexes (no fixed width), so rows fit a 375pt screen', async () => {
    await renderThemed(<ListItem title="A very long settings title that has to wrap on an iPhone SE" />);
    const text = screen.getByText(/A very long/);
    expect(text.props.numberOfLines).toBe(2);
    expect(flat(text.parent?.parent?.props.style).width).toBeUndefined();
  });
});

describe('Badge, Avatar, StatTile', () => {
  it('badge tones use the soft fill + tone text and never shrink', async () => {
    await renderThemed(<Badge label="Verified" tone="success" testID="badge" />, 'dark');
    expect(flat(screen.getByTestId('badge').props.style)).toMatchObject({
      backgroundColor: DarkTheme.colors.successSoft,
      flexShrink: 0,
    });
    expect(flat(screen.getByText('Verified').props.style).color).toBe(DarkTheme.colors.success);
  });

  it('avatar falls back to initials', async () => {
    expect(initialsOf('Test Driver')).toBe('TD');
    expect(initialsOf('  ali  ')).toBe('A');
    expect(initialsOf(null)).toBe('');
    await renderThemed(<Avatar name="Test Driver" size={56} />);
    expect(screen.getByText('TD')).toBeTruthy();
    screen.unmount();
    // A photo that fails to load falls back to the initials, not an empty circle.
    await renderThemed(<Avatar name="Test Driver" uri="https://example.test/missing.png" size={56} testID="av" />);
    // T-594: the initials show while the photo loads, never an empty circle.
    expect(screen.getByText('TD')).toBeTruthy();
    await act(async () => {
      screen.getByTestId('av-photo').props.onError();
    });
    expect(screen.queryByTestId('av-photo')).toBeNull();
    expect(screen.getByText('TD')).toBeTruthy();
  });

  it('stat tile: value shrinks to fit, null shows a dash with an honest label, flex width', async () => {
    await renderThemed(<StatTile icon="rides" value={null} label="Rides" testID="tile" />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByLabelText('Rides: not available yet')).toBeTruthy();
    const tile = flat(screen.getByTestId('tile').props.style);
    expect(tile).toMatchObject({ flex: 1, minWidth: 0 });
    expect(tile.width).toBeUndefined();
    screen.unmount();
    await renderThemed(<StatTile icon="star" value="4.9" label="Rating" />);
    expect(screen.getByText('4.9').props.adjustsFontSizeToFit).toBe(true);
  });
});

describe('IconButton and SegmentedControl', () => {
  it('icon button: labelled, presses, small visuals get a 44pt target', async () => {
    const onPress = jest.fn();
    await renderThemed(<IconButton icon="locate" accessibilityLabel="Locate" size={40} onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Locate' });
    expect(button.props.hitSlop).toBe(2);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('segmented control selects an option', async () => {
    const onChange = jest.fn();
    await renderThemed(
      <SegmentedControl
        accessibilityLabel="Appearance"
        value="system"
        onChange={onChange}
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Appearance, System' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByRole('radio', { name: 'Appearance, Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
