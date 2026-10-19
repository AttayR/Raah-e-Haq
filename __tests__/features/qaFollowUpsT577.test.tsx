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
import { HOME_PEEK_HEIGHT, homePeekHeight } from '../../src/features/passenger-home/components/HomeSheet';
import { WHERE_TO_HEIGHT } from '../../src/features/passenger-home/components/WhereToBar';
import { componentTokens, textStyles } from '../../src/theme';

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
  it('grows by the live block minus "Where to?", so the chip row clears the tab bar', () => {
    expect(homePeekHeight(false)).toBe(HOME_PEEK_HEIGHT);
    expect(homePeekHeight(true)).toBe(
      HOME_PEEK_HEIGHT + componentTokens.button.height.lg + 8 + textStyles.bodySmall.lineHeight - WHERE_TO_HEIGHT,
    );
    expect(homePeekHeight(true)).toBe(202);
  });
});
