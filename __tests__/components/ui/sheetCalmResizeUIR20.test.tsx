/**
 * UI-R20 (passenger-home § Services S5/S6) kit changes to the map BottomSheet: `halfMinHeight`
 * (Home's half = max(50 %, peek + 180), capped at full), `calmResize` (a peek change while up
 * eases with `motion.base`, no spring; at a higher snap the sheet keeps its height), and an
 * unchanged list of snap heights never re-places the sheet.
 */
import React from 'react';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet } from '../../../src/components/ui';
import { resolveSnaps, sameSnaps } from '../../../src/components/ui/sheetSnaps';
import { motion } from '../../../src/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  const { useState } = jest.requireActual('react');
  return { ...mock, useSharedValue: (init: unknown) => useState(() => mock.useSharedValue(init))[0] };
});

const SE = 667;
const IPHONE_17 = 874;

const layout = (height: number) =>
  act(() => {
    fireEvent(screen.getByTestId('sheet').parent!.parent!, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height } },
    });
  });

describe('[UI-R20] half floor', () => {
  it('half = max(50 %, halfMinHeight), never above full', () => {
    const snaps = ['peek', 'half', 'full'] as const;
    // iPhone SE with the service row: max(333.5, 424) = 424.
    expect(resolveSnaps(snaps, { containerHeight: SE, topInset: 20, peekHeight: 244, halfMinHeight: 424 })).toEqual([
      { snap: 'peek', height: 244 },
      { snap: 'half', height: 424 },
      { snap: 'full', height: SE * 0.88 },
    ]);
    // iPhone 17: 50 % (437) is already taller than 424.
    const tall = resolveSnaps(snaps, { containerHeight: IPHONE_17, topInset: 62, peekHeight: 244, halfMinHeight: 424 });
    expect(tall.find(s => s.snap === 'half')?.height).toBe(437);
    // A floor above full is capped at full (and merges into it).
    const capped = resolveSnaps(snaps, { containerHeight: SE, topInset: 20, peekHeight: 244, halfMinHeight: 900 });
    expect(capped.map(s => s.snap)).toEqual(['peek', 'half']);
    expect(capped[1].height).toBe(SE * 0.88);
  });

  it('sameSnaps compares names and heights', () => {
    expect(sameSnaps([{ snap: 'peek', height: 170 }], [{ snap: 'peek', height: 170 }])).toBe(true);
    expect(sameSnaps([{ snap: 'peek', height: 170 }], [{ snap: 'peek', height: 244 }])).toBe(false);
    expect(sameSnaps([{ snap: 'peek', height: 170 }], [])).toBe(false);
  });
});

describe('[UI-R20] calm resize', () => {
  afterEach(() => jest.restoreAllMocks());

  const ui = (peek: number, onSnapChange: jest.Mock, calm = true, header = 22) => (
    <ThemeProvider>
      <BottomSheet
        peekHeight={peek}
        halfMinHeight={peek + 180}
        calmResize={calm}
        onSnapChange={onSnapChange}
        header={<Text style={{ height: header }}>Header</Text>}
        testID="sheet"
      >
        <Text>Body</Text>
      </BottomSheet>
    </ThemeProvider>
  );

  it('at peek, a new peek eases there with motion.base (no spring)', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const onSnapChange = jest.fn();
    const view = render(ui(170, onSnapChange));
    await act(async () => {});
    await layout(IPHONE_17);
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);
    spring.mockClear();
    timing.mockClear();
    view.rerender(ui(244, onSnapChange));
    await act(async () => {});
    expect(spring).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalledWith(IPHONE_17 - 244, expect.objectContaining({ duration: motion.base.duration }));
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 244);
  });

  it('without calmResize the sheet springs as before', async () => {
    // Spied before the render: the sheet's worklets capture the function when they are made.
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const onSnapChange = jest.fn();
    const view = render(ui(170, onSnapChange, false));
    await act(async () => {});
    await layout(IPHONE_17);
    spring.mockClear();
    view.rerender(ui(244, onSnapChange, false));
    await act(async () => {});
    expect(spring.mock.calls.map(call => call[0])).toEqual([IPHONE_17 - 244]);
  });

  it('at half the sheet keeps its height; the new half applies on the next snap', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const onSnapChange = jest.fn();
    const view = render(ui(170, onSnapChange));
    await act(async () => {});
    await layout(SE);
    const handle = screen.getByTestId('sheet-handle');
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    // Ride-only on SE: half = max(333.5, 350) = 350.
    expect(onSnapChange).toHaveBeenLastCalledWith('half', 350);

    onSnapChange.mockClear();
    spring.mockClear();
    timing.mockClear();
    view.rerender(ui(244, onSnapChange));
    await act(async () => {});
    expect(onSnapChange).not.toHaveBeenCalled();
    expect(spring).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();

    // Down to peek and up again: the new heights.
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 244);
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('half', 424);
  });

  it('a header that re-measures without moving any snap height does not re-place the sheet', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const onSnapChange = jest.fn();
    render(ui(244, onSnapChange));
    await act(async () => {});
    await layout(IPHONE_17);
    spring.mockClear();
    timing.mockClear();
    act(() => {
      fireEvent(screen.getByTestId('sheet-header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 60 } } });
    });
    act(() => {
      fireEvent(screen.getByTestId('sheet-header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 96 } } });
    });
    await act(async () => {});
    expect(spring).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });
});
