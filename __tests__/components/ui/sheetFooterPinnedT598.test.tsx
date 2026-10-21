/**
 * T-598 (QA 2026-10-21 bug 2): on the driver's trip receipt, a star tap adds the tags and the
 * comment, so the receipt's `content` snap grows. The sheet starts that growth at its old height,
 * and the sticky footer followed it: "Cash collected" dropped by the growth (~100-250 pt on the
 * simulator) for ~0.2 s and a tap there landed on the sheet body. The footer now follows the
 * sheet only while it opens, is dragged or closes; a growing placement leaves it pinned.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet, Button } from '../../../src/components/ui';
import { footerDrop } from '../../../src/components/ui/sheetSnaps';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// One shared value per hook call for the component's life (the stock mock makes a new one per
// render), so `top` keeps the sheet's position between renders as on the UI thread.
jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  const { useState } = jest.requireActual('react');
  return { ...mock, useSharedValue: (init: unknown) => useState(() => mock.useSharedValue(init))[0] };
});

const CONTAINER = 874;
const noop = () => {};
const flat = (style: StyleProp<ViewStyle>): ViewStyle => StyleSheet.flatten(style) ?? {};
const layout = (node: Parameters<typeof fireEvent>[0], height: number) =>
  act(() => {
    fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
  });
const footerShift = (testID: string): number => {
  const transform = flat(screen.getByTestId(`${testID}-footer`).props.style).transform as Array<{ translateY?: number }> | undefined;
  return transform?.find(t => t.translateY !== undefined)?.translateY ?? 0;
};

describe('[T-598] footerDrop', () => {
  it('follows the sheet below its lowest snap only while following', () => {
    // Opening / dragged / closing: 120 below the lowest snap's top (874 − 400 = 474).
    expect(footerDrop(594, CONTAINER, 400, true)).toBe(120);
    // Above the lowest snap (a higher snap, an overshoot) the footer never rises past its place.
    expect(footerDrop(300, CONTAINER, 400, true)).toBe(0);
    // A placement that grew the lowest snap from 400 to 600: the sheet is still at 474.
    expect(footerDrop(474, CONTAINER, 600, false)).toBe(0);
  });
});

describe('[T-598] BottomSheet sticky footer', () => {
  const ui = (testID: string) => (
    <ThemeProvider>
      <BottomSheet snapPoints={['content']} header={<Text>Trip complete</Text>} footer={<Button label="Cash collected" onPress={noop} />} testID={testID}>
        <View />
      </BottomSheet>
    </ThemeProvider>
  );

  it('stays pinned while a content snap grows (stars add the tags and the comment)', async () => {
    const onSnapChange = jest.fn();
    render(
      <ThemeProvider>
        <BottomSheet
          snapPoints={['content']}
          onSnapChange={onSnapChange}
          header={<Text>Trip complete</Text>}
          footer={<Button label="Cash collected" onPress={noop} />}
          testID="receipt"
        >
          <View />
        </BottomSheet>
      </ThemeProvider>,
    );
    await act(async () => {});
    await layout(screen.getByTestId('receipt').parent!.parent!, CONTAINER);
    await layout(screen.getByTestId('receipt-header'), 60);
    await layout(screen.getByTestId('receipt-footer'), 98);
    await layout(screen.getByTestId('receipt-body'), 200);
    // 24 handle area + 60 header + 200 body + 98 footer.
    expect(onSnapChange).toHaveBeenLastCalledWith('content', 382);
    expect(footerShift('receipt')).toBe(0);

    // The star tap: the body grows by 200, the sheet still stands at 382 in this render.
    await layout(screen.getByTestId('receipt-body'), 400);
    expect(footerShift('receipt')).toBe(0);
    expect(onSnapChange).toHaveBeenLastCalledWith('content', 582);
  });

  it('still starts below the screen with the sheet before the first placement', async () => {
    render(ui('opening'));
    await act(async () => {});
    // Not measured yet: the sheet waits off-screen and the footer with it.
    expect(footerShift('opening')).toBeGreaterThan(CONTAINER);
  });
});
