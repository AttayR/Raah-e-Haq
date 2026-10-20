/**
 * T-577 (QA 2026-10-19 small fixes): re-tapping the selected tab scrolls its list to the top,
 * the ride stepper's labels stay on one line in English and Roman Urdu, and Home's peek grows
 * with "Return to your ride" so the chip row is not cut off by the tab bar.
 */
import React from 'react';
import { FlatList, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TabScrollToTop } from '../../src/hooks/TabScrollToTop';
import { RideProgress } from '../../src/components/ui';
import { setLocale, t } from '../../src/i18n';
import { HOME_HEADER_ESTIMATE, HOME_PEEK_GROUP_ESTIMATE, homePeekHeight } from '../../src/features/passenger-home/layout';
import { componentTokens, space, textStyles } from '../../src/theme';

describe('TabScrollToTop', () => {
  const scrollToOffset = jest.fn();
  const listRef = { current: { scrollToOffset } };

  function ListTab() {
    return (
      <>
        <TabScrollToTop scrollRef={listRef} />
        <Text>Rides list</Text>
      </>
    );
  }
  const OtherTab = () => <Text>Other tab</Text>;
  const Tabs = createBottomTabNavigator();

  beforeEach(() => {
    scrollToOffset.mockClear();
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('re-tapping the selected tab scrolls its list to the top; switching tabs does not', async () => {
    render(
      <NavigationContainer>
        <Tabs.Navigator>
          <Tabs.Screen name="Activity" component={ListTab} />
          <Tabs.Screen name="Other" component={OtherTab} />
        </Tabs.Navigator>
      </NavigationContainer>,
    );
    await act(async () => undefined);
    fireEvent.press(screen.getByRole('button', { name: /Activity/ }));
    await act(async () => undefined);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });

    scrollToOffset.mockClear();
    fireEvent.press(screen.getByRole('button', { name: /Other/ }));
    await act(async () => undefined);
    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it('outside a navigator (a list rendered on its own) it renders nothing and does not throw', () => {
    const ref = React.createRef<FlatList<number>>();
    render(
      <>
        <TabScrollToTop scrollRef={ref} />
        <Text>Alone</Text>
      </>,
    );
    expect(screen.getByText('Alone')).toBeTruthy();
  });
});

describe('RideProgress labels', () => {
  afterEach(() => setLocale('en'));

  it.each(['en', 'ur-Latn'] as const)('stay on one line in %s (Arrived step current)', locale => {
    setLocale(locale);
    render(<RideProgress step={2} testID="rp" />);
    const arrived = screen.getByTestId('rp-label-2', { includeHiddenElements: true });
    expect(arrived.props.children).toBe(t('ride.stepArrived'));
    expect(arrived.props.numberOfLines).toBe(1);
    expect(arrived.props.adjustsFontSizeToFit).toBe(true);
  });

  it('Roman Urdu "Arrived" is short enough for a quarter of the row (was "Pohanch gaya")', () => {
    setLocale('ur-Latn');
    expect(t('ride.stepArrived')).toBe('Aa gaya');
    expect(t('ride.stepArrived').length).toBeLessThanOrEqual('Request hui'.length);
  });
});

describe('Home peek with "Return to your ride"', () => {
  it('the live block sits above the chips, so the chip row clears the tab bar (UI-R20b: 198)', () => {
    // UI-R20b V1: live header = greeting (no tagline) + 12; group = Return + 8 + status + 12 + chips + 12.
    expect(HOME_HEADER_ESTIMATE.live).toBe(textStyles.title.lineHeight + space[3]);
    expect(HOME_PEEK_GROUP_ESTIMATE.live).toBe(
      componentTokens.button.height.lg + space[2] + textStyles.bodySmall.lineHeight + space[3] + componentTokens.chip.height + space[3],
    );
    expect(homePeekHeight({ headerHeight: HOME_HEADER_ESTIMATE.live, peekGroupHeight: HOME_PEEK_GROUP_ESTIMATE.live })).toBe(198);
  });
});
