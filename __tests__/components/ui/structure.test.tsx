/**
 * UI-R3 kit structure: Screen (keyboard avoidance, refresh), Header variants, Card variants,
 * ListItem/ListGroup, MapControls. Light and dark tokens, a11y roles/labels, press handlers.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme, componentTokens } from '../../../src/theme';
import {
  Card,
  Header,
  barTitleOpacity,
  largeTitleOpacity,
  LARGE_TITLE_COLLAPSE,
  ListGroup,
  ListItem,
  MapControls,
  Screen,
  keyboardAvoidingProps,
  useHeaderScroll,
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

const flat = (style: StyleProp<ViewStyle & TextStyle>): ViewStyle & TextStyle => StyleSheet.flatten(style) ?? {};
const noop = () => {};

describe('keyboardAvoidingProps', () => {
  it('pads on iOS by the offset above the parent and is off on Android (adjustResize)', () => {
    expect(keyboardAvoidingProps('ios', 59)).toEqual({ behavior: 'padding', enabled: true, keyboardVerticalOffset: 59 });
    expect(keyboardAvoidingProps('ios', -3).keyboardVerticalOffset).toBe(0);
    expect(keyboardAvoidingProps('android', 24)).toEqual({ behavior: undefined, enabled: false, keyboardVerticalOffset: 0 });
  });
});

describe('Screen', () => {
  it('avoids the keyboard by default on scroll screens', async () => {
    await renderThemed(
      <Screen scroll testID="s">
        <Text>body</Text>
      </Screen>,
    );
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props).toMatchObject({ behavior: 'padding', keyboardVerticalOffset: 0 });
    expect(screen.getByTestId('s-keyboard-avoider')).toContainElement(screen.getByText('body'));
  });

  it('has no keyboard avoider on a plain screen unless asked', async () => {
    await renderThemed(
      <Screen>
        <Text>plain</Text>
      </Screen>,
    );
    expect(screen.UNSAFE_queryAllByType(KeyboardAvoidingView)).toHaveLength(0);
  });

  it('opts a non-scroll screen in (chat composer, forms with their own list)', async () => {
    await renderThemed(
      <Screen keyboardAvoiding testID="chat">
        <Text>composer</Text>
      </Screen>,
    );
    expect(screen.getByTestId('chat-keyboard-avoider')).toContainElement(screen.getByText('composer'));
  });

  it('does not count the padded top inset twice (T-540: composer sat ~62 pt above the keyboard)', async () => {
    await renderThemed(
      <SafeAreaInsetsContext.Provider value={{ top: 62, bottom: 34, left: 0, right: 0 }}>
        <Screen keyboardAvoiding testID="chat">
          <Text>composer</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>,
    );
    // The SafeAreaView pads the 62 inset, so it is already in the KAV's onLayout frame.y.
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props).toMatchObject({ behavior: 'padding', keyboardVerticalOffset: 0 });
  });

  it('wires pull to refresh tinted with primary', async () => {
    const onRefresh = jest.fn();
    await renderThemed(
      <Screen scroll refreshing={false} onRefresh={onRefresh}>
        <Text>list</Text>
      </Screen>,
    );
    const refresh = screen.UNSAFE_getByType(RefreshControl);
    expect(refresh.props.tintColor).toBe(LightTheme.colors.primary);
    refresh.props.onRefresh();
    expect(onRefresh).toHaveBeenCalled();
  });

  it('paints the theme background in dark mode', async () => {
    await renderThemed(<Screen testID="dark-screen" />, 'dark');
    expect(flat(screen.getByTestId('dark-screen').props.style).backgroundColor).toBe(DarkTheme.colors.background);
  });
});

describe('Header', () => {
  it('standard: back button, title as header, at most two actions', async () => {
    const onBack = jest.fn();
    const a = jest.fn();
    await renderThemed(
      <Header
        title="Ride details"
        onBack={onBack}
        actions={[
          { icon: 'chat', onPress: a, accessibilityLabel: 'Message' },
          { icon: 'more', onPress: noop, accessibilityLabel: 'More' },
          { icon: 'edit', onPress: noop, accessibilityLabel: 'Edit' },
        ]}
        testID="hdr"
      />,
    );
    expect(screen.getByRole('header', { name: 'Ride details' })).toBeTruthy();
    fireEvent.press(screen.getByTestId('hdr-back'));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByLabelText('Back')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Message'));
    expect(a).toHaveBeenCalled();
    expect(screen.queryByLabelText('Edit')).toBeNull();
  });

  it('standard: one trailing text action', async () => {
    const onPress = jest.fn();
    await renderThemed(<Header title="Inbox" trailingText={{ label: 'Mark all read', onPress }} />);
    fireEvent.press(screen.getByRole('button', { name: 'Mark all read' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('close variant of the back button is labelled Close', async () => {
    await renderThemed(<Header title="Filters" onBack={noop} backIcon="close" />);
    expect(screen.getByLabelText('Close')).toBeTruthy();
  });

  it('large without scroll: h1 title under an empty bar', async () => {
    await renderThemed(<Header variant="large" title="Activity" />);
    const title = screen.getByRole('header', { name: 'Activity' });
    expect(flat(title.props.style)).toMatchObject({ fontSize: LightTheme.typography.h1.fontSize });
    expect(screen.getAllByText('Activity')).toHaveLength(1);
  });

  it('large collapse: the bar title fades in past the collapse range as the h1 fades out', () => {
    expect(barTitleOpacity(0)).toBe(0);
    expect(barTitleOpacity(LARGE_TITLE_COLLAPSE * 0.6)).toBe(0);
    expect(barTitleOpacity(LARGE_TITLE_COLLAPSE * 0.8)).toBeCloseTo(0.5);
    expect(barTitleOpacity(LARGE_TITLE_COLLAPSE)).toBe(1);
    expect(barTitleOpacity(LARGE_TITLE_COLLAPSE + 200)).toBe(1);
    expect(largeTitleOpacity(0)).toBe(1);
    expect(largeTitleOpacity(LARGE_TITLE_COLLAPSE)).toBe(0);
  });

  it('large with scrollY: the bar title is present but hidden from screen readers (the h1 is read)', async () => {
    const Collapsing = () => {
      const { scrollY } = useHeaderScroll();
      return <Header variant="large" title="Inbox" scrollY={scrollY} />;
    };
    await renderThemed(<Collapsing />);
    expect(screen.queryByText('Inbox')).toBeNull();
    expect(screen.getByText('Inbox', { includeHiddenElements: true })).toBeTruthy();
  });

  it('bar fill follows the tone in both modes', async () => {
    await renderThemed(<Header title="T" tone="background" testID="bar" />, 'dark');
    expect(flat(screen.getByTestId('bar').props.style).backgroundColor).toBe(DarkTheme.colors.background);
  });

  it('overlay: floating back, no bar title', async () => {
    const onBack = jest.fn();
    await renderThemed(<Header variant="overlay" title="Map" onBack={onBack} testID="ov" />);
    expect(screen.queryByText('Map')).toBeNull();
    fireEvent.press(screen.getByTestId('ov-back'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('Card', () => {
  it.each(['light', 'dark'] as const)('selected: 2pt primary border + primarySoft fill (%s)', async mode => {
    const theme = mode === 'dark' ? DarkTheme : LightTheme;
    await renderThemed(<Card variant="selected" testID="c" />, mode);
    expect(flat(screen.getByTestId('c').props.style)).toMatchObject({
      borderWidth: 2,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySoft,
    });
  });

  it('pressable: whole card is a button; selected state is exposed', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <Card variant="selected" onPress={onPress} accessibilityLabel="Rickshaw" accessibilityRole="radio" testID="pc">
        <Text>Rickshaw</Text>
      </Card>,
    );
    const card = screen.getByTestId('pc');
    expect(card.props.accessibilityRole).toBe('radio');
    expect(card.props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalled();
  });

  it('disabled pressable card ignores presses', async () => {
    const onPress = jest.fn();
    await renderThemed(<Card onPress={onPress} disabled accessibilityLabel="x" testID="dc" />);
    fireEvent.press(screen.getByTestId('dc'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps the content edge at 16 when a border is added', async () => {
    await renderThemed(<Card variant="outlined" testID="o" />);
    expect(flat(screen.getByTestId('o').props.style).padding).toBe(15);
  });
});

describe('ListItem and ListGroup', () => {
  it('content rows use the title style, 72 min height, and read title, subtitle and meta', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <ListItem variant="content" title="Gulberg to DHA" subtitle="Rs 340" meta="Today" icon="rickshaw" onPress={onPress} testID="row" />,
    );
    expect(flat(screen.getByText('Gulberg to DHA').props.style).fontWeight).toBe(LightTheme.typography.title.fontWeight);
    const row = screen.getByTestId('row');
    expect(row.props.accessibilityLabel).toBe('Gulberg to DHA, Rs 340, Today');
    expect(flat(row.props.style).minHeight).toBe(componentTokens.listItem.minHeight.two);
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });

  it('settings rows show a value before the chevron', async () => {
    await renderThemed(<ListItem title="Appearance" value="System" onPress={noop} testID="v" />);
    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByTestId('v').props.accessibilityLabel).toBe('Appearance, System');
  });

  it('dividers inset to the text start per leading type', async () => {
    const renderGroup = async (inset?: 'tile' | 'icon' | 'none') =>
      renderThemed(
        <View testID="wrap">
          <ListGroup inset={inset} testID="g">
            <ListItem title="A" />
            <ListItem title="B" />
          </ListGroup>
        </View>,
      );
    await renderGroup('icon');
    const divider = screen
      .UNSAFE_getAllByType(View)
      .find(v => flat(v.props.style).marginStart === componentTokens.listItem.dividerInset.icon);
    expect(divider).toBeTruthy();
  });

  it('without an inset prop, each divider follows the content start of the row above (T-540)', async () => {
    await renderThemed(
      <ListGroup testID="g">
        <ListItem title="Allow push" icon="bell" />
        <ListItem title="Ride updates" />
        <ListItem title="Messages" />
        <ListItem title="Plain" icon="bell" iconStyle="plain" />
        <ListItem title="Last" />
      </ListGroup>,
    );
    const inset = (i: number) => flat(screen.getByTestId(`g-divider-${i}`).props.style).marginStart;
    const { dividerInset } = componentTokens.listItem;
    expect(inset(1)).toBe(dividerInset.tile); // under the tile row: aligned with its text
    expect(inset(2)).toBe(dividerInset.none); // icon-less rows: the 16 gutter, not 72
    expect(inset(3)).toBe(dividerInset.none);
    expect(inset(4)).toBe(dividerInset.icon);
  });
});

describe('MapControls', () => {
  it('renders at most back and locate, each labelled', async () => {
    const onBack = jest.fn();
    const onLocate = jest.fn();
    await renderThemed(<MapControls onBack={onBack} onLocate={onLocate} />);
    fireEvent.press(screen.getByLabelText('Back'));
    fireEvent.press(screen.getByLabelText('Show my location'));
    expect(onBack).toHaveBeenCalled();
    expect(onLocate).toHaveBeenCalled();
  });

  it('fades out and stops taking touches while the sheet is at full', async () => {
    await renderThemed(<MapControls onBack={noop} onLocate={noop} hidden testID="mc" />);
    const root = screen.getByTestId('mc', { includeHiddenElements: true });
    expect(root.props.pointerEvents).toBe('none');
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('hides locate when asked (sheet at full)', async () => {
    await renderThemed(<MapControls onLocate={noop} locateHidden />);
    expect(screen.queryByLabelText('Show my location')).toBeNull();
  });
});
