/**
 * T-604: passenger Home pieces: greeting rules, Plus Code stripping, and the sections render
 * at iPhone SE width in light and dark without fixed widths.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import { displayAddress, firstNameOf, greetingFor } from '../../../src/features/passenger-home/greeting';
import { HomeHeader } from '../../../src/features/passenger-home/components/HomeHeader';
import { WhereToBar } from '../../../src/features/passenger-home/components/WhereToBar';
import { OffersRow } from '../../../src/features/passenger-home/components/OffersRow';
import { StatGrid } from '../../../src/features/passenger-home/components/StatGrid';
import { RecentRidesCard } from '../../../src/components/ui/ride/RecentRidesCard';
import type { HomeOffer, HomeRecentRide, HomeStat } from '../../../src/features/passenger-home/types';

// Test fixtures only (the screen renders [] until T-506).
const PLACEHOLDER_STATS: HomeStat[] = [
  { label: 'Total rides', value: '24', icon: 'rides' },
  { label: 'Distance', value: '156 km', icon: 'distance' },
];
const PLACEHOLDER_OFFERS: HomeOffer[] = [
  { id: '1', title: '20% Off First Ride', description: 'Use code WELCOME20', validUntil: 'Dec 31, 2024' },
];
const PLACEHOLDER_RECENT_RIDES: HomeRecentRide[] = [
  { id: '1', from: 'Iqbal Town', to: 'Liberty Market', date: 'Today, 2:30 PM', fare: 'Rs 520', status: 'completed' },
];

let mockTheme: AppTheme = LightTheme;
// iPhone SE window at 1.3x text size.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 667, scale: 2, fontScale: 1.3 }),
}));
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const at = (h: number) => new Date(2026, 9, 11, h, 0, 0);

describe('greetingFor', () => {
  it('follows the time of day, first name only', () => {
    expect(greetingFor(at(8), 'Test Passenger')).toBe('Good morning, Test');
    expect(greetingFor(at(13), 'Test Passenger')).toBe('Good afternoon, Test');
    expect(greetingFor(at(19), 'Test Passenger')).toBe('Good evening, Test');
    expect(greetingFor(at(23), 'Test Passenger')).toBe('Hello, Test');
    expect(greetingFor(at(3), 'Test Passenger')).toBe('Hello, Test');
  });

  it('stands alone without a name', () => {
    expect(greetingFor(at(8), '')).toBe('Good morning');
    expect(firstNameOf(null)).toBeNull();
  });
});

describe('displayAddress', () => {
  it('drops a leading Plus Code', () => {
    expect(displayAddress('G9C5+5F5, Block N Gulberg III, Lahore, Pakistan')).toBe('Block N Gulberg III, Lahore, Pakistan');
    expect(displayAddress('G9C5+5F5 Block N, Lahore')).toBe('Block N, Lahore');
  });

  it('keeps normal addresses and a bare Plus Code', () => {
    expect(displayAddress('Liberty Market, Lahore')).toBe('Liberty Market, Lahore');
    expect(displayAddress('G9C5+5F5')).toBe('G9C5+5F5');
  });
});

describe.each([
  ['light', LightTheme],
  ['dark', DarkTheme],
] as const)('Home sections at iPhone SE width (%s)', (_mode, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('header: greeting, address, profile and inbox buttons', () => {
    const onOpenProfile = jest.fn();
    const onOpenNotifications = jest.fn();
    const { getByText, getByLabelText } = render(
      <HomeHeader
        greeting="Good morning, Test"
        name="Test Passenger"
        location={{ kind: 'address', text: 'Block N Gulberg III, Lahore' }}
        onOpenProfile={onOpenProfile}
        onOpenNotifications={onOpenNotifications}
        onEnableLocation={jest.fn()}
      />,
    );
    expect(getByText('Good morning, Test')).toBeTruthy();
    expect(getByText('Block N Gulberg III, Lahore').props.numberOfLines).toBe(1);
    fireEvent.press(getByLabelText('Open profile'));
    fireEvent.press(getByLabelText('Notifications'));
    expect(onOpenProfile).toHaveBeenCalled();
    expect(onOpenNotifications).toHaveBeenCalled();
  });

  it('header: location off offers "Turn on"', () => {
    const onEnableLocation = jest.fn();
    const { getByText, getByLabelText } = render(
      <HomeHeader
        greeting="Hello"
        location={{ kind: 'denied' }}
        onOpenProfile={jest.fn()}
        onOpenNotifications={jest.fn()}
        onEnableLocation={onEnableLocation}
      />,
    );
    expect(getByText('Location is off')).toBeTruthy();
    fireEvent.press(getByLabelText('Turn on location'));
    expect(onEnableLocation).toHaveBeenCalled();
  });

  it('"Where to?" opens booking', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<WhereToBar onPress={onPress} />);
    fireEvent.press(getByLabelText('Where to? Search destination'));
    expect(onPress).toHaveBeenCalled();
  });

  it('offer cards are window − 48 wide (next card peeks) and hidden when empty', () => {
    const { getByLabelText, toJSON, rerender } = render(<OffersRow offers={PLACEHOLDER_OFFERS} />);
    const card = getByLabelText('20% Off First Ride. Use code WELCOME20');
    expect(RN.StyleSheet.flatten(card.props.style)).toMatchObject({ width: 327 });
    rerender(<OffersRow offers={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('stats grid: two flexible cells per row, no screen-width math', () => {
    const { getByTestId, getByLabelText } = render(<StatGrid stats={PLACEHOLDER_STATS} />);
    const cell = RN.StyleSheet.flatten(getByTestId('home-stat-rides').props.style);
    expect(cell.width).toBeUndefined();
    expect(cell).toMatchObject({ flexGrow: 1, flexBasis: '40%' });
    expect(getByLabelText('Total rides: 24')).toBeTruthy();
  });

  it('sections render nothing for empty lists (no fake data before T-506)', () => {
    expect(render(<StatGrid stats={[]} />).toJSON()).toBeNull();
    expect(render(<RecentRidesCard rides={[]} onSeeAll={jest.fn()} />).toJSON()).toBeNull();
  });

  it('recent rides: rows and "See all"', () => {
    const onSeeAll = jest.fn();
    const { getByText, getByLabelText } = render(<RecentRidesCard rides={PLACEHOLDER_RECENT_RIDES} onSeeAll={onSeeAll} />);
    expect(getByText('Iqbal Town')).toBeTruthy();
    fireEvent.press(getByLabelText('See all rides'));
    expect(onSeeAll).toHaveBeenCalled();
  });
});
