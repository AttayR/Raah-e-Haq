/**
 * T-573: the driver cancel / no-show sheet must never cancel a ride from a tap that was not
 * meant for its destructive button (QA 2026-10-18 bug 1: parcel #236 cancelled as a no-show with
 * a Rs 30 fee by a tap ~0.1 s after "Keep ride").
 * - From "Keep ride" (or any close) the sliding-out sheet takes no touches and never submits.
 * - Reopened mid-slide, or freshly risen, the destructive button ignores taps until the sheet
 *   has had time to settle (a tap aimed at the panel beneath, or at "Keep ride", lands on it).
 * - One tap, one cancel: a double tap sends one request.
 * - Hardening: never armed before the sheet is first placed; a mid-slide reopen is armed once
 *   (a later re-measure does not re-arm it); a cancel in flight cannot be dismissed.
 */
import React, { useState } from 'react';
import { Modal, Pressable, Text, useColorScheme } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { CancelReasonSheet } from '../../../src/components/driver/CancelReasonSheet';
import { modalQueue } from '../../../src/components/ui/modalQueue';
import type { DriverCancelMode } from '../../../src/features/driver-ride/noShow';
import { motionPatterns } from '../../../src/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

type Finish = (finished?: boolean) => void;
/** Springs that run until the test finishes them (the sheet is "still sliding"). */
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

let now = 1_000_000;
const advance = (ms: number) => {
  now += ms;
};

const layout = (testID: string, height: number) =>
  act(() => {
    fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
  });

/** The closest host view above the sheet that sets `pointerEvents` (the sheet's touch gate). */
const touchGateOf = (testID: string): string | undefined => {
  let node = screen.getByTestId(testID).parent;
  while (node) {
    if (typeof node.props.pointerEvents === 'string') return node.props.pointerEvents;
    node = node.parent;
  }
  return undefined;
};

/** Measures the sheet (it settles on a snap) and lets its arming window pass. */
const place = () => {
  const sheet = screen.getByTestId('cancel-reason-sheet');
  act(() => {
    fireEvent(sheet.parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
    fireEvent(screen.getByTestId('cancel-reason-sheet-body'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 260 } } });
  });
  advance(motionPatterns.destructiveArmMs);
};

/** The driver ride screen in miniature: the panel's "No-show" opens the sheet, Keep closes it. */
const Host = ({ onSubmit }: { onSubmit: (note: string) => void }) => {
  const [mode, setMode] = useState<DriverCancelMode | null>(null);
  return (
    <ThemeProvider>
      <Pressable onPress={() => setMode('no_show')} testID="panel-no-show">
        <Text>No-show</Text>
      </Pressable>
      <CancelReasonSheet
        visible={mode !== null}
        mode={mode ?? 'strike'}
        parcel
        noShowFee={30}
        submitting={false}
        onSubmit={onSubmit}
        onClose={() => setMode(null)}
      />
    </ThemeProvider>
  );
};

