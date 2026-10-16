/**
 * UI-R4 kit: TabBar (DESIGN_SYSTEM §5.3 v1.1) and FilterChips (§5.11). Tabs: equal items with
 * role `tab`, the active one selected with the filled glyph on the `primarySoft` pill and a 600
 * `primaryText` label; count badge on the pill; selection haptic on change only; hidden renders
 * nothing; light and dark tokens. FilterChips: one radio group, re-tap is a no-op.
 */
import React from 'react';
import { StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import { ThemeProvider, useAppTheme } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme, componentTokens, textStyles } from '../../../src/theme';
import { FilterChips, TabBar, pillStyleFor, type TabBarItem } from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const flat = (style: StyleProp<ViewStyle & TextStyle>) => StyleSheet.flatten(style) ?? {};

const ITEMS: TabBarItem[] = [
  { key: 'Home', label: 'Home', icon: 'home', activeIcon: 'homeActive' },
  { key: 'Activity', label: 'Activity', icon: 'activity', activeIcon: 'activityActive' },
  {
    key: 'Inbox',
    label: 'Inbox',
    icon: 'inbox',
    activeIcon: 'inboxActive',
    badgeCount: 3,
    badgeAccessibilityLabel: 'Inbox, 3 unread',
  },
  { key: 'Account', label: 'Account', icon: 'accountCircle', activeIcon: 'accountCircleActive' },
];

const renderBar = async (
  props: Partial<React.ComponentProps<typeof TabBar>> = {},
  mode: 'light' | 'dark' = 'light',
) => {
  mockScheme.mockReturnValue(mode);
  const onSelect = jest.fn();
  render(
    <ThemeProvider>
      <TabBar items={ITEMS} activeKey="Home" onSelect={onSelect} accessibilityLabel="Main tabs" {...props} />
    </ThemeProvider>,
  );
  await act(async () => {});
  return { onSelect };
};

beforeEach(() => {
  (HapticFeedback.trigger as jest.Mock).mockClear();
});

