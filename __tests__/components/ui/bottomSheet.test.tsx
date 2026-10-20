/**
 * UI-R3 BottomSheet: snap maths (SE cap, ordering, velocity projection, modal close), map and
 * modal modes, programmatic snaps, keyboard → full, a11y on the handle, light/dark.
 */
import React, { Profiler, createRef } from 'react';
import { AccessibilityInfo, BackHandler, Keyboard, ScrollView, StyleSheet, Text, TextInput, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme, layout as layoutTokens } from '../../../src/theme';
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

  it('[UI-R4] Android back collapses a raised sheet only while its screen is active', async () => {
    let backHandler: (() => boolean) | null = null;
    const addBack = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, handler: () => boolean) => {
      backHandler = handler;
      return { remove: () => { backHandler = null; } };
    }) as unknown as typeof BackHandler.addEventListener);
    const addKeyboard = jest.spyOn(Keyboard, 'addListener');
    const ref = createRef<BottomSheetHandle>();
    const onSnapChange = jest.fn();
    const sheet = (active: boolean) => (
      <ThemeProvider>
        <BottomSheet ref={ref} peekHeight={170} active={active} onSnapChange={onSnapChange} testID="sheet">
          <Text>Body</Text>
        </BottomSheet>
      </ThemeProvider>
    );
    mockScheme.mockReturnValue('light');
    const view = render(sheet(true));
    await act(async () => {});
    await layout(containerOf('sheet'), 874);
    act(() => ref.current?.snapTo('half'));
    expect(backHandler).not.toBeNull();
    let handled = false;
    act(() => {
      handled = backHandler ? backHandler() : false;
    });
    expect(handled).toBe(true);
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 170);

    // Another tab or a pushed screen covers it: no back handler, no keyboard listeners.
    act(() => ref.current?.snapTo('half'));
    addBack.mockClear();
    addKeyboard.mockClear();
    view.rerender(sheet(false));
    await act(async () => {});
    expect(backHandler).toBeNull();
    expect(addBack).not.toHaveBeenCalled();
    expect(addKeyboard).not.toHaveBeenCalled();
    jest.restoreAllMocks();
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

describe('[UI-R20b] body height only where a snap depends on it', () => {
  // Safe-area mock: zero bottom inset.
  const footerBottom = Math.max(layoutTokens.bottomActionOffset, layoutTokens.bottomActionMinOffset);

  it('a peek/full sheet without peekHeight sizes peek from the measured body (peek = content)', async () => {
    const ref = createRef<BottomSheetHandle>();
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet ref={ref} snapPoints={['peek', 'full']} onSnapChange={onSnapChange} testID="sheet">
        <Text>Body</Text>
      </BottomSheet>,
    );
    await layout(containerOf('sheet'), 874);
    await layout(screen.getByTestId('sheet-body'), 200);
    act(() => ref.current?.snapTo('full'));
    act(() => ref.current?.close());
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 24 + 200 + footerBottom);
    await layout(screen.getByTestId('sheet-body'), 300.4);
    act(() => ref.current?.snapTo('full'));
    act(() => ref.current?.close());
    expect(onSnapChange).toHaveBeenLastCalledWith('peek', 24 + 300 + footerBottom);
  });

  it('a peek/half/full sheet with a numeric peek does not re-render when its body height changes', async () => {
    const onRender = jest.fn();
    await renderThemed(
      <Profiler id="sheet" onRender={onRender}>
        <BottomSheet peekHeight={274} snapPoints={['peek', 'half', 'full']} testID="sheet">
          <Text>Body</Text>
        </BottomSheet>
      </Profiler>,
    );
    await layout(containerOf('sheet'), 874);
    await layout(screen.getByTestId('sheet-body'), 400);
    const commits = onRender.mock.calls.length;
    // Home's service row easing 0 ↔ 84: the body re-lays out on every frame.
    await layout(screen.getByTestId('sheet-body'), 420);
    await layout(screen.getByTestId('sheet-body'), 484);
    expect(onRender.mock.calls.length).toBe(commits);
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

  it('[T-519] a content sheet grows above the keyboard and scrolls the focused field into view', async () => {
    const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (e: { endCoordinates: { height: number } }) => void) => {
      handlers[event] = handler;
      return { remove: noop };
    }) as unknown as typeof Keyboard.addListener);
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const onSnapChange = jest.fn();
    await renderThemed(
      <BottomSheet mode="modal" visible onSnapChange={onSnapChange} header={<Text>Rate</Text>} footer={<Button label="Submit" onPress={noop} />} testID="m">
        <Text>Stars and comment</Text>
      </BottomSheet>,
    );
    await layout(containerOf('m'), 874);
    await layout(screen.getByTestId('m-header'), 60);
    await layout(screen.getByTestId('m-footer'), 132);
    await layout(screen.getByTestId('m-body'), 500);
    // 24 handle + 60 header + 500 body + 132 footer = 716.
    expect(onSnapChange).toHaveBeenLastCalledWith('content', 716);

    // The keyboard covers 336 of it: the sheet grows by that much, capped at full (866).
    act(() => handlers.keyboardWillShow({ endCoordinates: { height: 336 } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('content', FULL);

    // The focused field (y 300, 120 tall) is scrolled so its bottom sits above the footer:
    // visible body = 866 − 24 − 60 − 132 − 336 = 314, so y = 300 + 120 + 8 − 314 = 114.
    const field = { measureLayout: (_: unknown, ok: (x: number, y: number, w: number, h: number) => void) => ok(0, 300, 358, 120) };
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(field as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>);
    act(() => handlers.keyboardDidShow({ endCoordinates: { height: 336 } }));
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ y: 114 }));

    act(() => handlers.keyboardWillHide({ endCoordinates: { height: 0 } }));
    expect(onSnapChange).toHaveBeenLastCalledWith('content', 716);
    jest.restoreAllMocks();
  });

  it('[T-519] ignores a focused field outside the sheet', async () => {
    const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (e: { endCoordinates: { height: number } }) => void) => {
      handlers[event] = handler;
      return { remove: noop };
    }) as unknown as typeof Keyboard.addListener);
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    scrollTo.mockClear();
    await renderThemed(
      <BottomSheet mode="modal" visible testID="m">
        <Text>Body</Text>
      </BottomSheet>,
    );
    await layout(containerOf('m'), 874);
    await layout(screen.getByTestId('m-body'), 200);
    const field = { measureLayout: (_: unknown, ok: (x: number, y: number, w: number, h: number) => void) => ok(0, -400, 358, 48) };
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(field as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>);
    act(() => handlers.keyboardDidShow({ endCoordinates: { height: 336 } }));
    expect(scrollTo).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});

