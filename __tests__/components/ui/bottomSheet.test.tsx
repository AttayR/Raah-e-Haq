/**
 * UI-R3 BottomSheet: snap maths (SE cap, ordering, velocity projection, modal close), map and
 * modal modes, programmatic snaps, keyboard → full, a11y on the handle, light/dark.
 */
import React, { createRef } from 'react';
import { AccessibilityInfo, Keyboard, StyleSheet, Text, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../../src/theme';
import { BottomSheet, Button, type BottomSheetHandle } from '../../../src/components/ui';
import { fullHeight, releaseTarget, resolveSnaps } from '../../../src/components/ui/sheetSnaps';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  const result = render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
  return result;
};
const flat = (style: StyleProp<ViewStyle>): ViewStyle => StyleSheet.flatten(style) ?? {};
const noop = () => {};

describe('snap maths', () => {
  it('full = container − top inset − 8, capped at 88% on short screens', () => {
    expect(fullHeight({ containerHeight: 874, topInset: 62 })).toBe(804);
    expect(fullHeight({ containerHeight: 667, topInset: 20 })).toBeCloseTo(667 * 0.88);
  });

  it('resolves snaps lowest first, drops unknown content and duplicates', () => {
    const snaps = resolveSnaps(['full', 'peek', 'half', 'content'], { containerHeight: 874, topInset: 62, peekHeight: 170 });
    expect(snaps.map(s => s.snap)).toEqual(['peek', 'half', 'full']);
    expect(snaps.map(s => s.height)).toEqual([170, 437, 804]);
  });

  it('[UI-R3] no snap is shorter than handle + header + footer (footer never over the header)', () => {
    // Handle 24 + header 64 + footer 112 = 200 > peek 170.
    const snaps = resolveSnaps(['peek', 'half', 'full'], { containerHeight: 874, topInset: 62, peekHeight: 170, minHeight: 200 });
    expect(snaps.map(s => s.height)).toEqual([200, 437, 804]);
    // Never above full, even with a huge header.
    const tall = resolveSnaps(['peek', 'full'], { containerHeight: 667, topInset: 20, peekHeight: 137, minHeight: 900 });
    expect(tall).toHaveLength(1);
    expect(tall[0].height).toBeCloseTo(667 * 0.88);
  });

  it('content snaps cap at full', () => {
    const [snap] = resolveSnaps(['content'], { containerHeight: 667, topInset: 20, contentHeight: 2000 });
    expect(snap.height).toBeCloseTo(667 * 0.88);
  });

  it('release picks the nearest snap to the projected height', () => {
    const snaps = resolveSnaps(['peek', 'half', 'full'], { containerHeight: 874, topInset: 62, peekHeight: 170 });
    expect(releaseTarget(320, 0, snaps, false)).toMatchObject({ snap: 'half' });
    expect(releaseTarget(290, 0, snaps, false)).toMatchObject({ snap: 'peek' });
    // A fast flick up (negative velocity) projects past half to full.
    expect(releaseTarget(450, -2500, snaps, false)).toMatchObject({ snap: 'full' });
    // A map sheet never closes; it settles at peek.
    expect(releaseTarget(60, 3000, snaps, false)).toMatchObject({ snap: 'peek' });
  });

  it('a modal sheet closes when pulled far below its lowest snap or flicked down', () => {
    const snaps = resolveSnaps(['content'], { containerHeight: 874, topInset: 62, contentHeight: 320 });
    expect(releaseTarget(200, 0, snaps, true)).toBe('close');
    expect(releaseTarget(300, 2000, snaps, true)).toBe('close');
    expect(releaseTarget(300, 100, snaps, true)).toMatchObject({ snap: 'content' });
  });
});

const layout = (node: ReturnType<typeof screen.getByTestId>, height: number) =>
  act(() => {
    fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
  });

/** The container is the sheet's parent absolute-fill view. */
const containerOf = (testID: string) => screen.getByTestId(testID).parent!.parent!;

// The safe-area mock has zero insets, so `full` = 874 − 0 − 8.
const FULL = 866;