describe('TabBar', () => {
  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)(
    '%s: 60 high, surface + hairline, four tabs; active pill, filled glyph, 600 label',
    async (mode, theme) => {
      await renderBar({}, mode);
      const bar = flat(screen.getByTestId('tab-bar').props.style);
      expect(bar.backgroundColor).toBe(theme.colors.surface);
      expect(bar.borderTopColor).toBe(theme.colors.border);
      expect(screen.getByTestId('tab-bar').props.accessibilityRole).toBe('tablist');
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4);
      expect(flat(tabs[0].props.style).minHeight).toBe(componentTokens.tabBar.height);
      expect(screen.getByTestId('tab-Home').props.accessibilityState).toEqual({ selected: true });
      expect(screen.getByTestId('tab-Activity').props.accessibilityState).toEqual({ selected: false });
      // Active: filled glyph in onPrimarySoft on the primarySoft pill; inactive: outline in textMuted.
      expect(screen.getByTestId('tab-Home-icon')).toHaveTextContent('home');
      expect(screen.getByTestId('tab-Activity-icon')).toHaveTextContent('clipboard-text-clock-outline');
      expect(screen.getByTestId('tab-Home-icon').props.color).toBe(theme.colors.onPrimarySoft);
      expect(screen.getByTestId('tab-Activity-icon').props.color).toBe(theme.colors.textMuted);
      expect(flat(screen.getByTestId('tab-Home-pill').props.style).backgroundColor).toBe(theme.colors.primarySoft);
      const activeLabel = flat(screen.getByText('Home').props.style);
      expect(activeLabel.fontWeight).toBe(textStyles.captionStrong.fontWeight);
      expect(activeLabel.color).toBe(theme.colors.primaryText);
      expect(flat(screen.getByText('Activity').props.style).color).toBe(theme.colors.textMuted);
    },
  );

  it('count badge on the Inbox pill, read as "Inbox, 3 unread"; 0 shows no badge', async () => {
    await renderBar();
    expect(screen.getByTestId('tab-Inbox-badge')).toHaveTextContent('3');
    expect(screen.getByTestId('tab-Inbox').props.accessibilityLabel).toBe('Inbox, 3 unread');
    expect(screen.queryByTestId('tab-Home-badge')).toBeNull();
  });

  it('a press selects with the selection haptic; re-tapping the active tab gives no haptic', async () => {
    const { onSelect } = await renderBar();
    fireEvent.press(screen.getByTestId('tab-Activity'));
    expect(onSelect).toHaveBeenLastCalledWith('Activity');
    expect(HapticFeedback.trigger).toHaveBeenCalledWith('selection', expect.anything());
    (HapticFeedback.trigger as jest.Mock).mockClear();
    fireEvent.press(screen.getByTestId('tab-Home'));
    expect(onSelect).toHaveBeenLastCalledWith('Home');
    expect(HapticFeedback.trigger).not.toHaveBeenCalled();
  });

  it('T-548: the pill follows the active tab after a theme switch (resting state from React, CSS transition)', async () => {
    mockScheme.mockReturnValue('light');
    let switchTheme: (mode: 'light' | 'dark') => void = () => {};
    let select: (key: string) => void = () => {};
    function Harness() {
      const { setScheme } = useAppTheme();
      const [active, setActive] = React.useState('Account');
      switchTheme = setScheme;
      select = setActive;
      return <TabBar items={ITEMS} activeKey={active} onSelect={setActive} />;
    }
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    await act(async () => {});
    const pill = (key: string) => flat(screen.getByTestId(`tab-${key}-pill`).props.style);
    const { indicatorWidth, indicatorWidthFrom } = componentTokens.tabBar;
    expect(pill('Account')).toMatchObject({ opacity: 1, width: indicatorWidth });
    expect(pill('Home')).toMatchObject({ opacity: 0, width: indicatorWidthFrom });

    // QA B04: switch the theme on Account, then go to Inbox.
    await act(async () => switchTheme('dark'));
    expect(pill('Account').backgroundColor).toBe(DarkTheme.colors.primarySoft);
    await act(async () => select('Inbox'));
    expect(pill('Inbox')).toMatchObject({ opacity: 1, width: indicatorWidth });
    ITEMS.filter(item => item.key !== 'Inbox').forEach(item => {
      expect(pill(item.key)).toMatchObject({ opacity: 0, width: indicatorWidthFrom });
    });
    // Animated by a transition on the plain style (no shared value whose mount-time value React re-sends).
    expect(pill('Inbox')).toMatchObject({ transitionProperty: ['opacity', 'width'], transitionDuration: 150 });

    await act(async () => switchTheme('light'));
    await act(async () => select('Home'));
    expect(pill('Home')).toMatchObject({ opacity: 1, backgroundColor: LightTheme.colors.primarySoft });
    expect(pill('Inbox').opacity).toBe(0);
    expect(pill('Account').opacity).toBe(0);
    // Reduced motion: the pill appears without animating.
    expect(pillStyleFor(true, true)).toMatchObject({ opacity: 1, transitionDuration: 0 });
  });

  it('hidden renders nothing (incoming request, full-screen flows)', async () => {
    await renderBar({ hidden: true });
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });
});

describe('FilterChips', () => {
  it('is one radio group; changing fires onChange, re-tapping the current value does not', async () => {
    const onChange = jest.fn();
    render(
      <ThemeProvider>
        <FilterChips
          options={[
            { value: 'all', label: 'All' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value="all"
          onChange={onChange}
          accessibilityLabel="Show"
          testID="filter"
        />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('filter').props.accessibilityRole).toBe('radiogroup');
    // One horizontally scrolling line that bleeds to the edges (§5.11 [UI-R4]), never wrapping.
    const scroll = screen.getByTestId('filter-scroll');
    expect(scroll.props.horizontal).toBe(true);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ paddingHorizontal: 16, gap: 8 });
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).flexWrap).toBeUndefined();
    expect(flat(screen.getByTestId('filter').props.style).marginHorizontal).toBe(-16);
    const all = screen.getByRole('radio', { name: 'Show, All' });
    expect(all.props.accessibilityState).toMatchObject({ selected: true, checked: true });
    fireEvent.press(all);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('radio', { name: 'Show, Cancelled' }));
    expect(onChange).toHaveBeenCalledWith('cancelled');
  });
});
