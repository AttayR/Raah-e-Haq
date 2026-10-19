/**
 * T-582 (QA 2026-10-19 bug 1): Home's peek shrinks from 202 to 170 when the ride ends while
 * Booking covers Home. The map sheet must be placed again at the new peek when its screen is
 * shown again, not left at the height it had when the screen was hidden.
 */
import React from 'react';
import { Text, useColorScheme } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet } from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// The stock mock hands out a new shared value on every render, which re-runs every effect that
// depends on one; keep one per hook call, as Reanimated does.
jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  const { useState } = jest.requireActual('react');
  return { ...mock, useSharedValue: (init: unknown) => useState(() => mock.useSharedValue(init))[0] };
});

const CONTAINER = 874;

const layout = (height: number) =>
  act(() => {
    fireEvent(screen.getByTestId('sheet').parent!.parent!, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
    });
  });

/** Sheet tops (container − height) the springs were started towards. */
const springTargets = (spy: jest.SpyInstance) => spy.mock.calls.map(call => call[0] as number);

describe('[T-582] map sheet shown again', () => {
  beforeEach(() => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
  });
  afterEach(() => jest.restoreAllMocks());

  const ui = (peek: number, active: boolean, onSnapChange: jest.Mock) => (
    <ThemeProvider>
      <BottomSheet peekHeight={peek} active={active} onSnapChange={onSnapChange} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>
    </ThemeProvider>
  );

  it('re-places the sheet at the new peek when its screen comes back', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const onSnapChange = jest.fn();
    const view = render(ui(202, true, onSnapChange));
    await act(async () => {});
    await layout(CONTAINER);
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 202);

    // Booking covers Home; the ride ends there and the peek shrinks while Home is hidden.
    view.rerender(ui(202, false, onSnapChange));
    view.rerender(ui(170, false, onSnapChange));
    await act(async () => {});
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);

    // Home is shown again: the sheet springs to the 170 peek once more.
    spring.mockClear();
    view.rerender(ui(170, true, onSnapChange));
    await act(async () => {});
    expect(springTargets(spring)).toEqual([CONTAINER - 170]);
  });

  it('does not move on first show or while it stays on screen', async () => {
    const onSnapChange = jest.fn();
    const view = render(ui(170, true, onSnapChange));
    await act(async () => {});
    await layout(CONTAINER);
    const spring = jest.spyOn(Reanimated, 'withSpring');
    view.rerender(ui(170, true, onSnapChange));
    await act(async () => {});
    expect(spring).not.toHaveBeenCalled();
  });

  it('a hidden sheet is not moved by being hidden', async () => {
    const onSnapChange = jest.fn();
    const view = render(ui(170, true, onSnapChange));
    await act(async () => {});
    await layout(CONTAINER);
    const spring = jest.spyOn(Reanimated, 'withSpring');
    view.rerender(ui(170, false, onSnapChange));
    await act(async () => {});
    expect(spring).not.toHaveBeenCalled();
  });
});
