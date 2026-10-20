/**
 * UI-R11 kit: CountdownRing (TS9) and the Button `countdown` prop, MetricStrip (R2 #6), and the
 * compact PersonCard of the request rider row.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Button, CountdownRing, MetricStrip, PersonCard } from '../../../src/components/ui';

const hidden = { includeHiddenElements: true } as const;

afterEach(() => {
  jest.useRealTimers();
});

describe('CountdownRing', () => {
  it('shows whole seconds left from the wall-clock start and ticks once a second', () => {
    jest.useFakeTimers();
    jest.setSystemTime(100_000);
    const { getByTestId } = render(<CountdownRing startedAt={100_000 - 4_500} durationMs={20_000} testID="ring" />);
    // 15.5 s left reads 16.
    expect(getByTestId('ring-seconds', hidden).props.children).toBe('16');
    act(() => jest.advanceTimersByTime(500));
    expect(getByTestId('ring-seconds', hidden).props.children).toBe('15');
    act(() => jest.advanceTimersByTime(3_000));
    expect(getByTestId('ring-seconds', hidden).props.children).toBe('12');
  });

  it('paused: frozen; expired: 0', () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const { getByTestId, rerender } = render(<CountdownRing startedAt={0} durationMs={10_000} paused testID="ring" />);
    act(() => jest.advanceTimersByTime(3_000));
    expect(getByTestId('ring-seconds', hidden).props.children).toBe('10');
    rerender(<CountdownRing startedAt={-20_000} durationMs={10_000} testID="ring" />);
    expect(getByTestId('ring-seconds', hidden).props.children).toBe('0');
  });

  it('is decorative (hidden from screen readers)', () => {
    const { getByTestId, queryByTestId } = render(
      <CountdownRing startedAt={Date.now()} durationMs={5_000} testID="ring" />,
    );
    expect(queryByTestId('ring')).toBeNull();
    expect(getByTestId('ring', hidden).props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('Button countdown', () => {
  it('draws the ring at the end and keeps the label; loading hides it; presses still work', () => {
    const onPress = jest.fn();
    const spec = { startedAt: Date.now(), durationMs: 20_000 };
    const { getByTestId, queryByTestId, getByText, rerender } = render(
      <Button label="Accept" size="lg" onPress={onPress} countdown={spec} testID="b" />,
    );
    getByText('Accept');
    getByTestId('b-countdown', hidden);
    fireEvent.press(getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<Button label="Accept" size="lg" onPress={onPress} countdown={spec} loading testID="b" />);
    expect(queryByTestId('b-countdown', hidden)).toBeNull();
    getByTestId('b-spinner', hidden);
  });

  it('without a countdown no ring is drawn', () => {
    const { queryByTestId } = render(<Button label="Go" onPress={jest.fn()} testID="b" />);
    expect(queryByTestId('b-countdown', hidden)).toBeNull();
  });
});

describe('MetricStrip', () => {
  it('one element per cell with its label; nothing without cells', () => {
    const { getByTestId, toJSON, rerender } = render(
      <MetricStrip
        cells={[
          {
            key: 'a',
            value: '3 min',
            label: 'to pickup',
            accessibilityLabel: '3 min to pickup',
            testID: 'm-a',
          },
          { key: 'b', value: '1.2 km', label: 'away', testID: 'm-b' },
        ]}
        testID="strip"
      />,
    );
    expect(getByTestId('m-a').props.children).toBe('3 min');
    expect(getByTestId('m-a-cell').props.accessibilityLabel).toBe('3 min to pickup');
    expect(getByTestId('m-b-cell').props.accessibilityLabel).toBe('1.2 km away');
    rerender(<MetricStrip cells={[]} testID="strip" />);
    expect(toJSON()).toBeNull();
  });
});

describe('PersonCard compact (rider row)', () => {
  it('shows the name, the rating and a suffix on the rating line', () => {
    const { getByTestId, getByText } = render(
      <PersonCard
        variant="plain"
        size="compact"
        name="Ayesha"
        fallbackName="Passenger"
        rating={4.8}
        ratingSuffix="3 passengers"
        nameTestID="n"
        ratingTestID="r"
      />,
    );
    expect(getByTestId('n').props.children).toBe('Ayesha');
    expect(getByTestId('r').props.children).toBe('4.8');
    getByText(' · 3 passengers');
  });
});