describe('[UI-R12] footer divider and focus reveal room', () => {
  it('focusRevealExtra keeps the line under a focused field (its counter) above the footer', async () => {
    const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (e: { endCoordinates: { height: number } }) => void) => {
      handlers[event] = handler;
      return { remove: noop };
    }) as unknown as typeof Keyboard.addListener);
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await renderThemed(
      <BottomSheet mode="modal" visible focusRevealExtra={20} header={<Text>Rate</Text>} footer={<Button label="Submit" onPress={noop} />} testID="m">
        <Text>Stars and comment</Text>
      </BottomSheet>,
    );
    await layout(containerOf('m'), 874);
    await layout(screen.getByTestId('m-header'), 60);
    await layout(screen.getByTestId('m-footer'), 132);
    await layout(screen.getByTestId('m-body'), 500);
    act(() => handlers.keyboardWillShow({ endCoordinates: { height: 336 } }));
    const field = { measureLayout: (_: unknown, ok: (x: number, y: number, w: number, h: number) => void) => ok(0, 300, 358, 120) };
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(field as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>);
    act(() => handlers.keyboardDidShow({ endCoordinates: { height: 336 } }));
    // As the T-519 case (114) plus the 20 pt counter line.
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ y: 134 }));
    jest.restoreAllMocks();
  });

  it('footerDivider draws a hairline above the footer only while content runs on under it', async () => {
    await renderThemed(
      <BottomSheet mode="modal" visible footerDivider footer={<Button label="Done" onPress={noop} />} testID="m">
        <Text>Receipt</Text>
      </BottomSheet>,
    );
    await layout(containerOf('m'), 874);
    const scroll = screen.getByTestId('m-scroll');
    act(() => {
      fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 400 } } });
      fireEvent(scroll, 'contentSizeChange', 390, 700);
    });
    expect(flat(screen.getByTestId('m-footer').props.style).borderTopWidth).toBeGreaterThan(0);
    act(() => {
      fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 300 }, layoutMeasurement: { height: 400 }, contentSize: { height: 700 } } });
    });
    expect(flat(screen.getByTestId('m-footer').props.style).borderTopWidth).toBeUndefined();
  });

  it('a sheet without footerDivider sends no scroll events to JS', async () => {
    await renderThemed(
      <BottomSheet mode="modal" visible footer={<Button label="Done" onPress={noop} />} testID="m">
        <Text>Body</Text>
      </BottomSheet>,
    );
    const scroll = screen.getByTestId('m-scroll');
    expect(scroll.props.onScroll).toBeUndefined();
    expect(scroll.props.onContentSizeChange).toBeUndefined();
    expect(scroll.props.scrollEventThrottle).toBeUndefined();
  });
});