describe('BottomSheet (map mode)', () => {
  it('renders handle, header, body and a sticky footer; opens at peek', async () => {
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet
        peekHeight={170}
        onSnapChange={onSnapChange}
        header={<Text>Where to?</Text>}
        footer={<Button label="Choose" onPress={noop} />}
        testID="sheet"
      >
        <Text>Saved places</Text>
      </BottomSheet>,
    );
    await layout(containerOf('sheet'), 874);
    expect(screen.getByText('Where to?')).toBeTruthy();
    expect(screen.getByText('Saved places')).toBeTruthy();
    expect(screen.getByTestId('sheet-footer')).toBeTruthy();
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);
  });

  it('[UI-R3] raises peek so the sticky footer never covers the header', async () => {
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet peekHeight={170} onSnapChange={onSnapChange} header={<Text>Where to?</Text>} footer={<Button label="Choose" onPress={noop} />} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    await layout(containerOf('sheet'), 874);
    await layout(screen.getByTestId('sheet-header'), 64);
    await layout(screen.getByTestId('sheet-footer'), 112);
    // 24 handle area + 64 header + 112 footer.
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 200);
  });

  it('snaps programmatically and scrolls only at the highest snap', async () => {
    const ref = createRef<BottomSheetHandle>();
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet ref={ref} peekHeight={170} onSnapChange={onSnapChange} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    await layout(containerOf('sheet'), 874);
    expect(screen.getByTestId('sheet-scroll').props.scrollEnabled).toBe(false);
    act(() => ref.current?.snapTo('full'));
    expect(onSnapChange).toHaveBeenLastCalledWith('full', FULL);
    expect(screen.getByTestId('sheet-scroll').props.scrollEnabled).toBe(true);
    act(() => ref.current?.close());
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);
  });

  it('the handle is adjustable: increment raises, decrement lowers', async () => {
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet peekHeight={170} onSnapChange={onSnapChange} accessibilityLabel="Where to sheet" testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    await layout(containerOf('sheet'), 874);
    const handle = screen.getByTestId('sheet-handle');
    expect(handle.props.accessibilityRole).toBe('adjustable');
    expect(handle.props.accessibilityLabel).toBe('Where to sheet');
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('half', 437);
    act(() => fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);
  });

  it('goes full while the keyboard is up and returns after', async () => {
    const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (e: { endCoordinates: { height: number } }) => void) => {
      handlers[event] = handler;
      return { remove: noop };
    }) as unknown as typeof Keyboard.addListener);
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet peekHeight={170} onSnapChange={onSnapChange} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    await layout(containerOf('sheet'), 874);
    act(() => handlers.keyboardWillShow({ endCoordinates: { height: 336 } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('full', FULL);
    act(() => handlers.keyboardWillHide({ endCoordinates: { height: 0 } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);
    jest.restoreAllMocks();
  });

  it.each([
    ['light', LightTheme.colors.surface],
    ['dark', DarkTheme.colors.surface],
  ] as const)('fills with surface (%s)', async (mode, fill) => {
    await renderThemed(
      <BottomSheet peekHeight={170} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
      mode,
    );
    expect(flat(screen.getByTestId('sheet').props.style).backgroundColor).toBe(fill);
  });

  it('respects reduced motion (still settles at the snap)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet peekHeight={170} onSnapChange={onSnapChange} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    await layout(containerOf('sheet'), 874);
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);
    jest.restoreAllMocks();
  });
});

describe('BottomSheet (modal mode)', () => {
  it('renders nothing while hidden', async () => {
    await renderThemed(
      <BottomSheet mode="modal" visible={false} testID="m">
        <Text>Reasons</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('Reasons')).toBeNull();
  });

  it('shows over a scrim; tapping the scrim closes it', async () => {
    const onClose = jest.fn();
    await renderThemed(
      <BottomSheet mode="modal" visible onClose={onClose} testID="m">
        <Text>Reasons</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Reasons')).toBeTruthy();
    const scrim = screen.getByTestId('m-scrim');
    expect(scrim.props.accessibilityLabel).toBe('Close');
    act(() => fireEvent.press(scrim));
    expect(onClose).toHaveBeenCalled();
  });
});
