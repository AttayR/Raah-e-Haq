/**
 * T-560: modal BottomSheets on iOS.
 * - A `content` sheet with only a header and a footer (the women-mode "Keep waiting / Allow any
 *   driver" sheet) measures its header inside a full-height sheet, not a 0-high one, so it opens.
 * - Top-level modal sheets take turns: a sheet asked for while another is still up (sliding out)
 *   waits until that one has unmounted its Modal (iOS refuses a second root Modal).
 * - A close is never cancelled by the keyboard going down or a re-measure, so the Modal always
 *   unmounts (the parcel code sheet left an invisible Modal over the driver screen).
 */
import React from 'react';
import { Keyboard, StyleSheet, Text, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet, Button } from '../../../src/components/ui';
import { ModalRoot } from '../../../src/components/ui/ModalRoot';
import { modalQueue } from '../../../src/components/ui/modalQueue';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

const noop = () => {};
const flat = (style: StyleProp<ViewStyle>): ViewStyle => StyleSheet.flatten(style) ?? {};
const layout = (testID: string, height: number) =>
  act(() => {
    fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
  });
const containerOf = (testID: string) => screen.getByTestId(testID).parent!.parent!;
// Zero safe-area insets in tests: full = 874 − 0 − 8.
const FULL = 866;

type Finish = (finished?: boolean) => void;
/**
 * Springs that run until the test finishes them, like the real ones: a new spring on the same
 * sheet cancels the running one (its callback gets `false`).
 */
const holdSprings = () => {
  let running: Finish | null = null;
  jest.spyOn(Reanimated, 'withSpring').mockImplementation(((toValue: number, _config: unknown, callback?: Finish) => {
    const previous = running;
    running = callback ?? null;
    previous?.(false);
    return toValue;
  }) as unknown as typeof Reanimated.withSpring);
  return {
    finish: () => {
      const done = running;
      running = null;
      act(() => done?.(true));
    },
  };
};

const Sheets = ({ a, b }: { a: boolean; b: boolean }) => (
  <ThemeProvider>
    <BottomSheet mode="modal" visible={a} header={<Text>A header</Text>} footer={<Button label="A confirm" onPress={noop} />} testID="a">
      <Text>A body</Text>
    </BottomSheet>
    <BottomSheet mode="modal" visible={b} header={<Text>B header</Text>} testID="b">
      <Text>B body</Text>
    </BottomSheet>
  </ThemeProvider>
);

beforeEach(() => {
  modalQueue.reset();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('T-560 modal BottomSheet', () => {
  it('a header-and-footer sheet lays out at full height until it is measured, then opens at its content height', async () => {
    const onSnapChange = jest.fn();
    render(
      <ThemeProvider>
        <BottomSheet
          mode="modal"
          visible
          onSnapChange={onSnapChange}
          header={<Text>No female driver yet</Text>}
          footer={<Button label="Keep waiting" onPress={noop} />}
          testID="w"
        >
          {null}
        </BottomSheet>
      </ThemeProvider>,
    );
    await act(async () => {});
    await layout('w-scroll', 0);
    fireEvent(containerOf('w'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
    await act(async () => {});
    // Nothing measured yet: the (off-screen) sheet must give its header room to lay out. At
    // height 0 the header measured 0 on iOS and the sheet never resolved a snap.
    expect(flat(screen.getByTestId('w').props.style).height).toBe(FULL);
    expect(onSnapChange).not.toHaveBeenCalled();
    await layout('w-header', 70);
    await layout('w-footer', 120);
    // 24 handle area + 70 header + 120 footer.
    expect(onSnapChange).toHaveBeenLastCalledWith('content', 214);
    expect(flat(screen.getByTestId('w').props.style).height).toBe(214);
  });

  it('a sheet asked for while another is sliding out waits until that one has unmounted its Modal', async () => {
    const springs = holdSprings();
    const view = render(<Sheets a b={false} />);
    await act(async () => {});
    expect(screen.getByText('A body')).toBeTruthy();

    // The parcel is delivered: the code sheet closes and the rating sheet opens in one render.
    view.rerender(<Sheets a={false} b />);
    await act(async () => {});
    expect(screen.getByText('A body')).toBeTruthy(); // still sliding out
    expect(screen.queryByText('B body')).toBeNull(); // iOS would refuse to present it now

    springs.finish(); // A's close animation ends: its Modal unmounts
    await act(async () => {});
    expect(screen.queryByText('A body')).toBeNull();
    expect(screen.getByText('B body')).toBeTruthy();
  });

  it('a sheet that never got its turn closes without waiting for an animation', async () => {
    holdSprings();
    const view = render(<Sheets a b={false} />);
    await act(async () => {});
    view.rerender(<Sheets a b />);
    await act(async () => {});
    expect(screen.queryByText('B body')).toBeNull();
    view.rerender(<Sheets a b={false} />);
    await act(async () => {});
    view.rerender(<Sheets a={false} b={false} />);
    await act(async () => {});
    // B left the queue at once; nothing of it is left to present later.
    expect(screen.queryByText('B body')).toBeNull();
  });

  it('the keyboard going down during the close does not cancel it: the Modal still unmounts', async () => {
    const springs = holdSprings();
    const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (e: { endCoordinates: { height: number } }) => void) => {
      handlers[event] = handler;
      return { remove: noop };
    }) as unknown as typeof Keyboard.addListener);
    const view = render(<Sheets a b={false} />);
    await act(async () => {});
    fireEvent(containerOf('a'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
    await layout('a-header', 60);
    await layout('a-body', 120);
    await layout('a-footer', 120);
    act(() => handlers.keyboardWillShow({ endCoordinates: { height: 300 } })); // number pad up
    springs.finish();

    view.rerender(<Sheets a={false} b={false} />); // code accepted: the sheet closes
    await act(async () => {});
    act(() => handlers.keyboardWillHide({ endCoordinates: { height: 0 } })); // the field blurs mid-close
    await act(async () => {});
    springs.finish();
    await act(async () => {});
    expect(screen.queryByText('A body')).toBeNull();
    expect(screen.queryByTestId('a-scrim')).toBeNull();
  });

  it('a sheet inside another Modal does not wait for its parent to close', async () => {
    render(
      <ThemeProvider>
        <BottomSheet mode="modal" visible testID="outer">
          <Text>Outer body</Text>
        </BottomSheet>
        <ModalRoot>
          <BottomSheet mode="modal" visible testID="inner">
            <Text>Inner body</Text>
          </BottomSheet>
        </ModalRoot>
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('Outer body')).toBeTruthy();
    expect(screen.getByText('Inner body')).toBeTruthy();
  });
});
