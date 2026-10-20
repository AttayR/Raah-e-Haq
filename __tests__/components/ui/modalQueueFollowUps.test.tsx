/**
 * T-562: follow-ups to the T-560 one-root-Modal-at-a-time queue.
 * - A sheet that does not want a turn (every map sheet, a closed modal sheet) does not listen to
 *   the queue, so other sheets opening and closing never re-render it.
 * - A drag or snapTo that lands on a snap during a close clears the `closing` guard (or finishes
 *   the close when the parent still wants the sheet closed); before, the sheet stayed up for good.
 * - The root Dialog and the driver cancel sheet (a kit sheet since T-573) take their turn too, and
 *   on iOS keep it until their dismiss animation has finished.
 */
import React, { Profiler, createRef } from 'react';
import { Modal, Text, useColorScheme } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet, type BottomSheetHandle } from '../../../src/components/ui';
import { Dialog, DialogHost } from '../../../src/components/ui/Dialog';
import { MODAL_DISMISS_FALLBACK_MS, modalQueue, useModalTurn } from '../../../src/components/ui/modalQueue';
import { CancelReasonSheet } from '../../../src/components/driver/CancelReasonSheet';
import { confirm, dialog } from '../../../src/core/dialog';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

const noop = () => {};
const layout = (testID: string, height: number) =>
  act(() => {
    fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
  });
const containerOf = (testID: string) => screen.getByTestId(testID).parent!.parent!;

type Finish = (finished?: boolean) => void;
/** Springs that run until the test finishes them; a new spring cancels the running one. */
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

/** A modal sheet holding the turn, as the sheet still up when another Modal is asked for. */
const Blocker = ({ up }: { up: boolean }) => (
  <BottomSheet mode="modal" visible={up} testID="blocker">
    <Text>Blocker body</Text>
  </BottomSheet>
);

beforeEach(() => {
  modalQueue.reset();
});
afterEach(() => {
  act(() => dialog.dismissAll());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('T-562 useModalTurn subscribes only while it wants a turn', () => {
  it('a hook that does not want a turn never re-renders when the queue changes', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useModalTurn(false);
    });
    const before = renders;
    act(() => {
      const a = modalQueue.enter();
      const b = modalQueue.enter();
      modalQueue.leave(a);
      modalQueue.leave(b);
    });
    expect(renders).toBe(before);
  });

  it('a map sheet does not re-render while modal sheets open and close', async () => {
    const onRender = jest.fn();
    const Map = React.memo(() => (
      <Profiler id="map" onRender={onRender}>
        <BottomSheet testID="map">
          <Text>Map body</Text>
        </BottomSheet>
      </Profiler>
    ));
    const view = render(
      <ThemeProvider>
        <Map />
        <Blocker up={false} />
      </ThemeProvider>,
    );
    await act(async () => {});
    onRender.mockClear();
    view.rerender(
      <ThemeProvider>
        <Map />
        <Blocker up />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('Blocker body')).toBeTruthy();
    act(() => {
      modalQueue.leave(modalQueue.enter());
    });
    expect(onRender).not.toHaveBeenCalled();
  });

  it('a waiting hook still gets its turn when the one ahead leaves', () => {
    const ahead = modalQueue.enter();
    const { result } = renderHook(() => useModalTurn(true));
    expect(result.current).toBe(false);
    act(() => modalQueue.leave(ahead));
    expect(result.current).toBe(true);
  });
});