/** Opens the sheet from the panel and lets it rise and settle on screen. */
const openSettled = async (springs: ReturnType<typeof holdSprings>) => {
  await act(async () => {});
  fireEvent.press(screen.getByTestId('panel-no-show'));
  await act(async () => {});
  // The Modal's container and the sheet's content are measured, then the open spring runs.
  const sheet = screen.getByTestId('cancel-reason-sheet');
  act(() => {
    fireEvent(sheet.parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
  });
  await layout('cancel-reason-sheet-body', 260);
  springs.finish();
  advance(motionPatterns.destructiveArmMs);
};

beforeEach(() => {
  modalQueue.reset();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('T-573 cancel / no-show sheet: no destructive tap after Keep or close', () => {
  it('after "Keep ride" the sliding sheet takes no touches and a tap on "Cancel as no-show" never submits', async () => {
    const springs = holdSprings();
    const onSubmit = jest.fn();
    render(<Host onSubmit={onSubmit} />);
    await openSettled(springs);
    expect(touchGateOf('cancel-reason-sheet')).toBe('auto');

    fireEvent.press(screen.getByTestId('cancel-reason-keep'));
    // The close spring is still running: the sheet is on screen, sliding out.
    expect(screen.getByTestId('cancel-reason-sheet')).toBeTruthy();
    expect(touchGateOf('cancel-reason-sheet')).toBe('none');
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).not.toHaveBeenCalled();

    // The sheet keeps its no-show copy while it slides out (no flip to the strike cancel).
    expect(screen.getByText("Sender didn't come?")).toBeTruthy();
    springs.finish();
    expect(screen.queryByTestId('cancel-reason-sheet')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a tap right after "Keep ride" is dropped even before the parent hides the sheet', async () => {
    const springs = holdSprings();
    const onSubmit = jest.fn();
    render(
      <ThemeProvider>
        <CancelReasonSheet visible mode="no_show" submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />
      </ThemeProvider>,
    );
    await act(async () => {});
    const sheet = screen.getByTestId('cancel-reason-sheet');
    act(() => {
      fireEvent(sheet.parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
    });
    await layout('cancel-reason-sheet-body', 260);
    springs.finish();
    advance(motionPatterns.destructiveArmMs);

    act(() => {
      fireEvent.press(screen.getByTestId('cancel-reason-keep'));
      fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reopened from the panel while sliding out, the next tap does not cancel the ride until the sheet has risen', async () => {
    const springs = holdSprings();
    const onSubmit = jest.fn();
    render(<Host onSubmit={onSubmit} />);
    await openSettled(springs);

    fireEvent.press(screen.getByTestId('cancel-reason-keep'));
    advance(100);
    fireEvent.press(screen.getByTestId('panel-no-show'));
    await act(async () => {});
    // Rising again: a tap ~0.1 s later meant for the panel lands on "Cancel as no-show".
    advance(100);
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).not.toHaveBeenCalled();

    // Once it has settled, a deliberate tap cancels as a no-show, once.
    advance(motionPatterns.destructiveArmMs);
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('The sender did not come to the pickup.');
  });

  it('a tap while the sheet is still rising (aimed at "Keep ride" or the panel) does not cancel the ride', async () => {
    const springs = holdSprings();
    const onSubmit = jest.fn();
    render(<Host onSubmit={onSubmit} />);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('panel-no-show'));
    await act(async () => {});
    const sheet = screen.getByTestId('cancel-reason-sheet');
    act(() => {
      fireEvent(sheet.parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
    });
    await layout('cancel-reason-sheet-body', 260);
    advance(100);
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    springs.finish();
  });
});

describe('T-573 hardening: arming and dismissal', () => {
  it('before the sheet is placed on screen (still to rise) its button takes no taps', async () => {
    const onSubmit = jest.fn();
    render(<CancelReasonSheet visible mode="no_show" submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    await act(async () => {});
    advance(10 * motionPatterns.destructiveArmMs);
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    place();
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('reopened mid-slide, a later re-measure (keyboard, content height) does not re-arm the button', async () => {
    const springs = holdSprings();
    const onSubmit = jest.fn();
    render(<Host onSubmit={onSubmit} />);
    await openSettled(springs);
    fireEvent.press(screen.getByTestId('cancel-reason-keep'));
    fireEvent.press(screen.getByTestId('panel-no-show'));
    await act(async () => {});
    advance(motionPatterns.destructiveArmMs);
    // The content grows: the sheet re-places itself on a new snap height.
    await layout('cancel-reason-sheet-body', 320);
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('while a cancel is in flight the scrim and Android back do not close the sheet; Keep is disabled', async () => {
    // Real (mock) springs: a close that starts finishes at once and would call onClose.
    const onClose = jest.fn();
    render(
      <ThemeProvider>
        <CancelReasonSheet visible mode="no_show" submitting onSubmit={jest.fn()} onClose={onClose} />
      </ThemeProvider>,
    );
    await act(async () => {});
    place();
    fireEvent.press(screen.getByTestId('cancel-reason-sheet-scrim'));
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    fireEvent.press(screen.getByTestId('cancel-reason-keep'));
    await act(async () => {});
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('cancel-reason-sheet')).toBeTruthy();
    expect(touchGateOf('cancel-reason-sheet')).toBe('auto');
  });

  it('once the cancel has settled, a scrim tap closes the sheet again', async () => {
    const onClose = jest.fn();
    const view = render(
      <ThemeProvider>
        <CancelReasonSheet visible mode="no_show" submitting onSubmit={jest.fn()} onClose={onClose} />
      </ThemeProvider>,
    );
    await act(async () => {});
    place();
    view.rerender(
      <ThemeProvider>
        <CancelReasonSheet visible mode="no_show" submitting={false} onSubmit={jest.fn()} onClose={onClose} />
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByTestId('cancel-reason-sheet-scrim'));
    await act(async () => {});
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('T-573 cancel / no-show sheet: one tap, one cancel', () => {
  it('a double tap on "Cancel as no-show" sends once', async () => {
    const onSubmit = jest.fn();
    render(<CancelReasonSheet visible mode="no_show" submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    await act(async () => {});
    place();
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('a refused cancel lets the driver try again; a new opening starts fresh', async () => {
    let refuse: (ok: boolean) => void = () => {};
    const onSubmit = jest.fn(() => new Promise<boolean>(resolve => (refuse = resolve)));
    const view = render(<CancelReasonSheet visible mode="no_show" submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    await act(async () => {});
    place();
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => refuse(false));
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(2);

    view.rerender(<CancelReasonSheet visible={false} mode="no_show" submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    await act(async () => {});
    view.rerender(<CancelReasonSheet visible mode="no_show" submitting={false} onSubmit={onSubmit} onClose={jest.fn()} />);
    await act(async () => {});
    place();
    fireEvent.press(screen.getByTestId('cancel-reason-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(3);
  });
});
