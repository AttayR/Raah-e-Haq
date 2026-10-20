/**
 * UI-R15: the pieces of the Activity refresh. ActivitySummary (the slim stats strip), the
 * summary mapping from GET /me/stats, ScrollHairline (edge of pinned controls) and the Header's
 * `inlineTitle` (title in the bar, no empty band).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { componentTokens } from '../../../src/theme';
import { Header, ScrollHairline } from '../../../src/components/ui';
import { ActivitySummary } from '../../../src/features/activity/components/ActivitySummary';
import { toActivitySummary } from '../../../src/features/activity/format';
import type { PassengerStats } from '../../../src/features/stats/types';

const themed = async (node: React.ReactElement) => {
  const result = render(<ThemeProvider>{node}</ThemeProvider>);
  await act(async () => {});
  return result;
};

const stats = (overrides: Partial<PassengerStats> = {}): PassengerStats => ({
  role: 'passenger',
  currency: 'PKR',
  totalRides: 12,
  totalDistanceKm: 84.25,
  totalSpent: 5600,
  rating: 4.86,
  memberSince: null,
  ...overrides,
});

describe('toActivitySummary', () => {
  it('maps the server figures in order with short labels', () => {
    expect(toActivitySummary(stats())).toEqual([
      { key: 'rides', label: 'Rides', value: '12' },
      { key: 'rating', label: 'Rating', value: '4.9' },
      { key: 'distance', label: 'Distance', value: '84.3 km' },
      { key: 'spent', label: 'Spent', value: 'Rs\u00A05,600' },
    ]);
  });

  it('is empty without stats or before the first ride (no row of zeros)', () => {
    expect(toActivitySummary(null)).toEqual([]);
    expect(toActivitySummary(stats({ totalRides: 0 }))).toEqual([]);
  });
});

describe('ActivitySummary', () => {
  it('renders one accessible cell per figure', async () => {
    await themed(<ActivitySummary items={toActivitySummary(stats())} />);
    expect(screen.getByTestId('activity-summary')).toBeTruthy();
    expect(screen.getByLabelText('Rides, 12')).toBeTruthy();
    expect(screen.getByLabelText('Spent, Rs 5,600')).toBeTruthy();
    expect(screen.getByText('84.3 km')).toBeTruthy();
  });

  it('shows a same-height placeholder while loading, and nothing when there is nothing to show', async () => {
    const { rerender, toJSON } = await themed(<ActivitySummary items={[]} loading />);
    expect(screen.getByLabelText('Loading your ride summary')).toBeTruthy();
    rerender(
      <ThemeProvider>
        <ActivitySummary items={[]} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(toJSON()).toBeNull();
  });

  it('values never wrap: one line, the full value in the cell label', async () => {
    await themed(<ActivitySummary items={toActivitySummary(stats())} />);
    const value = screen.getByText('Rs 5,600');
    expect(value.props.numberOfLines).toBe(1);
    expect(screen.getByLabelText('Spent, Rs 5,600')).toBeTruthy();
  });
});

function Hairline({ y }: { y?: number }) {
  const scrollY = useSharedValue(y ?? 0);
  return <ScrollHairline scrollY={y === undefined ? undefined : scrollY} testID="line" />;
}

describe('ActivitySummary height', () => {
  it('the skeleton and the loaded strip share the token height (no jump)', async () => {
    const height = componentTokens.skeleton.heights.activitySummary;
    const { rerender } = await themed(<ActivitySummary items={[]} loading />);
    expect(StyleSheet.flatten(screen.getByTestId('activity-summary-loading').props.style).height).toBe(height);
    rerender(
      <ThemeProvider>
        <ActivitySummary items={toActivitySummary(stats())} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(StyleSheet.flatten(screen.getByTestId('activity-summary').props.style).minHeight).toBe(height);
  });
});

describe('ScrollHairline', () => {
  it('is a hidden-from-a11y hairline, invisible at rest', async () => {
    await themed(<Hairline y={0} />);
    const line = screen.getByTestId('line', { includeHiddenElements: true });
    const style = StyleSheet.flatten(line.props.style);
    expect(style.opacity).toBe(0);
    expect(line.props.accessibilityElementsHidden).toBe(true);
  });

  it('UI-R15b: takes no layout height, so the list under it starts on a whole point', async () => {
    await themed(<Hairline y={0} />);
    const line = screen.getByTestId('line', { includeHiddenElements: true });
    expect(StyleSheet.flatten(screen.getByTestId('line-slot', { includeHiddenElements: true }).props.style).height).toBe(0);
    const style = StyleSheet.flatten(line.props.style);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(-style.height);
  });

  it('renders without a scroll value', async () => {
    await themed(<Hairline />);
    expect(screen.getByTestId('line', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Header inlineTitle', () => {
  it('large + inlineTitle: one h1 title in the bar, no second large-title block', async () => {
    await themed(<Header variant="large" inlineTitle title="Activity" testID="hdr" />);
    expect(screen.getAllByText('Activity')).toHaveLength(1);
    expect(screen.getByRole('header', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByTestId('hdr-title')).toBeTruthy();
  });

  it('large without inlineTitle keeps the title under the bar', async () => {
    await themed(<Header variant="large" title="Inbox" testID="hdr" />);
    expect(screen.getAllByText('Inbox')).toHaveLength(1);
    expect(screen.queryByTestId('hdr-title')).toBeNull();
  });
});