describe('T-562 a drag or snap that takes over a close', () => {
  const Sheet = ({ visible, sheetRef, onClose }: { visible: boolean; sheetRef: React.Ref<BottomSheetHandle>; onClose?: () => void }) => (
    <ThemeProvider>
      <BottomSheet ref={sheetRef} mode="modal" visible={visible} onClose={onClose} snapPoints={['content', 'full']} testID="s">
        <Text>Sheet body</Text>
      </BottomSheet>
    </ThemeProvider>
  );
  const openMeasured = async (springs: ReturnType<typeof holdSprings>) => {
    await act(async () => {});
    fireEvent(containerOf('s'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
    await layout('s-body', 200);
    springs.finish();
  };

  it('clears the closing guard: the parent can still close the sheet afterwards', async () => {
    const springs = holdSprings();
    const ref = createRef<BottomSheetHandle>();
    const onClose = jest.fn();
    const view = render(<Sheet visible sheetRef={ref} onClose={onClose} />);
    await openMeasured(springs);

    act(() => ref.current?.close()); // scrim tap: slides out
    act(() => ref.current?.snapTo('full')); // a state change snaps it back up mid-close
    springs.finish();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Sheet body')).toBeTruthy();

    // Before T-562 `closing` stayed true and this close was ignored: the Modal stayed up.
    view.rerender(<Sheet visible={false} sheetRef={ref} onClose={onClose} />);
    await act(async () => {});
    springs.finish();
    await act(async () => {});
    expect(screen.queryByText('Sheet body')).toBeNull();
  });

  it('a snap during a close the parent asked for finishes the close instead', async () => {
    const springs = holdSprings();
    const ref = createRef<BottomSheetHandle>();
    const view = render(<Sheet visible sheetRef={ref} />);
    await openMeasured(springs);

    view.rerender(<Sheet visible={false} sheetRef={ref} />);
    await act(async () => {});
    act(() => ref.current?.snapTo('full'));
    springs.finish();
    await act(async () => {});
    expect(screen.queryByText('Sheet body')).toBeNull();
  });
});

describe('T-562 raw Modals take their turn', () => {
  it('the root Dialog waits until the sheet that is up has closed', async () => {
    const springs = holdSprings();
    const view = render(
      <ThemeProvider>
        <Blocker up />
        <Dialog visible title="Cancel the ride?" actions={[{ label: 'Yes', onPress: noop }]} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('Blocker body')).toBeTruthy();
    expect(screen.queryByText('Cancel the ride?')).toBeNull();

    view.rerender(
      <ThemeProvider>
        <Blocker up={false} />
        <Dialog visible title="Cancel the ride?" actions={[{ label: 'Yes', onPress: noop }]} />
      </ThemeProvider>,
    );
    await act(async () => {});
    springs.finish();
    await act(async () => {});
    expect(screen.queryByText('Blocker body')).toBeNull();
    expect(screen.getByText('Cancel the ride?')).toBeTruthy();
  });

  it('an answered dialog keeps its turn through the iOS fade-out (onDismiss), then the next sheet presents', async () => {
    jest.useFakeTimers();
    const view = render(
      <ThemeProvider>
        <DialogHost />
        <Blocker up={false} />
      </ThemeProvider>,
    );
    await act(async () => {});
    act(() => {
      confirm({ title: 'Go offline?', confirmLabel: 'Go offline' });
    });
    expect(screen.getByText('Go offline?')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-confirm'));
    });
    // The Dialog's Modal is hidden, not unmounted, so iOS can animate it out.
    expect(screen.UNSAFE_getAllByType(Modal).some(m => m.props.visible === false)).toBe(true);

    view.rerender(
      <ThemeProvider>
        <DialogHost />
        <Blocker up />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.queryByText('Blocker body')).toBeNull(); // the dialog is still fading out
    act(() => {
      jest.advanceTimersByTime(MODAL_DISMISS_FALLBACK_MS);
    });
    await act(async () => {});
    expect(screen.getByText('Blocker body')).toBeTruthy();
  });

  it('a hidden Dialog releases its turn on onDismiss', async () => {
    const Both = ({ dialogUp, sheetUp }: { dialogUp: boolean; sheetUp: boolean }) => (
      <ThemeProvider>
        <Dialog visible={dialogUp} title="Report sent" actions={[{ label: 'Done', onPress: noop }]} />
        <Blocker up={sheetUp} />
      </ThemeProvider>
    );
    const view = render(<Both dialogUp sheetUp={false} />);
    await act(async () => {});
    view.rerender(<Both dialogUp={false} sheetUp />);
    await act(async () => {});
    expect(screen.queryByText('Blocker body')).toBeNull();
    const hidden = screen.UNSAFE_getAllByType(Modal).find(m => m.props.visible === false);
    act(() => hidden?.props.onDismiss());
    await act(async () => {});
    expect(screen.getByText('Blocker body')).toBeTruthy();
  });

  it('the driver cancel sheet waits for the sheet that is up', async () => {
    const springs = holdSprings();
    const Both = ({ sheetUp }: { sheetUp: boolean }) => (
      <ThemeProvider>
        <Blocker up={sheetUp} />
        <CancelReasonSheet visible submitting={false} onSubmit={noop} onClose={noop} />
      </ThemeProvider>
    );
    const view = render(<Both sheetUp />);
    await act(async () => {});
    expect(screen.queryByTestId('cancel-reason-sheet')).toBeNull();
    view.rerender(<Both sheetUp={false} />);
    await act(async () => {});
    springs.finish();
    await act(async () => {});
    expect(screen.getByTestId('cancel-reason-sheet')).toBeTruthy();
  });
});
